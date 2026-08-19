import unittest
from dataclasses import FrozenInstanceError, fields

from solution import LogEntry, make_entry


class LogEntryTests(unittest.TestCase):
    def test_declares_the_expected_fields(self):
        self.assertEqual(
            [field.name for field in fields(LogEntry)],
            ["timestamp", "level", "message"],
        )

    def test_entries_are_frozen(self):
        entry = LogEntry("2026-08-19T09:00:00Z", "ERROR", "failed")

        with self.assertRaises(FrozenInstanceError):
            entry.level = "INFO"

    def test_factory_normalizes_level_and_message(self):
        entry = make_entry(
            "2026-08-19T09:00:00Z",
            "warning",
            "  disk nearly full  ",
        )

        self.assertEqual(
            entry,
            LogEntry(
                "2026-08-19T09:00:00Z",
                "WARNING",
                "disk nearly full",
            ),
        )


if __name__ == "__main__":
    unittest.main()
