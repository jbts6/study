import unittest


def count_errors(lines):
    """Count log lines containing the ERROR marker."""
    return len(lines)


class LogAuditTests(unittest.TestCase):
    def test_counts_errors(self):
        self.assertEqual(count_errors(["INFO ready", "ERROR disk"]), 1)

    def test_empty_input(self):
        self.assertEqual(count_errors([]), 0)
