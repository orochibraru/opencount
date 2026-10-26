# Install

OpenCount is distributed as a multi-arch Docker image
([`orochibraru/opencount`](https://hub.docker.com/r/orochibraru/opencount)) for
`linux/amd64` and `linux/arm64`. It needs one volume, mounted on `/data`, which
holds the SQLite database: every account, group and expense. Lose it and you
lose everything, so back it up ([Backups and upgrades](backups-and-upgrades)).

Run one container per database file. The server and its worker share it inside
the container; SQLite is not made to be shared between containers or hosts.

## Docker Compose

The repository ships a compose file for self-hosting. Download it into an empty
directory:

```bash
mkdir opencount && cd opencount
curl -fsSLO https://raw.githubusercontent.com/orochibraru/opencount/main/compose.prod.yaml
```

It runs `docker.io/orochibraru/opencount:latest` on port 3000 with a named
volume, `opencount`, on `/data`:

```yaml
services:
  opencount:
    image: docker.io/orochibraru/opencount:latest
    restart: unless-stopped
    ports:
      - 3000:3000
    volumes:
      - opencount:/data
    environment:
      AUTH_SECRET: ${AUTH_SECRET:?set AUTH_SECRET, e.g. openssl rand -base64 32}
      # The URL people open, like https://opencount.example.com.
      ORIGIN: ${ORIGIN:-}

volumes:
  opencount: {}
```

Write a `.env` next to it with a fresh secret and the URL people will open:

```bash
cat > .env <<EOF
AUTH_SECRET=$(openssl rand -base64 32)
ORIGIN=https://opencount.example.com
EOF
```

Keep that secret: it signs sessions and encrypts the SMTP password, the single
sign-on client secrets and the authenticator app secrets stored in the database.
Changing it signs everyone out and makes those unreadable. See
[Configuration](configuration).

Start it:

```bash
docker compose -f compose.prod.yaml up -d
```

Then read the setup code the server printed and open the URL:

```bash
docker compose -f compose.prod.yaml logs opencount
```

[First run](first-run) takes it from there.

## Docker run

The same thing without Compose:

```bash
docker run -d --name opencount -p 3000:3000 \
  -v opencount:/data \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e ORIGIN=https://opencount.example.com \
  docker.io/orochibraru/opencount:latest
```

Generate the secret once and keep it: running that line again with a new one
signs everyone out.

## HTTPS

Put it behind a reverse proxy that terminates TLS. Passkeys and installing the
app on a phone both need HTTPS, and browsers only treat `localhost` as secure
without it. The image already reads the public scheme and host from
`X-Forwarded-Proto` and `X-Forwarded-Host`; setting `ORIGIN` to the public URL
as well is harmless and makes the origin explicit.

On plain HTTP with no proxy, `ORIGIN` is required, for example
`http://192.168.1.10:3000`. Without it every form submission is refused as
cross-site. See [Configuration](configuration).

## Tags

| Tag      | What it is                                            |
| -------- | ----------------------------------------------------- |
| `latest` | The most recent stable release                        |
| `X.Y.Z`  | A specific stable release                             |
| `canary` | The latest build of `main`, ahead of the next release |

Pin an `X.Y.Z` tag if you want an upgrade to be a decision rather than a
restart.

## What is in the image

Alpine, the Tesseract OCR engine with English, French, German, Spanish and
Italian language data, Poppler to read PDF receipts, and two binaries:
`build/server`, the SvelteKit app compiled by
[`@sveltejs/adapter-bun`](https://svelte.dev/docs/kit/adapter-bun) with the Bun
runtime embedded, and `build/worker`, the background worker the server starts.
There is no Bun install and no `node_modules`. It runs as uid 1000.

`GET /api/health` answers `200 ok` while the server is up. The image's
`HEALTHCHECK` polls it every 30 seconds; orchestrators can probe it directly.

To ship other OCR languages, build the image yourself with a different list of
Alpine `tesseract-ocr-data-*` package suffixes:

```bash
docker buildx build --build-arg OCR_LANGUAGES="eng fra nld por" \
  -t opencount:latest .
```

## Homerun

The repository carries a `.homerun.json` manifest, so it deploys on
[Homerun](https://github.com/orochibraru/homerun) as is, with traces and error
reporting wired up. See [Logs, traces and errors](observability).
