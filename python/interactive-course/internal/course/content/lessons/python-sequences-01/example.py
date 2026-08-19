def recent_entries(lines, limit=3):
    """Return a new list containing the most recent entries."""
    if limit <= 0:
        return []
    return list(lines[-limit:])
