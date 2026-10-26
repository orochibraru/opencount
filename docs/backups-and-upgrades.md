# Backups and upgrades

## What to back up

Two things, and only two:

- **The database**: the SQLite file at `DATABASE_PATH`, `/data/opencount.sqlite`
  in the image, with its `-wal` and `-shm` companions next to it. Every account,
  group, expense, setting and pending job is in there. Receipts are never
  stored, so there are no uploads to save.
- **`AUTH_SECRET`**: without it, a restored database still has its groups and
  expenses, but the SMTP password, single sign-on client secrets and
  authenticator app secrets in it can't be decrypted, and every session is void.
  Keep it with the backup, somewhere safe.

## Taking a backup

The quickest is **Admin, Backup**: download the database as one SQLite file,
with no stop. It doesn't include `AUTH_SECRET`, which you still keep apart. The
rest of this section is for backing up the volume itself.

The database runs in WAL mode: recent writes sit in the `-wal` file until they
are folded into the main one. Copying only `opencount.sqlite` while the
container runs can miss them, or catch the file mid-write.

The simple, always-correct way is a short stop:

```bash
docker compose -f compose.prod.yaml stop
docker run --rm -v opencount_opencount:/data -v "$PWD":/backup alpine \
  tar czf /backup/opencount-$(date +%F).tar.gz -C /data .
docker compose -f compose.prod.yaml start
```

The volume's real name is prefixed with the Compose project, the directory name
by default: check it with `docker volume ls`. On a stop, the worker finishes the
jobs it is running before it exits.

Without stopping, use SQLite's own online backup from the host, which copies a
consistent snapshot while the app keeps writing:

```bash
sqlite3 /path/to/opencount.sqlite ".backup opencount-backup.sqlite"
```

The image has no `sqlite3`; run it from the host against the volume's directory
(`docker volume inspect` gives its mount point) or from another container with
the volume mounted.

## Restoring

From the app, **Admin, Backup** restores a downloaded file: it is validated,
migrated and swapped in as one step, and everyone signs in again; see
[The admin area](admin#backup). From the volume:

Stop the container, put the files back in the volume (the `.sqlite` file, and
the `-wal` and `-shm` files if you saved them together), set the same
`AUTH_SECRET`, start it. Migrations bring an older backup up to the running
version on boot.

## Upgrading

```bash
docker compose -f compose.prod.yaml pull
docker compose -f compose.prod.yaml up -d
```

On boot the server applies every pending database migration, then starts the
worker. A failed migration stops the boot with the error in the log, and the
database is left as it was; nothing serves on a half-migrated schema.

Take a backup before an upgrade you care about. Pin an `X.Y.Z` tag instead of
`latest` to make each upgrade a decision; see [Install](install#tags).

## Downgrading

Migrations only go forward. An older version can't read a database a newer one
migrated, and there is no down migration. To go back, restore the backup taken
before the upgrade, with the image tag it was taken with.

## Why migrations are append-only

Every migration is applied once and recorded with a hash of its content. At
boot, the server checks that every recorded migration still exists, unchanged,
in the version it is running. If one was edited or removed, it refuses to start
and names the database and the migration's date, rather than running a changed
migration against tables that already exist. In a released image that never
happens: published migrations are never edited, only added to.
