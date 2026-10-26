# Commands

## Scripts

- `bun run dev`: Vite dev server. Its `init` hook migrates the SQLite file and
  spawns the worker as `bun --watch src/worker/index.ts`, so worker changes
  reload on their own. Stopping the server stops the worker: SIGINT, SIGTERM and
  SIGHUP go through a graceful shutdown in `hooks.server.ts`, any other exit
  signals it from an `exit` handler, and a SIGKILL is caught by the worker's
  parent watchdog within a second. Receipt reading needs `tesseract` on the
  PATH: `mise.toml` installs it from conda-forge (`conda:tesseract`, which needs
  mise's `experimental` setting, on in `mise.toml`), every language pack
  included, about 460 MB.
- `bun run build`: `vite build`, then `bun build --compile` of the worker.
  Output: `build/server` (client assets embedded) and `build/worker`.
- `bun run start`: runs `build/server`, which spawns `build/worker` from the
  same folder.
- `bun run check`: svelte-check over the app and tests (fails on warnings), tsc
  over the service worker, tsc over `scripts/`.
- `bun run lint`: `prek run --all-files`. Every check is a prek hook; there are
  no `lint:*` scripts.
- `bun run format`: `bun fmt` over the repo (code and Markdown).
- `bun run circular`: madge over `src/`, fails when an import cycle exists or a
  `#lib` import couldn't be resolved.
- `bun run test`: unit tests under `tests/unit/`.
- `bun run db:generate`: writes a migration to `drizzle/` from `schema.ts`.
  Migrations apply at boot, never by hand.

`bunfig.toml` sets `[run] bun = true`, so every script and binary runs on Bun,
never Node.

## mise

`mise.toml` pins Bun (matching `packageManager`) and Go (pinact builds with it).
Tasks: `bootstrap` (install, then `.env` from `.env.example` with a fresh
`AUTH_SECRET`) and `verify` (prek over every file at the commit and push stages,
what CI runs). Plain `bun install` works without mise.

## Git hooks

`bun install` wires them through prek once the repo is a git repository.

- pre-commit: hygiene, gitleaks, typos, actionlint, zizmor, pinact, hadolint,
  oxlint, `bun fmt`, markdownlint, agnix, tailwint, and the convention hooks (no
  hand-typed route types, no raw Drizzle in routes, no `redirect(` in hooks, no
  `href="/`).
- commit-msg: Conventional Commits.
- pre-push: `check`, `circular`, `test-unit`.
- post-checkout: `bun install`.

## Tests

- `bun test` with `tests/unit/app/svelte-loader.ts` preloaded: it compiles
  `.svelte` and `.svelte.ts` for the client, registers happy-dom per test and
  mocks `$app/paths` (`resolve` adds the leading slash and drops route groups).
- The preload calls `configure()` with a test `Config` (in-memory SQLite, a test
  `AUTH_SECRET`, telemetry off); tests change it through `getConfig()`.
  `resetDatabase()` in `tests/unit/database.ts` migrates and empties the tables.
  `src/env.ts`'s schemas are tested directly through their `~standard`
  validators.
- The preload mocks `$app/env` and `$app/server`. happy-dom is registered only
  by component tests (`GlobalRegistrator` in `beforeAll`): registered globally
  it replaces `fetch`, `Request` and `Headers`, which strip `Origin` and break
  server tests.
- `rerunEach = 3` surfaces flaky tests. Coverage is checked per file: 80% of
  functions and lines.
- `mock.module` is process-global and permanent: every mock of one module
  returns the same shape. `svelte-sonner` is mocked because its `runed`
  dependency only exports a `svelte` condition Bun's runner doesn't set.
