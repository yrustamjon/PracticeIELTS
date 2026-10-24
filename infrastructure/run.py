"""Load local configuration without printing secrets; run a command from the repo root."""

import os
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
for line in (
    (root / ".env").read_text().splitlines() if (root / ".env").exists() else []
):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        key, value = line.split("=", 1)
        if value:
            os.environ.setdefault(key, value)
if (
    os.getenv("POSTGRES_PASSWORD")
    and not os.getenv("DATABASE_URL")
    and not os.getenv("USE_SQLITE")
):
    from urllib.parse import quote

    os.environ["DATABASE_URL"] = (
        "postgresql://practiceielts:"
        + quote(os.environ["POSTGRES_PASSWORD"], safe="")
        + "@127.0.0.1:5432/practiceielts"
    )
if len(sys.argv) < 2:
    raise SystemExit("Usage: python infrastructure/run.py COMMAND [ARGS...]")
os.chdir(root)
os.execvp(sys.argv[1], sys.argv[1:])
