from pathlib import Path


def read_lines(file_path):
    """Read non-empty, stripped UTF-8 lines from a text file."""
    text = Path(file_path).read_text(encoding="utf-8")
    return [line.strip() for line in text.splitlines() if line.strip()]
