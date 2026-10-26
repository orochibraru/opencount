# Introduction

OpenCount is a self-hosted, open-source alternative to Tricount. People make a
group for a trip, a flat or a dinner, log who paid for what, and see who owes
whom and how to settle up. You run it on your own server, so the expenses of
your friends and family stay there.

It is one container and one SQLite file. There is no external database, no cache
and no queue to run next to it: background work (emails, repeating expenses,
housekeeping) runs in a worker process the server starts and watches inside the
same container.

## Who it is for

A household, a group of friends, a small association: a handful to a few dozen
people who trust one person to run the server. OpenCount is **invite-only by
default**. The first account becomes the admin, and the admin invites everyone
else or opens sign-ups once email works.

## What you get

**Groups.** One per trip, flat or dinner, in one of twelve currencies. Add
people by name, even before they have an account; once their account is in the
group, they claim their name with **That's me** and everything it paid and owes
becomes theirs.

**Expenses.** Who paid, how much, when, for what, and where. Split equally, by
shares or by exact amounts, between everyone or only some. Amounts are stored as
whole cents, so a split always adds up to the total.

**Balances and settling up.** Each member's balance at a glance, and the short
list of payments that brings everyone back to zero. Record a payment in one tap
when it happens.

**Repeating expenses.** Rent and subscriptions, every week, month or year. The
server adds each copy on its date, and you can pause, resume or stop a rule.

**Less typing.** The category is guessed from what you type, in English or
French, and from your group's own categories. Merchants are remembered per
group, along with the category you last filed them under. With receipt reading
on, a photo or a PDF of a receipt fills in the amount, the date and the
merchant.

**Personal expenses.** A private ledger of your own spending in any currency,
with folders for projects, optional daily bank sync through your own Enable
Banking application, and a one-tap split into a group.

**Insights.** What the group spent by period, category, merchant and payer, and
how it moved over time.

**It feels like an app.** Install it from the browser on a phone and it opens
standalone, with a bottom tab bar, pages you already opened available offline,
sheets that slide up from the bottom and 44px touch targets. On a desktop it is
a full app with a sidebar and real multi-column layouts.

**Yours to adjust.** Each account picks its accent colour, light or dark theme,
an AMOLED black variant, a font and the corner style.

**Serious sign-in.** Passwords, passkeys, authenticator apps with backup codes,
and single sign-on through any OpenID Connect provider. The admin can require an
authenticator app or a passkey from everyone, or turn passwords off.

## What it is not

OpenCount does not move money. It keeps the count; people pay each other however
they like, then record the payment. A group has one currency, fixed once the
first expense is in; an expense paid in another one is converted at a rate
frozen on it.

## License

[MIT](https://github.com/orochibraru/opencount/blob/main/LICENSE).

## Where to go next

- [Install](install) puts the container up.
- [Configuration](configuration) lists every environment variable.
- [First run](first-run) goes from the setup code to a first settled bill.
- [Showcase](showcase) shows every screen.
- [Development](development) is the contributor's entry point.
