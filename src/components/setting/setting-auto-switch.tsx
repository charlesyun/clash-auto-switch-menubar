import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Switch } from '@/components/base'
import { useVerge } from '@/hooks/use-verge'
import { getAutoSwitchStatus, runAutoSwitch } from '@/services/cmds'
import { mutate } from '@/services/mutate'
import { showNotice } from '@/services/notice-service'
import { useQuery } from '@/services/query-client'

import { SettingItem, SettingList } from './mods/setting-comp'

const SettingAutoSwitch = ({
  mode = 'settings',
}: {
  mode?: 'settings' | 'controls'
}) => {
  const { t } = useTranslation()
  const { verge, patchVerge } = useVerge()
  const [draft, setDraft] = useState<{
    enabled: boolean
    interval: string
    threshold: string
  } | null>(null)
  const enabled = draft?.enabled ?? verge?.enable_auto_switch ?? false
  const interval =
    draft?.interval ?? String(verge?.auto_switch_interval_minutes ?? 30)
  const threshold =
    draft?.threshold ?? String(verge?.auto_switch_threshold_ms ?? 50)
  const [busy, setBusy] = useState(false)
  const { data: status, refetch } = useQuery({
    queryKey: ['getAutoSwitchStatus'],
    queryFn: getAutoSwitchStatus,
    refetchInterval: 2000,
  })

  const valid =
    /^\d+$/.test(interval) &&
    Number(interval) >= 1 &&
    Number(interval) <= 1440 &&
    /^\d+$/.test(threshold) &&
    Number(threshold) <= 10000
  const disabled = busy || Boolean(status?.running) || !verge
  const time = (value: number | null | undefined) =>
    value
      ? new Date(value * 1000).toLocaleString()
      : t('settings.autoSwitch.never')
  const outcomes = {
    measured: t('settings.autoSwitch.measured'),
    unchanged: t('settings.autoSwitch.unchanged'),
    switched: t('settings.autoSwitch.switched'),
    skipped: t('settings.autoSwitch.skipped'),
    unavailable: t('settings.autoSwitch.unavailable'),
  }

  const save = async () => {
    if (!valid || busy || !verge) return
    setBusy(true)
    try {
      await patchVerge({
        enable_auto_switch: enabled,
        auto_switch_interval_minutes: Number(interval),
        auto_switch_threshold_ms: Number(threshold),
      })
      setDraft(null)
      await refetch()
    } catch (error) {
      showNotice.error(error)
    } finally {
      setBusy(false)
    }
  }

  const run = async (dryRun: boolean) => {
    setBusy(true)
    try {
      await mutate(() => runAutoSwitch(dryRun), {
        id: 'auto-switch',
        revalidate: [['getAutoSwitchStatus'], ['getProxyView']],
        errorNotice: false,
      })
    } catch (error) {
      showNotice.error(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingList title={t('settings.autoSwitch.title')}>
      {mode === 'settings' && (
        <SettingItem label={t('settings.autoSwitch.enabled')}>
          <Switch
            checked={enabled}
            disabled={busy || !verge}
            onChange={(_, checked) =>
              setDraft({ enabled: checked, interval, threshold })
            }
            slotProps={{
              input: { 'aria-label': t('settings.autoSwitch.enabled') },
            }}
          />
        </SettingItem>
      )}
      <Box sx={{ px: 2, pb: 1 }}>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {mode === 'settings'
              ? t('settings.autoSwitch.description')
              : verge?.enable_auto_switch
                ? t('settings.minimal.autoOn', {
                    minutes: verge.auto_switch_interval_minutes ?? 30,
                    threshold: verge.auto_switch_threshold_ms ?? 50,
                  })
                : t('settings.minimal.autoOff')}
          </Typography>
          {mode === 'settings' && (
            <Stack direction="row" spacing={1}>
              <TextField
                label={t('settings.autoSwitch.interval')}
                type="number"
                size="small"
                value={interval}
                disabled={busy || !verge}
                onChange={(event) =>
                  setDraft({ enabled, interval: event.target.value, threshold })
                }
                slotProps={{ htmlInput: { min: 1, max: 1440, step: 1 } }}
                fullWidth
              />
              <TextField
                label={t('settings.autoSwitch.threshold')}
                type="number"
                size="small"
                value={threshold}
                disabled={busy || !verge}
                onChange={(event) =>
                  setDraft({ enabled, interval, threshold: event.target.value })
                }
                slotProps={{ htmlInput: { min: 0, max: 10000, step: 1 } }}
                fullWidth
              />
            </Stack>
          )}
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {mode === 'settings' && (
              <Button
                onClick={save}
                disabled={!valid || busy || !verge}
                variant="contained"
              >
                {t('settings.autoSwitch.save')}
              </Button>
            )}
            {mode === 'controls' && (
              <Button onClick={() => run(true)} disabled={disabled}>
                {t('settings.autoSwitch.test')}
              </Button>
            )}
            {mode === 'controls' && (
              <Button onClick={() => run(false)} disabled={disabled}>
                {t('settings.autoSwitch.switch')}
              </Button>
            )}
          </Stack>
          <Typography variant="body2" aria-live="polite">
            {status?.running
              ? t('settings.autoSwitch.running')
              : t('settings.autoSwitch.lastRun', {
                  time: time(status?.lastRun),
                })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('settings.autoSwitch.nextRun', { time: time(status?.nextRun) })}
          </Typography>
          {status?.error && <Alert severity="warning">{status.error}</Alert>}
          {status?.results.map((result) => (
            <Box key={result.group}>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {result.group}: {outcomes[result.outcome]} · {result.current}
                {result.winner && ` → ${result.winner}`}
                {result.delay != null && ` (${result.delay} ms)`}
              </Typography>
              {result.warning && (
                <Alert severity="warning">{result.warning}</Alert>
              )}
            </Box>
          ))}
        </Stack>
      </Box>
    </SettingList>
  )
}

export default SettingAutoSwitch
