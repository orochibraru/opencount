# Balances and settling up

## Balances

A member's balance is what they paid minus their share of everything. Positive,
they are owed money; negative, they owe; zero, they are square. Every balance in
a group adds up to zero, to the cent.

You see yours in three places: next to each group in your groups list, in the
balance hero at the top of a group, and on the group's **Balances** page, which
lists every member's.

Balances are computed from the expenses each time, never stored. Edit or delete
an expense and every balance follows.

## Settling up

**Settle up** proposes the payments that bring everyone back to zero. The
biggest debtor pays the biggest creditor as much as they can, then the next, and
so on. That takes at most one payment fewer than the number of people who are
not square, rather than everyone paying everyone.

Nothing moves on its own: OpenCount keeps the count, people pay each other
however they like. When a payment happens, record it from the list. It is saved
as a transfer, dated today, from the one who paid to the one who received, and
both balances move by its amount. The proposals recompute right away.

A recorded payment shows in the expense list. Recorded the wrong one? Delete it
like any expense.

## When everyone is square

The group says so: **Everyone's square**, nobody owes anything. Repeating
expenses and new expenses start the count again.
