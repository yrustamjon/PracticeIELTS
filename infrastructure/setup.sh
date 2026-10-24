#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend ci --cache /workspace/.npm-cache
python - <<'PY'
from pathlib import Path
import secrets
p=Path('.env')
if not p.exists():
    p.write_text('DEBUG=true\nPOSTGRES_PASSWORD='+secrets.token_urlsafe(24)+'\nDJANGO_SECRET_KEY='+secrets.token_urlsafe(64)+'\n')
    p.chmod(0o600)
PY
docker compose up -d --wait db redis
python infrastructure/run.py backend/.venv/bin/python backend/manage.py migrate --noinput
python infrastructure/run.py backend/.venv/bin/python backend/manage.py check
npm --prefix frontend run build
