# AI apps

Claude, ChatGPT and Gemini can sort your personal expenses, and those of the
groups you're in, into categories for you. OpenCount runs an MCP server at
`/mcp` on your instance, and each person connects their own AI app under
**Account, AI apps**.

## Connecting one

1. Copy the address shown under **Account, AI apps**, for example
   `https://money.example/mcp`.
2. Add it to your AI app: a custom connector in Claude, an app in ChatGPT, or a
   connected app in Gemini.
3. The app sends you to OpenCount: sign in if you aren't, then allow it.
4. Ask it to categorize your expenses, or a group's.

The app registers itself the first time it connects, through a Client ID
Metadata Document when it publishes one, or Dynamic Client Registration
otherwise, so there is nothing to set up for an admin. Gemini Enterprise, which
wants a client ID and secret typed in by hand, is not supported.

## What it can do

It can list your groups, list the categories of your personal expenses or of a
group and add new ones (with an icon), list the expenses (the uncategorized ones
by default), and file them under a category. In a group it can also list the
merchants, add one, and put merchants on expenses; personal expenses have no
merchants. Adding a category or merchant that already exists under that name,
whatever its case, hands back the existing one instead of a copy. It can also
write or clear the note on your expenses or a group's, and sort your personal
expenses into folders. For each expense it sees the description, note, amount,
currency, date and category, and for a personal one whether it's an expense or
income and its folder. It can list your bank accounts with their type, whether
they're shared and their latest balance (synced or typed in, with its date), and
record a balance for an account your bank doesn't report; each personal expense
names the account it came from. It can list your recurring payments (amount, how
often, next date, payments left, the account they come from) and file an expense
as recurring, or out of it. It can sum up any period (by default since your last
payday, when your months follow your pay): income, spending by category and by
account, savings and finance apart, and what is left to spend until your next
payday and per day, from the accounts it's told to count. Its expense list can
be narrowed by dates, account, category, kind and search. It only reaches groups
you're in, and a category or note it sets in a group changes it for everyone
there; transfers between members are left alone. It never sees your email,
password, bank credentials or keys, who's in a group, who paid, the splits or
the balances.

## Staying in control

An app keeps access for 30 days after you allow it. After that its tokens are
deleted and it has to send you through sign-in and consent again. Revoke one
sooner under **Account, AI apps**: it stops working on its next request, not
when its current token runs out.

AI apps need the instance on HTTPS (or `localhost` while developing): OAuth
refuses anything else, and **Account, AI apps** says so when it can't offer the
address.

## For admins

Sign-in for AI apps is an OAuth 2.1 authorization server inside OpenCount, with
its discovery documents under `/.well-known/` and its endpoints under
`/api/auth/oauth2/`. A reverse proxy has to pass both through, along with
`/mcp`. To read a Client ID Metadata Document, the server fetches the URL the
app gives as its client ID, only over HTTPS, only to a public address, without
following redirects.
