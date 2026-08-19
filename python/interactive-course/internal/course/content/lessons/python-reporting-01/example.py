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
    records = 0
    by_level = {}
    for entry in entries:
        records += 1
        level = entry.level.upper()
        by_level[level] = by_level.get(level, 0) + 1
    return {"records": records, "by_level": dict(sorted(by_level.items()))}


def write_reports(report, output_dir, output_format="both"):
    """Write audit.json, audit.csv, or both report files."""
    target = Path(output_dir)
    target.mkdir(parents=True, exist_ok=True)
    if output_format in {"json", "both"}:
        (target / "audit.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    if output_format in {"csv", "both"}:
        with (target / "audit.csv").open(
            "w", encoding="utf-8", newline=""
        ) as handle:
            writer = csv.writer(handle)
            writer.writerow(["level", "count"])
            writer.writerows(report["by_level"].items())
