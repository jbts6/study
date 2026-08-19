import tempfile
import unittest
from pathlib import Path

from solution import collect_log_files


class CollectLogFilesTests(unittest.TestCase):
    def test_recurses_filters_and_sorts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            nested = root / "service"
            nested.mkdir()
            (root / "z.log").write_text("z", encoding="utf-8")
            (nested / "a.log").write_text("a", encoding="utf-8")
            (root / "ignore.txt").write_text("x", encoding="utf-8")
            (root / "folder.log").mkdir()

            files = collect_log_files(str(root))

            self.assertEqual(
                [path.relative_to(root).as_posix() for path in files],
                ["service/a.log", "z.log"],
            )

    def test_accepts_a_path_object_and_empty_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            self.assertEqual(collect_log_files(Path(directory)), [])


if __name__ == "__main__":
    unittest.main()
