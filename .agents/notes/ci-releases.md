# CI and releases

## Pull requests

- `pull_request.yaml` runs code quality (prek over every file, then the pre-push
  hooks), builds the image on native amd64 and arm64 runners and tags it
  `pr-<number>` on ghcr.io.
- A docs-only PR gets the checks but no image. A release PR (`releaser/release`)
  may only touch `CHANGELOG.md` and `package.json`'s version, and builds
  nothing.
- `CI Gate` is the one required check. `pr-title.yaml` enforces a Conventional
  Commit title, which squash merges turn into the commit releaser reads.
- `pr-cleanup.yaml` deletes `pr-<number>` from ghcr.io when a PR closes.

## Releases

- Every merge to `main` ships a canary: releaser computes `X.Y.Z-canary.N`,
  every commit type bumps. The merged PR's image is retagged when its
  `app.source-tree` label matches the commit's tree (only `APP_VERSION`
  changes), otherwise it's rebuilt. Tags: `X.Y.Z-canary.N` and `canary`.
- releaser keeps a `chore(release): X.Y.Z` PR open. Merging it retags the last
  canary as `X.Y.Z` and `latest`. Nothing is rebuilt.
- CI images live on ghcr.io (pushed with `github.token`); only published tags
  are copied to Docker Hub.

## One-time setup

- Secrets: `DOCKER_HUB_TOKEN` (Docker Hub mirroring) and `RELEASE_DEPLOY_KEY`
  (private half of a deploy key with write access, bypassing the branch and tag
  rulesets).
- `CI Gate` as the required check, squash merges only.
- The ghcr.io package starts private: make it public if anything outside the
  repo pulls it.
