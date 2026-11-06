# Encryption of stored files at rest

Stored files (evidence, exports, templates) are encrypted by the application with AES-256-GCM before they reach the disk, with a key
per organisation derived (HKDF) from a master key. A copy of the storage directory, a backup or a disk image is unreadable without
the master key. Files kept in Google Drive or R2 are not touched by this: Drive and R2 encrypt on their side.

## Turn it on

1. Make a key (32 random bytes, base64): `openssl rand -base64 32`.
2. Put it in `/opt/donordesk/shared/api.env` (mode 600): `EVIDENCE_ENCRYPTION_KEYS=1:<the key>`.
3. **Keep a copy of the key somewhere other than the host (a password manager). Without it the encrypted files cannot be read, and
   the backups of them are only as good as that key.**
4. Restart the api. New files are encrypted at once; older plaintext files stay readable.
5. Encrypt the older files (safe to repeat, safe to interrupt): from `/opt/donordesk/app/packages/infrastructure`,
   `node dist/storage/encrypt-cli.js --dry-run`, then without `--dry-run`. It prints how many files it encrypted.
6. Run the backup and the restore test once afterwards (`scripts/backup.sh`, `scripts/restore-backup.sh`).

## Rotate the key

Add a second key and make it active: `EVIDENCE_ENCRYPTION_KEYS=1:<old>,2:<new>` (the active key is the highest id, or set
`EVIDENCE_ENCRYPTION_ACTIVE`). Restart, then run `encrypt-cli.js`: it re-writes every file still under key 1. Remove key 1 only
after the tool reports `0 re-keyed` and a restore test has passed with key 2 alone.

## What it does not do

- A file bound to a storage key does not open under another key: moving a file between organisations fails rather than serves it.
- The database (including extracted text of evidence) is not encrypted by this; it relies on the host's disk and access controls.
- Losing every copy of the master key loses the files. Treat it like the backup passphrase.
