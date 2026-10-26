# Expenses

An expense says who paid how much, when, for what, and who it was for. A group
opens on its expenses, newest first.

## Adding one

**Add expense** (the floating button on a phone) opens a sheet:

- **What for**: a short description, like _Dinner at the harbour_. Required, up
  to 120 characters.
- **Amount**: typed the way you write it, `12`, `12.5`, `12,50` or `1 234,56`.
  It must be above zero, with no more decimals than the currency has (none for
  JPY).
- **Currency**: the group's by default; see
  [Other currencies](#other-currencies).
- **Paid by**: one member, you by default.
- **Date**: today by default, with **Today** and **Yesterday** one tap away.
- **Category**: guessed as you type; pick another to override the guess. See
  [Categories and merchants](categories-and-merchants).
- **Where**: the merchant, optional. Pick one the group already used or type a
  new name.
- **Split**: who it was for, and how.
- **Repeat**: never, or every week, month or year. See
  [Repeating expenses](recurring-expenses).

With receipt reading on, **Scan a receipt** fills in the amount, the date and
the merchant from a photo or a PDF. See [Scanning receipts](receipts).

## Other currencies

Paid in dollars in a euro group? Pick the currency next to the amount. The rate
to the group's currency is filled in from the European Central Bank's (through
Frankfurter) for the expense's date, and you can type another one. The expense
then counts in the group's currency at that rate, which is frozen on the
expense: later rate changes never move a balance. The amount you paid in the
original currency stays on it. The splits and balances are always in the group's
currency. If the rate service can't be reached, type the rate yourself.

## Splitting

Pick who the expense was for (everyone by default), then how to divide it:

- **Equally**: the same part for each person picked.
- **By shares**: a whole number per person, like 2 for a couple and 1 for
  someone alone. Each pays in proportion.
- **Exact amounts**: an amount per person. They must add up to the total; the
  sheet shows what is left to assign.

The sheet previews each person's part as you go. Amounts are whole cents, so a
total that doesn't divide evenly hands the leftover cents, one each, to the
first people in the list: 10.00 split three ways is 3.34, 3.33 and 3.33, never
3.333.

## Offline

With no connection, **Add expense** still works: the expense is kept on the
device and sent when you're back online, with a notice that it is waiting. Only
new expenses are kept this way, not edits or deletions. Each carries an id, so a
retry never adds it twice.

## Editing and deleting

Open an expense to edit any field, or delete it from its menu (a long press on a
phone). Every member can edit or delete any expense in the group, and everyone's
balance updates right away.

Editing an expense created by a repeating rule changes only that copy, not the
rule. Its **Repeat** choice is only offered when adding.

## Payments

A payment recorded from **Settle up** is stored as a transfer from one member to
another. It shows in the list next to the expenses and counts in the balances,
but it is not spending, so insights leave it out. See
[Balances and settling up](balances-and-settling).
