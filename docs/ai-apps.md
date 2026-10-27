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
group, list the expenses (the uncategorized ones by default), and file them
under a category. For each expense it sees the description, amount, currency,
date and category, and for a personal one whether it's an expense or income. It
only reaches groups you're in, and a category it sets in a group changes it for
everyone there; transfers between members are left alone. It never sees your
email, password, banks, bank accounts or keys, notes, folders, who's in a group,
who paid, the splits or the balances.

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
