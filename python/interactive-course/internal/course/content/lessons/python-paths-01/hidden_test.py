import tempfile
import unittest
from pathlib import Path

from solution import read_lines


class ReadLinesTests(unittest.TestCase):
    def test_accepts_string_and_path_and_cleans_lines(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "audit.log"
            path.write_text("  启动  \n\n  就绪\n   \n", encoding="utf-8")

            self.assertEqual(read_lines(str(path)), ["启动", "就绪"])
            self.assertEqual(read_lines(path), ["启动", "就绪"])

    def test_missing_file_uses_path_error(self):
        with tempfile.TemporaryDirectory() as directory:
            missing = Path(directory) / "missing.log"

            with self.assertRaises(FileNotFoundError):
                read_lines(missing)


if __name__ == "__main__":
    unittest.main()
