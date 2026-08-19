def format_summary(source, total, errors):
    """Return a formatted summary for one log source."""
    return f"{source}: {errors}/{total} errors"
