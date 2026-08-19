import unittest

from solution import classify_level


class ClassifyLevelTests(unittest.TestCase):
    def test_classifies_standard_levels(self):
        self.assertEqual(classify_level("ERROR timeout"), "error")
        self.assertEqual(classify_level("WARN slow response"), "warning")
        self.assertEqual(classify_level("INFO ready"), "info")

    def test_error_has_priority_over_warning(self):
        self.assertEqual(classify_level("WARN then ERROR"), "error")


if __name__ == "__main__":
    unittest.main()
