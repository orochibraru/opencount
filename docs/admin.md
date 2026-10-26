# The admin area

**Admin** is where an instance is run from: who gets in, how they sign in,
email, receipt reading and backups. It shows in the navigation for admins only;
anyone else who opens its URL gets a **404, not a 403**, so it doesn't announce
itself.

## Who is an admin

The first account, made by the setup flow, is the admin. Admins promote and
demote others from **Users**. Nobody can remove their own admin role, so an
instance always keeps at least the admin who is looking at the page. The role
can't be set at sign-up: it isn't a field any form accepts. Every admin action
checks the role again on the server; the menu entry is cosmetic.

## Overview

The landing tab, with a **Getting started** checklist for a fresh instance (set
up email, secure your admin account, invite someone) and the state of the
server: accounts, pending invites, whether sign-ups are open, email and receipt
reading set up, which sign-in factors are required, and the background jobs: how
many are queued, running, done and failed, with the latest failures and their
error.

A job that throws is tried up to five times in all, waiting longer each time (5
seconds, then 10, 20, 40). Only then does it count as failed. A failed email is
a failed job: this is where it shows up.

## Users

Every account, with its role, its sign-in factors and its sessions. For each
one, an admin can:

- **Make admin** or **Remove admin role**. They keep their account and groups.
- **Change email**: give the account another address, for someone who lost
  access to the old one. It must not belong to another account.
- **Reset two-factor and passkeys**: removes their authenticator app and every
  passkey and signs them out, for someone locked out of both. They sign in with
  their password or another method and set them up again.
- **Sign out everywhere**: every session on every device ends. They can sign in
  again.
- **Delete account**: their sign-in, sessions and security keys are deleted.
  This can't be undone. In their groups, their member stays as a plain name with
  its expenses, so nobody's balance changes.

Admins can't delete their own account from here.

## Invites

An invite is a link to create one account for one email address, valid 7 days
and usable once. With email set up, the invited person gets it by email;
without, copy the link and send it yourself. The invite page asks only for a
name and a password: the email is the invited one, already verified.

Pending invites can be revoked; the link stops working right away. An address
that already has an account can't be invited.

## Backup

**Backup** downloads the whole database as one SQLite file. The worker builds
it, so the file appears in the list when ready and stays for a day. It holds
every account, group and setting, so keep it as safe as the database itself, and
with `AUTH_SECRET`.

**Restore** takes such a file and replaces everything with it. The file is
checked first (it must be an OpenCount database, intact, from a version this
server knows) and migrated to the current schema; the rows are then swapped in
one transaction, so a bad file changes nothing. The job queue is kept. Everyone,
you included, signs in again afterwards. It can't be undone: download a backup
first.

## Access

- **Open sign-ups**: anyone who reaches the instance can create an account after
  confirming their email with a 6-digit code. Off, the default, means invite
  only. Sign-ups need email, so the switch refuses to turn on until SMTP is set
  up, and removing the email settings closes them again.
- **Require an authenticator app**: everyone, you included, must set up a
  6-digit code app before using OpenCount.
- **Require a passkey**: everyone must register at least one passkey.

A required factor applies on the next page load: anyone missing it is sent to
**Account, Security** until they add it.

## Sign-in methods, email and receipts

Each has its own page:

- [Sign-in and single sign-on](sign-in-and-sso): passwords, passkeys and OpenID
  Connect providers.
- [Email](email): the SMTP server.
- [Receipt reading](receipt-reading): Tesseract and its languages.

## Storage

All of it lives in the same SQLite file as the groups. Secrets (the SMTP
password, single sign-on client secrets) are encrypted with a key derived from
`AUTH_SECRET` and never sent back to the browser: their fields show whether one
is set, and stay empty to keep it.
