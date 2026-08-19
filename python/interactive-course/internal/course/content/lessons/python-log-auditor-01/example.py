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
    """Build the command-line interface for the log auditor."""
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


def collect_log_files(root):
    """Return all .log files beneath root in stable order."""
    base = Path(root)
    return sorted(
        (path for path in base.rglob("*.log") if path.is_file()),
        key=lambda path: path.as_posix(),
    )


def parse_line(line):
    """Parse timestamp|level|message into an immutable record."""
    parts = [part.strip() for part in line.split("|", maxsplit=2)]
    if len(parts) != 3 or not all(parts):
        raise ValueError("日志格式必须是 timestamp|level|message")
    return LogEntry(parts[0], parts[1].upper(), parts[2])


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


def audit_logs(log_dir, output_dir, output_format="both"):
    """Audit every non-empty line in the discovered log files."""
    files = collect_log_files(log_dir)
    entries = []
    invalid = 0
    for file_path in files:
        for line in file_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                entries.append(parse_line(line))
            except ValueError:
                invalid += 1

    summary = build_report(entries)
    report = {
        "files": len(files),
        "records": summary["records"],
        "invalid": invalid,
        "by_level": summary["by_level"],
    }
    write_reports(report, output_dir, output_format)
    return report


def main(argv=None):
    """Run the command-line auditor and return a process exit code."""
    args = build_parser().parse_args(argv)
    source = Path(args.log_dir)
    if not source.is_dir():
        print(f"日志目录不存在: {source}", file=sys.stderr)
        return 1

    report = audit_logs(source, args.output, args.format)
    print(f"已审计 {report['files']} 个文件、{report['records']} 条记录")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
