import tempfile
import unittest
from pathlib import Path

from solution import LogAuditTests, count_errors


class UnittestLessonTests(unittest.TestCase):
    def test_learner_tests_are_discoverable_and_pass(self):
        method_names = [
            name for name in dir(LogAuditTests) if name.startswith("test_")
        ]
        self.assertGreaterEqual(len(method_names), 2)

        suite = unittest.defaultTestLoader.loadTestsFromTestCase(LogAuditTests)
        result = unittest.TestResult()
        suite.run(result)

        self.assertEqual(result.testsRun, len(method_names))
        self.assertEqual(result.failures, [])
        self.assertEqual(result.errors, [])

    def test_count_errors_uses_an_isolated_file_fixture(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "audit.log"
            path.write_text("INFO ready\nERROR disk\n", encoding="utf-8")
            lines = path.read_text(encoding="utf-8").splitlines()

            self.assertEqual(count_errors(lines), 1)


if __name__ == "__main__":
    unittest.main()
