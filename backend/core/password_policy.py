"""Password policy helpers used to validate user credentials."""

from __future__ import annotations

import re


MIN_LENGTH = 12
_PATTERN = re.compile(
    r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{%d,}$" % MIN_LENGTH
)


class WeakPasswordError(ValueError):
    """Raised when a password does not meet the required complexity."""


def validate_password_strength(password: str) -> None:
    """Raise ``WeakPasswordError`` if ``password`` is too weak."""
    if not _PATTERN.match(password):
        raise WeakPasswordError(
            "Password must be at least 12 characters and include upper, lower, digit, and special characters."
        )


def strength_label(password: str) -> str:
    """Return a coarse strength label for UI gauges."""
    if not password:
        return "empty"
    if len(password) < MIN_LENGTH:
        return "weak"
    score = sum(bool(regex.search(password)) for regex in (
        re.compile(r"[a-z]"),
        re.compile(r"[A-Z]"),
        re.compile(r"\d"),
        re.compile(r"[^A-Za-z0-9]"),
        re.compile(r".{16,}"),
    ))
    if score >= 4:
        return "strong"
    if score >= 3:
        return "medium"
    return "weak"
