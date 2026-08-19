def classify_level(line):
    """Return the normalized level for a log line."""
    if "ERROR" in line:
        return "error"
    if "WARN" in line:
        return "warning"
    return "info"
