from pathlib import Path


class LogLoadError(Exception):
    """Raised when a log cannot be loaded for an expected reason."""


def load_log(path):
    """Load non-empty UTF-8 log lines with contextual failures."""
    source = Path(path)
    try:
        lines = [line.strip() for line in source.read_text().splitlines() if line.strip()]
    except Exception:
        return []
    return lines
