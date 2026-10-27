# Categories and merchants

Every expense has a category, and can have a merchant. Both feed
[Insights](insights), and both are filled in for you most of the time.

## Built-in categories

Food & drinks, Groceries, Transport, Lodging, Activities, Shopping, Bills, Home
& DIY (hardware stores, furniture, repairs), Health, Pets, Subscriptions
(streaming and apps), Personal care, Education, Culture (books, shows, concerts,
instruments), Taxes & fines (taxes, speeding and parking tickets, the tax
office), Finance (bank fees, loans, savings, investing, cash withdrawals,
transfers), Income (salary, refunds, top-ups), and Other for the rest. Every
group, and Personal, has them.

## Your own categories

A group, and your Personal ledger, can add their own, for what the built-in ones
miss: Rent, Kids, Car. For a group, from **Settings, Categories**; for Personal,
from **Categories** in its header menu. Give one a name (up to 40 characters)
and pick an icon. A name can't repeat another category of the group, built-in
ones included, whatever its case.

Each category has its own colour, on its icon, in the filter and on the Insights
bars: a fixed one for each built-in category, a colour derived from its id for a
custom one, and a neutral grey for Other. The colours follow the account's
theme.

Custom categories belong to their group, or to your Personal ledger; nobody else
sees them. Deleting one files its expenses, repeating expenses and merchants
under Other.

## Sorting what's under Other

**Settings, Categories** has **Sort what's under Other**. It files every expense
still under Other using the description, the merchant's remembered category and
the group's own categories. Expenses you filed by hand aren't touched.

In Personal, the same button on its **Categories** page also uses how you filed
the same description before, ahead of the keywords, and marks savings and
investing as set aside (see [Personal expenses](personal-and-banks)).

## The category guess

As you type what an expense was for, OpenCount suggests a category:

1. A custom category of the group whose name appears in the description wins:
   _school trip for kids_ goes under your Kids category.
2. Otherwise, keywords in English, French, German, Spanish, Italian, Dutch and
   Portuguese: _dinner_, _resto_, _Lidl_, _courses_, _SNCF_, _Airbnb_, _loyer_,
   _croquettes_, _Leroy Merlin_, _YT premium_, _Apotheke_, and many more.
   Accents, case and plurals (_bières_ like _bière_) don't matter.
3. Nothing matched: the category stays as it is.

Picking a merchant suggests the category that merchant was last filed under, and
falls back to the same guess on its name. Once you pick a category yourself, the
guess stops touching it.

## Merchants

**Where** remembers merchants per group. Type a new name and it is saved with
the expense; type it again in any case and it is the same merchant. The picker
lists the group's merchants most used first, then most recent.

Each merchant remembers the category you last filed it under, so the second
coffee at the same place needs no picking at all.
