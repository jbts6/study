import unittest

from solution import summarize_sources


class SummarizeSourcesTests(unittest.TestCase):
    def test_counts_repeated_sources(self):
        entries = [
            {"source": "api"},
            {"source": "worker"},
            {"source": "api"},
        ]
        self.assertEqual(summarize_sources(entries), {"api": 2, "worker": 1})

    def test_groups_missing_sources_as_unknown(self):
        entries = [{"message": "ready"}, {"source": "api"}, {}]
        self.assertEqual(summarize_sources(entries), {"unknown": 2, "api": 1})


if __name__ == "__main__":
    unittest.main()
