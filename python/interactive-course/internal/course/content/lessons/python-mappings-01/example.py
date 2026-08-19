def summarize_sources(entries):
    """Return occurrence counts grouped by source."""
    counts = {}
    for entry in entries:
        source = entry.get("source", "unknown")
        counts[source] = counts.get(source, 0) + 1
    return counts
