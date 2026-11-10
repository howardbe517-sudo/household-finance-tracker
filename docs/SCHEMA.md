# Data Dictionary — Household Finance Tracker

Schema version **3.10-spending-tab-2026-11-10**. Generated from `apps-script/Config.gs` by `scripts/gen-schema.js` — do not edit by hand.

Conventions: one record per row; stable IDs in column A; months stored as first-of-month dates; no merged cells inside raw tables; financial rows are soft-deleted (`Is Deleted`), never removed. Formula templates below use `[@key]` (same row), `[@@key]` (same column, open range) and `[TABLE.key]` (another table's column, open range) — see `Config.gs`.

## Tables

| Key | Sheet | Header row | First data row | Formula rows to | ID pattern | Columns | Change-logged |
|---|---|---:|---:|---:|---|---:|---|
| CATS | Categories | 4 | 5 | 204 | CAT-01 / SUB-0101 | 8 | no |
| ACCOUNTS | Accounts | 4 | 5 | 104 | ACC-001 | 14 | yes |
| INCOME | Income | 4 | 5 | 504 | INC-0001 | 19 | yes |
| EXPECT | Expected Income | 4 | 5 | 54 | EXP-001 | 16 | yes |
| TX | Transactions | 4 | 5 | 1004 | TX-000001 | 32 | yes |
| RECUR | Recurring Payments | 40 | 41 | 240 | REC-001 | 19 | yes |
| FUNDS | Savings & Reserves | 4 | 5 | 54 | FUND-001 | 16 | yes |
| DEBTS | Debts | 7 | 8 | 57 | DEBT-001 | 29 | yes |
| QDR | Quarterly Debt Review | 4 | 5 | 404 | QDR-2026Q3-DEBT-001 | 11 | yes |
| CREDIT | Credit Scores | 4 | 5 | 304 | CS-20261107-B-001 | 8 | yes |
| STAGING | Import Staging | 4 | 5 | 1004 | IMP-000001 | 27 | no |
| RULES | Import Rules | 4 | 5 | 204 | RULE-001 | 17 | yes |
| CONN | Connections | 4 | 5 | 54 | CONN-001 | 13 | yes |
| LOG | Change Log | 4 | 5 | 1004 | CHG-20261107-153000-a1b2 | 10 | no |
| BUDGET | Monthly Budget | 4 | 5 | 504 | BUD-202611-HOUS | 8 | yes |
| PLAN | Monthly Plan | 4 | 5 | 124 | PLAN-202611 | 15 | yes |
| SUMMARY | Monthly Summary | 4 | 5 | 124 | (month date) | 15 | no |
| REVIEW | Monthly Review | 4 | 5 | 124 | REV-202611 | 18 | yes |
| NW | Net Worth Snapshots | 4 | 5 | 124 | NW-202611 | 11 | yes |

Non-table tabs: Start Here, Dashboard, App Setup, Sources.

## Categories (`CATS`)

Controlled taxonomy (one row per subcategory) plus every dropdown list used in the workbook. Apps and AI classify against this table; do not invent categories elsewhere.

Named range `TBL_CATS` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Category ID | `categoryId` | text | input |  |
| B | Category | `category` | text | input |  |
| C | Subcategory ID | `subcategoryId` | text | input |  |
| D | Subcategory | `subcategory` | text | input |  |
| E | Default Need/Want | `needWant` | text | dropdown: LIST_NEED_WANT |  |
| F | Default Fixed/Variable (Deprecated) | `fixedVariable` | text | dropdown: LIST_FIXED_VARIABLE |  |
| G | Active? | `active` | text | checkbox |  |
| H | Default Spending Type | `spendingType` | text | dropdown: LIST_SPENDING_TYPES |  |

## Accounts (`ACCOUNTS`)

One row per financial account or tracked asset. Balances are entered manually until Plaid is connected. Credit cards are liabilities; link them to a Debts row to avoid double-counting in net worth.

Named range `TBL_ACCOUNTS` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Account ID | `id` | text | input |  |
| B | Account Name | `name` | text | input |  |
| C | Institution | `institution` | text | input |  |
| D | Account Type | `accountType` | text | dropdown: LIST_ACCOUNT_TYPES |  |
| E | Owner | `owner` | text | dropdown: LIST_OWNERS |  |
| F | Include in Net Worth? | `includeNW` | text | dropdown: LIST_YES_NO |  |
| G | Starting Balance | `startingBalance` | currency | input |  |
| H | Current Balance | `currentBalance` | currency | input |  |
| I | Last Updated | `lastUpdated` | date | input (date) |  |
| J | Notes | `notes` | text | input |  |
| K | External Account ID | `externalAccountId` | text | input | Added in 3.1: the bank feed's own ID for this account (Plaid account_id). Filled when a connection is finished; links synced transactions to this row. |
| L | Connection ID | `connectionId` | text | dropdown: Connections IDs | Added in 3.1: the Connections row (bank login) this account belongs to. |
| M | Import Transactions? | `importTx` | text | checkbox | Added in 3.1: ticked = the sync lands this account's transactions in Import Staging; unticked = balance only (Acorns, Fidelity, HSA). |
| N | Last Synced | `lastSynced` | datetime | input | Added in 3.1: when the bank feed last updated this balance. |

## Income (`INCOME`)

Authoritative source for gross pay, payroll deductions and take-home. One row per paycheck. Bank deposits imported into Transactions link back here through Source Income ID.

Named range `TBL_INCOME` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Income ID | `id` | text | input |  |
| B | Pay Date | `payDate` | date | input (date) |  |
| C | Month | `month` | month (1st-of-month date) | calculated | `=IF([@payDate]="","",DATE(YEAR([@payDate]),MONTH([@payDate]),1))` |
| D | Person | `person` | text | dropdown: LIST_PERSONS |  |
| E | Employer / Source | `employer` | text | input |  |
| F | Income Type | `incomeType` | text | dropdown: LIST_INCOME_TYPES |  |
| G | Gross Pay | `gross` | currency | input |  |
| H | Federal Tax | `fedTax` | currency | input |  |
| I | State / Local Tax | `stateTax` | currency | input |  |
| J | Social Security & Medicare | `ssMed` | currency | input |  |
| K | Health / Insurance | `health` | currency | input |  |
| L | Retirement Contribution | `retirement` | currency | input |  |
| M | Other Deductions | `otherDed` | currency | input |  |
| N | Total Deductions | `totalDed` | currency | calculated | `=IF([@id]="","",SUM([@fedTax]:[@otherDed]))` |
| O | Take-Home Pay | `takeHome` | currency | calculated | `=IF([@id]="","",N([@gross])-[@totalDed])` |
| P | Deposit Account ID | `depositAccount` | text | dropdown: Accounts IDs |  |
| Q | Notes | `notes` | text | input |  |
| R | Last Updated | `lastUpdated` | date | input (date) |  |
| S | Linked Deposit TX | `linkedTx` | text | calculated | `=IF([@id]="","",IFERROR(INDEX(FILTER([TX.id],[TX.sourceIncomeId]=[@id],[TX.isDeleted]<>TRUE),1),"Unlinked"))` — Added in the 3.0 rebuild: shows the Transactions deposit linked to this paycheck, or "Unlinked". |

## Expected Income (`EXPECT`)

One row per regular paycheck (a person at an employer). The typical amounts and pay frequency give the expected monthly income that the Monthly Plan and the Dashboard work from. Rows are created from the first paycheck imported for each employer; correct the frequency and typical amounts here when they are wrong. One-off income is entered on Income as usual and shows up in the actuals, not here.

Named range `TBL_EXPECT` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Source ID | `id` | text | input |  |
| B | Person | `person` | text | dropdown: LIST_PERSONS |  |
| C | Employer / Source | `employer` | text | input |  |
| D | Pay Frequency | `frequency` | text | dropdown: LIST_PAY_FREQUENCIES |  |
| E | Typical Gross (per paycheck) | `typicalGross` | currency | input |  |
| F | Typical Take-Home (per paycheck) | `typicalTakeHome` | currency | input |  |
| G | Active? | `active` | text | checkbox |  |
| H | Paychecks per Month (average) | `perMonth` | text | calculated | `=IF([@id]="","",SWITCH([@frequency],"Weekly",52/12,"Biweekly",26/12,"Semimonthly",2,"Monthly",1,0))` |
| I | Typical Month Take-Home | `monthlyTakeHome` | currency | calculated | `=IF([@id]="","",IF([@active]=TRUE,N([@typicalTakeHome])*N([@perMonth]),0))` |
| J | Typical Month Gross | `monthlyGross` | currency | calculated | `=IF([@id]="","",IF([@active]=TRUE,N([@typicalGross])*N([@perMonth]),0))` |
| K | Last Paycheck | `lastPayDate` | date | calculated | `=IF([@id]="","",IFERROR(LET(d,MAXIFS([INCOME.payDate],[INCOME.person],[@person],[INCOME.employer],[@employer]),IF(d=0,"",d)),""))` |
| L | Last Take-Home | `lastTakeHome` | currency | calculated | `=IF(OR([@id]="",[@lastPayDate]=""),"",SUMIFS([INCOME.takeHome],[INCOME.person],[@person],[INCOME.employer],[@employer],[INCOME.payDate],[@lastPayDate]))` |
| M | Last vs Typical | `deviation` | currency | calculated | `=IF(OR([@lastTakeHome]="",N([@typicalTakeHome])=0),"",[@lastTakeHome]-[@typicalTakeHome])` — How far the latest paycheck was from the typical amount; a standing difference means the typical amount needs updating. |
| N | Paydays This Month | `paydaysThisMonth` | text | calculated | `=IF([@id]="","",LET(ms,DATE(YEAR(TODAY()),MONTH(TODAY()),1),me,EOMONTH(ms,0),IFERROR(IF([@frequency]="Biweekly",IF(N([@lastPayDate])=0,26/12,INT((me-N([@last…` — Biweekly and weekly pay are counted from the last pay date and the pay cycle, so a three-paycheck month shows 3; until a paycheck exists the yearly average is used (26/12 or 52/12). Semimonthly is 2, monthly 1. |
| O | Expected This Month | `expectedThisMonth` | currency | calculated | `=IF([@id]="","",IF([@active]=TRUE,N([@typicalTakeHome])*N([@paydaysThisMonth]),0))` |
| P | Notes | `notes` | text | input |  |

## Transactions (`TX`)

One financial event per row. Spending = Expense − Refund (soft-deleted rows and Split Parents excluded). Savings, Debt Payment and Transfer rows are never counted as spending. Rows are never hard-deleted: tick Is Deleted instead.

Named range `TBL_TX` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Transaction ID | `id` | text | input |  |
| B | Date | `date` | date | input (date) |  |
| C | Description | `description` | text | input |  |
| D | Amount ($) | `amount` | currency | input |  |
| E | Type | `type` | text | dropdown: LIST_TRANSACTION_TYPES |  |
| F | Category | `category` | text | dropdown: LIST_ALL_CATEGORIES |  |
| G | Subcategory | `subcategory` | text | dropdown: LIST_ALL_SUBCATEGORIES |  |
| H | Account ID | `accountId` | text | dropdown: Accounts IDs |  |
| I | Person | `person` | text | dropdown: LIST_OWNERS |  |
| J | Household/Personal | `hhPersonal` | text | dropdown: LIST_HOUSEHOLD_PERSONAL |  |
| K | Fixed/Variable (Deprecated) | `fixedVariable` | text | dropdown: LIST_FIXED_VARIABLE |  |
| L | Need/Want | `needWant` | text | dropdown: LIST_NEED_WANT |  |
| M | Fund ID | `fundId` | text | dropdown: Savings & Reserves IDs |  |
| N | Debt ID | `debtId` | text | dropdown: Debts IDs |  |
| O | Recurring? | `recurring` | text | checkbox |  |
| P | Status | `status` | text | dropdown: LIST_TX_STATUSES |  |
| Q | Month | `month` | month (1st-of-month date) | calculated | `=IF([@date]="","",DATE(YEAR([@date]),MONTH([@date]),1))` |
| R | Notes | `notes` | text | input |  |
| S | Created At | `createdAt` | datetime | input |  |
| T | Updated At | `updatedAt` | datetime | input |  |
| U | Spending Type | `spendingType` | text | dropdown: LIST_SPENDING_TYPES |  |
| V | Funding Source | `fundingSource` | text | dropdown: LIST_FUNDING_SOURCES |  |
| W | Source Income ID | `sourceIncomeId` | text | dropdown: Income IDs |  |
| X | Is Deleted | `isDeleted` | text | checkbox |  |
| Y | Deleted At | `deletedAt` | datetime | input |  |
| Z | Validation Flag | `validationFlag` | text | calculated | `(see Validation Flag below)` |
| AA | Created By | `createdBy` | text | input |  |
| AB | Updated By | `updatedBy` | text | input |  |
| AC | Split Role | `splitRole` | text | dropdown: LIST_SPLIT_ROLES |  |
| AD | Parent Transaction ID | `parentTxId` | text | dropdown: Transactions IDs |  |
| AE | Split Difference ($) | `splitDiff` | currency | calculated | `=IF([@id]="","",IF([@splitRole]="Parent",N([@amount])-SUMIFS([@@amount],[@@parentTxId],[@id],[@@isDeleted],"<>TRUE"),""))` |
| AF | Receipt Reference | `receiptRef` | text | input |  |

## Recurring Payments (`RECUR`)

Expected bills, subscriptions and other recurring obligations. This is NOT the ledger: actual payments are recorded in Transactions. Summary cards above are calculated from the raw table starting on row 40.

Named range `TBL_RECUR` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Recurring ID | `id` | text | input |  |
| B | Name | `name` | text | input |  |
| C | Payment Type | `paymentType` | text | dropdown: LIST_PAYMENT_TYPES |  |
| D | Recurring Group | `group` | text | dropdown: LIST_RECURRING_GROUPS |  |
| E | Category | `category` | text | dropdown: LIST_ALL_CATEGORIES |  |
| F | Subcategory | `subcategory` | text | dropdown: LIST_ALL_SUBCATEGORIES |  |
| G | Amount | `amount` | currency | input |  |
| H | Frequency | `frequency` | text | dropdown: LIST_FREQUENCIES |  |
| I | Monthly Equivalent | `monthlyEq` | currency | calculated | `=IF(OR([@id]="",NOT(ISNUMBER([@amount]))),"",SWITCH([@frequency],"Weekly",[@amount]*52/12,"Biweekly",[@amount]*26/12,"Monthly",[@amount],"Quarterly",[@amount…` |
| J | Due Day | `dueDay` | integer | input |  |
| K | Next Payment Date | `nextPayment` | date | input (date) |  |
| L | Account ID | `accountId` | text | dropdown: Accounts IDs |  |
| M | Owner | `owner` | text | dropdown: LIST_OWNERS |  |
| N | Household/Personal | `hhPersonal` | text | dropdown: LIST_HOUSEHOLD_PERSONAL |  |
| O | Auto-Pay? | `autoPay` | text | checkbox |  |
| P | Active? | `active` | text | checkbox |  |
| Q | Renewal / Review Date | `renewalDate` | date | input (date) |  |
| R | Notes | `notes` | text | input |  |
| S | Match / Source | `matchSource` | text | input |  |

## Savings & Reserves (`FUNDS`)

One row per fund (emergency fund, sinking funds, goals). Contributions come from Transactions with Type = Savings; withdrawals come from Expense rows that name the Fund ID. A purchase paid from a fund is still spending in the month it happens.

Named range `TBL_FUNDS` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Fund ID | `id` | text | input |  |
| B | Fund Name | `name` | text | input |  |
| C | Fund Type | `fundType` | text | dropdown: LIST_FUND_TYPES |  |
| D | Target Amount | `target` | currency | input |  |
| E | Starting Amount | `starting` | currency | input |  |
| F | Contributions | `contributions` | currency | calculated | `=IF([@id]="","",SUMIFS([TX.amount],[TX.fundId],[@id],[TX.type],"Savings",[TX.isDeleted],"<>TRUE")+SUMIFS([TX.amount],[TX.fundId],[@id],[TX.type],"Transfer",[…` — Changed in 3.9: a Transfer that carries this Fund ID counts too (money moved into savings and parked for a bill). |
| G | Withdrawals | `withdrawals` | currency | calculated | `=IF([@id]="","",SUMIFS([TX.amount],[TX.fundId],[@id],[TX.type],"Expense",[TX.isDeleted],"<>TRUE")+SUMIFS([TX.amount],[TX.fundId],[@id],[TX.type],"Debt Paymen…` — Changed in 3.9: a Debt Payment that carries this Fund ID counts too (the parked money going out to the bill). |
| H | Current Amount | `current` | currency | calculated | `=IF([@id]="","",IF(AND([@backingAccount]<>"",[@fundType]<>"Parked for Bills"),IFERROR(N(INDEX([ACCOUNTS.currentBalance],MATCH([@backingAccount],[ACCOUNTS.id]…` — Changed in 3.9: a fund with a Backing Account shows that account's live balance minus whatever "Parked for Bills" funds hold on the same account, so it reads as the money that is permanently there. A Parked for Bills fund itself is starting + contributions − withdrawals: transfers tagged with its Fund ID in, bill payments tagged with it out. |
| I | Target Date | `targetDate` | date | input (date) |  |
| J | Planned Monthly | `plannedMonthly` | currency | input |  |
| K | Amount Needed | `amountNeeded` | currency | calculated | `=IF([@id]="","",MAX(N([@target])-[@current],0))` |
| L | % Funded | `pctFunded` | percent | calculated | `=IF(OR([@id]="",N([@target])=0),"",MIN([@current]/[@target],1))` |
| M | Required Monthly | `requiredMonthly` | currency | calculated | `=IF(OR([@id]="",[@targetDate]=""),"",IF([@amountNeeded]<=0,0,[@amountNeeded]/MAX((YEAR([@targetDate])-YEAR(TODAY()))*12+MONTH([@targetDate])-MONTH(TODAY()),1)))` |
| N | Status | `status` | text | calculated | `=IF([@id]="","",IF(AND(N([@target])>0,[@current]>=[@target]),"Funded",IF(AND([@targetDate]<>"",[@targetDate]<TODAY()),"Past Target Date",IF(AND([@plannedMont…` |
| O | Notes | `notes` | text | input |  |
| P | Backing Account ID | `backingAccount` | text | dropdown: Accounts IDs |  |

## Debts (`DEBTS`)

One row per debt. Latest Balance comes from the linked account's nightly balance when there is one, else the newest Quarterly Debt Review, else Original Balance. For linked cards and loans the bank feed also fills the rate, minimum payment, due day and next due date. PSLF: type the official count from studentaid.gov now and then; the tracker counts payments since.

Named range `TBL_DEBTS` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Debt ID | `id` | text | input |  |
| B | Debt Name | `name` | text | input |  |
| C | Debt Type | `debtType` | text | dropdown: LIST_DEBT_TYPES |  |
| D | Lender | `lender` | text | input |  |
| E | Owner | `owner` | text | dropdown: LIST_OWNERS |  |
| F | Original Balance | `originalBalance` | currency | input |  |
| G | Interest Rate (APR) | `apr` | percent | input |  |
| H | Minimum Payment | `minPayment` | currency | input |  |
| I | Due Day | `dueDay` | integer | input |  |
| J | Latest Balance | `latestBalance` | currency | calculated | `=IF([@id]="","",LET(q,MAXIFS([QDR.quarterEnd],[QDR.debtId],[@id]),ab,IFERROR(INDEX([ACCOUNTS.currentBalance],MATCH([@linkedAccount],[ACCOUNTS.id],0)),""),ad,…` — Changed in 3.1: when the debt is linked to an account whose balance is newer than the last quarterly review (e.g. a card or loan synced by the bank feed), that live balance is shown; otherwise the latest review; otherwise the original balance. |
| K | Balance As Of | `balanceAsOf` | date | calculated | `=IF([@id]="","",LET(q,MAXIFS([QDR.quarterEnd],[QDR.debtId],[@id]),ab,IFERROR(INDEX([ACCOUNTS.currentBalance],MATCH([@linkedAccount],[ACCOUNTS.id],0)),""),ad,…` — Date of the balance shown: the linked account's Last Updated, or the review's Quarter End. |
| L | Target Payoff Date | `targetPayoff` | date | input (date) |  |
| M | Linked Account ID | `linkedAccount` | text | dropdown: Accounts IDs |  |
| N | Notes | `notes` | text | input |  |
| O | Estimated Monthly Interest | `estMonthlyInterest` | currency | calculated | `=IF([@id]="","",IF(AND([@interestPaused]=TRUE,OR([@pausedUntil]="",[@pausedUntil]>=TODAY())),0,N([@latestBalance])*N([@apr])/12))` — Changed in 3.3: 0 while Interest Paused? is ticked (and Paused Until, if set, has not passed). |
| P | Estimated Annual Interest | `estAnnualInterest` | currency | calculated | `=IF([@id]="","",IF(AND([@interestPaused]=TRUE,OR([@pausedUntil]="",[@pausedUntil]>=TODAY())),0,N([@latestBalance])*N([@apr])))` |
| Q | Debt Group | `group` | text | dropdown: LIST_DEBT_GROUPS | Added in 3.1: Household or Student Loans. Student loans are totalled separately everywhere (they would swamp the household total); net worth still counts both. |
| R | Next Payment Due | `nextDue` | date | input | Added in 3.2: written by the bank feed (Plaid Liabilities) where the lender provides it. The feed also fills Interest Rate, Minimum Payment and Due Day for linked cards and loans. |
| S | Last Payment (feed) | `lastPayment` | text | input | Added in 3.2: date and amount of the last payment the lender reported. |
| T | Loan Status / Plan | `loanStatus` | text | input | Added in 3.2: repayment plan and status reported by a student loan servicer; Current or Overdue for a card. |
| U | PSLF Official Count | `pslfOfficial` | integer | input | Added in 3.2: the qualifying-payment count shown on studentaid.gov the last time you checked. Entered by hand (there is no feed for it); the tracker counts payments made since. |
| V | PSLF Count As Of | `pslfAsOf` | date | input (date) | Added in 3.2: the date that official count was read. |
| W | Payments Since Count | `pslfSince` | integer | calculated | `=IF(OR([@id]="",[@pslfOfficial]=""),"",IFERROR(ROWS(UNIQUE(FILTER([TX.month],[TX.debtId]=[@id],[TX.type]="Debt Payment",[TX.isDeleted]<>TRUE,[TX.date]>N([@ps…` — Added in 3.2: months with a Debt Payment to this debt after the as-of date (one per month, as PSLF counts them). |
| X | PSLF Estimated Count | `pslfEstimated` | integer | calculated | `=IF(OR([@id]="",[@pslfOfficial]=""),"",N([@pslfOfficial])+N([@pslfSince]))` — Added in 3.2: official count + payments since. An estimate until studentaid.gov confirms it. |
| Y | PSLF Remaining (of 120) | `pslfRemaining` | integer | calculated | `=IF([@pslfEstimated]="","",MAX(120-[@pslfEstimated],0))` |
| Z | Feed Updated | `feedUpdated` | datetime | input | Added in 3.2: when the bank feed last wrote lender data to this row. |
| AA | Interest Paused? | `interestPaused` | text | checkbox | Added in 3.3: tick while a debt is in forbearance, a 0% period or any relief that stops interest. The estimated interest for the row drops to 0 (the band and the AI snapshot follow), the rate shows as "Paused · 6.0%"; the balance and payments are unaffected. |
| AB | Paused Until | `pausedUntil` | date | input (date) | Added in 3.3: optional end date of the pause. After it passes, interest counts again by itself; leave blank for an open-ended pause. |
| AC | Planned Extra Payment | `plannedExtra` | currency | input | Added in 3.8: extra paid toward this debt each month on top of the minimum, set from Finance Tracker → Payoff planner… (or typed here). The Monthly Plan subtracts it with the debt payments. |

## Quarterly Debt Review (`QDR`)

Debt balances are reviewed in March, June, September and December instead of on the everyday Dashboard. One row per debt per quarter. Ending Balance feeds the Debts table and Monthly Summary.

Named range `TBL_QDR` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Review ID | `id` | text | input |  |
| B | Quarter End | `quarterEnd` | date | input (date) |  |
| C | Debt ID | `debtId` | text | dropdown: Debts IDs |  |
| D | Beginning Balance | `beginning` | currency | input |  |
| E | Payments | `payments` | currency | input |  |
| F | Interest & Fees | `interestFees` | currency | input |  |
| G | Adjustments | `adjustments` | currency | input |  |
| H | Ending Balance | `endingBalance` | currency | calculated | `=IF([@id]="","",MAX(N([@beginning])-N([@payments])+N([@interestFees])+N([@adjustments]),0))` |
| I | Notes | `notes` | text | input |  |
| J | Tracked Payments (Transactions) | `trackedPayments` | currency | calculated | `=IF(OR([@id]="",[@quarterEnd]="",[@debtId]=""),"",SUMIFS([TX.amount],[TX.debtId],[@debtId],[TX.type],"Debt Payment",[TX.date],">"&EDATE([@quarterEnd],-3),[TX…` — Added in the 3.0 rebuild: Debt Payment transactions in the quarter, for reconciling against statement payments. |
| K | Debt Group | `group` | text | calculated | `=IF([@debtId]="","",IFERROR(INDEX([DEBTS.group],MATCH([@debtId],[DEBTS.id],0)),"Household"))` — Added in 3.1: copied from the Debts row so monthly totals can keep student loans separate. |

## Credit Scores (`CREDIT`)

Manual monthly entry (Plaid does not supply consumer FICO scores). The Dashboard shows the newest row per person automatically. Score ID is generated from the date, person and row.

Named range `TBL_CREDIT` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Score ID | `id` | text | calculated | `=IF(OR([@scoreDate]="",[@person]=""),"","CS-"&TEXT([@scoreDate],"yyyymmdd")&"-"&LEFT([@person],1)&"-"&TEXT(ROW()-4,"000"))` |
| B | Score Date | `scoreDate` | date | input (date) |  |
| C | Person | `person` | text | dropdown: LIST_PERSONS |  |
| D | Score | `score` | integer | input |  |
| E | Score Model | `scoreModel` | text | dropdown: LIST_SCORE_MODELS |  |
| F | Bureau | `bureau` | text | dropdown: LIST_BUREAUS |  |
| G | Source | `source` | text | input |  |
| H | Notes | `notes` | text | input |  |

## Import Staging (`STAGING`)

Landing table for Plaid / CSV imports. Nothing writes directly to Transactions: rows are deduplicated, classified and reviewed here first. Fingerprint and Duplicate? are calculated.

Named range `TBL_STAGING` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Import ID | `importId` | text | input |  |
| B | Provider | `provider` | text | dropdown: LIST_PROVIDERS |  |
| C | External Transaction ID | `externalTxId` | text | input |  |
| D | Account ID | `accountId` | text | dropdown: Accounts IDs |  |
| E | Date | `date` | date | input (date) |  |
| F | Raw Description | `rawDescription` | text | input |  |
| G | Amount | `amount` | currency | input |  |
| H | Pending? | `pending` | text | checkbox |  |
| I | Suggested Category | `suggestedCategory` | text | dropdown: LIST_ALL_CATEGORIES |  |
| J | Suggested Subcategory | `suggestedSubcategory` | text | dropdown: LIST_ALL_SUBCATEGORIES |  |
| K | Suggested Spending Type | `suggestedSpendingType` | text | dropdown: LIST_SPENDING_TYPES |  |
| L | Fingerprint | `fingerprint` | text | calculated | `=IF([@importId]="","",[@accountId]&"\|"&TEXT([@date],"yyyy-mm-dd")&"\|"&TEXT(N([@amount]),"0.00")&"\|"&LOWER(LEFT(REGEXREPLACE([@rawDescription]&"","[^A-Za-z0-9…` |
| M | Reviewed? | `reviewed` | text | checkbox |  |
| N | Duplicate? | `duplicate` | text | calculated | `=IF([@importId]="","",IF([@importedTxId]<>"",FALSE,OR(COUNTIF([@^fingerprint],[@fingerprint])>1,COUNTIFS([TX.accountId],[@accountId],[TX.date],[@date],[TX.am…` |
| O | Imported Transaction ID | `importedTxId` | text | dropdown: Transactions IDs |  |
| P | Notes | `notes` | text | input |  |
| Q | Status | `status` | text | dropdown: LIST_STAGING_STATUSES | Added in 3.1: Needs Review → tick Reviewed? → Import reviewed rows → Imported. Needs Split rows go through the split panel. Superseded = replaced by the posted version of a pending charge. |
| R | Suggested Type | `suggestedType` | text | dropdown: LIST_TRANSACTION_TYPES | Added in 3.1. |
| S | Suggested Person | `suggestedPerson` | text | dropdown: LIST_OWNERS | Added in 3.1. |
| T | Suggested Fund ID | `suggestedFundId` | text | dropdown: Savings & Reserves IDs | Added in 3.1. |
| U | Suggested Debt ID | `suggestedDebtId` | text | dropdown: Debts IDs | Added in 3.1. |
| V | Matched Rule ID | `ruleId` | text | dropdown: Import Rules IDs | Added in 3.1: the Import Rules row that filled the suggestions. |
| W | Merchant (from bank) | `merchantName` | text | input | Added in 3.1: the cleaned merchant name the bank feed supplies; used by rules. |
| X | Bank Category | `bankCategory` | text | input | Added in 3.1: the feed's own category guess, for reference only. |
| Y | Pending Transaction ID | `pendingTxId` | text | input | Added in 3.1: for a posted charge, the ID of the pending charge it replaces. |
| Z | Paired Import ID | `pairedImportId` | text | input | Added in 3.1: the other side of a detected transfer or card payment. |
| AA | Imported At | `importedAt` | datetime | input | Added in 3.1. |

## Import Rules (`RULES`)

One row per pattern. A synced transaction whose description or merchant matches gets the Type, Category, Subcategory and Spending Type below. Auto-import? sends it straight to Transactions; otherwise it waits in Import Staging pre-filled. Split Required? always holds it for the split panel. Make rules from Import Staging with Finance Tracker → Make a rule from this row.

Named range `TBL_RULES` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Rule ID | `id` | text | input |  |
| B | Match Text | `pattern` | text | input |  |
| C | Match Type | `matchType` | text | dropdown: LIST_MATCH_TYPES |  |
| D | Account ID (optional) | `accountId` | text | dropdown: Accounts IDs |  |
| E | Type | `type` | text | dropdown: LIST_TRANSACTION_TYPES |  |
| F | Category | `category` | text | dropdown: LIST_ALL_CATEGORIES |  |
| G | Subcategory | `subcategory` | text | dropdown: LIST_ALL_SUBCATEGORIES |  |
| H | Spending Type | `spendingType` | text | dropdown: LIST_SPENDING_TYPES |  |
| I | Person | `person` | text | dropdown: LIST_OWNERS |  |
| J | Fund ID | `fundId` | text | dropdown: Savings & Reserves IDs |  |
| K | Debt ID | `debtId` | text | dropdown: Debts IDs |  |
| L | Auto-import? | `autoImport` | text | checkbox |  |
| M | Split Required? | `splitRequired` | text | checkbox |  |
| N | Active? | `active` | text | checkbox |  |
| O | Matches | `matches` | integer | calculated | `=IF([@id]="","",COUNTIF([STAGING.ruleId],[@id]))` |
| P | Created At | `createdAt` | datetime | input |  |
| Q | Notes | `notes` | text | input |  |

## Connections (`CONN`)

One row per bank login connected through Plaid. Each uses one of the free Trial slots (20 on your plan) permanently, so repairs always use the Repair action (never disconnect and reconnect). Access tokens are kept in the script's Script Properties, never on this tab.

Named range `TBL_CONN` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Connection ID | `id` | text | input |  |
| B | Institution | `institution` | text | input |  |
| C | Plaid Item ID | `itemId` | text | input |  |
| D | Products | `products` | text | input |  |
| E | Status | `status` | text | dropdown: LIST_CONNECTION_STATUSES |  |
| F | Accounts Linked | `accountsLinked` | integer | calculated | `=IF([@id]="","",COUNTIF([ACCOUNTS.connectionId],[@id]))` |
| G | Last Sync | `lastSync` | datetime | input |  |
| H | Last Result | `lastResult` | text | input |  |
| I | Last Error | `lastError` | text | input |  |
| J | Sync Cursor | `syncCursor` | text | input |  |
| K | Added On | `addedOn` | date | input |  |
| L | Notes | `notes` | text | input |  |
| M | Liabilities Feed | `liabilities` | text | input | Added in 3.2: whether Plaid supplies rates, minimum payments and due dates for this login (Yes, or Not available with the reason). |

## Change Log (`LOG`)

Material changes to raw tables are appended here (by the onEdit trigger when enabled in App Setup, and by the future app). Never edit or delete rows here.

Named range `TBL_LOG` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Change ID | `changeId` | text | input |  |
| B | Changed At | `changedAt` | datetime | input |  |
| C | User | `user` | text | input |  |
| D | Table | `table` | text | input |  |
| E | Record ID | `recordId` | text | input |  |
| F | Field | `field` | text | input |  |
| G | Old Value | `oldValue` | text | input |  |
| H | New Value | `newValue` | text | input |  |
| I | Action | `action` | text | dropdown: LIST_LOG_ACTIONS |  |
| J | Notes | `notes` | text | input |  |

## Monthly Budget (`BUDGET`)

One row per month per main category. Actual = Expense − Refund from Transactions for that month and category, excluding soft-deleted rows (fixed in the 3.0 rebuild).

Named range `TBL_BUDGET` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Budget ID | `id` | text | calculated | `=IF(OR([@month]="",[@category]=""),"","BUD-"&TEXT([@month],"yyyymm")&"-"&UPPER(LEFT(REGEXREPLACE([@category],"[^A-Za-z]",""),4)))` |
| B | Month | `month` | month (1st-of-month date) | input (date) |  |
| C | Category | `category` | text | dropdown: LIST_EXPENSE_CATEGORIES |  |
| D | Planned | `planned` | currency | input |  |
| E | Actual | `actual` | currency | calculated | `=IF([@id]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.category],[@category],[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month],[…` |
| F | Remaining | `remaining` | currency | calculated | `=IF([@id]="","",N([@planned])-[@actual])` |
| G | % Used | `pctUsed` | percent | calculated | `=IF(OR([@id]="",N([@planned])=0),"",[@actual]/[@planned])` |
| H | Notes | `notes` | text | input |  |

## Monthly Plan (`PLAN`)

One flexible-spending target per month. Only Spending Type = Flexible counts here. Weekly guidance (Monday–Sunday) is calculated for the current month only and adapts to what was already spent earlier in the month.

Named range `TBL_PLAN` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Plan ID | `id` | text | calculated | `=IF([@month]="","","PLAN-"&TEXT([@month],"yyyymm"))` |
| B | Month | `month` | month (1st-of-month date) | input (date) |  |
| C | Monthly Flexible Target | `target` | currency | input | Changed in 3.4: an override. Leave blank and the month uses Flexible Target (auto): expected take-home + income adjustment − bills − debt payments − planned savings. Type a number here to use it instead. |
| D | Flexible Spent | `flexSpent` | currency | calculated | `=IF([@id]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.spendingType],"Flexible",[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month…` |
| E | Amount Available | `available` | currency | calculated | `=IF([@id]="","",N([@effectiveTarget])-[@flexSpent])` |
| F | Suggested This Week | `suggestedWeek` | currency | calculated | `=IF(OR([@id]="",[@month]<>DATE(YEAR(TODAY()),MONTH(TODAY()),1)),"",LET(ms,[@month],me,EOMONTH(ms,0),ws,MAX(TODAY()-WEEKDAY(TODAY(),2)+1,ms),we,MIN(ws+6,me),b…` |
| G | Spent This Week | `spentWeek` | currency | calculated | `=IF(OR([@id]="",[@month]<>DATE(YEAR(TODAY()),MONTH(TODAY()),1)),"",LET(ms,[@month],ws,MAX(TODAY()-WEEKDAY(TODAY(),2)+1,ms),SUMIFS([TX.amount],[TX.date],">="&…` |
| H | Notes | `notes` | text | input |  |
| I | Expected Take-Home (auto) | `expectedIncome` | currency | calculated | `=IF([@id]="","",LET(ms,[@month],me,EOMONTH(ms,0),SUMPRODUCT(([EXPECT.active]=TRUE)*N(+[EXPECT.typicalTakeHome])*IFERROR(IF([EXPECT.frequency]="Biweekly",IF(N…` — Added in 3.4: every Active Expected Income row times the paydays that fall in this month (biweekly pay gives two months a year with three paychecks; the yearly average is used until a first paycheck exists). |
| J | Income Adjustment | `incomeAdjustment` | currency | input | Added in 3.4: extra income expected this month (+) or a shortfall such as fewer hours (−). Entered. |
| K | Bills (Recurring, monthly) | `bills` | currency | calculated | `=IF([@id]="","",SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE,[RECUR.group],"<>Loans"))` — Added in 3.4: active Recurring Payments at their monthly equivalent, except the Loans group (counted under Debt Payments). |
| L | Debt Payments (planned) | `debtPayments` | currency | calculated | `=IF([@id]="","",MAX(SUM([DEBTS.minPayment]),SUMIFS([RECUR.monthlyEq],[RECUR.active],TRUE,[RECUR.group],"Loans"))+SUM([DEBTS.plannedExtra])+N(IFERROR(SETTING_…` — Added in 3.4: the larger of the Debts minimum payments and the Loans group on Recurring Payments. |
| M | Planned Savings | `plannedSavings` | currency | calculated | `=IF([@id]="","",SUM([FUNDS.plannedMonthly]))` — Added in 3.4: Planned Monthly across Savings & Reserves. Raise or lower those to decide what goes to savings. |
| N | Flexible Target (auto) | `autoTarget` | currency | calculated | `=IF([@id]="","",N([@expectedIncome])+N([@incomeAdjustment])-N([@bills])-N([@debtPayments])-N([@plannedSavings]))` — Added in 3.4: what is left for flexible spending after bills, debt payments and planned savings. |
| O | Target in Use | `effectiveTarget` | currency | calculated | `=IF([@id]="","",IF(N([@target])>0,[@target],N([@autoTarget])))` — Added in 3.4: the override when one is typed, otherwise the automatic target. Amount Available and the weekly guidance use this. |

## Monthly Summary (`SUMMARY`)

Every month that appears in Income, Transactions, Monthly Plan or Monthly Budget gets a row automatically. Do not type here: all values are calculated from the raw tables.

Named range `TBL_SUMMARY` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Month | `month` | month (1st-of-month date) | calculated | `=IFERROR(SORT(UNIQUE(FILTER({[INCOME.month];[TX.month];[PLAN.month];[BUDGET.month]},{[INCOME.month];[TX.month];[PLAN.month];[BUDGET.month]}<>""))),"")` |
| B | Income / Take-Home | `income` | currency | calculated | `=IF([@month]="","",SUMIFS([INCOME.takeHome],[INCOME.month],[@month]))` |
| C | Spending | `spending` | currency | calculated | `=IF([@month]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Refu…` |
| D | Cash Savings | `cashSavings` | currency | calculated | `=IF([@month]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Savings",[TX.isDeleted],"<>TRUE"))` |
| E | Debt Payments | `debtPayments` | currency | calculated | `=IF([@month]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Debt Payment",[TX.isDeleted],"<>TRUE"))` |
| F | Cash Remaining | `cashRemaining` | currency | calculated | `=IF([@month]="","",[@income]-[@spending]-[@cashSavings]-[@debtPayments])` |
| G | Cash Savings Rate | `cashSavingsRate` | percent | calculated | `=IF(OR([@month]="",N([@income])=0),"",[@cashSavings]/[@income])` |
| H | Reviewed Household Debt | `reviewedDebt` | currency | calculated | `=IF([@month]="","",IF(MAXIFS([QDR.quarterEnd],[QDR.quarterEnd],"<="&EOMONTH([@month],0))=0,"",SUMIFS([QDR.endingBalance],[QDR.quarterEnd],MAXIFS([QDR.quarter…` — Changed in 3.1: excludes debts in the Student Loans group (see the Student Loan Balance column). |
| I | Net Worth Snapshot | `netWorthSnapshot` | currency | calculated | `=IF([@month]="","",IFERROR(INDEX([NW.netWorth],MATCH([@month],[NW.month],0)),""))` |
| J | Retirement Savings | `retirement` | currency | calculated | `=IF([@month]="","",SUMIFS([INCOME.retirement],[INCOME.month],[@month]))` |
| K | Total Savings | `totalSavings` | currency | calculated | `=IF([@month]="","",[@cashSavings]+[@retirement])` |
| L | Total Savings Rate of Gross | `totalSavingsRate` | percent | calculated | `=IF(OR([@month]="",SUMIFS([INCOME.gross],[INCOME.month],[@month])=0),"",[@totalSavings]/SUMIFS([INCOME.gross],[INCOME.month],[@month]))` |
| M | Transaction Income Deposits | `txIncomeDeposits` | currency | calculated | `=IF([@month]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Income",[TX.isDeleted],"<>TRUE"))` |
| N | Income Reconciliation | `incomeReconciliation` | currency | calculated | `=IF([@month]="","",[@txIncomeDeposits]-[@income])` |
| O | Student Loan Balance | `studentLoans` | currency | calculated | `=IF([@month]="","",IF(MAXIFS([QDR.quarterEnd],[QDR.quarterEnd],"<="&EOMONTH([@month],0))=0,"",SUMIFS([QDR.endingBalance],[QDR.quarterEnd],MAXIFS([QDR.quarter…` — Added in 3.1: the Student Loans group from the latest Quarterly Debt Review, kept apart from household debt. |

## Monthly Review (`REVIEW`)

One row per month-end review. Financial figures are pulled from Monthly Summary (not re-typed). Use the qualitative columns to record decisions.

Named range `TBL_REVIEW` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Review ID | `id` | text | calculated | `=IF([@month]="","","REV-"&TEXT([@month],"yyyymm"))` |
| B | Month | `month` | month (1st-of-month date) | input (date) |  |
| C | Status | `status` | text | dropdown: LIST_REVIEW_STATUSES |  |
| D | Income | `income` | currency | calculated | `=IF([@month]="","",IFERROR(INDEX([SUMMARY.income],MATCH([@month],[SUMMARY.month],0)),""))` |
| E | Spending | `spending` | currency | calculated | `=IF([@month]="","",IFERROR(INDEX([SUMMARY.spending],MATCH([@month],[SUMMARY.month],0)),""))` |
| F | Cash Savings | `cashSavings` | currency | calculated | `=IF([@month]="","",IFERROR(INDEX([SUMMARY.cashSavings],MATCH([@month],[SUMMARY.month],0)),""))` |
| G | Total Savings | `totalSavings` | currency | calculated | `=IF([@month]="","",IFERROR(INDEX([SUMMARY.totalSavings],MATCH([@month],[SUMMARY.month],0)),""))` |
| H | Debt Payments | `debtPayments` | currency | calculated | `=IF([@month]="","",IFERROR(INDEX([SUMMARY.debtPayments],MATCH([@month],[SUMMARY.month],0)),""))` |
| I | Cash Remaining | `cashRemaining` | currency | calculated | `=IF([@month]="","",IFERROR(INDEX([SUMMARY.cashRemaining],MATCH([@month],[SUMMARY.month],0)),""))` |
| J | Cash Savings Rate | `savingsRate` | percent | calculated | `=IF([@month]="","",IFERROR(INDEX([SUMMARY.cashSavingsRate],MATCH([@month],[SUMMARY.month],0)),""))` |
| K | Household Debt Balance | `totalDebt` | currency | calculated | `=IF([@month]="","",IFERROR(INDEX([SUMMARY.reviewedDebt],MATCH([@month],[SUMMARY.month],0)),""))` — Changed in 3.1: household debt only; student loans have their own column. |
| L | What Went Well | `wentWell` | text | input |  |
| M | What to Adjust | `adjust` | text | input |  |
| N | Next Month Focus | `focus` | text | input |  |
| O | Reviewed By | `reviewedBy` | text | dropdown: LIST_OWNERS |  |
| P | Reviewed On | `reviewedOn` | date | input (date) |  |
| Q | Notes | `notes` | text | input |  |
| R | Student Loan Balance | `studentLoans` | currency | calculated | `=IF([@month]="","",IFERROR(INDEX([SUMMARY.studentLoans],MATCH([@month],[SUMMARY.month],0)),""))` — Added in 3.1. |

## Net Worth Snapshots (`NW`)

Historical snapshots (one row per month recorded). The live helper to the right calculates current tracked net worth from Accounts and Debts without double-counting credit cards. Use Finance Tracker → Record net worth snapshot to append a row.

Named range `TBL_NW` covers the header row through the last formula row.

| Col | Header | Key | Type | Source | Formula / notes |
|---|---|---|---|---|---|
| A | Snapshot ID | `id` | text | calculated | `=IF([@month]="","","NW-"&TEXT([@month],"yyyymm"))` |
| B | Month | `month` | month (1st-of-month date) | input (date) |  |
| C | Cash & Checking | `cash` | currency | input |  |
| D | Savings | `savings` | currency | input |  |
| E | Retirement | `retirement` | currency | input |  |
| F | Investments | `investments` | currency | input |  |
| G | Property & Other Assets | `property` | currency | input |  |
| H | Other Assets (Deprecated) | `otherDeprecated` | currency | input |  |
| I | Total Debt | `totalDebt` | currency | input |  |
| J | Net Worth | `netWorth` | currency | calculated | `=IF([@id]="","",SUM([@cash]:[@otherDeprecated])-N([@totalDebt]))` |
| K | Notes | `notes` | text | input |  |

## Transactions · Validation Flag (column Z)

One cell concatenates every applicable warning, separated by "; ". Template:

```
=IF([@id]="","",REGEXREPLACE(IF([@date]="","Missing Date; ","")&IF([@type]="","Missing Type; ","")&IF(NOT(ISNUMBER([@amount])),"Missing Amount; ","")&IF(AND(OR([@type]="Expense",[@type]="Refund",[@type]="Income",[@type]="Savings",[@type]="Debt Payment"),[@category]=""),"Missing Category; ","")&IF(AND(OR([@type]="Expense",[@type]="Refund"),[@category]<>"",[@subcategory]=""),"Missing Subcategory; ","")&IF(AND([@category]<>"",[@subcategory]<>"",COUNTIFS([CATS.category],[@category],[CATS.subcategory],[@subcategory])=0),"Subcategory Does Not Match Category; ","")&IF(AND(OR([@type]="Expense",[@type]="Refund"),[@spendingType]=""),"Missing Spending Type; ","")&IF(AND([@fundId]="",OR([@type]="Savings",[@fundingSource]="Sinking Fund",[@fundingSource]="Emergency Fund")),"Missing Fund ID; ","")&IF(AND([@type]="Debt Payment",[@debtId]=""),"Missing Debt ID; ","")&IF(AND([@type]="Split Parent",[@splitRole]<>"Parent"),"Set Split Role to Parent; ","")&IF(AND([@splitRole]="Parent",[@type]<>"Split Parent"),"Parent Must Be Type Split Parent; ","")&IF(AND([@splitRole]="Child",[@parentTxId]=""),"Missing Parent Transaction ID; ","")&IF(AND([@splitRole]="Child",[@parentTxId]<>"",COUNTIF([@@id],[@parentTxId])=0),"Parent Transaction ID Not Found; ","")&IF(AND([@splitRole]="Parent",ISNUMBER([@splitDiff]),ABS(N([@splitDiff]))>0.01),"Split Does Not Balance; ","")&IF(AND([@type]="Income",[@sourceIncomeId]=""),"Missing Source Income ID; ","")&IF(AND([@sourceIncomeId]<>"",COUNTIF([INCOME.id],[@sourceIncomeId])=0),"Source Income ID Not Found; ","")&IF(AND([@sourceIncomeId]<>"",COUNTIF([INCOME.id],[@sourceIncomeId])>0,IFERROR(ABS(N([@amount])-SUMIF([INCOME.id],[@sourceIncomeId],[INCOME.takeHome]))>0.01,FALSE)),"Deposit Does Not Match Take-Home; ","")&IF(AND([@sourceIncomeId]<>"",COUNTIFS([@@sourceIncomeId],[@sourceIncomeId],[@@isDeleted],"<>TRUE")>1),"Income ID Linked More Than Once; ",""),"; $",""))
```

## Dropdown lists (Categories tab, columns J onward; named ranges `LIST_<KEY>`)

| Key | Header | Values |
|---|---|---|
| TRANSACTION_TYPES | Transaction Types | Income, Expense, Savings, Debt Payment, Transfer, Refund, Split Parent |
| SPENDING_TYPES | Spending Types | Fixed, Flexible, Planned Irregular, Unexpected |
| FUNDING_SOURCES | Funding Sources | Monthly Cash Flow, Sinking Fund, Emergency Fund, Other |
| NEED_WANT | Need/Want | Need, Want |
| FIXED_VARIABLE | Fixed/Variable (Deprecated) | Fixed, Variable |
| HOUSEHOLD_PERSONAL | Household/Personal | Household, Personal |
| PERSONS | Persons | Ben, Valerie |
| OWNERS | Owners | Ben, Valerie, Household |
| ACCOUNT_TYPES | Account Types | Checking, Savings, Cash, Credit Card, Investment, Retirement, HSA, Loan, Property, Vehicle, Other, Pension |
| INCOME_TYPES | Income Types | Salary, Hourly Wages, Bonus, Commission, Side Income, Reimbursement, Other |
| FUND_TYPES | Fund Types | Emergency Fund, Sinking Fund, Short-Term Goal, Retirement, Education, Other, Parked for Bills |
| DEBT_TYPES | Debt Types | Credit Card, Student Loan, Auto Loan, Mortgage, Personal Loan, Medical, Tax Debt, Other |
| FREQUENCIES | Frequencies | Weekly, Biweekly, Monthly, Quarterly, Semiannual, Annual |
| PAY_FREQUENCIES | Pay Frequencies | Weekly, Biweekly, Semimonthly, Monthly |
| RECURRING_GROUPS | Recurring Groups | Housing, Utilities, Loans, Insurance, Subscriptions, Memberships, Other |
| PAYMENT_TYPES | Payment Types | Bill, Subscription, Loan Payment, Insurance Premium, Membership, Transfer, Other |
| TX_STATUSES | Transaction Statuses | Pending, Posted, Reviewed |
| SPLIT_ROLES | Split Roles | Parent, Child |
| REVIEW_STATUSES | Review Statuses | Not Started, In Progress, Complete |
| PROVIDERS | Import Providers | Plaid, Manual CSV, Manual Entry, Other |
| BUREAUS | Credit Bureaus | Experian, Equifax, TransUnion |
| SCORE_MODELS | Score Models | FICO 8, FICO 9, FICO 10, VantageScore 3.0, VantageScore 4.0, Other |
| YES_NO | Yes/No | Yes, No |
| LOG_ACTIONS | Change Log Actions | Insert, Update, Soft Delete, Restore, Import, Split, Bulk Edit |
| DEBT_GROUPS | Debt Groups | Household, Student Loans |
| MATCH_TYPES | Rule Match Types | Contains, Starts With, Exact |
| STAGING_STATUSES | Import Statuses | Needs Review, Needs Split, Ready, Imported, Ignored, Superseded, Removed |
| CONNECTION_STATUSES | Connection Statuses | Active, Needs Attention, Disconnected, Pending |

Derived lists (formula-driven from the taxonomy): `LIST_ALL_CATEGORIES`, `LIST_EXPENSE_CATEGORIES`, `LIST_ALL_SUBCATEGORIES`.

## Category taxonomy

| Category | Subcategory | Default Need/Want | Default Fixed/Variable (deprecated) | Default Spending Type |
|---|---|---|---|---|
| Income | Salary |  |  |  |
| Income | Hourly Wages |  |  |  |
| Income | Bonus |  |  |  |
| Income | Side Income |  |  |  |
| Income | Interest & Dividends |  |  |  |
| Income | Tax Refund |  |  |  |
| Income | Gift Received |  |  |  |
| Income | Reimbursement |  |  |  |
| Income | Other Income |  |  |  |
| Housing | Mortgage or Rent | Need | Fixed | Fixed |
| Housing | HOA Fees | Need | Fixed | Fixed |
| Housing | Electric | Need | Fixed | Fixed |
| Housing | Natural Gas | Need | Fixed | Fixed |
| Housing | Water & Sewer | Need | Fixed | Fixed |
| Housing | Trash & Recycling | Need | Fixed | Fixed |
| Housing | Internet | Need | Fixed | Fixed |
| Housing | Cell Phone | Need | Fixed | Fixed |
| Housing | Home Maintenance | Need | Variable | Flexible |
| Housing | Home Repair | Need | Variable | Unexpected |
| Housing | Furniture & Decor | Want | Variable | Flexible |
| Housing | Household Supplies | Need | Variable | Flexible |
| Food | Groceries | Need | Variable | Flexible |
| Food | Dining Out | Want | Variable | Flexible |
| Food | Takeout & Delivery | Want | Variable | Flexible |
| Food | Coffee & Snacks | Want | Variable | Flexible |
| Food | Alcohol | Want | Variable | Flexible |
| Transportation | Fuel | Need | Variable | Flexible |
| Transportation | Routine Maintenance | Need | Variable | Flexible |
| Transportation | Repairs | Need | Variable | Unexpected |
| Transportation | Parking & Tolls | Need | Variable | Flexible |
| Transportation | Registration & Fees | Need | Variable | Planned Irregular |
| Transportation | Public Transit & Rideshare | Need | Variable | Flexible |
| Childcare | Nanny | Need | Fixed | Fixed |
| Child Expenses | Clothing | Need | Variable | Flexible |
| Child Expenses | Medical | Need | Variable | Unexpected |
| Child Expenses | Activities | Want | Variable | Flexible |
| Child Expenses | Education | Need | Variable | Flexible |
| Child Expenses | Supplies | Need | Variable | Flexible |
| Child Expenses | Toys | Want | Variable | Flexible |
| Child Expenses | Other | Need | Variable | Flexible |
| Health | Doctor Visits | Need | Variable | Unexpected |
| Health | Dental | Need | Variable | Unexpected |
| Health | Vision | Need | Variable | Unexpected |
| Health | Pharmacy & Prescriptions | Need | Variable | Flexible |
| Health | Therapy & Counseling | Need | Variable | Flexible |
| Health | Gym & Fitness | Want | Fixed | Fixed |
| Health | Medical Bills | Need | Variable | Unexpected |
| Personal | Clothing | Want | Variable | Flexible |
| Personal | Haircuts & Grooming | Want | Variable | Flexible |
| Personal | Personal Care | Need | Variable | Flexible |
| Personal | Subscriptions | Want | Fixed | Fixed |
| Personal | Hobbies | Want | Variable | Flexible |
| Personal | Education & Courses | Want | Variable | Flexible |
| Personal | Spending Money | Want | Variable | Flexible |
| Personal | Cash & ATM | Want | Variable | Flexible |
| Entertainment | Streaming Services | Want | Fixed | Fixed |
| Entertainment | Movies & Events | Want | Variable | Flexible |
| Entertainment | Games & Apps | Want | Variable | Flexible |
| Entertainment | Books & Music | Want | Variable | Flexible |
| Entertainment | Outings & Recreation | Want | Variable | Flexible |
| Travel | Airfare | Want | Variable | Planned Irregular |
| Travel | Lodging | Want | Variable | Planned Irregular |
| Travel | Rental Car & Transport | Want | Variable | Planned Irregular |
| Travel | Travel Food | Want | Variable | Planned Irregular |
| Travel | Activities & Excursions | Want | Variable | Planned Irregular |
| Travel | Other Travel | Want | Variable | Planned Irregular |
| Pets | Pet Food & Supplies | Need | Variable | Flexible |
| Pets | Veterinary | Need | Variable | Unexpected |
| Pets | Grooming & Boarding | Want | Variable | Flexible |
| Pets | Other Pet | Want | Variable | Flexible |
| Gifts & Giving | Gifts | Want | Variable | Flexible |
| Gifts & Giving | Charitable Giving | Want | Variable | Flexible |
| Gifts & Giving | Tithes & Recurring Donations | Want | Fixed | Fixed |
| Gifts & Giving | Holidays | Want | Variable | Planned Irregular |
| Gifts & Giving | Cards & Wrapping | Want | Variable | Flexible |
| Insurance | Health Insurance (Non-Payroll) | Need | Fixed | Fixed |
| Insurance | Auto Insurance | Need | Fixed | Fixed |
| Insurance | Home / Renters Insurance | Need | Fixed | Fixed |
| Insurance | Life Insurance | Need | Fixed | Fixed |
| Insurance | Pet Insurance | Need | Fixed | Fixed |
| Insurance | Other Insurance | Need | Fixed | Fixed |
| Taxes | Federal Tax Payment | Need | Variable | Planned Irregular |
| Taxes | State / Local Tax Payment | Need | Variable | Planned Irregular |
| Taxes | Property Tax | Need | Fixed | Planned Irregular |
| Taxes | Tax Preparation | Need | Variable | Planned Irregular |
| Taxes | Other Taxes | Need | Variable | Planned Irregular |
| Miscellaneous | Bank Fees | Need | Variable | Unexpected |
| Miscellaneous | Postage & Shipping | Need | Variable | Flexible |
| Miscellaneous | Other | Want | Variable | Flexible |
| Savings | Emergency Fund |  |  |  |
| Savings | Sinking Fund Contribution |  |  |  |
| Savings | Short-Term Goal |  |  |  |
| Savings | Retirement Contribution (Non-Payroll) |  |  |  |
| Savings | Education Savings |  |  |  |
| Savings | Investment Contribution |  |  |  |
| Savings | Other Savings |  |  |  |
| Debt Payments | Credit Card Payment |  |  |  |
| Debt Payments | Student Loan Payment |  |  |  |
| Debt Payments | Auto Loan Payment |  |  |  |
| Debt Payments | Personal Loan Payment |  |  |  |
| Debt Payments | Medical Debt Payment |  |  |  |
| Debt Payments | Other Debt Payment |  |  |  |

## App data rules

1. Income is authoritative for paycheck gross, deductions and take-home.
2. Imported bank data enters Import Staging before Transactions.
3. Every Expense/Refund requires a Spending Type.
4. Funding Source = Sinking Fund or Emergency Fund requires a Fund ID.
5. Savings transactions require a Fund ID.
6. Debt Payment transactions require a Debt ID.
7. A credit-card payoff is not new spending when the purchases were already recorded as expenses.
8. Never hard-delete a financial record: tick Is Deleted and set Deleted At.
9. Store month values as first-of-month dates, never as text.
10. Payroll retirement contributions belong in Income, not Transactions.
11. Dashboard monthly cards follow the Selected Month (Dashboard!B3).
12. Current Flexible Spending always follows today's calendar month and Monday–Sunday week.
13. Derived sheets (Monthly Summary, Dashboard) are read-only; the app never writes to them.
