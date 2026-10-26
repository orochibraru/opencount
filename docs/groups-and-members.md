# Groups and members

A group is one shared pot: a trip, a flat, a dinner, a club. Everything else
(expenses, balances, categories, merchants, repeating expenses) belongs to one
group, and only its members see it.

## Making a group

**New group** asks for a name and a currency: EUR, USD, GBP, CHF, CAD, AUD, JPY,
SEK, NOK, DKK, PLN or CZK. You become its first member and its creator.

The currency can change until the first expense is in. After that it is fixed:
every amount in the group is stored in that currency's minor units, and
converting them would rewrite history. Expenses paid in another currency are
converted when they're added; see [Expenses](expenses#other-currencies).

Any member can rename the group from **Settings, General**.

## Members

A member is a name in the group, linked to an account or not. That split is the
point: you can log the dinner tonight for four people when only two of them have
an account, and sort out who is who later.

From **Settings, Members**, any member can:

- **Add someone** by name. Give their account email too and they are linked to
  that account straight away, and the group shows up in their list. The email
  must belong to an existing account on this server; if it doesn't, leave it
  empty and have an admin invite them.
- **Rename** a member.
- **Remove** a member, only while they are not part of any expense or repeating
  expense, as payer or in a split. Edit or delete those first, so no balance
  quietly changes.

### Invite link

**Settings, Members** shows the group's invite link. Anyone signed in to this
server who opens it joins the group: they pick which unlinked member is them, or
join as a new one under their own name. It doesn't create accounts, so people
still need one. **New link** makes the old one stop working; **Turn off** stops
it for good until a new one is made. Any member can do both, so share it only
with people you'd add anyway.

### That's me

Someone added by name gets an account later. A member adds that account to the
group by email, which gives them a second, empty member and the group in their
list. They then open **Settings, Members** and pick **That's me** on their old
name. It takes over: everything their new member paid, its share of every
expense and its repeating expenses move to the old name, merged where both
appear in the same expense, and the new member is removed. It is one step, it
can't be undone, so it asks first.

## Importing and exporting

**Settings, Import** brings a Tricount over: paste its share link, or pick a
registry JSON file, and the preview lists what will come in. The Tricount's
currency must match the group's. You map each person to a member of the group or
to a new one, then a background job adds the expenses, with their splits,
categories and dates, and you get a notification when it's done. Tricount no
longer offers its own CSV export; the link is read from Tricount's servers.

**Settings, Export** builds the group's expenses as a CSV spreadsheet or a PDF
summary in the background. The file waits in the list for a day and only you can
download it.

## Leaving and deleting

**Leave group** unlinks your account from your member. The member stays, with
your name, your expenses and your balance, so the group's numbers don't change;
the group just disappears from your list until someone adds you back, after
which **That's me** on your old name restores it. The creator can't leave: they
delete the group instead.

**Delete group** is for the creator only, and removes the group, its expenses
and its balances for everyone. To only hide a group from your own list, archive
it instead: see [Archiving](archiving).

## Who can do what

Every member can add, edit and delete expenses, manage members, categories and
repeating expenses, and rename the group. Only the creator can delete it. There
are no other roles inside a group: it is built for people who trust each other
with a shared count.
