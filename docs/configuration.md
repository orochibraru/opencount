# Configuration

There is no configuration file. The container reads a few environment variables
at boot, and everything else (sign-ups, sign-in methods, email, receipt reading)
is set by an admin in the app and stored in the database.

Every variable is declared and validated in one place. The server refuses to
start with an invalid value and names it, rather than running half configured.

## Required

| Variable      | Default | What it does                                   |
| ------------- | ------- | ---------------------------------------------- |
| `AUTH_SECRET` | none    | Signs sessions and encrypts the stored secrets |

`AUTH_SECRET` must be at least 32 characters. Generate one with
`openssl rand -base64 32` and keep it with your backups.

It signs session cookies and, through keys derived from it, encrypts what the
database must not hold in clear: the SMTP password, single sign-on client
secrets and authenticator app secrets. Changing it signs everyone out, and those
secrets can no longer be read: an admin has to enter the SMTP password and the
client secrets again, and everyone has to set up their authenticator app again.

## Origin

| Variable          | Default in the image | When you need it                            |
| ----------------- | -------------------- | ------------------------------------------- |
| `ORIGIN`          | unset                | Plain HTTP with no proxy; harmless anywhere |
| `PROTOCOL_HEADER` | `x-forwarded-proto`  | Your proxy sends the scheme in another one  |
| `HOST_HEADER`     | `x-forwarded-host`   | Your proxy sends the host in another one    |
| `ADDRESS_HEADER`  | unset                | To see the client's IP, not the proxy's     |
| `XFF_DEPTH`       | unset                | With `ADDRESS_HEADER: x-forwarded-for`      |
| `PORT`            | `3000`               | To listen on another port                   |
| `BODY_SIZE_LIMIT` | `256M`               | To accept bigger or smaller uploads         |

Every form post is checked against the app's public origin, and a mismatch is
refused with `403 Cross-site POST form submissions are forbidden`. OpenCount
takes that origin from the request: the scheme and host your proxy forwards in
`X-Forwarded-Proto` and `X-Forwarded-Host`. When those headers are missing, the
server assumes `https`.

So behind an HTTPS reverse proxy that sets both headers, it just works. On plain
HTTP with no proxy, set `ORIGIN` to the exact URL people type, scheme and port
included, like `http://192.168.1.10:3000`; the check then accepts it too.
Setting `ORIGIN` behind a proxy does no harm, and it also fixes the base URL of
invite links and single sign-on callbacks.

`PROTOCOL_HEADER`, `HOST_HEADER`, `ADDRESS_HEADER`, `XFF_DEPTH`, `PORT` and
`BODY_SIZE_LIMIT` belong to the Bun adapter; its
[documentation](https://svelte.dev/docs/kit/adapter-bun#Environment-variables)
lists the rest. Only trust forwarded headers when every request reaches the
server through a proxy you control.

## Database

| Variable        | Default in the image     | What it does    |
| --------------- | ------------------------ | --------------- |
| `DATABASE_PATH` | `/data/opencount.sqlite` | The SQLite file |

The image keeps the database on its `/data` volume. Outside the image the
default is `./data/opencount.sqlite`, relative to the working directory. The
directory is created when missing. Migrations run at every boot, before the
worker starts; see [Backups and upgrades](backups-and-upgrades).

## Background worker

| Variable                  | Default | Range        | What it does                            |
| ------------------------- | ------- | ------------ | --------------------------------------- |
| `WORKER_CONCURRENCY`      | `2`     | 1 to 32      | Background jobs run at once             |
| `WORKER_POLL_INTERVAL_MS` | `1000`  | 100 to 60000 | How often the worker looks for due jobs |

The worker sends emails, adds repeating expenses, builds backups and exports,
imports Tricounts and prunes finished jobs and old downloads. The defaults suit
any instance; there is rarely a reason to touch them.

## Logging

| Variable     | Default in the image | Values                                    |
| ------------ | -------------------- | ----------------------------------------- |
| `LOG_LEVEL`  | `info`               | `trace`, `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | `console`            | `json`, `console`                         |

`json` writes one object per line for a log shipper; `console` writes coloured
lines for a terminal, and is the default outside the image.

## Version

| Variable      | Default                  | What it does                                     |
| ------------- | ------------------------ | ------------------------------------------------ |
| `APP_VERSION` | set by the release build | Shown in the footer, sent with traces and errors |

## Traces and errors

| Variable                      | Default       | What it does                                       |
| ----------------------------- | ------------- | -------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | unset         | OTLP/HTTP collector base URL; traces are off unset |
| `OTEL_SERVICE_NAME`           | `opencount`   | `service.name` on every span                       |
| `OTEL_RESOURCE_ATTRIBUTES`    | unset         | Extra resource attributes, `key=value,key=value`   |
| `SENTRY_DSN`                  | unset         | Where errors are reported; off when unset          |
| `SENTRY_RELEASE`              | `APP_VERSION` | Release attached to reported errors                |
| `SENTRY_ENVIRONMENT`          | `production`  | Environment attached to reported errors            |

With none of them set, no telemetry leaves the server. See
[Logs, traces and errors](observability).

## Outbound calls

Besides your SMTP and single sign-on servers, the server calls three services,
and only when someone uses the feature: `api.frankfurter.dev` for the exchange
rate of an expense in another currency, `api.tricount.bunq.com` to import a
Tricount from its share link, and `api.enablebanking.com` for bank sync. Block
them and those features fail, nothing else.

## Set in the app, not here

- Sign-ups, required authenticator apps or passkeys: [The admin area](admin).
- Password and passkey sign-in, single sign-on providers:
  [Sign-in and single sign-on](sign-in-and-sso).
- The SMTP server: [Email](email).
- Receipt reading and its languages: [Receipt reading](receipt-reading).
