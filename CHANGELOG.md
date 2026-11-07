# CHANGELOG

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
