"""Slug generation for public URLs."""

import re
import unicodedata

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
MAX_SLUG_LENGTH = 120


def slugify(value: str) -> str:
    """Convert text to an ASCII, lowercase, hyphen-separated slug."""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = _NON_ALNUM.sub("-", ascii_text).strip("-")
    return slug[:MAX_SLUG_LENGTH].rstrip("-") or "sin-titulo"
