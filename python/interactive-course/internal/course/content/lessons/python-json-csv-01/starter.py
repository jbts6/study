import csv
import json
from pathlib import Path


def save_summary(summary, json_path, csv_path):
    """Write a summary as stable UTF-8 JSON and CSV files."""
    Path(json_path).write_text(str(summary), encoding="utf-8")
    with Path(csv_path).open("w", encoding="utf-8") as handle:
        handle.write("metric,value\n")
        for metric, value in summary.items():
            handle.write(f"{metric},{value}\n")
