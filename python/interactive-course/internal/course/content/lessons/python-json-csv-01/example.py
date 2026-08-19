import csv
import json
from pathlib import Path


def save_summary(summary, json_path, csv_path):
    """Write a summary as stable UTF-8 JSON and CSV files."""
    Path(json_path).write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    with Path(csv_path).open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["metric", "value"])
        writer.writerows(sorted(summary.items()))
