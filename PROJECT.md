# PROJECT: Household Finance Tracker

## What it does
A Google Sheet for household finances that is built entirely by the Apps
Script in this repository. Raw records (paychecks, transactions, accounts,
debts, funds, credit scores) live in normalized tables with stable IDs; every
summary (Monthly Summary, budgets, weekly flexible-spending guidance, the
Dashboard) is calculated from them. The same tables are the data store for a
future web app, and the Sheet stays fully usable on its own.

## Where it runs
- Type: bound script (Extensions → Apps Script inside the tracker Sheet)
- Copy: the owner's personal Google account. There is no separate
  development copy yet; while the workbook holds only sample data, a rebuild
  is harmless. Once real data is entered, treat it as the work copy (see
  `AGENTS.md` section 2).
- Related: `docs/HANDOFF.md` is the specification this build implements;
  `docs/BUILD_NOTES.md` records decisions; `docs/SCHEMA.md` is the generated
  data dictionary.

## Sheet structure (names only, never data)
Twenty tabs, in this order. Full column lists are in `docs/SCHEMA.md` and on
the App Setup tab; both are generated from `Config.gs`.

| Tab | Purpose | Header row | Notes |
| --- | --- | --- | --- |
| Start Here | Instructions, review cadence, getting-started checklist | — | Presentation tab |
| Dashboard | Monthly snapshot for the Selected Month (B3) + Current Flexible Spending for today's week | — | Columns A:I; four cards A:H; compact Income by Person and Credit Scores A:E; payroll groups A:C / D:F / G:I |
| Income | Paycheck database, authoritative for gross, deductions, take-home | 4 | A:S (S = Linked Deposit TX, calculated) |
| Transactions | Master ledger | 4 | A:AF, 32 columns; Validation Flag Z, Split Difference AE |
| Recurring Payments | Expected obligations with summaries | 40 | Presentation rows 1–38; raw table from row 41 |
| Monthly Budget | Planned vs. actual by category | 4 | Actual excludes soft-deleted rows |
| Monthly Plan | One flexible target per month, Monday–Sunday guidance | 4 | Weekly columns calculate for the current month only |
| Monthly Summary | Calculated monthly results, read-only | 4 | Month list is one array formula; warning-only protection |
| Savings & Reserves | Funds fed by Savings transactions | 4 | |
| Debts | Master debt table with estimated interest | 7 | KPI band rows 4–5; Latest Balance from Quarterly Debt Review |
| Quarterly Debt Review | Quarterly balance snapshots | 4 | |
| Net Worth Snapshots | History + live tracked-net-worth helper | 4 | Helper in columns M:N |
| Accounts | Bank, card, investment, retirement, asset accounts | 4 | ACC-006…ACC-013 are the real accounts (blank balances) |
| Monthly Review | Month-end review rows | 4 | Figures pulled from Monthly Summary |
| Categories | Taxonomy A:H + every dropdown list from column J | 4 | Named ranges `LIST_<KEY>` |
| App Setup | Architecture, settings, generated data dictionary | — | Named cells `SETTING_CHANGE_LOG`, `SETTING_SAMPLE_PRESENT`, `QA_LAST_RUN`, `QA_LAST_RESULT` |
| Sources | Guidance behind the design | 4 | |
| Import Staging | Landing table for Plaid / CSV imports | 4 | Fingerprint and Duplicate? calculated |
| Change Log | Append-only audit history | 4 | Written by onEdit and the API |
| Credit Scores | Manual monthly history | 4 | No scores pre-filled |

## Code files
| File | Responsibility |
| --- | --- |
| `apps-script/Config.gs` | Tab names, colors, dropdown lists, category taxonomy, every table's columns, validations and formula templates, app rules. Change the schema here only. |
| `apps-script/Helpers.gs` | Formula token resolver, generic table builder, formats, validations, named ranges, row lookup/append, change-log writer |
| `apps-script/Reference.gs` | Categories (taxonomy + lists), Accounts, App Setup, Sources, Start Here |
| `apps-script/Tables.gs` | Conditional formatting per table, Recurring Payments and Debts presentation sections, Net Worth helper, phase orchestration |
| `apps-script/Dashboard.gs` | The Dashboard |
| `apps-script/SampleData.gs` | Fictional, date-relative sample data tagged `SAMPLE`; the list of tables it touches |
| `apps-script/QA.gs` | `runQA()` — error scan, structure checks, independent recomputation of totals |
| `apps-script/Main.gs` | `buildWorkbook()`, the Finance Tracker menu, `onEdit` change-log capture, maintenance helpers (link deposits, split, snapshot, extend rows, clear sample data) |
| `apps-script/Api.gs` | Web-app scaffold (`doGet`/`doPost`: ping, list, append, update, softDelete) for the future app |
| `apps-script/appsscript.json` | Manifest (time zone, scopes, web-app settings); optional, for clasp users |

## Settings (Script Properties, set by hand)
| Property | Meaning | Example (fictional) |
| --- | --- | --- |
| `API_TOKEN` | Shared secret the web app must send; set by running `setApiToken()` | `3f9a…` (shown once) |

Everything else is read from the spreadsheet itself. In-sheet settings live on
App Setup: Change Log auto-capture (checkbox) and Sample data present.

## Triggers and menus (set up by hand)
- Simple trigger `onOpen`: adds the **Finance Tracker** menu (Run QA checks ·
  Link income deposits to paychecks · Split a transaction… · Record net worth
  snapshot · Extend formula rows · Clear sample data… · Rebuild workbook…).
- Simple trigger `onEdit`: when a hand edit lands in a change-logged table,
  appends a Change Log row (if the App Setup checkbox is on) and stamps
  Updated At / Updated By on Transactions; ticking Is Deleted sets Deleted At.
  No trigger setup is needed.
- Web app: deploy `Api.gs` as a web app (execute as the owner) only when the
  app is built; run `setApiToken()` once first.

## Rules that must keep working
- Income is authoritative for paycheck gross, deductions and take-home;
  transaction deposits are for reconciliation only (Source Income ID links them).
- Spending = Expense − Refund, excluding soft-deleted rows. Savings, Debt
  Payment, Transfer and Split Parent rows never count as spending; split
  children do; a split parent's children must sum to its amount.
- A purchase paid from a sinking or emergency fund is still spending in the
  month it happens, and it reduces the fund.
- Dashboard cards, Income by Person and Payroll Deductions follow the Selected
  Month (B3). Current Flexible Spending always follows today's month and
  Monday–Sunday week. Only Spending Type = Flexible feeds weekly guidance.
- Months are stored as first-of-month dates; IDs are never renamed; raw tables
  have no merged cells; financial rows are never hard-deleted.
- Monthly Summary and the Dashboard are read-only for the app; the app writes
  only to raw tables and never to calculated columns.
- Debt stays off the everyday Dashboard apart from the one-line footnote.
- Sample data is removed only through Clear sample data…, never by rebuilding
  a workbook that holds real rows.

## Manual setup steps in Google
1. Create a blank Google Sheet (sheets.new).
2. Extensions → Apps Script. Rename `Code.gs` to `Config` and paste
   `apps-script/Config.gs`; add a Script file for each remaining file in
   `apps-script/` with the same name and paste its contents. Save.
3. Choose `buildWorkbookWithSample` (or `buildWorkbookEmpty`) and Run; approve
   the permissions. It takes one to two minutes.
4. Reload the Sheet. Start on **Start Here**, then Finance Tracker → Run QA
   checks. The step-by-step version of this is the handoff page built from
   `handoffs/2026-11-07-initial-build.json`.
