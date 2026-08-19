from datetime import datetime


def parse_timestamp(value):
    """Parse an ISO timestamp into a datetime value."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def is_at_or_after(value, cutoff):
    """Return whether the timestamp reaches the cutoff."""
    return parse_timestamp(value) >= cutoff
