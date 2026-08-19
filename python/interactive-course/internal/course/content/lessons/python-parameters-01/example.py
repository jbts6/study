def count_level(lines, level="ERROR", *, case_sensitive=False):
    """Count log lines containing the selected level."""
    needle = level if case_sensitive else level.casefold()
    return sum(
        needle in (line if case_sensitive else line.casefold())
        for line in lines
    )
