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
  service fails: the form then asks for a rate). It, the Tricount import and
  Enable Banking are the only outbound calls besides SMTP and OIDC; keep it that
  way and document any new one in `docs/configuration.md`.

## Personal ledger

- Personal expenses are private to the account: one currency each, never
  converted, no group. Totals are this month by category, scoped to the filter.
- `kind` is `expense` or `income`; `aside` marks money set aside (savings,
  investing). Spent totals count `expense` with `aside = false`; set aside and
  income are summed apart (`PersonalStats`). `isMoneyAside` detects it from the
  description and files it under Finance; the expense sheet has a switch.
- The page takes `search` (SQL `like` on the lowercased description, debounced),
  `category`, `bank` and `account` in the URL; stats follow the same filter.
  Custom categories are `personal_category` (`PersonalCategoryDTO`), managed at
  `/personal/categories` with the same `CategoryManager` as a group's. Its "Sort
  what's under Other" files Other entries by `categoryHistory` (what the account
  filed the same description under), then keywords and own categories, and runs
  `markAside`.
- Personal Insights at `/personal/analytics`: period tabs, main currency only,
  built from `PersonalExpenseDTO.spending()`.
- A line with `bankRef` is read-only except category, date, folder, `aside` and
  `note`; the actions enforce it, not only the sheet. Syncs insert with
  `onConflictDoNothing`, so a note is never overwritten; search matches the
  description or the note.
- The money overview is the Home tab at `/home`, first in the navigation when
  `AppearanceDTO.homeFor` is `money` (`groups`, the stored "no", or null by
  default; asked once on Groups after a first bank link, switch under Account >
  Bank sync). `/home` redirects to Groups while it's off.
  `#lib/money-overview.ts` computes it from `spending()`: month totals, pace
  against last month, forecast, yesterday, the biggest habit, top category
  change, monthly repeats and the daily series.
- "Split in a group" adds a group expense paid by the account, split equally
  among all members, converted with `exchangeRate()` when the currencies differ,
  and marks the personal one as split in that group.

- Folders (`personal_folder`) are projects inside Personal: created from the
  Personal menu, reached through the Filter sheet (a folder filter navigates to
  its route), renamed and deleted on `/personal/folders/[folderId]` (total, this
  month, top categories, last 6 months). Deleting one nulls the folder on its
  expenses; the expense sheet has a Folder picker and actions check the folder
  belongs to the user.
- Lists (group expenses, Personal) load 50 with a "Load more" button, a `limit`
  URL param growing by 50. Balances, totals and month totals are SQL sums, never
  a sum over loaded rows. The group page also takes a debounced,
  case-insensitive search over descriptions and merchant names in SQL, plus a
  category filter, both in the URL.
- After a category change, the update action returns `similar` (same
  description, plus same merchant in groups, under another category) for
  `SimilarSheet`, which posts `?/applyCategory` to re-file the ticked ones.

## Bank sync

- Enable Banking, not GoCardless: Bank Account Data closed new sign-ups in 2025.
  Bank sync is per account, not an admin setting: Account > Bank sync stores
  that account's application ID and RSA private key in `bank_credential`
  (encrypted, checked against Enable Banking's `/application` before saving) and
  shows the redirect URL to register; Turn off deletes them. Every bank call and
  `bank.sync` use the link owner's keys; a link whose owner removed them fails
  with a message. Personal links to Account > Bank sync when the account has
  none. Without a contract the application is "restricted": the owner's accounts
  must be linked to it in Enable Banking's control panel.
- A person links a bank from Personal (country, bank, the bank's consent screen,
  90 days of consent). `bank.syncAll` runs daily (queued at worker start if
  absent) and queues a `bank.sync` per link (`maxAttempts: 1`): 90 days back the
  first time, then from 3 days before the last sync. Booked transactions, debits
  as `expense` and credits as `income`, each with its `bankAccountUid`,
  categorized by what the account filed the same description under, then the
  description guess, deduplicated per bank transaction. Deleting a bank-imported
  expense hides it so a sync doesn't bring it back. New ones trigger a push
  notification.

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
  it and the offline queue; any navigation to `/auth/` (an expired or revoked
  session, another person signing in) wipes the pages. Queued expenses carry the
  account that made them and only sync for that account. It serves
  `static/offline.html` when an unvisited navigation fails. Pull to refresh runs
  on every signed-in page, only in the installed app
  (`display-mode: standalone`), and ignores a pull that starts in a drawer.
- The server accepts bodies up to 32 MB (`serverOptions.maxRequestBodySize` in
  `vite.config.ts`): enough for a Tricount file or a receipt, small enough that
  a few anonymous posts can't exhaust memory. `BODY_SIZE_LIMIT` raises it to
  restore a bigger backup.

## AI apps over MCP

- `mcp()`, `cimd()` and `jwt()` from better-auth make the app an OAuth 2.1
  server, only when `mcpResource()` gives an HTTPS or loopback `/mcp` URL. Both
  DCR and CIMD are on so Claude, ChatGPT and Gemini all register themselves;
  CIMD fetches go through `@better-auth/cimd/node` (resolve once, public
  addresses only, pinned, no redirects), which Bun honours.
- better-auth's `baseURL` is `ORIGIN` or the request's origin, never unset: the
  OAuth provider builds URLs from it on every request.
- `loginPage` is `/auth/oauth`: it checks the signed query, strips the signature
  params and sends the person through the normal sign-in with `redirectTo` back
  at `/oauth2/authorize`, so every sign-in method works. The consent page posts
  to better-auth through `getAuth().handler()` with a real `Request`:
  `auth.api.oauth2Consent` has no request and fails.
- `/mcp` verifies the JWT in-process against `getJwks()` (no HTTP call to
  itself), then `AiAppDTO.allowed()`: an approval older than 30 days is deleted
  with its tokens, so the app must sign in again, and a revoke bites at once.
- Tools expose description, amount, currency, date, kind and category only.
  `csrfHandler` lets `/api/auth/oauth2/token`, `revoke` and `introspect`
  through: AI apps call them server to server with no `Origin`.
- The root `/.well-known/oauth-*` routes hand the request to
  `getAuth().handler`, which only gets `/api/auth/*` from the hook.
