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
| Financial Summary | Averages over the last N full months (B3), month by month, Savings & Reserves, Debts, Income by Person (averages), Payroll Deductions (averages), Credit Scores, Net worth | — | Columns A:I; `FinancialSummary.gs`, constants in `FINSUM` |
| Dashboard | This month only: tonight's balances (rows 3–7), expected gross (faded), expected take-home and spent so far for the Selected Month (B10), the flexible line, Current Flexible Spending, the review checklist | — | Columns A:I; accounts block A:D / F:I; three cards A:C / D:F / G:I; compact Income by Person and Credit Scores A:E; payroll groups A:C / D:F / G:I |
| Income | Paycheck database, authoritative for gross, deductions, take-home | 4 | A:S (S = Linked Deposit TX, calculated) |
| Transactions | Master ledger | 4 | A:AF, 32 columns; Validation Flag Z, Split Difference AE |
| Recurring Payments | Expected obligations with summaries | 40 | Presentation rows 1–38; raw table from row 41 |
| Monthly Budget | Planned vs. actual by category | 4 | Actual excludes soft-deleted rows |
| Monthly Plan | One flexible target per month, Monday–Sunday guidance | 4 | Weekly columns calculate for the current month only |
| Monthly Summary | Calculated monthly results, read-only | 4 | Month list is one array formula; warning-only protection |
| Savings & Reserves | Funds fed by Savings transactions | 4 | |
| Debts | Master debt table with estimated interest | 7 | KPI band rows 4–5 (Household Debt · Student Loans · All Debt …); Latest Balance from Quarterly Debt Review; Debt Group column keeps student loans separate |
| Quarterly Debt Review | Quarterly balance snapshots | 4 | |
| Net Worth Snapshots | History + live tracked-net-worth helper | 4 | Helper in columns M:N |
| Accounts | Bank, card, investment, retirement, asset accounts | 4 | ACC-006…ACC-013 are the real accounts; 3.1 adds External Account ID, Connection ID, Import Transactions?, Last Synced |
| Monthly Review | Month-end review rows | 4 | Figures pulled from Monthly Summary |
| Categories | Taxonomy A:H + every dropdown list from column J | 4 | Named ranges `LIST_<KEY>` |
| App Setup | Architecture, settings, generated data dictionary | — | Named cells `SETTING_CHANGE_LOG`, `SETTING_SAMPLE_PRESENT`, `QA_LAST_RUN`, `QA_LAST_RESULT` |
| Sources | Guidance behind the design | 4 | |
| Import Staging | Landing table for the bank feed; the owner's weekly review happens here | 4 | A:P from the handoff; 3.1 adds Status, suggested Type/Person/Fund/Debt, Matched Rule, Merchant, Bank Category, Pending Transaction ID, Paired Import ID, Imported At |
| Import Rules | Bank-description patterns → Type/Category/Subcategory/Spending Type, Auto-import?, Split Required? | 4 | Made from staged rows via the rule dialog |
| Connections | One row per bank login connected through Plaid | 4 | Item id, status, last sync/result/error, cursor; tokens live in Script Properties |
| Change Log | Append-only audit history | 4 | Written by onEdit, the import engine and the API |
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
| `apps-script/Import.gs` | Bank-import engine: rule matching, classification, transfer/card-payment pairing, pending→posted, removals, review import, rule dialog and split panel server functions |
| `apps-script/Plaid.gs` | Plaid client (UrlFetchApp), Hosted Link connect/repair flow, account mapping, nightly sync, balances, layout check, status, triggers |
| `apps-script/Upgrade.gs` | `upgradeWorkbook()`: brings a live workbook to the current schema without touching rows |
| `apps-script/Export.gs` + `ExportDialog.html` | *Copy financial snapshot for AI*: plain-text briefing built from entered columns, with a Copy button |
| `apps-script/SplitPanel.html` | Side panel: split a staged or recorded transaction into balanced children |
| `apps-script/RuleDialog.html` | Dialog: make an Import Rule from the selected staged row |
| `apps-script/ConnectDialog.html` | Dialog: connect a bank in three steps (kind → Plaid → map accounts) |
| `apps-script/Utilities.gs` | Utilities tab (Show dropdown, tiles, cost-by-month and year-over-year line charts, bill history) and `linkUtilityPayments_`, which files utility payments as bills |
| `apps-script/Spending.gs` | Spending tab: tiles, categories largest first (Children combined), recurring payments with paid-this-month, flexible subcategories, six months by category |
| `apps-script/Payoff.gs` | Payoff planner: reads debts and the saved plan, writes Planned Extra Payment / the household plan |
| `apps-script/PayoffPlanner.html` | Dialog: slider for extra payments, one debt or all debts (Avalanche / Snowball), save a plan |
| `apps-script/PayoffMath.html` | The payoff arithmetic (pure JS), included by the dialog and loaded by the Node tests |
| `apps-script/appsscript.json` | Manifest (time zone, scopes, web-app settings); optional, for clasp users |

## Settings (Script Properties, set by hand or by the connect flow)
| Property | Meaning | Example (fictional) |
| --- | --- | --- |
| `PLAID_CLIENT_ID` | From the Plaid dashboard (Developers → Keys) | `5f1e…` |
| `PLAID_SECRET` | The **Production** secret (the free Trial runs against Production) | `a9c3…` |
| `PLAID_ENV` | `production` (default) or `sandbox` | `production` |
| `PLAID_START_DATE` | First day imported; also sets how much history Plaid is asked for at connect time | `2026-11-01` |
| `PLAID_ACCESS_TOKEN_<Connection ID>` | Written by the connect flow, one per bank login; never typed by hand | `access-production-…` |
| `PLAID_PENDING_LINK` | Transient: the Hosted Link session in progress | (JSON) |
| `API_TOKEN` | Shared secret the web app must send; set by running `setApiToken()` | `3f9a…` (shown once) |

In-sheet settings live on App Setup: Change Log auto-capture, Sample data
present, and *Bank feed: auto-import detected transfers and card payments*.

## Triggers and menus (set up by hand)
- Simple trigger `onOpen`: adds the **Finance Tracker** menu — Import reviewed
  rows · Split the selected row… · Make a rule from the selected row… ·
  Re-apply rules to waiting rows · **Bank feed ▸** (Status · Set history start
  date… · Connect a bank… · Finish connecting · Repair a connection… · Sync
  now · nightly sync on/off) · Run QA checks · Link income deposits · Record
  net worth snapshot · Upgrade workbook (keeps data) · Extend formula rows ·
  Clear sample data… · Rebuild workbook….
- Simple trigger `onEdit`: when a hand edit lands in a change-logged table,
  appends a Change Log row (if the App Setup checkbox is on) and stamps
  Updated At / Updated By on Transactions; ticking Is Deleted sets Deleted At.
- Installable time trigger `syncAllConnections` (daily, ~5 AM
  America/Detroit): created by *Bank feed → Turn nightly sync on*, removed
  by *Turn nightly sync off*.
- Web app: deploy `Api.gs` as a web app (execute as the owner) only when the
  app is built; run `setApiToken()` once first. Plaid does not use the web
  app: Hosted Link runs on Plaid's own pages.

## Bank feed: how a transaction travels
1. Nightly, `syncAllConnections` calls `/transactions/sync` per Active
   connection (cursor-based; only accounts with *Import Transactions?* ticked
   are staged; balances are written for every mapped account).
2. `ingestItems_` lands new rows in Import Staging, classified by Import
   Rules (`classifyRow_`): a matching rule fills the suggestions; Auto-import
   rules make the row Ready, Split-required rules make it Needs Split;
   otherwise Needs Review. Rows dated before `PLAID_START_DATE` are skipped.
3. `pairTransfers_` pairs opposite movements between two owned accounts
   within 3 days: both sides Transfer, or (bank → credit card linked to a
   Debts row) Debt Payment + Transfer. Pairs are auto-imported when the App
   Setup setting is on.
4. Auto-import rows become Transactions at once (`promoteRows_`); the rest
   wait. The owner edits suggestions, ticks Reviewed?, runs *Import reviewed
   rows*; Needs Split rows go through the split panel.
5. A posted charge carrying `pending_transaction_id` supersedes its pending
   row (review work and status carried over; an already-imported pending
   row's transaction is updated in place). A transaction the bank removes is
   marked Removed and its transaction soft-deleted.
6. Before every write the layout check compares headers to the schema; a
   mismatch pauses that connection with a message in Last Error and the
   cursor is not advanced, so nothing is lost.

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
  Student loans (Debt Group = Student Loans) are totalled separately from
  household debt everywhere except net worth, which counts all debt.
- Sample data is removed only through Clear sample data…, never by rebuilding
  a workbook that holds real rows. Schema changes reach a live workbook only
  through `upgradeWorkbook()`.
- Lender data (Plaid Liabilities) is read with every sync for spending and
  loan connections and written into the Debts rows linked to those accounts
  (rate, minimum payment, due day, next due, last payment, status, original
  principal). Loan accounts always get a Debts row (`ensureDebtRowForLoan_`).
  PSLF counts are not available from Plaid; the owner types the official
  count and date, and formulas count months paid since.
- The Goals tab holds five free-text boxes (`GOAL_1`…`GOAL_5`); `readGoals_`
  / `restoreGoals_` carry them through rebuilds (from the Dashboard panel of
  an older build too). The Reminders tab's box (`REMINDERS_BOX`) is calculated
  from Debts and Credit Scores. `dueReminders_`
  lists hand-entered values that have gone stale (PSLF counts); the
  Dashboard Reminders box shows the same by formula and `sendReminders_`
  emails it at most monthly from the nightly sync.
- The Dashboard's accounts block (rows 3–7, layout in `DASH_ACCOUNTS`) is
  formulas over Accounts and Debts; every later Dashboard row sits
  `DASH.SHIFT` rows below its handoff position, and the upgrade reads the
  Selected Month and checklist through named ranges (legacy addresses as a
  fallback) before rebuilding.
- Expected Income (`ExpectedIncome.gs`): one row per person + employer,
  created from Income by `ensureExpectedIncome_` (frequency from pay-date
  gaps, typical amounts the median of the last three). Monthly Plan derives
  Flexible Target (auto) = expected take-home + adjustment − bills − debt
  payments − planned savings; Monthly Flexible Target is an override and
  Target in Use feeds Amount Available and the weekly guidance.
- Paste Import (`PasteImport.gs`): the owner pastes a tab-separated block
  (marker line, header line, rows) produced by a Claude skill in `skills/`;
  `importPastedRows_` validates, de-duplicates and writes rows to the table
  named in the marker. The skill never touches the Sheet.
- `autoFillRow_` (onEdit) gives a typed row its next ID, ticks Active on a
  new Recurring Payments row and fills Next Payment Date from Due Day.
- `ensureMonthRows_` (run by every sync) keeps a Monthly Plan row and the
  Monthly Budget rows for the current month in place.
- Each Plaid connection uses one of the free Trial slots permanently
  (`PLAID_TRIAL_LIMIT`, 20 on the owner's plan page): never
  disconnect-and-reconnect; repair with update mode; the connect dialog warns
  about institutions already connected. Plaid secrets and access tokens live
  only in Script Properties.
- Nothing reaches Transactions from the bank feed without either a rule that
  says Auto-import, a detected transfer/card-payment pair (setting), or the
  owner ticking Reviewed?.

## Manual setup steps in Google
1. Create a blank Google Sheet (sheets.new).
2. Extensions → Apps Script. Rename `Code.gs` to `Config` and paste
   `apps-script/Config.gs`; add a Script file for each remaining `.gs` file
   and an HTML file for each `.html` file in `apps-script/`, with the same
   names, and paste their contents. Save.
3. Choose `buildWorkbookWithSample` (or `buildWorkbookEmpty`) and Run; approve
   the permissions. It takes one to two minutes.
4. Reload the Sheet. Start on **Start Here**, then Finance Tracker → Run QA
   checks. The step-by-step version of this is the handoff page built from
   `handoffs/2026-11-07-initial-build.json`.
5. Bank feed: Project Settings → Script Properties → add `PLAID_CLIENT_ID` and
   `PLAID_SECRET`; Bank feed → Set history start date…; Connect a bank… once
   per institution (spending vs. investment kind); Turn nightly sync on. The
   step-by-step version is `handoffs/2026-11-07-bank-import.json`.
6. Later script updates: paste the changed files, then Finance Tracker →
   Upgrade workbook (keeps data). Never rebuild a workbook holding real data.
