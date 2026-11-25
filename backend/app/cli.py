"""Command line utilities.

Uso:
    uv run python -m app.cli create-admin --email tu@correo.com

La contraseña se pide de forma interactiva o se lee de ADMIN_PASSWORD
(útil en entornos no interactivos). Nunca se acepta como argumento.
"""

import argparse
import asyncio
import getpass
import os
import sys

from app.core.db import async_session_factory, engine
from app.core.errors import AppError
from app.modules.auth import service


async def _create_admin(email: str, password: str) -> int:
    async with async_session_factory() as session:
        try:
            user = await service.create_admin(session, email, password)
        except AppError as exc:
            print(f"Error: {exc.message}", file=sys.stderr)
            return 1
    await engine.dispose()
    print(f"Administrador creado: {user.email} (id={user.id})")
    return 0


def _read_password() -> str:
    from_env = os.environ.get("ADMIN_PASSWORD")
    if from_env:
        return from_env
    first = getpass.getpass("Contraseña: ")
    second = getpass.getpass("Repite la contraseña: ")
    if first != second:
        print("Error: las contraseñas no coinciden.", file=sys.stderr)
        raise SystemExit(1)
    return first


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    create = sub.add_parser("create-admin", help="Crear la cuenta de administrador")
    create.add_argument("--email", required=True)

    args = parser.parse_args(argv)
    if args.command == "create-admin":
        return asyncio.run(_create_admin(args.email, _read_password()))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
