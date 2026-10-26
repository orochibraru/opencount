# Testing

```bash
bun run test                    # every unit test
bun test tests/unit/lib/dto     # one folder
bun test --test-name-pattern settle   # tests whose name matches
```

The suite runs on Bun's own test runner, with no Vitest and no Jest. It covers
the domain logic (splits, balances, settle-up, recurrence, insights, receipt
parsing, the category guess), the DTOs against a real SQLite database, the
server modules (auth helpers, sign-up, setup, guards, origin check, secrets,
mail, telemetry, migrations, the worker supervisor), the worker's job runner,
the environment schemas, and components.

## The preload

Every test file runs after a preload that:

- compiles `.svelte` and `.svelte.ts` files for the client, so components and
  rune modules import as they do in the browser;
- mocks `$app/paths` (`resolve` adds the leading slash and drops route groups),
  `$app/env` and `$app/server`;
- calls `configure()` with a test `Config`: an in-memory SQLite database, a test
  `AUTH_SECRET`, telemetry off. A test that needs another value changes it
  through `getConfig()`.

## Databases

Tests that touch data call `resetDatabase()`, which applies the real migrations
to the in-memory database and empties every table. Each test starts from a
known, empty state, and the migrations themselves are exercised on every run.

## Components

Component tests register happy-dom themselves, in `beforeAll`. It is not
registered globally on purpose: happy-dom replaces `fetch`, `Request` and
`Headers` with versions that strip the `Origin` header, which breaks every
server test that checks it.

## Rules the runner enforces

- **Every test runs three times** (`rerunEach = 3`), so a flaky test fails
  locally instead of in CI a week later.
- **Coverage is checked per file**: 80% of functions and lines, generated code,
  shadcn primitives and the schema aside.
- **`mock.module` is process-global and permanent.** Every mock of one module
  must return the same shape, or tests start depending on their order.
  `svelte-sonner` is mocked for that reason too: its `runed` dependency only
  exports a `svelte` condition Bun's runner doesn't set.

## When it runs

The pre-push hook runs the suite with `bun run check` and the import-cycle
check, and CI runs the same hooks. The Stop hook for AI agents runs it before a
change can be handed back.
