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
the breakdown by category and by folder. It only counts your main currency. With
your months following your pay, the first period is **Since payday**; **Custom**
picks any two days. With more than one account, **By account** shows where the
spending came from.

## Month start

Paid on the 25th? Pick **Month start** in Personal's menu and choose the day
your month starts, from 1 (calendar months, the default) to 28. Personal's "this
month", its month headings ("25 Oct – 24 Nov"), Home and Personal Insights then
count each month from that day to the day before it comes back. Groups keep
calendar months.

Paid on a different day each month? Choose **The day my pay comes in** instead,
then pick **This is my pay** in your salary's menu. Every income line with the
same description is marked with it, and so are those the next bank syncs bring.
Each month then opens the day your pay landed and runs until the next one: paid
early on the 23rd, your new month starts on the 23rd. A second payment within
three weeks stays in the same month. Before your first marked pay and while the
next one hasn't landed, months fall on the same day of the month as the nearest
pay. **Not my pay** undoes it.

The category bars on Personal's totals card count this month only, like the
total above them; a folder or a search shows them for every month.

## Rules

**Rules** in Personal's menu says once what a line means: every line whose
description has some words in it (case, accents and plurals don't matter) gets a
category, a tag, a recurring series, or counts as your pay. A rule applies to
every line you already have when you save it, and to each new line from your
bank. A newer rule wins over an older one; deleting a rule leaves the lines it
filed as they are.

**To sort** in the same menu is an inbox of lines still under Other, one at a
time: tap a category to file it, with **Every line like it** on to make a rule
from its description at the same time (cut what changes each time, like a
reference number). **Skip for now** moves to the next one.

**Salary** shows the next payday, the paydays found so far and the rules that
say what your pay is. When your pay will land on another day than usual, set
**Expect the next one on**: your month runs until then.

## Tags

Give any line tags in its sheet, separated by commas: they show under the line
as #tag and `?tag=` in the address narrows the list to one. The tag
**reimbursable** marks money you paid and expect back, like a work lunch: it
stays out of every total, and the totals card shows what is still waiting to be
paid back. Tap that line to see those expenses; remove the tag once you're
repaid and the expense counts again.

## Recurring

Pick **Mark as recurring** in any line's menu and give it a label, like Car loan
or Music: that line and every line of the same kind with the same description
join the series, and so do the ones later syncs bring. Two loans paid from the
same bank keep apart as long as their descriptions differ. Pick a type
(subscription, loan, pay in instalments or other), how often it comes back (read
from the payments unless you say), and for a loan how many payments are left:
OpenCount works out when it ends.

**Recurring** in Personal's menu lists every series with its amount, how often
it comes, when it's next due, how many payments are left and the account it's
paid from, with what they cost each month on top. A series charged twice within
half its period is flagged **Charged twice**. Ended series fold away at the
bottom. **Not recurring** on a line takes it and the lines like it out of their
series; deleting a series keeps its payments.

Amounts show with a minus when money went out and a plus when it came in.

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

**Account, Bank sync** has four tabs, cards on a phone: **Linked banks**, **Bank
sync** (your keys), **Home** and **Turn off**. Once your keys are in (see
below), link your own bank under **Linked banks** with **Link a bank**: pick a
country and a bank, then confirm on the bank's own screen. OpenCount never sees
your bank credentials. The consent lasts 90 days, after which you link again.

**Personal** opens on your accounts: **All accounts** with what they hold
together, then each account with its logo and balance. Tap one to see only its
lines, tap it again (or All accounts) to see everything. A spinning one is
syncing, a red dot means its bank's last sync failed.

Once a day the server fetches your booked transactions and adds them to your
personal ledger, categorized like any expense, reusing how you filed the same
description before. Money coming in (salary, top-ups, refunds) is imported as
income: shown with a + in green and counted as **came in**, not as spending.
Each line records its bank account, and rows show the bank and account when you
have more than one. The first sync asks for all the history your bank keeps
(often a year or more, sometimes only 90 days), later ones start 3 days before
the previous one, and a transaction is never added twice. You get a notification
when new ones arrive.

**Linked banks** lists each bank with where its sync stands: syncing, when it
last synced and how many lines were new, how far back its history goes, until
when the link lasts, or why the last sync failed. Its menu has **Sync now**,
**Fetch full history** (asks again for everything the bank keeps; many banks
only hand it over shortly after you confirm the link), **Relink or change
accounts** and **Unlink**, which stops the sync.

**Accounts** in Personal's menu lists every linked account with its balance: the
one your bank reported at the last sync, or one you typed in with **Set the
balance** when that is newer (handy when a bank reports none, or for an
overdrawn account: type a minus). Each account has a type: everyday account,
joint account, savings, investments or credit card. Savings and investments hold
money set aside, so money moved into them counts as set aside, and a joint
account is shared: it counts at half. **Shared with someone** marks any account
that way without changing its type. **Add an account** adds one no bank reports,
like cash or a broker: you keep its balance with **Set the balance**, it counts
like any other, and it can be deleted.

**Relink or change accounts** sends you through the bank's consent screen again
for the same bank: use it when the 90 days run out or to add or drop accounts
(some banks let you pick them there, others share every account). The lines you
already have stay put, and the bank's full history comes in again without
doubling anything. A link where Enable Banking can read no account is refused
with the reason, and nothing is linked.

Money moved between your own accounts, into savings or back, is hidden from the
list: **Show transfers between your accounts** brings it back, both sides of a
transfer as one row ("Everyday → Joint"). It never counts as spent or income;
what went into savings shows as **set aside**.

A deferred debit card shows each purchase on its own day (a line ending in
"CARTE 1234") and, once a month, the statement that takes their total from your
account ("RELEVE CARTE"). Purchases count as spent on the day you made them; the
statement never counts, so nothing is counted twice. Purchases made since the
last statement are already spent but not yet taken from your balance. In the
list a statement reads "not counted", with the account it was taken from, and
**Show the purchases** lists the purchases it settles.

Delete an expense that came from your bank and it is hidden, so the next sync
doesn't bring it back. A line from your bank keeps its amount, currency and
description as the bank gave them: only its category, date, folder, set aside
and note can change. A note shows under the line and search finds it, so "CB
AMZN MKTP" can say what it was for. A sync never overwrites it.

## Money overview

**Left until payday** sits on top: what you can still spend until your next
payday, and per day. It's the balance of your everyday accounts and cards, minus
the recurring payments due before payday from them and the deferred card
purchases not yet taken from them. Tap it for the breakdown and to switch each
account on or off (a joint account starts off and counts at half when on;
savings and investments never count). Your choice stays on that device. With
your months following your pay, payday is the next day your pay is expected;
otherwise it's the start of your next month. AI apps get the same number from
`get_period_summary`.

Once you have an account, linked or added by hand, the app opens on **Home**,
your money, and Groups moves to its own tab: groups are for splitting with
others, Home and Personal follow your own money. Switch it off with **Open on my
money** under **Account, Bank sync, Home** to open on your groups again.

Home starts with **On your accounts**: what every account holds together (a
joint one at half), split into what's there to spend and what's saved, then each
account with its balance, everyday ones first, savings and investments after.
Tap an account to see its lines. Below come **Left until payday**, then this
month's spent, came in, set aside and left over, your pace against last month
and a forecast for the month's end, yesterday's report, your biggest habit
(something you pay for more than once a month), the top category against last
month, payments that repeat every month and spending day by day.

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
there first; if you forget, the link is refused with that message. Link them,
then press **Relink or change accounts**. A contract with Enable Banking lifts
that. The server calls `api.enablebanking.com` for this, and only then. See
[Configuration](configuration).
