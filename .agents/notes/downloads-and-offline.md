# Downloads, backups, imports, offline, personal ledger and bank sync

## Downloads

- A file the worker builds for a person (a database backup, a group's CSV or
  PDF) is a `download` row plus a file in a `downloads` folder next to the
  database (the system temporary folder for an in-memory one).
  `DownloadDTO.request()` enqueues `download.build`; `buildDownload()` writes
  the file and marks the row ready or failed. `/downloads/[id]` serves it to its
  owner only.
- `jobs.prune` deletes downloads older than a day, and any file no row owns.
- PDFs are drawn with `pdf-lib` and `@pdf-lib/fontkit`, embedding Noto Sans
  (regular and bold, subset) read from the working directory's `fonts/`, which
  the image ships next to `drizzle/`. A grapheme with any glyph missing from the
  font prints as `?` (CJK, emoji). Exports read through `exportSource()` so CSV
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
  notification. The Tricount's currency must equal the group's. Categories are
  guessed from the description and the group's own categories. Tricount has no
  official CSV export any more: don't add one.

## Multi-currency

- An expense keeps `originalCurrency`, `originalAmountMinor` and `exchangeRate`;
  its amount and shares are in the group currency, converted once with a rate
  frozen on the expense. Balances never convert.
- The suggested rate comes from the `getExchangeRate` remote query, backed by
  `exchangeRate()` (Frankfurter, cached per process, `undefined` when the
  service fails: the form then asks for a rate). It and the Tricount import are
  the Tricount import and Enable Banking are the only outbound calls besides
  SMTP and OIDC; keep it that way and document any new one in
  `docs/configuration.md`.

## Personal ledger

- Personal expenses are private to the account: one currency each, never
  converted, no group. Totals are this month by category.
- "Split in a group" adds a group expense paid by the account, split equally
  among all members, converted with `exchangeRate()` when the currencies differ,
  and marks the personal one as split in that group.

## Bank sync

- Enable Banking, not GoCardless: Bank Account Data closed new sign-ups in 2025.
  The admin tab stores the application ID and RSA private key (encrypted,
  checked against the API before saving) and shows the redirect URL to register.
  Without a contract the application is "restricted": each person's own accounts
  must be linked to it in Enable Banking's control panel.
- A person links a bank from Personal (country, bank, the bank's consent screen,
  90 days of consent). `bank.syncAll` runs daily (queued at worker start if
  absent) and queues a `bank.sync` per link (`maxAttempts: 1`): 90 days back the
  first time, then from 3 days before the last sync. Booked debits only,
  categorized by the description guess, deduplicated per bank transaction.
  Deleting a bank-imported expense hides it so a sync doesn't bring it back. New
  ones trigger a push notification.

## Group invite link

- The token is an HMAC of the group id and a per-group nonce, so nothing is
  stored in clear. A new link rotates the nonce, turning off clears it.
  `/join/[groupId]/[token]` sits under `(protected)`, so a signed-out visitor
  signs in first; it never creates accounts. The group header's "Invite people"
  shares it (creating it if needed, copying when there is no share sheet).

## Offline

- A new expense submitted offline is stored in IndexedDB (`offlineQueue`) and
  posted by `OfflineSync`, mounted in the protected layout, when the connection
  returns. Edits and deletes aren't queued. Each carries a client id (unique per
  group), so a retry is ignored.
- The service worker caches every same-origin GET network-first in a per-version
  pages cache, except `/api/`, `/auth/` and `/downloads/`, so visited pages and
  their `__data.json` reopen offline. Sign-out (sidebar and account page) wipes
  it. It serves `static/offline.html` when an unvisited navigation fails. Pull
  to refresh only runs in the installed app (`display-mode: standalone`).
- The server accepts bodies up to 256 MB (`serverOptions.maxRequestBodySize` in
  `vite.config.ts`, for restoring a backup); `BODY_SIZE_LIMIT` still overrides.
