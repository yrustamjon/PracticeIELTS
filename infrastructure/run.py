"""Run a command from the repository root. Django loads .env without overriding runtime bindings."""

import os
import sys
from pathlib import Path

if len(sys.argv) < 2:
    raise SystemExit("Usage: python infrastructure/run.py COMMAND [ARGS...]")
os.chdir(Path(__file__).resolve().parent.parent)
os.execvp(sys.argv[1], sys.argv[1:])
