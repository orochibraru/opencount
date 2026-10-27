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

The search box looks through descriptions as you type. **Filter** narrows the
list by category, and by bank and by account once you have linked more than one
bank account. The totals at the top follow what is shown.

Your own categories live at **Categories** (the **...** menu in the header on a
phone). **Sort what's under Other** there files the entries still under Other,
using how you filed the same description before, then the keywords and your own
categories.

### Set aside

Savings and investing, like a Revolut round-up sent to a robo portfolio, a
vault, a livret or a PEA, are detected from the description, filed under Finance
and counted apart from spending, as **set aside, not spent**. A switch in the
expense sheet sets or clears it by hand.

### Insights

**Insights** (`/personal/analytics`, also in the header menu) shows, for a
period, what you spent, what you set aside, a chart by day, week or month, and
the breakdown by category and by folder. It only counts your main currency.

## Folders

A folder is a project inside Personal: a trip, a renovation. Create one with
**New folder** in Personal's menu, then file an expense there with the expense
sheet's **Folder** field or **Move to folder** in the expense's menu. Open a
folder from **Filter**: its page has its total, this month, its top categories
and its last 6 months, and its menu renames or deletes it. Deleting a folder
keeps its expenses: they stay in Personal, out of any folder.

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

Once a day the server fetches your booked transactions and adds them to your
personal ledger, categorized like any expense, reusing how you filed the same
description before. Money coming in (salary, top-ups, refunds) is imported as
income: shown with a + in green and counted as **came in**, not as spending.
Each line records its bank account, and rows show the bank and account when you
have more than one. The first sync goes back 90 days, later ones start 3 days
before the previous one, and a transaction is never added twice. You get a
notification when new ones arrive. **Sync now** fetches right away and
**Unlink** stops the sync.

Delete an expense that came from your bank and it is hidden, so the next sync
doesn't bring it back. A line from your bank keeps its amount, currency and
description as the bank gave them: only its category, date, folder, set aside
and note can change. A note shows under the line and search finds it, so "CB
AMZN MKTP" can say what it was for. A sync never overwrites it.

## Money overview

Off by default. Once a bank is linked, Groups asks once whether to add a
**Home** tab; you can change it later with **Home tab** under **Account, Bank
sync**. Home shows this month's spent, came in, set aside and left over, your
pace against last month and a forecast for the month's end, yesterday's report,
your biggest habit (something you pay for more than once a month), the top
category against last month, payments that repeat every month and spending day
by day.

## Setting it up

Bank sync goes through [Enable Banking](https://enablebanking.com), an
open-banking provider covering most European banks, Revolut included. It is per
account: everyone uses their own Enable Banking application, and the admin
configures nothing. In **Account, Bank sync**:

1. Press **Create an app on Enable Banking**: the control panel opens in a new
   tab and a step-by-step guide opens next to it. Sign in with your email,
   register a production application with the redirect URL the guide shows, and
   your browser downloads its private key, named after the application ID.
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
