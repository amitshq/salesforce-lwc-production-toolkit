# Releasing

Only the repository owner releases. Day-to-day work lands on `dev`; a release is the owner promoting chosen commits to `main` and publishing a package version.

## Cutting a release

1. **Finish on `dev`.** `npm run lint`, `npm test` and `npm run test:site` pass, and the CI workflow is green.
2. **Update the release data** (this is what drives the website banner and its "live for N days" timer):
   - `docs/releases.js`:
     - `current` — the new version, its headline and its `highlights` (each links to catalog entries by id). Set `releasedAt` to the moment you publish: every "Live for N days" on the site counts from it, and a new `version` brings the banner back for visitors who dismissed the old one.
     - `history` — move the previous `current` here (version, `releasedAt`, headline, summary), newest first.
     - `upcoming` — the next version, its `targetAt` and what is planned, or `null` if nothing is. The banner and timeline show a live countdown to `targetAt`; once it passes without a release they say "overdue", so move the date or publish.
   - `CHANGELOG.md` — add the version's entry.
   - `npm version <x.y.z> --no-git-tag-version` — updates `package.json` and `package-lock.json`. `npm run test:site` fails if `package.json` and `docs/releases.js` disagree on the current version.
   - `sfdx-project.json` — update `versionName` / `versionNumber` (keep the `.NEXT` suffix).

   Check the result before publishing: `npm run test:site` validates the dates, versions and links. To see how the website will read later, open it with `?previewNow=+3d` (an offset in `d`, `h` or `m`) or `?previewNow=2026-11-01T09:00:00Z`; the banner and timers then run as if it were that moment.
3. **Promote to `main`** (owner only). Merge or cherry-pick the chosen `dev` commits, then tag it:
   ```bash
   git switch main
   git merge dev            # or cherry-pick the commits you want
   git tag v2.0.0
   git push origin main --tags
   ```
   GitHub Pages republishes the website from `main` `/docs`, so the banner goes live at this point.

## Publishing the installable package

Prerequisite: an authenticated Dev Hub (`sf org login web --set-default-dev-hub --alias devhub`).

Once, to create the package record (this also writes the package alias into `sfdx-project.json`; commit that change):

```bash
sf package create --name salesforce-lwc-production-toolkit --package-type Unlocked --path force-app --no-namespace --target-dev-hub devhub
```

For each release:

```bash
sf package version create --package salesforce-lwc-production-toolkit --installation-key-bypass --code-coverage --wait 30 --target-dev-hub devhub
sf package version promote --package salesforce-lwc-production-toolkit@2.0.0-1 --target-dev-hub devhub
```

Promotion requires at least 75% Apex code coverage. Put the resulting `04t…` id in the README install section so consumers can run:

```bash
sf package install --package 04t... --target-org <org> --wait 10
sf org assign permset --name LWCToolkitAdmin --target-org <org>
```

## Apex CI

`.github/workflows/apex-tests.yml` deploys the project to a fresh scratch org, runs every Apex test, keeps the JUnit results as a build artifact, and fails if coverage is under 85% (`COVERAGE_MINIMUM`; a package version needs 75% to be promoted). It runs on pushes to `dev`, on manual runs, and on pull requests to `dev` that a maintainer labels `run-apex`. Pull requests from forks are skipped, because they never receive secrets.

It is off until you set it up. Until it has run green once, treat the Apex as reviewed but untested.

1. **A Dev Hub.** Any org with Dev Hub enabled. A Developer Edition Dev Hub allows only a few active and daily scratch orgs, which is why there is no nightly run.
2. **Credentials, either way:**
   - **JWT (recommended, no long-lived token).** Create a private key and a self-signed certificate:
     ```bash
     openssl req -x509 -newkey rsa:2048 -nodes -keyout server.key -out server.crt -days 730 -subj "/CN=lwc-toolkit-ci"
     ```
     In the Dev Hub, create a connected app (or external client app) with OAuth enabled, upload `server.crt` under *Use digital signatures*, give it the `api`, `refresh_token, offline_access` and `web` scopes, set *Permitted Users* to *Admin approved users are pre-authorized*, and add the profile or permission set of the user CI will log in as. Then add three repository secrets: `SF_CLIENT_ID` (the consumer key), `SF_JWT_KEY` (the whole contents of `server.key`) and `SF_DEVHUB_USERNAME`. Keep `server.key` out of the repository.
   - **SFDX auth URL.** Add the secret `DEVHUB_SFDX_AUTH_URL`, the "Sfdx Auth Url" line of `sf org display --verbose --target-org <devhub>`. Simpler, but it is a long-lived refresh token.
3. **Turn it on.** Set the repository variable `APEX_CI_ENABLED` to `true`, then start it once by hand (Actions, *Apex tests (scratch org)*, *Run workflow*).

The coverage gate is `scripts/check-apex-coverage.js`, which reads the result `sf apex run test --code-coverage` writes; `npm run test:site` tests it.
