import unittest

from solution import recent_entries


class RecentEntriesTests(unittest.TestCase):
    def test_returns_recent_entries_without_changing_input(self):
        lines = ["one", "two", "three", "four", "five"]
        result = recent_entries(lines)
        self.assertEqual(result, ["three", "four", "five"])
        self.assertIsNot(result, lines)
        self.assertEqual(lines, ["one", "two", "three", "four", "five"])

    def test_non_positive_limit_returns_empty_list(self):
        self.assertEqual(recent_entries(("one", "two"), 0), [])
        self.assertEqual(recent_entries(["one", "two"], -1), [])


if __name__ == "__main__":
    unittest.main()
