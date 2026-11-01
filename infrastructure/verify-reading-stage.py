"""Run one reviewed Full Reading test against the fixed isolated DB/media only.

Usage: backend/.venv/bin/python infrastructure/verify-reading-stage.py --book 14 --test 2
The private fixture must already be prepared by an explicitly stage-only import.
"""

import argparse
import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--book",
    type=int,
    choices=[10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21],
    required=True,
)
parser.add_argument("--test", type=int, choices=[1, 2, 3, 4], required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
assert root == Path("/home/PracticeIELTS")
sys.path[:0] = ["/tmp", str(root / "backend")]
os.environ["DJANGO_SETTINGS_MODULE"] = "practiceielts_reading_stage"
import django

django.setup()
from django.conf import settings
from reading.models import ReadingPaper

assert (
    str(settings.DATABASES["default"]["NAME"])
    == "/tmp/practiceielts-reading-stage/db.sqlite3"
)
assert str(settings.MEDIA_ROOT) == "/tmp/practiceielts-reading-stage/media"
fixture = Path(f"/tmp/reading-c{args.book}t{args.test}-browser-private.json")
data = json.loads(fixture.read_text())
assert data["book"] == f"Cambridge {args.book}" and data["test"] == args.test
assert len(data["answers"]) == 40
assert ReadingPaper.objects.filter(
    pk=data["paper"], book=data["book"], test=args.test
).exists()
build = Path("/tmp/practiceielts-reading-share-build")
assert (build / "index.html").is_file()
config = Path("/tmp/reading-content-stage-preview.config.mjs")
config.write_text(
    "export default {preview:{host:'127.0.0.1',port:5194,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:8114',changeOrigin:true}}},build:{outDir:'/tmp/practiceielts-reading-share-build'}};\n"
)
node = str(root / ".runtime/node_modules/node/bin/node")
env = dict(os.environ, PYTHONPATH="/tmp:/home/PracticeIELTS/backend")
children = []


def stop_on_signal(signum, _frame):
    raise SystemExit(128 + signum)


signal.signal(signal.SIGTERM, stop_on_signal)
log_path = Path(f"/tmp/reading-c{args.book}-t{args.test}-stage-services.log")
with log_path.open("w") as log:
    try:
        children.append(
            subprocess.Popen(
                [
                    str(root / "backend/.venv/bin/python"),
                    str(root / "backend/manage.py"),
                    "runserver",
                    "127.0.0.1:8114",
                    "--noreload",
                ],
                cwd=root,
                env=env,
                stdout=log,
                stderr=log,
                start_new_session=True,
            )
        )
        children.append(
            subprocess.Popen(
                [
                    node,
                    str(root / "frontend/node_modules/vite/bin/vite.js"),
                    "preview",
                    "--config",
                    str(config),
                ],
                cwd=root / "frontend",
                stdout=log,
                stderr=log,
                start_new_session=True,
            )
        )
        for _ in range(40):
            assert all(c.poll() is None for c in children), (
                f"Stage service exited: {log_path}"
            )
            try:
                urllib.request.urlopen(
                    "http://127.0.0.1:5194/api/v1/auth/csrf/", timeout=2
                ).read()
                break
            except OSError:
                time.sleep(0.5)
        else:
            raise RuntimeError("Isolated stage readiness timeout")
        env.update(
            READING_BROWSER_FIXTURE=str(fixture),
            READING_BASE="http://127.0.0.1:5194",
            CHROMIUM_PATH="/root/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
            READING_BROWSER_RECEIPT=f"/tmp/reading-c{args.book}t{args.test}-browser-receipt.json",
            READING_WIDTHS="1440,390,320",
            READING_SHORT_OPTIONS="1",
        )
        subprocess.run(
            [node, str(root / "infrastructure/verify-reading-full-browser.mjs")],
            env=env,
            check=True,
            timeout=300,
            start_new_session=True,
        )
        print(
            f"Cambridge{args.book} Test{args.test}: isolated Full passed1440/390/320.",
            flush=True,
        )
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=15)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
