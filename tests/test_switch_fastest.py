from __future__ import annotations

import argparse
import importlib.util
import os
import tempfile
import threading
import time
import unittest
from pathlib import Path
from unittest import mock


SCRIPT_PATH = Path(__file__).parents[1] / "scripts" / "switch_fastest.py"
SPEC = importlib.util.spec_from_file_location("switch_fastest", SCRIPT_PATH)
assert SPEC and SPEC.loader
switch_fastest = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(switch_fastest)


def selector(options: list[str], now: str) -> dict[str, object]:
    return {"type": "Selector", "all": options, "now": now}


def leaf() -> dict[str, object]:
    return {"type": "Shadowsocks"}


class GroupDiscoveryTests(unittest.TestCase):
    def test_current_scope_follows_only_global_selected_chain(self) -> None:
        proxies = {
            "GLOBAL": {"type": "Selector", "all": ["Active", "Inactive"], "now": "Active"},
            "Active": selector(["Nested", "Node A"], "Nested"),
            "Nested": selector(["Node A", "Node B"], "Node A"),
            "Inactive": selector(["Unused", "Node C"], "Unused"),
            "Unused": selector(["Node C", "Node D"], "Node C"),
            "Node A": leaf(),
            "Node B": leaf(),
            "Node C": leaf(),
            "Node D": leaf(),
        }

        self.assertEqual(
            switch_fastest.list_current_selector_groups(proxies),
            ["Active", "Nested"],
        )

    def test_current_scope_falls_back_to_top_level_groups_without_global(self) -> None:
        proxies = {
            "Proxy": selector(["Node A", "Node B"], "Node A"),
            "Node A": leaf(),
            "Node B": leaf(),
        }

        self.assertEqual(
            switch_fastest.list_current_selector_groups(proxies),
            ["Proxy"],
        )

    def test_selected_chain_stops_on_cycle(self) -> None:
        proxies = {
            "A": selector(["B", "Node A"], "B"),
            "B": selector(["A", "Node B"], "A"),
            "Node A": leaf(),
            "Node B": leaf(),
        }

        self.assertEqual(switch_fastest.follow_selected_chain("A", proxies), ["A", "B"])


class ConfigurationTests(unittest.TestCase):
    def make_args(self, **overrides: object) -> argparse.Namespace:
        values = {
            "unix_socket": None,
            "controller_url": None,
            "secret": None,
        }
        values.update(overrides)
        return argparse.Namespace(**values)

    def test_explicit_secret_overrides_environment_and_config(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            home = Path(temp_dir)
            config_dir = home / ".config" / "clash"
            config_dir.mkdir(parents=True)
            (config_dir / "config.yaml").write_text(
                "external-controller: 127.0.0.1:9097\nsecret: config-secret\n",
                encoding="utf-8",
            )

            with mock.patch.object(switch_fastest.Path, "home", return_value=home), mock.patch.dict(
                os.environ,
                {"CLASH_API_URL": "http://127.0.0.1:9098", "CLASH_API_SECRET": "env-secret"},
                clear=True,
            ):
                candidates = switch_fastest.build_candidates(
                    self.make_args(secret="explicit-secret")
                )

        self.assertEqual({item["secret"] for item in candidates}, {"explicit-secret"})

    def test_secret_is_passed_to_curl_via_stdin(self) -> None:
        completed = mock.Mock(returncode=0, stdout='{"version":"test"}', stderr="")
        with mock.patch.object(switch_fastest, "run_curl", return_value=completed) as run_curl:
            switch_fastest.api_request(
                {"kind": "http", "address": "http://127.0.0.1:9097", "secret": "private"},
                "GET",
                "/version",
            )

        command = run_curl.call_args.args[0]
        self.assertNotIn("private", command)
        self.assertEqual(
            run_curl.call_args.kwargs["stdin_text"],
            "Authorization: Bearer private\n",
        )


class MeasurementTests(unittest.TestCase):
    def test_measurement_uses_bounded_concurrency_and_preserves_order(self) -> None:
        active = 0
        maximum_active = 0
        lock = threading.Lock()

        def fake_measure(*args: object) -> int:
            nonlocal active, maximum_active
            with lock:
                active += 1
                maximum_active = max(maximum_active, active)
            time.sleep(0.02)
            with lock:
                active -= 1
            proxy_name = str(args[1])
            return int(proxy_name.rsplit(" ", 1)[1])

        candidates = [f"Node {index}" for index in range(1, 7)]
        with mock.patch.object(switch_fastest, "measure_delay", side_effect=fake_measure):
            results = switch_fastest.measure_candidates(
                {"kind": "http", "address": "http://127.0.0.1", "secret": ""},
                candidates,
                "http://1.1.1.1",
                5000,
                3,
            )

        self.assertEqual([name for _, name in results], candidates)
        self.assertGreater(maximum_active, 1)
        self.assertLessEqual(maximum_active, 3)

    def test_switch_improvement_is_computed_only_when_both_delays_exist(self) -> None:
        delays = {"Current": 120, "Winner": 50}
        self.assertEqual(
            switch_fastest.switch_improvement_ms("Current", "Winner", delays),
            70,
        )
        self.assertIsNone(
            switch_fastest.switch_improvement_ms("Unknown", "Winner", delays)
        )


class ValidationTests(unittest.TestCase):
    def test_concurrency_is_limited(self) -> None:
        self.assertEqual(switch_fastest.concurrency_value("5"), 5)
        with self.assertRaises(argparse.ArgumentTypeError):
            switch_fastest.concurrency_value("11")

    def test_threshold_allows_zero(self) -> None:
        self.assertEqual(switch_fastest.non_negative_int("0"), 0)
        with self.assertRaises(argparse.ArgumentTypeError):
            switch_fastest.non_negative_int("-1")


if __name__ == "__main__":
    unittest.main()
