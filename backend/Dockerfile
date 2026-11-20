# syntax=docker/dockerfile:1
# Dockerfile mínimo para la API — el código de aplicación se añade en la tarea 0.3

FROM python:3.12-slim

# Instalar uv (gestor de paquetes y entornos virtuales para Python)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

WORKDIR /app

# TODO 0.3: copiar pyproject.toml, uv.lock e instalar dependencias
# TODO 0.3: copiar el código de la app y definir el CMD de arranque
