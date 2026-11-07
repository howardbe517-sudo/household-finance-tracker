# STATUS

Last updated: 2026-11-07 (bank feed deployed and first bank connected)

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
