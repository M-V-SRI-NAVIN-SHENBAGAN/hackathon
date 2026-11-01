"""
config.py
=========
Reads the PostgreSQL connection settings.

Priority
--------
1. Environment variables (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD).
2. A `.env` file placed next to this `app` folder (see `.env.example`).
3. The default values below (works with a standard local PostgreSQL
   installation where the user is `postgres`).

Keeping the settings in one place means the rest of the program never
hard-codes a password.
"""

import os
from pathlib import Path

# The folder that contains the `app` package (i.e. hotel_management_system/)
BASE_DIR = Path(__file__).resolve().parent.parent

DEFAULTS = {
    "DB_HOST": "localhost",
    "DB_PORT": "5432",
    "DB_NAME": "hotel_db",
    "DB_USER": "postgres",
    "DB_PASSWORD": "postgres",
}


def load_env_file(path: Path) -> None:
    """Read a simple KEY=VALUE file into os.environ (existing values win)."""
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        # Do not overwrite a variable that the user already exported.
        os.environ.setdefault(key, value)


def get_config() -> dict:
    """Return the connection settings as a dictionary."""
    load_env_file(BASE_DIR / ".env")

    config = {"dsn": os.environ.get("DATABASE_URL", "").strip()}
    for key, default in DEFAULTS.items():
        config[key] = os.environ.get(key, default)
    return config


def describe(config: dict) -> str:
    """Human readable connection description used by the status screen."""
    if config.get("dsn"):
        return "Connection string from DATABASE_URL"
    return (
        f"host={config['DB_HOST']} port={config['DB_PORT']} "
        f"dbname={config['DB_NAME']} user={config['DB_USER']}"
    )
