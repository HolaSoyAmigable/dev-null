"""Authentication logic: login, refresh rotation, logout and passwords.

Los refresh tokens válidos se guardan en una lista blanca en Redis
(`auth:refresh:{jti}`). Rotar o cerrar sesión borra la entrada, de modo que un
token reutilizado deja de ser aceptado.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import UnauthorizedError, ValidationError
from app.core.security import (
    TokenPayload,
    create_token,
    decode_token,
    hash_password,
    password_needs_rehash,
    verify_password,
)
from app.modules.auth import repository
from app.modules.auth.models import User
from app.modules.auth.schemas import MIN_PASSWORD_LENGTH

logger = logging.getLogger(__name__)

# Hash de referencia para igualar el tiempo de respuesta cuando el email no existe.
_DUMMY_HASH = hash_password("devnull-timing-equalizer")


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    access_expires_in: int
    refresh_expires_at: datetime


def _refresh_key(jti: str) -> str:
    return f"auth:refresh:{jti}"


def _user_tokens_key(user_id: int) -> str:
    return f"auth:user_tokens:{user_id}"


def normalize_email(email: str) -> str:
    return email.strip().lower()


async def _issue_tokens(redis: Redis, user_id: int) -> IssuedTokens:
    settings = get_settings()
    access_token, _ = create_token(user_id, "access")
    refresh_token, refresh = create_token(user_id, "refresh")
    ttl = max(1, int((refresh.expires_at - datetime.now(UTC)).total_seconds()))
    async with redis.pipeline(transaction=True) as pipe:
        pipe.set(_refresh_key(refresh.jti), str(user_id), ex=ttl)
        pipe.sadd(_user_tokens_key(user_id), refresh.jti)
        pipe.expire(_user_tokens_key(user_id), ttl)
        await pipe.execute()
    return IssuedTokens(
        access_token=access_token,
        refresh_token=refresh_token,
        access_expires_in=settings.ACCESS_TOKEN_TTL_MINUTES * 60,
        refresh_expires_at=refresh.expires_at,
    )


async def login(session: AsyncSession, redis: Redis, email: str, password: str) -> IssuedTokens:
    """Validate credentials and issue a new token pair."""
    user = await repository.get_by_email(session, normalize_email(email))
    if user is None or not user.is_active:
        verify_password(_DUMMY_HASH, password)
        logger.warning("Failed login attempt (unknown or inactive user)")
        raise UnauthorizedError("Credenciales inválidas.", code="INVALID_CREDENTIALS")
    if not verify_password(user.password_hash, password):
        logger.warning("Failed login attempt (wrong password) user_id=%s", user.id)
        raise UnauthorizedError("Credenciales inválidas.", code="INVALID_CREDENTIALS")

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        await session.commit()
    return await _issue_tokens(redis, user.id)


async def _consume_refresh(redis: Redis, token: str | None) -> TokenPayload:
    payload = decode_token(token, "refresh") if token else None
    if payload is None:
        raise UnauthorizedError("Sesión inválida o expirada.", code="INVALID_REFRESH")
    stored = await redis.getdel(_refresh_key(payload.jti))
    if stored is None or int(stored) != payload.user_id:
        raise UnauthorizedError("Sesión inválida o expirada.", code="INVALID_REFRESH")
    await redis.srem(_user_tokens_key(payload.user_id), payload.jti)
    return payload


async def refresh(session: AsyncSession, redis: Redis, token: str | None) -> IssuedTokens:
    """Rotate a refresh token: invalidate the old one and issue a new pair."""
    payload = await _consume_refresh(redis, token)
    user = await repository.get_by_id(session, payload.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Sesión inválida o expirada.", code="INVALID_REFRESH")
    return await _issue_tokens(redis, user.id)


async def logout(redis: Redis, token: str | None) -> None:
    """Invalidate the refresh token if it is still valid; never fails."""
    payload = decode_token(token, "refresh") if token else None
    if payload is None:
        return
    await redis.delete(_refresh_key(payload.jti))
    await redis.srem(_user_tokens_key(payload.user_id), payload.jti)


async def revoke_all_sessions(redis: Redis, user_id: int) -> None:
    """Invalidate every refresh token of the user."""
    jtis = await redis.smembers(_user_tokens_key(user_id))
    keys = [_refresh_key(str(jti)) for jti in jtis]
    if keys:
        await redis.delete(*keys)
    await redis.delete(_user_tokens_key(user_id))


async def user_from_access_token(session: AsyncSession, token: str) -> User:
    """Resolve the active user behind an access token."""
    payload = decode_token(token, "access")
    if payload is None:
        raise UnauthorizedError("Token inválido o expirado.", code="INVALID_TOKEN")
    user = await repository.get_by_id(session, payload.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("Token inválido o expirado.", code="INVALID_TOKEN")
    return user


async def change_password(
    session: AsyncSession, redis: Redis, user: User, current: str, new: str
) -> None:
    """Change the password and close every other session."""
    if not verify_password(user.password_hash, current):
        raise ValidationError("La contraseña actual no es correcta.", code="INVALID_PASSWORD")
    if current == new:
        raise ValidationError(
            "La nueva contraseña debe ser distinta de la actual.", code="SAME_PASSWORD"
        )
    user.password_hash = hash_password(new)
    await session.commit()
    await revoke_all_sessions(redis, user.id)


async def create_admin(session: AsyncSession, email: str, password: str) -> User:
    """Create the administrator account (used by the CLI)."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValidationError(
            f"La contraseña debe tener al menos {MIN_PASSWORD_LENGTH} caracteres."
        )
    normalized = normalize_email(email)
    if "@" not in normalized:
        raise ValidationError("El email no es válido.")
    if await repository.get_by_email(session, normalized) is not None:
        raise ValidationError("Ya existe un usuario con ese email.", code="USER_EXISTS")
    user = await repository.add(
        session, User(email=normalized, password_hash=hash_password(password), role="admin")
    )
    await session.commit()
    return user
