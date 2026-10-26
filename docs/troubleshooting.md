# Troubleshooting

## The container exits at boot

Read the log: the server says why before it stops.

- **An environment variable is invalid.** The message names it. The usual one is
  `AUTH_SECRET must be at least 32 characters`: generate one with
  `openssl rand -base64 32`.
- **`set AUTH_SECRET`** from Compose itself: the `.env` next to
  `compose.prod.yaml` is missing or doesn't define it.
- **The database can't be migrated.** Either the volume isn't writable by uid
  1000, or the database was migrated by a build whose migrations this one
  doesn't have, unchanged. The message names the database and the migration's
  date; see
  [Backups and upgrades](backups-and-upgrades#why-migrations-are-append-only).

## Every form fails: "Cross-site POST form submissions are forbidden"

Pages render, but signing in, saving or adding anything answers 403. The origin
the browser sends doesn't match the one the server works out.

- **Plain HTTP with no proxy**: set `ORIGIN` to the exact URL you type, scheme
  and port included, like `http://192.168.1.10:3000`.
- **Behind a proxy**: make it send `X-Forwarded-Proto` and `X-Forwarded-Host`,
  or set `ORIGIN` to the public URL.

See [Configuration](configuration#origin).

## I lost the setup code

Restart the container and it prints a new one, or use **Code expired? Print a
new one** on the setup screen, at most once a minute. A code lasts 15 minutes
and five wrong tries. Look for `Setup code` in the log.

## The setup screen sends me to sign-in

An account already exists, so setup is closed for good. If you never made one,
someone else reached the instance first: stop it, delete the volume, and start
again behind access control until the admin account is yours.

## Sign-ups won't turn on

They need email, to send the verification code. Set up SMTP in **Admin, Email**
first; see [Email](email).

## Invites and codes never arrive

Check **Admin, Overview**: a failed email is a failed job, with the SMTP
server's error. Send yourself a test from **Admin, Email**. Meanwhile, an invite
link can always be copied from **Admin, Invites** and sent by hand.

## Passkeys aren't offered

Browsers only expose passkeys in a secure context: HTTPS, or `localhost`. Serve
the instance over HTTPS. The same goes for installing it on a phone.

## Single sign-on fails after the provider

The redirect URI registered with the provider must match the one on **Admin,
Sign-in methods** exactly. It is built from `ORIGIN` when set; behind a proxy
without it, check the proxy forwards the public host. A brand new person also
needs sign-ups open, or an invite first. See
[Sign-in and single sign-on](sign-in-and-sso).

## Everyone was signed out and email stopped working

`AUTH_SECRET` changed. Sessions signed with the old one are void, and the
secrets encrypted with it (SMTP password, single sign-on client secrets,
authenticator apps) can't be read. Put the old value back if you have it;
otherwise enter the SMTP password and client secrets again, and have people set
up their authenticator app again.

## Repeating expenses didn't appear

The worker adds them at boot and daily just after midnight UTC, and the server
log shows `Added repeating expenses` with a count each time. If it never shows,
look for the worker restarting in a loop. A paused rule adds nothing until
resumed; see [Repeating expenses](recurring-expenses).

## Scan a receipt is missing, or a PDF won't read

The button only shows when an admin turned receipt reading on, and only when
adding an expense. **Admin, Receipts** says whether Tesseract and its languages
are installed, and whether PDFs can be read, which needs Poppler. See
[Receipt reading](receipt-reading).

## Reading the logs

```bash
docker compose -f compose.prod.yaml logs -f opencount
```

Set `LOG_LEVEL=debug` for more. An error page shows an **Error ID**; the same id
is on the log line with the real error. See
[Logs, traces and errors](observability).
