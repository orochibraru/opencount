# Development

## Requirements

- [mise](https://mise.jdx.dev), which pins Bun, Go (for the `pinact` hook),
  Tesseract and Poppler. Optional but the shortest path.
- Or [Bun](https://bun.sh) alone, with Tesseract and Poppler installed yourself
  if you work on receipt reading
  (`brew install tesseract tesseract-lang poppler`, or
  `apt install tesseract-ocr poppler-utils`).
- Docker, to build the image or run the contributor compose file.

## Setup

```bash
mise run bootstrap   # bun install, then .env with a fresh AUTH_SECRET
bun run dev          # dev server on :5173, worker included
```

Without mise: `bun install`, copy `.env.example` to `.env`, and replace
`AUTH_SECRET` with the output of `openssl rand -base64 32`.

Through mise, Tesseract comes from conda-forge with every language pack, about
460 MB, which is why mise's `experimental` setting is on in `mise.toml`.

The dev server migrates the SQLite file and starts the worker itself, as
`bun --watch src/worker/index.ts`, so a change to a job handler reloads on its
own. Stopping the dev server stops the worker. The database lands at
`./data/opencount.sqlite`; delete it to start from a fresh instance, setup code
included.

`compose.yaml` builds the image from your checkout and runs it on port 3000, for
checking the real container. It is not the self-hosting file: that is
`compose.prod.yaml`, which pulls the published image.

```bash
docker compose up --build
```

## Scripts

```bash
bun run dev          # Vite dev server on :5173, with the worker
bun run build        # build/server and build/worker
bun run start        # run build/server, which spawns build/worker
bun run check        # svelte-check (fails on warnings) and tsc
bun run lint         # every prek hook over every file
bun run format       # bun fmt over the repo, Markdown included
bun run circular     # fails on an import cycle
bun run test         # unit tests
bun run db:generate  # write a migration from the schema
```

The package manager is **bun**; `bunfig.toml` makes every script run on Bun,
never Node. `bun run start` uses `ORIGIN` from `.env`, since the compiled server
otherwise assumes HTTPS.

## mise tasks

- `mise run bootstrap`: install, and write `.env` with a fresh secret if there
  is none.
- `mise run verify`: every prek hook over the whole repo at the commit and push
  stages, which is what CI runs.
- `mise run screenshots`: retakes every screenshot in `docs/images/`, desktop
  screens in the dark theme at 1440 by 900 and phone screens in the light theme
  at 390 by 844.
- `mise run showcase`: lays out `feature.webp`, the hero at the top of the
  README, from those screenshots.

Review the image diff and commit it with the change that caused it.

## Git hooks

`bun install` wires them through [prek](https://github.com/j178/prek), installed
as a dev dependency. They are the same set CI runs, so a green commit locally is
a green quality job.

- **pre-commit**: file hygiene, gitleaks, typos, actionlint, zizmor, pinact,
  hadolint, oxlint, `bun fmt`, markdownlint, agnix, tailwint, the append-only
  migration check, and grep guards for the conventions no linter knows.
- **commit-msg**: Conventional Commits. releaser computes versions from commit
  subjects, so a malformed one silently costs a release.
- **pre-push**: `check`, `circular` and the unit tests.
- **post-checkout**: `bun install`.

## Conventions

The full list, every one a hard rule, is in `CLAUDE.md`. The ones that bite
first:

- **Route files are typed by `./$types`**, never by hand.
- **No raw Drizzle in routes.** Each table has a DTO class; a `load` returns
  `.toJSON()`.
- **Form input goes through a zod schema** and `parseForm()`. `FormData` values
  are never cast.
- **Money is an integer of minor units** plus the group's currency code, never a
  float.
- **Group data is scoped to members.** A group id from a URL or a form is never
  trusted until membership is checked.
- **Slow work is a job.** `JobDTO.enqueue()` with a typed payload, handled by
  the worker. A request never awaits it.
- **Environment variables are declared once**, in `src/env.ts`, with a zod
  schema and a description, and read only through the `Config` the server
  builds. `process.env`, `Bun.env` and `import.meta.env` fail the hooks.
- **Logging goes through `Logger`**; `console.*` is a lint error.
- **No comments in code**, except one required JSDoc block above every class
  method and exported function.
- **Mobile first**: every screen works at 375px, respects the safe-area insets
  and keeps touch targets at 44px. Desktop gets real layouts, not the phone
  column stretched.

## Changing the database

Edit the schema, then `bun run db:generate` writes a migration. Commit both.
Migrations apply at boot, before the worker starts; never by hand.

Committed migrations are **append-only**. A hook refuses a commit that edits,
renames or deletes one, and the server refuses to boot on a database migrated
with a migration it no longer has unchanged. Fix a bad migration with a new one.
A local dev database that got out of step can simply be deleted.

## Releases

Every merge to `main` publishes a canary: `X.Y.Z-canary.N` and `canary`, for
`linux/amd64` and `linux/arm64`. releaser keeps a `chore(release): X.Y.Z` pull
request open; merging it retags the last canary as `X.Y.Z` and `latest` without
rebuilding. Images are built on ghcr.io and published tags are copied to Docker
Hub.
