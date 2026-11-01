#!/usr/bin/env bash
set -euo pipefail
cd /home/PracticeIELTS
install -m 644 infrastructure/practiceielts.nginx.conf /etc/nginx/conf.d/practiceielts.conf
install -m 644 infrastructure/practiceielts.service /etc/systemd/system/practiceielts.service
install -m 644 infrastructure/practiceielts-worker.service /etc/systemd/system/practiceielts-worker.service
chgrp www-data .env backend backend/db.sqlite3
chmod 640 .env
chmod 660 backend/db.sqlite3
chmod g+w backend
chown -R www-data:www-data backend/media
install -d -o www-data -g www-data backend/.cache
systemctl daemon-reload
nginx -t
systemctl enable --now redis-server practiceielts practiceielts-worker
systemctl reload nginx
systemctl is-active practiceielts practiceielts-worker nginx redis-server
hostname -I
