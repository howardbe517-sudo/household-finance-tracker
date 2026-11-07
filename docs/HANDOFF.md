# Household Finance Tracker — Complete AI Rebuild Handoff

> Original specification supplied at the start of the 3.0 rebuild (2026-11-07), preserved verbatim.
> Decisions made while implementing it are recorded in `BUILD_NOTES.md`.

## 1. Project purpose

Rebuild a household-finance Google Sheet that functions both as:

1. a usable standalone household finance tracker in Google Sheets; and
2. a database/backend that can later support a web app.

The workbook should be database-first rather than merely a collection of visual budgeting worksheets.

The central design philosophy is:

- Raw financial records live in normalized tables.
- One record equals one row.
- Stable IDs are used to connect tables.
- Raw/backend tables should not use merged cells.
- Dashboard/presentation areas may use merged cells.
- Calculated summaries should reference raw tables rather than duplicate data.
- Financial records should use soft deletion rather than hard deletion.
- Months are stored as actual first-of-month dates, not text such as "August 2026."
- Google Sheets remains useful even before Plaid, receipt AI, or a web app is implemented.

Current workbook title:

`Household Finance Tracker — Rough Draft`

Current spreadsheet ID:

`1N5XqSCweEvQxs10jwe3beFRpCKDGpUxF4OzcCTcIQe8`

Current schema version recorded in App Setup:

`2.0-audit-2026-08-12`

---

# 2. Core financial model

There are several separate concepts that must not be conflated.

## Income

The `Income` table is authoritative for paycheck-level information.

It stores:

- gross income
- payroll taxes
- Social Security/Medicare
- insurance deductions
- retirement contributions through payroll
- other payroll deductions
- take-home pay

A bank deposit imported through Plaid can also appear in `Transactions`, but the Income table remains the source of truth for paycheck details.

## Spending

Actual spending comes from `Transactions`.

Normal spending calculation:

`Expenses - Refunds`

Transactions marked `Split Parent` are not included in spending because their child transactions represent the actual categorized spending.

## Savings

A savings transfer is not treated as ordinary spending.

A transaction with:

`Type = Savings`

represents money intentionally allocated to a tracked fund.

Payroll retirement contributions are different: those are recorded in the Income table and included in Total Savings through the Monthly Summary.

## Debt payments

Debt payments are tracked separately as:

`Type = Debt Payment`

A credit-card payment should generally not be treated as new spending if the purchases themselves were already recorded as expenses. In that situation, the payment is fundamentally movement of money to pay an existing liability.

## Transfers

Transfers between owned accounts are:

`Type = Transfer`

Transfers should affect neither income nor spending.

## Refunds

Refunds use:

`Type = Refund`

and reduce spending.

---

# 3. Workbook tabs

The workbook currently contains 20 tabs.

| Tab | Function |
|---|---|
| Start Here | Instructions, review cadence, implementation checklist |
| Dashboard | Household monthly snapshot and current flexible-spending view |
| Income | Paycheck/income database |
| Transactions | Master financial-event ledger |
| Recurring Payments | Expected bills/subscriptions/recurring obligations |
| Monthly Budget | Planned vs. actual spending by main category |
| Monthly Plan | Monthly flexible-spending target and weekly guidance |
| Monthly Summary | Calculated monthly reporting table |
| Savings & Reserves | Emergency fund, sinking funds and other savings funds |
| Debts | Master debt table plus estimated interest cost |
| Quarterly Debt Review | Periodic debt-balance snapshots |
| Net Worth Snapshots | Historical and current net-worth tracking |
| Accounts | Bank, credit, investment, retirement and asset accounts |
| Monthly Review | Structured household month-end review |
| Categories | Category taxonomy plus all dropdown/reference lists |
| App Setup | App architecture and data dictionary |
| Sources | Financial-guidance sources used during design |
| Import Staging | Future Plaid/raw bank import landing table |
| Change Log | Future append-only audit history |
| Credit Scores | Monthly manual credit-score history |

---

# 4. Dashboard design

The Dashboard is intentionally a summary. It should not become a second database.

## Selected Month

Cell `B3` holds a real first-of-month date.

Most Dashboard financial summaries respond to this selected month.

Important exception:

**Current Flexible Spending always uses the actual current calendar month/week**, not the selected Dashboard month.

That distinction is intentional.

---

## Top monthly summary

Current intended layout is four equal two-column cards across `A:H`.

Cards:

| Card | Source |
|---|---|
| Household Gross Income | Income gross pay |
| Household Take-Home | Income take-home |
| Spending | Monthly Summary |
| Total Savings | Monthly Summary |

Conceptually:

- A:B = Gross
- C:D = Take-Home
- E:F = Spending
- G:H = Total Savings

Gross and Take-Home use related but slightly different blue shades.

Spending uses peach.

Total Savings uses muted green.

Gross formula concept:

```text
SUMIFS(
  Income Gross Pay,
  Income Month,
  Dashboard Selected Month
)
```

Take-home is the same approach using Income take-home.

Spending comes from Monthly Summary column C.

Total Savings comes from Monthly Summary column K.

---

## Income by Person

This is deliberately compact and ends at column E.

Current structure:

| Person | Gross | Take-Home | Deductions | Take-Home % |
|---|---:|---:|---:|---:|
| Ben | formula | formula | formula | formula |
| Valerie | formula | formula | formula | formula |
| Household | total | total | total | total |

Deductions:

`Gross - Take-Home`

Take-home percentage:

`Take-Home / Gross`

Person rows use distinct fills:

- Ben: pale warm cream
- Valerie: peach
- Household: pale blue-gray

Do not stretch this table across the entire Dashboard.

---

## Credit Scores — Latest

Credit score belongs directly underneath Income by Person and is also deliberately compact.

Current layout is `A:E`.

| Person | Score | Rating | Updated | Position |
|---|---:|---|---|---|
| Ben | latest score | rating | date | bar |
| Valerie | latest score | rating | date | bar |

Dashboard formulas look at the Credit Scores tab and return the newest entry for each person.

Rating scale:

- 300–579: Poor
- 580–669: Fair
- 670–739: Good
- 740–799: Very Good
- 800–850: Exceptional

The Position column contains a horizontal SPARKLINE bar based on:

```text
(score - 300) / 550
```

Do not make this a large multi-row gauge display. The user wants it to function like a concise Dashboard summary.

The separate Credit Scores tab contains history.

---

## Payroll Deductions

The payroll section shows three parallel groups:

- Ben
- Valerie
- Household

Each group should display:

| Deduction | Amount | % of Gross |
|---|---:|---:|

Rows should include:

- Federal tax
- State/local tax
- Social Security & Medicare
- Health/insurance
- Retirement
- Other deductions
- Total deductions

All values come directly from the Income table for the selected month.

Ben section uses the same cream family as Ben's Income by Person row.

Valerie uses the same peach family.

Household uses pale blue-gray.

### IMPORTANT CURRENT DEFECT

The current live Dashboard appears to have lost the Federal Tax amount/% formulas during recent row/layout moves.

The labels are present, but the Federal Tax numeric formulas should be restored.

Also verify that each payroll group has all three headers:

`Deduction | Amount | % of Gross`

before considering the rebuilt Dashboard complete.

---

## Current Flexible Spending

This is a separate current-period planning section.

It does not follow Dashboard `Selected Month`.

It follows today's actual month and week.

Three blocks:

1. Amount Available This Month
2. Suggested This Week
3. Spent This Week

This section currently spans `A:I`, approximately three columns per metric.

The section label should dynamically say:

```excel
="Current Flexible Spending — "&TEXT(TODAY(),"mmmm yyyy")
```

Only transactions with:

`Spending Type = Flexible`

are used for weekly guidance.

Fixed, Planned Irregular and Unexpected purchases still count toward total monthly spending but do not reduce the weekly flexible allowance.

---

## Savings & Reserves Dashboard summary

The lower Dashboard displays the first several funds from Savings & Reserves with:

- Fund Name
- Target
- Current
- Amount Needed
- % Funded
- Status

A monthly-review checklist is displayed alongside it.

Debt balances are intentionally not made a major everyday Dashboard feature; debt is reviewed separately on a quarterly cadence.

---

# 5. Income table

Raw table starts on row 4 with data beginning row 5.

Columns:

| Col | Field |
|---|---|
| A | Income ID |
| B | Pay Date |
| C | Month |
| D | Person |
| E | Employer / Source |
| F | Income Type |
| G | Gross Pay |
| H | Federal Tax |
| I | State / Local Tax |
| J | Social Security & Medicare |
| K | Health / Insurance |
| L | Retirement Contribution |
| M | Other Deductions |
| N | Total Deductions |
| O | Take-Home Pay |
| P | Deposit Account ID |
| Q | Notes |
| R | Last Updated |

### Month formula

```excel
=IF(B5="","",DATE(YEAR(B5),MONTH(B5),1))
```

### Total deductions

```excel
=IF(A5="","",SUM(H5:M5))
```

### Take-home

```excel
=IF(A5="","",G5-N5)
```

Income is authoritative for paycheck details.

Do not build a separate monthly summary at the top of the Income tab. That was tried and intentionally removed because the tab contains multiple months and a "latest month" box was misleading.

The tab should remain:

1. title
2. short explanation
3. blank row
4. table header
5. data

Ben and Valerie rows use distinct background fills to make paycheck ownership visually obvious.

---

# 6. Transactions — central ledger

This is the most important backend table.

The raw table starts row 4 with data on row 5.

Current schema has 32 columns, A:AF.

| Col | Field |
|---|---|
| A | Transaction ID |
| B | Date |
| C | Description |
| D | Amount ($) |
| E | Type |
| F | Category |
| G | Subcategory |
| H | Account ID |
| I | Person |
| J | Household/Personal |
| K | Fixed/Variable (Deprecated) |
| L | Need/Want |
| M | Fund ID |
| N | Debt ID |
| O | Recurring? |
| P | Status |
| Q | Month |
| R | Notes |
| S | Created At |
| T | Updated At |
| U | Spending Type |
| V | Funding Source |
| W | Source Income ID |
| X | Is Deleted |
| Y | Deleted At |
| Z | Validation Flag |
| AA | Created By |
| AB | Updated By |
| AC | Split Role |
| AD | Parent Transaction ID |
| AE | Split Difference ($) |
| AF | Receipt Reference |

---

## Transaction Types

Current supported transaction types:

- Income
- Expense
- Savings
- Debt Payment
- Transfer
- Refund
- Split Parent

---

## Spending Types

Four values:

- Fixed
- Flexible
- Planned Irregular
- Unexpected

Meaning:

### Fixed

Regular/obligatory expense.

Included in monthly spending.

Not used in weekly flexible allowance.

### Flexible

Ordinary discretionary/adjustable monthly spending.

Included in monthly spending.

Also used in weekly guidance.

### Planned Irregular

Known irregular expense such as a planned trip or annual expense.

Included in spending in the month the purchase occurs.

Not part of weekly flexible allowance.

### Unexpected

Unplanned repairs, medical expenses, emergencies, etc.

Included in monthly spending.

Not part of weekly flexible allowance.

---

## Funding Source

Current values:

- Monthly Cash Flow
- Sinking Fund
- Emergency Fund
- Other

If Funding Source is:

`Sinking Fund`

or

`Emergency Fund`

then Fund ID is required.

A purchase funded from a sinking fund is **still an expense in the month of purchase**. The fact that money was saved earlier does not remove the purchase from spending reports.

---

# 7. Split transactions

This was added specifically for stores such as Target, Costco and Amazon, where one bank transaction may represent several spending categories.

Example:

Target bank transaction:

`$142.50`

Receipt contains:

- $62.50 Food / Groceries
- $48.00 Child Expenses / Supplies
- $32.00 Personal

## Parent row

The original bank transaction should remain in Transactions.

Example:

```text
Transaction ID = TX-...
Amount = 142.50
Type = Split Parent
Split Role = Parent
Account ID = original account
```

The parent preserves the bank/Plaid identity.

It does **not** count toward spending reports.

## Child rows

Add one row per categorized portion.

Example child:

```text
Type = Expense
Amount = 62.50
Category = Food
Subcategory = Groceries
Split Role = Child
Parent Transaction ID = parent's Transaction ID
```

Repeat for each component.

Child rows are what drive category spending.

## Split Difference

Parent row formula concept:

```excel
Original Parent Amount
-
SUM(all undeleted child rows whose Parent Transaction ID = parent Transaction ID)
```

Current formula pattern:

```excel
=IF(
 A5="",
 "",
 IF(
   AC5="Parent",
   D5-SUMIFS(
     $D$5:$D$1004,
     $AD$5:$AD$1004,$A5,
     $X$5:$X$1004,"<>TRUE"
   ),
   ""
 )
)
```

If absolute difference exceeds one cent, Validation Flag displays:

`Split Does Not Balance`

## Receipt Reference

Column AF is reserved for a receipt image/file reference.

Future desired workflow:

1. Plaid imports the original Target transaction.
2. User photographs receipt.
3. Receipt OCR/AI extracts line items.
4. AI assigns existing categories/subcategories.
5. App creates child rows.
6. Split Difference confirms the children equal the original transaction.
7. User reviews/approves only if needed.

The AI/receipt automation is **not implemented yet**. The Sheet schema is prepared for it.

---

# 8. Transaction validation

Column Z is the Validation Flag.

It concatenates one or more warnings.

Rules currently include:

- Missing Category if a financial event needs one.
- Split Parent does not require a normal spending category.
- Expense/Refund with Category but no Subcategory → Missing Subcategory.
- Expense/Refund with no Spending Type → Missing Spending Type.
- Funding Source = Sinking Fund or Emergency Fund without Fund ID → Missing Fund ID.
- Type = Savings without Fund ID → Missing Fund ID.
- Type = Debt Payment without Debt ID → Missing Debt ID.
- Type = Split Parent but Split Role is not Parent → Set Split Role to Parent.
- Split Role = Child without Parent Transaction ID → Missing Parent Transaction ID.
- Parent whose children do not balance → Split Does Not Balance.

This should remain automatic and formula-driven.

---

# 9. Soft deletion

Never permanently remove a financial record through the future app.

Use:

- `Is Deleted`
- `Deleted At`

Derived financial formulas should exclude rows where:

`Is Deleted = TRUE`

Material changes should eventually be recorded in Change Log.

---

# 10. Source Income ID

Transactions column W exists to connect an Income deposit transaction back to the authoritative paycheck record.

Concept:

```text
Transactions.Source Income ID → Income.Income ID
```

This is important for preventing duplicate or mismatched income.

### CURRENT UNFINISHED ITEM

The link field exists, but automated creation/validation of Source Income ID has not been completed.

Another AI should finish this.

---

# 11. Monthly Plan

Purpose:

Set **one flexible-spending target per month** and derive weekly guidance.

Columns:

| Field |
|---|
| Plan ID |
| Month |
| Monthly Flexible Target |
| Flexible Spent |
| Amount Available |
| Suggested This Week |
| Spent This Week |
| Notes |

Typical Plan ID:

`PLAN-202608`

## Flexible Spent

Expense minus refunds where:

`Spending Type = Flexible`

and month matches the plan month.

Soft-deleted rows are excluded.

## Amount Available

```text
Flexible Target - Flexible Spent
```

## Suggested This Week

Only displays for the current month.

Algorithm:

1. Determine the Monday of the current week.
2. Determine the Sunday of the current week, capped at month-end.
3. Calculate flexible spending earlier in the month before this week.
4. Calculate flexible money remaining at the start of this week.
5. Allocate the remaining money proportionally across the remaining days of the month.
6. Return the amount allocated to the current Monday-Sunday week.

This makes weekly guidance adapt to earlier spending rather than assuming four equal weeks.

The weekly guidance is Monday-Sunday.

## Spent This Week

Flexible Expense minus Flexible Refund from Monday through today.

---

# 12. Monthly Budget

Purpose:

Traditional main-category monthly budgeting.

Columns:

| Field |
|---|
| Budget ID |
| Month |
| Category |
| Planned |
| Actual |
| Remaining |
| % Used |
| Notes |

Actual should be:

```text
Expense for month/category
-
Refund for month/category
```

Remaining:

```text
Planned - Actual
```

Percent used:

```text
Actual / Planned
```

### IMPORTANT CURRENT BUG

The existing Monthly Budget Actual formulas currently do **not** include the soft-delete filter.

During rebuild, correct them to exclude:

`Transactions!Is Deleted = TRUE`

This is inconsistent with Monthly Plan and Monthly Summary and should be repaired.

Budget status conditional formatting should use the tracker's standard status colors:

Under/on budget:
- fill `#EAF6EE`
- font `#24563A`

Over budget:
- fill `#F8D5DA`
- font `#842029`

---

# 13. Monthly Summary

This is a calculated reporting table and should be treated as read-only.

Columns A:N:

| Col | Metric |
|---|---|
| A | Month |
| B | Income / Take-Home |
| C | Spending |
| D | Cash Savings |
| E | Debt Payments |
| F | Cash Remaining |
| G | Cash Savings Rate |
| H | Reviewed Debt Balance |
| I | Net Worth Snapshot |
| J | Retirement Savings |
| K | Total Savings |
| L | Total Savings Rate of Gross |
| M | Transaction Income Deposits |
| N | Income Reconciliation |

## Income

Comes from Income Take-Home.

Not from transaction deposits.

## Spending

```text
Expense - Refund
```

excluding soft-deleted rows.

## Cash Savings

Sum of transactions where:

`Type = Savings`

## Debt Payments

Sum where:

`Type = Debt Payment`

## Cash Remaining

```text
Take-Home Income
- Spending
- Cash Savings
- Debt Payments
```

## Cash Savings Rate

```text
Cash Savings / Take-Home
```

## Reviewed Debt Balance

Uses the most recent Quarterly Debt Review on or before the end of the given month.

## Retirement Savings

Payroll retirement from Income column L.

## Total Savings

```text
Cash Savings + Retirement Savings
```

## Total Savings Rate

```text
Total Savings / Gross Income
```

## Transaction Income Deposits

Sum of Transactions where Type = Income.

This is for reconciliation, not the authoritative income calculation.

## Income Reconciliation

```text
Transaction Income Deposits - Income Take-Home
```

A non-zero reconciliation value means the bank-deposit records and paycheck records do not match.

---

# 14. Monthly Review

This is a household review table.

Each row represents one monthly review.

Current fields:

- Review ID
- Month
- Status
- Income
- Spending
- Savings
- Debt Payments
- Cash Remaining
- Savings Rate
- Total Debt Balance

The financial numbers reference Monthly Summary.

The app should not store duplicate manual copies of those calculated figures.

Qualitative review fields can eventually be expanded.

---

# 15. Recurring Payments

This is not the transaction ledger.

It stores **expected obligations**.

Actual payments still come through Transactions.

The tab has a presentation section at the top and a raw table beginning around row 40.

Raw columns:

| Col | Field |
|---|---|
| A | Recurring ID |
| B | Name |
| C | Payment Type |
| D | Recurring Group |
| E | Category |
| F | Subcategory |
| G | Amount |
| H | Frequency |
| I | Monthly Equivalent |
| J | Due Day |
| K | Next Payment Date |
| L | Account ID |
| M | Owner |
| N | Household/Personal |
| O | Auto-Pay? |
| P | Active? |
| Q | Renewal / Review Date |
| R | Notes |
| S | Match / Source |

Recurring groups include:

- Housing
- Utilities
- Loans
- Insurance
- Subscriptions
- Memberships
- Other

Monthly Equivalent formula handles:

- Weekly → Amount × 52 / 12
- Biweekly → Amount × 26 / 12
- Monthly → Amount
- Quarterly → Amount / 3
- Semiannual → Amount / 6
- Annual → Amount / 12

Top summary includes:

- total recurring monthly
- total recurring annual
- subscriptions monthly

and sectioned summaries below.

---

# 16. Categories

Categories is both taxonomy and reference-data storage.

Main categories currently include:

- Income
- Housing
- Food
- Transportation
- Child Expenses
- Health
- Personal
- Entertainment
- Travel
- Pets
- Gifts & Giving
- Insurance
- Taxes
- Miscellaneous
- Savings
- Debt Payments

Expense-category dropdown excludes non-expense categories such as Income/Savings/Debt Payments.

Each category/subcategory row contains:

- Category ID
- Category
- Subcategory ID
- Subcategory
- Default Need/Want
- Default Fixed/Variable
- Active?
- Default Spending Type

Default Spending Type logic approximately follows:

- legacy Fixed → Fixed
- Travel → Planned Irregular
- repair/medical/dental/veterinary-type expenses → Unexpected
- otherwise → Flexible

The old Fixed/Variable field is now deprecated but remains for compatibility.

---

## Child Expenses

Current implementation contains:

- Child Care
- Clothing
- Medical & Dental
- Activities & Toys
- Education & School
- Diapers & Supplies

Longer-term preferred structure is more granular:

- Child Care
- Clothing
- Medical
- Activities
- Education
- Supplies
- Toys
- Other

This should eventually be normalized rather than combining Medical/Dental, Activities/Toys, etc.

---

# 17. Savings & Reserves

One row = one fund.

Columns:

| Col | Field |
|---|---|
| A | Fund ID |
| B | Fund Name |
| C | Fund Type |
| D | Target Amount |
| E | Starting Amount |
| F | Contributions |
| G | Withdrawals |
| H | Current Amount |
| I | Target Date |
| J | Planned Monthly |
| K | Amount Needed |
| L | % Funded |
| M | Required Monthly |
| N | Status |
| O | Notes |
| P | Backing Account ID |

Contributions are calculated from Transactions where:

`Type = Savings`

and Fund ID matches.

Withdrawals are calculated from expense transactions linked to that Fund ID.

Current:

```text
Starting Amount
+ Contributions
- Withdrawals
```

Amount Needed:

```text
MAX(Target - Current, 0)
```

Percent Funded:

```text
MIN(Current / Target, 100%)
```

Required Monthly, when a target date exists:

```text
Amount Needed
/
months until target
```

Fund types currently include:

- Emergency Fund
- Sinking Fund
- Short-Term Goal
- Retirement
- Education
- Other

Backing Account ID is optional and exists so a fund can eventually reconcile with the real account holding the cash.

Do not invent backing accounts.

---

# 18. Debts

Master debt table.

Fields include:

- Debt ID
- Debt Name
- Debt Type
- Lender
- Owner
- Original Balance
- Interest Rate
- Minimum Payment
- Due Day
- Latest Balance
- Target Payoff Date
- Linked Account ID
- Notes
- Estimated Monthly Interest
- Estimated Annual Interest

Latest Balance comes from the most recent Quarterly Debt Review.

---

## Debt interest calculation

Estimated monthly interest:

```text
Latest Balance × APR / 12
```

Estimated annualized interest:

```text
Latest Balance × APR
```

These are intentionally labeled estimates.

They are useful for a financial overview but are not guaranteed to equal actual statement interest.

Credit cards commonly accrue based on daily/average daily balances, and student loans may also accrue daily.

The Debts tab totals estimated monthly and annual interest at the top.

---

# 19. Quarterly Debt Review

Purpose:

Keep debt out of the everyday Dashboard while still monitoring it systematically.

Review cadence:

March, June, September, December.

Fields:

- Review ID
- Quarter End
- Debt ID
- Beginning Balance
- Payments
- Interest & Fees
- Adjustments
- Ending Balance
- Notes

Ending balance formula:

```text
MAX(
 Beginning Balance
 - Payments
 + Interest & Fees
 + Adjustments,
 0
)
```

The Debts master table pulls the newest balance from this table.

Monthly Summary also uses the latest reviewed balance available as of each month.

---

# 20. Accounts

Each row represents a financial account or tracked asset.

Fields:

- Account ID
- Account Name
- Institution
- Account Type
- Owner
- Include in Net Worth?
- Starting Balance
- Current Balance
- Last Updated
- Notes

Current real account records added to the tracker:

| ID | Account | Type |
|---|---|---|
| ACC-006 | PayPal | Cash |
| ACC-007 | Independent Bank Checking | Checking |
| ACC-008 | Independent Bank Savings | Savings |
| ACC-009 | Independent Bank Credit Card | Credit Card |
| ACC-010 | Capital One Credit Card | Credit Card |
| ACC-011 | Acorns Account | Investment |
| ACC-012 | Fidelity Roth IRA | Retirement |
| ACC-013 | HealthEquity HSA | HSA |

Owner and balances are intentionally blank because they have not been supplied.

All are currently marked:

`Include in Net Worth? = Yes`

HSA was added as a valid account type.

Rows above these still contain sample accounts and should eventually be removed/replaced after the model is finalized.

---

# 21. Net Worth Snapshots

Historical table fields:

- Snapshot ID
- Month
- Cash & Checking
- Savings
- Retirement
- Investments
- Property & Other Assets
- Other Assets (Deprecated)
- Total Debt
- Net Worth

Historical Net Worth:

```text
Assets - Debt
```

There is also a current tracked-net-worth helper.

Concept:

### Tracked Assets

Sum current balances of Accounts marked Include in Net Worth = Yes, excluding credit cards from assets.

### Unlinked Credit-Card Liabilities

Include credit-card account balances that are not already represented in Debts.

### Reviewed Loan Liabilities

Sum latest Debts balances.

### Current tracked net worth

```text
Tracked Assets
- Unlinked Credit Card Liabilities
- Reviewed Loan Liabilities
```

This prevents double-counting if a liability appears in both Accounts and Debts.

Property should not be invented. Add property to Accounts only when the user decides it belongs in net-worth tracking.

---

# 22. Credit Scores

Manual monthly history table.

Columns:

- Score ID
- Score Date
- Person
- Score
- Score Model
- Bureau
- Source
- Notes

Score ID is automatically generated from date/person/row.

Example pattern:

```text
CS-20261107-B-005
```

The intention is monthly manual entry because standard Plaid transaction feeds are not a consumer FICO-score feed.

Record:

- actual score
- date
- score model if known
- credit bureau if known
- source

The Dashboard automatically displays the latest record for each person.

No sample score should be invented.

---

# 23. Import Staging

This exists for eventual Plaid integration.

Plaid should **not write directly to Transactions**.

Raw imported event first lands in Import Staging.

Columns:

- Import ID
- Provider
- External Transaction ID
- Account ID
- Date
- Raw Description
- Amount
- Pending?
- Suggested Category
- Suggested Subcategory
- Suggested Spending Type
- Fingerprint
- Reviewed?
- Duplicate?
- Imported Transaction ID
- Notes

Intended flow:

```text
Plaid
→ Import Staging
→ deduplicate/classify/review
→ Transactions
```

This helps prevent duplicate transactions, pending/posted duplication and erroneous category assignments.

No Plaid integration currently exists.

---

# 24. Receipt-AI future workflow

Receipt AI should integrate with imported transactions rather than create disconnected records.

Desired architecture:

```text
Bank transaction
      ↓
Import Staging
      ↓
Transactions parent record
      ↓
Upload/photograph receipt
      ↓
OCR / document extraction
      ↓
AI item classification
      ↓
Split child transactions
      ↓
Split total validation
      ↓
User approval if necessary
```

AI should categorize against the existing Categories table rather than invent random categories.

Low-confidence items should go to review.

The parent banking event remains preserved for reconciliation.

---

# 25. Change Log

Future app audit table.

Append-only.

Fields:

- Change ID
- Changed At
- User
- Table
- Record ID
- Field
- Old Value
- New Value
- Action
- Notes

A future app should log material changes.

Example:

```text
User changes Target transaction category
Food → Child Expenses

Change Log receives:
table = Transactions
record ID = TX...
field = Category
old = Food
new = Child Expenses
action = Update
```

---

# 26. Future web-app architecture

Current recommendation recorded in App Setup:

```text
Browser / web UI
        ↓
validated JSON
        ↓
Google Apps Script web app/API
        ↓
Google Sheet tables
```

Do not expose direct spreadsheet credentials to the browser.

The Sheet is intended to remain the durable data store/backup.

The app should read/write raw database tables.

Calculated sheets such as Monthly Summary and Dashboard should generally remain read-only.

---

# 27. App data rules

Important rules to preserve:

1. Income is authoritative for paycheck gross, deductions and take-home.

2. Imported bank data enters Import Staging before Transactions.

3. Every Expense/Refund requires Spending Type.

4. Sinking Fund/Emergency Fund funding requires Fund ID.

5. Savings transactions require Fund ID.

6. Debt Payment requires Debt ID.

7. Credit-card payoff is not new spending if purchases were already recorded.

8. Never hard-delete a financial record.

9. Store month values as first-of-month dates.

10. Payroll retirement belongs in Income.

11. Dashboard monthly cards follow Selected Month.

12. Current Flexible Spending follows the current actual calendar month/week.

13. Derived summaries should not be manually editable through the app.

---

# 28. Visual design system

General colors:

### Structural navy

`#17324D`

Used for:

- main headers
- KPI header bands
- major table headers

White text.

### Teal

`#1F6F78`

Used for secondary section bars/information.

### Pale blue/info

`#E8F0F7`

### Main body text

`#1F2933`

Do not use colored fonts simply to indicate input vs. formula cells.

That convention was intentionally removed.

---

## Budget status colors

Under/on budget:

- fill `#EAF6EE`
- font `#24563A`

Over budget:

- fill `#F8D5DA`
- font `#842029`

---

## Ben / Valerie visual distinction

Ben:

pale warm cream.

Valerie:

muted peach.

Household:

pale blue-gray.

Keep these distinctions consistent across Income, Income by Person and Payroll Deductions.

---

## Dashboard summary cards

- Gross income: pale cool blue
- Take-home: slightly different/deeper blue in same family
- Spending: peach
- Total Savings: muted green

Cards should be equal size.

---

## Transaction category coloring

Do **not** color an entire transaction row by category.

Transaction rows remain neutral/white.

Only the Category cell receives a category-specific fill.

Current visual families include:

- Housing: cool slate gray, approximately `#D6DAE1`
- Food: pale yellow
- Transportation: pale blue
- Child Expenses: lavender/purple
- Health: mint green
- Personal: lilac
- Entertainment: peach/orange
- Travel: pale teal
- Pets: pale olive
- Gifts & Giving: pale rose
- Insurance: blue-lilac
- Taxes: warm beige
- Miscellaneous: gray
- Savings: green
- Debt Payments: pale rose
- Income: clear light blue

Uncategorized transactions should receive an obvious review-warning color.

---

# 29. Review cadence

Recommended cadence is intentionally light.

### Weekly

Review new/uncategorized transactions.

Do not turn household finances into a daily monitoring exercise.

### Monthly

Review:

- income vs. spending
- category totals
- savings
- irregular expenses
- flexible-spending target
- monthly review

### Quarterly

Review:

- debt balances
- interest rates
- interest costs
- payoff progress

### Quarterly or annually

Update net worth.

Credit scores can reasonably be entered monthly.

---

# 30. Sample data policy

The workbook currently contains significant sample data.

Examples include:

- sample paychecks
- sample transaction history
- sample recurring bills
- sample debts
- sample quarterly debt balances
- sample net-worth snapshots
- sample budget values
- sample accounts

Do **not** mistake these values for confirmed household financial data.

Do not delete all sample data until the structure has been validated and real opening data is ready.

The user's actual eight account names have now been entered, but their balances/owners remain blank.

---

# 31. Known unfinished work / defects

This section is especially important for another AI.

## 1. Dashboard Federal Tax row

Recent Dashboard layout edits appear to have removed Federal Tax amount and percentage formulas from Payroll Deductions.

Restore them for Ben, Valerie and Household.

Also verify the `Amount` and `% of Gross` payroll headers.

## 2. Monthly Budget soft-delete bug

Monthly Budget Actual formulas currently do not exclude soft-deleted transactions.

They should.

## 3. Source Income ID

Column exists in Transactions but automatic paycheck/deposit linking and validation are not complete.

## 4. Plaid

No live Plaid integration exists.

Import Staging is prepared for it.

## 5. Receipt AI

No receipt OCR/AI integration exists.

The split-transaction schema and Receipt Reference field are prepared.

## 6. Split transaction UI

Backend fields exist, but Google Sheets currently requires manual creation of parent and child rows.

A future Sheet helper/app could provide a "Split Transaction" workflow.

## 7. Credit scores

Manual monthly input is implemented.

There is no automated credit-bureau/FICO feed.

## 8. Real accounts

Eight real account names exist, but owner/balance/date information is blank.

Five sample accounts remain above them.

## 9. Real debt accounts

The current Debts table contains sample debt rows.

Actual household debt still needs to be entered.

## 10. Monthly flexible targets

The Monthly Plan contains sample values and incomplete future targets.

These need actual household targets.

## 11. Child expense taxonomy

Current taxonomy combines some areas.

Preferred final breakdown is more granular:
Child Care, Clothing, Medical, Activities, Education, Supplies, Toys, Other.

## 12. Import Staging and Change Log

Schemas exist, but they are not actively populated.

## 13. Dashboard selected month versus current flexible month

This is intentional but another AI may think it is a bug.

Monthly Dashboard cards use Selected Month.

Current Flexible Spending always uses today's month/week.

## 14. Sample-data cleanup

Do this only after actual data is ready.

---

# 32. Recommended rebuild order

If rebuilding from scratch, use this sequence:

### Phase 1 — Reference tables

Build:

- Categories
- Accounts
- App Setup

Establish dropdown lists and stable IDs first.

### Phase 2 — Core raw tables

Build:

- Income
- Transactions
- Recurring Payments
- Savings & Reserves
- Debts
- Quarterly Debt Review
- Credit Scores

Do not build Dashboard calculations until these schemas are stable.

### Phase 3 — Import/app infrastructure

Build:

- Import Staging
- Change Log

Add soft-delete fields and validation.

### Phase 4 — Derived reporting

Build:

- Monthly Budget
- Monthly Plan
- Monthly Summary
- Monthly Review
- Net Worth Snapshots

### Phase 5 — Dashboard

Build the Dashboard last, once formulas underneath are verified.

### Phase 6 — QA

Check:

- no #REF!
- no #VALUE!
- no #DIV/0!
- no broken merged ranges
- all dropdowns still work
- deleted transactions are excluded
- refunds reduce spending
- split parents do not count as spending
- split children do
- split totals balance
- savings do not count as ordinary spending
- credit-card payments are not double-counted
- Income remains the authoritative paycheck source
- Dashboard selected-month calculations match Monthly Summary
- current Flexible Spending reflects the actual current week/month

---

# 33. Acceptance tests for another AI

Before considering the rebuild complete, test these scenarios.

## Ordinary grocery purchase

Enter:

```text
Expense
Food
Groceries
Flexible
Monthly Cash Flow
```

It should:

- increase monthly spending
- increase Food spending
- increase flexible spent
- reduce monthly flexible availability

## Fixed mortgage/rent payment

Enter:

```text
Expense
Housing
Mortgage or Rent
Fixed
```

It should:

- increase monthly spending
- not affect weekly flexible spending

## Planned vacation purchase

Enter:

```text
Expense
Travel
Airfare
Planned Irregular
Funding Source = Sinking Fund
Fund ID = Vacation fund
```

It should:

- increase monthly spending
- decrease the vacation fund through withdrawals
- not reduce weekly flexible allowance

## Emergency purchase

Enter an unexpected expense funded from Emergency Fund.

It should:

- increase monthly spending
- decrease the Emergency Fund
- not affect weekly flexible guidance

## Savings transfer

Enter:

```text
Type = Savings
Fund ID = ...
```

It should:

- increase fund contributions
- increase Cash Savings
- not count as spending

## Refund

Enter a Refund in the same category.

It should reduce monthly/category spending.

## Transfer

Move money from checking to savings where it is merely an account transfer and not a savings allocation.

It should count as neither income nor spending.

## Credit-card payment

If credit-card purchases already exist as expenses, a payoff should not generate a second spending expense.

## Split Target purchase

Parent:

```text
$142.50
Type = Split Parent
Split Role = Parent
```

Children:

```text
$62.50 Food
$48.00 Child Expenses
$32.00 Personal
```

Split Difference should equal zero.

Spending should equal $142.50, not $285.

## Deleted transaction

Set:

`Is Deleted = TRUE`

The record should disappear from all financial totals without being physically removed.

## Credit score

Add a new dated score to Credit Scores.

Dashboard should automatically show it as the latest record.

---

# 34. What not to change without a deliberate design decision

Do not:

- make Income deposits the authoritative income source
- count Savings as ordinary spending
- count Split Parent rows as spending
- count transfers as spending
- stretch compact Dashboard sections unnecessarily across the page
- put debt balances prominently on the everyday Dashboard
- remove stable IDs
- use hard deletes
- merge cells in backend tables
- replace actual first-of-month dates with text month labels
- invent balances, debt rates, property values or credit scores
- remove the ability to use the workbook without the future app
- create a new category every time AI encounters an unfamiliar receipt item

The app/AI should classify against the controlled taxonomy and ask for review when genuinely uncertain.

---

# 35. Desired end-state

The finished system should eventually allow this workflow:

```text
Accounts connected
        ↓
Plaid imports transactions automatically
        ↓
Import Staging deduplicates and normalizes them
        ↓
AI proposes category/subcategory/spending type
        ↓
Transactions receives approved records
        ↓
Mixed purchases can receive a receipt photo
        ↓
AI creates balanced split children
        ↓
Income provides authoritative payroll details
        ↓
Savings/Debt/Accounts update linked reports
        ↓
Monthly Summary calculates household results
        ↓
Dashboard gives a concise monthly snapshot
        ↓
Monthly and quarterly reviews provide decision points
```

The Google Sheet should remain understandable, inspectable and functional even if the future web app is unavailable.

That is the governing architecture of the tracker.
