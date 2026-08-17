def summarize(lines):
    """Return total and error counts for the given log lines."""
    errors = 0
    for line in lines:
        if "ERROR" in line:
            errors += 1
    return {"total": len(lines), "errors": errors}
