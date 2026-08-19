from dataclasses import dataclass


@dataclass(frozen=True)
class LogEntry:
    timestamp: str
    level: str
    message: str


def make_entry(timestamp, level, message):
    """Build a normalized log entry from raw values."""
    return LogEntry(timestamp, level.upper(), message.strip())
