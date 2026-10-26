# Repeating expenses

Rent, a subscription, the weekly groceries run: an expense that comes back on a
schedule. Set it once and the server adds each copy on its date.

## Making one

Add the expense as usual and set **Repeat** to every week, every month or every
year. The expense you just added is the first copy; the rule remembers its
description, amount, payer, category, merchant and split, and adds the next copy
on the next date.

Dating it in the past catches up straight away: a monthly rent started three
months ago adds the missed copies as soon as you save.

## When copies land

- **Weekly** rules land every seven days.
- **Monthly** and **yearly** rules land on the day of the month the first copy
  was dated. When a month is shorter, the copy lands on its last day, and the
  next one goes back to the original day: a rule started on 31 January lands on
  28 February, then 31 March, not the 28th forever.

The worker checks for due copies when it starts and every day just after
midnight, UTC. A copy is added once, even if two checks run at the same time.

## Managing rules

Each group lists its rules under **Settings, Repeating**, next due first.

- **Pause** stops new copies. **Resume** picks up from today: copies dated while
  it was paused are skipped, not added in a batch.
- **Delete** stops the rule for good. The copies it already added stay, as
  ordinary expenses.

A rule can't be edited. To change the amount or the split, delete it and add a
new repeating expense; editing one copy only changes that copy.

A member who pays or shares in a rule can't be removed from the group until the
rule is deleted.
