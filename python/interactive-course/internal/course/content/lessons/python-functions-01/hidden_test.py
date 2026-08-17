import unittest

from solution import summarize


class SummarizeTests(unittest.TestCase):
    def test_counts_total_and_error_lines(self):
        lines = [
            "INFO boot",
            "ERROR missing config",
            "INFO ready",
            "ERROR timeout",
        ]
        self.assertEqual(summarize(lines), {"total": 4, "errors": 2})


if __name__ == "__main__":
    unittest.main()
