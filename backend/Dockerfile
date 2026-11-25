# syntax=docker/dockerfile:1
# Imagen de la API — dependencias con uv y ejecución como usuario no root

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_CACHE_DIR=/tmp/uv-cache \
    PATH="/app/.venv/bin:$PATH"

# Instalar uv (gestor de paquetes y entornos virtuales para Python)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# Instalar solo dependencias de runtime antes de copiar el código
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Código de la aplicación y migraciones
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

# Ejecutar sin privilegios
RUN useradd --create-home --uid 10001 appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Aplica migraciones al arrancar y después levanta la API.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
