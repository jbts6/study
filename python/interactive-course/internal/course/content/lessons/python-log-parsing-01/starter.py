from dataclasses import dataclass


@dataclass(frozen=True)
class LogEntry:
    timestamp: str
    level: str
    message: str


def parse_line(line):
    """Parse timestamp|level|message into an immutable record."""
    parts = [part.strip() for part in line.split("|")]
    if len(parts) < 3:
        raise ValueError("日志格式必须是 timestamp|level|message")
    return LogEntry(parts[0], parts[1], "|".join(parts[2:]))
