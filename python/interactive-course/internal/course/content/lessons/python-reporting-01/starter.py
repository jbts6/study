import csv
import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class LogEntry:
    timestamp: str
    level: str
    message: str


def build_report(entries):
    """Aggregate records and normalized level counts."""
    return {"records": 0, "by_level": {}}


def write_reports(report, output_dir, output_format="both"):
    """Write audit.json, audit.csv, or both report files."""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
