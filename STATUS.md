# STATUS

2026-11-27 (build 1.37.2): a charge under $20 at a gas station (a station
whose Import Rule files it as Fuel) now comes in as Food / Snacks; the $1
hold a pump places stays Fuel. The owner went through every uncategorized
Import Staging row with Claude; the reviewed rows import at the next Sync.
New rules for Comcast (internet, also a Recurring Payments row), Home Depot
and several shops. Left for the owner: a Meijer charge, a PayPal charge
(check PayPal activity) and a Target charge were skipped for now.
**Reminder for the next conversation:** go over the flagged American Express
Pay Over Time interest row on Import Staging (how to file it) and whether to
untick Interest Paused? on the Amex row of the Debts tab.

2026-11-26 (build 1.35.0): summary boxes on Financial Summary and Spending
list what makes up each number, one item per line (option A from the
mockups). One-off pay (Side Income etc.) no longer becomes a regular
paycheck (1.34.2); the modeling row on Expected Income is switched off.
Waiting for the owner's upgrade.

2026-11-26 (build 1.34.1): bigger boxes on Spending and Financial Summary;
Fixed vs flexible says it counts what was spent so far this month. Waiting
for the owner's upgrade. The second earner's paycheck is set to
Semimonthly, Paydays 1, 15; her modeling pay (Income, paid through Venmo)
and the meat bought with it are entered on checking; the Venmo deposit to
checking is to be marked a Transfer when it arrives.

2026-11-25 (build 1.34.0, schema 3.22): Expected Income gains Paydays (days
of month); twice-a-month paychecks land on them on the calendar, weekend
paydays on the Friday before. Waiting for the owner to run the upgrade;
then Claude sets the second earner's paycheck to Semimonthly, `1, 15`.

2026-11-25 (no code change): more receipt photos entered through Paste
Import; all matched and split, or wait for their charge to post. Bottle
returns on a receipt lower groceries (PROJECT.md, Rules). A partly finished
split seen mid-import turned out to be the import still running; it is slow
because it writes cell by cell.

2026-11-21 (builds 1.33.0–1.33.1, schema 3.21): receipt photos split card
charges (Receipts tab, RECEIPT Paste Import block; Claude can also enter
receipts straight onto Receipts and the next sync splits them). The first
real receipts were entered and wait for a sync. Rules for money going out no
longer turn money coming in into an expense. The Target → groceries rule is
off. Open: whether to add the past purchases from a household member's old,
unconnected checking account (asked); a pending return will come as its own
receipt.

2026-11-16 (builds 1.26.1–1.28.0, schema 3.19): card amounts owed include
charges still pending at the bank (live; the owner ran the upgrade and QA,
the card figure checked against Import Staging). Bills & paychecks calendar
(Finance Tracker → Bills & paychecks calendar…): bills, paychecks, utility
bills and estimates, card minimums, card payments on the card's Payment Due
Day (Accounts) at what is owed now, bills charged to such a card counted once,
late Venmo childcare matched to the Friday before it, hand ticks for "paid,
not in the tracker yet". Childcare (REC-013) Next Payment Date set to a
Friday. Only the Elan card is used day to day (the owner, 2026-11-16).
QA on 2026-11-16 reported 1 of 121 checks failing; the failing line was cut
off in the pop-up (asked the owner for it from Executions).

2026-11-15 (build 1.25.0, schema 3.18): Parked for Bills removed completely
(formulas, Fund Type list, blank lines); the data reviewer re-checks only
after a Must fix. AI snapshot export rewritten to match the workbook (build 1.26.0).

2026-11-15 (build 1.24.1): bills are paid from checking; the parked-in-savings
display and the parked car-payment pot are removed (see CHANGELOG).

2026-11-15 — credit cards (the owner's decision): the Elan and Capital One
Quicksilver cards are everyday cards paid in full every week or two. Their
purchases are spending; paying them is a Transfer; they have no Debts row (the
feed's pairing then records the payment as a Transfer on its own). What is
owed still shows on the Financial Summary and counts in net worth through
Accounts. The American Express card is debt being paid down: it keeps its
Debts row and its payments stay Debt Payments. Done in the Sheet: the two
Debts rows (and the old duplicate row) emptied, the Elan payment rule and the
one past Elan payment changed to Transfer. Utilities stay on the Utilities
tab; Fixed Costs uses their 12-month average (offered, not decided: a
same-month-last-year figure for month-by-month planning).

## Raise first at the start of the next conversation (the owner asked, 2026-11-15)
- **Amazon Prime (the owner asked, 2026-11-16):** remind the owner to fill
  in Amazon Prime's Amount, Frequency, Due Day and Account ID on Recurring
  Payments (REC-012) so it shows on the calendar.
- **Coming In vs Expected Take-Home (the owner asked to be reminded):** come
  back to why the Spending tab's "coming in" for a typical month differs from
  the expected take-home.
- **Missing Costco months: answered 2026-11-15.** The owner pulled the full
  receipt history from Costco's own records (51 receipts, 2024-01-05 to
  2026-11-14). Every trip was already in the tracker except Costco's copy of
  the 2026-11-14 trip (entered from the photo; same items and totals), which
  is now marked as confirmed. The empty months are real: Costco has no
  receipts for them. Still offered, not decided: show months without
  receipts as a gap instead of $0 on Grocery Charts. Also asked: whether the
  $5.06 Costco charge on 2026-11-14 (no matching receipt; likely the food
  court) should be Dining Out.
- Also open: label paychecks by employer on the Spending tab's Expected
  Take-Home line ("Ben 4 paychecks … Ben 2" is confusing); confirm Valerie's
  and Rockford's pay schedules (both still guessed as every two weeks);
  price-per-size comparison deferred ("not now"); the Meijer 2026-11-08
  receipt has one combined line for four items whose prices were unreadable.

2026-11-15 (builds 1.22.x–1.24.0): Groceries tab with item detail from
receipts (Costco export, receipt photos from Costco, Meijer, Target), each
store's share of groceries, alcohol counted as groceries with its own
column; Grocery Charts tab (Costco food and all-store groceries, each month
and 3-month average, $100 scale); Acorns counted only as a subscription
until it is closed; About your accounts is a reading section. The owner has
run the upgrade through 1.24.0's predecessor; 1.24.0 still to run.

2026-11-15 (build 1.22.0, schema 3.17): Groceries tab, Grocery Items and
Grocery Item Names. Costco history (export through 2026-10-25) and the
2026-11-15 receipt photo are loaded by Claude after the owner runs Upgrade
workbook. The 2026-11-15 photo trip's date is assumed (the photo cut off the
date line). Groceries counted as Food → Groceries at Costco include snacks
and drinks; beer is Food → Alcohol.

2026-11-14 (build 1.21.0): About your accounts opens with a note from App
Setup. The owner could not reach miAccount, Voya or HealthEquity yet, so
the note says the plan details still need checking; the Information
Checklist lists what to confirm. Upgrade workbook still to run (delivers
1.20.0 and 1.21.0 together).

Last updated: 2026-11-12 (Dashboard retired into Spending and Financial
Summary, build 1.13.0; income from deposits 1.12.0; earlier:
everything merged and deployed through PR #51; the agent merges pull requests once checks pass, see
AGENTS.md section 7)

## Where the owner is (2026-11-12)
- Connected (5 logins): Capital One (card + auto loan), Fidelity (Roth
  IRA), Independent Bank (checking, savings), American Express, and Elan
  (CONN-005) for the Independent Bank card. The Elan card row (ACC-017)
  was moved from the Independent Bank login, which only showed its balance,
  to the Elan login, which carries purchases; its last four are now 7763
  (2498 was the account number). Purchases from 2026-11-01 are flowing.
- Live balances on Sync now; from PR #39 the nightly run also refreshes
  balances when a bank has nothing new.
- Tabs: Start Here (the guide), Financial Summary, Spending, Utilities,
  Savings & Reserves, Debts, Goals, … Reminders last.
- Rules in the Sheet (Import Rules): car payment, Acorns, Fidelity, State
  Farm, Elan payment (both sides), car-payment transfers into savings
  (turned off 2026-11-15: bills are paid from checking and the parked pot
  FUND-005 is removed), and the
  card's merchants (Netflix, Audible, Marathon, Consumers Energy, YMCA,
  Ring, Lyon Street Cafe, Martha's Vineyard, Nantucket Baking, Apple,
  Anthropic, Netlify, Amazon Prime auto-import; Meijer and Target pre-fill
  only because those trips get split). Every sync re-applies rules and
  imports rows ticked Reviewed?.
- Recurring Payments: rent (1st), car payment (2nd), car insurance (2nd),
  IRS plan (15th), subscriptions Netflix, Audible, Ring, Apple, Anthropic,
  Netlify, Amazon Prime (price unknown), membership YMCA.
- The owner still has to run **Upgrade workbook** once after PR #40 and
  **Sync now** (step page `handoffs/2026-11-12-wrap-up.json`).

## Two tabs instead of three (2026-11-12, build 1.13.0)
- The Dashboard tab is retired. Spending is "how this month is going" (the
  Selected Month is typed in Spending!B3); Financial Summary is "where you
  stand" and opens with the account balances. See CHANGELOG and PROJECT.md.
- Spending compares each category with a typical month chosen by Compare
  with (E3). The owner asked for no "on pace" projection; none exists.
- With transactions only from November 2026, Typical Month shows a dash
  until December. Offered, not decided: pulling August–October from the
  banks so averages start sooner (would mean rows to categorize).
- The owner has to run **Upgrade workbook** once (step page
  `handoffs/2026-11-12-spending-this-month.json`); it also covers builds
  1.12.0 and 1.12.1 if that upgrade has not been run yet. The new Spending
  formulas are not yet confirmed in Google.
- The old Dashboard tab is hidden, not deleted; the owner may delete it.
- Build 1.13.1: the three Spending tiles carry hover lists (fixed and
  flexible, needs and wants, recurring bills), refreshed by every sync and
  by edits to the month, Transactions and Recurring Payments.
- In the Sheet: REC-013 Nanny, weekly, on Recurring Payments (the owner:
  roughly the same every week), so the monthly plan's bills include
  childcare and the flexible figure is lower by its monthly equivalent.
- Rent (answered 2026-11-12): paid by Venmo; the owner wants it recorded on
  the 1st at the fixed amount. Build 1.14.0 (schema 3.13) adds Record
  Automatically? on Recurring Payments and `recordRecurringBills_`. After
  the upgrade the owner ticks the box on the Rent row (REC-001); Venmo
  rent payments get Housing / Mortgage or Rent on Import Staging and
  reduce the automatic entry. The staged Venmo payment of November 2 has
  been given that subcategory.
- Edge to watch: a rent payment made in the last days of the month before
  counts in that month, not the month it is for.
- Build 1.15.0: the Financial Summary's four average cards became Coming
  In, Fixed Costs, Flexible Spending (average) and Likely Left Over; its
  debt section and the Debts tab band show one Household Debt total (no
  student-loan split, no Current Quarter Ends) with the debts listed
  underneath. The owner keeps his own student loans off the books and
  tracks PSLF only.
- Owner's note: he likes the Spending tab as it is now.
- 2026-11-14, build 1.20.0 (schema 3.16): About your accounts under the
  Savings & Reserves table; descriptions in Accounts' About This Account.
- 2026-11-13, build 1.19.0: Payroll Deductions on the Financial Summary
  show each job's latest stub per paycheck (owner: the percentage of a
  paycheck should not depend on how many paychecks a month has).
- 2026-11-13, build 1.18.0: Plaid does not support the owner's Voya plans
  ("Voya Retirement Plans" returns Institution Not Supported). The owner
  chose hand updates plus a reminder: Reminders lists unconnected
  retirement, HSA and investment accounts every six months (setting on
  App Setup; changed from three to six at the owner's request). The Acorns account has no balance yet, so it will be listed
  at once.
- 2026-11-13, build 1.17.0 (schema 3.15): the school paycheck pays into the
  HSA (ACC-013), the state 457 (ACC-019) and 401(k) (ACC-020), all at
  Voya or HealthEquity and not connected. Each account's source and
  per-paycheck amount (stub: employee + employer lines) now sit on
  Accounts. Owner to try Plaid's "Voya Retirement Plans (my.voya.com)";
  if it connects, the per-paycheck additions stop for those accounts.
- 2026-11-13, build 1.16.1: Food / Coffee & Snacks split into Coffee Shops
  and Snacks (owner wants coffee tracked separately); Sheet data moved.
  All staged rows categorized with the owner on 2026-11-13.
- 2026-11-13, build 1.16.0 (schema 3.14): HealthEquity HSA (ACC-013) cannot
  connect (passkey login; community reports say aggregators mostly fail).
  Expected Income EXP-003 (Rockford) now has Payroll Deposit To = ACC-013
  and the per-paycheck HSA amount; each Rockford paycheck adds it to the
  HSA balance. Waiting on the owner for the starting balance. MOHELA - DOE
  shows "Connectivity down" in Plaid for days; no fix date known.
- 2026-11-13, build 1.15.1: fixed a month count that read an empty window
  as one month (Financial Summary flexible average showed $0, so Likely
  Left Over was overstated; Spending showed $0 typical figures instead of
  a dash). Hover notes reduced to one per tile. The owner has to run
  Upgrade workbook once more.

## Income from deposits (2026-11-12, build 1.12.0)
- The owner will not upload every pay stub. A paycheck deposit in checking
  now becomes its own Income row at the next sync (see CHANGELOG and
  PROJECT.md). Gross and deductions on those rows are estimates from the
  last stub per employer; take-home is the real deposit. A stub is optional
  and replaces the estimate when pasted.
- In the Sheet: Import Rules RULE-024 (Martha's Vineyard payroll, hourly)
  and RULE-025 (Rockford Schools payroll, salary), both checking only,
  Person Ben, auto-import.
- The owner has to run **Upgrade workbook** once (step page
  `handoffs/2026-11-12-income-from-deposits.json`). Expected result: the
  one unlinked payroll deposit gets its Income row and the QA flag
  "Missing Source Income ID" clears.
- Pay stub reminder (build 1.12.1): Reminders lists a regular paycheck
  when its last real stub is older than six months (App Setup setting).
  With the stubs entered in late October and early November 2026, the
  first reminders are due around May 2027. The Reminders formula for this
  is not yet confirmed in Google.
- Open: Valerie's pay has not been seen arriving in a connected account
  (her stub mentions a savings allocation). Until it is, her paychecks
  count only from stubs.

## Utilities (2026-11-12)
- Utilities tab, Utility Bills table and the Fees block on the Financial
  Summary are merged, deployed and upgraded in the owner's Sheet.
- Loaded into Utility Bills from the owner's statements on 2026-11-12 (data
  lives in the Sheet only): 18 electric bills (Consumers Energy), 18 gas
  bills (DTE) and 4 quarterly water and sewer bills (City of Grand Rapids),
  with the three water late fees in Late Fee and one card processing fee
  in Card Fee. Bills due in December (gas, electric) and the October water
  bill are marked Due.
- Open: whether the October water bill has been paid (a past-due notice
  was issued); whether the owner pays water in full or by the city's
  monthly option (installments would need matching to their quarter); how
  DTE is paid (no DTE payment appears on a connected account; gas bills
  have no Paid On dates); other card payments that carry fees.

## Open items
- **American Express has sent no transactions** since it was connected on
  2026-11-08 (balance and lender data arrive). Asked the owner to try
  Bank feed → Repair a connection for Amex.
- (Corrected) The nightly sync is not missing: the Sheet runs on
  America/Detroit time, where it was still 2026-11-11 evening; the last run
  was 2026-11-11 05:21 and the next is the following 5 a.m.
- The card-merchant rules added 2026-11-11/12 take effect at the next sync
  (Sync now or the nightly run); until then the Elan purchases wait on
  Import Staging and Spent So Far does not include them.
- Amazon Prime: price, monthly or yearly, and paying card unknown; no
  Prime charge on any connected card since 2026-11-01. The owner will check
  amazon.com → Prime membership.
- Elan card: due day, minimum payment and APR not on Debts (Elan's login
  offers no liabilities data); needed for the Dashboard Due cell and the
  Payoff planner's all-debts view.
- Still unknown: how rent is paid, Acorns frequency, the account that pays
  State Farm, the $500 Venmo on 2026-11-02, the bank wording of the IRS
  payment (rule to add when it first appears on 2026-11-15).
- HealthEquity HSA and the MOHELA student loans (Mohela - DOE accounts)
  not connected; Plaid showed a warning on both. Retry later.
- Housekeeping the owner can do: delete Accounts rows ACC-009 and ACC-014
  and Debts row DEBT-006 (duplicates, marked in their Notes); the leftover
  `claude/ci-probe` branch on GitHub.
- Offered, not yet taken: a "current month so far" row on the Financial
  Summary history; a Reminders line for connections not synced in two
  days.

## Works
- The full build (`buildWorkbookWithSample` / `buildWorkbookEmpty`): now 22
  tabs (Import Rules and Connections added). Confirmed in Google for the 3.0
  schema on 2026-11-07 (all QA checks passed); the 3.1 additions are tested
  in Node only so far.
- Bank-import engine (`Import.gs`): Import Rules matching (Contains / Starts
  With / Exact, optional account scope), classification, transfer and
  card-payment pairing, pending→posted supersede, bank removals → soft
  delete, *Import reviewed rows* with held-back reasons, *Make a rule from
  the selected row* (applies to waiting rows and auto-imports when asked),
  *Re-apply rules*, the split panel (tested in Node).
- Plaid (`Plaid.gs`): Hosted Link connect flow, token exchange into Script
  Properties, account mapping (link existing / create new), first sync,
  nightly cursor sync over several pages, start-date filter, balances,
  repair in update mode, layout check, trigger on/off, status without
  secrets (tested in Node against a mocked Plaid).
- `upgradeWorkbook()` (`Upgrade.gs`): adds tabs, appended columns, renamed
  headers (`renamedFrom`), new lists and list values; refreshes formulas,
  validations, formatting and the documentation tabs; preserves settings,
  the Dashboard month and the checklist; idempotent; stops on a hand-renamed
  header (tested in Node on a simulated 3.0 workbook).
- Student loans separated from household debt: Debt Group on Debts (and
  calculated on Quarterly Debt Review); Debts KPI band; Monthly Summary
  *Reviewed Household Debt* + *Student Loan Balance*; Monthly Review
  *Household Debt Balance* + *Student Loan Balance*; Dashboard footnote.
- *Copy financial snapshot for AI* (`Export.gs`): plain-text briefing built
  from entered columns; tested in Node against the sample data.
- Earlier: menu helpers, onEdit change log, API scaffold, in-sheet QA.

## Confirmed in Google (2026-11-07)
- `upgradeWorkbook` on the live workbook: completed; a second run reported
  nothing left to add. All QA checks pass on the deployed 3.1 code.
- Automatic deploy: the first merge pushed 18 files with clasp.
- Plaid, first live connection (Capital One): Hosted Link → token exchange →
  account mapping → first sync all worked; a transaction landed in Import
  Staging and the balance was written. Capital One returned the credit card
  and the auto loan.
- Plaid reported Independent Bank (MI) as down ("Connectivity down") at the
  time; to be retried. No slot is used by a failed attempt.

## Known issues
- The owner's Accounts tab has a duplicate card row (ACC-014) created by the
  first mapping before the pre-select fix; it is neutralised (not linked,
  Include in Net Worth = No) and the owner can delete the row by hand.
- Fidelity may need an access request on the Trial plan; unknown until tried.
- `upgradeWorkbook()` does not add sample Import Rules / staged rows to an
  existing workbook (only a fresh build has them). The owner's first review
  will use real rows from the first sync.
- The owner's Apps Script project keeps `Config.gs` under the editor's
  default name `Code.gs`. Harmless; handoff pages say "Code.gs (Config)".
- Simple `onEdit` triggers cannot always read the editor's email on personal
  accounts, so Change Log "User" and Updated By may be blank.
- Formula rows are pre-filled to a cap per table (Transactions 1,004, Import
  Staging 1,004). *Extend formula rows* adds more; the sync extends
  automatically when it writes past the cap (`writeRows_` → `extendTable_`).

## In progress
- Pull request `claude/dashboard-polish-funds`: equal card widths, gross
  faded by colour only, funds created from savings-type accounts with live
  balances, Summary averages over months with paychecks.
- Owner reports (2026-11-09): payroll deductions looked empty because the
  Summary averaged Aug–Oct while the stubs are Oct/Nov (fixed by the window
  change); Savings & Reserves was empty because no fund rows existed (now
  created automatically).
- Pull request `claude/two-page-dashboard`: Dashboard trimmed to the month
  (gross faded, take-home prominent, spent so far); new Financial Summary
  tab with averages, month by month, funds, debts, income by person, payroll
  deductions, credit scores, net worth. Includes the paycheck-count dot fix
  (pull request #24 becomes redundant).
- Pull request `claude/expected-income` (schema 3.4): Expected Income tab,
  automatic flexible target on Monthly Plan, Dashboard expected line. After
  merge: Upgrade workbook, then check the created Expected Income rows.
- Owner's model (2026-11-09): monthly plan = typical take-home (three
  regular paychecks across the household) + adjustments − bills − debt
  payments − planned savings = flexible; weekly guidance from that.
- Pull request `claude/paystub-import`: Paste Import tab + import function,
  and the pay stub skill under `skills/`. Owner to install the skill in
  claude.ai and try a real stub.
- Next (owner's request 2026-11-09): a Debts "interest paused" switch that
  zeroes the estimated interest while relief is in effect.
- Pull requests `claude/reminders-last-tab` (#17) and
  `claude/dashboard-card-fixes` (#18) awaiting merge. Connected so far:
  Capital One, Fidelity, Independent Bank (checking, savings, Elan card),
  American Express. Owner to delete Accounts row 8 (ACC-009) and Debts row
  10 (DEBT-006) by hand.
- Pull request `claude/accounts-dashboard` (stacked on
  `claude/credit-score-reminder`): accounts block at the top of the
  Dashboard, new tab order, auto IDs for typed rows. Owner's rent row on
  Recurring Payments given REC-001 and Active by hand.
- Parked by the owner: a Claude project with skill files that turn pay
  stubs, payment schedules and receipts into rows for the Sheet (questions
  asked 2026-11-09: write via the Sheets connector or paste; order of
  document types; receipts matched to staged transactions or standalone).
- Pull request `claude/credit-score-reminder`: credit scores join the
  reminders with their own months setting; reminders move to a Reminders tab.
- Pull request `claude/goals-tab`: Financial Goals on their own tab (third
  tab); Reminders stay on the Dashboard.
- Pull request `claude/pension-in-snapshot`: Pension account type; AI
  snapshot lists pensions from Notes; never counted as an asset. ACC-016
  (pension, Include in Net Worth = No) added to the owner's Accounts tab.
- Retirement plans: the owner has not yet located the providers (paystub /
  HR); connect each as Investment or retirement account once registered.
- Pull request `claude/goals-and-reminders`: Financial Goals boxes on the
  Dashboard (K:N) and a Reminders box + monthly reminder email for stale
  PSLF counts. After merge: Upgrade workbook, then Sync now (approve the
  email permission).
- Pull request `claude/liabilities-pslf-automation` (schema 3.2): lender
  data into Debts, loan-servicer connections with automatic Debts rows,
  PSLF estimate, self-adding month rows. After merge: Upgrade workbook, then
  Sync now; connect the two student loan servicers as the Loan kind.
- Owner's standing request (2026-11-07): automate everything possible; the
  only typing left by design is the PSLF official count from studentaid.gov
  (no feed exists), the tax debt balance, and credit scores.
- Sample data cleared by the owner on 2026-11-07 (QA then: 2 problems, both
  fixed by `claude/clear-sample-nw-helper`; Upgrade workbook redraws the
  net-worth box). Connected: Capital One (CONN-001), Fidelity (CONN-002).
  Plaid's dashboard shows 3 of 20 connections (one orphaned Fidelity attempt).
- Connecting the remaining institutions (Independent Bank once Plaid's
  connection is back, PayPal, Amex, Venmo; balance-only Acorns, Fidelity,
  HealthEquity); then Clear sample data; then real paychecks, funds, debts
  and the flexible target.
- HealthEquity: Balance only (`auth`) now reaches Plaid's sign-in page, but
  Plaid's log shows INTERNAL_SERVER_ERROR with a 0% success rate for the
  institution (Classic integration outage on Plaid's side). Retry in a few
  days; if it stays down, the HSA balance is entered by hand on ACC-013.
- Fidelity: connected in Plaid (CONN-002, Pending) but the accounts were not
  matched because Finish connecting opened on step 1. Pull request
  `claude/finish-connecting-resume` fixes that; afterwards the owner runs
  Bank feed → Finish connecting once and matches the Roth IRA to ACC-012.

## Bank feed decision (2026-11-07)
- Feed: **Plaid, free Trial plan** (capped at 20 connections per the owner's
  dashboard, earlier believed to be 10; no
  time limit). The owner created the Plaid team (personal use, personal
  finances) and confirmed the plan reads Trial. Never submit a Production
  application: it permanently ends the Trial.
- Coverage confirmed by the owner in Plaid's institution directory:
  Independent Bank (Michigan), Capital One, PayPal, Acorns, Fidelity,
  HealthEquity. PayPal has no Auth product, which the tracker does not use.
  Venmo and American Express are to be connected as well (owner's request):
  9 connections in all, 1 spare.
- Transactions + balances: Independent Bank (3 accounts), Capital One,
  PayPal, Venmo, Amex. Balance only: Acorns, Fidelity, HealthEquity.
- Review rule: everything waits for the owner's weekly review except rows a
  rule marks Auto-import (bills, subscriptions, paychecks matched by source
  text) and detected transfer / card-payment pairs (App Setup setting, on by
  default). Merchants with mixed baskets (Meijer, Walmart, Target, Costco)
  get Split-required rules and go through the split panel.
- History: from a start date the owner sets (`PLAID_START_DATE`) before the
  first connection.
- Slots are consumed only when a bank is connected and are never returned:
  repairs use update mode; the connect dialog lists existing connections and
  warns.

## Next
- Owner: merge the PR, follow the Bank Feed Setup handoff page (paste 14
  files, run `upgradeWorkbook`, add the two Plaid keys, set the start date,
  connect the nine institutions, turn nightly sync on), then send the first
  QA result and anything the Plaid dialogs say.
- Owner: enter the real debts (tax debt; Capital One, Independent Bank and
  Amex cards; two student loans with Debt Group = Student Loans; car loan)
  with balances, APR, minimum payment and due day; add Amex and Venmo
  account rows (the connect flow can create them).
- Fix whatever the first real Plaid run surfaces; update this file with what
  was confirmed in Google.
- Receipt photo → AI-filled split lines (next phase, needs an AI key).
- Web app on top of `Api.gs`.

## Tested here vs. still to test in Google
- Tested here (`node tests/run-tests.js`, mocked Sheets + mocked Plaid): see
  CHANGELOG 2026-11-07 (bank feed) for the list; 180+ checks pass.
- Confirmed in Google (3.0 schema, 2026-11-07): the full build, all QA
  checks, Dashboard formulas, weekly guidance, split balance, income links.
- Still to test in Google: `upgradeWorkbook` on the owner's live workbook;
  Hosted Link end to end (dialog, Plaid's page, token exchange, mapping);
  the first and nightly syncs; the pending→posted and removal paths with real
  data; the split panel and rule dialog as rendered by HtmlService; the
  installable trigger; QA's new checks.
