# Household Finance Tracker

A database-first household finance workbook for Google Sheets, built entirely by
a versioned Google Apps Script so it can be recreated from scratch at any time
and later serve as the backend for a web app.

- **Raw tables** (Income, Transactions, Accounts, Debts, …) hold one record per
  row with stable IDs, first-of-month dates and soft deletion.
- **Derived sheets** (Monthly Summary, Monthly Budget/Plan, Savings & Reserves,
  Dashboard) are calculated from the raw tables and never duplicate data.
- **The Sheet stays usable on its own** — before Plaid, receipt AI or any app.

Schema version `3.0-rebuild-2026-11-07`. Full specification: [`docs/HANDOFF.md`](docs/HANDOFF.md).
What changed and why: [`docs/BUILD_NOTES.md`](docs/BUILD_NOTES.md).
Every table and column: [`docs/SCHEMA.md`](docs/SCHEMA.md).

## Create the workbook (about five minutes)

1. Go to [sheets.new](https://sheets.new) to create a blank Google Sheet. Name it anything (the script renames an "Untitled" sheet to *Household Finance Tracker*).
2. In the Sheet: **Extensions → Apps Script**.
3. In the editor, select everything in `Code.gs` and delete it.
4. Open [`dist/HouseholdFinanceTracker.gs`](dist/HouseholdFinanceTracker.gs) in this repo, click **Raw**, select all, copy, and paste into `Code.gs`. Save (Ctrl/Cmd + S).
5. In the toolbar's function dropdown choose **`buildWorkbookWithSample`** (or `buildWorkbookEmpty` for structure only) and click **Run**.
6. Google will ask for permission the first time. Choose your account → *Advanced* → *Go to … (unsafe)* → *Allow*. The script only touches this spreadsheet.
7. Wait one to two minutes (watch the *Execution log*). Switch back to the Sheet tab and reload it.
8. You now have 20 tabs and a **Finance Tracker** menu. Start on **Start Here**, then run **Finance Tracker → Run QA checks**.

If the run stops with "Exceeded maximum execution time", simply run it again — the build is idempotent.

Prefer the command line? `clasp clone` / `clasp push` works with the `apps-script/` folder directly (`appsscript.json` is included).

## What you get

| Tab | Function |
|---|---|
| Start Here | Instructions, review cadence, getting-started checklist |
| Dashboard | Monthly snapshot for the Selected Month + Current Flexible Spending for today's week |
| Income | Paycheck database (authoritative for gross, deductions, take-home) |
| Transactions | Master ledger, 32 columns A:AF, validation flags, split support, soft delete |
| Recurring Payments | Expected bills/subscriptions with monthly-equivalent summaries |
| Monthly Budget | Planned vs. actual by category (soft-deleted rows excluded) |
| Monthly Plan | One flexible target per month, Monday–Sunday weekly guidance |
| Monthly Summary | Calculated monthly results (read-only) |
| Savings & Reserves | Funds fed by Savings transactions, drawn by linked expenses |
| Debts / Quarterly Debt Review | Master debt table + quarterly balance snapshots, estimated interest |
| Net Worth Snapshots | History plus a live tracked-net-worth helper |
| Accounts | Your eight real accounts (balances blank) + tagged samples |
| Monthly Review | Month-end review rows pulling figures from Monthly Summary |
| Categories | Taxonomy and every dropdown list |
| App Setup | Architecture, settings, generated data dictionary |
| Sources | Guidance behind the design |
| Import Staging / Change Log | Ready for Plaid and audit logging |
| Credit Scores | Manual monthly history; Dashboard shows the latest per person |

### Finance Tracker menu

- **Run QA checks** — scans for formula errors and independently re-computes totals.
- **Link income deposits to paychecks** — fills `Source Income ID` where exactly one paycheck matches.
- **Split a transaction…** — turns a bank row into a Split Parent with balanced children.
- **Record net worth snapshot** — appends this month's row from Accounts + Debts.
- **Extend formula rows** — adds 500 calculated rows to every table.
- **Clear sample data…** — removes every row tagged `SAMPLE`.
- **Rebuild workbook (destructive)…** — wipes and rebuilds from the script.

## Repository layout

```
apps-script/        Source of truth (paste or clasp-push these)
  00_Config.gs      Tabs, colors, lists, taxonomy, column schema, formula templates
  10_Helpers.gs     Formula token resolver, table builder, validations, change log
  20_Reference.gs   Categories, Accounts, App Setup, Sources, Start Here
  30_Tables.gs      Conditional formatting, presentation sections, phase orchestration
  60_Dashboard.gs   Dashboard
  70_SampleData.gs  Tagged sample data generator
  80_QA.gs          In-sheet QA
  90_Main.gs        buildWorkbook, menu, onEdit, maintenance helpers
  95_Api.gs         Web-app (doPost) scaffold for the future app
  appsscript.json   Manifest (time zone, scopes, web app settings)
dist/HouseholdFinanceTracker.gs   Single paste-ready bundle (generated)
docs/HANDOFF.md     Original specification (verbatim)
docs/BUILD_NOTES.md Decisions, fixes, additions, open items
docs/SCHEMA.md      Generated data dictionary
scripts/bundle.sh   Rebuilds dist/ from apps-script/
scripts/gen-schema.js  Regenerates docs/SCHEMA.md from 00_Config.gs
scripts/test-build.js  Runs the build under Node against a mock Sheets API
scripts/mock-gas.js    The mock
```

## Development

```bash
node scripts/test-build.js   # execute the build against the mock, check structure & formulas
./scripts/bundle.sh          # regenerate dist/HouseholdFinanceTracker.gs
node scripts/gen-schema.js   # regenerate docs/SCHEMA.md
```

Edit `apps-script/*.gs`, run the three commands, commit all of it. The bundle
and schema are committed so the repo is always paste-ready.

## Connecting an app later

`95_Api.gs` exposes `doPost` with `ping`, `list`, `append`, `update` and
`softDelete`. Deploy it as a web app (execute as you, token-gated via
`setApiToken()`), and the browser talks JSON to Apps Script, which owns all
writes and validation. The app only ever touches raw tables; Monthly Summary,
Dashboard and calculated columns are read-only. Details: App Setup tab and
`docs/BUILD_NOTES.md`.
