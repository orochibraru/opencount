# TODO

The only backlog. Delete an entry once it's done.

## Small

- Group detail route under `(protected)/groups/[id]` with its member guard, and
  the groups list linking to it.
- Pull-to-refresh on the groups list in the installed PWA.
- An offline page the service worker serves when a navigation fails.
- Haptic feedback (`navigator.vibrate`) on primary actions where supported.

## Medium

- Group members: add by name, invite an account by link, rename, remove.
- Expenses: amount in minor units, payer, split equally, by shares or exact
  amounts, date, note; a list per group.
- "Scan a receipt" when adding an expense: upload to `receipt_scan`, queue
  `receipt.read`, prefill amount, date and merchant from the reading.
- Password reset by email, through better-auth's reset flow and the mailer.
- Balances and the minimal set of settle-up transfers per group.
- Record a settlement as a reimbursement expense.
- Account settings: change email and password; delete the account.
- Admin: change a user's email, export and restore the SQLite file.

## Large

- Keep the receipt photo on the expense, with a thumbnail made by the worker.
- CSV and PDF export of a group, built by the worker.
- Multi-currency groups with conversion rates frozen per expense.
- Offline expense capture queued in IndexedDB and synced on reconnect.
- Recurring expenses scheduled by the worker.
