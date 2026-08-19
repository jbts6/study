import csv
import json
import tempfile
import unittest
from pathlib import Path

from solution import save_summary


class SaveSummaryTests(unittest.TestCase):
    def test_writes_parseable_json_and_csv_from_string_paths(self):
        summary = {"错误,磁盘": 2, "就绪": 4, "引号\"": 1}

        with tempfile.TemporaryDirectory() as directory:
            json_path = Path(directory) / "summary.json"
            csv_path = Path(directory) / "summary.csv"
            save_summary(summary, str(json_path), str(csv_path))

            self.assertEqual(json.loads(json_path.read_text(encoding="utf-8")), summary)
            with csv_path.open(encoding="utf-8", newline="") as handle:
                rows = list(csv.reader(handle))

            self.assertEqual(rows[0], ["metric", "value"])
            self.assertEqual(
                rows[1:],
                [[metric, str(summary[metric])] for metric in sorted(summary)],
            )

    def test_accepts_path_objects_and_writes_utf8(self):
        summary = {"启动": 1}

        with tempfile.TemporaryDirectory() as directory:
            json_path = Path(directory) / "summary.json"
            csv_path = Path(directory) / "summary.csv"
            save_summary(summary, json_path, csv_path)

            self.assertIn("启动", json_path.read_text(encoding="utf-8"))
            self.assertEqual(csv_path.read_text(encoding="utf-8").splitlines()[1], "启动,1")


if __name__ == "__main__":
    unittest.main()
