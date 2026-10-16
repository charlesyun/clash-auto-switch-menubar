use crate::{
    config::{Config, IVerge, profiles::record_selected_node},
    core::{
        CoreManager,
        handle::Handle,
        notify::{Refresh, announce},
    },
    process::AsyncHandler,
};
use anyhow::{Context as _, Result, bail, ensure};
use futures::{StreamExt as _, stream};
use parking_lot::RwLock;
use serde::Serialize;
use std::{
    collections::{BTreeMap, BTreeSet},
    sync::{
        OnceLock,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};
use tauri_plugin_mihomo::models::{Proxies, Proxy};
use tokio::sync::{Mutex, watch};

#[derive(Clone, Debug, PartialEq, Eq)]
struct Settings {
    enabled: bool,
    interval_minutes: u64,
    threshold_ms: u32,
    url: String,
    timeout_ms: u32,
}

impl Settings {
    fn from_verge(verge: &IVerge) -> Self {
        Self {
            enabled: verge.enable_auto_switch.unwrap_or(false),
            interval_minutes: verge.auto_switch_interval_minutes.unwrap_or(30).clamp(1, 1440),
            threshold_ms: verge.auto_switch_threshold_ms.unwrap_or(50).min(10000),
            url: verge
                .default_latency_test
                .as_deref()
                .filter(|url| !url.is_empty())
                .unwrap_or("https://www.gstatic.com/generate_204")
                .to_owned(),
            timeout_ms: verge
                .default_latency_timeout
                .filter(|timeout| *timeout > 0)
                .unwrap_or(10000) as u32,
        }
    }
}

#[derive(Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoSwitchStatus {
    pub running: bool,
    pub dry_run: bool,
    pub last_run: Option<i64>,
    pub next_run: Option<i64>,
    pub error: Option<String>,
    pub results: Vec<GroupResult>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupResult {
    group: String,
    current: String,
    winner: Option<String>,
    delay: Option<u32>,
    outcome: &'static str,
    warning: Option<String>,
}

pub struct AutoSwitchManager {
    settings: watch::Sender<Settings>,
    status: RwLock<AutoSwitchStatus>,
    execution: Mutex<()>,
    started: AtomicBool,
}

impl AutoSwitchManager {
    pub fn global() -> &'static Self {
        static INSTANCE: OnceLock<AutoSwitchManager> = OnceLock::new();
        INSTANCE.get_or_init(|| {
            let (settings, _) = watch::channel(Settings::from_verge(&IVerge::default()));
            Self {
                settings,
                status: RwLock::new(AutoSwitchStatus::default()),
                execution: Mutex::new(()),
                started: AtomicBool::new(false),
            }
        })
    }

    pub async fn refresh_settings(&self) {
        let settings = Settings::from_verge(&Config::verge().await.data_arc());
        self.settings.send_if_modified(|current| {
            if *current == settings {
                return false;
            }
            *current = settings;
            true
        });
        if !self.started.swap(true, Ordering::AcqRel) {
            AsyncHandler::spawn(|| async { Self::global().schedule().await });
        }
    }

    pub fn status(&self) -> AutoSwitchStatus {
        self.status.read().clone()
    }

    pub fn stop(&self) {
        self.settings.send_modify(|settings| settings.enabled = false);
        self.status.write().next_run = None;
    }

    async fn schedule(&self) {
        let mut settings_rx = self.settings.subscribe();
        loop {
            let settings = settings_rx.borrow_and_update().clone();
            if !settings.enabled {
                self.status.write().next_run = None;
                if settings_rx.changed().await.is_err() {
                    return;
                }
                continue;
            }
            let seconds = settings.interval_minutes * 60;
            self.status.write().next_run = Some(chrono::Utc::now().timestamp() + seconds as i64);
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(seconds)) => {
                    if !settings_rx.has_changed().unwrap_or(true) && self.settings.borrow().enabled {
                        let _ = self.run(false).await;
                    }
                }
                changed = settings_rx.changed() => {
                    if changed.is_err() { return; }
                }
            }
        }
    }

    pub async fn run(&self, dry_run: bool) -> Result<AutoSwitchStatus> {
        let _execution = self
            .execution
            .try_lock()
            .context("An automatic switch or speed test is already running")?;
        ensure!(!Handle::global().is_exiting(), "Clash Verge is exiting");
        let mut settings_rx = self.settings.subscribe();
        let settings = settings_rx.borrow_and_update().clone();
        {
            let mut status = self.status.write();
            status.running = true;
            status.dry_run = dry_run;
            status.error = None;
            status.results.clear();
        }
        let result = self.measure_and_switch(&settings, &mut settings_rx, dry_run).await;
        announce(Refresh::Proxies);
        let _ = crate::cmd::proxy::sync_tray_proxy_selection().await;
        let mut status = self.status.write();
        status.running = false;
        status.last_run = Some(chrono::Utc::now().timestamp());
        if let Err(error) = result {
            status.error = Some(format!("{error:#}"));
        }
        Ok(status.clone())
    }

    async fn measure_and_switch(
        &self,
        settings: &Settings,
        settings_rx: &mut watch::Receiver<Settings>,
        dry_run: bool,
    ) -> Result<()> {
        let manager = CoreManager::global();
        let generation = manager
            .current_core_readiness_generation()
            .context("The proxy core is not ready")?;
        let profile = Config::profiles().await.data_arc().current.clone();
        let mode = Config::clash()
            .await
            .data_arc()
            .get_mode()
            .unwrap_or_else(|| "rule".into());
        ensure!(mode != "direct", "Automatic switching is unavailable in direct mode");
        let mihomo = Handle::mihomo();
        let snapshot = mihomo.get_proxies().await?;
        let groups = active_groups(&snapshot, &mode);
        ensure!(!groups.is_empty(), "No active selector groups with proxy candidates");
        for group_name in groups {
            let Some(group) = snapshot.proxies.get(&group_name) else {
                continue;
            };
            let current = group.now.clone().unwrap_or_default();
            if is_bypass(&current) || snapshot.proxies.get(&current).is_some_and(bypass_proxy) {
                continue;
            }
            let candidates = candidates(&snapshot, group);
            if candidates.is_empty() {
                continue;
            }
            let measurements = stream::iter(candidates.into_iter().map(|name| async move {
                let result = mihomo
                    .delay_proxy_by_name(&name, &settings.url, settings.timeout_ms)
                    .await;
                (name, result.ok().map(|value| value.delay).filter(|delay| *delay > 0))
            }))
            .buffer_unordered(5)
            .collect::<Vec<_>>();
            let measurements = tokio::select! {
                result = tokio::time::timeout(Duration::from_secs(120), measurements) =>
                    result.context("Speed test exceeded two minutes")?,
                _ = settings_rx.changed() => bail!("Speed test canceled because its settings changed"),
            };
            let delays: BTreeMap<_, _> = measurements
                .into_iter()
                .filter_map(|(name, delay)| delay.map(|delay| (name, delay)))
                .collect();
            let winner = choose_winner(&current, &delays, settings.threshold_ms);
            let mut report = GroupResult {
                group: group_name.clone(),
                current: current.clone(),
                winner: winner.as_ref().map(|(name, _)| name.clone()),
                delay: winner.as_ref().map(|(_, delay)| *delay),
                outcome: if delays.is_empty() {
                    "unavailable"
                } else if dry_run {
                    "measured"
                } else {
                    "unchanged"
                },
                warning: None,
            };
            if !dry_run
                && let Some((winner, _)) = winner
                && winner != current
            {
                // Measurements cannot own lifecycle locks; revalidate their context before applying them.
                let _write = Config::lock_config_write().await;
                let _lifecycle = manager.lifecycle_lock.lock().await;
                ensure!(!Handle::global().is_exiting(), "Clash Verge is exiting");
                ensure!(
                    !settings_rx.has_changed()?,
                    "Switch canceled because its settings changed"
                );
                ensure!(
                    manager.current_core_readiness_generation() == Some(generation),
                    "The proxy core changed during the speed test"
                );
                ensure!(
                    Config::profiles().await.data_arc().current == profile,
                    "The subscription changed during the speed test"
                );
                ensure!(
                    Config::clash().await.data_arc().get_mode().as_deref() == Some(mode.as_str()),
                    "The proxy mode changed during the speed test"
                );
                let fresh_snapshot = mihomo.get_proxies().await?;
                let fresh = fresh_snapshot
                    .proxies
                    .get(&group_name)
                    .context("The proxy group no longer exists")?;
                if !active_groups(&fresh_snapshot, &mode).contains(&group_name)
                    || fresh.now.as_deref() != Some(current.as_str())
                    || !fresh.all.as_ref().is_some_and(|all| all.contains(&winner))
                {
                    report.outcome = "skipped";
                } else {
                    mihomo.select_node_for_group(&group_name, &winner).await?;
                    // Keep UI and persistence aligned with the applied operation, even on a later error.
                    announce(Refresh::Proxies);
                    let verified = mihomo.get_proxy_by_name(&group_name).await?;
                    ensure!(
                        verified.now.as_deref() == Some(winner.as_str()),
                        "The proxy core did not retain the selected node"
                    );
                    report.outcome = "switched";
                    if let Err(error) = record_selected_node(&group_name, &winner).await {
                        report.warning = Some(format!("Selection applied but could not be saved: {error:#}"));
                    }
                }
            }
            self.status.write().results.push(report);
        }
        ensure!(
            !self.status.read().results.is_empty(),
            "No eligible proxy candidates; bypass selections are preserved"
        );
        Ok(())
    }
}

fn is_bypass(name: &str) -> bool {
    matches!(name, "DIRECT" | "REJECT" | "REJECT-DROP" | "PASS" | "COMPATIBLE")
}

fn bypass_proxy(proxy: &Proxy) -> bool {
    matches!(
        proxy.proxy_type.as_str(),
        "Direct" | "Reject" | "RejectDrop" | "Compatible" | "Pass" | "PassRule" | "Dns"
    )
}

fn selector(proxy: &Proxy) -> bool {
    proxy.proxy_type.as_str().eq_ignore_ascii_case("selector")
}

fn active_groups(proxies: &Proxies, mode: &str) -> Vec<String> {
    let mut roots: Vec<_> = if mode == "global" {
        vec!["GLOBAL".to_owned()]
    } else {
        let nested: BTreeSet<_> = proxies
            .proxies
            .iter()
            .filter(|(name, _)| name.as_str() != "GLOBAL")
            .flat_map(|(_, proxy)| proxy.all.iter().flatten())
            .collect();
        proxies
            .proxies
            .iter()
            .filter(|(name, proxy)| name.as_str() != "GLOBAL" && selector(proxy) && !nested.contains(name))
            .map(|(name, _)| name.clone())
            .collect()
    };
    roots.sort();
    let mut visited = BTreeSet::new();
    let mut groups = Vec::new();
    for mut name in roots {
        while visited.insert(name.clone()) {
            let Some(proxy) = proxies.proxies.get(&name) else {
                break;
            };
            if selector(proxy) {
                groups.push(name.clone());
            }
            let Some(next) = &proxy.now else {
                break;
            };
            name = next.clone();
        }
    }
    groups
}

fn candidates(proxies: &Proxies, group: &Proxy) -> Vec<String> {
    let mut names: BTreeSet<_> = group
        .all
        .iter()
        .flatten()
        .filter(|name| !is_bypass(name))
        .filter(|name| {
            proxies
                .proxies
                .get(*name)
                .is_some_and(|proxy| !selector(proxy) && !bypass_proxy(proxy))
        })
        .cloned()
        .collect();
    if let Some(current) = &group.now
        && !is_bypass(current)
        && proxies.proxies.get(current).is_some_and(|proxy| !bypass_proxy(proxy))
    {
        names.insert(current.clone());
    }
    names.into_iter().collect()
}

fn choose_winner(current: &str, delays: &BTreeMap<String, u32>, threshold: u32) -> Option<(String, u32)> {
    let (name, delay) = delays
        .iter()
        .min_by_key(|(name, delay)| (**delay, name.as_str() != current))?;
    if let Some(current_delay) = delays.get(current)
        && (current_delay.saturating_sub(*delay) < threshold || current_delay == delay)
    {
        return Some((current.to_owned(), *current_delay));
    }
    Some((name.clone(), *delay))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn follows_only_selected_nested_selectors_and_stops_cycles() -> Result<()> {
        let proxies: Proxies = serde_json::from_value(json!({"proxies": {
            "GLOBAL": {"type":"Selector", "all":["Proxy"], "now":"Proxy"},
            "Proxy": {"type":"Selector", "all":["Active","Inactive"], "now":"Active"},
            "Active": {"type":"Selector", "all":["Proxy","Node"], "now":"Proxy"},
            "Inactive": {"type":"Selector", "all":["Node"], "now":"Node"},
            "Node": {"type":"Shadowsocks"}
        }}))?;
        assert_eq!(active_groups(&proxies, "global"), ["GLOBAL", "Proxy", "Active"]);
        assert!(active_groups(&proxies, "rule").is_empty());
        Ok(())
    }

    #[test]
    fn does_not_select_bypass_nodes_or_expand_nodes_outside_group() -> Result<()> {
        let proxies: Proxies = serde_json::from_value(json!({"proxies": {
            "Proxy": {"type":"Selector", "all":["DIRECT","REJECT","Custom direct","Nested","Auto","Node"], "now":"Nested"},
            "Nested": {"type":"Selector", "all":["Child"], "now":"Child"},
            "Auto": {"type":"URLTest", "all":["Child"], "now":"Child"},
            "Node": {"type":"Shadowsocks"}, "Child": {"type":"Shadowsocks"},
            "Custom direct": {"type":"Direct"}
        }}))?;
        assert_eq!(active_groups(&proxies, "rule"), ["Proxy", "Nested"]);
        assert_eq!(
            candidates(&proxies, &proxies.proxies["Proxy"]),
            ["Auto", "Nested", "Node"]
        );
        Ok(())
    }

    #[test]
    fn automatic_switching_is_opt_in_and_settings_are_bounded() {
        let mut verge = IVerge::default();
        let settings = Settings::from_verge(&verge);
        assert!(!settings.enabled);
        assert_eq!(settings.interval_minutes, 30);
        assert_eq!(settings.threshold_ms, 50);
        verge.auto_switch_interval_minutes = Some(u64::MAX);
        verge.auto_switch_threshold_ms = Some(u32::MAX);
        let settings = Settings::from_verge(&verge);
        assert_eq!(settings.interval_minutes, 1440);
        assert_eq!(settings.threshold_ms, 10000);
    }

    #[tokio::test]
    async fn concurrent_manual_and_scheduled_runs_are_rejected_before_accessing_core() {
        let (settings, _) = watch::channel(Settings::from_verge(&IVerge::default()));
        let manager = AutoSwitchManager {
            settings,
            status: RwLock::new(AutoSwitchStatus::default()),
            execution: Mutex::new(()),
            started: AtomicBool::new(false),
        };
        let _running = manager.execution.lock().await;
        assert!(manager.run(true).await.is_err());
        assert!(manager.run(false).await.is_err());
    }

    #[tokio::test(start_paused = true)]
    async fn disabling_schedule_clears_next_run_and_prevents_execution() {
        let mut initial = Settings::from_verge(&IVerge::default());
        initial.enabled = true;
        initial.interval_minutes = 1;
        let (settings, _) = watch::channel(initial);
        let manager = std::sync::Arc::new(AutoSwitchManager {
            settings,
            status: RwLock::new(AutoSwitchStatus::default()),
            execution: Mutex::new(()),
            started: AtomicBool::new(true),
        });
        let runner = manager.clone();
        let task = tokio::spawn(async move { runner.schedule().await });
        tokio::task::yield_now().await;
        assert!(manager.status().next_run.is_some());
        manager.stop();
        tokio::task::yield_now().await;
        tokio::time::advance(Duration::from_secs(61)).await;
        tokio::task::yield_now().await;
        assert!(manager.status().next_run.is_none());
        assert!(manager.status().last_run.is_none());
        assert!(!task.is_finished());
        task.abort();
    }

    #[test]
    fn threshold_and_failed_current_node_control_switching() {
        let delays = BTreeMap::from([("current".to_owned(), 100), ("fast".to_owned(), 60)]);
        assert_eq!(choose_winner("current", &delays, 50), Some(("current".to_owned(), 100)));
        assert_eq!(choose_winner("current", &delays, 40), Some(("fast".to_owned(), 60)));
        assert_eq!(choose_winner("unreachable", &delays, 50), Some(("fast".to_owned(), 60)));
        assert_eq!(choose_winner("current", &BTreeMap::new(), 0), None);
        let tied = BTreeMap::from([("current".to_owned(), 60), ("aaa".to_owned(), 60)]);
        assert_eq!(choose_winner("current", &tied, 0), Some(("current".to_owned(), 60)));
    }
}
