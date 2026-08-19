import unittest

from solution import count_level


class CountLevelTests(unittest.TestCase):
    def test_default_level_is_case_insensitive(self):
        lines = ["INFO ready", "ERROR failed", "error retry"]

        self.assertEqual(count_level(lines), 2)

    def test_case_sensitive_matching_can_be_enabled(self):
        lines = ["ERROR failed", "error retry", "Error delayed"]

        self.assertEqual(
            count_level(lines, "ERROR", case_sensitive=True),
            1,
        )


if __name__ == "__main__":
    unittest.main()
