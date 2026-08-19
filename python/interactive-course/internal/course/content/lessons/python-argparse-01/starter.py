import argparse


def build_parser():
    """Build the command-line parser for the log auditor."""
    parser = argparse.ArgumentParser(description="审计本地日志目录")
    parser.add_argument("log_dir", help="包含 .log 文件的目录")
    return parser
