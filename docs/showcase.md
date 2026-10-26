# Showcase

A tour of OpenCount, one screen at a time. Desktop screens are shown in the dark
theme at 1440 by 900, phone screens in the light theme at 390 by 844. Every
name, group and amount is made up.

![OpenCount on a desktop and a phone](images/feature.webp)

## On a desktop

![The groups list](images/groups-desktop.webp)

The groups list shows each group you are in, who is in it, and your balance in
it at a glance: what you are owed, or what you owe.

![A group's expenses](images/group-desktop.webp)

A group opens on its expenses, newest first, with your balance on top and a
shortcut to settle up. Add, edit or delete an expense in place.

![A group's insights](images/insights-desktop.webp)

Insights break the spending down by period, category, merchant and payer, with a
chart of how it moved over time.

![A group's members](images/settings-desktop.webp)

A group's settings hold its name and currency, its members, its own categories
its repeating expenses, and importing and exporting. Members added by name show
**No account linked** until someone claims them.

![The admin area](images/admin-desktop.webp)

The admin area holds the setup checklist, the users, invites, access rules,
sign-in methods, email, receipt reading, bank sync and backups. Only admins see
it.

## On a phone

![The groups list on a phone](images/groups-mobile.webp)

![A group on a phone](images/group-mobile.webp)

On a phone it behaves like an app: a bottom tab bar, a floating button to add an
expense, and a long press on an item for its actions.

![Adding an expense](images/expense-mobile.webp)

![Picking a category](images/picker-mobile.webp)

Adding an expense happens in a sheet that slides up from the bottom. The
category and merchant pickers are searchable, and the category is guessed as you
type.

![Insights on a phone](images/insights-mobile.webp)

## Regenerating the screenshots

`mise run screenshots` retakes every screen into `docs/images/`, and
`mise run showcase` lays out `feature.webp`, the hero at the top of the README.
See [Development](development).
