def number_errors(lines):
    """Return numbered error lines."""
    errors = [line for line in lines if "ERROR" in line]
    return [f"{index}. {line}" for index, line in enumerate(errors, start=1)]
