# Build Notes — 3.0 rebuild (2026-11-07)

This records what the rebuild does, where it deliberately departs from the
handoff, which known defects it fixes, and what is still open. Read alongside
`docs/HANDOFF.md` (the original specification) and `docs/SCHEMA.md` (generated
data dictionary).

## How the workbook is produced

The workbook is built by a Google Apps Script bound to a blank spreadsheet
(`apps-script/*.gs`, bundled into `dist/HouseholdFinanceTracker.gs`). The
script is the single source of truth: `00_Config.gs` holds tab names, colors,
dropdown lists, the category taxonomy and the column schema of every table;
every other module reads from it. The data dictionary on the App Setup tab and
`docs/SCHEMA.md` are generated from the same object, so they cannot drift.

Build order follows the handoff's phases: reference tables → core raw tables →
import infrastructure → derived reporting → Dashboard → QA. The build is
idempotent: re-running it wipes and recreates every tab.

## Defects from the handoff that are fixed

| # | Handoff item | Fix |
|---|---|---|
| 1 | Dashboard Federal Tax amount/% formulas lost | All seven deduction rows (Federal, State/Local, SS & Medicare, Health, Retirement, Other, Total) are generated from one list for Ben, Valerie and Household, so no row can be dropped by a layout edit. `Deduction | Amount | % of Gross` headers are emitted for all three groups; QA checks both. |
| 2 | Monthly Budget Actual ignored soft deletes | `Actual` now includes `Is Deleted <> TRUE` on both the Expense and Refund SUMIFS, matching Monthly Plan and Monthly Summary. |
| 3 | Source Income ID linking/validation unfinished | Validation Flag now raises `Missing Source Income ID` (Income-type rows), `Source Income ID Not Found`, `Deposit Does Not Match Take-Home` and `Income ID Linked More Than Once`. Income gets a calculated `Linked Deposit TX` column. Menu action **Link income deposits to paychecks** fills the link automatically when exactly one paycheck matches by take-home amount (±$0.01), date (±5 days) and deposit account. |
| 6 | Split transactions required manual row creation | Menu action **Split a transaction…** converts a bank row into a Split Parent and creates balanced child rows. |
| 11 | Child Expenses taxonomy combined areas | Normalized to Child Care, Clothing, Medical, Activities, Education, Supplies, Toys, Other. |

## Deliberate additions (all additive; nothing from the handoff was removed)

- **Income · S `Linked Deposit TX`** (calculated) — shows the linked deposit or "Unlinked".
- **Debts · K `Balance As Of`** (calculated) — date of the quarterly review that supplied Latest Balance. Latest Balance falls back to Original Balance until a review exists.
- **Quarterly Debt Review · J `Tracked Payments (Transactions)`** (calculated) — Debt Payment transactions in the quarter, for reconciling with statement payments.
- **Monthly Review** — adds `Total Savings`, qualitative columns (`What Went Well`, `What to Adjust`, `Next Month Focus`), `Reviewed By`, `Reviewed On`, `Notes`. "Savings" / "Savings Rate" are implemented as *Cash* Savings / Cash Savings Rate (Monthly Summary D and G) with Total Savings (K) alongside.
- **Net Worth Snapshots · K `Notes`** and a live "Current Tracked Net Worth" helper (columns L:M) implementing Tracked Assets − Unlinked Credit-Card Liabilities − Reviewed Debt Liabilities.
- **Import Staging** — `Fingerprint` and `Duplicate?` are calculated (duplicate = same fingerprint seen earlier in staging, or an identical account/date/amount already in Transactions, unless the row was already imported).
- **Credit Scores** — Dashboard shows "No score yet" until a row exists; no scores are invented.
- **Validation Flag** — adds Missing Date / Type / Amount, Subcategory-Does-Not-Match-Category, Parent-Must-Be-Type-Split-Parent and Parent-Transaction-ID-Not-Found on top of the handoff's rules.
- **Change Log** — a simple `onEdit` trigger appends one row per hand edit to any change-logged table (toggle: App Setup → "Change Log auto-capture"). It also stamps `Updated At`/`Updated By` on Transactions and sets `Deleted At` when `Is Deleted` is ticked.
- **Menu "Finance Tracker"** — Run QA checks · Link income deposits · Split a transaction… · Record net worth snapshot · Extend formula rows · Clear sample data… · Rebuild workbook…
- **API scaffold (`95_Api.gs`)** — `doPost` with `ping / list / append / update / softDelete`, token-gated, writes only to raw tables, never to calculated columns, and logs to Change Log. Untested against a live deployment; it is a starting point for the web app.

## Implementation choices worth knowing

- **Formula rows are pre-filled to a cap** (Transactions 1,004; Income 504; others see SCHEMA.md). Aggregations use open ranges (`$D$5:$D`) so totals never depend on the cap. Use *Extend formula rows* when a table approaches its cap; the app should locate the next row by the ID column (helpers `nextEmptyRow_` / `writeRows_`).
- **Checkbox columns** (`Is Deleted`, `Recurring?`, `Active?` …) use checkbox validation without pre-filled FALSE values, so empty rows stay empty for row detection. Formulas treat blank as not-deleted (`"<>TRUE"`).
- **`N()` guards** wrap numeric inputs in calculated columns so a blank Amount/Planned/Target yields 0 instead of `#VALUE!`.
- **Weekly guidance** (`Suggested This Week`) uses `LET` and the handoff's algorithm: Monday of the current week (clamped to the month start), Sunday capped at month end, spending before the week deducted from the target, remainder spread across remaining days.
- **Monthly Summary month list** is a single array formula over the months present in Income, Transactions, Monthly Plan and Monthly Budget; the other columns are per-row formulas guarded by `IF(month="","",…)`.
- **Reviewed Debt Balance** (Monthly Summary H) = sum of Ending Balance for the most recent Quarter End on or before month end (the handoff's literal definition).
- **Dashboard fund rows** use `INDEX(range, k)` rather than fixed row references so deleting fund rows (e.g. clearing sample data) cannot produce `#REF!`.
- **Raw tables contain no merged cells** (title rows are filled, not merged). Dashboard, Recurring Payments summary, Debts KPI band, Start Here and App Setup use merges, as the handoff allows for presentation areas.
- **Protection** on Monthly Summary and Dashboard is warning-only (the Selected Month cell and checklist checkboxes are left editable).
- **Styling** follows the handoff: navy `#17324D` headers, teal `#1F6F78` section bars, Ben cream / Valerie peach / Household blue-gray across Income, Income by Person and Payroll Deductions; card colors as specified; category fills on the Category cell only; status colors `#EAF6EE/#24563A` and `#F8D5DA/#842029`. No colored fonts to mark inputs vs. formulas.

## Sample data

Generated relative to the build date (three previous months plus the current month to date) so the Dashboard's current-week section has data on any build date. Every row carries `SAMPLE` in Notes (Transactions also `Created By = sample-data`). It covers all acceptance scenarios: fixed and flexible expenses, savings transfers, debt payments, an account transfer, a refund, a planned-irregular purchase from a sinking fund, an unexpected purchase from the emergency fund, a balanced three-way split with a Split Parent, a soft-deleted duplicate, and one intentionally uncategorized pending row. The eight real accounts (ACC-006…ACC-013) are always written with blank owner/balance. No credit scores, property or real debts are invented. **Clear sample data…** removes only tagged rows.

## QA

`runQA()` (menu → Run QA checks; also run at the end of every build) scans every tab for `#REF!/#VALUE!/#DIV/0!/#N/A/#NAME?/#NUM!/#ERROR!`, verifies headers, validations and the no-merge rule for every table, then re-computes in plain JavaScript — from the raw rows, excluding soft-deleted ones — monthly spending/savings/debt/income/deposits, budget actuals, flexible spent and the current-week guidance, fund balances, debt balances, split balance, validation flags, Dashboard cards, payroll Federal Tax and totals for all three groups, the current-month label and latest credit scores, and compares them with the formula results.

`scripts/test-build.js` runs the whole build under Node against an in-memory mock of the Sheets API (`scripts/mock-gas.js`). It catches runtime errors, unresolved tokens, unbalanced formulas, unknown function names, bad sheet references and schema mismatches. The mock does not evaluate formulas; formula correctness is what the in-sheet QA covers.

## Still open (unchanged from the handoff)

- Plaid integration (Import Staging is ready; nothing writes to it yet).
- Receipt OCR/AI (schema, Receipt Reference and the split helper are ready).
- Real balances, owners, debts, funds, flexible targets and credit scores must be entered by the household.
- The web app itself — `95_Api.gs` is a scaffold, not a deployed service.
