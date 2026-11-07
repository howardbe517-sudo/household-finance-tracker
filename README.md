# Household Finance Tracker

A database-first household finance workbook for Google Sheets, built and
maintained by the Google Apps Script in this repository, so it can be recreated
from scratch at any time and later serve as the backend for a web app.

- **Raw tables** (Income, Transactions, Accounts, Debts, …) hold one record per
  row with stable IDs, first-of-month dates and soft deletion.
- **Derived sheets** (Monthly Summary, Monthly Budget/Plan, Savings & Reserves,
  Dashboard) are calculated from the raw tables and never duplicate data.
- **The Sheet stays usable on its own** — before Plaid, receipt AI or any app.

Code and fictional data only. `AGENTS.md` holds the rules every coding agent
follows; `CLAUDE.md` imports it.

| Read this | For |
| --- | --- |
| `PROJECT.md` | What the tool does, where it runs, sheet structure, code files, rules that must keep working |
| `STATUS.md` | What works, known issues, what is next, tested here vs. still to test in Google |
| `CHANGELOG.md` | Each change with the exact files to paste into Apps Script |
| `docs/HANDOFF.md` | The original specification (schema `3.0-rebuild-2026-11-07`) |
| `docs/BUILD_NOTES.md` | Decisions, defects fixed, additions, open items |
| `docs/SCHEMA.md` | Generated data dictionary: every table, column, type, dropdown and formula |

## Layout

```
apps-script/        One file per responsibility; each is pasted into Apps Script under the same name
  Config.gs         Tabs, colors, dropdown lists, taxonomy, column schema, formula templates (change the schema here only)
  Helpers.gs        Formula token resolver, table builder, validations, named ranges, change log
  Reference.gs      Categories, Accounts, App Setup, Sources, Start Here
  Tables.gs         Conditional formatting, presentation sections, phase orchestration
  Dashboard.gs      Dashboard
  SampleData.gs     Fictional, date-relative sample data tagged SAMPLE
  QA.gs             In-sheet QA (runQA)
  Main.gs           buildWorkbook, Finance Tracker menu, onEdit, maintenance helpers
  Api.gs            Web-app (doPost) scaffold for the future app
  Import.gs         Bank-import engine: rules, classification, pairing, review import, split panel, rule dialog
  Plaid.gs          Plaid feed: Hosted Link connect/repair, nightly sync, balances, layout check
  Upgrade.gs        upgradeWorkbook(): schema upgrades for a live workbook, never deletes
  Export.gs         Copy financial snapshot for AI (plain-text briefing) + ExportDialog.html
  SplitPanel.html   Side panel to split a transaction into balanced children
  RuleDialog.html   Dialog to make an Import Rule from a staged row
  ConnectDialog.html  Dialog to connect a bank in three steps
  appsscript.json   Manifest (optional; for clasp users)
handoffs/           Step-by-step handoff page specs (JSON), one per change
tests/              run-tests.js executes the build against mock-sheet.js (a mock of the Sheets API)
fixtures/           Fictional data policy (the sample data is generated, not stored)
scripts/            build-handoff.js, gen-schema.js, safety-check.sh
docs/               Specification, build notes, generated schema
```

## How a change reaches Google

1. An agent makes the change on a branch and opens a pull request. The pull
   request runs the safety check and the Node tests.
2. Review the diff and merge it.
3. Open the handoff page the agent published (its spec is in `handoffs/`) and
   follow the steps: it has a Copy button for every file that changed and the
   checks to do in the Sheet. `CHANGELOG.md` lists the same files.
4. Paste those complete files into the Apps Script editor and save.

A fix made directly in the Apps Script editor is not finished until the same
file has been pasted back here and committed.

## First build

The handoff page built from `handoffs/2026-11-07-initial-build.json` walks
through it. In short: blank Sheet → Extensions → Apps Script → nine files pasted
under their own names → run `buildWorkbookWithSample` → reload → Finance
Tracker → Run QA checks. Never run the build on a Sheet that already holds real
data (see `AGENTS.md` section 2).

## Development

```bash
node tests/run-tests.js                                   # build against the mock; structure and formula checks
node scripts/gen-schema.js                                # regenerate docs/SCHEMA.md from Config.gs
bash scripts/safety-check.sh origin/main                  # what the pull-request check runs
node scripts/build-handoff.js handoffs/<spec>.json out.html   # build a handoff page to publish
```

## Connecting an app later

`Api.gs` exposes `doPost` with `ping`, `list`, `append`, `update` and
`softDelete`. Deploy it as a web app (execute as the owner, token-gated via
`setApiToken()`), and the browser talks JSON to Apps Script, which owns all
writes and validation. The app only ever touches raw tables; Monthly Summary,
Dashboard and calculated columns are read-only. Details: App Setup tab and
`docs/BUILD_NOTES.md`.
