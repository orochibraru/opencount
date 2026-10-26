# Architecture

How OpenCount is put together, and why.

## One container, two processes, one file

The image runs two compiled Bun binaries:

- **The server**: the SvelteKit app, compiled by `@sveltejs/adapter-bun` with
  the Bun runtime embedded. It serves pages, form actions and better-auth's API.
- **The worker**: background jobs. The server spawns it at boot, sends it its
  configuration over IPC, and restarts it with backoff when it exits. The worker
  watches its parent in turn and exits when the server is gone, so neither
  outlives the other.

Both open the same SQLite file through `bun:sqlite`, in WAL mode with foreign
keys on and a busy timeout, so the server's reads never wait on the worker's
writes. There is no Redis, no Postgres, no message broker: a self-hosted app for
a few dozen people doesn't need them, and every extra service is one more thing
to back up and upgrade.

## Boot

1. The server reads and validates its environment into one `Config`. An invalid
   variable stops it with the variable's name.
2. It checks the migration history, then applies pending migrations. A failure
   stops the boot.
3. On a fresh instance, it prints a setup code.
4. It starts the worker, which waits for its `Config` over IPC (the worker never
   reads its own environment), requeues jobs a previous worker left running, and
   schedules the daily jobs if they aren't queued.

## Jobs

A job is a row in the `job` table: a type, a typed payload, a due time and an
attempt count. The worker polls for due jobs every `WORKER_POLL_INTERVAL_MS`,
claims up to `WORKER_CONCURRENCY` at once, and runs each in a `job <type>` span.
A failure is retried with exponential backoff (5 seconds, doubling) up to five
attempts, then marked failed and shown on the admin overview.

| Job               | What it does                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `email.send`      | Delivers one email through the configured SMTP server                                                                   |
| `recurring.run`   | Adds due repeating expenses, then requeues itself for the next day at 00:05 UTC                                         |
| `jobs.prune`      | Deletes finished jobs older than 7 days and downloads older than a day, then requeues itself a day later                |
| `download.build`  | Builds a database backup, or a group's CSV or PDF export, into a file waiting for its owner                             |
| `bank.syncAll`    | Queues a `bank.sync` for every linked bank, then requeues itself a day later                                            |
| `bank.sync`       | Fetches one link's new booked transactions, money in included, into the personal ledger, then sends a push notification |
| `import.tricount` | Adds the expenses of a previewed Tricount to a group, then sends a push notification                                    |

Built files (exports and backups) live in a `downloads` folder next to the
database, and are served only to the account that asked for them.

Requests enqueue and return; they never await a job. Receipt reading is the one
slow thing done in a request, on purpose: the person is waiting for the reading
to fill the form, and the file must not be stored to hand it to another process.
Scans run one at a time, and a request body is capped at 32 MB.

## Requests

`hooks.server.ts` does four things and nothing else: log the request, check the
origin of form posts, resolve the session into `locals`, and hand better-auth
its own API paths. Redirects and access rules live in layouts and form actions:

- Every signed-in page sits under one route group whose layout sends signed-out
  visitors to sign-in, and anyone missing a required factor to their security
  page.
- The admin layout 404s non-admins, and every admin action re-checks the role.
- Every group route resolves the group through a membership check before reading
  anything.

## Data

Each table has a DTO class that owns its queries; routes never touch Drizzle
directly and send `.toJSON()` to the page. Money is an integer of minor units
next to the group's currency code. Balances and insights are computed from the
expenses on every load rather than stored, so they can't drift.

A settlement is an expense of kind `transfer` from the payer to the receiver.
Balances count it like any expense; insights leave it out.

## Authentication

better-auth over the same SQLite database, with email and password, TOTP
two-factor, passkeys, and OpenID Connect providers through its generic OAuth
plugin. Its public sign-up endpoint is disabled: accounts only come from the
setup flow, the sign-up stepper, invites or single sign-on with sign-ups open.
The role column is declared with `input: false`, so no request can set it.

Instance settings, single sign-on providers included, live in a `setting` table.
Changing the providers or the sign-up policy rebuilds the better-auth instance
on the next request. Secrets in settings are encrypted with AES-256-GCM under
keys derived from `AUTH_SECRET` by HKDF.

## Client

Svelte 5 runes, Tailwind v4 and shadcn-svelte components. Every async action
goes through a toast that shows its progress and its outcome. Navigation is a
bottom tab bar on phones and a sidebar on desktop; sheets are drawers on phones
and dialogs on desktop.

Appearance is applied as data attributes on `<html>` by an inline script before
first paint. Every colour is a token derived from one `--hue`, so an accent
change is one attribute.

A service worker precaches the built assets, so an installed app starts
instantly. Pages and their data are fetched from the server first and each
answer is kept per app version (never `/api/`, `/auth/` or `/downloads/`), so a
page already visited reopens with no connection; an unvisited one gets a static
offline page. Signing out wipes that cache and the offline queue, and so does
any visit to a sign-in page, which means the session ended or someone else is
signing in. A new expense submitted offline is kept in IndexedDB with a client
id and posted when the connection returns, so a retry never adds it twice.

## Hardening

Every response carries a Content-Security-Policy with `frame-ancestors 'none'`,
`object-src 'none'` and `base-uri 'self'`. A `redirectTo` is resolved against a
dummy origin, so tricks like `/\evil` fall back to the home page. Push
subscriptions must point at a known browser push service. Sign-up checks that
sign-ups are open before saying an email is taken, and CSV exports neutralise
cells that start like a spreadsheet formula. Password sign-in and reset emails
are rate limited in memory, see [Sign-in and single sign-on](sign-in-and-sso).

## Telemetry

OpenTelemetry tracing (SvelteKit's server tracing plus job spans) over
OTLP/HTTP, and Sentry for errors, both off unless configured. See
[Logs, traces and errors](observability).
