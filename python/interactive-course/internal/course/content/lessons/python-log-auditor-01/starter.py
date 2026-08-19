import argparse
import csv
import json
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class LogEntry:
    timestamp: str
    level: str
    message: str


def build_parser():
    parser = argparse.ArgumentParser(description="审计本地日志目录")
    parser.add_argument("log_dir")
    parser.add_argument("--output", default="audit-output")
    parser.add_argument("--format", default="both")
    return parser


def collect_log_files(root):
    return []


def parse_line(line):
    raise ValueError("日志格式必须是 timestamp|level|message")


def build_report(entries):
    return {"records": 0, "by_level": {}}


def write_reports(report, output_dir, output_format="both"):
    return None


def audit_logs(log_dir, output_dir, output_format="both"):
    return {"files": 0, "records": 0, "invalid": 0, "by_level": {}}


def main(argv=None):
    build_parser().parse_args(argv)
    return 0
