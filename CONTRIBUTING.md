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
   ```
4. If you add or change a component, update [USAGE.md](USAGE.md) and the feature map in [README.md](README.md).
5. Open a pull request **against `dev`**, and describe what it does and how you tested it.

## Notes

- Security-sensitive output (for example anything that exports user-entered Salesforce data) should be treated as untrusted; see `csvUtils` for how formula injection is handled.
- Apex tests need a Salesforce org to run (`sf apex run test`); Jest does not need one.
