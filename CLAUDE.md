# OpenCount

## What this is

OpenCount is an open-source, self-hosted alternative to Tricount: people create
a group for a trip, a flat or a dinner, log who paid for what, and see who owes
whom and how to settle up. It's invite-only by default, administered from the
app, and installed as a PWA on phones where it must feel exactly like a native
app; on desktop it's a full app with a top navigation bar, not a stretched phone
layout.

SvelteKit 3 with Svelte 5 runes on Bun, compiled by `@sveltejs/adapter-bun` into
one `build/server` binary. better-auth (email and password) over Drizzle on
SQLite (`bun:sqlite`, WAL). Slow work runs in a second compiled Bun binary,
`build/worker`, which the server spawns and supervises: one container, one
SQLite file. better-auth adds TOTP two-factor and passkeys; email goes out over
SMTP configured in the admin UI; receipt reading is optional and local:
Tesseract in the image, run by the worker, its text parsed by
`#lib/server/ocr.ts`. Tailwind v4 and shadcn-svelte (vega, per-account accent,
theme, font and corners), oxlint lints, `bun fmt` formats, prek runs every check
as a git hook, mise pins the toolchain.

## How to work here

- Ship like a small team: no phased rollouts, priority tiers, migration plans,
  risk matrices or asking whether to ship. Do the whole change in one go,
  proceed on what was already asked, fix instead of ranking findings, no feature
  flags, compat shims or deprecation windows. Breaking dev data or needing a
  manual step is fine: say so and move on. The conventions still apply.
- End every turn that edited files with a suggested one-line conventional commit
  message in a code block. Suggest, never commit.
- `TODO.md` is the only backlog. Pick from it when there's no specific ask, mark
  an item `**[WIP]**` before starting and delete it when done, add a line for
  anything found out of scope. `Small`/`Medium`/`Large` are size, not priority.
  No personal data in it, ever (it's pushed): no real domains, IPs, emails,
  tokens or log excerpts.

## Conventions

Each is a hard rule.

- Route files let `./$types` type everything: never `: PageData`,
  `: PageServerLoad`, `: Actions` or `import type ... from "./$types"`. Shared
  modules under `#lib/` are typed explicitly.
- Every signed-in page lives under `src/routes/(protected)/`, whose
  `+layout.server.ts` sends signed-out visitors to sign-in through
  `redirectToSignIn()`. Sign-in and sign-up live under `src/routes/auth/`.
- Redirects are thrown from `+layout.server.ts`, `+page.server.ts` and form
  actions, never from hooks. `hooks.server.ts` only populates `locals`, runs
  migrations and starts the worker in `init`, logs requests, and hands
  better-auth its own API paths.
- Nested loads under `(protected)/` use `await parent()` instead of re-checking
  `locals.user`; form actions keep their own guard. Remote functions call
  `requireUser()`.
- Admin is the `role` column on `user` (`admin` or `member`), declared to
  better-auth with `input: false` so no sign-up can set it. The first account,
  made by the setup flow, is the admin; admins promote and demote others from
  the users tab, never themselves. Admin routes live under `(protected)/admin/`,
  whose layout 404s anyone else, and every admin form action re-checks with
  `adminFrom(locals)`.
- Accounts only come from the setup flow, the sign-up stepper (email,
  verification code, then name and password typed twice against
  `#lib/password-policy.ts`) or an admin invite; better-auth's public
  `/sign-up/email` endpoint is disabled. Sign-ups stay closed unless an admin
  opens them, which needs SMTP.
- A fresh instance (no account) sends every page to `/auth/setup`: a setup code
  from the server log (printed at boot, reprintable), then the first account,
  which becomes the admin. Once an account exists the route sends visitors to
  sign-in and its actions refuse.
- Admin-required factors (authenticator app, passkey) are enforced by the
  `(protected)` layout, which sends anyone missing one to `/account/security`.
- Instance settings (sign-ups, required factors, SMTP, OCR) live in the
  `setting` table through `getSetting`/`setSetting`; secrets in them are
  encrypted with `encryptSecret` and never sent back to the browser.
- Group data is scoped to the group's members: a group id from the URL or a form
  is never trusted until membership is checked.
- A tabbed page is one real route per tab under a `TabSection` layout, each tab
  with a description. On phones the index route is `NavCards` and each tab is a
  page with a back button; on desktop the index opens the first tab and `TabNav`
  shows them all.
- Page chrome comes from `setPageTitle(title, backHref, actions)`: the phone app
  bar and the desktop page header render it. A `primary` action is a filled
  button on desktop only, phones reach it through the `Fab`.
- Every select, combobox and date input is a `Picker` or a `DateField`: shadcn
  `Select`, Popover with Command, or Popover with Calendar on desktop, their own
  drawer on phones, nested over an open drawer. Never a native `<select>` or
  `<input type="date">`.
- No raw Drizzle in routes: DTOs in `#lib/dto/`, one per table, and `load`
  returns `.toJSON()`.
- Form input is validated with a zod schema in `#lib/server/validation/` through
  `parseForm()`. Never cast `FormData` values.
- Money is an integer number of minor units (cents) plus the group's ISO
  currency code. Never a float.
- Migrations are append-only: never edit or regenerate one that exists, the boot
  check refuses a changed history. drizzle-kit drops `ON DELETE` from an
  `ALTER TABLE ... ADD ... REFERENCES`, so read the generated SQL before a dev
  server applies it.
- The Docker build context is an allowlist (`.dockerignore`): a new top-level
  build input has to be added there.
- Anything slow (exports, emails, receipt processing, recurring expenses) is a
  job: `JobDTO.enqueue()` with its payload typed in `JobPayloads`, handled in
  `#lib/server/jobs/handlers.ts` by the worker. A request never awaits it. The
  exception is a receipt scan: it runs in the request, through a Tesseract or
  Poppler subprocess fed over pipes, because the file is never stored and only
  the reading goes back to the form.
- Every async user action goes through `toast.promise`: a client handler splits
  into a throwing `<name>Callback()` that restores its own UI state and a thin
  `handle<Name>()`; a `use:enhance` form uses `enhanceToast` or `saveToast` with
  `reset: false` by default. Exceptions: synchronous results, and remote queries
  that render their own inline error.
- Every icon-only button is an `IconButton`: an `aria-label` and a tooltip with
  the same text.
- Mobile first: every screen works at 375px wide, respects the safe-area insets
  (`pt-safe-top`, `pb-safe-bottom`), keeps touch targets at 44px or more, and
  uses `ResponsiveSheet` (a drawer on phones, a dialog on desktop) instead of a
  centred dialog. Drawers float with corners concentric to the screen's.
  Navigation is the bottom tab bar on phones and the sidebar on desktop; desktop
  gets real layouts (grids, inline actions, page header buttons), not the phone
  column stretched, and no sliding page transitions.
- Appearance is per account (`appearance` table) and applied as data attributes
  on `<html>` by an inline boot script, so a reload never flashes. Colours come
  from the tokens in `layout.css`, all derived from `--hue`: never a raw
  Tailwind palette colour.
- A page runs full width (`px-4 md:px-6`, no `max-w-*` on the page) except a
  centred single-purpose card; lists cap themselves at `md:max-w-2xl`.
- `#lib` with extensions; links through `resolve()` with a route id or a
  pathname without the leading slash.
- `handleError` handles `kind === "unknown"` only and never returns the real
  message.
- The public origin comes from the request (adapter-bun reads `PROTOCOL_HEADER`
  and `HOST_HEADER`) unless `ORIGIN` is set, which a plain-HTTP instance with no
  proxy needs: adapter-bun otherwise assumes https and every form post fails the
  origin check. Kit's own check is off (`csrf.trustedOrigins: ["*"]`) and
  `csrfHandler` accepts the request's origin or `ORIGIN`. `ORIGIN` is ignored in
  dev.
- Environment variables are declared once in `src/env.ts` (`defineEnvVars`, a
  zod schema and a description each), typed by Kit's generated declaration and
  read only from `$app/env/private` in `#lib/server/env.ts`, which builds the
  `Config` that `instrumentation.server.ts` passes to `configure()`. Everything
  else calls `getConfig()`. The worker never reads its environment: the server
  sends it the same `Config` over IPC. `process.env`, `Bun.env` and
  `import.meta.env` are a prek error.
- Errors the user doesn't cause go through `reportError` (Sentry when
  `SENTRY_DSN` is set); slow units of work get a `withSpan`.
- CSS-only packages are devDependencies.
- Logging through `Logger`, structured context as a plain object; `console.*` is
  an oxlint error.
- A periodic job or fire-and-forget promise always catches: Bun exits on an
  unhandled rejection.
- No unused code; `bun run check` (fails on warnings) and `bun run lint` clean,
  whole repo, after every change.
- No comments in any code file, YAML or shell included. The exception is a
  required JSDoc block above every class method and exported function (what it
  does, side effects, throws, never the types), one or two lines. Tool
  directives with a reason are fine.
- Real OOP: a stateful service is an instance singleton, mixins when concerns
  call each other behind one symbol, composition otherwise, plain functions for
  stateless transforms; DTO static finders are the exception.
- No abbreviated names.

## Reference notes

Read only the note for the area you touch. A new area with its own decisions
gets its own note and row.

| Area                                                      | Note                           |
| --------------------------------------------------------- | ------------------------------ |
| Scripts, mise tasks, git hooks, tests, the worker in dev  | `.agents/notes/commands.md`    |
| The PR gate, canaries, the release PR, images and secrets | `.agents/notes/ci-releases.md` |

## AI-assisted development

Skills (`.agents/skills/`, linked from `.claude/skills/`):

- `check-repo`: runs every gate before calling a change done.
- `new-dto-route`: a table, its DTO and a route, with the conventions above.
- `migration-workflow`: changing `schema.ts` and getting it applied on SQLite.
- `new-tab-route`: adding a tab or splitting a page into tab routes.
- `new-remote-function`: a query or command under `#lib/remote/`.
- `shadcn-svelte`: adding and composing shadcn-svelte components.

Agents (`.claude/agents/`):

- `repo-gate`: runs the gates and scans the diff for every convention.
- `scaffold-feature`: builds a feature end to end from the backlog.
- `ui-consistency`: checks screens against the mobile-first rules.
- `docs-sync`: keeps CLAUDE.md, AGENTS.md, the notes and README in line.
- `doc-comments`: adds or fixes the required JSDoc blocks.
- `devex`: records developer-experience friction as `TODO.md` lines.

Skill frontmatter must be valid YAML: `description: >-` with the text indented.
The Stop hook runs `.claude/hooks/gate.sh` and blocks the hand-back until
`bun run check`, prek and the tests pass.
