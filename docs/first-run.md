# First run

From a fresh container to a first settled bill.

## 1. Prove you run the server

A fresh instance has no account, and every page sends you to the setup screen.
Anyone who finds the URL before you could claim the admin account, so the screen
asks for a code only the server's log shows. At boot, the server prints:

```text
Setup code: 123 456 (valid 15 minutes). Enter it at /auth/setup to create the admin account.
```

Read it with `docker compose -f compose.prod.yaml logs opencount` (or
`docker logs opencount`). The code is six digits, valid 15 minutes, and allows
five tries. Expired? **Code expired? Print a new one** writes a fresh one to the
log, at most once a minute.

## 2. Create the admin account

Enter your email, your name and a password typed twice. A password needs at
least 12 characters, three of lowercase, uppercase, digit and symbol, and must
not contain the name part of your email.

That first account is the admin. From then on the setup screen is gone: it sends
visitors to sign-in, and nobody can use it again.

## 3. Follow the checklist

You land on the admin overview, which opens with a **Getting started**
checklist:

- **Set up email**, so invites and sign-up codes arrive by themselves. See
  [Email](email).
- **Secure your admin account** with an authenticator app or a passkey, from
  **Account, Security**.
- **Invite someone**: an invite is a link, emailed when email works, or copied
  and sent yourself. See [The admin area](admin).

Each step is optional. Without email, invites still work by link.

## 4. Make a group

Back on **Groups**, start a group: a name, like _Lisbon trip_, and a currency.
You are its first member. Open it, then **Settings, Members** to add the others
by name. They don't need an account yet: once they have one, add it by email and
they claim their name with **That's me**. See
[Groups and members](groups-and-members).

## 5. Add an expense

**Add expense** opens a sheet: what it was for, the amount, who paid, the date
and how to split it. The category is guessed as you type. See
[Expenses](expenses).

## 6. Settle up

The group's balance hero shows where you stand. **Settle up** lists the fewest
payments that bring everyone to zero; record each one when it happens. See
[Balances and settling up](balances-and-settling).

## Install it on a phone

Open the instance in the phone's browser and sign in: OpenCount offers to
install itself the first time. Otherwise add it to the home screen yourself:
**Share, Add to Home Screen** in Safari, **Install app** in Chrome. It then
opens standalone, without browser chrome, like any other app, and can send
notifications. This needs HTTPS.

## If something is wrong

The usual first-run failure is the origin: pages render but every form says
`Cross-site POST form submissions are forbidden`. Read
[Configuration](configuration). For anything else,
[Troubleshooting](troubleshooting).
