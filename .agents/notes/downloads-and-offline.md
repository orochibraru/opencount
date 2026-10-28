# Downloads, backups, imports, offline, personal ledger and bank sync

## Downloads

- A file the worker builds for a person (a database backup, a group's CSV or
  PDF) is a `download` row plus a file in a `downloads` folder next to the
  database (the system temporary folder for an in-memory one).
  `DownloadDTO.request()` enqueues `download.build`; `downloads.build()` writes
  the file and marks the row ready or failed. `/downloads/[id]` serves it to its
  owner only.
- `jobs.prune` deletes downloads older than a day, and any file no row owns.
- PDFs are drawn with `pdf-lib` and `@pdf-lib/fontkit`, embedding Noto Sans
  (regular and bold, subset) read from the working directory's `fonts/`, which
  the image ships next to `drizzle/`. A grapheme with any glyph missing from the
  font prints as `?` (CJK, emoji). Exports read through `groupExport.source()`
  so CSV and PDF agree.

## Backup and restore

- A backup is `VACUUM INTO` a fresh file, built by the worker.
- `databaseConnection.restore()` checks the file (an OpenCount database,
  `integrity_check` ok, a migration history this server knows), migrates a copy,
  then deletes and reinserts every table's rows inside one transaction with
  foreign keys off, checking `foreign_key_check` before commit. `job`,
  `download` and the migration table are kept. Everyone is signed in again
  afterwards, since sessions are rows too.

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
  `exchangeRates.rate()` (Frankfurter, cached per process, `undefined` when the
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
- Linked bank accounts can be renamed (Linked banks, "Rename accounts"): the new
  name replaces `name` and the bank's own goes to `originalName`, which relink
  matching uses and which a relink keeps your name over; an empty name brings
  the bank's back.
- Linked accounts carry `shared` and `savings` in `bank_connection.accounts`,
  set from Insights. `savings` starts from the bank's `SVGS` account type or
  `isMoneyAside` on the account's name. A shared account (a joint one) counts at
  half in `stats()` and `spending()`. After every sync `bankSync.pairTransfers`
  pairs money leaving one of the person's accounts with the same amount reaching
  another within three days (`transfer_pair_id` on both): into a savings account
  from an everyday one it's set aside (Finance), otherwise both lines are
  `internal` (Internal transfer), which `stats()` and `spending()` leave out. A
  paired line refiled to another category stays as it is. Each sync also stores
  every account's balance (available first, then booked); Insights sums them
  into "Available now" and "Invested or set aside", main currency only.
- Personal Insights at `/personal/analytics`: period tabs, main currency only,
  built from `PersonalExpenseDTO.spending()`.
- A line with `bankRef` is read-only except category, date, folder, `aside` and
  `note`; the actions enforce it, not only the sheet. Syncs insert with
  `onConflictDoNothing`, so a note is never overwritten; search matches the
  description or the note.
- Each account has `appearance.monthStartDay` (1 to 28,
  `AppearanceDTO.monthStartFor`): `#lib/pay-month.ts` turns a day into its
  month's start, and Personal stats (`byMonth` keyed by that start date), the
  list headings, `moneyOverview` and the personal `periodRange` all take it.
  Groups stay on calendar months.
- The money overview is the Home tab at `/home`, first in the navigation when
  `AppearanceDTO.homeFor` is `money` (`groups`, the stored "no", or null by
  default; asked once on Groups after a first bank link, switch under Account >
  Bank sync). `/home` redirects to Groups while it's off.
  `#lib/money-overview.ts` computes it from `spending()`: month totals, pace
  against last month, forecast, yesterday, the biggest habit, top category
  change, monthly repeats and the daily series.
- "Split in a group" adds a group expense paid by the account, split equally
  among all members, converted with `exchangeRates.rate()` when the currencies
  differ, and marks the personal one as split in that group.

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
  must be linked to it in Enable Banking's control panel, or the session lists
  them with no `uid`. The callback refuses a link with no readable account
  (`?link=empty` or `unreadable` on Linked banks) instead of saving it.
- The client is `openapi-fetch` over types `bun run bank:types` generates from
  Enable Banking's published spec into `enable-banking-api.d.ts` (generated,
  excluded from lint and typos, regenerate rather than edit). The spec says
  nothing is nullable, but the API does send `null`: keep the `??` and `?.`.
- An account's `uid` only lives as long as its consent and `bankRef` is
  `uid:transaction`, so relinking (`bankSync.relink`) moves each account's lines
  to its new uid, matched on `identification_hash` (stable across consents).
  Links saved before the hash was kept read it from the old session, else fall
  back to a unique name and currency. Then `syncedAt` is cleared so the next
  sync fetches the full history without doubles.
- A person links a bank under Account > Bank sync (country, bank, the bank's
  consent screen, 90 days of consent); Personal only shows a filter pill per
  link. `bank.syncAll` runs every day at 06:00 UTC (queued at worker start if
  absent, rescheduling itself before it does anything, its next run shown on
  Linked banks) and queues a `bank.sync` per link through `bankSync.queue`
  (`maxAttempts: 1`): Enable Banking's `strategy=longest` on the first sync
  after a consent, then from 3 days before the last sync. Banks only share more
  than 90 days in the minutes after the person confirms (Revolut: 5), so there
  is no "full history" resync: relinking is the way, and its sync runs right
  away. The link carries `syncState` (`queued`, `running`, `idle`) with
  `syncStateAt`, `lastAdded`, `lastError` and the bank's logo; `syncing()`
  ignores a state older than 15 minutes so a dead worker doesn't spin forever,
  and the UI polls while one syncs. Only `BankError` messages reach `lastError`;
  anything else is stored as a generic retry message. Booked transactions,
  debits as `expense` and credits as `income`, each with its `bankAccountUid`,
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
  to better-auth through `authService.get().handler()` with a real `Request`:
  `auth.api.oauth2Consent` has no request and fails.
- `/mcp` verifies the JWT in-process against `getJwks()` (no HTTP call to
  itself), then `AiAppDTO.allowed()`: an approval older than 30 days is deleted
  with its tokens, so the app must sign in again, and a revoke bites at once.
- Tools take an optional `groupId` (checked with `GroupDTO.findForMember`) and
  work on the person's ledger or that group's through one `Ledger`; group
  transfers stay out. They expose description, amount, currency, date, category
  and the personal `kind` only, never members, payer, shares or balances.
  `create_category` and `create_merchant` return the existing entry for a name
  already taken (built-ins included), never rename it; merchants are group-only.
  `csrfHandler` lets `/api/auth/oauth2/token`, `revoke` and `introspect`
  through: AI apps call them server to server with no `Origin`.
- `browserPaths` in `auth.ts` lets the OAuth endpoints AI apps call
  (`authorize`, `token`, `register`, `consent`, `revoke`, `userinfo`, `/jwks`,
  `/.well-known/`) through the 404 every other direct better-auth call gets.
- The root `/.well-known/oauth-*` routes hand the request to
  `authService.get().handler`, which only gets `/api/auth/*` from the hook.
