# Personal expenses and bank sync

**Personal** is a private list of your own expenses. Nobody else sees it, not
the other members of your groups and not the admin. It is in the bottom tab bar
on a phone and the sidebar on a desktop.

## The ledger

Each expense has its own currency, whatever the currency of your groups, and is
never converted. The top of the page shows this month's total by category, and
the list below is grouped by month. Add, edit and delete work like in a group.

**Split in a group** takes a personal expense and adds it to one of your groups,
paid by you and split equally between everyone. When its currency differs from
the group's, it is converted at the European Central Bank's rate for its date
(through Frankfurter). The personal expense is then marked **Split in** the
group's name.

## Bank sync

When an admin has set it up, you can link your own bank from **Personal**: pick
a country and a bank, then confirm on the bank's own screen. OpenCount never
sees your bank credentials. The consent lasts 90 days, after which you link
again.

Once a day the server fetches your booked debits and adds them to your personal
ledger, categorized like any expense. The first sync goes back 90 days, later
ones start 3 days before the previous one, and a transaction is never added
twice. You get a notification when new ones arrive. **Sync now** fetches right
away and **Unlink** stops the sync.

Delete an expense that came from your bank and it is hidden, so the next sync
doesn't bring it back.

## Setting it up as an admin

Bank sync goes through [Enable Banking](https://enablebanking.com), an
open-banking provider covering most European banks, Revolut included. In
**Admin, Bank sync**:

1. Create an application in the Enable Banking control panel, in the production
   environment, with the redirect URL shown on the page.
2. Paste its application ID and the RSA private key it gave you. The key is
   stored encrypted, never sent back to the browser, and the pair is checked
   against the API before it is saved.

Enable Banking's free "restricted" use only works for accounts you linked to
your application in its control panel, so each person's own accounts must be
linked there first. A contract with Enable Banking lifts that. The server calls
`api.enablebanking.com` for this, and only then. See
[Configuration](configuration).
