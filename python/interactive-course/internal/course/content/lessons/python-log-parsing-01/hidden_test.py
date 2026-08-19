import unittest

from solution import LogEntry, parse_line


class ParseLineTests(unittest.TestCase):
    def test_preserves_pipes_and_normalizes_fields(self):
        entry = parse_line(" 2026-08-19T09:00:00Z | warn | disk | nearly full ")

        self.assertIsInstance(entry, LogEntry)
        self.assertEqual(
            entry,
            LogEntry("2026-08-19T09:00:00Z", "WARN", "disk | nearly full"),
        )

    def test_rejects_missing_or_empty_fields(self):
        for line in ("2026|INFO", "2026||ready", "|INFO|ready", "2026|INFO|"):
            with self.subTest(line=line):
                with self.assertRaisesRegex(
                    ValueError, "日志格式必须是 timestamp\\|level\\|message"
                ):
                    parse_line(line)

    def test_record_is_frozen(self):
        entry = parse_line("2026|INFO|ready")

        with self.assertRaises(Exception):
            entry.level = "ERROR"


if __name__ == "__main__":
    unittest.main()
