from dataclasses import dataclass


@dataclass
class LogEntry:
    timestamp: str
    level: str
    message: str


def make_entry(timestamp, level, message):
    """Build a log entry from raw values."""
    return LogEntry(timestamp, level, message)
