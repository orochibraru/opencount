# TODO

The only backlog. Each entry is a `- [ ]` checkbox: put `**[WIP]**` after the
box while it's being worked on, and delete the entry once it's done.

## Small

- [ ] Pull-to-refresh on the groups list in the installed PWA.
- [ ] An offline page the service worker serves when a navigation fails.
- [ ] Haptic feedback (`navigator.vibrate`) on primary actions where supported.
- [ ] Admin: reset someone's two-factor and passkeys when they're locked out.

## Medium

- [ ] Password reset by email, through better-auth's reset flow and the mailer.
- [ ] Account settings: change email and password; delete the account.
- [ ] Admin: change a user's email, export and restore the SQLite file.
- [ ] Invite an account to a group by link, so "That's me" works without an
      admin adding them by email first.

## Large

- [ ] Import from Tricount: upload a Tricount export (or paste its share link),
      map its participants to the group's members, and create the expenses with
      their splits, categories and dates in a worker job, with a preview before
      anything is written.
- [ ] CSV and PDF export of a group, built by the worker.
- [ ] Multi-currency groups with conversion rates frozen per expense.
- [ ] Offline expense capture queued in IndexedDB and synced on reconnect.
