import contextlib
import csv
import io
import json
import tempfile
import unittest
from pathlib import Path

from solution import audit_logs, main


class LogAuditorTests(unittest.TestCase):
    def create_logs(self, root):
        nested = root / "service"
        nested.mkdir()
        (root / "b.log").write_text(
            "2026-08-19T09:02:00Z|WARN|slow\n"
            "2026-08-19T09:03:00Z|ERROR|disk\n",
            encoding="utf-8",
        )
        (nested / "a.log").write_text(
            "2026-08-19T09:00:00Z|INFO|ready\n"
            "bad record\n\n",
            encoding="utf-8",
        )
        (root / "ignore.txt").write_text("not a log", encoding="utf-8")

    def test_audits_logs_and_writes_both_reports(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "logs"
            output = Path(directory) / "reports"
            root.mkdir()
            self.create_logs(root)

            report = audit_logs(root, output)

            self.assertEqual(
                report,
                {
                    "files": 2,
                    "records": 3,
                    "invalid": 1,
                    "by_level": {"ERROR": 1, "INFO": 1, "WARN": 1},
                },
            )
            self.assertEqual(
                json.loads((output / "audit.json").read_text(encoding="utf-8")),
                report,
            )
            with (output / "audit.csv").open(encoding="utf-8", newline="") as handle:
                self.assertEqual(
                    list(csv.reader(handle)),
                    [
                        ["level", "count"],
                        ["ERROR", "1"],
                        ["INFO", "1"],
                        ["WARN", "1"],
                    ],
                )

    def test_main_reports_success(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "logs"
            output = Path(directory) / "reports"
            root.mkdir()
            (root / "app.log").write_text(
                "2026-08-19T09:00:00Z|INFO|ready\n",
                encoding="utf-8",
            )
            stdout = io.StringIO()

            with contextlib.redirect_stdout(stdout):
                exit_code = main([str(root), "--output", str(output)])

            self.assertEqual(exit_code, 0)
            self.assertIn("已审计 1 个文件、1 条记录", stdout.getvalue())
            self.assertTrue((output / "audit.json").is_file())
            self.assertTrue((output / "audit.csv").is_file())

    def test_missing_directory_returns_failure_without_output(self):
        with tempfile.TemporaryDirectory() as directory:
            missing = Path(directory) / "missing"
            output = Path(directory) / "reports"
            stderr = io.StringIO()

            with contextlib.redirect_stderr(stderr):
                exit_code = main([str(missing), "--output", str(output)])

            self.assertEqual(exit_code, 1)
            self.assertIn(f"日志目录不存在: {missing}", stderr.getvalue())
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
