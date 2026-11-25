"""HTTP routes for authentication."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Response, status
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_session
from app.core.ratelimit import login_rate_limit
from app.core.redis import get_redis
from app.modules.auth import service
from app.modules.auth.deps import CurrentUser
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    TokenResponse,
    UserRead,
)

REFRESH_COOKIE = "devnull_refresh"
REFRESH_COOKIE_PATH = "/api/v1/auth"

router = APIRouter(prefix="/auth", tags=["auth"])

SessionDep = Annotated[AsyncSession, Depends(get_session)]
RedisDep = Annotated[Redis, Depends(get_redis)]
RefreshCookie = Annotated[str | None, Cookie(alias=REFRESH_COOKIE)]


def _set_refresh_cookie(response: Response, tokens: service.IssuedTokens) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=tokens.refresh_token,
        expires=tokens.refresh_expires_at,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=get_settings().COOKIE_SECURE,
        samesite="lax",
    )


def _token_response(tokens: service.IssuedTokens) -> TokenResponse:
    return TokenResponse(access_token=tokens.access_token, expires_in=tokens.access_expires_in)


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(login_rate_limit)],
    summary="Iniciar sesión",
)
async def login(
    body: LoginRequest, response: Response, session: SessionDep, redis: RedisDep
) -> TokenResponse:
    tokens = await service.login(session, redis, body.email, body.password)
    _set_refresh_cookie(response, tokens)
    return _token_response(tokens)


@router.post("/refresh", response_model=TokenResponse, summary="Rotar el refresh token")
async def refresh(
    response: Response,
    session: SessionDep,
    redis: RedisDep,
    refresh_token: RefreshCookie = None,
) -> TokenResponse:
    tokens = await service.refresh(session, redis, refresh_token)
    _set_refresh_cookie(response, tokens)
    return _token_response(tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Cerrar sesión")
async def logout(response: Response, redis: RedisDep, refresh_token: RefreshCookie = None) -> None:
    await service.logout(redis, refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


@router.get("/me", response_model=UserRead, summary="Usuario autenticado")
async def me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@router.post(
    "/change-password", status_code=status.HTTP_204_NO_CONTENT, summary="Cambiar contraseña"
)
async def change_password(
    body: ChangePasswordRequest,
    response: Response,
    user: CurrentUser,
    session: SessionDep,
    redis: RedisDep,
) -> None:
    await service.change_password(session, redis, user, body.current_password, body.new_password)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
