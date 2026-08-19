from pathlib import Path


class LogLoadError(Exception):
    """Raised when a log cannot be loaded for an expected reason."""


def load_log(path):
    """Load non-empty UTF-8 log lines with contextual failures."""
    source = Path(path)
    try:
        lines = [
            line.strip()
            for line in source.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    except FileNotFoundError as error:
        raise LogLoadError(f"找不到日志文件: {source}") from error
    if not lines:
        raise LogLoadError(f"日志文件为空: {source}")
    return lines
