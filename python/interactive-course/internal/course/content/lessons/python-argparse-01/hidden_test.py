import contextlib
import io
import unittest

from solution import build_parser


class BuildParserTests(unittest.TestCase):
    def test_parses_required_argument_and_defaults(self):
        args = build_parser().parse_args(["logs"])

        self.assertEqual(args.log_dir, "logs")
        self.assertEqual(args.output, "audit-output")
        self.assertEqual(args.format, "both")

    def test_parses_explicit_output_and_format(self):
        args = build_parser().parse_args(
            ["logs", "--output", "reports", "--format", "csv"]
        )

        self.assertEqual(args.output, "reports")
        self.assertEqual(args.format, "csv")

    def test_rejects_an_unknown_format(self):
        with contextlib.redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit):
                build_parser().parse_args(["logs", "--format", "xml"])


if __name__ == "__main__":
    unittest.main()
