# STATUS

Last updated: 2026-11-07 (first build confirmed in Google)

## Works
- The full build (`buildWorkbookWithSample` / `buildWorkbookEmpty`): 20 tabs,
  every table with headers, number formats, dropdowns, pre-filled formulas,
  conditional formatting and named ranges; Dashboard; App Setup data
  dictionary; Start Here checklist (tested in Node only).
- Sample data covering every acceptance scenario in the handoff, generated
  relative to the build date and tagged `SAMPLE` (tested in Node only).
- Finance Tracker menu and helpers: QA, link income deposits, split a
  transaction, record net worth snapshot, extend formula rows, clear sample
  data, rebuild (logic tested in Node; dialogs not).
- `onEdit` change-log capture and Transactions timestamps (tested in Node).
- API scaffold: append, update, soft delete, list; rejects writes to
  calculated sheets (tested in Node; never deployed).

## Known issues
- The owner's Apps Script project still holds the code as one file
  (`Code.gs`, pasted from the retired single-file bundle). The first change
  that ships will have the owner replace it with the nine named files so
  later updates touch only the file that changed.
- `buildWorkbook()` is a from-scratch builder. There is no upgrade path yet
  for a workbook that already holds real data; the first change requested
  after real data is entered must add one (see Next).
- Simple `onEdit` triggers cannot always read the editor's email on personal
  accounts, so Change Log "User" and Updated By may be blank.
- Formula rows are pre-filled to a cap per table (Transactions 1,004). The
  Extend formula rows menu item adds more; the future app should call
  `extendTable_` when a table nears its cap.

## In progress
- Owner's visual review of the Dashboard (QA checks logic, not looks).

## Bank feed decision (2026-11-07)
- Feed: **Plaid, free Trial plan** (capped at 10 connected institutions, no
  time limit; the owner needs 6). The owner created the Plaid team
  (personal use, personal finances) and confirmed the plan reads Trial.
  Never submit a Production application: it permanently ends the Trial.
- Coverage confirmed by the owner in Plaid's institution directory:
  Independent Bank (Michigan), Capital One, PayPal, Acorns, Fidelity,
  HealthEquity all present. PayPal has no Auth product, which the tracker
  does not use. Transactions + Balance for Independent Bank (3 accounts),
  Capital One and PayPal; Balance (or Investments) only for Acorns, Fidelity
  and HealthEquity.
- Not yet done, on purpose: no bank connected, no API keys created. Slots
  are consumed only when a bank is connected and are never returned, so the
  connect page must block duplicate connections and repairs must use
  Plaid's update mode, never remove-and-reconnect.
- Plan for the Plaid conversation: upgradeWorkbook() adding Accounts ·
  External Account ID, Import Staging · Pending Transaction ID and a
  Connections tab; staging → review → Transactions promotion with
  transfer-pair and credit-card-payment rules; nightly /transactions/sync
  per connection with a header check that pauses on a changed layout;
  balances for the three balance-only accounts; a connect-a-bank page
  served by Apps Script; Plaid keys and access tokens in Script Properties.

## Next
- After the first look in Google: fix anything the QA report or the owner
  flags, then update this file with what was confirmed.
- Add `upgradeWorkbook()` (add/repair tabs, columns, formulas and validations
  without touching entered rows) before any change ships to a workbook with
  real data.
- Owner enters real accounts, debts, funds, paychecks, flexible targets and
  credit scores, then runs Clear sample data…
- Later phases from the handoff: Plaid → Import Staging, receipt AI → split
  children, web app on top of `Api.gs`.

## Tested here vs. still to test in Google
- Tested here (`node tests/run-tests.js`, mocked sheet): the build completes;
  20 tabs in order; Transactions is A:AF with the handoff's column order; all
  15,000+ formula cells have balanced parentheses, resolved references, known
  function names and existing sheet names; validations present on every
  dropdown column; no merged cells inside raw tables; Dashboard Federal Tax
  formulas and payroll headers for all three groups; Monthly Budget Actual
  carries the soft-delete filter; sample split balances; paychecks link to
  deposits; eight real accounts with blank balances; no credit scores; the
  helpers, onEdit, API append/soft-delete, and Clear sample data run and do
  what they should.
- Confirmed in Google (owner's build, 2026-11-07, `runQA()` all PASS): no
  formula errors on any of the 20 tabs; headers, validations and no-merge
  rule on every table; Monthly Summary, Monthly Budget, Monthly Plan
  (including the current-month `LET` weekly guidance), fund balances, debt
  balances and split balance all match independent recomputation with the
  soft-deleted row excluded; every paycheck linked to its deposit; Dashboard
  cards, payroll headers and Federal Tax rows match Income; the flexible
  section follows today's month; credit scores blank. The build itself
  completed within the execution limit.
- Still to test in Google: SPARKLINE bars once a credit score is entered;
  the Dashboard's look (owner review); the menu dialogs (split, clear sample
  data, rebuild, record snapshot) and the onEdit change-log capture in use.
