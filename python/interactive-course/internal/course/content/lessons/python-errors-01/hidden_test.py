import tempfile
import unittest
from pathlib import Path

from solution import LogLoadError, load_log


class LoadLogTests(unittest.TestCase):
    def test_loads_non_empty_lines_from_path(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "audit.log"
            path.write_text(" INFO ready \n\n ERROR disk \n", encoding="utf-8")

            self.assertEqual(load_log(path), ["INFO ready", "ERROR disk"])

    def test_missing_file_keeps_cause_and_context(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "missing.log"

            with self.assertRaises(LogLoadError) as context:
                load_log(str(path))

            self.assertIn("找不到日志文件", str(context.exception))
            self.assertIn(str(path), str(context.exception))
            self.assertIsInstance(context.exception.__cause__, FileNotFoundError)

    def test_empty_file_has_specific_message(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "empty.log"
            path.write_text(" \n\t\n", encoding="utf-8")

            with self.assertRaisesRegex(LogLoadError, "日志文件为空"):
                load_log(path)


if __name__ == "__main__":
    unittest.main()
