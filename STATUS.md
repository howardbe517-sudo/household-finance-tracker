# STATUS

Last updated: 2026-11-07 (bank feed built; not yet run in Google)

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

## Known issues
- **The 3.1 build has not run in Google yet.** First the owner pastes the
  files and runs `upgradeWorkbook`; then the Plaid flow runs for real for the
  first time. Expect adjustments, especially around Hosted Link's response
  shape (`/link/token/get` → `link_sessions[].results.item_add_results`) and
  whether Fidelity needs an access request on the Trial plan.
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
- Pull request `claude/bank-import-plaid` (16 files to paste); handoff page
  `handoffs/2026-11-07-bank-import.json`.

## Bank feed decision (2026-11-07)
- Feed: **Plaid, free Trial plan** (capped at 10 connected institutions, no
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
