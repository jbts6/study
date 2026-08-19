from pathlib import Path


def collect_log_files(root):
    """Return all .log files beneath root in stable order."""
    return list(Path(root).glob("*.log"))
