# Personal expenses and bank sync

**Personal** is a private list of your own expenses. Nobody else sees it, not
the other members of your groups and not the admin. It is in the bottom tab bar
on a phone and the sidebar on a desktop.

## The ledger

Each expense has its own currency, whatever the currency of your groups, and is
never converted. The top of the page shows this month's total by category, and
the list below is grouped by month and shows 50 entries at a time, with a **Load
more** button. Add, edit and delete work like in a group.

When you change an expense's category, a sheet lists your other expenses with
the same description that sit under another category, so you can re-file them in
one go. Untick any that don't belong.

## Folders

A folder is a project inside Personal: a trip, a renovation. Create one from
**Personal**, and pick it in the expense sheet's **Folder** field to file an
expense there. Each folder has its own page with its total, this month, its top
categories and its last 6 months. Rename or delete it from that page. Deleting a
folder keeps its expenses: they stay in Personal, out of any folder.

**Split in a group** takes a personal expense and adds it to one of your groups,
paid by you and split equally between everyone. When its currency differs from
the group's, it is converted at the European Central Bank's rate for its date
(through Frankfurter). The personal expense is then marked **Split in** the
group's name.

## Bank sync

Once you have set it up in **Account, Bank sync** (see below), you can link your
own bank from **Personal**: pick a country and a bank, then confirm on the
bank's own screen. Until then, Personal shows a pointer to that page. OpenCount
never sees your bank credentials. The consent lasts 90 days, after which you
link again.

Once a day the server fetches your booked debits and adds them to your personal
ledger, categorized like any expense. The first sync goes back 90 days, later
ones start 3 days before the previous one, and a transaction is never added
twice. You get a notification when new ones arrive. **Sync now** fetches right
away and **Unlink** stops the sync.

Delete an expense that came from your bank and it is hidden, so the next sync
doesn't bring it back.

## Setting it up

Bank sync goes through [Enable Banking](https://enablebanking.com), an
open-banking provider covering most European banks, Revolut included. It is per
account: everyone uses their own Enable Banking application, and the admin
configures nothing. In **Account, Bank sync**:

1. Create an application in the Enable Banking control panel, in the production
   environment, with the redirect URL shown on the page.
2. Paste its application ID and the RSA private key it gave you. The key is
   stored encrypted, never sent back to the browser, and the pair is checked
   against Enable Banking before it is saved.

**Turn off** forgets your keys: linked banks stop syncing, and a link whose keys
are gone fails with a message until you set them up again. The expenses already
imported stay.

Enable Banking's free "restricted" use only works for accounts you linked to
your application in its control panel, so your own bank accounts must be linked
there first. A contract with Enable Banking lifts that. The server calls
`api.enablebanking.com` for this, and only then. See
[Configuration](configuration).
