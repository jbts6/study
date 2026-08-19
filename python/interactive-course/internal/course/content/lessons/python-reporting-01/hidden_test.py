import csv
import json
import tempfile
import unittest
from pathlib import Path

from solution import LogEntry, build_report, write_reports


class ReportingTests(unittest.TestCase):
    def test_builds_a_normalized_report_from_an_iterable(self):
        entries = (
            entry
            for entry in [
                LogEntry("1", "error", "disk"),
                LogEntry("2", "WARN", "slow"),
                LogEntry("3", "ERROR", "memory"),
            ]
        )

        self.assertEqual(
            build_report(entries),
            {"records": 3, "by_level": {"ERROR": 2, "WARN": 1}},
        )

    def test_writes_parseable_json_and_csv(self):
        report = {"records": 3, "by_level": {"ERROR": 2, "WARN": 1}}
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "reports"
            write_reports(report, output, "both")

            self.assertEqual(
                json.loads((output / "audit.json").read_text(encoding="utf-8")),
                report,
            )
            with (output / "audit.csv").open(encoding="utf-8", newline="") as handle:
                self.assertEqual(
                    list(csv.reader(handle)),
                    [["level", "count"], ["ERROR", "2"], ["WARN", "1"]],
                )


if __name__ == "__main__":
    unittest.main()
