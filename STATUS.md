# STATUS

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
  (parked pot FUND-005, Starting Amount 71.64, Target one payment), and the
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
- 2026-11-13, build 1.18.0: Plaid does not support the owner's Voya plans
  ("Voya Retirement Plans" returns Institution Not Supported). The owner
  chose hand updates plus a reminder: Reminders lists unconnected
  retirement, HSA and investment accounts every three months (setting on
  App Setup). The Acorns account has no balance yet, so it will be listed
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
