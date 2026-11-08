# Contributing

## Branches

- **`main`** is maintained by the repository owner only. It is not a pull request target; PRs opened against it are closed automatically.
- **`dev`** is where all work happens. Open your pull request against `dev`.

The owner decides which commits on `dev` are promoted to `main`, so a merged PR on `dev` is not a guarantee it will reach `main` or the published website.

## Making a change

1. Fork the repository and branch from `dev`.
2. Make the change and add or update tests.
3. Run the checks:
   ```bash
   npm install
   npm test
   npm run lint
   npm run test:site
   ```
4. If you add or change a component or Apex service, update [USAGE.md](USAGE.md) and give it an entry in `docs/catalog.js` (the website catalog), then list it under a goal in `docs/goals.js` so people can find it from the filter buttons. Run `npm run docs:readme` to refresh the "What's inside" list in the README (it is generated, so do not edit it by hand). `npm run test:site` fails if a piece has no catalog entry or no goal, an entry points at a file that does not exist, or the README list is stale.
5. Open a pull request **against `dev`**, and describe what it does and how you tested it.

## Notes

- Security-sensitive output (for example anything that exports user-entered Salesforce data) should be treated as untrusted; see `csvUtils` for how formula injection is handled.
- Apex tests need a Salesforce org to run (`sf apex run test`); Jest does not need one.
