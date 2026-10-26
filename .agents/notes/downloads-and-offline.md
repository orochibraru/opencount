# Downloads, backups, imports and offline

## Downloads

- A file the worker builds for a person (a database backup, a group's CSV or
  PDF) is a `download` row plus a file in a `downloads` folder next to the
  database (the system temporary folder for an in-memory one).
  `DownloadDTO.request()` enqueues `download.build`; `buildDownload()` writes
  the file and marks the row ready or failed. `/downloads/[id]` serves it to its
  owner only.
- `jobs.prune` deletes downloads older than a day, and any file no row owns.
- PDFs are drawn with `pdf-lib`; exports read through `exportSource()` so CSV
  and PDF agree.

## Backup and restore

- A backup is `VACUUM INTO` a fresh file, built by the worker.
- `restoreDatabase()` checks the file (an OpenCount database, `integrity_check`
  ok, a migration history this server knows), migrates a copy, then deletes and
  reinserts every table's rows inside one transaction with foreign keys off,
  checking `foreign_key_check` before commit. `job`, `download` and the
  migration table are kept. Everyone is signed in again afterwards, since
  sessions are rows too.

## Import

- Tricount import takes a share link (fetched from Tricount's app API, anonymous
  session) or the registry JSON file, parses it into a preview, and the
  `import.tricount` job (`maxAttempts: 1`) adds the expenses, then pushes a
  notification. The Tricount's currency must equal the group's. Tricount has no
  official CSV export any more: don't add one.

## Multi-currency

- An expense keeps `originalCurrency`, `originalAmountMinor` and `exchangeRate`;
  its amount and shares are in the group currency, converted once with a rate
  frozen on the expense. Balances never convert.
- The suggested rate comes from the `getExchangeRate` remote query, backed by
  `exchangeRate()` (Frankfurter, cached per process, `undefined` when the
  service fails: the form then asks for a rate). It and the Tricount import are
  the only outbound calls besides SMTP and OIDC; keep it that way and document
  any new one in `docs/configuration.md`.

## Group invite link

- The token is an HMAC of the group id and a per-group nonce, so nothing is
  stored in clear. A new link rotates the nonce, turning off clears it.
  `/join/[groupId]/[token]` sits under `(protected)`, so a signed-out visitor
  signs in first; it never creates accounts.

## Offline

- A new expense submitted offline is stored in IndexedDB (`offlineQueue`) and
  posted by `OfflineSync`, mounted in the protected layout, when the connection
  returns. Edits and deletes aren't queued.
- The service worker serves `static/offline.html` when a navigation fails. Pull
  to refresh only runs in the installed app (`display-mode: standalone`).
- The server accepts bodies up to 256 MB (`serverOptions.maxRequestBodySize` in
  `vite.config.ts`, for restoring a backup); `BODY_SIZE_LIMIT` still overrides.
