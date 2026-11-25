"""Password hashing (Argon2id) and JWT helpers."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()  # Argon2id con parámetros recomendados por defecto.
_ALGORITHM = "HS256"

TokenType = Literal["access", "refresh"]


def hash_password(password: str) -> str:
    """Hash a password with Argon2id."""
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    """Return True when the password matches the stored hash."""
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_needs_rehash(password_hash: str) -> bool:
    """Return True when the hash parameters are outdated."""
    return _hasher.check_needs_rehash(password_hash)


@dataclass(frozen=True)
class TokenPayload:
    """Decoded claims of a devnull token."""

    user_id: int
    jti: str
    expires_at: datetime


def _secret(kind: TokenType) -> str:
    settings = get_settings()
    secret = settings.JWT_SECRET if kind == "access" else settings.REFRESH_SECRET
    return secret.get_secret_value()


def create_token(user_id: int, kind: TokenType) -> tuple[str, TokenPayload]:
    """Create a signed JWT of the given kind and return it with its claims."""
    settings = get_settings()
    now = datetime.now(UTC).replace(microsecond=0)
    ttl = (
        timedelta(minutes=settings.ACCESS_TOKEN_TTL_MINUTES)
        if kind == "access"
        else timedelta(days=settings.REFRESH_TOKEN_TTL_DAYS)
    )
    payload = TokenPayload(user_id=user_id, jti=uuid.uuid4().hex, expires_at=now + ttl)
    token = jwt.encode(
        {
            "sub": str(user_id),
            "jti": payload.jti,
            "typ": kind,
            "iat": int(now.timestamp()),
            "exp": int(payload.expires_at.timestamp()),
        },
        _secret(kind),
        algorithm=_ALGORITHM,
    )
    return token, payload


def decode_token(token: str, kind: TokenType) -> TokenPayload | None:
    """Validate a JWT and return its claims, or None if invalid or expired."""
    try:
        claims = jwt.decode(
            token,
            _secret(kind),
            algorithms=[_ALGORITHM],
            options={"require": ["sub", "jti", "exp", "typ"]},
        )
    except jwt.PyJWTError:
        return None
    if claims.get("typ") != kind:
        return None
    try:
        user_id = int(claims["sub"])
    except (TypeError, ValueError):
        return None
    return TokenPayload(
        user_id=user_id,
        jti=str(claims["jti"]),
        expires_at=datetime.fromtimestamp(int(claims["exp"]), tz=UTC),
    )
