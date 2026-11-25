"""Minimal User-Agent classification (bots, device, browser, OS).

Decisión (tarea 5.1): lista mantenida manualmente en lugar de una biblioteca
externa. Cubre los crawlers y clientes HTTP más comunes.
"""

import re
from dataclasses import dataclass

_BOT = re.compile(
    r"bot|crawl|spider|slurp|scrap|facebookexternalhit|embedly|preview|headless|"
    r"lighthouse|pagespeed|pingdom|uptime|monitor|curl|wget|python-|httpx|aiohttp|"
    r"go-http|java/|okhttp|axios|node-fetch|undici|libwww|phantomjs|selenium|"
    r"puppeteer|playwright|feedfetcher|rss|validator",
    re.IGNORECASE,
)
_TABLET = re.compile(r"ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))", re.IGNORECASE)
_MOBILE = re.compile(r"mobi|iphone|ipod|android.*mobile|windows phone|blackberry", re.IGNORECASE)

_BROWSERS: list[tuple[str, re.Pattern[str]]] = [
    ("Edge", re.compile(r"edg(e|a|ios)?/", re.IGNORECASE)),
    ("Opera", re.compile(r"opr/|opera", re.IGNORECASE)),
    ("Samsung Internet", re.compile(r"samsungbrowser", re.IGNORECASE)),
    ("Firefox", re.compile(r"firefox|fxios", re.IGNORECASE)),
    ("Chrome", re.compile(r"chrome|crios|chromium", re.IGNORECASE)),
    ("Safari", re.compile(r"safari", re.IGNORECASE)),
]
_OSES: list[tuple[str, re.Pattern[str]]] = [
    ("iOS", re.compile(r"iphone|ipad|ipod", re.IGNORECASE)),
    ("Android", re.compile(r"android", re.IGNORECASE)),
    ("Windows", re.compile(r"windows", re.IGNORECASE)),
    ("macOS", re.compile(r"mac os x|macintosh", re.IGNORECASE)),
    ("ChromeOS", re.compile(r"cros", re.IGNORECASE)),
    ("Linux", re.compile(r"linux", re.IGNORECASE)),
]


@dataclass(frozen=True)
class ClientInfo:
    device_type: str
    browser: str | None
    os: str | None
    is_bot: bool


def _first_match(ua: str, patterns: list[tuple[str, re.Pattern[str]]]) -> str | None:
    return next((name for name, pattern in patterns if pattern.search(ua)), None)


def classify(user_agent: str, accept_language: str | None) -> ClientInfo:
    """Classify a request; requests without browser-like headers count as bots."""
    ua = user_agent.strip()
    is_bot = not ua or not accept_language or bool(_BOT.search(ua))
    if _TABLET.search(ua):
        device = "tablet"
    elif _MOBILE.search(ua):
        device = "mobile"
    else:
        device = "desktop"
    return ClientInfo(
        device_type=device,
        browser=_first_match(ua, _BROWSERS),
        os=_first_match(ua, _OSES),
        is_bot=is_bot,
    )
