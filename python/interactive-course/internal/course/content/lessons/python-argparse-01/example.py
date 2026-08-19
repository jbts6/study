import argparse


def build_parser():
    """Build the command-line parser for the log auditor."""
    parser = argparse.ArgumentParser(description="审计本地日志目录")
    parser.add_argument("log_dir", help="包含 .log 文件的目录")
    parser.add_argument(
        "--output",
        default="audit-output",
        help="报告输出目录（默认：audit-output）",
    )
    parser.add_argument(
        "--format",
        choices=("json", "csv", "both"),
        default="both",
        help="报告格式（默认：both）",
    )
    return parser
