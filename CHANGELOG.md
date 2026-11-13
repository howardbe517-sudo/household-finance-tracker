# CHANGELOG

## 2026-11-13 — Guard: a per-paycheck amount must be a real number
- What happened: the two Accounts columns were added to the owner's Sheet
  ahead of the upgrade and copied the date format of the column beside
  them, so the amounts read back as dates. `Number(date)` is a timestamp in
  the millions, which the next sync would have added to the balances. The
  cell format was corrected in the Sheet before any sync ran.
- Fix: `creditPayrollDeposits_` accepts only real numbers as per-paycheck
  amounts (both places the setting can live); anything else counts as
  blank. `BUILD_VERSION` 1.17.1.
- Files changed in `apps-script/`: `IncomeDeposits.gs`, `Config.gs`
  (deployed on merge). Nothing to run beyond the pending upgrade.
- Tested: Node (a date in the amount cell adds nothing; suite green;
  safety check).
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/payroll-amount-guard`

## 2026-11-13 — One paycheck can feed several accounts (HSA, 457, 401(k))
- Why: the owner's school paycheck pays into three accounts the bank feed
  cannot reach: the HSA, a 457 and a 401(k) (the stub lists the employee
  and employer amounts). The 3.14 setting on Expected Income allowed one
  account per paycheck.
- Schema 3.15: two columns appended to Accounts, **Payroll Deposit From
  (Source ID)** and **Payroll Deposit per Paycheck** (employer
  contributions included). `creditPayrollDeposits_` reads these and, as
  before, the Expected Income columns from 3.14; an account and paycheck
  set in both places counts once, with the Accounts amount. A source ID
  not on Expected Income is reported in the sync message.
- `readTable_` now reads a tab that has not had the upgrade yet (fewer
  columns than the schema) and treats the missing columns as blank, and
  `writeRows_` widens such a tab before writing. Before this, deploying a
  new column could stop the nightly sync until the owner ran the upgrade.
- `SCHEMA_VERSION` 3.15-payroll-per-account-2026-11-13, `BUILD_VERSION`
  1.17.0.
- Files changed in `apps-script/`: `Config.gs`, `Helpers.gs`,
  `IncomeDeposits.gs`, `Reference.gs` (deployed on merge). Run **Upgrade
  workbook** once; step page `handoffs/2026-11-13-payroll-per-account.json`.
- In the Sheet (not in the repository): the 457 and 401(k) were added to
  Accounts with their balances from the plan site, and the three accounts
  were given their paycheck source and per-paycheck amounts from the stub.
- Tested: Node (several accounts from one paycheck, no double count when
  set in both places, unknown source reported, a narrower tab read with
  blanks; 279 checks; safety check). Not yet confirmed in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/payroll-deposits-per-account`

## 2026-11-13 — Coffee shops tracked on their own
- Why (the owner's request): coffee at a coffee shop is a different kind
  of spending from groceries and snacks, and the owner wants to see coffee
  spending separately. It stays in the Food category.
- Taxonomy: Food / Coffee & Snacks is replaced by **Food / Coffee Shops**
  and **Food / Snacks** (both Want, Flexible). On a live workbook the
  upgrade adds the two (if missing) and unticks Active? on Coffee & Snacks;
  rows that still use it keep reading. Coffee Shops appears as its own line
  in "Where the flexible money went" on the Spending tab, with its typical
  month, and in the hover lists.
- `BUILD_VERSION` 1.16.1. No schema change (taxonomy rows only).
- Files changed in `apps-script/`: `Config.gs`, `SampleData.gs` (deployed
  on merge). The next **Upgrade workbook** applies it; nothing else to do.
- In the Sheet (not in the repository): the two Categories rows were added
  and Coffee & Snacks unticked; the coffee-shop transactions, staged rows
  and rules (Lyon Street Cafe, Wildroast) moved to Coffee Shops, and
  Nantucket Baking, the vending machine and Martha's Pizza to Snacks.
- Tested: Node (taxonomy has both, Coffee & Snacks gone, sample data and
  rule-dialog tests use Coffee Shops; 277 checks; safety check).
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/coffee-shops-and-snacks`

## 2026-11-13 — HSA balance grows with each paycheck until HealthEquity connects
- Why (the owner's request): HealthEquity will not connect to the bank feed.
  The owner will give the HSA balance once; each paycheck from one employer
  puts a set amount into the HSA through payroll, and the balance should
  follow that. Withdrawals the owner adjusts by hand.
- Schema 3.14: two columns appended to Expected Income, **Payroll Deposit
  To (Account ID)** and **Payroll Deposit per Paycheck**. Delivered by the
  upgrade; nothing renamed or reordered.
- `creditPayrollDeposits_()` (in `IncomeDeposits.gs`): for every account
  named in Payroll Deposit To that the bank feed does not update (no
  Connection ID), each paycheck on Income for that person and employer
  dated after the account's Last Updated (and not after today) adds the
  per-paycheck amount to Current Balance; Last Updated then moves to the
  newest of those pay dates, so nothing is added twice. Runs with every
  sync, the upgrade and after pasted stubs. Changes go to the Change Log.
  Pure helper `payrollDepositPlan_`.
- Typing a Current Balance by hand on an account with no Connection ID now
  sets its Last Updated to today (onEdit), so counting starts from the
  typed balance. Accounts the feed updates are not touched.
- `SCHEMA_VERSION` 3.14-payroll-deposit-2026-11-13, `BUILD_VERSION` 1.16.0.
- Files changed in `apps-script/`: `IncomeDeposits.gs`, `Config.gs`,
  `Main.gs`, `Plaid.gs`, `Upgrade.gs`, `PasteImport.gs`, `Reference.gs`
  (deployed on merge). Run **Finance Tracker → Upgrade workbook (keeps
  data)** once; step page `handoffs/2026-11-13-hsa-payroll-deposits.json`.
- In the Sheet (not in the repository): the employer's Expected Income row
  points at the HSA account with the per-paycheck amount from the stub; the
  HSA row on Accounts says how it works. The HSA balance itself is still
  to be entered.
- Tested: Node (plan rules, an account credited once per paycheck, a
  second run adds nothing, connected accounts untouched, typed balance
  resets Last Updated, columns appended; 276 checks; safety check). Not
  yet confirmed in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/payroll-deposit-to-account`

## 2026-11-13 — Fix: an empty month window counted as one month; one hover note per tile
- What happened: the two cells that count the months with spending (the
  Compare with window on Spending, row 112, and the flexible window on the
  Financial Summary, row 15) used COUNTUNIQUE over a FILTER. When the
  window holds no transactions, FILTER returns its "nothing found" error,
  and COUNTUNIQUE counts that error as one value. With transactions only
  from November, both cells read 1 instead of 0. Effects in the owner's
  Sheet: Typical Month and the tiles' typical figures showed $0 instead of
  a dash; Flexible Spending (average) on the Financial Summary showed $0
  instead of this month so far, so Likely Left Over was too high by the
  month's flexible spending.
- Fix: both cells use `IFERROR(ROWS(UNIQUE(FILTER(…))),0)`, which returns 0
  for an empty window. The test suite now fails if COUNTUNIQUE appears in
  any formula. Run QA already compares the Spending count with
  Transactions and would have reported it after a QA run.
- Hover notes: each Spending tile now carries one note, on its big number.
  The same note on the label, number and small line showed as three
  triangles and looked like three different notes.
- `BUILD_VERSION` 1.15.1. No schema change.
- Files changed in `apps-script/`: `Spending.gs`, `FinancialSummary.gs`,
  `Config.gs` (deployed on merge). Run **Finance Tracker → Upgrade
  workbook (keeps data)** once; step page
  `handoffs/2026-11-13-month-count-fix.json`.
- Tested: Node (no COUNTUNIQUE in any formula, the count cells use the new
  form, one note per tile; 272 checks; safety check). The faulty count was
  seen in the owner's Sheet (read through the Sheets connection); the fix
  is not yet confirmed there.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/fix-month-count-and-notes`

## 2026-11-12 — Financial Summary: coming in, going out, left over; one household debt figure
- Why (the owner's request): the four 3-month average cards are no longer
  needed now that the Spending tab carries the averages. The summary
  should say at a glance what comes in each month, what is typically
  spent, and what is likely left over. On debt: one household figure with
  the debts listed underneath (so the car loan shows), no student-loan
  split, keep estimated monthly interest and total minimum payments, and
  drop "Current Quarter Ends" from the Debts tab.
- Financial Summary, rows 10–13: four cards replace the averages.
  - Coming In (typical month): the sum of Typical Month Take-Home on
    Expected Income, with each person's share in the small line.
  - Fixed Costs: active Recurring Payments outside the Loans group, plus
    the Monthly Plan's debt-payment figure, plus the average gas, electric
    and water bill over the last 12 months of Utility Bills (those vary,
    so they are not on Recurring Payments).
  - Flexible Spending (average): spending not marked Fixed, averaged over
    the months among the last six full ones that have any spending. Until
    one exists it shows this month so far and says so.
  - Likely Left Over: coming in − fixed − flexible; red below zero; the
    small line says how much of it is planned savings.
  The months control for the sections further down (income by person,
  payroll deductions, children) moved to row 14, its window cells to row
  15 (`FINSUM.MONTHS_CELL` B14, `WINDOW_ROW` 15); named ranges follow.
- Financial Summary, Debts: three cards (Household Debt = every debt on
  the Debts tab, Estimated Monthly Interest, Total Minimum Payments), then
  a list of each debt with a balance or a payment (balance, rate,
  minimum, estimated interest, next due), largest first. The Student
  Loans and All Debt cards are gone. Every row below moved down 12
  (`FINSUM` constants).
- Debts tab band: four boxes (Household Debt, Estimated Monthly Interest,
  Total Minimum Payments, PSLF Progress). Household / Student Loans / All
  Debt became one total and Current Quarter Ends is removed; the upgrade
  empties the boxes that no longer exist. A loan kept on the tab with no
  balance (PSLF count only) adds nothing to the total.
- Not changed: no table, column, header or named range renamed; Monthly
  Summary, Monthly Review and the AI snapshot still keep student loans
  apart where they did.
- Run QA: the averages check is replaced by one that recomputes the four
  cards (`typicalFlexible_`, `averageUtilities_`, the tables) and compares.
- `BUILD_VERSION` 1.15.0. No schema change.
- Files changed in `apps-script/`: `FinancialSummary.gs`, `Tables.gs`,
  `QA.gs`, `Reference.gs`, `Config.gs` (deployed on merge). Run **Finance
  Tracker → Upgrade workbook (keeps data)** once; step page
  `handoffs/2026-11-12-spending-this-month.json`.
- Tested: Node (card formulas, debt section and list, Debts band incl.
  an upgrade from the seven-box band, the two pure helpers; 271 checks;
  safety check). Not yet confirmed in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/summary-in-out-left`

## 2026-11-12 — Rent counts as a fixed cost from the 1st: bills that record themselves
- Why (the owner's request): rent never changes and should show in Spending
  as a fixed amount every month. It is paid by Venmo, in one payment or
  several, and the bank description for Venmo says nothing, so no rule can
  recognise it and Housing showed only the electric bill.
- Schema 3.13: one column appended to Recurring Payments, **Record
  Automatically?** (`autoRecord`, checkbox, last column). Delivered by
  `upgradeWorkbook`; nothing renamed or reordered.
- New `RecurringAuto.gs`. `recordRecurringBills_()` handles every active
  Monthly row that is ticked:
  - on or after the due day it writes one Expense to Transactions for the
    month (the bill's Category and Subcategory, Spending Type from the
    category defaults), marked "Recorded automatically … [REC-id|yyyy-mm]";
  - that entry holds only what real payments have not covered: real
    Expenses (minus Refunds) in the same month, Category and Subcategory
    reduce it, and once they reach the Amount the entry is soft-deleted
    (Is Deleted + Deleted At, never removed). If a payment is later moved
    to another subcategory, the entry is restored for the uncovered part.
    The month therefore counts the bill once: the Amount, or the real
    payments if they come to more.
  - it reconciles this month and the two before it; past months are never
    back-filled. Weekly and other non-monthly rows are skipped and named
    in the report. Changes are written to the Change Log.
- Runs with every sync, the upgrade, after reviewed rows are imported, and
  from `onEdit` when a relevant Recurring Payments or Transactions cell is
  edited (so ticking the box records the bill at once).
- Paid This Month? on the Spending tab and the recurring hover list now
  count real payments only (an automatic entry is not a payment) and add
  part payments together.
- `SCHEMA_VERSION` 3.13-auto-record-2026-11-12, `BUILD_VERSION` 1.14.0.
- Files changed in `apps-script/`: `RecurringAuto.gs` (new), `Config.gs`,
  `Spending.gs`, `Plaid.gs`, `Upgrade.gs`, `Import.gs`, `Main.gs`,
  `Reference.gs` (deployed on merge). Run **Finance Tracker → Upgrade
  workbook (keeps data)**, then tick the box on the Rent row; step page
  `handoffs/2026-11-12-spending-this-month.json`.
- In the Sheet (not in the repository): the Rent row now names the paying
  account and how it works; the Venmo payment of November 2 that the owner
  had marked Housing was given the rent subcategory so it imports as a
  rent payment.
- Tested: Node (plan for a month, create once, second run adds nothing,
  part payment shrinks the entry, full payment soft-deletes it, a
  recategorized payment restores it, weekly rows skipped, the paid check
  ignores automatic entries; 265 checks; safety check). Not yet confirmed
  in Google: the first real run is the owner's upgrade and tick.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/record-rent-automatically`

## 2026-11-12 — Hover lists on the Spending tiles
- Why (the owner's request): hovering over Fixed vs flexible, Needs vs wants
  or Recurring bills should show what is behind the number, and the lists
  must stay current.
- What changed: `refreshSpendingNotes_()` writes a note on each of the three
  tiles (label, number and small line, so hovering anywhere on the tile
  works). Fixed vs flexible and Needs vs wants list, for the Selected
  Month, each group's total and its subcategories largest first with who
  was paid; anything with no Spending Type or Need/Want yet is listed under
  its own heading. Recurring bills lists every active row of Recurring
  Payments by group with amount, frequency, due day and whether this
  month's payment has been seen. The text comes from the pure function
  `spendingNoteTexts_`. Notes are refreshed by every sync (nightly and Sync
  now), by the upgrade and a new build, after reviewed rows are imported,
  and from `onEdit` when the Month (Spending!B3), a relevant Transactions
  cell or any Recurring Payments cell is edited. Each note says when it was
  written. Only notes are written; no cell value changes.
- `BUILD_VERSION` 1.13.1. No schema change.
- Files changed in `apps-script/`: `Spending.gs`, `Main.gs`, `Plaid.gs`,
  `Upgrade.gs`, `Import.gs`, `Reference.gs`, `Config.gs` (deployed on
  merge). Run **Finance Tracker → Upgrade workbook (keeps data)** once (the
  same run as for 1.13.0); step page
  `handoffs/2026-11-12-spending-this-month.json`.
- In the Sheet (not in the repository): a Recurring Payments row for the
  nanny, weekly, so childcare is counted in the monthly plan's bills.
- Tested: Node (note text for all three tiles, refunds, deleted rows and
  other months left out, unmarked rows listed, inactive bills left out,
  notes written to the tile cells, a new bill appears after a refresh; 259
  checks). Not yet confirmed in Google: notes written from the simple
  `onEdit` trigger.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/spending-hover-notes`

## 2026-11-12 — Two tabs instead of three: Spending is "this month", Financial Summary is "where you stand"
- Why (the owner's request): the Dashboard's month view belongs with
  spending, and its balances belong with the summary. The owner also asked
  for averages beside the running month, a sideways bar graph of average
  spending by category, and no "on pace" projection, because months differ
  too much (summer against work months) for a projection to mean much.
- Spending tab (rebuilt, `SPEND` rows changed): the Selected Month is typed
  here now (B3). Top to bottom: review banner, Expected Take-Home and Spent
  So Far, how the flexible figure is reached, three tiles, Current Flexible
  Spending (follows today), categories beside a Typical Month with Used and
  a bar that fills toward the typical month (red past it), recurring
  payments, flexible subcategories, six months by category, Average
  spending by category (one sideways bar per category, largest first), the
  Monthly Review Checklist.
- Typical month: a new dropdown, Compare with (E3), chooses the months that
  are averaged: last 3, 6 or 12 full months, or the same three months one
  year back (for seasons). Months with no spending are skipped, never
  counted as zero; a dash shows until one full month exists. The 3-Month
  Avg and Share columns are gone. Nothing on the tab predicts.
- Financial Summary: the accounts block (checking, savings split into yours
  and parked for bills, each card with owed and due, total owed) is now
  rows 3–8. Every other row moved down 7 (`FINSUM` constants; the months
  input is B10, the window cells row 11).
- Dashboard tab: retired. A new workbook has none. On an existing workbook
  the upgrade reads the Selected Month and checklist ticks, rebuilds
  Spending, writes them back, and then empties and hides the old Dashboard
  tab (`retireDashboard_`, which runs only once the Selected Month's named
  range points at Spending). The tab is hidden, not deleted; the owner can
  delete it by hand.
- Names and schema: no table, column or header changed. Named ranges keep
  their names and move: `DASH_SELECTED_MONTH` → Spending!B3,
  `DASH_CHECKLIST` → Spending!A101:A108. New: `SPEND_COMPARE` (Spending!E3).
  `TAB_ORDER` no longer lists Dashboard (29 tabs). `SHEETS.DASH` remains so
  the old tab can be found. The `sh.clear()` in `retireDashboard_` carries a
  SAFETY-APPROVED note: the tab is calculated and its two inputs are
  already on Spending when it runs.
- Run QA: the month-card, banner and flexible-label checks read the
  Spending tab; the accounts-block check reads the Financial Summary; a new
  check recomputes the typical month from Transactions in JavaScript
  (`typicalMonth_`) and compares it with the tab.
- `BUILD_VERSION` 1.13.0. Start Here, App notes, PROJECT.md and AGENTS.md
  wording updated to match.
- Files changed in `apps-script/`: `Spending.gs`, `Dashboard.gs`,
  `FinancialSummary.gs`, `Upgrade.gs`, `Main.gs`, `QA.gs`, `Config.gs`,
  `Reference.gs`, `Plaid.gs`, `Payoff.gs` (deployed on merge). Run
  **Finance Tracker → Upgrade workbook (keeps data)** once; step page
  `handoffs/2026-11-12-spending-this-month.json`.
- Tested: Node (253 checks: new layout, inputs under their named ranges,
  Compare with window formulas, typical-month table, average bars, no pace
  wording, `typicalMonth_`, upgrade from a workbook that still has a
  Dashboard tab carries month, ticks and Compare with and hides the tab;
  safety check). Not yet confirmed in Google: the mock does not evaluate
  formulas, so the new Spending formulas (MAP/LAMBDA, SPARKLINE, the
  Compare with window) are first exercised by the owner's upgrade; Run QA
  covers the cards, the typical month and the accounts block there.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/spending-is-this-month`

## 2026-11-12 — Reminder: a fresh pay stub per employer every six months
- Why: paychecks now count from the bank deposit, and the stub is what the
  gross pay and deductions are estimated from. The owner asked for a
  reminder about every six months to upload one so the deductions stay
  right.
- What changed: `dueReminders_()` (menu, monthly email) and the Reminders
  tab formula list each regular paycheck (an active Expected Income row)
  whose last real pay stub is older than the setting, or that has none.
  Rows made from a bank deposit do not count as stubs. New App Setup
  setting "Pay stub reminder after (months, per regular paycheck)",
  default 6, named `SETTING_PAYSTUB_REMINDER_MONTHS`, kept across upgrades.
  New pure helper `latestStubDate_`. Start Here mentions the reminder.
  `BUILD_VERSION` 1.12.1. No table schema change; one new named range.
- Files changed in `apps-script/`: `Plaid.gs`, `Dashboard.gs`,
  `IncomeDeposits.gs`, `Reference.gs`, `Upgrade.gs`, `Config.gs` (deployed
  on merge). Run **Finance Tracker → Upgrade workbook (keeps data)** once
  (the same run as for 1.12.0 if that has not been done yet); step page
  `handoffs/2026-11-12-income-from-deposits.json`.
- Tested: Node (due after six months, not due with a recent stub, follows
  the setting, deposit-made rows ignored, no stub at all is due, inactive
  paychecks never asked for, formula and setting present). Not yet
  confirmed in Google: the Reminders tab formula uses MAP/LAMBDA with a
  wildcard MAXIFS, which the mock does not evaluate.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/paystub-reminder`

## 2026-11-12 — Paychecks count from the bank deposit; no pay stub needed
- Why: the owner will not upload every pay stub. Income is counted only
  from the Income tab, so until now a paycheck that reached checking did
  not count (and raised "Missing Source Income ID" in QA) until a stub was
  entered and matched to it.
- What changed: new `IncomeDeposits.gs`. `ensureIncomeFromDeposits_()` runs
  on every sync, on Upgrade workbook, after "Import reviewed rows", and
  from the existing menu item "Link income deposits to paychecks". For each
  Income-type transaction with no Source Income ID (not pending, not
  soft-deleted) it first links an exact stub match as before, then adds an
  Income row and writes its ID into the transaction:
  - known employer (the employer's name is in the bank description, or the
    same description was linked to that employer before): take-home is the
    deposit to the cent; gross pay and each deduction are scaled from the
    most recent real stub for that person and employer;
  - any other Income deposit: recorded at the deposit amount, no
    deductions, Income Type from the subcategory.
  Every such row says "From bank deposit TX-…" in Notes.
- Safeguards: a deposit within three days of an unlinked stub from the
  same employer whose take-home differs is held and reported, not counted
  twice. Rows made from a deposit never create an Expected Income row, so
  a one-off deposit cannot raise the expected income. A pay stub pasted
  later for the same paycheck is written over the deposit-made row (same
  Income ID, link kept) instead of adding a second paycheck; the preview
  and the confirmation say so. An Import Rule of type Income now applies
  only to money coming in, so a purchase at a shop that shares an
  employer's name is never imported as pay. Adds rows only; no entered
  paycheck is changed. Safe to run again.
- Also: stub matching reads take-home through one helper
  (`incomeTakeHome_`); Start Here and the Income tab note describe the new
  flow. `BUILD_VERSION` 1.12.0. No schema change.
- Files changed in `apps-script/`: `IncomeDeposits.gs` (new), `Plaid.gs`,
  `Upgrade.gs`, `Import.gs`, `Main.gs`, `PasteImport.gs`,
  `ExpectedIncome.gs`, `Reference.gs`, `Config.gs` (deployed on merge).
  Run **Finance Tracker → Upgrade workbook (keeps data)** once; step page
  `handoffs/2026-11-12-income-from-deposits.json`.
- In the Sheet (not in the repository): two Import Rules so the two
  payroll deposits on checking import as Income on their own.
- Tested: Node (employer matching incl. apostrophes, shortened words, the
  other person's rule and learned descriptions; the estimate equals the
  deposit to the cent; estimated and plain rows; pending and deleted
  deposits skipped; held deposit; second run adds nothing; stub replaces
  the estimate and keeps ID, link and formula columns; no Expected Income
  row from a one-off deposit; Income rule ignored on a purchase; 240
  checks green). Not yet run in Google: the first real run happens on the
  owner's next upgrade or sync.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/income-from-deposits`

## 2026-11-12 — Fix: a Dashboard card matched by one name added up every card
- What happened: since 1.9.5 each accounts-block line tests the bank name
  with `(ISNUMBER(SEARCH(name, institution)) + …) > 0`. With two names the
  `+` makes numbers; with one name it compared TRUE/FALSE with 0, and in
  Sheets a boolean is greater than any number, so FALSE>0 is TRUE and the
  line matched every account of its type. Capital One (one name) showed
  the sum of all three cards and the card total doubled it. Checking and
  Savings (also one name) were right only because there is one of each.
  Accounts, Debts and net worth were never wrong.
- Fix: every name test adds `+0` before the comparison (one helper,
  `namesHit`, now builds all three uses). Run QA gains a check that
  recomputes each card line, checking, and the savings bank balance from
  the Accounts rows and compares them with the Dashboard cells, so a wrong
  formula in this block is reported. `BUILD_VERSION` 1.11.5.
- Files changed in `apps-script/`: `Dashboard.gs`, `QA.gs`, `Config.gs`
  (deployed on merge). Run **Finance Tracker → Upgrade workbook (keeps
  data)** once.
- Tested: Node (no bare boolean comparison left in any Dashboard formula;
  the Capital One formula carries `+0`; suite green). The mock does not
  evaluate formulas, which is why this reached the Sheet; the new QA check
  covers it there. Not yet confirmed in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/dashboard-single-name-fix`

## 2026-11-12 — Fix: the upgrade stopped on the Utilities tab ("Those columns are out of bounds")
- What happened: 1.11.2 trimmed the Utilities tab to nine columns when the
  chart numbers moved under the charts, but the column-width list still had
  eleven entries. Google refused the width for column 10, so the upgrade
  stopped after clearing the tab and left it blank. No data was affected:
  the bills live on Utility Bills. The Node mock did not check widths
  against the sheet size, so the tests passed.
- Fix: the width list has nine entries. The mock now throws, as Google
  does, when a column width or row height is set outside the sheet; with
  the old code it reproduces the error. `BUILD_VERSION` 1.11.4.
- Files changed in `apps-script/`: `Utilities.gs`, `Config.gs` (deployed on
  merge). Run **Finance Tracker → Upgrade workbook (keeps data)** again; it
  redraws the Utilities tab and finishes the steps the failed run skipped.
- Tested: Node (suite green; the old code fails with the same message under
  the stricter mock). Not yet confirmed in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/utilities-width-fix`

## 2026-11-12 — Utilities charts: every month labelled, each line in its own colour
- What changed: (1) the cost-by-month chart printed every third month on
  its axis; the month column is now text ("Jul 25") and the axis is told to
  print every label, slanted, so each bill has its month. (2) Sheets leaves
  an empty column out of a chart and renumbers the remaining lines, so a
  utility shown alone took the first colour in the list (Electric drew in
  the gas colour). New `refreshUtilityChartColors_` sets the colours for
  the lines actually drawn: on rebuild, after a sync files a bill, and from
  `onEdit` when Show (B3) changes. The year-over-year chart's current-year
  line takes the selected utility's colour. `BUILD_VERSION` 1.11.3.
- Files changed in `apps-script/`: `Utilities.gs`, `Main.gs`, `Config.gs`
  (deployed on merge). Run **Finance Tracker → Upgrade workbook (keeps
  data)** once.
- Tested: Node (text month labels and the axis option; colours for All,
  one utility, and a utility with no bills; suite green). Not yet seen in
  Google: the slanted labels and the recolouring when Show is changed.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/utilities-month-labels`

## 2026-11-12 — Utilities: the chart numbers move under the charts
- What changed: the calculated chart data sat to the right of the tab
  (columns L onward), which the owner found awkward. It is now two styled
  tables under the charts: **cost by month** in columns A onward and
  **this year vs last year** from column G, with the bill history below
  them. The charts read the tables in their new place; nothing is left to
  the right of column I. `BUILD_VERSION` 1.11.2.
- Files changed in `apps-script/`: `Utilities.gs`, `Config.gs` (deployed on
  merge). Run **Finance Tracker → Upgrade workbook (keeps data)** once; the
  same run shortens the Show dropdown to gas, electric and water.
- Tested: Node (table positions, chart ranges, nothing right of the tab;
  suite green). Not yet seen in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/utilities-data-below`

## 2026-11-12 — Utilities tab tracks only the bills that change each month
- What changed: the owner only wants variable bills on the Utilities tab.
  It now tracks **Gas, Electric and Water & Sewer** (`UTILITY_TRACKED`):
  the Show dropdown offers only those, the chart has a line only for those,
  and the sync files only those payments as bills. Internet, phone and
  trash payments are no longer filed on Utility Bills; they stay on
  Recurring Payments and the Spending tab. The Utility Types list itself is
  unchanged. `BUILD_VERSION` 1.11.1.
- Files changed in `apps-script/`: `Config.gs`, `Utilities.gs`,
  `Reference.gs` (deployed on merge). Run **Finance Tracker → Upgrade
  workbook (keeps data)** once to redraw the tab.
- Tested: Node (dropdown has no Internet, Phone or Trash; only gas,
  electric and water sample payments are filed; suite green). Not yet seen
  in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/utilities-variable-only`

## 2026-11-12 — Fees: card processing fees and late fees totalled for the year
- What changed: the owner wants the cost of paying by card noted in the
  yearly picture. (1) Utility Bills gains two appended columns, **Card Fee**
  (what a payment ran over its bill; the sync fills it in when it matches
  the payment) and **Late Fee** (typed or loaded from statements; Amount
  stays the bill's own charges). (2) Two new subcategories under
  Miscellaneous, **Card & Processing Fees** and **Late Fees**, for fees
  that are their own transaction or are split off another payment.
  (3) The Financial Summary gains a **Fees** block above Net worth: card
  and processing fees, late fees, bank fees and their total, for this year
  and for the last 12 months, plus the estimated yearly interest on debts
  as a separate line that is not added into the total.
- Schema: two appended columns on Utility Bills, two taxonomy rows (added
  by the upgrade). `SCHEMA_VERSION` 3.12-fees-2026-11-12, `BUILD_VERSION`
  1.11.0. `docs/SCHEMA.md` regenerated.
- Files changed in `apps-script/`: `Config.gs`, `FinancialSummary.gs`,
  `Reference.gs`, `Utilities.gs` (deployed on merge). Run **Finance
  Tracker → Upgrade workbook (keeps data)** once (the pending run covers
  it).
- Tested: Node (fee written to Card Fee on a match, the Fees block
  formulas, the new subcategories on the Categories tab; suite green). Not
  yet seen in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/fees-tracking`

## 2026-11-12 — Utility payments a few dollars over the bill still match it
- What changed: paying a utility by card can add a flat processing fee, so
  the payment on the card runs a few dollars over the bill. The match in
  `linkUtilityPayments_` now also accepts a payment up to $5 (or 3%) over
  the bill; the bill keeps its own amount and the difference is written to
  its Notes. Without this, such a payment was filed as a second bill.
  `BUILD_VERSION` 1.10.1.
- Files changed in `apps-script/`: `Utilities.gs`, `Config.gs` (deployed on
  merge). Nothing extra to run beyond the pending Upgrade workbook.
- Tested: Node (a payment $2.99 over its bill completes it, amount kept,
  fee noted; suite green). Not yet seen in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/utility-fee-match`

## 2026-11-12 — Utilities tab and Utility Bills table
- What changed, following the owner's approved mockup. (1) New raw table
  **Utility Bills** (`TABLES.UTIL`): one row per bill with utility,
  provider, due date, billing period end, days billed, amount, status
  (Paid / Due), paid date, transaction ID, and calculated month and cost
  per day. New lists `UTILITY_TYPES` (Gas, Electric, Water & Sewer, Trash
  & Recycling, Internet, Phone, Other) and `BILL_STATUSES`. (2) New
  **Utilities** tab (fifth, after Spending): a **Show** dropdown in B3
  (All utilities or one utility, named `UTIL_SHOW`, kept by the upgrade)
  that every tile, chart and table follows; tiles for the next bill, the
  last 12 months, the average per month and the latest bill against a year
  earlier; a **cost by month** line chart (one line per utility, a dotted
  total line when showing all) and a **this year vs last year** line chart,
  both real Sheets charts drawn from calculated data to the right of the
  tab; and the bill history, newest first, with cost per day and the change
  from a year earlier. (3) `linkUtilityPayments_` runs on every sync, on
  the upgrade and after the sample data: each Transactions expense whose
  subcategory is Natural Gas, Electric, Water & Sewer, Trash & Recycling,
  Internet or Cell Phone, and that no bill names yet, completes the bill of
  the same utility within $1 (or 1%) and 25 days, or adds a paid bill.
  (4) Past bills can come in from statements through the paste window
  (`PASTE_IMPORT.tables.UTIL`, deduplicated by utility, due date and
  amount). Sample bills are tagged SAMPLE and cleared with the rest.
- Schema: new table and two lists, added by the upgrade; no existing
  header or column changed. `SCHEMA_VERSION` 3.11-utilities-2026-11-12,
  `BUILD_VERSION` 1.10.0. `docs/SCHEMA.md` regenerated.
- Also done by hand in the owner's Sheet: Import Rule RULE-023 (DTE ENERGY
  → Housing / Natural Gas, auto-import).
- Files changed in `apps-script/`: new `Utilities.gs`; `Config.gs`,
  `Main.gs`, `Plaid.gs`, `Reference.gs`, `SampleData.gs`, `Tables.gs`,
  `Upgrade.gs` (deployed on merge). Run **Finance Tracker → Upgrade
  workbook (keeps data)** once; the owner's DTE statement history is then
  loaded into Utility Bills from the Sheet side (not stored here).
- Tested: Node (30 tabs in order; the Show dropdown, its named range and
  the formulas that follow it; two line charts; sample bills filed and
  tagged; a payment completes its Due bill, an unmatched payment adds a
  bill, a second run changes nothing; paste-import spec; upgrade of an
  older workbook adds the table and tab). Not yet seen in Google: the
  charts' look and legends.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/utilities-tab`

## 2026-11-12 — Dashboard counts each card once
- What changed: the Independent Bank card line showed the Elan card twice
  ($550.80 for a $275.40 balance). The line adds up every card whose bank
  name contains "Independent Bank" or "Elan", one SUMIFS per name, and the
  card's bank had been renamed by hand to "ELAN CardMember Service
  (Independent Bank card)", which contains both. The bank name was fixed in
  the Sheet the same minute; the formula now tests all the names in one
  pass per row (SUMPRODUCT with an OR), so an account counts once however
  many names it matches. Debts and net worth were never affected.
  `BUILD_VERSION` 1.9.5. STATUS.md and the 2026-11-12 step page also
  corrected: the nightly sync was not missing (the Sheet's day was still
  2026-11-11 in Michigan).
- Files changed in `apps-script/`: `Dashboard.gs`, `Config.gs` (deployed
  on merge). Run **Finance Tracker → Upgrade workbook (keeps data)** once
  (the same run as the one already pending).
- Tested: Node (card and checking/savings lines use the one-pass formula;
  suite green). Not yet seen in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/dashboard-card-once`

## 2026-11-12 — Subscriptions and memberships added up together
- What changed: the owner wants subscriptions and memberships totalled.
  The Recurring Payments band's "Subscriptions (Monthly)" becomes
  **Subscriptions & Memberships (Monthly)** and sums both recurring groups.
  The Spending tab's Recurring bills tile now says "subscriptions $X ·
  memberships $Y" under its total. A calculated band label changed; no
  table header, column or tab name changed. `BUILD_VERSION` 1.9.4.
- Also done by hand in the owner's Sheet: Import Rules RULE-008 to
  RULE-018 for the card's regular merchants (Meijer and Target pre-fill
  only, because those trips get split; the rest import themselves), and
  Recurring Payments rows for Netflix, Audible and the Ring plan
  (Subscriptions) and YMCA (Memberships).
- Files changed in `apps-script/`: `Tables.gs`, `Spending.gs`, `Config.gs`
  (deployed on merge). Run **Finance Tracker → Upgrade workbook (keeps
  data)** once.
- Tested: Node (band label and formula, Spending tile text; suite green).
  Not yet seen in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/subscriptions-total`

## 2026-11-12 — The nightly sync refreshes balances on quiet nights
- What changed: on 2026-11-11 the nightly sync recorded "0 balance(s)" for
  every card and bank login, so the Dashboard kept the balances from the
  last Sync now. When a bank has no new transactions, Plaid's
  `/transactions/sync` reply carries no balances, and the sync only took
  balances from that reply. It now asks `/accounts/get` on its own whenever
  the reply brought none (the cached read; Sync now still makes its live
  pull on top). `BUILD_VERSION` 1.9.3.
- Also done by hand in the owner's Sheet: the Elan card moved to its own
  Elan login (it carries the purchases; the Independent Bank login only
  showed the balance), its Accounts and Debts rows renamed to the card's
  last four digits, and Import Rule RULE-007 so the card's side of a
  payment from checking imports as a Transfer.
- Files changed in `apps-script/`: `Plaid.gs`, `Config.gs` (deployed on
  merge). Nothing to run; the next nightly sync shows it.
- Tested: Node (a transactions reply with nothing new and no balances leads
  to one cached balance read and updated Accounts rows, no live pull; suite
  green). Not yet seen in Google: the next nightly run.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/nightly-balances`

## 2026-11-10 — Parked for Bills counts the current cycle only, capped at one payment
- What changed: the owner wants anything beyond one car payment to count
  as savings. A **Parked for Bills** fund now holds only the tagged deposits
  made since the last tagged bill payment (the current cycle); the Starting
  Amount seed is treated as spent once the first payment goes out; and when
  the fund has a **Target Amount** (one payment's worth) the parked figure is
  capped there. A fifth weekly transfer in a long month, or anything left
  over from an earlier cycle, therefore reads as savings on the Dashboard
  and on the emergency fund. Run QA mirrors the same arithmetic. The
  owner's car-payment pot got Target Amount = the monthly payment.
  `BUILD_VERSION` 1.9.2.
- Files changed in `apps-script/`: `Config.gs`, `Dashboard.gs`, `QA.gs`
  (deployed on merge). Run **Finance Tracker → Upgrade workbook (keeps
  data)** once.
- Tested: Node (fund formulas: cycle deposits since the last payment, the
  cap, the per-pot subtraction on backed funds and on the Dashboard; suite
  green). Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/parked-cycle` (stacked on `claude/savings-line-yours`)

## 2026-11-10 — Dashboard: Savings shows what is yours; the bank balance sits under it, faded
- What changed: the owner wanted the Savings line to be the money that is
  actually savings. The **Savings** line is now the bank balance minus the
  Parked for Bills pots on that account (money passing through for the car
  payment). Under it, a faded line **Savings + bill transfers** shows the
  bank balance itself with the parked amount noted. The two earlier helper
  rows ("of which parked for bills", "Savings that are yours to keep") are
  gone; the block is three lines again. `BUILD_VERSION` 1.9.1.
- Files changed in `apps-script/`: `Dashboard.gs`, `Config.gs` (deployed
  on merge). Run **Finance Tracker → Upgrade workbook (keeps data)** once
  (the same run covers the Spending tab if not run yet).
- Tested: Node (the Savings formula subtracts the parked pots, the faded
  line shows the bank balance, suite green). Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/savings-line-yours`

## 2026-11-10 — Spending tab; Start Here rewritten as the owner's guide; new tab order
- What changed. (1) **New Spending tab** (fourth tab): follows the
  Dashboard's Selected Month. Four tiles (spent so far with last month and
  the 3-month average, fixed vs flexible, needs vs wants, recurring bills
  with how many are paid this month); **by category, largest first**, with
  budget, last month, 3-month average, share and a bar, where Childcare and
  Child Expenses appear together as **Children** with a two-colour bar and
  the two amounts in their own colours; **recurring payments** in one list
  with a paid-this-month check (a Transactions row in the month with the
  same category and subcategory for at least 90% of the amount); the
  flexible subcategories; and **six months by category**. A definitions
  note closes the tab. All formulas; `buildSpending_` in new `Spending.gs`;
  the upgrade adds and redraws it. (2) **Start Here rewritten** as the guide
  to the tracker: what it is, the tabs in order, how money gets in, the
  definitions (Spending Type, Need/Want, category vs subcategory, what is
  not spending, expected take-home, Parked for Bills, Planned Extra Payment,
  Selected Month vs this week), the menu in plain words. The old
  getting-started checklist stays only while sample data is loaded.
  (3) **Tab order**: Start Here, Financial Summary, Dashboard, Spending,
  Savings & Reserves, Debts, Goals, then as before; Reminders last.
- Schema: `SCHEMA_VERSION` 3.10-spending-tab-2026-11-10, `BUILD_VERSION`
  1.9.0. No table change.
- Files changed in `apps-script/`: new `Spending.gs`; `Config.gs`,
  `Main.gs`, `Reference.gs`, `Upgrade.gs` (deployed on merge). Run
  **Finance Tracker → Upgrade workbook (keeps data)** once.
- Tested: Node (tab count and order, the Spending formulas: month link,
  sorted categories with Children, two-colour sparkline, recurring list and
  paid check, six-month table, definitions note; whole suite green). Not yet
  tried in Google: the live figures and the sparklines.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/spending-tab` (stacked on `claude/parked-for-bills`)

## 2026-11-10 — Money parked in savings for bills, kept apart from the savings that are yours
- What changed: the owner pays the car loan from savings and moves money
  into savings for it each paycheck; the savings balance therefore mixes
  money that is passing through with money that is permanently there.
  (1) New fund type **Parked for Bills** on Savings & Reserves. Such a fund
  names the savings account in Backing Account ID; a **Transfer** that
  carries its Fund ID (the deposit into savings tagged for the bill) adds
  to it and a **Debt Payment** or Expense that carries its Fund ID (the bill
  going out) takes from it, so it always holds what is parked right now.
  (2) A fund backed by an account (the emergency fund) now shows the live
  balance **minus** the Parked for Bills funds on the same account, so it
  reads as the money that is yours to keep. (3) The Dashboard savings line
  gains two rows: "of which parked for bills" and "Savings that are yours
  to keep". Run QA recomputes funds by the same rules (and now treats
  backed funds correctly). No column change; formula changes are applied by
  the upgrade.
- Also done by hand in the owner's Sheet: fund FUND-005 "Car payment money
  (parked in savings)" of type Parked for Bills on the savings account;
  Import Rule RULE-006 (deposits into savings whose memo says CAR PAYMENT →
  Transfer with that Fund ID); RULE-001 (the car payment) now carries the
  same Fund ID. The owner types today's parked amount into the fund's
  Starting Amount once.
- Schema: `SCHEMA_VERSION` 3.9-parked-for-bills-2026-11-10, `BUILD_VERSION`
  1.8.0; App Setup gets more rows for the growing data dictionary.
- Files changed in `apps-script/`: `Config.gs`, `Dashboard.gs`, `QA.gs`,
  `Reference.gs` (deployed on merge). Run **Finance Tracker → Upgrade
  workbook (keeps data)** once.
- Tested: Node (fund type and formulas, Dashboard rows, build with a Parked
  for Bills fund present, whole suite green). Not yet tried in Google: the
  live figures.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/parked-for-bills`

## 2026-11-09 — Payoff planner: a slider for extra payments, one debt or all, with saved plans
- What changed: **Finance Tracker → Payoff planner…** opens a dialog with a
  slider. *One debt at a time*: pick a debt, drag "extra per month", and
  see the payoff date today versus with the extra, time saved, interest
  saved, a balance-by-month picture and a fixed-step table (+$25 … +$300).
  *All debts together*: one extra pool, Avalanche (highest rate first) or
  Snowball (smallest balance first), finished payments rolling into the
  next debt; shows the debt-free date, interest saved, the order of payoff
  and a step table. Interest pauses are honoured (0% until the pause end
  date). A debt with no Minimum Payment is left out with a note.
  **Save** writes the plan back: a debt's **Planned Extra Payment** (new
  Debts column, appended) or the household extra and order on App Setup
  (`SETTING_DEBT_EXTRA_ALL`, `SETTING_DEBT_EXTRA_METHOD`). The Monthly Plan's
  Debt Payments (planned) now adds both, so the automatic flexible target
  and the Dashboard follow the plan; the AI snapshot names the saved plan.
- Schema: Debts + `plannedExtra` (Planned Extra Payment, appended; the
  upgrade adds it). `SCHEMA_VERSION` 3.8-payoff-planner-2026-11-09,
  `BUILD_VERSION` 1.7.0. `docs/SCHEMA.md` regenerated.
- Files changed in `apps-script/`: new `Payoff.gs`, `PayoffPlanner.html`,
  `PayoffMath.html` (the arithmetic, shared by the dialog and the Node
  tests); `Config.gs`, `Export.gs`, `Main.gs`, `Reference.gs`, `Upgrade.gs`
  (deployed on merge). Run **Finance Tracker → Upgrade workbook (keeps
  data)** once, then open the planner.
- Tested: Node (a 0% loan pays off in balance ÷ payment months; monthly
  interest; a payment below the interest never pays off; an interest pause
  counts 0 until its end; the pool plus rollover clears two debts sooner
  with less interest, Avalanche targets the higher rate; context, save of
  both plan kinds, the plan formula, the dialog template; upgrade adds the
  column and settings). Not yet tried in Google: the dialog itself.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/payoff-planner`

## 2026-11-09 — A sync imports the rows you ticked; Childcare is Nanny only; dropdowns honour Active?
- What changed, in three parts.
  (1) **Every sync also imports the rows ticked Reviewed?** (nightly and
  Sync now), after re-checking the rules, so a tick is the only step after
  a review. A ticked expense with a Category but no Subcategory fills
  itself in: a category with one active subcategory uses it; a wider
  category falls back to its "Other" line and says so in Notes. A blank
  Spending Type takes the subcategory's default from the Categories tab.
  Rows still missing something (a Fund for Savings, a Debt for a Debt
  Payment, no Category at all) stay put and the Sync now message lists
  them. New `completeReviewedRow_` and `importReviewedRows_` in
  `Import.gs`; the menu item keeps working and shares the code.
  (2) **Childcare has one subcategory, Nanny.** The household has one form
  of childcare, so the other four lines added earlier today are retired;
  the upgrade unticks them on the Categories tab.
  (3) **Dropdowns only offer rows ticked Active?** on the Categories tab
  (All Categories, Expense Categories, All Subcategories). The upgrade
  rewrites a derived list formula whose text changed. Rows that already
  use a retired pair still read.
- Schema: `SCHEMA_VERSION` 3.7-nanny-only-2026-11-09, `BUILD_VERSION`
  1.6.1. No tab, header or column change; `docs/SCHEMA.md` regenerated.
- Files changed in `apps-script/`: `Config.gs`, `FinancialSummary.gs`,
  `Import.gs`, `Plaid.gs`, `Reference.gs`, `SampleData.gs`, `Upgrade.gs`
  (deployed on merge). Run **Finance Tracker → Upgrade workbook (keeps
  data)** once, then **Bank feed → Sync now**.
- Also done by hand in the owner's Sheet (data, no amounts recorded here):
  an Import Rule for the payment to the Independent Bank card (Debt Payment
  on that card's Debts row), and the tax plan's due day on the recurring
  row and the Debts row.
- Tested: Node (a ticked Childcare row imports as Nanny / Fixed on the
  next sync, a ticked Child Expenses row falls back to Other with a note,
  derived list formulas carry the Active? filter on a fresh build and
  after the upgrade, Categories upgrade with one Childcare row, whole suite
  green). Not yet tried in Google: the Sync now message and the dropdowns.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/sync-imports-reviewed`

## 2026-11-09 — Dashboard: two cards (Expected Take-Home, Spent So Far); gross card dropped
- What changed: the owner did not want a whole box for expected gross
  income. The "This month" row now has two cards, **Expected Take-Home**
  (A:D) and **Spent So Far** (F:I), with column E as the gap. The paycheck
  counts that lived under the gross card ("Ben 2 paychecks, Valerie 2
  paychecks") move to the take-home card's small line. Gross stays on the
  Financial Summary (average and month by month). Also fixed: the QA check
  for the review count still read the old corner note in F10 (emptied by
  the banner change); it now reads the banner row, and the QA card checks
  read the new card cells.
- Files changed in `apps-script/`: `Dashboard.gs`, `QA.gs` (deployed on
  merge). Run **Finance Tracker → Upgrade workbook (keeps data)** once
  (the same run covers the childcare change).
- Tested: Node (card positions and formulas, column E empty, no gross text
  on the Dashboard, QA banner check). Not yet tried in Google: the look.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/dashboard-two-cards` (stacked on `claude/childcare-split`)

## 2026-11-09 — Childcare apart from other child costs; rules run on every sync
- What changed, in three parts.
  (1) **Childcare is its own category** (Nanny, Daycare / Preschool,
  Babysitting, Before & After School Care, Other Childcare), separate from
  Child Expenses (Clothing, Medical, Activities, Education, Supplies, Toys,
  Other). The old Child Expenses / Child Care pair leaves the taxonomy; the
  upgrade appends the new rows to the Categories tab and unticks Active? on
  the old pair without removing it (new `ensureCategories_` in
  `Reference.gs`, run by `upgradeWorkbook`). Each category gets its own
  Monthly Budget line.
  (2) **Financial Summary gains a Children block** above Net worth:
  Childcare, Other child expenses and All children combined, each with This
  Month, Average per Month over the window and Share of Spending.
  (3) **Import Rules re-check the waiting rows on every sync**, nightly and
  Sync now, so a rule added or changed after rows arrived takes effect by
  the next sync without a menu visit; Sync now reports how many rows were
  updated and imported. The menu item is renamed **Apply rules to waiting
  rows now** (it was "Re-apply rules to waiting rows") for the times the
  owner does not want to wait. `reclassifyOpenRows_` now returns
  `{ updated, imported }`; the rule dialog says how many rows it imported.
- Schema: `SCHEMA_VERSION` 3.6-childcare-2026-11-09, `BUILD_VERSION` 1.6.0.
  No tab, header or column change; `docs/SCHEMA.md` regenerated.
- Files changed in `apps-script/`: `Config.gs`, `FinancialSummary.gs`,
  `Import.gs`, `Main.gs`, `Plaid.gs`, `Reference.gs`, `RuleDialog.html`,
  `SampleData.gs`, `Upgrade.gs` (deployed on merge). Run **Finance Tracker →
  Upgrade workbook (keeps data)** once.
- Tested: Node (taxonomy order, Categories rows on a fresh build and after
  the upgrade of an older tab, the Children block formulas, a hand-typed
  rule importing its row on the next sync, whole suite green). Not yet
  tried in Google: the block's look and the Sync now message.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/childcare-split`

## 2026-11-09 — Import Staging easier to find: tab after Transactions, review banner on the Dashboard
- What changed: the owner reviews Import Staging often and found it buried
  among the setup tabs, and the small grey "awaiting review" note on the
  Dashboard went unnoticed. (1) The **Import Staging** tab now sits right
  after Transactions (`TAB_ORDER` in `Config.gs`); the upgrade moves it.
  (2) Dashboard row 11 is a full-width banner: green "Bank imports: nothing
  waiting for your review" when the staging tab is clear, amber with the
  count ("9 bank transaction(s) waiting for your review — click here to
  open Import Staging, then Finance Tracker → Import reviewed rows") when
  rows wait. The banner is a link that jumps to the Import Staging tab.
  The old note in F10:I10 is gone. No column, header or tab name changed.
- Also done by hand in the owner's Sheet (data, not code): Import Rule
  RULE-001 (descriptions containing "CAPITAL ONE AUTO" → Debt Payment on
  the car loan, auto-import), Recurring Payment REC-002 (car payment,
  monthly on the 2nd from savings) and the car loan's minimum payment and
  due day on Debts.
- Files changed in `apps-script/`: `Config.gs`, `Dashboard.gs` (deployed on
  merge). Run **Finance Tracker → Upgrade workbook (keeps data)** once, then
  **Re-apply rules to waiting rows** to pull in the November car payment.
- Tested: Node (tab order, the banner formula and its link, the
  conditional format, the removed F10 note; whole suite green). Not yet
  tried in Google: the in-sheet link (`HYPERLINK("#gid=…")`) and the
  banner's look.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/review-visibility`

## 2026-11-09 — Sync now pulls live balances; checking and savings show the available balance
- What changed: the owner saw a checking balance higher than at the bank
  after paying a card, and Sync now did not move it. Two causes, two fixes.
  (1) The sync read Plaid's cached balances (refreshed about once a day);
  **Bank feed → Sync now** and a connection's first sync now ask Plaid for a
  real-time pull from the bank (`/accounts/balance/get`), while the nightly
  run keeps the lighter cached read. If the live pull fails, the cached
  figures stand and the dialog says so. (2) Checking and savings now keep
  the **available** balance (pending items already taken out), which is what
  the bank shows on login; cards and loans keep the posted balance owed.
- Files changed in `apps-script/`: `Plaid.gs` (deployed on merge). Nothing
  to run; the next Sync now shows the live figures.
- Tested: Node (Sync now makes one live call per connection and writes the
  available balance for checking and the posted balance for the card; the
  nightly sync makes no live call; a live pull that returns nothing keeps
  the cached balances). Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/live-balances`

## 2026-11-09 — Dashboard polish; funds fill themselves; averages over months that have paychecks
- What changed:
  - **Dashboard**: the three month cards and the three flexible boxes now
    span three equal thirds (columns A:C, D:F, G:I at 360px each), so they
    line up; the gross card keeps the same bold 20-point type as the other
    two and is faded by colour only; column F is wide enough for a card
    issuer's full name in the accounts block.
  - **Savings & Reserves fills itself**: a fund row is created for every
    savings, investment, retirement and HSA account counted in net worth
    (Savings → Emergency Fund, Retirement → Retirement, others → Other),
    backed by that account, by the upgrade, the nightly sync and after a
    bank connects. A fund with a Backing Account now shows the account's
    live balance as its Current Amount (formula changed; schema 3.5). The
    owner adds the Target Amount and Planned Monthly.
  - **Financial Summary averages** end with the latest month that has a
    paycheck and divide by the number of months in the window that have
    paychecks (helper cells B4:D4), so a new workbook averages what it has
    instead of three empty months. Payroll Deductions and Income by Person
    follow the same window.
- Files changed in `apps-script/`: `Config.gs`, `Dashboard.gs`,
  `FinancialSummary.gs`, `Main.gs`, `Plaid.gs`, `Upgrade.gs`, `QA.gs`
  (deployed on merge). Then Finance Tracker → Upgrade workbook once (rebuilds
  both pages, creates the fund rows, rewrites the fund formula).
- Tested: Node (equal widths; fund rows created once for the right account
  types; backed-fund formula; window cells; QA recomputation). Not yet tried
  in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/dashboard-polish-funds`

## 2026-11-09 — Dashboard for the month; Financial Summary for the whole picture
- What changed (the owner's design): the Dashboard now holds only this
  month's working numbers, and a new **Financial Summary** tab (second tab)
  holds the standing picture.
  - **Dashboard**: the accounts block (unchanged); then "This month" with
    the Selected Month and three cards: **Expected Gross Income** (faded,
    with what has landed so far and each person's paycheck count), **Expected
    Take-Home** (the one that stands out, from Monthly Plan for the selected
    month) and **Spent So Far** (with the flexible part); a line showing how
    the flexible figure is reached; Current Flexible Spending; the Monthly
    Review Checklist (now full width, tick boxes in column A). Income by
    Person, Credit Scores, Payroll Deductions, the Savings & Reserves table
    and the debt footnote left the Dashboard. The paycheck-count dot fix is
    included.
  - **Financial Summary**: **Averages over the last N full months** (N typed
    in B3, default 3, kept by the upgrade) for gross, take-home, spending and
    savings (with the savings rate); **Month by month** for the last twelve
    months (gross, take-home, spending, savings, debt payments, left over);
    then, in the owner's order, **Savings & Reserves** (with Planned Monthly
    and the planned-savings total), **Debts** (household, student loans, all,
    estimated monthly interest, minimums, PSLF), **Income by Person**
    (averages per month over the period plus last month's take-home),
    **Payroll Deductions** (averages per month), **Credit Scores**, and **Net
    worth** (tracked, excluding student loans, assets, investments &
    retirement).
  - QA checks the Dashboard cards against Monthly Plan and Monthly Summary,
    and the Summary's averages, payroll averages and credit scores against
    the raw tables. App Setup's tab list describes both tabs.
- Files changed in `apps-script/`: `Config.gs` (new tab), `Dashboard.gs`,
  new `FinancialSummary.gs`, `Main.gs`, `Upgrade.gs`, `QA.gs`,
  `Reference.gs` (deployed on merge). Then Finance Tracker → Upgrade
  workbook once (rebuilds the Dashboard, builds the Financial Summary,
  reorders the tabs; the Selected Month and the checklist ticks carry over).
- Tested: Node (card labels and sources; Summary sections in order with the
  months input named; payroll and credit formulas on the Summary; tab
  order; upgrade path incl. the checklist moving from column G to A). Not
  yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/two-page-dashboard`

## 2026-11-09 — Paycheck counts on the Dashboard line shown as whole numbers
- What changed: the "Expected this month" line read "Ben 2. paychecks"; whole
  counts now show as "2" and fractional (average) counts as "2.2".
- Files changed in `apps-script/`: `Dashboard.gs` (deployed on merge). Then
  Finance Tracker → Upgrade workbook once (rebuilds the Dashboard).
- Tested: Node. Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/paycheck-count-format`

## 2026-11-09 — Expected income and an automatic flexible-spending target
- What changed (the owner wants the Dashboard to say what the household
  makes in a typical month and what is free to spend, not only what has
  landed so far):
  - **Expected Income** tab (after Income): one row per regular paycheck
    (person + employer) with Pay Frequency, Typical Gross and Typical
    Take-Home per paycheck, Active?, and calculated Paychecks per Month
    (average), Typical Month Take-Home / Gross, Last Paycheck, Last
    Take-Home, Last vs Typical (tinted when $50 or more off), Paydays This
    Month and Expected This Month. Biweekly and weekly paydays are counted
    per month from the last pay date and the pay cycle, so the two
    three-paycheck months a year show 3 (the yearly average is used until a
    first paycheck exists); semimonthly is 2, monthly 1. Rows are created
    automatically from the paychecks on Income (frequency guessed from the
    pay-date gaps, semimonthly told apart from biweekly by whether paydays
    stay on the same calendar days; typical amounts are the median of the
    last three), by the upgrade, the nightly sync and the pay stub import.
    The owner corrects a row when the guess is wrong.
  - **Monthly Plan** gains Expected Take-Home (auto: each source times its
    paydays in that month), Income Adjustment
    (entered, + or −), Bills (active Recurring Payments except the Loans
    group), Debt Payments (the larger of Debts minimums and the Loans group),
    Planned Savings (Planned Monthly across Savings & Reserves), Flexible
    Target (auto) and Target in Use. Monthly Flexible Target becomes an
    override: blank means automatic. Amount Available and the weekly guidance
    now use Target in Use.
  - **Dashboard**: a line under the four cards reads "Expected this month:
    take-home … − bills … − debt payments … − planned savings … = flexible …
    (automatic / set by hand)" with each person's paycheck count for the
    month; the flexible-spending card says which target is in use. QA recomputes the automatic target; the AI snapshot states
    expected regular income and how the target was arrived at.
  - Schema 3.4 (one new table, seven appended Monthly Plan columns, two
    changed formulas, one new list).
- Files changed in `apps-script/`: `Config.gs`, new `ExpectedIncome.gs`,
  `Tables.gs`, `Dashboard.gs`, `Plaid.gs`, `PasteImport.gs`, `Upgrade.gs`,
  `Main.gs`, `QA.gs`, `Export.gs`, `SampleData.gs`, `Api.gs` (deployed on
  merge). Then Finance Tracker → Upgrade workbook once: it adds the tab and
  columns and creates the Expected Income rows from the paychecks already
  on Income; then check those rows' frequency and typical amounts.
- Tested: Node (rows created from sample paychecks with semimonthly
  recognised; frequency guesses for weekly, biweekly, semimonthly, monthly
  and a single date; no duplicates; plan formulas wired; Dashboard line;
  pay stub import creates rows for new employers; upgrade of a pre-3.4
  workbook). Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/expected-income`

## 2026-11-09 — Import from Claude: a paste window
- What changed: **Finance Tracker → Import from Claude (paste)…** opens a
  window with a text box. Paste the block, click **Check it** to see what
  would be added (one line per row, duplicates to be skipped, anything to
  check afterwards), then **Import N row(s)**. The Paste Import tab remains
  as a fallback (**Import the Paste Import tab**). Both paths share one
  importer; the window also accepts Windows line endings and a
  comma-separated block.
- Files changed in `apps-script/`: `PasteImport.gs`, new
  `PasteImportDialog.html`, `Main.gs` (deployed on merge). Nothing to run.
- Tested: Node (preview writes nothing and lists the row; import writes it;
  the same text again is reported as already imported; CSV accepted). Not
  yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/paste-import-dialog`

## 2026-11-09 — "Paused" shown in front of the rate
- What changed: while a debt's interest pause is in effect, the Interest Rate
  (APR) cell displays as "Paused · 6.0%" (the number underneath is unchanged,
  so nothing that reads it is affected). The label appears the moment
  Interest Paused? is ticked or Paused Until is edited, is refreshed by the
  nightly sync (so a pause that ends overnight loses it), and is restored
  after an upgrade.
- Files changed in `apps-script/`: `Tables.gs`, `Main.gs`, `Plaid.gs`,
  `Upgrade.gs`, `Config.gs` (deployed on merge). Nothing to run afterwards;
  the next Upgrade workbook or nightly sync labels rows already paused.
- Tested: Node (tick → label; expired end date or untick → plain rate).
  Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/paused-label`

## 2026-11-09 — Debts: pause interest, with an end date that unpauses by itself
- What changed: Debts gains **Interest Paused?** (checkbox) and **Paused
  Until** (date, optional). While the box is ticked and the date is blank or
  still ahead, the row's Estimated Monthly and Annual Interest are 0, so the
  Debts band total and the AI snapshot drop that interest too; the balance,
  payments and PSLF count are untouched. Once Paused Until passes, interest
  counts again without anyone unticking anything. The paused interest cell
  is tinted green while the pause is in effect. The snapshot marks the APR
  "(interest paused until …)" and counts how many debts are paused.
  Schema 3.3 (two appended columns; the two interest formulas change).
- Files changed in `apps-script/`: `Config.gs`, `Tables.gs`, `Export.gs`
  (deployed on merge). Then Finance Tracker → Upgrade workbook once (adds
  the two columns and rewrites the two formulas).
- Tested: Node (formulas honour the pause; snapshot counts a paused debt at
  0 and resumes after the end date; upgrade of a pre-3.3 workbook). Not yet
  tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/debt-interest-pause`
## 2026-11-09 — Pay stub import: a Claude skill plus Paste Import in the Sheet
- What changed:
  - **Paste Import** tab (with the feed tabs) and **Finance Tracker → Import
    pasted rows (from Claude)**. The owner pastes the block a Claude skill
    produced into A5; the import checks the marker line, maps the header line
    to the table's columns (keys or header text), parses dates and money,
    validates dropdown values, refuses with a plain message on an unknown
    column or a bad value before writing anything, skips rows already present
    (Income: person + pay date + gross), shows a YES/NO summary, writes the
    rows with IDs and Change Log entries, records the block's hash so the same
    block cannot be imported twice, links paycheck deposits, and reports in a
    status cell. Tables accepted now: Income, Credit Scores, Recurring
    Payments, Quarterly Debt Review, Transactions (`PASTE_IMPORT` in
    Config.gs). For Income an extra `stubTakeHome` column is compared with
    gross − deductions and a mismatch is noted on the row.
  - **`skills/paystub-import/`**: the skill (SKILL.md, the Income column
    guide, an example block) that reads pay stub photos or PDFs for either
    person, shows a review table and produces the block. `skills/README.md`
    says how to install it in claude.ai.
  - `linkIncomeDeposits_` is the quiet form of the menu action, reused after
    an import.
- Files changed in `apps-script/`: `Config.gs` (new tab, `PASTE_IMPORT`),
  new `PasteImport.gs`, `Main.gs`, `Upgrade.gs` (deployed on merge). Then
  Finance Tracker → Upgrade workbook once (adds the Paste Import tab; the
  upgrade leaves it alone afterwards so a pasted block is never wiped).
- Tested: Node (a three-row block → two Income rows with IDs and parsed
  numbers, the in-block duplicate skipped; net-pay check noted; status and
  hash; the same block again adds nothing; a re-pasted block of existing
  records skipped; unknown column and bad date refused before writing; Change
  Log entries). Not yet tried in Google; the skill itself not yet tried on a
  real stub.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/paystub-import`
## 2026-11-09 — Cards the bank reports as loans; issuer aliases; QA check moved with the Dashboard
- What changed: Independent Bank's credit card is issued by Elan and came
  through Plaid typed as a loan named "Elan Credit Card", so it landed as a
  Loan account, got a Personal Loan row on Debts, and the Dashboard's
  Independent Bank card line read "not connected yet". Now (1) an account the
  bank types as a loan but names a credit card (or subtype credit card / line
  of credit) is typed Credit Card; (2) the Dashboard's card lines match any
  of the issuer's names (`patterns` in `DASH_ACCOUNTS.cards`: Independent
  Bank ↔ Elan, American Express ↔ Amex) and so does the empty-Debts-row
  matching at connect time (`issuerAliases_`); (3) an unconnected line shows
  — with "not connected yet" in the small column instead of overflowing the
  balance cell; (4) QA's awaiting-review check reads the Selected Month row
  (B10) instead of row 3. The owner's Sheet was corrected by hand: ACC-017
  typed Credit Card, DEBT-011 renamed and typed Credit Card, ACC-009 and
  DEBT-006 marked for deletion.
- Files changed in `apps-script/`: `Config.gs`, `Dashboard.gs`, `Plaid.gs`,
  `QA.gs` (deployed on merge). Then Finance Tracker → Upgrade workbook once
  (rebuilds the Dashboard), then Re-apply rules to waiting rows (the Elan
  card's staged rows were classified as loan activity).
- Tested: Node (loan-typed card → Credit Card; aliases; Dashboard formulas
  carry the Elan pattern and the not-connected text). Not yet tried in
  Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/dashboard-card-fixes`
## 2026-11-09 — Reminders is the last tab
- What changed: the Reminders tab moves from fifth to last in the tab
  order, as the owner asked. Nothing else moves.
- Files changed in `apps-script/`: `Config.gs` (deployed on merge). Then
  Finance Tracker → Upgrade workbook once (it reorders the tabs).
- Tested: Node. Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/reminders-last-tab`

## 2026-11-09 — Accounts at the top of the Dashboard; new tab order; typed rows get their IDs
- What changed:
  - **Accounts block on the Dashboard** (the owner's choice after several
    mockups): rows 3–7 now show Checking and Savings (Independent Bank) with
    tonight's balance and when it synced on the left, and the credit cards in
    the owner's order (Independent Bank, American Express, Capital One) with
    the amount owed, the lender's due date and a total on the right. Plain
    numbers: no trend lines, no minimums. A line reads "not connected yet"
    until its bank is connected. Layout in `DASH_ACCOUNTS` (Config.gs).
  - **"This month" section**: the Selected Month and the four cards (gross,
    take-home, spending, savings) and everything below them move down seven
    rows under a new bar. Selected Month is now B10; the input cells carry
    named ranges (`DASH_SELECTED_MONTH`, `DASH_CHECKLIST`) so the upgrade
    carries them over from either layout.
  - **Tab order**: Dashboard, Savings & Reserves, Debts, Goals, Reminders,
    then the ledgers and derived tables, Credit Scores, Categories, then
    Start Here with the setup and feed tabs (Accounts next to Connections).
  - **Typed rows get their IDs**: a row typed by hand on any ID-numbered
    table receives the next ID the moment a cell is filled (the owner's rent
    row sat outside every total because Recurring ID was blank). A new
    Recurring Payments row is also ticked Active, and a Due Day fills Next
    Payment Date when it was blank.
  - The separate Accounts Dashboard tab and Balance History table built
    earlier on this branch were dropped before merge (not wanted).
- Files changed in `apps-script/`: `Config.gs`, `Dashboard.gs`, `Main.gs`,
  `Upgrade.gs`, `Reference.gs` (deployed on merge). Then Finance Tracker →
  Upgrade workbook once (rebuilds the Dashboard, reorders the tabs).
- Tested: Node (accounts block cells and formulas; every later section
  found at its shifted row; named ranges; tab order; a typed Recurring row
  gets REC-xxx, Active and Next Payment Date; upgrade path). Not yet tried in
  Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/accounts-dashboard` (on top of `claude/credit-score-reminder`)

## 2026-11-08 — Credit score reminders; Reminders on their own tab
- What changed: the reminders (box, monthly email, Finance Tracker → Show
  reminders) now also flag each person whose latest Credit Scores entry is
  missing or older than the new App Setup setting *Credit score reminder
  after (months)* (default 3); there is no consumer credit-score feed, so
  this is the nudge instead. And the reminders box moves off the Dashboard
  onto a new **Reminders** tab (fourth tab, after Goals) with a note on where
  each item is updated; the Dashboard is back to columns A:I. Named range
  `REMINDERS_BOX` replaces `DASH_REMINDERS`.
- Files changed in `apps-script/`: `Config.gs` (new tab), `Dashboard.gs`,
  `Main.gs`, `Plaid.gs`, `Reference.gs`, `Upgrade.gs` (deployed on merge).
  Then Finance Tracker → Upgrade workbook once (adds the setting, builds the
  Reminders tab, trims the Dashboard).
- Tested: Node (never-entered scores flagged; a score entered today clears
  it; a five-month-old score stays flagged at 3 months and clears at 6; the
  Dashboard formula carries both people). Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/credit-score-reminder`

## 2026-11-08 — Goals move to their own tab
- What changed: the five Financial Goals boxes now live on a new **Goals**
  tab (third tab, right after the Dashboard) at full width, five rows tall
  each, instead of beside the Dashboard cards. The Dashboard keeps the
  calculated Reminders box beside the cards. Named ranges `GOAL_1`…`GOAL_5`
  move with the boxes; Upgrade workbook reads the goal text from wherever it
  is (the Goals tab, or the Dashboard panel of yesterday's build) before
  rebuilding and writes it back onto the Goals tab.
- Files changed in `apps-script/`: `Config.gs` (new tab in SHEETS and
  TAB_ORDER), `Dashboard.gs` (`buildGoals_`), `Main.gs`, `Upgrade.gs`
  (deployed on merge). Then Finance Tracker → Upgrade workbook once; it
  creates the Goals tab and moves any goal text already written.
- Tested: Node (Goals tab built third with the five named boxes; Dashboard
  keeps Reminders; upgrade from a workbook whose goals sat on the Dashboard
  moves the text to the new tab). Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/goals-tab`
## 2026-11-08 — Pension line in the AI snapshot
- What changed: Account Types gains **Pension**. A Pension row holds no
  balance, only Notes (projected monthly benefit, years of service, as-of
  date), is never counted as an asset (snapshot, net-worth snapshot helper
  and the live net-worth box all skip it), and the AI snapshot lists it under
  "Pensions (future monthly income; no balance, not counted in net worth)"
  with the Notes text. The owner's Sheet has a Pension row (ACC-016, Include
  in Net Worth = No) with a fill-in note.
- Files changed in `apps-script/`: `Config.gs` (list value), `Export.gs`,
  `Main.gs`, `Tables.gs` (deployed on merge). Then Finance Tracker → Upgrade
  workbook once (adds Pension to the dropdown and refreshes the net-worth
  box formula).
- Tested: Node (snapshot lists the pension from Notes and leaves it out of
  tracked net worth; list upgrade covered by the existing upgrade test). Not
  yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/pension-in-snapshot`

## 2026-11-07 — Financial Goals on the Dashboard; reminders for the few things still typed by hand
- What changed:
  - **Financial Goals**: a panel to the right of the Dashboard cards (columns
    K:N) with five large text boxes (four rows tall, wrapped, 12-point) under
    a "Financial Goals" title. The boxes are named `GOAL_1`…`GOAL_5`, are
    left unprotected, and Upgrade workbook carries their text through the
    Dashboard rebuild. Monthly / yearly breakdowns are left for later, as
    asked.
  - **Reminders**: a calculated box under the goals lists what needs a hand.
    Today that is a student loan whose PSLF official count was never entered
    or was last confirmed more than N months ago (App Setup setting *PSLF
    count reminder after (months)*, default 12). The nightly sync emails the
    owner the same list at most once every 30 days while something is due
    (App Setup setting *Email reminders*, on by default); Finance Tracker →
    **Show reminders** shows it any time.
  - The manifest gains the send-mail scope, so Google asks the owner to
    approve the new permission once.
- Files changed in `apps-script/`: `Dashboard.gs`, `Upgrade.gs`,
  `Reference.gs`, `Plaid.gs`, `Main.gs`, `appsscript.json` (deployed on
  merge). Then run Finance Tracker → Upgrade workbook once (rebuilds the
  Dashboard with the panel and App Setup with the two settings), then Bank
  feed → Sync now once and approve the email permission when Google asks.
- Tested: Node (panel and named ranges built; due reminders computed from
  Debts; the months setting honoured; email sent once then throttled; the
  App Setup switch respected; goals text and the setting survive an
  upgrade). Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/goals-and-reminders`

## 2026-11-07 — Lender data flows into Debts; loan servicers connect; PSLF progress; month rows add themselves
- What changed (the owner asked for as little typing as possible):
  - **Lender data → Debts.** The nightly sync now also reads Plaid Liabilities
    for every spending and loan connection and writes what the lender reports
    into each Debts row linked to one of its accounts: Interest Rate (APR),
    Minimum Payment, Due Day, and new columns **Next Payment Due**, **Last
    Payment (feed)**, **Loan Status / Plan** and **Feed Updated**; Original
    Balance is filled from the loan's origination principal when blank. New
    spending connections ask for Liabilities only where the bank supports it
    (`required_if_supported_products`, so no bank disappears from Plaid's
    list). A bank that offers none is marked once in the new Connections
    column **Liabilities Feed** and not asked again; Repair clears the mark.
  - **Loan or student loan servicer** is a fourth kind of connection in
    Connect a bank (`products: ['liabilities']`). Step 3 asks whose loans
    they are; every loan account gets a Debts row (an empty row the owner
    already made for that person and loan type is reused first, otherwise one
    is created, linked, grouped under Student Loans). Loan accounts in any
    kind of connection get the same treatment.
  - **PSLF progress.** Plaid no longer supplies PSLF counts (its field was
    tied to FedLoan), so Debts gains **PSLF Official Count** and **PSLF Count
    As Of** (typed from studentaid.gov now and then) plus calculated
    **Payments Since Count** (months with a Debt Payment to that debt after
    the as-of date), **PSLF Estimated Count** and **PSLF Remaining (of 120)**.
    The Debts band shows PSLF progress per person (the lowest loan), the
    Dashboard debt footnote repeats it, the AI snapshot lists it per loan and
    QA recomputes it.
  - **Month rows add themselves.** Each sync makes sure Monthly Plan has a
    row for the current month (target carried from the latest month) and
    Monthly Budget has this month's category rows (copied from the latest
    month that has any).
- Files changed in `apps-script/`: `Config.gs` (schema 3.2: Debts +9
  columns, Connections +1), `Plaid.gs`, `ConnectDialog.html`, `Tables.gs`,
  `Dashboard.gs`, `Export.gs`, `QA.gs`, `SampleData.gs` (deployed on merge).
  Then run Finance Tracker → **Upgrade workbook** once (adds the columns,
  redraws the Debts band and Dashboard), then **Bank feed → Sync now** (first
  lender data for Capital One, if Capital One offers it).
- Tested: Node (card APR / minimum / due day / next due / last payment to
  the linked Debts row; "not available" marked once; spending token asks for
  liabilities if supported; loan token asks for liabilities only; servicer
  connect → two loans → placeholder reused + one row created → first sync
  writes rate, minimum, principal, plan, status; PSLF formulas on feed-made
  rows; Debts band KPI; month rows added once; upgrade of a pre-3.2 workbook).
  Not yet tried in Google: everything above, including whether Plaid's
  existing Capital One connection returns Liabilities without new consent.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/liabilities-pslf-automation`

## 2026-11-07 — Clear sample data no longer breaks the live net-worth box; QA on an empty workbook
- What changed: the owner ran Clear sample data and QA then reported two
  problems. (1) Deleting the three sample Net Worth Snapshots rows removed
  whole rows, which took the live "Current Tracked Net Worth" box in columns
  M:N with them (its total became `#REF!`). `buildNetWorthHelper_` now resets
  its area before drawing so it can be redrawn over a shifted strip, and
  `clearSampleData` redraws it after deleting Net Worth rows. (2) "Monthly
  Summary has no month rows" was reported as FAIL although the tab fills
  itself from Income and Transactions; with neither entered it is now an
  INFO line.
- Files changed in `apps-script/`: `Tables.gs`, `Main.gs`, `QA.gs` (deployed
  on merge). Then run Finance Tracker → Upgrade workbook once: it redraws the
  net-worth box on the owner's Net Worth Snapshots tab.
- Tested: Node (clearSampleData leaves the box intact with its formulas; QA
  reports the empty summary as INFO with no raw rows and FAIL otherwise).
  Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/clear-sample-nw-helper`

## 2026-11-07 — Trial limit is 20 connections, not 10
- What changed: the owner's Plaid plan page reads "trial access for up to 20
  connections", not the 10 the tracker assumed. The limit is now one constant
  (`PLAID_TRIAL_LIMIT`, 20) used by Bank feed → Status and the connect
  dialog's counter and warning colours; both now say that Plaid's own count
  can be higher because it also counts attempts that never reached the Sheet
  (the owner's first Fidelity attempt is one). The Connections tab note and
  the docs say 20. Also: the connect dialog's "Saving and syncing…" button
  is hidden once the save finishes instead of staying greyed out.
- Files changed in `apps-script/`: `Config.gs`, `Plaid.gs`,
  `ConnectDialog.html` (deployed on merge). Nothing to run afterwards; the
  Connections tab's note text is refreshed by the next Upgrade workbook run
  if at all, and is cosmetic.
- Tested: Node (suite passes). Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/trial-limit-20`

## 2026-11-07 — Finish connecting resumes on the account-matching step
- What changed: the owner's Fidelity connection reached Plaid's Success page
  but the Sheet dialog had been closed, so Bank feed → Finish connecting
  exchanged the token and created CONN-002 (Pending), then opened the connect
  dialog on step 1 instead of the account matching, and forgot the accounts
  it had just read. A connected bank whose accounts are not yet matched is now
  remembered in Script Properties (`PLAID_PENDING_MAP`); the connect dialog
  and Finish connecting open straight on step 3 for it, with a note that no
  new slot is used. A Pending connection from before this change is rebuilt
  from Plaid (`/accounts/get`) the same way. Matching the accounts clears it.
- Files changed in `apps-script/`: `Config.gs`, `Plaid.gs`,
  `ConnectDialog.html` (deployed on merge). Then Bank feed → Finish
  connecting once to match Fidelity's account to ACC-012.
- Tested: Node (context resumes the unmapped connection; an older Pending
  row is rebuilt; Finish connecting opens the dialog without a Plaid
  session; mapping clears the memory). Not yet tried in Google.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/finish-connecting-resume`

## 2026-11-07 — Balance only: ask Plaid for account details instead of nothing
- What changed: the Balance only kind failed on its first real try with
  Plaid's `INVALID_FIELD — must provide at least one product`. Plaid's API
  definition confirms a Link token must name at least one product and never
  accepts `balance` as one (Balance comes with whatever else is asked for).
  The Balance only kind now asks for account details (`auth`), the product
  most institutions allow, and the dialog offers account-holder details
  (`identity`) as a fallback if Plaid flags the institution for that too.
  The tracker never reads either; the sync still only reads balances for
  these connections, which are still recorded as `balance` on Connections.
- Files changed in `apps-script/`: `Plaid.gs`, `ConnectDialog.html`
  (deployed on merge). Nothing to run afterwards.
- Tested: Node (balance mode sends `auth` only; fallback sends `identity`
  only; both recorded as balance connections). Not yet tried in Google
  against HealthEquity; which product HealthEquity allows is unknown until
  the owner tries.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/balance-only-via-auth`

## 2026-11-07 — Connect dialog: Balance only — any account type
- What changed: a third kind of connection in Bank feed → Connect a bank…
  that asks Plaid for no products, so only the balance is read nightly.
  Needed for HealthEquity, which Plaid flags "not supported" for both
  transactions and investment holdings, and useful for any institution that
  refuses the other two kinds. Connections rows record `balance` as the
  product; the sync already treats non-transaction connections as
  balance-only (`/accounts/get`).
- Files changed in `apps-script/`: `Plaid.gs`, `ConnectDialog.html`
  (deployed on merge). Nothing to run afterwards.
- Tested: Node (the balance-only link token sends an empty products list).
  Not yet tried in Google against HealthEquity.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/balance-only-connections`

## 2026-11-07 — Upgrade: quieter formula comparison; presentation strips redrawn
- What changed: `upgradeWorkbook` compared stored formulas character for
  character, but Google drops the quotes around one-word tab names
  (`'Income'!$C$5` → `Income!$C$5`), so unchanged formulas were rewritten on
  every run and listed in the report. The comparison now normalizes quotes
  and whitespace. The upgrade also redraws the Debts KPI band, the Recurring
  Payments summary and the Net Worth helper (presentation areas with no
  entered data), which it previously left at their old design — the owner's
  Debts band still showed the pre-3.1 labels.
- Files changed in `apps-script/`: `Upgrade.gs` (deployed on merge). Then run
  Finance Tracker → Upgrade workbook once to redraw the Debts band.
- Tested: Node (formula comparison; upgrade test checks the redrawn band).
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/upgrade-formula-compare`

## 2026-11-07 — First real Plaid connection: fixes from what it surfaced
- What changed: the owner connected Capital One through Plaid (the first
  live run of the feed: Hosted Link, token exchange, account mapping and the
  first sync all worked). Plaid returned two accounts, a credit card and the
  auto loan, and three things needed fixing:
  - A payment received inside a **loan account** was classified as Income.
    Activity in a Loan account is now suggested as Transfer (never income or
    spending); the loan's balance is what matters.
  - The connect dialog's step 3 now **pre-selects the owner's existing
    Accounts row** when the institution and account type match (e.g. Capital
    One + credit card → the existing Capital One card row), instead of
    defaulting to "Create a new row". Loan accounts are labelled "balance
    only".
  - **Debts · Latest Balance** now uses the linked account's live balance
    when it is newer than the last quarterly review (so a card or loan synced
    nightly shows today's balance), then the review, then the original
    balance. Balance As Of shows which. QA and the AI snapshot follow the same
    rule.
- Files changed in `apps-script/`: `Config.gs`, `Import.gs`, `Plaid.gs`,
  `ConnectDialog.html`, `QA.gs`, `Export.gs` (deployed automatically on
  merge; the Debts formula change is applied by Finance Tracker → Upgrade
  workbook, which rewrites changed formulas only).
- Tested: Node tests (loan classification, live-balance fallback in the
  snapshot) pass. Confirmed in Google: the full connect flow and first sync
  for one institution; Independent Bank was down on Plaid's side at the time.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/bank-feed-first-run-fixes`

## 2026-11-07 — Automatic deploy: merging to main pushes the code into the Sheet
- What changed: `.github/workflows/deploy.yml` runs the Node tests and then
  `clasp push -f` from `apps-script/` into the Apps Script project on every
  merge to `main` (and on demand). Two repository secrets are required:
  `CLASPRC_JSON` (from `clasp login` on the owner's computer) and
  `CLASP_SCRIPT_ID`. The manifest `appsscript.json` now lists every scope the
  script uses (spreadsheets, UI, email, triggers, external requests for
  Plaid). `AGENTS.md` and `README.md` describe the new flow; handoff pages
  now cover only in-Sheet steps.
- Files to paste into Apps Script: none from now on. One-time setup:
  `handoffs/2026-11-07-auto-deploy-setup.json`. The first deploy renames the
  project's `Code.gs` to `Config.gs` (clasp mirrors the repository).
- Tested: workflow syntax; `clasp push` itself can only be exercised by the
  first real run.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/bank-import-plaid`

## 2026-11-07 — Bank feed: Plaid connection, Import Rules, review workflow, split panel, student loans kept separate
- What changed:
  - **Import Rules** tab: one row per bank-description pattern (Contains /
    Starts With / Exact, optionally per account) that fills Type, Category,
    Subcategory, Spending Type, Person, Fund/Debt on imported rows. Each rule
    can **Auto-import** (straight to Transactions) or require a **Split**.
    Rules are made from a staged row with *Make a rule from the selected
    row…* and are applied to waiting rows at once.
  - **Import Staging** gains Status, Suggested Type/Person/Fund/Debt, Matched
    Rule, Merchant (from bank), Bank Category, Pending Transaction ID, Paired
    Import ID and Imported At. The engine (`Import.gs`) classifies rows,
    pairs transfers between owned accounts (both sides Transfer) and card
    payments (bank side Debt Payment to the linked debt, card side Transfer),
    replaces a pending charge with its posted version, and soft-deletes a
    transaction the bank withdraws. *Import reviewed rows* turns ticked rows
    into transactions; rows missing a category are held with a reason.
  - **Split panel** (side panel, `SplitPanel.html`): splits a staged or
    recorded transaction into balanced children; Remaining must reach $0.00.
  - **Connections** tab + **Plaid** (`Plaid.gs`): Hosted Link connect flow
    (`ConnectDialog.html`, three steps: kind of account → sign in at Plaid →
    map accounts), access tokens in Script Properties, nightly
    `/transactions/sync` with cursors, balances for balance-only accounts,
    Repair (update mode, never a new slot), layout check that pauses the
    sync instead of mis-writing, Status that never shows secrets.
  - **Accounts** gains External Account ID, Connection ID, Import
    Transactions?, Last Synced. Real accounts are preset: transactions for
    PayPal, Independent Bank ×3, Capital One; balance-only for Acorns,
    Fidelity, HSA.
  - **Debts** gains Debt Group (Household / Student Loans); the KPI band shows
    Household Debt, Student Loans and All Debt. Quarterly Debt Review gains a
    calculated Debt Group. Monthly Summary's *Reviewed Debt Balance* is
    renamed **Reviewed Household Debt** (excludes student loans) and a
    **Student Loan Balance** column is added; Monthly Review's *Total Debt
    Balance* is renamed **Household Debt Balance** with a Student Loan
    Balance column added. Net worth still counts all debt. Debt Types gains
    **Tax Debt**.
  - **Upgrade workbook (keeps data)** (`Upgrade.gs`): adds missing tabs,
    columns (appended), lists and renamed headers to a live workbook, refreshes
    formulas/validations/formatting and the documentation tabs, preserves
    settings and the Dashboard month, and stops before changing anything if a
    header was renamed by hand.
  - **Copy financial snapshot for AI…** (`Export.gs`, `ExportDialog.html`):
    a plain-text briefing — income by month and person, monthly cash flow,
    spending by category and type, this month's plan and budget, every fund,
    every debt (household and student loans separate, APR, minimums,
    estimated interest), accounts and tracked net worth, recurring
    obligations, latest credit scores, recent review notes, data-quality
    notes — computed from entered columns only, with a Copy button. For
    pasting into a Claude project.
  - Dashboard: awaiting-review count (top right) and household/student-loan
    footnote. App Setup: setting *auto-import detected transfers and card
    payments*. Menu reorganized with a **Bank feed** submenu.
- Files to paste into Apps Script: changed — `Config.gs` (as Code.gs),
  `Helpers.gs` (reading a table no longer creates a missing tab),
  `Reference.gs`, `Tables.gs`, `Dashboard.gs`, `SampleData.gs`, `QA.gs`,
  `Main.gs`, `Api.gs`; new — `Import.gs`, `Plaid.gs`, `Upgrade.gs`,
  `Export.gs`, `SplitPanel.html`, `RuleDialog.html`, `ConnectDialog.html`,
  `ExportDialog.html`. Then run `upgradeWorkbook` once (it takes a lock, so
  a second copy started early simply says to wait).
- Sheet changes needed: none by hand (the upgrade adds them). Script
  Properties to add by hand: `PLAID_CLIENT_ID`, `PLAID_SECRET`; then Bank
  feed → Set history start date, Connect a bank (×9), Turn nightly sync on.
- Tested: Node (`tests/run-tests.js`, mocked Sheets + mocked Plaid): rule
  matching and scoping, classification, transfer and card-payment pairing,
  review import with held-back rows, rule-from-dialog auto-import, split
  panel, Hosted Link connect → exchange → mapping → first sync (two pages,
  start-date filter, balances, cursor), pending→posted supersede, bank
  removal → soft delete, idempotent re-sync, layout-check pause, trigger
  on/off, status without secrets, repair in update mode, upgrade of an
  older workbook (tabs, columns, renames, lists, data preserved, idempotent,
  conflict stop). Not yet run in Google: everything above; Plaid Hosted Link
  against the real API; the HTML dialogs.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `claude/bank-import-plaid`

## 2026-11-07 — First build: the whole workbook from one Apps Script project
- What changed: a from-scratch rebuild of the Household Finance Tracker as a
  versioned Apps Script. `buildWorkbookWithSample` creates all 20 tabs in the
  handoff's phase order (reference tables → raw ledgers → import
  infrastructure → derived reporting → Dashboard → QA) with formulas,
  dropdowns, conditional formatting, named ranges, tagged sample data and a
  Finance Tracker menu. Fixes the three defects from the handoff (Dashboard
  Federal Tax rows and payroll headers; Monthly Budget soft-delete filter;
  Source Income ID validation plus an auto-link helper) and normalizes the
  Child Expenses taxonomy. Adds a split-transaction helper, Change Log
  capture on edit, a net-worth snapshot helper, in-sheet QA and a web-app
  scaffold. Details in `docs/BUILD_NOTES.md`.
- Files to paste into Apps Script (a brand-new blank Sheet): all nine files
  in `apps-script/` — `Config.gs`, `Helpers.gs`, `Reference.gs`, `Tables.gs`,
  `Dashboard.gs`, `SampleData.gs`, `QA.gs`, `Main.gs`, `Api.gs` — each as a
  Script file of the same name. Then run `buildWorkbookWithSample` once.
- Sheet changes needed (tabs, headers, settings): none by hand; the script
  creates everything. Do not run the build on a Sheet that holds real data.
- Tested: Node tests (`tests/run-tests.js`) pass. Confirmed in Google on
  2026-11-07: `runQA()` all PASS.
- Conversation: https://claude.ai/code/session_01XRPeQZr4LZj8gNZ59qZQ2V
- Branch: `main` (initial commit), then `claude/split-files-and-handoff`
  (repository layout to match the school-tools process; handoff page).
