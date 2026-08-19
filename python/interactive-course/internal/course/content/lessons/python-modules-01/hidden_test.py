import unittest
from datetime import datetime, timezone

from solution import is_at_or_after, parse_timestamp


class TimestampTests(unittest.TestCase):
    def test_parses_z_as_utc(self):
        parsed = parse_timestamp("2026-08-19T09:00:00Z")

        self.assertEqual(
            parsed,
            datetime(2026, 8, 19, 9, 0, tzinfo=timezone.utc),
        )

    def test_rejects_a_timestamp_before_the_cutoff(self):
        cutoff = datetime(2026, 8, 19, 9, 0, tzinfo=timezone.utc)

        self.assertFalse(is_at_or_after("2026-08-19T08:59:59Z", cutoff))

    def test_accepts_a_timestamp_equal_to_the_cutoff(self):
        cutoff = datetime(2026, 8, 19, 9, 0, tzinfo=timezone.utc)

        self.assertTrue(is_at_or_after("2026-08-19T09:00:00Z", cutoff))


if __name__ == "__main__":
    unittest.main()
