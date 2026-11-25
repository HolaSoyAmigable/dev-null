"""Domain errors and handlers that render the contract error envelope."""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ErrorDetail(BaseModel):
    code: str = Field(description="Código estable para la máquina, p. ej. NOT_FOUND")
    message: str = Field(description="Mensaje legible en español")
    details: dict[str, Any] = Field(default_factory=dict)


class ErrorResponse(BaseModel):
    """Sobre de error común a todas las respuestas 4xx/5xx."""

    error: ErrorDetail


class AppError(Exception):
    """Base error with an HTTP status and a stable machine code."""

    status_code: int = status.HTTP_400_BAD_REQUEST
    code: str = "BAD_REQUEST"
    message: str = "Solicitud inválida."

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(AppError):
    status_code = status.HTTP_404_NOT_FOUND
    code = "NOT_FOUND"
    message = "El recurso solicitado no existe."


class ConflictError(AppError):
    status_code = status.HTTP_409_CONFLICT
    code = "CONFLICT"
    message = "El recurso entra en conflicto con el estado actual."


class UnauthorizedError(AppError):
    status_code = status.HTTP_401_UNAUTHORIZED
    code = "UNAUTHORIZED"
    message = "Autenticación requerida."


class ForbiddenError(AppError):
    status_code = status.HTTP_403_FORBIDDEN
    code = "FORBIDDEN"
    message = "No tienes permiso para esta acción."


class ValidationError(AppError):
    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    code = "VALIDATION_ERROR"
    message = "Los datos enviados no son válidos."


class PayloadTooLargeError(AppError):
    status_code = status.HTTP_413_CONTENT_TOO_LARGE
    code = "PAYLOAD_TOO_LARGE"
    message = "El archivo supera el tamaño máximo permitido."


class RateLimitedError(AppError):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    code = "RATE_LIMITED"
    message = "Demasiadas solicitudes. Inténtalo más tarde."


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    """Build the error envelope defined in the API contract."""
    return {"error": {"code": code, "message": message, "details": details or {}}}


_HTTP_CODES: dict[int, tuple[str, str]] = {
    400: ("BAD_REQUEST", "Solicitud inválida."),
    401: ("UNAUTHORIZED", "Autenticación requerida."),
    403: ("FORBIDDEN", "No tienes permiso para esta acción."),
    404: ("NOT_FOUND", "El recurso solicitado no existe."),
    405: ("METHOD_NOT_ALLOWED", "Método no permitido."),
    409: ("CONFLICT", "El recurso entra en conflicto con el estado actual."),
    429: ("RATE_LIMITED", "Demasiadas solicitudes. Inténtalo más tarde."),
}


async def _app_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    headers = {"Retry-After": "60"} if isinstance(exc, RateLimitedError) else None
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(exc.code, exc.message, exc.details),
        headers=headers,
    )


async def _http_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code, message = _HTTP_CODES.get(exc.status_code, ("HTTP_ERROR", "Error en la solicitud."))
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, message),
        headers=getattr(exc, "headers", None),
    )


async def _validation_error_handler(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    errors = [
        {"loc": [str(part) for part in err.get("loc", ())], "msg": err.get("msg", "")}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=error_body(
            "VALIDATION_ERROR", "Los datos enviados no son válidos.", {"errors": errors}
        ),
    )


async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception: %s", type(exc).__name__)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_body("INTERNAL_ERROR", "Error interno del servidor."),
    )


def register_error_handlers(app: FastAPI) -> None:
    """Attach all error handlers to the application."""
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    app.add_exception_handler(Exception, _unhandled_error_handler)
