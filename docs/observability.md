# Logs, traces and errors

OpenCount writes logs to the container's output, and can send traces to an
OpenTelemetry collector and errors to a Sentry-compatible service. Traces and
error reporting are off unless you configure them: with nothing set, no
telemetry leaves the server.

## Logs

```bash
docker compose -f compose.prod.yaml logs -f opencount
```

The server and the worker log to the same output, each line tagged with the part
of the app it comes from (`Server`, `Worker`, `Jobs`, `Auth`, `Setup` and so
on).

- `LOG_FORMAT=console`, the default, writes readable coloured lines. `json`
  writes one JSON object per line, for a log shipper.
- `LOG_LEVEL` is `info` by default. `debug` and `trace` add detail, like each
  finished job and how long it took.

Every request logs its method, path, status and duration, except static assets
and the health check. A 4xx or 5xx response other than a 404 logs at error
level.

An unexpected error shows the user a generic message with an **error id**, and
logs the real error and its stack with the same id. Match the two to find the
cause; the real message never reaches the browser.

## Health

`GET /api/health` answers `200 ok` while the server is up. The image's
`HEALTHCHECK` polls it every 30 seconds.

The worker has no port of its own. The server watches it and restarts it when it
exits: after a second, then doubling the wait up to 30 seconds while it keeps
crashing. A worker that ran for over a minute starts again from a second. Each
restart logs a warning. The worker in turn stops on its own if the server dies.

## Traces

Set `OTEL_EXPORTER_OTLP_ENDPOINT` to an OTLP/HTTP collector's base URL;
OpenCount appends `/v1/traces` and sends protobuf. Requests, page loads and form
actions are traced by SvelteKit, and each background job is a `job <type>` span
from the worker. Every span carries:

- `service.name`: `OTEL_SERVICE_NAME`, `opencount` by default;
- `service.version`: the running version;
- `opencount.process`: `server` or `worker`;
- whatever `OTEL_RESOURCE_ATTRIBUTES` adds, as `key=value` pairs separated by
  commas.

## Errors

Set `SENTRY_DSN` to a Sentry-protocol DSN (Sentry itself, GlitchTip, or anything
that speaks it) and every unexpected error is reported, from the server and the
worker alike, tagged with the process it came from. The error id shown to the
user is the event's id. `SENTRY_RELEASE` defaults to the running version and
`SENTRY_ENVIRONMENT` to `production`.

Errors a user causes, like a wrong password or an invalid form, are not
reported: they are answers, not failures.

## On Homerun

[Homerun](https://github.com/orochibraru/homerun) injects
`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME`, `OTEL_RESOURCE_ATTRIBUTES`
and `SENTRY_DSN` when traces are on, so the `.homerun.json` manifest in the
repository is all it takes.
