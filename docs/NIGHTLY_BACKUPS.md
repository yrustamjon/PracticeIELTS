# Nightly private backups

Implementation: `infrastructure/nightly-backup.py`, `practiceielts-backup.service` and `.timer`. This is an actual SQLite database/media backup and Google Drive REST integration. Google Drive upload is **not operational until unattended credentials are installed**. A public shared-folder URL grants no upload authorization. A ChatGPT Drive connector does not provide server credentials for a systemd job.

The timer runs daily at **02:00 UTC** (07:00 Asia/Tashkent), including a missed run after reboot (`Persistent=true`). It runs with low CPU/I/O priority, a private temporary directory, restrictive umask, and a read-only filesystem except its private state directory. An overlapping job cannot acquire the lock. The installer activates the schedule; it does not force an immediate backup.

## Authentication and activation

Use a Google OAuth desktop/web client with an authorized Google account that can create files in a PRIVATE backup folder. The supplied shared public folder is deliberately not a default destination. Obtain an **offline refresh token** with Drive write scope (`https://www.googleapis.com/auth/drive`); production consent configuration must allow long-lived refresh tokens (Google external apps in Testing can expire tokens). Configure through a secure local/server credential workflow; never paste tokens into git or logs.

Create `/etc/practiceielts/drive-backup.json` owned by root, directory mode 0700 and file mode 0600:

```json
{"client_id": "YOUR_OAUTH_CLIENT_ID", "client_secret": "YOUR_OAUTH_CLIENT_SECRET", "refresh_token": "YOUR_OFFLINE_REFRESH_TOKEN", "folder_id": "YOUR_PRIVATE_BACKUP_FOLDER_ID"}
```

From `/home/PracticeIELTS`, run `sudo bash infrastructure/install-nightly-backup.sh`. Confirm `systemctl list-timers practiceielts-backup.timer --no-pager`. After media imports finish, run `sudo systemctl start practiceielts-backup.service` for a real end-to-end first run. Monitor `journalctl -u practiceielts-backup.service --no-pager` and `/var/lib/practiceielts-backup/receipts/`. Never infer upload success solely from timer activation.

The code exchanges the refresh token at Google's token endpoint on each run. Tokens stay out of the archive and logs. The currently selected backend is SQLite. PostgreSQL deployment requires a separate `pg_dump` implementation before switching this job; do not treat this tool as PostgreSQL-compatible.

## Snapshot and safety rules

SQLite's online backup API creates a consistent database while the site is running. The snapshot must pass `PRAGMA integrity_check`. All `learning_audioasset.file` and `exams_questiondocument.file` rows in that snapshot are included, preserving historical records as well as published records. Only `originals/`, `question-documents/`, and `cambridge_documents/` media referenced by those database rows are allowed. These are the two FileField models currently present. All original `.pdf` files under `cambridge_documents/` are also preserved even when unreferenced, including import source evidence; non-PDF scratch/credential/session files are excluded. Missing files, unsafe paths, changed files, and insufficient disk space abort the run. Media hashes are calculated during archive creation; then archive CRC and all SHA256 hashes are checked by reading the completed archive.

The archive contains `backend/db.sqlite3`, referenced `backend/media/*`, `MANIFEST.json` (sizes/SHA256/application HEAD), and `RESTORE.txt`. It deliberately excludes `.env`, all credentials and Telegram sessions, caches, OCR/source staging, old backups, unreferenced media, virtual environments and application source. Keep the application checkout/revision separately. The manifest records HEAD and whether the checkout is dirty, but cannot reproduce uncommitted working-tree changes: preserve the actual deployed application source separately before a restore.

Each successful run creates a new dated folder in the configured parent. The archive uses resumable 8 MiB uploads. After upload, Drive's reported size, MD5 and parent folder must match the local artifact. The SHA256 sidecar is also uploaded and verified. Only after **both** remote files are verified is a small local receipt written and that run's staging directory removed. No live media, old user backups or remote backups are deleted.

If upload/verification fails, the complete pending archive stays in `/var/lib/practiceielts-backup/pending/`; the next run retries that same archive before generating another. Thus failures do not create one huge new archive every night. A missing/expired credential fails before snapshot creation. Incomplete staging left by a failed snapshot is deleted only on the next authorized run, within this job's own private pending directory. Do not manually remove a completed pending archive until it has been copied or verified remotely. Receipts are small and retained. There is no automatic remote retention deletion.

A snapshot needs approximately the referenced media size plus database size and 256 MiB working headroom; completed delivery frees the local staging space. Standard ZIP storage avoids wasting CPU trying to recompress audio/PDF files. Data are private at rest in server staging, but the ZIP is not encrypted: the Drive destination's sharing permissions control access. The supplied parent is a shared folder, so review who can access it before installing production OAuth credentials. Never put a sensitive DB backup in a publicly readable parent. Configure `folder_id` in the credential file (or `--folder PRIVATE_FOLDER_ID`). The job refuses a folder whose permissions include `anyone`, including inherited public access. No default destination is silently used.

Legacy imports also use `cambridge_audio/`; DB-referenced recordings in this directory are included with the same path, symlink, size and hash checks as `originals/`. Unreferenced audio is excluded.

## Restore and verification

1. Download `backup.zip` and `backup.zip.sha256` into a private staging directory; run `sha256sum -c backup.zip.sha256`.
2. Extract into private staging. Check each `MANIFEST.json` path, size and SHA256 before using the contents. Run `PRAGMA integrity_check` on the staged DB.
3. Stop `practiceielts` and `practiceielts-worker`; retain copies of the previous DB/media. Restore DB **and** referenced media together. Keep `.env`/secrets separate.
4. Restore the matching application checkout, then set restored owner to `www-data:www-data`, directories 0700 and files 0600. Verify service-user read access. Do not migrate the only restored copy.
5. Restart services, run `backups/verify-live.py`, and verify a private PDF/audio plus a persisted attempt through the actual site. Retain previous data until this passes.

Focused validation: `python3 -m unittest discover -s infrastructure/tests -v`. A fixture pass proves local behavior only; a real receipt and remote files are required evidence for operational Drive delivery. The timer performs scheduled work, not an autonomous future assistant review of unrelated site tasks.

## Scheduled routine checks

Before checking Drive authorization on every nightly run, the job performs read-only SQLite `PRAGMA quick_check` and checks that every DB-referenced audio/PDF exists. It writes `/var/lib/practiceielts-backup/health.json` with timestamp and missing-file count; failure stops backup. No site records, published tests, user attempts or live media are modified. There is no dedicated HTTP health endpoint in this checkout, so an HTTP success is not fabricated. These lightweight checks still run when Drive credentials are absent; the service then reports upload authorization failure honestly.
