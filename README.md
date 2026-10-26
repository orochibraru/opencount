# OpenCount

Split expenses with friends, see who owes whom, settle up. An open-source,
self-hosted alternative to Tricount that installs on your phone as an app.

## Run it

OpenCount is one container and one SQLite file. The compose file in this repo
runs it:

```bash
export AUTH_SECRET="$(openssl rand -base64 32)"
docker compose up -d
```

Put it behind an HTTPS reverse proxy that sets `X-Forwarded-Proto` and
`X-Forwarded-Host`; the app takes its public origin from those. Without a proxy,
set `ORIGIN` to the URL you open (for example `http://192.168.1.10:3000`), or
every form submission is refused as cross-site.

Then open the app. A fresh instance walks you through creating the admin
account: enter the setup code printed in the container's log
(`docker compose logs opencount`, a line starting with `Setup code`), then your
email and a password. That first account is the admin; it can make others admins
later. From the admin area you can then invite people, set up SMTP, open
sign-ups, require an authenticator app or passkeys, and turn on receipt reading.

On a phone, use "Add to Home Screen" to install it.

### Receipt reading

Optional, and local: the image ships Tesseract with English, French, German,
Spanish and Italian. Turn it on in Admin, Receipts, and pick the languages your
receipts use. Photos are read by the background worker on your server; nothing
is sent anywhere. To ship other languages, build the image with
`--build-arg OCR_LANGUAGES="eng nld por"` (any Alpine `tesseract-ocr-data-*`
package name).

## Configuration

| Variable             | Default                  | Purpose                                                     |
| -------------------- | ------------------------ | ----------------------------------------------------------- |
| `AUTH_SECRET`        | none, required           | Signs sessions and encrypts stored secrets. Keep it stable. |
| `ORIGIN`             | from the proxy headers   | Public URL, needed only without an HTTPS proxy.             |
| `DATABASE_PATH`      | `/data/opencount.sqlite` | The SQLite file.                                            |
| `PORT`               | `3000`                   | HTTP port.                                                  |
| `LOG_LEVEL`          | `info`                   | `trace`, `debug`, `info`, `warn` or `error`.                |
| `LOG_FORMAT`         | `json`                   | `json` or `console`.                                        |
| `WORKER_CONCURRENCY` | `2`                      | Background jobs run at once.                                |

Every variable is declared, documented and validated in `src/env.ts`; the server
refuses to start with an invalid one and names it.

Everything else (SMTP, sign-ups, required sign-in factors, receipt reading) is
set in the admin area. Running from source, `mise install` brings Tesseract for
receipt reading (with every language pack); without mise, install it yourself
(`brew install tesseract tesseract-lang` or `apt install tesseract-ocr`).

### Homerun

`.homerun.json` deploys it on [Homerun](https://github.com/orochibraru/homerun)
with traces on. Homerun injects `OTEL_EXPORTER_OTLP_ENDPOINT`,
`OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES` and `SENTRY_DSN`, so requests,
page loads, form actions and background jobs show up as traces and unhandled
errors as issues, from the server and the worker alike. Any other OTLP/HTTP
collector or Sentry-protocol DSN works the same way; with neither set, nothing
is sent.

## Develop

```bash
mise run bootstrap
bun run dev
```

Without mise: `bun install`, copy `.env.example` to `.env` and set
`AUTH_SECRET`. The dev server starts the background worker itself.
`bun run build && bun run start` runs the compiled binaries locally, using
`ORIGIN` from `.env`.

## License

[MIT](LICENSE)
