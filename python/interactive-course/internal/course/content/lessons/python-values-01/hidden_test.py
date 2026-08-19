import unittest

from solution import format_summary


class FormatSummaryTests(unittest.TestCase):
    def test_formats_counts_for_a_source(self):
        self.assertEqual(format_summary("worker", 5, 2), "worker: 2/5 errors")

    def test_formats_zero_counts(self):
        self.assertEqual(format_summary("api", 0, 0), "api: 0/0 errors")


if __name__ == "__main__":
    unittest.main()
