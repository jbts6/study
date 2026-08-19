from pathlib import Path


def collect_log_files(root):
    """Return all .log files beneath root in stable order."""
    base = Path(root)
    return sorted(
        (path for path in base.rglob("*.log") if path.is_file()),
        key=lambda path: path.as_posix(),
    )
