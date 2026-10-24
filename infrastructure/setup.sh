#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
setup_python="${PRACTICEIELTS_PYTHON:-python3}"
"$setup_python" -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend ci --cache "$PWD/.cache/npm"
backend/.venv/bin/python - <<'PY'
from pathlib import Path
import secrets
p=Path('.env')
if not p.exists():
    p.write_text('DEBUG=true\nPOSTGRES_PASSWORD='+secrets.token_urlsafe(24)+'\nDJANGO_SECRET_KEY='+secrets.token_urlsafe(64)+'\n')
    p.chmod(0o600)
PY
if [[ "$(uname -s)" == Darwin ]]; then
  export BUILD_CA_BUNDLE="${BUILD_CA_BUNDLE:-/etc/ssl/cert.pem}"
fi
docker compose up -d --wait db redis
backend/.venv/bin/python infrastructure/run.py backend/.venv/bin/python backend/manage.py migrate --noinput
backend/.venv/bin/python infrastructure/run.py backend/.venv/bin/python backend/manage.py check
npm --prefix frontend run build
# Optional warm-up; workers can also download the model on first use.
if [[ "${PREPARE_SPEECH_MODEL:-0}" == 1 ]]; then
  backend/.venv/bin/python infrastructure/run.py backend/.venv/bin/python backend/manage.py download_transcription_model
fi
