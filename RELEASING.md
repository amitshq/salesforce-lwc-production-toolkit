# Releasing

Only the repository owner releases. Day-to-day work lands on `dev`; a release is the owner promoting chosen commits to `main` and publishing a package version.

## Cutting a release

1. **Finish on `dev`.** `npm run lint` and `npm test` pass, and the CI workflow is green.
2. **Update the release data** (this is what drives the website banner and its "live for N days" timer):
   - `docs/releases.js` — set the new version's `releasedAt` to the publish date, and move the previous version into `history`. Fill in the next `upcoming` entry.
   - `CHANGELOG.md` — add the version's entry.
   - `npm version <x.y.z> --no-git-tag-version` — updates `package.json` and `package-lock.json`.
   - `sfdx-project.json` — update `versionName` / `versionNumber` (keep the `.NEXT` suffix).
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

## Apex CI (optional)

`.github/workflows/apex-tests.yml` deploys to a scratch org and runs the Apex tests. It stays off until you add the `DEVHUB_SFDX_AUTH_URL` secret and set the repository variable `APEX_CI_ENABLED` to `true`. It has not been run yet, so expect to adjust it the first time.
