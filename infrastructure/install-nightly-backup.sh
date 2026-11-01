#!/usr/bin/env bash
set -euo pipefail
# Run as root after reviewing docs/NIGHTLY_BACKUPS.md. Installs schedule only;
# no immediate multi-gigabyte snapshot is taken by this installer.
install -d -m 0700 /etc/practiceielts /var/lib/practiceielts-backup
install -m 0644 infrastructure/practiceielts-backup.service /etc/systemd/system/practiceielts-backup.service
install -m 0644 infrastructure/practiceielts-backup.timer /etc/systemd/system/practiceielts-backup.timer
systemd-analyze verify /etc/systemd/system/practiceielts-backup.service /etc/systemd/system/practiceielts-backup.timer
systemctl daemon-reload
systemctl enable --now practiceielts-backup.timer
systemctl list-timers practiceielts-backup.timer --no-pager
