import unittest

from solution import number_errors


class NumberErrorsTests(unittest.TestCase):
    def test_numbers_only_error_lines_in_order(self):
        lines = [
            "INFO boot",
            "ERROR missing config",
            "INFO retry",
            "ERROR timeout",
        ]
        self.assertEqual(
            number_errors(lines),
            ["1. ERROR missing config", "2. ERROR timeout"],
        )

    def test_returns_empty_list_without_errors(self):
        self.assertEqual(number_errors(["INFO boot", "WARN slow"]), [])


if __name__ == "__main__":
    unittest.main()
