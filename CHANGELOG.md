# CHANGELOG

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
