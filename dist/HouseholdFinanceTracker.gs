/**
 * Household Finance Tracker — bundled Apps Script
 * Generated 2026-11-07T14:33:20Z from apps-script/*.gs by scripts/bundle.sh
 * Source: https://github.com/howardbe517-sudo/household-finance-tracker
 *
 * HOW TO USE
 *   1. Create a new, blank Google Sheet.
 *   2. Extensions → Apps Script. Delete the default contents of Code.gs.
 *   3. Paste this entire file. Save (Ctrl/Cmd+S).
 *   4. In the function dropdown pick buildWorkbookWithSample (or buildWorkbookEmpty) → Run.
 *   5. Approve the permissions (it only touches this spreadsheet). Wait ~1–2 minutes.
 *   6. Back in the Sheet: reload. Use the 'Finance Tracker' menu for QA and helpers.
 */

/* ===================================================================== */
/* 00_Config.gs
/* ===================================================================== */
/**
 * Household Finance Tracker — 00_Config.gs
 *
 * Single source of truth for sheet names, colors, dropdown lists, the
 * category taxonomy and the column schema of every table. Everything else
 * (builder, sample data, QA, API scaffold, data dictionary) reads from here.
 *
 * Formula templates use these tokens, resolved by resolveFormula_():
 *   {r}            current row number
 *   [@key]         same-table cell in the current row            -> $D5
 *   [@@key]        same-table open column range                   -> $D$5:$D
 *   [@^key]        same-table running range from first row to r  -> $L$5:$L5
 *   [TABLE.key]    another table's open column range              -> 'Transactions'!$D$5:$D
 */

const HFT = {
  TITLE: 'Household Finance Tracker',
  SCHEMA_VERSION: '3.0-rebuild-2026-11-07',
  BUILD_VERSION: '1.0.0',
  REPO_URL: 'https://github.com/howardbe517-sudo/household-finance-tracker',
  PERSONS: ['Ben', 'Valerie'],
  SAMPLE_TAG: 'SAMPLE',
  SAMPLE_USER: 'sample-data',
};

const SHEETS = {
  START: 'Start Here',
  DASH: 'Dashboard',
  INCOME: 'Income',
  TX: 'Transactions',
  RECUR: 'Recurring Payments',
  BUDGET: 'Monthly Budget',
  PLAN: 'Monthly Plan',
  SUMMARY: 'Monthly Summary',
  FUNDS: 'Savings & Reserves',
  DEBTS: 'Debts',
  QDR: 'Quarterly Debt Review',
  NW: 'Net Worth Snapshots',
  ACCOUNTS: 'Accounts',
  REVIEW: 'Monthly Review',
  CATS: 'Categories',
  SETUP: 'App Setup',
  SOURCES: 'Sources',
  STAGING: 'Import Staging',
  LOG: 'Change Log',
  CREDIT: 'Credit Scores',
};

const TAB_ORDER = [
  SHEETS.START, SHEETS.DASH, SHEETS.INCOME, SHEETS.TX, SHEETS.RECUR,
  SHEETS.BUDGET, SHEETS.PLAN, SHEETS.SUMMARY, SHEETS.FUNDS, SHEETS.DEBTS,
  SHEETS.QDR, SHEETS.NW, SHEETS.ACCOUNTS, SHEETS.REVIEW, SHEETS.CATS,
  SHEETS.SETUP, SHEETS.SOURCES, SHEETS.STAGING, SHEETS.LOG, SHEETS.CREDIT,
];

const COLORS = {
  NAVY: '#17324D',
  TEAL: '#1F6F78',
  PALE_BLUE: '#E8F0F7',
  TEXT: '#1F2933',
  MUTED_TEXT: '#5F6B7A',
  WHITE: '#FFFFFF',
  INPUT: '#FFF8E1',
  UNDER_FILL: '#EAF6EE', UNDER_FONT: '#24563A',
  OVER_FILL: '#F8D5DA', OVER_FONT: '#842029',
  WARN_FILL: '#FFF3CD', WARN_FONT: '#7A4E00',
  BEN: '#FBF3DE',        // pale warm cream
  VALERIE: '#FBE3D1',    // muted peach
  HOUSEHOLD: '#E6ECF2',  // pale blue-gray
  CARD_GROSS: '#DCEBF7',
  CARD_TAKEHOME: '#C9DDF0',
  CARD_SPENDING: '#FBE3D1',
  CARD_SAVINGS: '#DCEFE2',
  UNCATEGORIZED: '#FFCDD2',
  DELETED_TEXT: '#9AA5B1',
  BORDER: '#C9D2DC',
};

const CATEGORY_COLORS = {
  'Housing': '#D6DAE1',
  'Food': '#FFF4C2',
  'Transportation': '#D9E8F7',
  'Child Expenses': '#E4D9F5',
  'Health': '#D4F0E2',
  'Personal': '#EADFF5',
  'Entertainment': '#FDDCC4',
  'Travel': '#CDEDEB',
  'Pets': '#E6EBCF',
  'Gifts & Giving': '#F8DDE3',
  'Insurance': '#DCDDF5',
  'Taxes': '#EFE3D0',
  'Miscellaneous': '#E3E5E8',
  'Savings': '#CFE9D6',
  'Debt Payments': '#F6D5DB',
  'Income': '#D6EAF8',
};

/** Fixed dropdown lists. Stored on the Categories tab (columns J onward) as named ranges LIST_<key>. */
const LISTS = [
  { key: 'TRANSACTION_TYPES', header: 'Transaction Types', values: ['Income', 'Expense', 'Savings', 'Debt Payment', 'Transfer', 'Refund', 'Split Parent'] },
  { key: 'SPENDING_TYPES', header: 'Spending Types', values: ['Fixed', 'Flexible', 'Planned Irregular', 'Unexpected'] },
  { key: 'FUNDING_SOURCES', header: 'Funding Sources', values: ['Monthly Cash Flow', 'Sinking Fund', 'Emergency Fund', 'Other'] },
  { key: 'NEED_WANT', header: 'Need/Want', values: ['Need', 'Want'] },
  { key: 'FIXED_VARIABLE', header: 'Fixed/Variable (Deprecated)', values: ['Fixed', 'Variable'] },
  { key: 'HOUSEHOLD_PERSONAL', header: 'Household/Personal', values: ['Household', 'Personal'] },
  { key: 'PERSONS', header: 'Persons', values: ['Ben', 'Valerie'] },
  { key: 'OWNERS', header: 'Owners', values: ['Ben', 'Valerie', 'Household'] },
  { key: 'ACCOUNT_TYPES', header: 'Account Types', values: ['Checking', 'Savings', 'Cash', 'Credit Card', 'Investment', 'Retirement', 'HSA', 'Loan', 'Property', 'Vehicle', 'Other'] },
  { key: 'INCOME_TYPES', header: 'Income Types', values: ['Salary', 'Hourly Wages', 'Bonus', 'Commission', 'Side Income', 'Reimbursement', 'Other'] },
  { key: 'FUND_TYPES', header: 'Fund Types', values: ['Emergency Fund', 'Sinking Fund', 'Short-Term Goal', 'Retirement', 'Education', 'Other'] },
  { key: 'DEBT_TYPES', header: 'Debt Types', values: ['Credit Card', 'Student Loan', 'Auto Loan', 'Mortgage', 'Personal Loan', 'Medical', 'Other'] },
  { key: 'FREQUENCIES', header: 'Frequencies', values: ['Weekly', 'Biweekly', 'Monthly', 'Quarterly', 'Semiannual', 'Annual'] },
  { key: 'RECURRING_GROUPS', header: 'Recurring Groups', values: ['Housing', 'Utilities', 'Loans', 'Insurance', 'Subscriptions', 'Memberships', 'Other'] },
  { key: 'PAYMENT_TYPES', header: 'Payment Types', values: ['Bill', 'Subscription', 'Loan Payment', 'Insurance Premium', 'Membership', 'Transfer', 'Other'] },
  { key: 'TX_STATUSES', header: 'Transaction Statuses', values: ['Pending', 'Posted', 'Reviewed'] },
  { key: 'SPLIT_ROLES', header: 'Split Roles', values: ['Parent', 'Child'] },
  { key: 'REVIEW_STATUSES', header: 'Review Statuses', values: ['Not Started', 'In Progress', 'Complete'] },
  { key: 'PROVIDERS', header: 'Import Providers', values: ['Plaid', 'Manual CSV', 'Manual Entry', 'Other'] },
  { key: 'BUREAUS', header: 'Credit Bureaus', values: ['Experian', 'Equifax', 'TransUnion'] },
  { key: 'SCORE_MODELS', header: 'Score Models', values: ['FICO 8', 'FICO 9', 'FICO 10', 'VantageScore 3.0', 'VantageScore 4.0', 'Other'] },
  { key: 'YES_NO', header: 'Yes/No', values: ['Yes', 'No'] },
  { key: 'LOG_ACTIONS', header: 'Change Log Actions', values: ['Insert', 'Update', 'Soft Delete', 'Restore', 'Import', 'Split', 'Bulk Edit'] },
];

/** Lists derived by formula from the taxonomy table on the Categories tab. */
const DERIVED_LISTS = [
  { key: 'ALL_CATEGORIES', header: 'All Categories (auto)',
    formula: '=IFERROR(UNIQUE(FILTER($B$5:$B,$B$5:$B<>"")),"")' },
  { key: 'EXPENSE_CATEGORIES', header: 'Expense Categories (auto)',
    formula: '=IFERROR(UNIQUE(FILTER($B$5:$B,($B$5:$B<>"")*($B$5:$B<>"Income")*($B$5:$B<>"Savings")*($B$5:$B<>"Debt Payments"))),"")' },
  { key: 'ALL_SUBCATEGORIES', header: 'All Subcategories (auto)',
    formula: '=IFERROR(SORT(UNIQUE(FILTER($D$5:$D,$D$5:$D<>""))),"")' },
];
const LIST_FIRST_COL = 10;   // column J on Categories
const LIST_FIRST_ROW = 5;
const LIST_LAST_ROW = 60;

/**
 * Category taxonomy: [Category, Subcategory, Default Need/Want, Default Fixed/Variable, Default Spending Type]
 * Non-expense categories (Income, Savings, Debt Payments) carry no spending defaults.
 */
const TAXONOMY = [
  ['Income', 'Salary', '', '', ''],
  ['Income', 'Hourly Wages', '', '', ''],
  ['Income', 'Bonus', '', '', ''],
  ['Income', 'Side Income', '', '', ''],
  ['Income', 'Interest & Dividends', '', '', ''],
  ['Income', 'Tax Refund', '', '', ''],
  ['Income', 'Gift Received', '', '', ''],
  ['Income', 'Reimbursement', '', '', ''],
  ['Income', 'Other Income', '', '', ''],

  ['Housing', 'Mortgage or Rent', 'Need', 'Fixed', 'Fixed'],
  ['Housing', 'HOA Fees', 'Need', 'Fixed', 'Fixed'],
  ['Housing', 'Electric', 'Need', 'Fixed', 'Fixed'],
  ['Housing', 'Natural Gas', 'Need', 'Fixed', 'Fixed'],
  ['Housing', 'Water & Sewer', 'Need', 'Fixed', 'Fixed'],
  ['Housing', 'Trash & Recycling', 'Need', 'Fixed', 'Fixed'],
  ['Housing', 'Internet', 'Need', 'Fixed', 'Fixed'],
  ['Housing', 'Cell Phone', 'Need', 'Fixed', 'Fixed'],
  ['Housing', 'Home Maintenance', 'Need', 'Variable', 'Flexible'],
  ['Housing', 'Home Repair', 'Need', 'Variable', 'Unexpected'],
  ['Housing', 'Furniture & Decor', 'Want', 'Variable', 'Flexible'],
  ['Housing', 'Household Supplies', 'Need', 'Variable', 'Flexible'],

  ['Food', 'Groceries', 'Need', 'Variable', 'Flexible'],
  ['Food', 'Dining Out', 'Want', 'Variable', 'Flexible'],
  ['Food', 'Takeout & Delivery', 'Want', 'Variable', 'Flexible'],
  ['Food', 'Coffee & Snacks', 'Want', 'Variable', 'Flexible'],
  ['Food', 'Alcohol', 'Want', 'Variable', 'Flexible'],

  ['Transportation', 'Fuel', 'Need', 'Variable', 'Flexible'],
  ['Transportation', 'Routine Maintenance', 'Need', 'Variable', 'Flexible'],
  ['Transportation', 'Repairs', 'Need', 'Variable', 'Unexpected'],
  ['Transportation', 'Parking & Tolls', 'Need', 'Variable', 'Flexible'],
  ['Transportation', 'Registration & Fees', 'Need', 'Variable', 'Planned Irregular'],
  ['Transportation', 'Public Transit & Rideshare', 'Need', 'Variable', 'Flexible'],

  ['Child Expenses', 'Child Care', 'Need', 'Fixed', 'Fixed'],
  ['Child Expenses', 'Clothing', 'Need', 'Variable', 'Flexible'],
  ['Child Expenses', 'Medical', 'Need', 'Variable', 'Unexpected'],
  ['Child Expenses', 'Activities', 'Want', 'Variable', 'Flexible'],
  ['Child Expenses', 'Education', 'Need', 'Variable', 'Flexible'],
  ['Child Expenses', 'Supplies', 'Need', 'Variable', 'Flexible'],
  ['Child Expenses', 'Toys', 'Want', 'Variable', 'Flexible'],
  ['Child Expenses', 'Other', 'Need', 'Variable', 'Flexible'],

  ['Health', 'Doctor Visits', 'Need', 'Variable', 'Unexpected'],
  ['Health', 'Dental', 'Need', 'Variable', 'Unexpected'],
  ['Health', 'Vision', 'Need', 'Variable', 'Unexpected'],
  ['Health', 'Pharmacy & Prescriptions', 'Need', 'Variable', 'Flexible'],
  ['Health', 'Therapy & Counseling', 'Need', 'Variable', 'Flexible'],
  ['Health', 'Gym & Fitness', 'Want', 'Fixed', 'Fixed'],
  ['Health', 'Medical Bills', 'Need', 'Variable', 'Unexpected'],

  ['Personal', 'Clothing', 'Want', 'Variable', 'Flexible'],
  ['Personal', 'Haircuts & Grooming', 'Want', 'Variable', 'Flexible'],
  ['Personal', 'Personal Care', 'Need', 'Variable', 'Flexible'],
  ['Personal', 'Subscriptions', 'Want', 'Fixed', 'Fixed'],
  ['Personal', 'Hobbies', 'Want', 'Variable', 'Flexible'],
  ['Personal', 'Education & Courses', 'Want', 'Variable', 'Flexible'],
  ['Personal', 'Spending Money', 'Want', 'Variable', 'Flexible'],
  ['Personal', 'Cash & ATM', 'Want', 'Variable', 'Flexible'],

  ['Entertainment', 'Streaming Services', 'Want', 'Fixed', 'Fixed'],
  ['Entertainment', 'Movies & Events', 'Want', 'Variable', 'Flexible'],
  ['Entertainment', 'Games & Apps', 'Want', 'Variable', 'Flexible'],
  ['Entertainment', 'Books & Music', 'Want', 'Variable', 'Flexible'],
  ['Entertainment', 'Outings & Recreation', 'Want', 'Variable', 'Flexible'],

  ['Travel', 'Airfare', 'Want', 'Variable', 'Planned Irregular'],
  ['Travel', 'Lodging', 'Want', 'Variable', 'Planned Irregular'],
  ['Travel', 'Rental Car & Transport', 'Want', 'Variable', 'Planned Irregular'],
  ['Travel', 'Travel Food', 'Want', 'Variable', 'Planned Irregular'],
  ['Travel', 'Activities & Excursions', 'Want', 'Variable', 'Planned Irregular'],
  ['Travel', 'Other Travel', 'Want', 'Variable', 'Planned Irregular'],

  ['Pets', 'Pet Food & Supplies', 'Need', 'Variable', 'Flexible'],
  ['Pets', 'Veterinary', 'Need', 'Variable', 'Unexpected'],
  ['Pets', 'Grooming & Boarding', 'Want', 'Variable', 'Flexible'],
  ['Pets', 'Other Pet', 'Want', 'Variable', 'Flexible'],

  ['Gifts & Giving', 'Gifts', 'Want', 'Variable', 'Flexible'],
  ['Gifts & Giving', 'Charitable Giving', 'Want', 'Variable', 'Flexible'],
  ['Gifts & Giving', 'Tithes & Recurring Donations', 'Want', 'Fixed', 'Fixed'],
  ['Gifts & Giving', 'Holidays', 'Want', 'Variable', 'Planned Irregular'],
  ['Gifts & Giving', 'Cards & Wrapping', 'Want', 'Variable', 'Flexible'],

  ['Insurance', 'Health Insurance (Non-Payroll)', 'Need', 'Fixed', 'Fixed'],
  ['Insurance', 'Auto Insurance', 'Need', 'Fixed', 'Fixed'],
  ['Insurance', 'Home / Renters Insurance', 'Need', 'Fixed', 'Fixed'],
  ['Insurance', 'Life Insurance', 'Need', 'Fixed', 'Fixed'],
  ['Insurance', 'Pet Insurance', 'Need', 'Fixed', 'Fixed'],
  ['Insurance', 'Other Insurance', 'Need', 'Fixed', 'Fixed'],

  ['Taxes', 'Federal Tax Payment', 'Need', 'Variable', 'Planned Irregular'],
  ['Taxes', 'State / Local Tax Payment', 'Need', 'Variable', 'Planned Irregular'],
  ['Taxes', 'Property Tax', 'Need', 'Fixed', 'Planned Irregular'],
  ['Taxes', 'Tax Preparation', 'Need', 'Variable', 'Planned Irregular'],
  ['Taxes', 'Other Taxes', 'Need', 'Variable', 'Planned Irregular'],

  ['Miscellaneous', 'Bank Fees', 'Need', 'Variable', 'Unexpected'],
  ['Miscellaneous', 'Postage & Shipping', 'Need', 'Variable', 'Flexible'],
  ['Miscellaneous', 'Other', 'Want', 'Variable', 'Flexible'],

  ['Savings', 'Emergency Fund', '', '', ''],
  ['Savings', 'Sinking Fund Contribution', '', '', ''],
  ['Savings', 'Short-Term Goal', '', '', ''],
  ['Savings', 'Retirement Contribution (Non-Payroll)', '', '', ''],
  ['Savings', 'Education Savings', '', '', ''],
  ['Savings', 'Investment Contribution', '', '', ''],
  ['Savings', 'Other Savings', '', '', ''],

  ['Debt Payments', 'Credit Card Payment', '', '', ''],
  ['Debt Payments', 'Student Loan Payment', '', '', ''],
  ['Debt Payments', 'Auto Loan Payment', '', '', ''],
  ['Debt Payments', 'Personal Loan Payment', '', '', ''],
  ['Debt Payments', 'Medical Debt Payment', '', '', ''],
  ['Debt Payments', 'Other Debt Payment', '', '', ''],
];

/* ------------------------------------------------------------------ */
/* Column schema                                                       */
/* ------------------------------------------------------------------ */
/**
 * Column spec: { key, h (header), w (width px), fmt, v (validation), f (formula template), note }
 *  fmt: 'currency' | 'date' | 'datetime' | 'month' | 'percent' | 'int' | 'text'
 *  v:   { list:'KEY' } | { derived:'KEY' } | { idsOf:'TABLE' } | { checkbox:true } | { date:true }
 */

const C = {
  cur: 'currency', date: 'date', dt: 'datetime', month: 'month', pct: 'percent', int: 'int', text: 'text',
};

const TABLES = {};

TABLES.CATS = {
  key: 'CATS', sheet: SHEETS.CATS, headerRow: 4, firstRow: 5, lastRow: 204,
  title: 'Categories & Reference Lists',
  note: 'Controlled taxonomy (one row per subcategory) plus every dropdown list used in the workbook. Apps and AI classify against this table; do not invent categories elsewhere.',
  idPrefix: 'CAT', idPattern: 'CAT-01 / SUB-0101', extraCols: 40, keepExtras: true,
  columns: [
    { key: 'categoryId', h: 'Category ID', w: 95 },
    { key: 'category', h: 'Category', w: 140 },
    { key: 'subcategoryId', h: 'Subcategory ID', w: 110 },
    { key: 'subcategory', h: 'Subcategory', w: 230 },
    { key: 'needWant', h: 'Default Need/Want', w: 120, v: { list: 'NEED_WANT' } },
    { key: 'fixedVariable', h: 'Default Fixed/Variable (Deprecated)', w: 150, v: { list: 'FIXED_VARIABLE' } },
    { key: 'active', h: 'Active?', w: 70, v: { checkbox: true } },
    { key: 'spendingType', h: 'Default Spending Type', w: 150, v: { list: 'SPENDING_TYPES' } },
  ],
};

TABLES.ACCOUNTS = {
  key: 'ACCOUNTS', sheet: SHEETS.ACCOUNTS, headerRow: 4, firstRow: 5, lastRow: 104,
  title: 'Accounts',
  note: 'One row per financial account or tracked asset. Balances are entered manually until Plaid is connected. Credit cards are liabilities; link them to a Debts row to avoid double-counting in net worth.',
  idPrefix: 'ACC', idPattern: 'ACC-001', logChanges: true,
  columns: [
    { key: 'id', h: 'Account ID', w: 95 },
    { key: 'name', h: 'Account Name', w: 220 },
    { key: 'institution', h: 'Institution', w: 160 },
    { key: 'accountType', h: 'Account Type', w: 120, v: { list: 'ACCOUNT_TYPES' } },
    { key: 'owner', h: 'Owner', w: 100, v: { list: 'OWNERS' } },
    { key: 'includeNW', h: 'Include in Net Worth?', w: 120, v: { list: 'YES_NO' } },
    { key: 'startingBalance', h: 'Starting Balance', w: 120, fmt: C.cur },
    { key: 'currentBalance', h: 'Current Balance', w: 120, fmt: C.cur },
    { key: 'lastUpdated', h: 'Last Updated', w: 110, fmt: C.date, v: { date: true } },
    { key: 'notes', h: 'Notes', w: 280 },
  ],
};

TABLES.INCOME = {
  key: 'INCOME', sheet: SHEETS.INCOME, headerRow: 4, firstRow: 5, lastRow: 504,
  title: 'Income — Paycheck Database',
  note: 'Authoritative source for gross pay, payroll deductions and take-home. One row per paycheck. Bank deposits imported into Transactions link back here through Source Income ID.',
  idPrefix: 'INC', idPattern: 'INC-0001', logChanges: true, freezeCols: 2,
  columns: [
    { key: 'id', h: 'Income ID', w: 95 },
    { key: 'payDate', h: 'Pay Date', w: 100, fmt: C.date, v: { date: true } },
    { key: 'month', h: 'Month', w: 95, fmt: C.month, f: '=IF([@payDate]="","",DATE(YEAR([@payDate]),MONTH([@payDate]),1))' },
    { key: 'person', h: 'Person', w: 90, v: { list: 'PERSONS' } },
    { key: 'employer', h: 'Employer / Source', w: 170 },
    { key: 'incomeType', h: 'Income Type', w: 110, v: { list: 'INCOME_TYPES' } },
    { key: 'gross', h: 'Gross Pay', w: 105, fmt: C.cur },
    { key: 'fedTax', h: 'Federal Tax', w: 100, fmt: C.cur },
    { key: 'stateTax', h: 'State / Local Tax', w: 110, fmt: C.cur },
    { key: 'ssMed', h: 'Social Security & Medicare', w: 130, fmt: C.cur },
    { key: 'health', h: 'Health / Insurance', w: 110, fmt: C.cur },
    { key: 'retirement', h: 'Retirement Contribution', w: 120, fmt: C.cur },
    { key: 'otherDed', h: 'Other Deductions', w: 110, fmt: C.cur },
    { key: 'totalDed', h: 'Total Deductions', w: 115, fmt: C.cur, f: '=IF([@id]="","",SUM([@fedTax]:[@otherDed]))' },
    { key: 'takeHome', h: 'Take-Home Pay', w: 115, fmt: C.cur, f: '=IF([@id]="","",N([@gross])-[@totalDed])' },
    { key: 'depositAccount', h: 'Deposit Account ID', w: 120, v: { idsOf: 'ACCOUNTS' } },
    { key: 'notes', h: 'Notes', w: 220 },
    { key: 'lastUpdated', h: 'Last Updated', w: 110, fmt: C.date, v: { date: true } },
    { key: 'linkedTx', h: 'Linked Deposit TX', w: 120,
      f: '=IF([@id]="","",IFERROR(INDEX(FILTER([TX.id],[TX.sourceIncomeId]=[@id],[TX.isDeleted]<>TRUE),1),"Unlinked"))',
      note: 'Added in the 3.0 rebuild: shows the Transactions deposit linked to this paycheck, or "Unlinked".' },
  ],
};

TABLES.TX = {
  key: 'TX', sheet: SHEETS.TX, headerRow: 4, firstRow: 5, lastRow: 1004,
  title: 'Transactions — Master Ledger',
  note: 'One financial event per row. Spending = Expense − Refund (soft-deleted rows and Split Parents excluded). Savings, Debt Payment and Transfer rows are never counted as spending. Rows are never hard-deleted: tick Is Deleted instead.',
  idPrefix: 'TX', idPattern: 'TX-000001', logChanges: true, freezeCols: 3,
  columns: [
    { key: 'id', h: 'Transaction ID', w: 105 },
    { key: 'date', h: 'Date', w: 95, fmt: C.date, v: { date: true } },
    { key: 'description', h: 'Description', w: 220 },
    { key: 'amount', h: 'Amount ($)', w: 100, fmt: C.cur },
    { key: 'type', h: 'Type', w: 110, v: { list: 'TRANSACTION_TYPES' } },
    { key: 'category', h: 'Category', w: 130, v: { derived: 'ALL_CATEGORIES' } },
    { key: 'subcategory', h: 'Subcategory', w: 180, v: { derived: 'ALL_SUBCATEGORIES' } },
    { key: 'accountId', h: 'Account ID', w: 95, v: { idsOf: 'ACCOUNTS' } },
    { key: 'person', h: 'Person', w: 90, v: { list: 'OWNERS' } },
    { key: 'hhPersonal', h: 'Household/Personal', w: 110, v: { list: 'HOUSEHOLD_PERSONAL' } },
    { key: 'fixedVariable', h: 'Fixed/Variable (Deprecated)', w: 120, v: { list: 'FIXED_VARIABLE' } },
    { key: 'needWant', h: 'Need/Want', w: 85, v: { list: 'NEED_WANT' } },
    { key: 'fundId', h: 'Fund ID', w: 95, v: { idsOf: 'FUNDS' } },
    { key: 'debtId', h: 'Debt ID', w: 95, v: { idsOf: 'DEBTS' } },
    { key: 'recurring', h: 'Recurring?', w: 80, v: { checkbox: true } },
    { key: 'status', h: 'Status', w: 90, v: { list: 'TX_STATUSES' } },
    { key: 'month', h: 'Month', w: 95, fmt: C.month, f: '=IF([@date]="","",DATE(YEAR([@date]),MONTH([@date]),1))' },
    { key: 'notes', h: 'Notes', w: 220 },
    { key: 'createdAt', h: 'Created At', w: 130, fmt: C.dt },
    { key: 'updatedAt', h: 'Updated At', w: 130, fmt: C.dt },
    { key: 'spendingType', h: 'Spending Type', w: 120, v: { list: 'SPENDING_TYPES' } },
    { key: 'fundingSource', h: 'Funding Source', w: 125, v: { list: 'FUNDING_SOURCES' } },
    { key: 'sourceIncomeId', h: 'Source Income ID', w: 115, v: { idsOf: 'INCOME' } },
    { key: 'isDeleted', h: 'Is Deleted', w: 80, v: { checkbox: true } },
    { key: 'deletedAt', h: 'Deleted At', w: 130, fmt: C.dt },
    { key: 'validationFlag', h: 'Validation Flag', w: 260, f: '__TX_VALIDATION__' },
    { key: 'createdBy', h: 'Created By', w: 110 },
    { key: 'updatedBy', h: 'Updated By', w: 110 },
    { key: 'splitRole', h: 'Split Role', w: 85, v: { list: 'SPLIT_ROLES' } },
    { key: 'parentTxId', h: 'Parent Transaction ID', w: 130, v: { idsOf: 'TX' } },
    { key: 'splitDiff', h: 'Split Difference ($)', w: 115, fmt: C.cur,
      f: '=IF([@id]="","",IF([@splitRole]="Parent",N([@amount])-SUMIFS([@@amount],[@@parentTxId],[@id],[@@isDeleted],"<>TRUE"),""))' },
    { key: 'receiptRef', h: 'Receipt Reference', w: 160 },
  ],
};

/** Validation Flag formula for Transactions (kept separate for readability). */
const TX_VALIDATION_FORMULA =
  '=IF([@id]="","",REGEXREPLACE(' +
  'IF([@date]="","Missing Date; ","")' +
  '&IF([@type]="","Missing Type; ","")' +
  '&IF(NOT(ISNUMBER([@amount])),"Missing Amount; ","")' +
  '&IF(AND(OR([@type]="Expense",[@type]="Refund",[@type]="Income",[@type]="Savings",[@type]="Debt Payment"),[@category]=""),"Missing Category; ","")' +
  '&IF(AND(OR([@type]="Expense",[@type]="Refund"),[@category]<>"",[@subcategory]=""),"Missing Subcategory; ","")' +
  '&IF(AND([@category]<>"",[@subcategory]<>"",COUNTIFS([CATS.category],[@category],[CATS.subcategory],[@subcategory])=0),"Subcategory Does Not Match Category; ","")' +
  '&IF(AND(OR([@type]="Expense",[@type]="Refund"),[@spendingType]=""),"Missing Spending Type; ","")' +
  '&IF(AND([@fundId]="",OR([@type]="Savings",[@fundingSource]="Sinking Fund",[@fundingSource]="Emergency Fund")),"Missing Fund ID; ","")' +
  '&IF(AND([@type]="Debt Payment",[@debtId]=""),"Missing Debt ID; ","")' +
  '&IF(AND([@type]="Split Parent",[@splitRole]<>"Parent"),"Set Split Role to Parent; ","")' +
  '&IF(AND([@splitRole]="Parent",[@type]<>"Split Parent"),"Parent Must Be Type Split Parent; ","")' +
  '&IF(AND([@splitRole]="Child",[@parentTxId]=""),"Missing Parent Transaction ID; ","")' +
  '&IF(AND([@splitRole]="Child",[@parentTxId]<>"",COUNTIF([@@id],[@parentTxId])=0),"Parent Transaction ID Not Found; ","")' +
  '&IF(AND([@splitRole]="Parent",ISNUMBER([@splitDiff]),ABS(N([@splitDiff]))>0.01),"Split Does Not Balance; ","")' +
  '&IF(AND([@type]="Income",[@sourceIncomeId]=""),"Missing Source Income ID; ","")' +
  '&IF(AND([@sourceIncomeId]<>"",COUNTIF([INCOME.id],[@sourceIncomeId])=0),"Source Income ID Not Found; ","")' +
  '&IF(AND([@sourceIncomeId]<>"",COUNTIF([INCOME.id],[@sourceIncomeId])>0,IFERROR(ABS(N([@amount])-SUMIF([INCOME.id],[@sourceIncomeId],[INCOME.takeHome]))>0.01,FALSE)),"Deposit Does Not Match Take-Home; ","")' +
  '&IF(AND([@sourceIncomeId]<>"",COUNTIFS([@@sourceIncomeId],[@sourceIncomeId],[@@isDeleted],"<>TRUE")>1),"Income ID Linked More Than Once; ","")' +
  ',"; $",""))';

TABLES.RECUR = {
  key: 'RECUR', sheet: SHEETS.RECUR, headerRow: 40, firstRow: 41, lastRow: 240,
  title: 'Recurring Payments — Expected Obligations',
  note: 'Expected bills, subscriptions and other recurring obligations. This is NOT the ledger: actual payments are recorded in Transactions. Summary cards above are calculated from the raw table starting on row 40.',
  idPrefix: 'REC', idPattern: 'REC-001', logChanges: true, presentationRows: true,
  columns: [
    { key: 'id', h: 'Recurring ID', w: 95 },
    { key: 'name', h: 'Name', w: 200 },
    { key: 'paymentType', h: 'Payment Type', w: 120, v: { list: 'PAYMENT_TYPES' } },
    { key: 'group', h: 'Recurring Group', w: 120, v: { list: 'RECURRING_GROUPS' } },
    { key: 'category', h: 'Category', w: 130, v: { derived: 'ALL_CATEGORIES' } },
    { key: 'subcategory', h: 'Subcategory', w: 170, v: { derived: 'ALL_SUBCATEGORIES' } },
    { key: 'amount', h: 'Amount', w: 95, fmt: C.cur },
    { key: 'frequency', h: 'Frequency', w: 100, v: { list: 'FREQUENCIES' } },
    { key: 'monthlyEq', h: 'Monthly Equivalent', w: 115, fmt: C.cur,
      f: '=IF(OR([@id]="",NOT(ISNUMBER([@amount]))),"",SWITCH([@frequency],"Weekly",[@amount]*52/12,"Biweekly",[@amount]*26/12,"Monthly",[@amount],"Quarterly",[@amount]/3,"Semiannual",[@amount]/6,"Annual",[@amount]/12,[@amount]))' },
    { key: 'dueDay', h: 'Due Day', w: 75, fmt: C.int },
    { key: 'nextPayment', h: 'Next Payment Date', w: 120, fmt: C.date, v: { date: true } },
    { key: 'accountId', h: 'Account ID', w: 95, v: { idsOf: 'ACCOUNTS' } },
    { key: 'owner', h: 'Owner', w: 95, v: { list: 'OWNERS' } },
    { key: 'hhPersonal', h: 'Household/Personal', w: 110, v: { list: 'HOUSEHOLD_PERSONAL' } },
    { key: 'autoPay', h: 'Auto-Pay?', w: 80, v: { checkbox: true } },
    { key: 'active', h: 'Active?', w: 70, v: { checkbox: true } },
    { key: 'renewalDate', h: 'Renewal / Review Date', w: 125, fmt: C.date, v: { date: true } },
    { key: 'notes', h: 'Notes', w: 220 },
    { key: 'matchSource', h: 'Match / Source', w: 160 },
  ],
};

TABLES.FUNDS = {
  key: 'FUNDS', sheet: SHEETS.FUNDS, headerRow: 4, firstRow: 5, lastRow: 54,
  title: 'Savings & Reserves — Funds',
  note: 'One row per fund (emergency fund, sinking funds, goals). Contributions come from Transactions with Type = Savings; withdrawals come from Expense rows that name the Fund ID. A purchase paid from a fund is still spending in the month it happens.',
  idPrefix: 'FUND', idPattern: 'FUND-001', logChanges: true,
  columns: [
    { key: 'id', h: 'Fund ID', w: 90 },
    { key: 'name', h: 'Fund Name', w: 200 },
    { key: 'fundType', h: 'Fund Type', w: 125, v: { list: 'FUND_TYPES' } },
    { key: 'target', h: 'Target Amount', w: 110, fmt: C.cur },
    { key: 'starting', h: 'Starting Amount', w: 110, fmt: C.cur },
    { key: 'contributions', h: 'Contributions', w: 110, fmt: C.cur,
      f: '=IF([@id]="","",SUMIFS([TX.amount],[TX.fundId],[@id],[TX.type],"Savings",[TX.isDeleted],"<>TRUE"))' },
    { key: 'withdrawals', h: 'Withdrawals', w: 110, fmt: C.cur,
      f: '=IF([@id]="","",SUMIFS([TX.amount],[TX.fundId],[@id],[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.fundId],[@id],[TX.type],"Refund",[TX.isDeleted],"<>TRUE"))' },
    { key: 'current', h: 'Current Amount', w: 110, fmt: C.cur, f: '=IF([@id]="","",N([@starting])+[@contributions]-[@withdrawals])' },
    { key: 'targetDate', h: 'Target Date', w: 100, fmt: C.date, v: { date: true } },
    { key: 'plannedMonthly', h: 'Planned Monthly', w: 110, fmt: C.cur },
    { key: 'amountNeeded', h: 'Amount Needed', w: 110, fmt: C.cur, f: '=IF([@id]="","",MAX(N([@target])-[@current],0))' },
    { key: 'pctFunded', h: '% Funded', w: 85, fmt: C.pct, f: '=IF(OR([@id]="",N([@target])=0),"",MIN([@current]/[@target],1))' },
    { key: 'requiredMonthly', h: 'Required Monthly', w: 110, fmt: C.cur,
      f: '=IF(OR([@id]="",[@targetDate]=""),"",IF([@amountNeeded]<=0,0,[@amountNeeded]/MAX((YEAR([@targetDate])-YEAR(TODAY()))*12+MONTH([@targetDate])-MONTH(TODAY()),1)))' },
    { key: 'status', h: 'Status', w: 110,
      f: '=IF([@id]="","",IF(AND(N([@target])>0,[@current]>=[@target]),"Funded",IF(AND([@targetDate]<>"",[@targetDate]<TODAY()),"Past Target Date",IF(AND([@plannedMonthly]<>"",[@requiredMonthly]<>"",N([@plannedMonthly])<N([@requiredMonthly])),"Behind","On Track"))))' },
    { key: 'notes', h: 'Notes', w: 220 },
    { key: 'backingAccount', h: 'Backing Account ID', w: 120, v: { idsOf: 'ACCOUNTS' } },
  ],
};

TABLES.DEBTS = {
  key: 'DEBTS', sheet: SHEETS.DEBTS, headerRow: 7, firstRow: 8, lastRow: 57,
  title: 'Debts — Master Debt Table',
  note: 'One row per debt. Latest Balance is pulled from the newest Quarterly Debt Review for the debt (falls back to Original Balance until a review exists). Interest figures are estimates (balance × APR); statements may differ because most lenders accrue daily.',
  idPrefix: 'DEBT', idPattern: 'DEBT-001', logChanges: true, presentationRows: true,
  columns: [
    { key: 'id', h: 'Debt ID', w: 90 },
    { key: 'name', h: 'Debt Name', w: 190 },
    { key: 'debtType', h: 'Debt Type', w: 110, v: { list: 'DEBT_TYPES' } },
    { key: 'lender', h: 'Lender', w: 150 },
    { key: 'owner', h: 'Owner', w: 95, v: { list: 'OWNERS' } },
    { key: 'originalBalance', h: 'Original Balance', w: 115, fmt: C.cur },
    { key: 'apr', h: 'Interest Rate (APR)', w: 110, fmt: C.pct },
    { key: 'minPayment', h: 'Minimum Payment', w: 110, fmt: C.cur },
    { key: 'dueDay', h: 'Due Day', w: 75, fmt: C.int },
    { key: 'latestBalance', h: 'Latest Balance', w: 115, fmt: C.cur,
      f: '=IF([@id]="","",IF(MAXIFS([QDR.quarterEnd],[QDR.debtId],[@id])=0,N([@originalBalance]),SUMIFS([QDR.endingBalance],[QDR.debtId],[@id],[QDR.quarterEnd],MAXIFS([QDR.quarterEnd],[QDR.debtId],[@id]))))' },
    { key: 'balanceAsOf', h: 'Balance As Of', w: 110, fmt: C.date,
      f: '=IF([@id]="","",IF(MAXIFS([QDR.quarterEnd],[QDR.debtId],[@id])=0,"No review yet",MAXIFS([QDR.quarterEnd],[QDR.debtId],[@id])))',
      note: 'Added in the 3.0 rebuild: date of the review that supplied Latest Balance.' },
    { key: 'targetPayoff', h: 'Target Payoff Date', w: 115, fmt: C.date, v: { date: true } },
    { key: 'linkedAccount', h: 'Linked Account ID', w: 115, v: { idsOf: 'ACCOUNTS' } },
    { key: 'notes', h: 'Notes', w: 220 },
    { key: 'estMonthlyInterest', h: 'Estimated Monthly Interest', w: 130, fmt: C.cur, f: '=IF([@id]="","",N([@latestBalance])*N([@apr])/12)' },
    { key: 'estAnnualInterest', h: 'Estimated Annual Interest', w: 130, fmt: C.cur, f: '=IF([@id]="","",N([@latestBalance])*N([@apr]))' },
  ],
};

TABLES.QDR = {
  key: 'QDR', sheet: SHEETS.QDR, headerRow: 4, firstRow: 5, lastRow: 404,
  title: 'Quarterly Debt Review',
  note: 'Debt balances are reviewed in March, June, September and December instead of on the everyday Dashboard. One row per debt per quarter. Ending Balance feeds the Debts table and Monthly Summary.',
  idPrefix: 'QDR', idPattern: 'QDR-2026Q3-DEBT-001', logChanges: true,
  columns: [
    { key: 'id', h: 'Review ID', w: 170 },
    { key: 'quarterEnd', h: 'Quarter End', w: 105, fmt: C.date, v: { date: true } },
    { key: 'debtId', h: 'Debt ID', w: 95, v: { idsOf: 'DEBTS' } },
    { key: 'beginning', h: 'Beginning Balance', w: 120, fmt: C.cur },
    { key: 'payments', h: 'Payments', w: 105, fmt: C.cur },
    { key: 'interestFees', h: 'Interest & Fees', w: 105, fmt: C.cur },
    { key: 'adjustments', h: 'Adjustments', w: 105, fmt: C.cur },
    { key: 'endingBalance', h: 'Ending Balance', w: 115, fmt: C.cur,
      f: '=IF([@id]="","",MAX(N([@beginning])-N([@payments])+N([@interestFees])+N([@adjustments]),0))' },
    { key: 'notes', h: 'Notes', w: 220 },
    { key: 'trackedPayments', h: 'Tracked Payments (Transactions)', w: 150, fmt: C.cur,
      f: '=IF(OR([@id]="",[@quarterEnd]="",[@debtId]=""),"",SUMIFS([TX.amount],[TX.debtId],[@debtId],[TX.type],"Debt Payment",[TX.date],">"&EDATE([@quarterEnd],-3),[TX.date],"<="&[@quarterEnd],[TX.isDeleted],"<>TRUE"))',
      note: 'Added in the 3.0 rebuild: Debt Payment transactions in the quarter, for reconciling against statement payments.' },
  ],
};

TABLES.CREDIT = {
  key: 'CREDIT', sheet: SHEETS.CREDIT, headerRow: 4, firstRow: 5, lastRow: 304,
  title: 'Credit Scores — Monthly History',
  note: 'Manual monthly entry (Plaid does not supply consumer FICO scores). The Dashboard shows the newest row per person automatically. Score ID is generated from the date, person and row.',
  idPrefix: 'CS', idPattern: 'CS-20261107-B-001', logChanges: true,
  columns: [
    { key: 'id', h: 'Score ID', w: 160,
      f: '=IF(OR([@scoreDate]="",[@person]=""),"","CS-"&TEXT([@scoreDate],"yyyymmdd")&"-"&LEFT([@person],1)&"-"&TEXT(ROW()-4,"000"))' },
    { key: 'scoreDate', h: 'Score Date', w: 105, fmt: C.date, v: { date: true } },
    { key: 'person', h: 'Person', w: 90, v: { list: 'PERSONS' } },
    { key: 'score', h: 'Score', w: 75, fmt: C.int },
    { key: 'scoreModel', h: 'Score Model', w: 130, v: { list: 'SCORE_MODELS' } },
    { key: 'bureau', h: 'Bureau', w: 110, v: { list: 'BUREAUS' } },
    { key: 'source', h: 'Source', w: 160 },
    { key: 'notes', h: 'Notes', w: 240 },
  ],
};

TABLES.STAGING = {
  key: 'STAGING', sheet: SHEETS.STAGING, headerRow: 4, firstRow: 5, lastRow: 1004,
  title: 'Import Staging — Raw Bank Imports',
  note: 'Landing table for Plaid / CSV imports. Nothing writes directly to Transactions: rows are deduplicated, classified and reviewed here first. Fingerprint and Duplicate? are calculated.',
  idPrefix: 'IMP', idPattern: 'IMP-000001', logChanges: false,
  columns: [
    { key: 'importId', h: 'Import ID', w: 105 },
    { key: 'provider', h: 'Provider', w: 100, v: { list: 'PROVIDERS' } },
    { key: 'externalTxId', h: 'External Transaction ID', w: 180 },
    { key: 'accountId', h: 'Account ID', w: 95, v: { idsOf: 'ACCOUNTS' } },
    { key: 'date', h: 'Date', w: 95, fmt: C.date, v: { date: true } },
    { key: 'rawDescription', h: 'Raw Description', w: 240 },
    { key: 'amount', h: 'Amount', w: 95, fmt: C.cur },
    { key: 'pending', h: 'Pending?', w: 75, v: { checkbox: true } },
    { key: 'suggestedCategory', h: 'Suggested Category', w: 130, v: { derived: 'ALL_CATEGORIES' } },
    { key: 'suggestedSubcategory', h: 'Suggested Subcategory', w: 170, v: { derived: 'ALL_SUBCATEGORIES' } },
    { key: 'suggestedSpendingType', h: 'Suggested Spending Type', w: 130, v: { list: 'SPENDING_TYPES' } },
    { key: 'fingerprint', h: 'Fingerprint', w: 220,
      f: '=IF([@importId]="","",[@accountId]&"|"&TEXT([@date],"yyyy-mm-dd")&"|"&TEXT(N([@amount]),"0.00")&"|"&LOWER(LEFT(REGEXREPLACE([@rawDescription]&"","[^A-Za-z0-9]",""),24)))' },
    { key: 'reviewed', h: 'Reviewed?', w: 80, v: { checkbox: true } },
    { key: 'duplicate', h: 'Duplicate?', w: 85,
      f: '=IF([@importId]="","",IF([@importedTxId]<>"",FALSE,OR(COUNTIF([@^fingerprint],[@fingerprint])>1,COUNTIFS([TX.accountId],[@accountId],[TX.date],[@date],[TX.amount],[@amount],[TX.isDeleted],"<>TRUE")>0)))' },
    { key: 'importedTxId', h: 'Imported Transaction ID', w: 140, v: { idsOf: 'TX' } },
    { key: 'notes', h: 'Notes', w: 220 },
  ],
};

TABLES.LOG = {
  key: 'LOG', sheet: SHEETS.LOG, headerRow: 4, firstRow: 5, lastRow: 1004,
  title: 'Change Log — Append-Only Audit History',
  note: 'Material changes to raw tables are appended here (by the onEdit trigger when enabled in App Setup, and by the future app). Never edit or delete rows here.',
  idPrefix: 'CHG', idPattern: 'CHG-20261107-153000-a1b2', logChanges: false,
  columns: [
    { key: 'changeId', h: 'Change ID', w: 200 },
    { key: 'changedAt', h: 'Changed At', w: 140, fmt: C.dt },
    { key: 'user', h: 'User', w: 180 },
    { key: 'table', h: 'Table', w: 110 },
    { key: 'recordId', h: 'Record ID', w: 120 },
    { key: 'field', h: 'Field', w: 140 },
    { key: 'oldValue', h: 'Old Value', w: 160 },
    { key: 'newValue', h: 'New Value', w: 160 },
    { key: 'action', h: 'Action', w: 95, v: { list: 'LOG_ACTIONS' } },
    { key: 'notes', h: 'Notes', w: 220 },
  ],
};

TABLES.BUDGET = {
  key: 'BUDGET', sheet: SHEETS.BUDGET, headerRow: 4, firstRow: 5, lastRow: 504,
  title: 'Monthly Budget — Planned vs. Actual by Category',
  note: 'One row per month per main category. Actual = Expense − Refund from Transactions for that month and category, excluding soft-deleted rows (fixed in the 3.0 rebuild).',
  idPrefix: 'BUD', idPattern: 'BUD-202611-HOUS', logChanges: true,
  columns: [
    { key: 'id', h: 'Budget ID', w: 140,
      f: '=IF(OR([@month]="",[@category]=""),"","BUD-"&TEXT([@month],"yyyymm")&"-"&UPPER(LEFT(REGEXREPLACE([@category],"[^A-Za-z]",""),4)))' },
    { key: 'month', h: 'Month', w: 100, fmt: C.month, v: { date: true } },
    { key: 'category', h: 'Category', w: 140, v: { derived: 'EXPENSE_CATEGORIES' } },
    { key: 'planned', h: 'Planned', w: 105, fmt: C.cur },
    { key: 'actual', h: 'Actual', w: 105, fmt: C.cur,
      f: '=IF([@id]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.category],[@category],[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month],[@month],[TX.category],[@category],[TX.type],"Refund",[TX.isDeleted],"<>TRUE"))' },
    { key: 'remaining', h: 'Remaining', w: 105, fmt: C.cur, f: '=IF([@id]="","",N([@planned])-[@actual])' },
    { key: 'pctUsed', h: '% Used', w: 80, fmt: C.pct, f: '=IF(OR([@id]="",N([@planned])=0),"",[@actual]/[@planned])' },
    { key: 'notes', h: 'Notes', w: 240 },
  ],
};

TABLES.PLAN = {
  key: 'PLAN', sheet: SHEETS.PLAN, headerRow: 4, firstRow: 5, lastRow: 124,
  title: 'Monthly Plan — Flexible Spending Target',
  note: 'One flexible-spending target per month. Only Spending Type = Flexible counts here. Weekly guidance (Monday–Sunday) is calculated for the current month only and adapts to what was already spent earlier in the month.',
  idPrefix: 'PLAN', idPattern: 'PLAN-202611', logChanges: true,
  columns: [
    { key: 'id', h: 'Plan ID', w: 110, f: '=IF([@month]="","","PLAN-"&TEXT([@month],"yyyymm"))' },
    { key: 'month', h: 'Month', w: 100, fmt: C.month, v: { date: true } },
    { key: 'target', h: 'Monthly Flexible Target', w: 130, fmt: C.cur },
    { key: 'flexSpent', h: 'Flexible Spent', w: 110, fmt: C.cur,
      f: '=IF([@id]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.spendingType],"Flexible",[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month],[@month],[TX.spendingType],"Flexible",[TX.type],"Refund",[TX.isDeleted],"<>TRUE"))' },
    { key: 'available', h: 'Amount Available', w: 115, fmt: C.cur, f: '=IF([@id]="","",N([@target])-[@flexSpent])' },
    { key: 'suggestedWeek', h: 'Suggested This Week', w: 125, fmt: C.cur,
      f: '=IF(OR([@id]="",[@month]<>DATE(YEAR(TODAY()),MONTH(TODAY()),1)),"",' +
         'LET(ms,[@month],me,EOMONTH(ms,0),ws,MAX(TODAY()-WEEKDAY(TODAY(),2)+1,ms),we,MIN(ws+6,me),' +
         'before,SUMIFS([TX.amount],[TX.date],">="&ms,[TX.date],"<"&ws,[TX.spendingType],"Flexible",[TX.type],"Expense",[TX.isDeleted],"<>TRUE")' +
         '-SUMIFS([TX.amount],[TX.date],">="&ms,[TX.date],"<"&ws,[TX.spendingType],"Flexible",[TX.type],"Refund",[TX.isDeleted],"<>TRUE"),' +
         'remaining,MAX(N([@target])-before,0),remaining*(we-ws+1)/(me-ws+1)))' },
    { key: 'spentWeek', h: 'Spent This Week', w: 115, fmt: C.cur,
      f: '=IF(OR([@id]="",[@month]<>DATE(YEAR(TODAY()),MONTH(TODAY()),1)),"",' +
         'LET(ms,[@month],ws,MAX(TODAY()-WEEKDAY(TODAY(),2)+1,ms),' +
         'SUMIFS([TX.amount],[TX.date],">="&ws,[TX.date],"<="&TODAY(),[TX.spendingType],"Flexible",[TX.type],"Expense",[TX.isDeleted],"<>TRUE")' +
         '-SUMIFS([TX.amount],[TX.date],">="&ws,[TX.date],"<="&TODAY(),[TX.spendingType],"Flexible",[TX.type],"Refund",[TX.isDeleted],"<>TRUE")))' },
    { key: 'notes', h: 'Notes', w: 240 },
  ],
};

TABLES.SUMMARY = {
  key: 'SUMMARY', sheet: SHEETS.SUMMARY, headerRow: 4, firstRow: 5, lastRow: 124,
  title: 'Monthly Summary — Calculated (Read-Only)',
  note: 'Every month that appears in Income, Transactions, Monthly Plan or Monthly Budget gets a row automatically. Do not type here: all values are calculated from the raw tables.',
  idPrefix: '', idPattern: '(month date)', readOnly: true,
  columns: [
    { key: 'month', h: 'Month', w: 100, fmt: C.month, arrayFormula:
      '=IFERROR(SORT(UNIQUE(FILTER({[INCOME.month];[TX.month];[PLAN.month];[BUDGET.month]},{[INCOME.month];[TX.month];[PLAN.month];[BUDGET.month]}<>""))),"")' },
    { key: 'income', h: 'Income / Take-Home', w: 115, fmt: C.cur, f: '=IF([@month]="","",SUMIFS([INCOME.takeHome],[INCOME.month],[@month]))' },
    { key: 'spending', h: 'Spending', w: 105, fmt: C.cur,
      f: '=IF([@month]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Expense",[TX.isDeleted],"<>TRUE")-SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Refund",[TX.isDeleted],"<>TRUE"))' },
    { key: 'cashSavings', h: 'Cash Savings', w: 105, fmt: C.cur,
      f: '=IF([@month]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Savings",[TX.isDeleted],"<>TRUE"))' },
    { key: 'debtPayments', h: 'Debt Payments', w: 105, fmt: C.cur,
      f: '=IF([@month]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Debt Payment",[TX.isDeleted],"<>TRUE"))' },
    { key: 'cashRemaining', h: 'Cash Remaining', w: 110, fmt: C.cur, f: '=IF([@month]="","",[@income]-[@spending]-[@cashSavings]-[@debtPayments])' },
    { key: 'cashSavingsRate', h: 'Cash Savings Rate', w: 105, fmt: C.pct, f: '=IF(OR([@month]="",N([@income])=0),"",[@cashSavings]/[@income])' },
    { key: 'reviewedDebt', h: 'Reviewed Debt Balance', w: 120, fmt: C.cur,
      f: '=IF([@month]="","",IF(MAXIFS([QDR.quarterEnd],[QDR.quarterEnd],"<="&EOMONTH([@month],0))=0,"",SUMIFS([QDR.endingBalance],[QDR.quarterEnd],MAXIFS([QDR.quarterEnd],[QDR.quarterEnd],"<="&EOMONTH([@month],0)))))' },
    { key: 'netWorthSnapshot', h: 'Net Worth Snapshot', w: 120, fmt: C.cur,
      f: '=IF([@month]="","",IFERROR(INDEX([NW.netWorth],MATCH([@month],[NW.month],0)),""))' },
    { key: 'retirement', h: 'Retirement Savings', w: 110, fmt: C.cur, f: '=IF([@month]="","",SUMIFS([INCOME.retirement],[INCOME.month],[@month]))' },
    { key: 'totalSavings', h: 'Total Savings', w: 105, fmt: C.cur, f: '=IF([@month]="","",[@cashSavings]+[@retirement])' },
    { key: 'totalSavingsRate', h: 'Total Savings Rate of Gross', w: 125, fmt: C.pct,
      f: '=IF(OR([@month]="",SUMIFS([INCOME.gross],[INCOME.month],[@month])=0),"",[@totalSavings]/SUMIFS([INCOME.gross],[INCOME.month],[@month]))' },
    { key: 'txIncomeDeposits', h: 'Transaction Income Deposits', w: 130, fmt: C.cur,
      f: '=IF([@month]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Income",[TX.isDeleted],"<>TRUE"))' },
    { key: 'incomeReconciliation', h: 'Income Reconciliation', w: 120, fmt: C.cur, f: '=IF([@month]="","",[@txIncomeDeposits]-[@income])' },
  ],
};

TABLES.REVIEW = {
  key: 'REVIEW', sheet: SHEETS.REVIEW, headerRow: 4, firstRow: 5, lastRow: 124,
  title: 'Monthly Review',
  note: 'One row per month-end review. Financial figures are pulled from Monthly Summary (not re-typed). Use the qualitative columns to record decisions.',
  idPrefix: 'REV', idPattern: 'REV-202611', logChanges: true,
  columns: [
    { key: 'id', h: 'Review ID', w: 105, f: '=IF([@month]="","","REV-"&TEXT([@month],"yyyymm"))' },
    { key: 'month', h: 'Month', w: 100, fmt: C.month, v: { date: true } },
    { key: 'status', h: 'Status', w: 105, v: { list: 'REVIEW_STATUSES' } },
    { key: 'income', h: 'Income', w: 105, fmt: C.cur, f: '=IF([@month]="","",IFERROR(INDEX([SUMMARY.income],MATCH([@month],[SUMMARY.month],0)),""))' },
    { key: 'spending', h: 'Spending', w: 105, fmt: C.cur, f: '=IF([@month]="","",IFERROR(INDEX([SUMMARY.spending],MATCH([@month],[SUMMARY.month],0)),""))' },
    { key: 'cashSavings', h: 'Cash Savings', w: 105, fmt: C.cur, f: '=IF([@month]="","",IFERROR(INDEX([SUMMARY.cashSavings],MATCH([@month],[SUMMARY.month],0)),""))' },
    { key: 'totalSavings', h: 'Total Savings', w: 105, fmt: C.cur, f: '=IF([@month]="","",IFERROR(INDEX([SUMMARY.totalSavings],MATCH([@month],[SUMMARY.month],0)),""))' },
    { key: 'debtPayments', h: 'Debt Payments', w: 105, fmt: C.cur, f: '=IF([@month]="","",IFERROR(INDEX([SUMMARY.debtPayments],MATCH([@month],[SUMMARY.month],0)),""))' },
    { key: 'cashRemaining', h: 'Cash Remaining', w: 110, fmt: C.cur, f: '=IF([@month]="","",IFERROR(INDEX([SUMMARY.cashRemaining],MATCH([@month],[SUMMARY.month],0)),""))' },
    { key: 'savingsRate', h: 'Cash Savings Rate', w: 105, fmt: C.pct, f: '=IF([@month]="","",IFERROR(INDEX([SUMMARY.cashSavingsRate],MATCH([@month],[SUMMARY.month],0)),""))' },
    { key: 'totalDebt', h: 'Total Debt Balance', w: 115, fmt: C.cur, f: '=IF([@month]="","",IFERROR(INDEX([SUMMARY.reviewedDebt],MATCH([@month],[SUMMARY.month],0)),""))' },
    { key: 'wentWell', h: 'What Went Well', w: 240 },
    { key: 'adjust', h: 'What to Adjust', w: 240 },
    { key: 'focus', h: 'Next Month Focus', w: 240 },
    { key: 'reviewedBy', h: 'Reviewed By', w: 100, v: { list: 'OWNERS' } },
    { key: 'reviewedOn', h: 'Reviewed On', w: 105, fmt: C.date, v: { date: true } },
    { key: 'notes', h: 'Notes', w: 200 },
  ],
};

TABLES.NW = {
  key: 'NW', sheet: SHEETS.NW, headerRow: 4, firstRow: 5, lastRow: 124,
  title: 'Net Worth Snapshots',
  note: 'Historical snapshots (one row per month recorded). The live helper to the right calculates current tracked net worth from Accounts and Debts without double-counting credit cards. Use Finance Tracker → Record net worth snapshot to append a row.',
  idPrefix: 'NW', idPattern: 'NW-202611', logChanges: true, extraCols: 4,
  columns: [
    { key: 'id', h: 'Snapshot ID', w: 105, f: '=IF([@month]="","","NW-"&TEXT([@month],"yyyymm"))' },
    { key: 'month', h: 'Month', w: 100, fmt: C.month, v: { date: true } },
    { key: 'cash', h: 'Cash & Checking', w: 110, fmt: C.cur },
    { key: 'savings', h: 'Savings', w: 105, fmt: C.cur },
    { key: 'retirement', h: 'Retirement', w: 105, fmt: C.cur },
    { key: 'investments', h: 'Investments', w: 105, fmt: C.cur },
    { key: 'property', h: 'Property & Other Assets', w: 130, fmt: C.cur },
    { key: 'otherDeprecated', h: 'Other Assets (Deprecated)', w: 130, fmt: C.cur },
    { key: 'totalDebt', h: 'Total Debt', w: 105, fmt: C.cur },
    { key: 'netWorth', h: 'Net Worth', w: 110, fmt: C.cur, f: '=IF([@id]="","",SUM([@cash]:[@otherDeprecated])-N([@totalDebt]))' },
    { key: 'notes', h: 'Notes', w: 200 },
  ],
};

/** Order in which tables are built (reference tables first). */
const BUILD_ORDER = ['CATS', 'ACCOUNTS', 'INCOME', 'TX', 'RECUR', 'FUNDS', 'DEBTS', 'QDR', 'CREDIT', 'STAGING', 'LOG', 'BUDGET', 'PLAN', 'SUMMARY', 'REVIEW', 'NW'];

/** Formats */
const FORMATS = {
  currency: '$#,##0.00;[Color 10]-$#,##0.00',
  date: 'yyyy-mm-dd',
  datetime: 'yyyy-mm-dd hh:mm',
  month: 'mmm yyyy',
  percent: '0.0%',
  int: '0',
  text: '@',
};

/** App data rules shown on App Setup / Start Here. */
const APP_RULES = [
  'Income is authoritative for paycheck gross, deductions and take-home.',
  'Imported bank data enters Import Staging before Transactions.',
  'Every Expense/Refund requires a Spending Type.',
  'Funding Source = Sinking Fund or Emergency Fund requires a Fund ID.',
  'Savings transactions require a Fund ID.',
  'Debt Payment transactions require a Debt ID.',
  'A credit-card payoff is not new spending when the purchases were already recorded as expenses.',
  'Never hard-delete a financial record: tick Is Deleted and set Deleted At.',
  'Store month values as first-of-month dates, never as text.',
  'Payroll retirement contributions belong in Income, not Transactions.',
  'Dashboard monthly cards follow the Selected Month (Dashboard!B3).',
  'Current Flexible Spending always follows today\'s calendar month and Monday–Sunday week.',
  'Derived sheets (Monthly Summary, Dashboard) are read-only; the app never writes to them.',
];

/* ===================================================================== */
/* 10_Helpers.gs
/* ===================================================================== */
/**
 * Household Finance Tracker — 10_Helpers.gs
 * Shared utilities: formula token resolution, table builder, validations,
 * formats, named ranges, row lookup/append, change-log writer.
 */

/* ---------- basic utilities ---------- */

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function ui_() {
  try { return SpreadsheetApp.getUi(); } catch (e) { return null; }
}

function alert_(title, msg) {
  const ui = ui_();
  if (ui) ui.alert(title, msg, ui.ButtonSet.OK);
  else Logger.log(title + '\n' + msg);
}

function toast_(msg, title) {
  try { ss_().toast(msg, title || HFT.TITLE, 5); } catch (e) { Logger.log(msg); }
}

function colLetter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function q_(sheetName) { return "'" + String(sheetName).replace(/'/g, "''") + "'"; }

function tdef_(key) {
  const d = TABLES[key];
  if (!d) throw new Error('Unknown table key: ' + key);
  return d;
}

function colIndex_(def, key) {
  for (let i = 0; i < def.columns.length; i++) if (def.columns[i].key === key) return i + 1;
  throw new Error('Unknown column "' + key + '" in table ' + def.key);
}

function colLetterOf_(def, key) { return colLetter_(colIndex_(def, key)); }

/** Full open range reference to a table column, e.g. 'Transactions'!$D$5:$D */
function colRef_(tableKey, colKey) {
  const d = tdef_(tableKey);
  const L = colLetterOf_(d, colKey);
  return q_(d.sheet) + '!$' + L + '$' + d.firstRow + ':$' + L;
}

/** Resolve formula tokens (see 00_Config.gs header). def/row may be null for off-table formulas. */
function resolveFormula_(tpl, def, row) {
  if (!tpl) return tpl;
  let f = tpl;
  if (f === '__TX_VALIDATION__') f = TX_VALIDATION_FORMULA;
  if (def) {
    f = f.replace(/\{r\}/g, String(row));
    f = f.replace(/\[@\^(\w+)\]/g, (m, k) => { const L = colLetterOf_(def, k); return '$' + L + '$' + def.firstRow + ':$' + L + row; });
    f = f.replace(/\[@@(\w+)\]/g, (m, k) => { const L = colLetterOf_(def, k); return '$' + L + '$' + def.firstRow + ':$' + L; });
    f = f.replace(/\[@(\w+)\]/g, (m, k) => '$' + colLetterOf_(def, k) + row);
  }
  f = f.replace(/\[([A-Z]+)\.(\w+)\]/g, (m, t, k) => colRef_(t, k));
  if (/\[@/.test(f)) throw new Error('Unresolved same-table token in formula: ' + f);
  return f;
}

function fmtString_(fmt) { return FORMATS[fmt] || null; }

function nowStamp_() { return new Date(); }

function monthStart_(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

function addMonths_(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }

function userEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

/* ---------- sheet plumbing ---------- */

function getOrCreateSheet_(name) {
  const ss = ss_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureSheetSize_(sh, rows, cols) {
  const maxR = sh.getMaxRows(), maxC = sh.getMaxColumns();
  if (maxR < rows) sh.insertRowsAfter(maxR, rows - maxR);
  else if (maxR > rows) sh.deleteRows(rows + 1, maxR - rows);
  if (maxC < cols) sh.insertColumnsAfter(maxC, cols - maxC);
  else if (maxC > cols) sh.deleteColumns(cols + 1, maxC - cols);
}

function setNamedRange_(name, range) {
  const ss = ss_();
  const existing = ss.getNamedRanges().filter(nr => nr.getName() === name);
  existing.forEach(nr => nr.remove());
  ss.setNamedRange(name, range);
}

/* ---------- styling ---------- */

function styleTitleRow_(sh, row, text, numCols) {
  const r = sh.getRange(row, 1, 1, numCols);
  r.setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE);
  sh.getRange(row, 1).setValue(text).setFontSize(14).setFontWeight('bold');
  sh.setRowHeight(row, 32);
}

function styleNoteRow_(sh, row, text, numCols) {
  sh.getRange(row, 1).setValue(text).setFontColor(COLORS.MUTED_TEXT).setFontSize(9).setFontStyle('italic').setWrap(false);
  sh.getRange(row, 1, 1, numCols).setBackground(COLORS.WHITE);
}

function styleHeader_(range) {
  range.setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontWeight('bold')
    .setWrap(true).setVerticalAlignment('middle').setFontSize(10);
}

function styleSectionBar_(range, text, color) {
  range.merge().setValue(text).setBackground(color || COLORS.TEAL).setFontColor(COLORS.WHITE)
    .setFontWeight('bold').setFontSize(11).setVerticalAlignment('middle');
}

function setFormat_(range, fmt) {
  const s = fmtString_(fmt);
  if (s) range.setNumberFormat(s);
}

/* ---------- validations ---------- */

function listRange_(key) {
  const ss = ss_();
  const nr = ss.getRangeByName('LIST_' + key);
  if (!nr) throw new Error('List not built yet: LIST_' + key);
  return nr;
}

function idsRange_(tableKey) {
  const d = tdef_(tableKey);
  const sh = getOrCreateSheet_(d.sheet);
  const idCol = colIndex_(d, d.columns[0].key);
  return sh.getRange(d.firstRow, idCol, d.lastRow - d.firstRow + 1, 1);
}

function buildValidation_(spec) {
  const b = SpreadsheetApp.newDataValidation();
  if (spec.checkbox) return b.requireCheckbox().setAllowInvalid(false).build();
  if (spec.date) return b.requireDate().setAllowInvalid(true).setHelpText('Enter a date (yyyy-mm-dd). Months are stored as the first of the month.').build();
  if (spec.list) return b.requireValueInRange(listRange_(spec.list), true).setAllowInvalid(true).setHelpText('Pick a value from the list on the Categories tab.').build();
  if (spec.derived) return b.requireValueInRange(listRange_(spec.derived), true).setAllowInvalid(true).setHelpText('Pick a value from the Categories taxonomy.').build();
  if (spec.idsOf) return b.requireValueInRange(idsRange_(spec.idsOf), true).setAllowInvalid(true).setHelpText('Must match an ID on the ' + tdef_(spec.idsOf).sheet + ' tab.').build();
  if (spec.values) return b.requireValueInList(spec.values, true).setAllowInvalid(true).build();
  return null;
}

/* ---------- table builder ---------- */

/** Apply number formats, validations and formulas to rows fromRow..toRow of a table. */
function applyColumnRules_(def, fromRow, toRow) {
  const sh = getOrCreateSheet_(def.sheet);
  const n = toRow - fromRow + 1;
  if (n <= 0) return;
  def.columns.forEach((c, i) => {
    const col = i + 1;
    const rng = sh.getRange(fromRow, col, n, 1);
    if (c.fmt) setFormat_(rng, c.fmt);
    if (c.v) { const dv = buildValidation_(c.v); if (dv) rng.setDataValidation(dv); }
    if (c.f) {
      const formulas = [];
      for (let r = fromRow; r <= toRow; r++) formulas.push([resolveFormula_(c.f, def, r)]);
      rng.setFormulas(formulas);
      rng.setBackground('#FAFBFC'); // subtle hint: calculated column
    }
    if (c.arrayFormula && fromRow === def.firstRow) {
      sh.getRange(def.firstRow, col).setFormula(resolveFormula_(c.arrayFormula, def, def.firstRow));
      sh.getRange(fromRow, col, n, 1).setBackground('#FAFBFC');
    }
  });
  sh.getRange(fromRow, 1, n, def.columns.length).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');
}

/** Build (or rebuild) a raw-table sheet from its definition. */
function buildTableSheet_(def) {
  const sh = getOrCreateSheet_(def.sheet);
  const n = def.columns.length;
  const totalCols = Math.max(n + 1, n + (def.extraCols || 0));
  ensureSheetSize_(sh, def.lastRow + 5, totalCols);
  sh.clearConditionalFormatRules();
  if (def.keepExtras) {
    // Only the table columns are reset; helper areas to the right (e.g. reference lists) survive.
    const tableArea = sh.getRange(1, 1, sh.getMaxRows(), n);
    tableArea.clear();
    tableArea.clearDataValidations();
  } else {
    sh.clear();
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  }

  if (!def.presentationRows) {
    styleTitleRow_(sh, 1, def.title, n);
    styleNoteRow_(sh, 2, def.note, n);
  }
  const header = sh.getRange(def.headerRow, 1, 1, n);
  header.setValues([def.columns.map(c => c.h)]);
  styleHeader_(header);
  sh.setRowHeight(def.headerRow, 42);
  def.columns.forEach((c, i) => { if (c.w) sh.setColumnWidth(i + 1, c.w); });
  applyColumnRules_(def, def.firstRow, def.lastRow);
  sh.setFrozenRows(def.headerRow);
  if (def.freezeCols) sh.setFrozenColumns(def.freezeCols);
  setNamedRange_('TBL_' + def.key, sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, n));
  if (def.readOnly) {
    const p = sh.protect().setDescription(def.sheet + ' is calculated — edit the raw tables instead.');
    p.setWarningOnly(true);
  }
  return sh;
}

/* ---------- conditional formatting helpers ---------- */

function cfRule_(range, formula, bg, fg, opts) {
  const b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula).setRanges([range]);
  if (bg) b.setBackground(bg);
  if (fg) b.setFontColor(fg);
  if (opts && opts.bold) b.setBold(true);
  if (opts && opts.strike) b.setStrikethrough(true);
  if (opts && opts.italic) b.setItalic(true);
  return b.build();
}

/* ---------- data access ---------- */

/** First column that is typed by hand (used to detect empty rows). */
function anchorCol_(def) {
  for (let i = 0; i < def.columns.length; i++) if (!def.columns[i].f && !def.columns[i].arrayFormula) return i + 1;
  return 1;
}

/** Read a table as an array of objects keyed by column key, with __row. Skips empty rows. */
function readTable_(def) {
  const sh = getOrCreateSheet_(def.sheet);
  const last = Math.max(sh.getLastRow(), def.firstRow);
  const n = def.columns.length;
  if (last < def.firstRow) return [];
  const values = sh.getRange(def.firstRow, 1, last - def.firstRow + 1, n).getValues();
  const anchor = anchorCol_(def) - 1;
  const out = [];
  values.forEach((row, i) => {
    if (row[anchor] === '' || row[anchor] === null) return;
    const o = { __row: def.firstRow + i };
    def.columns.forEach((c, j) => { o[c.key] = row[j]; });
    out.push(o);
  });
  return out;
}

function findRowById_(def, id) {
  const sh = getOrCreateSheet_(def.sheet);
  const last = sh.getLastRow();
  if (last < def.firstRow) return -1;
  const ids = sh.getRange(def.firstRow, 1, last - def.firstRow + 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return def.firstRow + i;
  return -1;
}

/** Next empty data row (first blank anchor cell at/after firstRow). */
function nextEmptyRow_(def) {
  const sh = getOrCreateSheet_(def.sheet);
  const anchor = anchorCol_(def);
  const last = sh.getLastRow();
  if (last < def.firstRow) return def.firstRow;
  const vals = sh.getRange(def.firstRow, anchor, last - def.firstRow + 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (vals[i][0] === '' || vals[i][0] === null) return def.firstRow + i;
  return last + 1;
}

/** Generate the next sequential ID for a table with a numeric suffix (e.g. TX-000123). */
function nextId_(def, width) {
  const w = width || 3;
  const rows = readTable_(def);
  const prefix = def.idPrefix + '-';
  let max = 0;
  rows.forEach(r => {
    const id = String(r[def.columns[0].key] || '');
    if (id.indexOf(prefix) === 0) { const num = parseInt(id.slice(prefix.length), 10); if (!isNaN(num) && num > max) max = num; }
  });
  let s = String(max + 1);
  while (s.length < w) s = '0' + s;
  return prefix + s;
}

/**
 * Write row objects into a table starting at startRow (default: next empty row).
 * Formula columns are re-filled afterwards so the whole block stays consistent.
 */
function writeRows_(def, rows, startRow) {
  if (!rows || !rows.length) return startRow || nextEmptyRow_(def);
  const sh = getOrCreateSheet_(def.sheet);
  const start = startRow || nextEmptyRow_(def);
  const endRow = start + rows.length - 1;
  if (endRow > def.lastRow) extendTable_(def, endRow + 50);
  const values = rows.map(r => def.columns.map(c => (c.f || c.arrayFormula) ? '' : (r[c.key] === undefined || r[c.key] === null ? '' : r[c.key])));
  sh.getRange(start, 1, rows.length, def.columns.length).setValues(values);
  // restore formulas in formula columns for the written block
  def.columns.forEach((c, i) => {
    if (c.f) {
      const formulas = [];
      for (let r = start; r <= endRow; r++) formulas.push([resolveFormula_(c.f, def, r)]);
      sh.getRange(start, i + 1, rows.length, 1).setFormulas(formulas);
    }
    if (c.arrayFormula && start === def.firstRow) {
      sh.getRange(def.firstRow, i + 1).setFormula(resolveFormula_(c.arrayFormula, def, def.firstRow));
    }
  });
  return endRow + 1;
}

/** Extend a table's formula/format/validation rows up to newLastRow. */
function extendTable_(def, newLastRow) {
  if (newLastRow <= def.lastRow) return;
  const sh = getOrCreateSheet_(def.sheet);
  if (sh.getMaxRows() < newLastRow + 5) sh.insertRowsAfter(sh.getMaxRows(), newLastRow + 5 - sh.getMaxRows());
  applyColumnRules_(def, def.lastRow + 1, newLastRow);
  def.lastRow = newLastRow;
  setNamedRange_('TBL_' + def.key, sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, def.columns.length));
  if (typeof CF_BUILDERS !== 'undefined' && CF_BUILDERS[def.key]) CF_BUILDERS[def.key](sh, def);
}

/* ---------- change log ---------- */

function changeLogEnabled_() {
  try {
    const r = ss_().getRangeByName('SETTING_CHANGE_LOG');
    return r ? r.getValue() === true : false;
  } catch (e) { return false; }
}

function appendChangeLog_(entry) {
  const def = tdef_('LOG');
  const sh = getOrCreateSheet_(def.sheet);
  const now = nowStamp_();
  const id = 'CHG-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 4);
  const row = [id, now, entry.user || userEmail_(), entry.table || '', entry.recordId || '', entry.field || '',
    entry.oldValue === undefined ? '' : entry.oldValue, entry.newValue === undefined ? '' : entry.newValue,
    entry.action || 'Update', entry.notes || ''];
  const r = nextEmptyRow_(def);
  sh.getRange(r, 1, 1, row.length).setValues([row]);
  sh.getRange(r, 2).setNumberFormat(FORMATS.datetime);
  return id;
}

/* ===================================================================== */
/* 20_Reference.gs
/* ===================================================================== */
/**
 * Household Finance Tracker — 20_Reference.gs
 * Phase 1: reference tables and documentation tabs.
 *   Categories (taxonomy + dropdown lists), Accounts, App Setup, Sources, Start Here
 */

/* ---------- Categories ---------- */

function buildCategories_() {
  const def = tdef_('CATS');
  const sh = getOrCreateSheet_(def.sheet);
  ensureSheetSize_(sh, def.lastRow + 5, def.columns.length + def.extraCols);

  // 1) Reference lists first (dropdown sources for every other sheet).
  sh.getRange(1, LIST_FIRST_COL, 2, 1).setValues([['Reference lists — dropdown sources'], ['Add new values below a list; keep lists in these columns so dropdowns keep working.']]);
  sh.getRange(1, LIST_FIRST_COL).setFontWeight('bold').setFontSize(12).setFontColor(COLORS.NAVY);
  sh.getRange(2, LIST_FIRST_COL).setFontSize(9).setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT);
  const listSpan = LIST_LAST_ROW - LIST_FIRST_ROW + 1;
  let col = LIST_FIRST_COL;
  LISTS.forEach(list => {
    sh.getRange(4, col).setValue(list.header);
    sh.getRange(4, col).setBackground(COLORS.TEAL).setFontColor(COLORS.WHITE).setFontWeight('bold').setWrap(true);
    sh.getRange(LIST_FIRST_ROW, col, listSpan, 1).clearContent();
    sh.getRange(LIST_FIRST_ROW, col, list.values.length, 1).setValues(list.values.map(v => [v]));
    sh.setColumnWidth(col, 150);
    setNamedRange_('LIST_' + list.key, sh.getRange(LIST_FIRST_ROW, col, listSpan, 1));
    col++;
  });
  DERIVED_LISTS.forEach(list => {
    sh.getRange(4, col).setValue(list.header);
    sh.getRange(4, col).setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontWeight('bold').setWrap(true);
    sh.getRange(LIST_FIRST_ROW, col, listSpan, 1).clearContent();
    sh.getRange(LIST_FIRST_ROW, col).setFormula(list.formula);
    sh.setColumnWidth(col, 170);
    setNamedRange_('LIST_' + list.key, sh.getRange(LIST_FIRST_ROW, col, listSpan, 1));
    col++;
  });
  sh.setRowHeight(4, 42);

  // 2) Taxonomy table (columns A:H).
  buildTableSheet_(def);
  const rows = [];
  const catIndex = {};
  const subCount = {};
  TAXONOMY.forEach(t => {
    const [category, subcategory, needWant, fixedVariable, spendingType] = t;
    if (!(category in catIndex)) { catIndex[category] = Object.keys(catIndex).length + 1; subCount[category] = 0; }
    subCount[category]++;
    const ci = String(catIndex[category]).padStart(2, '0');
    const si = String(subCount[category]).padStart(2, '0');
    rows.push({ categoryId: 'CAT-' + ci, category, subcategoryId: 'SUB-' + ci + si, subcategory, needWant, fixedVariable, active: true, spendingType });
  });
  writeRows_(def, rows, def.firstRow);
  CF_BUILDERS.CATS(sh, def);
}

/** Conditional-format rules that color a category cell by category (shared by several sheets). */
function categoryCellRules_(sh, def, colKey) {
  const L = colLetterOf_(def, colKey);
  const rng = sh.getRange(def.firstRow, colIndex_(def, colKey), def.lastRow - def.firstRow + 1, 1);
  const rules = [];
  Object.keys(CATEGORY_COLORS).forEach(cat => {
    rules.push(cfRule_(rng, '=$' + L + def.firstRow + '="' + cat + '"', CATEGORY_COLORS[cat], COLORS.TEXT));
  });
  return rules;
}

/* ---------- Accounts ---------- */

function buildAccounts_(withSample) {
  const def = tdef_('ACCOUNTS');
  const sh = buildTableSheet_(def);
  const rows = [];
  if (withSample) {
    const s = HFT.SAMPLE_TAG + ' — remove when real data is ready';
    rows.push({ id: 'ACC-001', name: 'Sample Checking', institution: 'Sample Bank', accountType: 'Checking', owner: 'Household', includeNW: 'Yes', startingBalance: 3800, currentBalance: 4250, lastUpdated: monthStart_(new Date()), notes: s });
    rows.push({ id: 'ACC-002', name: 'Sample Savings', institution: 'Sample Bank', accountType: 'Savings', owner: 'Household', includeNW: 'Yes', startingBalance: 9000, currentBalance: 9800, lastUpdated: monthStart_(new Date()), notes: s });
    rows.push({ id: 'ACC-003', name: 'Sample Credit Card', institution: 'Sample Card Co.', accountType: 'Credit Card', owner: 'Household', includeNW: 'Yes', startingBalance: 2100, currentBalance: 1850, lastUpdated: monthStart_(new Date()), notes: s + ' (linked to DEBT-003)' });
    rows.push({ id: 'ACC-004', name: 'Sample 401(k)', institution: 'Sample Retirement Co.', accountType: 'Retirement', owner: 'Ben', includeNW: 'Yes', startingBalance: 40000, currentBalance: 42000, lastUpdated: monthStart_(new Date()), notes: s });
    rows.push({ id: 'ACC-005', name: 'Sample Brokerage', institution: 'Sample Brokerage', accountType: 'Investment', owner: 'Valerie', includeNW: 'Yes', startingBalance: 6000, currentBalance: 6300, lastUpdated: monthStart_(new Date()), notes: s });
  }
  const real = 'Real account — enter owner, balances and Last Updated.';
  rows.push({ id: 'ACC-006', name: 'PayPal', institution: 'PayPal', accountType: 'Cash', includeNW: 'Yes', notes: real });
  rows.push({ id: 'ACC-007', name: 'Independent Bank Checking', institution: 'Independent Bank', accountType: 'Checking', includeNW: 'Yes', notes: real });
  rows.push({ id: 'ACC-008', name: 'Independent Bank Savings', institution: 'Independent Bank', accountType: 'Savings', includeNW: 'Yes', notes: real });
  rows.push({ id: 'ACC-009', name: 'Independent Bank Credit Card', institution: 'Independent Bank', accountType: 'Credit Card', includeNW: 'Yes', notes: real + ' Link to a Debts row if you track its balance there.' });
  rows.push({ id: 'ACC-010', name: 'Capital One Credit Card', institution: 'Capital One', accountType: 'Credit Card', includeNW: 'Yes', notes: real + ' Link to a Debts row if you track its balance there.' });
  rows.push({ id: 'ACC-011', name: 'Acorns Account', institution: 'Acorns', accountType: 'Investment', includeNW: 'Yes', notes: real });
  rows.push({ id: 'ACC-012', name: 'Fidelity Roth IRA', institution: 'Fidelity', accountType: 'Retirement', includeNW: 'Yes', notes: real });
  rows.push({ id: 'ACC-013', name: 'HealthEquity HSA', institution: 'HealthEquity', accountType: 'HSA', includeNW: 'Yes', notes: real });
  writeRows_(def, rows, def.firstRow);
  CF_BUILDERS.ACCOUNTS(sh, def);
}

/* ---------- App Setup ---------- */

function buildAppSetup_(withSample) {
  const ss = ss_();
  const sh = getOrCreateSheet_(SHEETS.SETUP);
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  ensureSheetSize_(sh, 160, 8);
  const W = 8;
  sh.setColumnWidths(1, 1, 230);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 90);
  sh.setColumnWidth(4, 100);
  sh.setColumnWidth(5, 110);
  sh.setColumnWidth(6, 170);
  sh.setColumnWidth(7, 110);
  sh.setColumnWidth(8, 620);
  styleTitleRow_(sh, 1, 'App Setup — Architecture & Data Dictionary', W);
  styleNoteRow_(sh, 2, 'Read this tab before connecting an app. It documents where every table lives, which columns are calculated, and the rules the app must respect.', W);

  let r = 4;
  const section = (text) => { styleSectionBar_(sh.getRange(r, 1, 1, W), text); r++; };
  const kv = (k, v, opts) => {
    sh.getRange(r, 1).setValue(k).setFontWeight('bold');
    const cell = sh.getRange(r, 2);
    cell.setValue(v);
    if (opts && opts.name) setNamedRange_(opts.name, cell);
    if (opts && opts.checkbox) cell.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
    if (opts && opts.fmt) cell.setNumberFormat(opts.fmt);
    sh.getRange(r, 2, 1, W - 1).mergeAcross();
    r++;
  };
  const line = (text) => { sh.getRange(r, 1).setValue(text).setWrap(true); sh.getRange(r, 1, 1, W).mergeAcross(); r++; };

  section('Workbook');
  kv('Schema Version', HFT.SCHEMA_VERSION, { name: 'INFO_SCHEMA_VERSION' });
  kv('Build Script Version', HFT.BUILD_VERSION);
  kv('Built On', nowStamp_(), { fmt: FORMATS.datetime, name: 'INFO_BUILT_ON' });
  kv('Spreadsheet ID', ss.getId(), { name: 'INFO_SPREADSHEET_ID' });
  kv('Source Repository', HFT.REPO_URL);
  kv('Time Zone', ss.getSpreadsheetTimeZone());
  r++;

  section('Settings');
  kv('Change Log auto-capture (onEdit trigger)', true, { name: 'SETTING_CHANGE_LOG', checkbox: true });
  kv('Sample data present', !!withSample, { name: 'SETTING_SAMPLE_PRESENT', checkbox: true });
  kv('Week starts on (flexible-spending guidance)', 'Monday');
  kv('Last QA run', '', { name: 'QA_LAST_RUN', fmt: FORMATS.datetime });
  kv('Last QA result', '', { name: 'QA_LAST_RESULT' });
  r++;

  section('Architecture');
  [
    'Browser / web UI  →  validated JSON  →  Google Apps Script web app (doPost in 95_Api.gs)  →  these Sheet tables.',
    'Never expose spreadsheet credentials to the browser. The Apps Script layer owns writes and validation; this Sheet stays the durable store and backup.',
    'The app reads and writes the RAW tables only (Income, Transactions, Recurring Payments, Savings & Reserves, Debts, Quarterly Debt Review, Accounts, Credit Scores, Monthly Budget, Monthly Plan, Monthly Review, Net Worth Snapshots, Import Staging, Change Log).',
    'Calculated sheets (Monthly Summary, Dashboard) and calculated columns (listed below) are read-only for the app.',
    'Intended import path: Plaid → Import Staging → dedupe / classify / review → Transactions. Receipt AI then creates balanced split children under the imported parent.',
    'Rows are located by their ID column; new rows go in the first empty row after the header (Apps Script helpers nextEmptyRow_/writeRows_ do this).',
    'Formulas in calculated columns are pre-filled to the "Last Formula Row" below. Use Finance Tracker → Extend formula rows when a table approaches that row.',
  ].forEach(line);
  r++;

  section('App Data Rules');
  APP_RULES.forEach((rule, i) => line((i + 1) + '. ' + rule));
  r++;

  section('Data Dictionary');
  const dh = ['Table Key', 'Sheet', 'Header Row', 'First Data Row', 'Last Formula Row', 'ID Pattern', 'Named Range', 'Columns (letter · header · calculated?)'];
  sh.getRange(r, 1, 1, W).setValues([dh]);
  styleHeader_(sh.getRange(r, 1, 1, W));
  r++;
  BUILD_ORDER.forEach(key => {
    const d = tdef_(key);
    const cols = d.columns.map((c, i) => colLetter_(i + 1) + ' ' + c.h + ((c.f || c.arrayFormula) ? ' (calc)' : '')).join(' · ');
    sh.getRange(r, 1, 1, W).setValues([[d.key, d.sheet, d.headerRow, d.firstRow, d.lastRow, d.idPattern, 'TBL_' + d.key, cols]]);
    sh.getRange(r, 8).setWrap(true);
    sh.getRange(r, 1, 1, W).setVerticalAlignment('top');
    r++;
  });
  r++;

  section('Column notes (added or changed in the 3.0 rebuild)');
  BUILD_ORDER.forEach(key => {
    const d = tdef_(key);
    d.columns.forEach(c => { if (c.note) line(d.sheet + ' · ' + c.h + ': ' + c.note); });
  });
  line('Monthly Budget · Actual: now excludes soft-deleted transactions (bug fix).');
  line('Dashboard · Payroll Deductions: Federal Tax amount and % formulas restored for Ben, Valerie and Household.');
  line('Categories · Child Expenses: normalized to Child Care, Clothing, Medical, Activities, Education, Supplies, Toys, Other.');
  r++;

  section('Validation Flag messages (Transactions column Z)');
  ['Missing Date', 'Missing Type', 'Missing Amount', 'Missing Category', 'Missing Subcategory', 'Subcategory Does Not Match Category',
    'Missing Spending Type', 'Missing Fund ID', 'Missing Debt ID', 'Set Split Role to Parent', 'Parent Must Be Type Split Parent',
    'Missing Parent Transaction ID', 'Parent Transaction ID Not Found', 'Split Does Not Balance', 'Missing Source Income ID',
    'Source Income ID Not Found', 'Deposit Does Not Match Take-Home', 'Income ID Linked More Than Once'].forEach(m => line('• ' + m));
  r++;

  section('Menu: Finance Tracker');
  ['Run QA checks — scans every tab for formula errors and re-computes key totals independently.',
    'Link income deposits — fills Source Income ID on Income-type transactions that match a paycheck by amount and date.',
    'Split a transaction… — turns a bank transaction into a Split Parent with balanced child rows.',
    'Record net worth snapshot — appends this month\'s row from the live helper on Net Worth Snapshots.',
    'Extend formula rows — adds 500 more calculated rows to every table.',
    'Clear sample data… — removes every row tagged SAMPLE once real data is ready.',
    'Rebuild workbook (destructive)… — wipes and rebuilds all tabs from the script.'].forEach(line);

  sh.getRange(1, 1, r, W).setFontColor(COLORS.TEXT);
  sh.getRange(1, 1).setFontColor(COLORS.WHITE);
  sh.setFrozenRows(2);
}

/* ---------- Sources ---------- */

function buildSources_() {
  const sh = getOrCreateSheet_(SHEETS.SOURCES);
  sh.clear();
  ensureSheetSize_(sh, 40, 3);
  sh.setColumnWidth(1, 240); sh.setColumnWidth(2, 360); sh.setColumnWidth(3, 520);
  styleTitleRow_(sh, 1, 'Sources — Financial Guidance Used in the Design', 3);
  styleNoteRow_(sh, 2, 'Conventional references behind the tracker\'s rules. Replace or extend this list with the sources you actually consulted.', 3);
  const header = ['Topic', 'Source', 'How it shaped the tracker'];
  sh.getRange(4, 1, 1, 3).setValues([header]);
  styleHeader_(sh.getRange(4, 1, 1, 3));
  const rows = [
    ['Budgeting basics & review cadence', 'Consumer Financial Protection Bureau (consumerfinance.gov) — budgeting guides', 'Light weekly/monthly/quarterly cadence; planned vs. actual by category.'],
    ['Needs / wants framing', 'Warren & Tyagi, All Your Worth (2005) — 50/30/20 framework', 'Need/Want defaults and the Fixed vs. Flexible spending split.'],
    ['Emergency fund sizing', 'CFPB — guides to building an emergency fund', 'Emergency Fund as a tracked fund with target, % funded and required monthly.'],
    ['Sinking funds', 'General personal-finance practice', 'Planned Irregular spending type; purchases funded from a fund still count as spending in the month they occur.'],
    ['Credit score ranges', 'myFICO.com / Experian — FICO score ranges', 'Dashboard rating scale: 300–579 Poor, 580–669 Fair, 670–739 Good, 740–799 Very Good, 800–850 Exceptional.'],
    ['Interest cost estimates', 'Lender statements accrue daily; estimate = balance × APR', 'Debts tab shows estimated monthly/annual interest, clearly labelled as estimates.'],
    ['Bank data import', 'Plaid Transactions API documentation (plaid.com/docs)', 'Import Staging schema: external IDs, pending flag, fingerprint-based deduplication.'],
    ['Web app layer', 'Google Apps Script — web apps & Sheets service (developers.google.com/apps-script)', 'Browser → JSON → Apps Script → Sheet tables; credentials never reach the browser.'],
  ];
  sh.getRange(5, 1, rows.length, 3).setValues(rows).setWrap(true).setVerticalAlignment('top');
  sh.setFrozenRows(4);
}

/* ---------- Start Here ---------- */

function buildStartHere_(withSample) {
  const sh = getOrCreateSheet_(SHEETS.START);
  sh.clear();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  ensureSheetSize_(sh, 120, 3);
  sh.setColumnWidth(1, 36); sh.setColumnWidth(2, 720); sh.setColumnWidth(3, 320);
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, 1, 3).setBackground(COLORS.NAVY);
  sh.getRange(1, 2).setValue(HFT.TITLE).setFontColor(COLORS.WHITE).setFontSize(18).setFontWeight('bold');
  sh.setRowHeight(1, 44);
  sh.getRange(2, 2).setValue('A database-first household finance workbook: raw records live in normalized tables, summaries are calculated from them, and the same tables can later back a web app.').setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setWrap(true);

  let r = 4;
  const section = (t) => { styleSectionBar_(sh.getRange(r, 1, 1, 3), t); r++; };
  const line = (t, opts) => {
    const c = sh.getRange(r, 2).setValue(t).setWrap(true).setVerticalAlignment('top');
    if (opts && opts.bold) c.setFontWeight('bold');
    if (opts && opts.right) sh.getRange(r, 3).setValue(opts.right).setWrap(true).setFontColor(COLORS.MUTED_TEXT).setVerticalAlignment('top');
    r++;
  };
  const check = (t) => {
    sh.getRange(r, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
    sh.getRange(r, 2).setValue(t).setWrap(true);
    r++;
  };

  section('How the workbook thinks');
  line('One record = one row. Every table has a stable ID. Months are real first-of-month dates. Financial rows are never deleted — tick "Is Deleted" instead.');
  line('Income is the source of truth for paychecks. Transactions is the source of truth for spending. Everything else (Monthly Summary, Dashboard, budgets, funds, debts) is calculated from those two tables and the reference tables.');
  line('Spending = Expense − Refund. Savings transfers, debt payments, account transfers and Split Parent rows are never counted as spending. Split children are.');
  r++;

  section('Review cadence (deliberately light)');
  line('Weekly — categorize new transactions, clear Validation Flags, glance at Current Flexible Spending on the Dashboard.', { bold: false, right: '5–10 minutes' });
  line('Monthly — enter paychecks in Income, compare Monthly Budget planned vs. actual, set next month\'s flexible target on Monthly Plan, complete a Monthly Review row.', { right: '30 minutes' });
  line('Quarterly (Mar · Jun · Sep · Dec) — update Quarterly Debt Review balances, check interest rates and payoff progress.', { right: '20 minutes' });
  line('Quarterly or annually — Finance Tracker → Record net worth snapshot. Credit scores can be entered monthly on Credit Scores.', { right: '10 minutes' });
  r++;

  section('Getting started' + (withSample ? ' (sample data is loaded — every row is tagged SAMPLE)' : ''));
  check('Open Finance Tracker → Run QA checks and confirm there are no formula errors.');
  check('Accounts: enter owner, current balance and Last Updated for ACC-006 to ACC-013 (your real accounts).');
  check('Debts: enter your real debts, then add a Quarterly Debt Review row for each with the current balance.');
  check('Savings & Reserves: enter your real funds with starting amounts, targets and target dates.');
  check('Income: enter this month\'s paychecks (gross, each deduction, deposit account).');
  check('Monthly Plan: set this month\'s Monthly Flexible Target.');
  check('Monthly Budget: enter Planned amounts per category for this month.');
  check('Recurring Payments: enter your real bills, subscriptions and memberships.');
  check('Credit Scores: enter the latest score for each person (no scores are pre-filled).');
  check('When your real data is in: Finance Tracker → Clear sample data…');
  check('Later: connect Plaid to Import Staging, add receipt AI for splits, and deploy the Apps Script web app (see App Setup).');
  r++;

  section('Tab guide');
  [
    ['Dashboard', 'Monthly snapshot for the Selected Month (B3) plus Current Flexible Spending for the actual current week.'],
    ['Income', 'Paycheck database — gross, deductions, take-home. Authoritative for payroll.'],
    ['Transactions', 'Master ledger. Validation Flag (col Z) tells you what is missing.'],
    ['Recurring Payments', 'Expected bills and subscriptions (not actual payments).'],
    ['Monthly Budget', 'Planned vs. actual by main category.'],
    ['Monthly Plan', 'One flexible-spending target per month and the Monday–Sunday weekly guidance.'],
    ['Monthly Summary', 'Calculated monthly results. Read-only.'],
    ['Savings & Reserves', 'Emergency fund, sinking funds and goals, fed by Savings transactions.'],
    ['Debts', 'Master debt table with estimated interest; balances come from Quarterly Debt Review.'],
    ['Quarterly Debt Review', 'Debt balance snapshots each quarter.'],
    ['Net Worth Snapshots', 'History plus a live tracked-net-worth helper.'],
    ['Accounts', 'Bank, card, investment, retirement and asset accounts.'],
    ['Monthly Review', 'Month-end review rows (numbers pulled from Monthly Summary).'],
    ['Categories', 'Taxonomy and every dropdown list.'],
    ['App Setup', 'Architecture, settings, data dictionary.'],
    ['Sources', 'Guidance behind the design.'],
    ['Import Staging', 'Landing table for Plaid / CSV imports.'],
    ['Change Log', 'Append-only audit history.'],
    ['Credit Scores', 'Manual monthly score history.'],
  ].forEach(([tab, what]) => line(tab + ' — ' + what));
  r++;

  section('Rules the app (and humans) must keep');
  APP_RULES.forEach((rule, i) => line((i + 1) + '. ' + rule));
  r++;

  section('Build');
  line('Built ' + Utilities.formatDate(nowStamp_(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ' · schema ' + HFT.SCHEMA_VERSION + ' · script ' + HFT.BUILD_VERSION);
  line('Source & documentation: ' + HFT.REPO_URL);
  sh.getRange(3, 1, r, 3).setFontColor(COLORS.TEXT);
  sh.setFrozenRows(2);
}

/* ===================================================================== */
/* 30_Tables.gs
/* ===================================================================== */
/**
 * Household Finance Tracker — 30_Tables.gs
 * Phases 2–4: core raw tables, import infrastructure and derived reporting tables.
 * The generic builder (10_Helpers.gs) lays down headers/formulas/validations;
 * this file adds conditional formatting, presentation sections and helpers.
 */

/** Conditional-format builders keyed by table key (re-run after extendTable_). */
const CF_BUILDERS = {};

function rowRange_(sh, def) {
  return sh.getRange(def.firstRow, 1, def.lastRow - def.firstRow + 1, def.columns.length);
}
function colRange_(sh, def, key) {
  return sh.getRange(def.firstRow, colIndex_(def, key), def.lastRow - def.firstRow + 1, 1);
}
function cellRef_(def, key) { return '$' + colLetterOf_(def, key) + def.firstRow; }

CF_BUILDERS.CATS = (sh, def) => {
  sh.setConditionalFormatRules(categoryCellRules_(sh, def, 'category'));
};

CF_BUILDERS.ACCOUNTS = (sh, def) => {
  const rules = [
    cfRule_(colRange_(sh, def, 'accountType'), '=OR(' + cellRef_(def, 'accountType') + '="Credit Card",' + cellRef_(def, 'accountType') + '="Loan")', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(colRange_(sh, def, 'currentBalance'), '=AND(' + cellRef_(def, 'id') + '<>"",' + cellRef_(def, 'currentBalance') + '="")', COLORS.WARN_FILL, COLORS.WARN_FONT),
  ];
  sh.setConditionalFormatRules(rules);
};

CF_BUILDERS.INCOME = (sh, def) => {
  const p = cellRef_(def, 'person');
  sh.setConditionalFormatRules([
    cfRule_(rowRange_(sh, def), '=' + p + '="Ben"', COLORS.BEN, COLORS.TEXT),
    cfRule_(rowRange_(sh, def), '=' + p + '="Valerie"', COLORS.VALERIE, COLORS.TEXT),
    cfRule_(colRange_(sh, def, 'linkedTx'), '=' + cellRef_(def, 'linkedTx') + '="Unlinked"', COLORS.WARN_FILL, COLORS.WARN_FONT),
  ]);
};

CF_BUILDERS.TX = (sh, def) => {
  const id = cellRef_(def, 'id'), type = cellRef_(def, 'type'), cat = cellRef_(def, 'category');
  const del = cellRef_(def, 'isDeleted'), flag = cellRef_(def, 'validationFlag');
  const rules = [
    cfRule_(rowRange_(sh, def), '=' + del + '=TRUE', null, COLORS.DELETED_TEXT, { strike: true }),
    cfRule_(rowRange_(sh, def), '=' + type + '="Split Parent"', null, COLORS.MUTED_TEXT, { italic: true }),
    cfRule_(colRange_(sh, def, 'category'), '=AND(' + id + '<>"",' + cat + '="",OR(' + type + '="Expense",' + type + '="Refund"))', COLORS.UNCATEGORIZED, COLORS.OVER_FONT, { bold: true }),
    cfRule_(colRange_(sh, def, 'validationFlag'), '=AND(' + id + '<>"",' + flag + '<>"")', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(colRange_(sh, def, 'splitDiff'), '=AND(ISNUMBER(' + cellRef_(def, 'splitDiff') + '),ABS(' + cellRef_(def, 'splitDiff') + ')>0.01)', COLORS.OVER_FILL, COLORS.OVER_FONT),
  ].concat(categoryCellRules_(sh, def, 'category'));
  sh.setConditionalFormatRules(rules);
};

CF_BUILDERS.RECUR = (sh, def) => {
  const rules = [
    cfRule_(rowRange_(sh, def), '=AND(' + cellRef_(def, 'id') + '<>"",' + cellRef_(def, 'active') + '<>TRUE)', null, COLORS.DELETED_TEXT),
  ].concat(categoryCellRules_(sh, def, 'category'));
  sh.setConditionalFormatRules(rules);
};

CF_BUILDERS.FUNDS = (sh, def) => {
  const s = cellRef_(def, 'status');
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'status'), '=' + s + '="Funded"', COLORS.UNDER_FILL, COLORS.UNDER_FONT, { bold: true }),
    cfRule_(colRange_(sh, def, 'status'), '=OR(' + s + '="Behind",' + s + '="Past Target Date")', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(colRange_(sh, def, 'status'), '=' + s + '="On Track"', COLORS.PALE_BLUE, COLORS.TEXT),
  ]);
};

CF_BUILDERS.DEBTS = (sh, def) => {
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'apr'), '=AND(ISNUMBER(' + cellRef_(def, 'apr') + '),' + cellRef_(def, 'apr') + '>=0.15)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(colRange_(sh, def, 'balanceAsOf'), '=' + cellRef_(def, 'balanceAsOf') + '="No review yet"', COLORS.WARN_FILL, COLORS.WARN_FONT),
  ]);
};

CF_BUILDERS.QDR = (sh, def) => {
  const t = cellRef_(def, 'trackedPayments'), p = cellRef_(def, 'payments');
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'trackedPayments'), '=AND(ISNUMBER(' + t + '),ABS(' + t + '-N(' + p + '))>0.01)', COLORS.WARN_FILL, COLORS.WARN_FONT),
  ]);
};

CF_BUILDERS.CREDIT = (sh, def) => { sh.setConditionalFormatRules([]); };
CF_BUILDERS.LOG = (sh, def) => { sh.setConditionalFormatRules([]); };
CF_BUILDERS.NW = (sh, def) => { sh.setConditionalFormatRules([]); };

CF_BUILDERS.STAGING = (sh, def) => {
  sh.setConditionalFormatRules([
    cfRule_(rowRange_(sh, def), '=' + cellRef_(def, 'duplicate') + '=TRUE', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(colRange_(sh, def, 'reviewed'), '=' + cellRef_(def, 'reviewed') + '=TRUE', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
  ]);
};

CF_BUILDERS.BUDGET = (sh, def) => {
  const id = cellRef_(def, 'id'), rem = cellRef_(def, 'remaining');
  const statusRange = sh.getRange(def.firstRow, colIndex_(def, 'planned'), def.lastRow - def.firstRow + 1, 4); // Planned..% Used
  sh.setConditionalFormatRules([
    cfRule_(statusRange, '=AND(' + id + '<>"",' + rem + '<0)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(statusRange, '=AND(' + id + '<>"",' + rem + '>=0)', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
  ].concat(categoryCellRules_(sh, def, 'category')));
};

CF_BUILDERS.PLAN = (sh, def) => {
  const id = cellRef_(def, 'id'), av = cellRef_(def, 'available');
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'available'), '=AND(' + id + '<>"",' + av + '<0)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(colRange_(sh, def, 'available'), '=AND(' + id + '<>"",' + av + '>=0)', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(rowRange_(sh, def), '=' + cellRef_(def, 'month') + '=DATE(YEAR(TODAY()),MONTH(TODAY()),1)', COLORS.PALE_BLUE, COLORS.TEXT, { bold: true }),
  ]);
};

CF_BUILDERS.SUMMARY = (sh, def) => {
  const m = cellRef_(def, 'month'), cr = cellRef_(def, 'cashRemaining'), rec = cellRef_(def, 'incomeReconciliation');
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'cashRemaining'), '=AND(' + m + '<>"",' + cr + '<0)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(colRange_(sh, def, 'cashRemaining'), '=AND(' + m + '<>"",' + cr + '>=0)', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(colRange_(sh, def, 'incomeReconciliation'), '=AND(' + m + '<>"",ISNUMBER(' + rec + '),ABS(' + rec + ')>0.01)', COLORS.WARN_FILL, COLORS.WARN_FONT),
    cfRule_(rowRange_(sh, def), '=' + m + '=DATE(YEAR(TODAY()),MONTH(TODAY()),1)', COLORS.PALE_BLUE, COLORS.TEXT, { bold: true }),
  ]);
};

CF_BUILDERS.REVIEW = (sh, def) => {
  const s = cellRef_(def, 'status');
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'status'), '=' + s + '="Complete"', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(colRange_(sh, def, 'status'), '=' + s + '="In Progress"', COLORS.WARN_FILL, COLORS.WARN_FONT),
  ]);
};

/* ---------- presentation sections ---------- */

/** Recurring Payments rows 1–38: KPIs, group summary, upcoming lists. */
function buildRecurringTop_(sh, def) {
  const R = (t) => resolveFormula_(t, def, def.firstRow);
  const W = def.columns.length;
  sh.getRange(1, 1, 1, W).setBackground(COLORS.NAVY);
  sh.getRange(1, 1).setValue(def.title).setFontColor(COLORS.WHITE).setFontSize(14).setFontWeight('bold');
  sh.setRowHeight(1, 32);
  styleNoteRow_(sh, 2, def.note, W);

  const kpis = [
    ['Total Recurring (Monthly)', R('=SUMIFS([@@monthlyEq],[@@active],TRUE)')],
    ['Total Recurring (Annual)', '=A5*12'],
    ['Subscriptions (Monthly)', R('=SUMIFS([@@monthlyEq],[@@group],"Subscriptions",[@@active],TRUE)')],
    ['Active Items', R('=COUNTIFS([@@id],"<>",[@@active],TRUE)')],
  ];
  kpis.forEach((k, i) => {
    const c = 1 + i * 2;
    const label = sh.getRange(4, c, 1, 2).merge();
    label.setValue(k[0]).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    const val = sh.getRange(5, c, 1, 2).merge();
    val.setFormula(k[1]).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center').setBackground(COLORS.WHITE)
      .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    if (i < 3) val.setNumberFormat(FORMATS.currency); else val.setNumberFormat(FORMATS.int);
  });
  sh.setRowHeight(5, 34);

  styleSectionBar_(sh.getRange(7, 1, 1, 4), 'By Recurring Group (active only)');
  sh.getRange(8, 1, 1, 4).setValues([['Group', 'Items', 'Monthly', 'Annual']]);
  styleHeader_(sh.getRange(8, 1, 1, 4));
  const groups = LISTS.filter(l => l.key === 'RECURRING_GROUPS')[0].values;
  groups.forEach((g, i) => {
    const r = 9 + i;
    sh.getRange(r, 1).setValue(g);
    sh.getRange(r, 2).setFormula(R('=COUNTIFS([@@group],$A' + r + ',[@@active],TRUE)'));
    sh.getRange(r, 3).setFormula(R('=SUMIFS([@@monthlyEq],[@@group],$A' + r + ',[@@active],TRUE)'));
    sh.getRange(r, 4).setFormula('=C' + r + '*12');
  });
  const tr = 9 + groups.length;
  sh.getRange(tr, 1).setValue('Total').setFontWeight('bold');
  sh.getRange(tr, 2).setFormula('=SUM(B9:B' + (tr - 1) + ')').setFontWeight('bold');
  sh.getRange(tr, 3).setFormula('=SUM(C9:C' + (tr - 1) + ')').setFontWeight('bold');
  sh.getRange(tr, 4).setFormula('=SUM(D9:D' + (tr - 1) + ')').setFontWeight('bold');
  sh.getRange(9, 3, groups.length + 1, 2).setNumberFormat(FORMATS.currency);
  sh.getRange(9, 2, groups.length + 1, 1).setNumberFormat(FORMATS.int);
  sh.getRange(9, 1, groups.length + 1, 4).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  styleSectionBar_(sh.getRange(7, 6, 1, 4), 'Due in the next 14 days (active)');
  sh.getRange(8, 6, 1, 4).setValues([['Name', 'Next Payment', 'Amount', 'Group']]);
  styleHeader_(sh.getRange(8, 6, 1, 4));
  sh.getRange(9, 6).setFormula(R('=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({[@@name],[@@nextPayment],[@@amount],[@@group]},[@@active]=TRUE,[@@nextPayment]>=TODAY(),[@@nextPayment]<=TODAY()+14),2,TRUE),20,4),"Nothing due in the next 14 days")'));
  sh.getRange(9, 7, 20, 1).setNumberFormat(FORMATS.date);
  sh.getRange(9, 8, 20, 1).setNumberFormat(FORMATS.currency);

  styleSectionBar_(sh.getRange(30, 6, 1, 4), 'Renewals / reviews in the next 60 days (active)');
  sh.getRange(31, 6, 1, 4).setValues([['Name', 'Renewal / Review Date', 'Amount', 'Group']]);
  styleHeader_(sh.getRange(31, 6, 1, 4));
  sh.getRange(32, 6).setFormula(R('=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({[@@name],[@@renewalDate],[@@amount],[@@group]},[@@active]=TRUE,[@@renewalDate]>=TODAY(),[@@renewalDate]<=TODAY()+60),2,TRUE),6,4),"No renewals in the next 60 days")'));
  sh.getRange(32, 7, 6, 1).setNumberFormat(FORMATS.date);
  sh.getRange(32, 8, 6, 1).setNumberFormat(FORMATS.currency);

  sh.getRange(38, 1).setValue('Raw table below — header on row ' + def.headerRow + ', data from row ' + def.firstRow + '. The app reads and writes these rows; the summaries above are calculated from them.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  sh.setFrozenRows(0);
}

/** Debts rows 1–6: title + KPI band. */
function buildDebtsTop_(sh, def) {
  const R = (t) => resolveFormula_(t, def, def.firstRow);
  const W = def.columns.length;
  sh.getRange(1, 1, 1, W).setBackground(COLORS.NAVY);
  sh.getRange(1, 1).setValue(def.title).setFontColor(COLORS.WHITE).setFontSize(14).setFontWeight('bold');
  sh.setRowHeight(1, 32);
  styleNoteRow_(sh, 2, def.note, W);
  const kpis = [
    ['Total Latest Balance', R('=SUM([@@latestBalance])'), FORMATS.currency],
    ['Estimated Monthly Interest', R('=SUM([@@estMonthlyInterest])'), FORMATS.currency],
    ['Estimated Annual Interest', R('=SUM([@@estAnnualInterest])'), FORMATS.currency],
    ['Total Minimum Payments', R('=SUM([@@minPayment])'), FORMATS.currency],
    ['Current Quarter Ends', '=DATE(YEAR(TODAY()),CEILING(MONTH(TODAY())/3)*3+1,0)', FORMATS.date],
  ];
  kpis.forEach((k, i) => {
    const c = 1 + i * 2;
    sh.getRange(4, c, 1, 2).merge().setValue(k[0]).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(5, c, 1, 2).merge().setFormula(k[1]).setNumberFormat(k[2]).setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center')
      .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(5, 34);
  sh.getRange(6, 1).setValue('Interest figures are estimates (Latest Balance × APR). Statements may differ because most lenders accrue daily.').setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
}

/** Net Worth Snapshots: live tracked-net-worth helper in columns L:M. */
function buildNetWorthHelper_(sh, def) {
  const F = (t) => resolveFormula_(t, null, null);
  const c = def.columns.length + 2; // leave one blank column
  sh.setColumnWidth(c, 260); sh.setColumnWidth(c + 1, 130);
  styleSectionBar_(sh.getRange(4, c, 1, 2), 'Current Tracked Net Worth (live)');
  const rows = [
    ['Tracked Assets', F('=SUMIFS([ACCOUNTS.currentBalance],[ACCOUNTS.includeNW],"Yes",[ACCOUNTS.accountType],"<>Credit Card",[ACCOUNTS.accountType],"<>Loan")')],
    ['Unlinked Credit-Card Liabilities', F('=ARRAYFORMULA(SUMIFS([ACCOUNTS.currentBalance],[ACCOUNTS.accountType],"Credit Card",[ACCOUNTS.includeNW],"Yes")-IFERROR(SUMPRODUCT(SUMIFS([ACCOUNTS.currentBalance],[ACCOUNTS.id],FILTER([DEBTS.linkedAccount],[DEBTS.linkedAccount]<>""),[ACCOUNTS.accountType],"Credit Card",[ACCOUNTS.includeNW],"Yes")),0))')],
    ['Reviewed Debt Liabilities (Debts tab)', F('=SUM([DEBTS.latestBalance])')],
    ['Current Tracked Net Worth', '=' + colLetter_(c + 1) + '5-' + colLetter_(c + 1) + '6-' + colLetter_(c + 1) + '7'],
    ['As of', '=TODAY()'],
  ];
  rows.forEach((row, i) => {
    sh.getRange(5 + i, c).setValue(row[0]);
    sh.getRange(5 + i, c + 1).setFormula(row[1]).setNumberFormat(i === 4 ? FORMATS.date : FORMATS.currency);
  });
  sh.getRange(8, c, 1, 2).setFontWeight('bold').setBackground(COLORS.PALE_BLUE);
  sh.getRange(5, c, 5, 2).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(11, c).setValue('Assets = Accounts with Include in Net Worth = Yes, excluding Credit Card and Loan types. Credit cards linked to a Debts row are counted once, through Debts.')
    .setWrap(true).setFontSize(9).setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT);
  sh.getRange(11, c, 1, 2).merge();
  sh.setRowHeight(11, 48);
}

/* ---------- orchestration for phases 2–4 ---------- */

function buildCoreTables_() {
  ['INCOME', 'TX', 'RECUR', 'FUNDS', 'DEBTS', 'QDR', 'CREDIT'].forEach(key => {
    const def = tdef_(key);
    const sh = buildTableSheet_(def);
    if (key === 'RECUR') buildRecurringTop_(sh, def);
    if (key === 'DEBTS') buildDebtsTop_(sh, def);
    CF_BUILDERS[key](sh, def);
  });
}

function buildInfrastructureTables_() {
  ['STAGING', 'LOG'].forEach(key => {
    const def = tdef_(key);
    const sh = buildTableSheet_(def);
    CF_BUILDERS[key](sh, def);
  });
}

function buildDerivedTables_() {
  ['BUDGET', 'PLAN', 'SUMMARY', 'REVIEW', 'NW'].forEach(key => {
    const def = tdef_(key);
    const sh = buildTableSheet_(def);
    if (key === 'NW') buildNetWorthHelper_(sh, def);
    CF_BUILDERS[key](sh, def);
  });
}

/* ===================================================================== */
/* 60_Dashboard.gs
/* ===================================================================== */
/**
 * Household Finance Tracker — 60_Dashboard.gs
 * Phase 5: Dashboard. Built last; a summary only, never a second database.
 *
 * Layout (columns A:I)
 *   1–3   title, subtitle, Selected Month (B3)
 *   5–7   four equal cards A:B C:D E:F G:H  (Gross · Take-Home · Spending · Total Savings)
 *   9–13  Income by Person (A:E)
 *  15–19  Credit Scores — Latest (A:E)
 *  21–30  Payroll Deductions: Ben A:C · Valerie D:F · Household G:I
 *  32–35  Current Flexible Spending (A:I) — follows TODAY(), not B3
 *  37–46  Savings & Reserves (A:F) + Monthly Review Checklist (G:I)
 *  48     quarterly debt footnote
 */

const DASH = {
  SELECTED_MONTH: 'B3',
  CARD_ROW_LABEL: 5, CARD_ROW_VALUE: 6, CARD_ROW_SUB: 7,
  INCOME_HEADER: 10, INCOME_BEN: 11, INCOME_VAL: 12, INCOME_HH: 13,
  CREDIT_HEADER: 16, CREDIT_BEN: 17, CREDIT_VAL: 18,
  PAYROLL_GROUPS: 22, PAYROLL_HEADER: 23, PAYROLL_FIRST: 24, PAYROLL_TOTAL: 30,
  FLEX_BAR: 32, FLEX_LABEL: 33, FLEX_VALUE: 34, FLEX_SUB: 35,
  FUNDS_BAR: 37, FUNDS_HEADER: 38, FUNDS_FIRST: 39, FUNDS_COUNT: 8,
  FOOTNOTE: 48,
};

function buildDashboard_() {
  const sh = getOrCreateSheet_(SHEETS.DASH);
  const F = (t) => resolveFormula_(t, null, null);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear();
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  ensureSheetSize_(sh, 52, 9);
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 200);
  for (let c = 2; c <= 9; c++) sh.setColumnWidth(c, 118);
  sh.getRange(1, 1, 52, 9).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');

  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const header = (a1, values) => { const r = sh.getRange(a1); r.setValues([values]); styleHeader_(r); r.setHorizontalAlignment('center'); };
  const SEL = '$B$3';
  const CUR_MONTH = 'DATE(YEAR(TODAY()),MONTH(TODAY()),1)';

  /* --- title & selected month --- */
  mergePut('A1:I1', 'Household Finance Dashboard').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  mergePut('A2:I2', 'Monthly cards, Income by Person and Payroll Deductions follow the Selected Month. Current Flexible Spending always follows today\'s month and week.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  put('A3', 'Selected Month').setFontWeight('bold');
  const sel = put('B3', monthStart_(new Date()));
  sel.setNumberFormat('mmmm yyyy').setBackground(COLORS.INPUT).setFontWeight('bold')
    .setBorder(true, true, true, true, false, false, COLORS.NAVY, SpreadsheetApp.BorderStyle.SOLID)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Enter any date in the month you want to view; use the first of the month.').build());
  mergePut('C3:E3', '="Showing "&TEXT(' + SEL + ',"mmmm yyyy")&IF(' + SEL + '<>' + CUR_MONTH + ',"  (not the current month)","")').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);

  /* --- four cards --- */
  const cards = [
    { cols: 'A:B', label: 'Household Gross Income', color: COLORS.CARD_GROSS, sub: 'Income table · gross pay',
      f: F('=SUMIFS([INCOME.gross],[INCOME.month],' + SEL + ')') },
    { cols: 'C:D', label: 'Household Take-Home', color: COLORS.CARD_TAKEHOME, sub: 'Income table · take-home pay',
      f: F('=SUMIFS([INCOME.takeHome],[INCOME.month],' + SEL + ')') },
    { cols: 'E:F', label: 'Spending', color: COLORS.CARD_SPENDING, sub: 'Monthly Summary · expenses − refunds',
      f: F('=IFERROR(INDEX([SUMMARY.spending],MATCH(' + SEL + ',[SUMMARY.month],0)),0)') },
    { cols: 'G:H', label: 'Total Savings', color: COLORS.CARD_SAVINGS, sub: 'Monthly Summary · cash savings + payroll retirement',
      f: F('=IFERROR(INDEX([SUMMARY.totalSavings],MATCH(' + SEL + ',[SUMMARY.month],0)),0)') },
  ];
  cards.forEach(card => {
    const [c1, c2] = card.cols.split(':');
    mergePut(c1 + DASH.CARD_ROW_LABEL + ':' + c2 + DASH.CARD_ROW_LABEL, card.label).setBackground(card.color).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(c1 + DASH.CARD_ROW_VALUE + ':' + c2 + DASH.CARD_ROW_VALUE, card.f).setBackground(card.color).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('$#,##0');
    mergePut(c1 + DASH.CARD_ROW_SUB + ':' + c2 + DASH.CARD_ROW_SUB, card.sub).setBackground(card.color).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center');
    sh.getRange(c1 + DASH.CARD_ROW_LABEL + ':' + c2 + DASH.CARD_ROW_SUB).setBorder(true, true, true, true, false, false, COLORS.WHITE, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  });
  sh.setRowHeight(DASH.CARD_ROW_VALUE, 42);

  /* --- Income by Person (A:E) --- */
  styleSectionBar_(sh.getRange('A9:E9'), '="Income by Person — "&TEXT(' + SEL + ',"mmmm yyyy")');
  sh.getRange('A9').setFormula('="Income by Person — "&TEXT(' + SEL + ',"mmmm yyyy")');
  header('A10:E10', ['Person', 'Gross', 'Take-Home', 'Deductions', 'Take-Home %']);
  const personRows = [
    { row: DASH.INCOME_BEN, name: 'Ben', color: COLORS.BEN },
    { row: DASH.INCOME_VAL, name: 'Valerie', color: COLORS.VALERIE },
  ];
  personRows.forEach(p => {
    put('A' + p.row, p.name).setFontWeight('bold');
    put('B' + p.row, F('=SUMIFS([INCOME.gross],[INCOME.month],' + SEL + ',[INCOME.person],$A' + p.row + ')'));
    put('C' + p.row, F('=SUMIFS([INCOME.takeHome],[INCOME.month],' + SEL + ',[INCOME.person],$A' + p.row + ')'));
    put('D' + p.row, '=B' + p.row + '-C' + p.row);
    put('E' + p.row, '=IF(B' + p.row + '>0,C' + p.row + '/B' + p.row + ',"")');
    sh.getRange('A' + p.row + ':E' + p.row).setBackground(p.color);
  });
  const hh = DASH.INCOME_HH;
  put('A' + hh, 'Household').setFontWeight('bold');
  put('B' + hh, '=SUM(B' + DASH.INCOME_BEN + ':B' + DASH.INCOME_VAL + ')');
  put('C' + hh, '=SUM(C' + DASH.INCOME_BEN + ':C' + DASH.INCOME_VAL + ')');
  put('D' + hh, '=B' + hh + '-C' + hh);
  put('E' + hh, '=IF(B' + hh + '>0,C' + hh + '/B' + hh + ',"")');
  sh.getRange('A' + hh + ':E' + hh).setBackground(COLORS.HOUSEHOLD).setFontWeight('bold');
  sh.getRange('B11:D13').setNumberFormat(FORMATS.currency);
  sh.getRange('E11:E13').setNumberFormat(FORMATS.percent);
  sh.getRange('A10:E13').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- Credit Scores — Latest (A:E) --- */
  styleSectionBar_(sh.getRange('A15:E15'), 'Credit Scores — Latest');
  header('A16:E16', ['Person', 'Score', 'Rating', 'Updated', 'Position (300–850)']);
  [{ row: DASH.CREDIT_BEN, name: 'Ben', color: COLORS.BEN }, { row: DASH.CREDIT_VAL, name: 'Valerie', color: COLORS.VALERIE }].forEach(p => {
    const r = p.row;
    put('A' + r, p.name).setFontWeight('bold');
    put('D' + r, F('=IF(MAXIFS([CREDIT.scoreDate],[CREDIT.person],$A' + r + ')=0,"",MAXIFS([CREDIT.scoreDate],[CREDIT.person],$A' + r + '))')).setNumberFormat(FORMATS.date);
    put('B' + r, F('=IF($D' + r + '="","",IFERROR(INDEX(FILTER([CREDIT.score],[CREDIT.person]=$A' + r + ',[CREDIT.scoreDate]=$D' + r + '),1),""))')).setNumberFormat(FORMATS.int).setFontWeight('bold');
    put('C' + r, '=IF($B' + r + '="","No score yet",IFS($B' + r + '<580,"Poor",$B' + r + '<670,"Fair",$B' + r + '<740,"Good",$B' + r + '<800,"Very Good",TRUE,"Exceptional"))');
    put('E' + r, '=IF($B' + r + '="","",SPARKLINE(($B' + r + '-300)/550,{"charttype","bar";"max",1;"color1","' + COLORS.TEAL + '"}))');
    sh.getRange('A' + r + ':E' + r).setBackground(p.color);
  });
  sh.getRange('A16:E18').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  mergePut('A19:I19', 'Enter scores on the Credit Scores tab (monthly). Scale: 300–579 Poor · 580–669 Fair · 670–739 Good · 740–799 Very Good · 800–850 Exceptional.')
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- Payroll Deductions --- */
  styleSectionBar_(sh.getRange('A21:I21'), '');
  sh.getRange('A21').setFormula('="Payroll Deductions — "&TEXT(' + SEL + ',"mmmm yyyy")');
  const groups = [
    { c1: 'A', c2: 'B', c3: 'C', name: 'Ben', color: COLORS.BEN, person: 'Ben', grossCell: '$B$' + DASH.INCOME_BEN },
    { c1: 'D', c2: 'E', c3: 'F', name: 'Valerie', color: COLORS.VALERIE, person: 'Valerie', grossCell: '$B$' + DASH.INCOME_VAL },
    { c1: 'G', c2: 'H', c3: 'I', name: 'Household', color: COLORS.HOUSEHOLD, person: null, grossCell: '$B$' + DASH.INCOME_HH },
  ];
  const deductions = [
    ['Federal Tax', 'fedTax'], ['State / Local Tax', 'stateTax'], ['Social Security & Medicare', 'ssMed'],
    ['Health / Insurance', 'health'], ['Retirement', 'retirement'], ['Other Deductions', 'otherDed'], ['Total Deductions', 'totalDed'],
  ];
  groups.forEach(g => {
    mergePut(g.c1 + DASH.PAYROLL_GROUPS + ':' + g.c3 + DASH.PAYROLL_GROUPS, g.name).setBackground(g.color).setFontWeight('bold').setHorizontalAlignment('center');
    header(g.c1 + DASH.PAYROLL_HEADER + ':' + g.c3 + DASH.PAYROLL_HEADER, ['Deduction', 'Amount', '% of Gross']);
    deductions.forEach((d, i) => {
      const r = DASH.PAYROLL_FIRST + i;
      put(g.c1 + r, d[0]);
      const crit = g.person ? ',[INCOME.person],"' + g.person + '"' : '';
      put(g.c2 + r, F('=SUMIFS([INCOME.' + d[1] + '],[INCOME.month],' + SEL + crit + ')')).setNumberFormat(FORMATS.currency);
      put(g.c3 + r, '=IF(' + g.grossCell + '>0,' + g.c2 + r + '/' + g.grossCell + ',"")').setNumberFormat(FORMATS.percent);
    });
    const block = sh.getRange(g.c1 + DASH.PAYROLL_FIRST + ':' + g.c3 + DASH.PAYROLL_TOTAL);
    block.setBackground(g.color);
    sh.getRange(g.c1 + DASH.PAYROLL_TOTAL + ':' + g.c3 + DASH.PAYROLL_TOTAL).setFontWeight('bold');
    sh.getRange(g.c1 + DASH.PAYROLL_HEADER + ':' + g.c3 + DASH.PAYROLL_TOTAL).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });

  /* --- Current Flexible Spending (follows TODAY) --- */
  styleSectionBar_(sh.getRange('A32:I32'), '');
  sh.getRange('A32').setFormula('="Current Flexible Spending — "&TEXT(TODAY(),"mmmm yyyy")');
  const planMatch = 'MATCH(' + CUR_MONTH + ',[PLAN.month],0)';
  const flex = [
    { cols: ['A', 'C'], label: 'Amount Available This Month', f: F('=IFERROR(INDEX([PLAN.available],' + planMatch + '),"No plan row")'),
      sub: F('=IFERROR("Target "&TEXT(INDEX([PLAN.target],' + planMatch + '),"$#,##0")&" · Flexible spent "&TEXT(INDEX([PLAN.flexSpent],' + planMatch + '),"$#,##0"),"Add a row for this month on the Monthly Plan tab")') },
    { cols: ['D', 'F'], label: 'Suggested This Week', f: F('=IFERROR(INDEX([PLAN.suggestedWeek],' + planMatch + '),"No plan row")'),
      sub: '="Week of "&TEXT(TODAY()-WEEKDAY(TODAY(),2)+1,"ddd mmm d")&" – "&TEXT(MIN(TODAY()-WEEKDAY(TODAY(),2)+7,EOMONTH(TODAY(),0)),"ddd mmm d")&" · Flexible only"' },
    { cols: ['G', 'I'], label: 'Spent This Week', f: F('=IFERROR(INDEX([PLAN.spentWeek],' + planMatch + '),"No plan row")'),
      sub: 'Monday through today · Spending Type = Flexible' },
  ];
  flex.forEach(b => {
    mergePut(b.cols[0] + DASH.FLEX_LABEL + ':' + b.cols[1] + DASH.FLEX_LABEL, b.label).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(b.cols[0] + DASH.FLEX_VALUE + ':' + b.cols[1] + DASH.FLEX_VALUE, b.f).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat('$#,##0');
    mergePut(b.cols[0] + DASH.FLEX_SUB + ':' + b.cols[1] + DASH.FLEX_SUB, b.sub).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center');
    sh.getRange(b.cols[0] + DASH.FLEX_LABEL + ':' + b.cols[1] + DASH.FLEX_SUB).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(DASH.FLEX_VALUE, 42);
  sh.setConditionalFormatRules([
    cfRule_(sh.getRange('A34:C34'), '=AND(ISNUMBER(A34),A34<0)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange('A34:C34'), '=AND(ISNUMBER(A34),A34>=0)', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(sh.getRange('F39:F46'), '=F39="Funded"', COLORS.UNDER_FILL, COLORS.UNDER_FONT, { bold: true }),
    cfRule_(sh.getRange('F39:F46'), '=OR(F39="Behind",F39="Past Target Date")', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(sh.getRange('B11:D13'), '=AND(B11=0,$B$3<>"")', null, COLORS.MUTED_TEXT),
  ]);

  /* --- Savings & Reserves + checklist --- */
  styleSectionBar_(sh.getRange('A37:F37'), 'Savings & Reserves');
  styleSectionBar_(sh.getRange('G37:I37'), 'Monthly Review Checklist');
  header('A38:F38', ['Fund Name', 'Target', 'Current', 'Amount Needed', '% Funded', 'Status']);
  header('G38:G38', ['Done']);
  sh.getRange('H38:I38').merge().setValue('Item');
  styleHeader_(sh.getRange('H38:I38'));
  const fundCols = [['name', 'A'], ['target', 'B'], ['current', 'C'], ['amountNeeded', 'D'], ['pctFunded', 'E'], ['status', 'F']];
  for (let k = 1; k <= DASH.FUNDS_COUNT; k++) {
    const r = DASH.FUNDS_FIRST + k - 1;
    fundCols.forEach(fc => {
      put(fc[1] + r, F('=IF(INDEX([FUNDS.id],' + k + ')="","",INDEX([FUNDS.' + fc[0] + '],' + k + '))'));
    });
    sh.getRange('B' + r + ':D' + r).setNumberFormat(FORMATS.currency);
    sh.getRange('E' + r).setNumberFormat(FORMATS.percent);
  }
  const checklist = [
    'Categorize every new transaction (no blank categories).',
    'Clear all Validation Flags on Transactions.',
    'Confirm this month\'s paychecks are in Income.',
    'Compare Monthly Budget planned vs. actual.',
    'Review Planned Irregular and Unexpected purchases.',
    'Set next month\'s flexible target on Monthly Plan.',
    'Adjust Savings & Reserves targets if needed.',
    'Complete this month\'s Monthly Review row.',
  ];
  checklist.forEach((item, i) => {
    const r = DASH.FUNDS_FIRST + i;
    sh.getRange('G' + r).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()).setHorizontalAlignment('center');
    sh.getRange('H' + r + ':I' + r).merge().setValue(item).setFontSize(9).setWrap(true);
  });
  sh.getRange('A38:F46').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange('G38:I46').setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- footnote --- */
  mergePut('A48:I48', F('="Debt is reviewed quarterly (Mar · Jun · Sep · Dec) on the Quarterly Debt Review tab — latest reviewed total: "&TEXT(SUM([DEBTS.latestBalance]),"$#,##0")&". Balances are kept off the everyday Dashboard on purpose."'))
    .setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setFontStyle('italic');

  /* --- protection: warning-only, except inputs --- */
  const prot = sh.protect().setDescription('Dashboard is calculated. Change the Selected Month in B3 or tick the checklist; edit data on the raw tabs.');
  prot.setWarningOnly(true);
  prot.setUnprotectedRanges([sh.getRange('B3'), sh.getRange('G' + DASH.FUNDS_FIRST + ':G' + (DASH.FUNDS_FIRST + DASH.FUNDS_COUNT - 1))]);
}

/* ===================================================================== */
/* 70_SampleData.gs
/* ===================================================================== */
/**
 * Household Finance Tracker — 70_SampleData.gs
 * Clearly-tagged sample data that exercises every acceptance scenario.
 * Dates are generated relative to the build date so the Dashboard's
 * "current month / current week" sections always have something to show.
 * Every sample row carries "SAMPLE" in its Notes (and sample-data as Created By).
 */

function sampleMonths_() {
  const m0 = monthStart_(new Date());
  return [addMonths_(m0, -3), addMonths_(m0, -2), addMonths_(m0, -1), m0];
}

function dateIn_(month, day) {
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return new Date(month.getFullYear(), month.getMonth(), Math.min(day, lastDay));
}

function todayMidnight_() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }

function taxonomyDefaults_(category, subcategory) {
  for (let i = 0; i < TAXONOMY.length; i++) {
    if (TAXONOMY[i][0] === category && TAXONOMY[i][1] === subcategory) {
      return { needWant: TAXONOMY[i][2], fixedVariable: TAXONOMY[i][3], spendingType: TAXONOMY[i][4] };
    }
  }
  throw new Error('Sample data references unknown taxonomy entry: ' + category + ' / ' + subcategory);
}

function lastQuarterEnds_(count) {
  const t = todayMidnight_();
  const out = [];
  let qEndMonth = Math.ceil((t.getMonth() + 1) / 3) * 3; // 3,6,9,12
  let year = t.getFullYear();
  let d = new Date(year, qEndMonth, 0);
  if (d > t) { qEndMonth -= 3; if (qEndMonth === 0) { qEndMonth = 12; year--; } d = new Date(year, qEndMonth, 0); }
  while (out.length < count) {
    out.unshift(new Date(year, qEndMonth, 0));
    qEndMonth -= 3; if (qEndMonth === 0) { qEndMonth = 12; year--; }
  }
  return out;
}

function nextDueDate_(dueDay) {
  const t = todayMidnight_();
  const thisMonth = dateIn_(monthStart_(t), dueDay);
  return thisMonth >= t ? thisMonth : dateIn_(addMonths_(t, 1), dueDay);
}

/** Build the whole sample dataset. */
function sampleDataset_() {
  const months = sampleMonths_();
  const today = todayMidnight_();
  const S = HFT.SAMPLE_TAG;
  const USER = HFT.SAMPLE_USER;

  /* ---- Income ---- */
  const income = [];
  const paySpec = [
    { person: 'Ben', employer: 'Sample Employer A', days: [1, 15], gross: 3200, fedTax: 352, stateTax: 136, ssMed: 244.8, health: 185, retirement: 192, otherDed: 20 },
    { person: 'Valerie', employer: 'Sample Employer B', days: [5, 20], gross: 2600, fedTax: 260, stateTax: 110.5, ssMed: 198.9, health: 150, retirement: 130, otherDed: 0 },
  ];
  let incN = 0;
  months.forEach(m => {
    paySpec.forEach(p => {
      p.days.forEach(day => {
        const d = dateIn_(m, day);
        if (d > today) return;
        incN++;
        income.push({
          id: 'INC-' + String(incN).padStart(4, '0'), payDate: d, person: p.person, employer: p.employer, incomeType: 'Salary',
          gross: p.gross, fedTax: p.fedTax, stateTax: p.stateTax, ssMed: p.ssMed, health: p.health, retirement: p.retirement, otherDed: p.otherDed,
          depositAccount: 'ACC-001', notes: S + ' paycheck', lastUpdated: d,
          _takeHome: p.gross - (p.fedTax + p.stateTax + p.ssMed + p.health + p.retirement + p.otherDed),
        });
      });
    });
  });

  /* ---- Transactions ---- */
  const tx = [];
  let txN = 0;
  const nextTxId = () => 'TX-' + String(++txN).padStart(6, '0');
  const baseTx = (d, desc, amount, type, extra) => {
    const row = Object.assign({
      id: nextTxId(), date: d, description: desc, amount: amount, type: type, accountId: 'ACC-001', person: 'Household',
      hhPersonal: 'Household', status: 'Posted', notes: S, createdAt: d, createdBy: USER,
    }, extra || {});
    if (row.category && row.subcategory && (type === 'Expense' || type === 'Refund')) {
      const dft = taxonomyDefaults_(row.category, row.subcategory);
      if (!row.needWant) row.needWant = dft.needWant;
      if (!row.fixedVariable) row.fixedVariable = dft.fixedVariable;
      if (!row.spendingType) row.spendingType = dft.spendingType;
      if (!row.fundingSource) row.fundingSource = 'Monthly Cash Flow';
    }
    return row;
  };
  const expense = (m, day, desc, amount, cat, sub, extra) => {
    const d = dateIn_(m, day);
    if (d > today) return null;
    const row = baseTx(d, desc, amount, 'Expense', Object.assign({ category: cat, subcategory: sub }, extra || {}));
    tx.push(row);
    return row;
  };

  months.forEach((m, mi) => {
    const isLastFull = mi === months.length - 2;
    const isCurrent = mi === months.length - 1;

    // paycheck deposits linked to Income
    income.filter(i => i.payDate.getMonth() === m.getMonth() && i.payDate.getFullYear() === m.getFullYear()).forEach(i => {
      tx.push(baseTx(i.payDate, 'Payroll deposit — ' + i.employer, Math.round(i._takeHome * 100) / 100, 'Income', {
        category: 'Income', subcategory: 'Salary', person: i.person, sourceIncomeId: i.id, recurring: true,
      }));
    });

    // fixed
    expense(m, 1, 'Rent — Sample Property Mgmt', 1650, 'Housing', 'Mortgage or Rent', { recurring: true });
    expense(m, 6, 'Sample Electric Co.', 140, 'Housing', 'Electric', { recurring: true });
    expense(m, 8, 'Sample Internet', 70, 'Housing', 'Internet', { recurring: true });
    expense(m, 12, 'Sample Wireless', 95, 'Housing', 'Cell Phone', { recurring: true });
    expense(m, 3, 'Sample Child Care Center', 900, 'Child Expenses', 'Child Care', { recurring: true });
    expense(m, 15, 'Sample Auto Insurance', 160, 'Insurance', 'Auto Insurance', { recurring: true });
    expense(m, 9, 'Sample Streaming', 15.99, 'Entertainment', 'Streaming Services', { recurring: true, accountId: 'ACC-003' });
    expense(m, 2, 'Sample Gym', 45, 'Health', 'Gym & Fitness', { recurring: true, person: 'Ben', hhPersonal: 'Personal' });

    // flexible
    expense(m, 2, 'Sample Grocery', 128.40, 'Food', 'Groceries');
    expense(m, 9, 'Sample Grocery', 96.15, 'Food', 'Groceries');
    expense(m, 16, 'Sample Grocery', 142.75, 'Food', 'Groceries');
    expense(m, 23, 'Sample Grocery', 110.30, 'Food', 'Groceries');
    expense(m, 5, 'Sample Cafe Dinner', 48.20, 'Food', 'Dining Out', { accountId: 'ACC-003' });
    expense(m, 19, 'Sample Pizza Delivery', 62.00, 'Food', 'Takeout & Delivery', { accountId: 'ACC-003' });
    expense(m, 4, 'Sample Fuel', 52.00, 'Transportation', 'Fuel');
    expense(m, 18, 'Sample Fuel', 49.50, 'Transportation', 'Fuel');
    expense(m, 11, 'Sample Coffee', 12.40, 'Food', 'Coffee & Snacks', { person: 'Ben', hhPersonal: 'Personal' });
    expense(m, 20, 'Sample Pharmacy', 34.00, 'Personal', 'Personal Care', { person: 'Valerie', hhPersonal: 'Personal' });
    expense(m, 13, 'Sample Kids Gymnastics', 40.00, 'Child Expenses', 'Activities');

    // savings allocations (not spending)
    if (dateIn_(m, 2) <= today) {
      tx.push(baseTx(dateIn_(m, 2), 'Transfer to Emergency Fund', 400, 'Savings', { category: 'Savings', subcategory: 'Emergency Fund', fundId: 'FUND-001', recurring: true }));
      tx.push(baseTx(dateIn_(m, 2), 'Transfer to Vacation Fund', 150, 'Savings', { category: 'Savings', subcategory: 'Sinking Fund Contribution', fundId: 'FUND-002', recurring: true }));
    }
    // debt payments (not spending; purchases were already expensed)
    if (dateIn_(m, 20) <= today) tx.push(baseTx(dateIn_(m, 20), 'Sample Credit Card payment', 350, 'Debt Payment', { category: 'Debt Payments', subcategory: 'Credit Card Payment', debtId: 'DEBT-003', recurring: true }));
    if (dateIn_(m, 25) <= today) tx.push(baseTx(dateIn_(m, 25), 'Sample Student Loan payment', 220, 'Debt Payment', { category: 'Debt Payments', subcategory: 'Student Loan Payment', debtId: 'DEBT-001', recurring: true, person: 'Ben' }));
    // plain account transfer (neither income nor spending)
    if (dateIn_(m, 21) <= today) tx.push(baseTx(dateIn_(m, 21), 'Checking → Savings (account transfer)', 500, 'Transfer', { notes: S + ' — account transfer, not a savings allocation' }));

    if (isLastFull) {
      // Split purchase: one bank transaction, three categories
      const parent = baseTx(dateIn_(m, 14), 'Sample Target — mixed purchase', 142.50, 'Split Parent', {
        accountId: 'ACC-003', splitRole: 'Parent', notes: S + ' — split parent (receipt split into 3 children)', receiptRef: 'receipt-sample-target.jpg',
      });
      tx.push(parent);
      [[62.50, 'Food', 'Groceries'], [48.00, 'Child Expenses', 'Supplies'], [32.00, 'Personal', 'Personal Care']].forEach(c => {
        tx.push(baseTx(parent.date, 'Sample Target — ' + c[2], c[0], 'Expense', Object.assign({
          accountId: 'ACC-003', splitRole: 'Child', parentTxId: parent.id, notes: S + ' — split child of ' + parent.id, spendingType: 'Flexible',
          category: c[1], subcategory: c[2],
        }, taxonomyDefaults_(c[1], c[2]), { spendingType: 'Flexible', fundingSource: 'Monthly Cash Flow' })));
      });
      // Refund reduces spending
      tx.push(baseTx(dateIn_(m, 17), 'Sample Grocery — returned item', 25.00, 'Refund', { category: 'Food', subcategory: 'Groceries', spendingType: 'Flexible', fundingSource: 'Monthly Cash Flow', needWant: 'Need', fixedVariable: 'Variable' }));
      // Planned irregular purchase funded from a sinking fund
      expense(m, 10, 'Sample Airline — spring trip', 480, 'Travel', 'Airfare', { fundingSource: 'Sinking Fund', fundId: 'FUND-002', accountId: 'ACC-003', notes: S + ' — planned irregular, paid from Vacation fund' });
      // Unexpected purchase funded from the emergency fund
      expense(m, 22, 'Sample Auto Repair — alternator', 325, 'Transportation', 'Repairs', { fundingSource: 'Emergency Fund', fundId: 'FUND-001', notes: S + ' — unexpected, paid from Emergency Fund' });
      // Soft-deleted duplicate
      const dup = expense(m, 9, 'Sample Grocery (duplicate import)', 96.15, 'Food', 'Groceries', { isDeleted: true, notes: S + ' — duplicate import, soft-deleted (excluded from every total)' });
      if (dup) dup.deletedAt = dateIn_(m, 10);
    }
    if (isCurrent && dateIn_(m, 3) <= today) {
      tx.push(baseTx(dateIn_(m, 3), 'SAMPLE MERCHANT 1234', 27.80, 'Expense', { status: 'Pending', notes: S + ' — intentionally uncategorized to show the review warning' }));
    }
  });

  /* ---- Recurring Payments ---- */
  const recurring = [
    { name: 'Rent — Sample Property Mgmt', paymentType: 'Bill', group: 'Housing', category: 'Housing', subcategory: 'Mortgage or Rent', amount: 1650, frequency: 'Monthly', dueDay: 1 },
    { name: 'Sample Electric Co.', paymentType: 'Bill', group: 'Utilities', category: 'Housing', subcategory: 'Electric', amount: 140, frequency: 'Monthly', dueDay: 6 },
    { name: 'Sample Internet', paymentType: 'Bill', group: 'Utilities', category: 'Housing', subcategory: 'Internet', amount: 70, frequency: 'Monthly', dueDay: 8 },
    { name: 'Sample Wireless', paymentType: 'Bill', group: 'Utilities', category: 'Housing', subcategory: 'Cell Phone', amount: 95, frequency: 'Monthly', dueDay: 12 },
    { name: 'Sample Child Care Center', paymentType: 'Bill', group: 'Other', category: 'Child Expenses', subcategory: 'Child Care', amount: 900, frequency: 'Monthly', dueDay: 3 },
    { name: 'Sample Auto Insurance', paymentType: 'Insurance Premium', group: 'Insurance', category: 'Insurance', subcategory: 'Auto Insurance', amount: 160, frequency: 'Monthly', dueDay: 15 },
    { name: 'Sample Streaming', paymentType: 'Subscription', group: 'Subscriptions', category: 'Entertainment', subcategory: 'Streaming Services', amount: 15.99, frequency: 'Monthly', dueDay: 9, accountId: 'ACC-003' },
    { name: 'Sample Gym', paymentType: 'Membership', group: 'Memberships', category: 'Health', subcategory: 'Gym & Fitness', amount: 45, frequency: 'Monthly', dueDay: 2, owner: 'Ben', hhPersonal: 'Personal' },
    { name: 'Sample Student Loan', paymentType: 'Loan Payment', group: 'Loans', category: 'Debt Payments', subcategory: 'Student Loan Payment', amount: 220, frequency: 'Monthly', dueDay: 25, owner: 'Ben' },
    { name: 'Sample Prime-style membership', paymentType: 'Subscription', group: 'Subscriptions', category: 'Personal', subcategory: 'Subscriptions', amount: 139, frequency: 'Annual', dueDay: 1, renewalDate: new Date(today.getFullYear() + 1, 2, 1) },
    { name: 'Sample Warehouse Club', paymentType: 'Membership', group: 'Memberships', category: 'Personal', subcategory: 'Subscriptions', amount: 65, frequency: 'Annual', dueDay: 1, renewalDate: new Date(today.getFullYear(), today.getMonth() + 1, 15) },
  ].map((r, i) => Object.assign({
    id: 'REC-' + String(i + 1).padStart(3, '0'), accountId: 'ACC-001', owner: 'Household', hhPersonal: 'Household', autoPay: true, active: true,
    nextPayment: r.frequency === 'Annual' ? r.renewalDate : nextDueDate_(r.dueDay), notes: S, matchSource: 'Description contains "' + r.name.split(' — ')[0] + '"',
  }, r));

  /* ---- Funds ---- */
  const funds = [
    { id: 'FUND-001', name: 'Emergency Fund', fundType: 'Emergency Fund', target: 15000, starting: 6000, plannedMonthly: 400 },
    { id: 'FUND-002', name: 'Vacation', fundType: 'Sinking Fund', target: 3000, starting: 1200, plannedMonthly: 150, targetDate: addMonths_(today, 7) },
    { id: 'FUND-003', name: 'Car Repairs & Maintenance', fundType: 'Sinking Fund', target: 2000, starting: 500, plannedMonthly: 100 },
    { id: 'FUND-004', name: 'Holiday Gifts', fundType: 'Sinking Fund', target: 1200, starting: 300, plannedMonthly: 150, targetDate: today.getMonth() >= 11 ? new Date(today.getFullYear() + 1, 11, 1) : new Date(today.getFullYear(), 11, 1) },
    { id: 'FUND-005', name: 'Home Maintenance', fundType: 'Sinking Fund', target: 2500, starting: 800, plannedMonthly: 100 },
  ].map(f => Object.assign({ notes: S }, f));

  /* ---- Debts & Quarterly Debt Review ---- */
  const debts = [
    { id: 'DEBT-001', name: 'Sample Student Loan', debtType: 'Student Loan', lender: 'Sample Loan Servicer', owner: 'Ben', originalBalance: 18000, apr: 0.062, minPayment: 220, dueDay: 25 },
    { id: 'DEBT-002', name: 'Sample Auto Loan', debtType: 'Auto Loan', lender: 'Sample Auto Finance', owner: 'Household', originalBalance: 14500, apr: 0.059, minPayment: 310, dueDay: 12 },
    { id: 'DEBT-003', name: 'Sample Credit Card', debtType: 'Credit Card', lender: 'Sample Card Co.', owner: 'Household', originalBalance: 2400, apr: 0.2299, minPayment: 75, dueDay: 20, linkedAccount: 'ACC-003' },
  ].map(d => Object.assign({ notes: S + ' — replace with real debts' }, d));

  const qEnds = lastQuarterEnds_(3);
  const qdrSpec = {
    'DEBT-001': { beginning: 12800, payments: 660, interestFees: 195, adjustments: 0 },
    'DEBT-002': { beginning: 9600, payments: 930, interestFees: 135, adjustments: 0 },
    'DEBT-003': { beginning: 2300, payments: 1050, interestFees: 110, adjustments: 850 },
  };
  const qdr = [];
  Object.keys(qdrSpec).forEach(debtId => {
    let bal = qdrSpec[debtId].beginning;
    qEnds.forEach(qe => {
      const s = qdrSpec[debtId];
      const q = Math.ceil((qe.getMonth() + 1) / 3);
      qdr.push({ id: 'QDR-' + qe.getFullYear() + 'Q' + q + '-' + debtId, quarterEnd: qe, debtId, beginning: bal, payments: s.payments, interestFees: s.interestFees, adjustments: s.adjustments, notes: S });
      bal = Math.max(bal - s.payments + s.interestFees + s.adjustments, 0);
    });
  });

  /* ---- Budgets, plans, reviews, net worth ---- */
  const budgetSpec = [['Housing', 1960], ['Food', 650], ['Transportation', 150], ['Child Expenses', 1000], ['Health', 60], ['Personal', 100], ['Entertainment', 40], ['Insurance', 160]];
  const budgets = [];
  months.forEach((m, mi) => {
    budgetSpec.forEach(b => budgets.push({ month: m, category: b[0], planned: b[1], notes: S }));
    if (mi === months.length - 2) budgets.push({ month: m, category: 'Travel', planned: 500, notes: S + ' — planned trip paid from Vacation fund' });
  });
  const plans = months.map(m => ({ month: m, target: 950, notes: S }));
  const reviews = months.map((m, mi) => {
    const status = mi < 2 ? 'Complete' : (mi === 2 ? 'In Progress' : 'Not Started');
    return {
      month: m, status, notes: S,
      wentWell: status === 'Complete' ? 'Stayed under the flexible target; savings transfers went out on time.' : '',
      adjust: status === 'Complete' ? 'Dining out crept up in week 3.' : '',
      focus: status === 'Complete' ? 'Keep groceries under $500.' : '',
      reviewedBy: status === 'Complete' ? 'Household' : '', reviewedOn: status === 'Complete' ? dateIn_(addMonths_(m, 1), 3) : '',
    };
  });
  const netWorth = [
    { month: months[0], cash: 3900, savings: 9000, retirement: 40000, investments: 6000, property: 0, totalDebt: 24700 },
    { month: months[1], cash: 4100, savings: 9400, retirement: 41000, investments: 6100, property: 0, totalDebt: 23900 },
    { month: months[2], cash: 4250, savings: 9800, retirement: 42000, investments: 6300, property: 0, totalDebt: 23100 },
  ].map(n => Object.assign({ notes: S }, n));

  return { income, tx, recurring, funds, debts, qdr, budgets, plans, reviews, netWorth };
}

/** Write the sample dataset into the workbook (tables must already exist). */
function writeSampleData_() {
  const d = sampleDataset_();
  writeRows_(tdef_('INCOME'), d.income.map(r => { const o = Object.assign({}, r); delete o._takeHome; return o; }), tdef_('INCOME').firstRow);
  writeRows_(tdef_('TX'), d.tx, tdef_('TX').firstRow);
  writeRows_(tdef_('RECUR'), d.recurring, tdef_('RECUR').firstRow);
  writeRows_(tdef_('FUNDS'), d.funds, tdef_('FUNDS').firstRow);
  writeRows_(tdef_('DEBTS'), d.debts, tdef_('DEBTS').firstRow);
  writeRows_(tdef_('QDR'), d.qdr, tdef_('QDR').firstRow);
  writeRows_(tdef_('BUDGET'), d.budgets, tdef_('BUDGET').firstRow);
  writeRows_(tdef_('PLAN'), d.plans, tdef_('PLAN').firstRow);
  writeRows_(tdef_('REVIEW'), d.reviews, tdef_('REVIEW').firstRow);
  writeRows_(tdef_('NW'), d.netWorth, tdef_('NW').firstRow);
  return d;
}

/** Tables whose sample rows can be identified by a Notes column starting with SAMPLE. */
const SAMPLE_TABLES = ['TX', 'INCOME', 'RECUR', 'FUNDS', 'DEBTS', 'QDR', 'BUDGET', 'PLAN', 'REVIEW', 'NW', 'ACCOUNTS'];

function isSampleRow_(def, row) {
  const notes = String(row.notes || '');
  if (notes.indexOf(HFT.SAMPLE_TAG) === 0) return true;
  if (def.key === 'TX' && row.createdBy === HFT.SAMPLE_USER) return true;
  return false;
}

/* ===================================================================== */
/* 80_QA.gs
/* ===================================================================== */
/**
 * Household Finance Tracker — 80_QA.gs
 * Phase 6: QA. Re-computes key totals in plain JavaScript from the raw
 * tables and compares them with what the sheet formulas produced, scans
 * every tab for formula errors, and checks structural rules.
 */

function runQA() {
  const report = qaReport_();
  const ok = report.failures === 0;
  const text = (ok ? 'QA PASSED' : 'QA FOUND ' + report.failures + ' PROBLEM(S)') + '\n\n' + report.lines.join('\n');
  try {
    const ss = ss_();
    const r1 = ss.getRangeByName('QA_LAST_RUN'); if (r1) r1.setValue(nowStamp_());
    const r2 = ss.getRangeByName('QA_LAST_RESULT'); if (r2) r2.setValue(ok ? 'PASS (' + report.checks + ' checks)' : 'FAIL — ' + report.failures + ' of ' + report.checks + ' checks');
  } catch (e) { /* App Setup may not exist yet */ }
  Logger.log(text);
  alert_('Finance Tracker QA', text.length > 6000 ? text.slice(0, 6000) + '\n…(truncated, see Logs)' : text);
  return report;
}

function qaReport_() {
  const lines = [];
  let checks = 0, failures = 0;
  const pass = (msg) => { checks++; lines.push('PASS  ' + msg); };
  const fail = (msg) => { checks++; failures++; lines.push('FAIL  ' + msg); };
  const info = (msg) => { lines.push('INFO  ' + msg); };
  const near = (a, b, tol) => Math.abs(Number(a || 0) - Number(b || 0)) <= (tol || 0.011);
  const money = (n) => '$' + Number(n || 0).toFixed(2);

  const ss = ss_();

  /* 1. formula errors on every tab */
  const errRe = /^#(REF!|VALUE!|DIV\/0!|N\/A|NAME\?|NUM!|ERROR!|NULL!)/;
  ss.getSheets().forEach(sh => {
    const rng = sh.getDataRange();
    const disp = rng.getDisplayValues();
    const hits = [];
    for (let r = 0; r < disp.length && hits.length < 5; r++) {
      for (let c = 0; c < disp[r].length; c++) {
        if (errRe.test(disp[r][c])) { hits.push(colLetter_(c + 1) + (r + 1) + '=' + disp[r][c]); if (hits.length >= 5) break; }
      }
    }
    if (hits.length) fail(sh.getName() + ': formula errors at ' + hits.join(', ')); else pass(sh.getName() + ': no formula errors');
  });

  /* 2. structure: no merged cells inside raw tables, headers intact, validations present */
  BUILD_ORDER.forEach(key => {
    const def = tdef_(key);
    const sh = ss.getSheetByName(def.sheet);
    if (!sh) { fail(def.sheet + ' is missing'); return; }
    const n = def.columns.length;
    const merged = sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, n).getMergedRanges();
    if (merged.length) fail(def.sheet + ': ' + merged.length + ' merged range(s) inside the raw table'); else pass(def.sheet + ': no merged cells in table');
    const hdr = sh.getRange(def.headerRow, 1, 1, n).getValues()[0];
    const bad = def.columns.filter((c, i) => hdr[i] !== c.h).map(c => c.h);
    if (bad.length) fail(def.sheet + ': header mismatch for ' + bad.join(', ')); else pass(def.sheet + ': ' + n + ' headers match schema');
    const missingDv = def.columns.filter((c, i) => c.v && !sh.getRange(def.firstRow, i + 1).getDataValidation()).map(c => c.h);
    if (missingDv.length) fail(def.sheet + ': dropdown/validation missing on ' + missingDv.join(', ')); else pass(def.sheet + ': validations present');
  });

  /* 3. independent recomputation from raw tables */
  const tx = readTable_(tdef_('TX'));
  const inc = readTable_(tdef_('INCOME'));
  const live = tx.filter(t => t.isDeleted !== true);
  const mk = (d) => (d instanceof Date) ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') : '';
  const sumWhere = (rows, pred, field) => rows.reduce((s, r) => s + (pred(r) ? Number(r[field] || 0) : 0), 0);
  const deletedCount = tx.length - live.length;
  info(tx.length + ' transactions read (' + deletedCount + ' soft-deleted, excluded from every total below)');

  const summary = readTable_(tdef_('SUMMARY')).filter(r => r.month instanceof Date);
  if (!summary.length) fail('Monthly Summary has no month rows'); else pass('Monthly Summary lists ' + summary.length + ' month(s)');
  summary.forEach(s => {
    const m = mk(s.month);
    const expSpend = sumWhere(live, t => mk(t.month) === m && t.type === 'Expense', 'amount') - sumWhere(live, t => mk(t.month) === m && t.type === 'Refund', 'amount');
    const expSav = sumWhere(live, t => mk(t.month) === m && t.type === 'Savings', 'amount');
    const expDebt = sumWhere(live, t => mk(t.month) === m && t.type === 'Debt Payment', 'amount');
    const expInc = sumWhere(inc, i => mk(i.month) === m, 'takeHome');
    const expDep = sumWhere(live, t => mk(t.month) === m && t.type === 'Income', 'amount');
    const expRet = sumWhere(inc, i => mk(i.month) === m, 'retirement');
    const problems = [];
    if (!near(s.spending, expSpend)) problems.push('Spending ' + money(s.spending) + ' ≠ ' + money(expSpend));
    if (!near(s.cashSavings, expSav)) problems.push('Cash Savings ' + money(s.cashSavings) + ' ≠ ' + money(expSav));
    if (!near(s.debtPayments, expDebt)) problems.push('Debt Payments ' + money(s.debtPayments) + ' ≠ ' + money(expDebt));
    if (!near(s.income, expInc)) problems.push('Income ' + money(s.income) + ' ≠ ' + money(expInc));
    if (!near(s.txIncomeDeposits, expDep)) problems.push('Deposits ' + money(s.txIncomeDeposits) + ' ≠ ' + money(expDep));
    if (!near(s.totalSavings, expSav + expRet)) problems.push('Total Savings ' + money(s.totalSavings) + ' ≠ ' + money(expSav + expRet));
    if (!near(s.cashRemaining, expInc - expSpend - expSav - expDebt)) problems.push('Cash Remaining mismatch');
    if (problems.length) fail('Monthly Summary ' + m + ': ' + problems.join('; ')); else pass('Monthly Summary ' + m + ': spending ' + money(expSpend) + ', savings ' + money(expSav) + ', debt ' + money(expDebt) + ', income ' + money(expInc));
  });

  /* 4. budgets */
  const budgets = readTable_(tdef_('BUDGET')).filter(b => b.month instanceof Date && b.category);
  let budgetBad = 0;
  budgets.forEach(b => {
    const m = mk(b.month);
    const exp = sumWhere(live, t => mk(t.month) === m && t.category === b.category && t.type === 'Expense', 'amount') - sumWhere(live, t => mk(t.month) === m && t.category === b.category && t.type === 'Refund', 'amount');
    if (!near(b.actual, exp)) { budgetBad++; if (budgetBad <= 3) fail('Monthly Budget ' + m + ' ' + b.category + ': Actual ' + money(b.actual) + ' ≠ ' + money(exp)); }
  });
  if (budgets.length && !budgetBad) pass('Monthly Budget: all ' + budgets.length + ' Actual values match (soft-deleted rows excluded)');

  /* 5. plans incl. weekly guidance */
  const plans = readTable_(tdef_('PLAN')).filter(p => p.month instanceof Date);
  const today = todayMidnight_();
  const curKey = mk(monthStart_(today));
  plans.forEach(p => {
    const m = mk(p.month);
    const isFlexExp = t => mk(t.month) === m && t.spendingType === 'Flexible' && t.type === 'Expense';
    const isFlexRef = t => mk(t.month) === m && t.spendingType === 'Flexible' && t.type === 'Refund';
    const exp = sumWhere(live, isFlexExp, 'amount') - sumWhere(live, isFlexRef, 'amount');
    if (!near(p.flexSpent, exp)) fail('Monthly Plan ' + m + ': Flexible Spent ' + money(p.flexSpent) + ' ≠ ' + money(exp));
    else pass('Monthly Plan ' + m + ': flexible spent ' + money(exp) + ', available ' + money(p.available));
    if (m === curKey) {
      const ms = monthStart_(today);
      const me = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const dow = (today.getDay() + 6) % 7; // Monday=0
      let ws = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);
      if (ws < ms) ws = ms;
      const we = new Date(Math.min(ws.getTime() + 6 * 86400000, me.getTime()));
      const inRange = (t, a, b) => t.date instanceof Date && t.date >= a && t.date <= b;
      const dayBefore = new Date(ws.getTime() - 86400000);
      const before = sumWhere(live, t => isFlexExp(t) && inRange(t, ms, dayBefore), 'amount') - sumWhere(live, t => isFlexRef(t) && inRange(t, ms, dayBefore), 'amount');
      const remaining = Math.max(Number(p.target || 0) - before, 0);
      const days = (d1, d2) => Math.round((d2 - d1) / 86400000) + 1;
      const expSuggested = remaining * days(ws, we) / days(ws, me);
      const expSpentWeek = sumWhere(live, t => isFlexExp(t) && inRange(t, ws, today), 'amount') - sumWhere(live, t => isFlexRef(t) && inRange(t, ws, today), 'amount');
      if (!near(p.suggestedWeek, expSuggested, 0.05)) fail('Monthly Plan (current month): Suggested This Week ' + money(p.suggestedWeek) + ' ≠ ' + money(expSuggested));
      else pass('Monthly Plan (current month): weekly guidance ' + money(expSuggested) + ' for Mon–Sun week, spent this week ' + money(expSpentWeek));
      if (!near(p.spentWeek, expSpentWeek)) fail('Monthly Plan (current month): Spent This Week ' + money(p.spentWeek) + ' ≠ ' + money(expSpentWeek));
    }
  });
  if (!plans.some(p => mk(p.month) === curKey)) info('No Monthly Plan row for the current month — Dashboard flexible section will say "No plan row".');

  /* 6. funds */
  readTable_(tdef_('FUNDS')).forEach(f => {
    const contrib = sumWhere(live, t => t.fundId === f.id && t.type === 'Savings', 'amount');
    const wd = sumWhere(live, t => t.fundId === f.id && t.type === 'Expense', 'amount') - sumWhere(live, t => t.fundId === f.id && t.type === 'Refund', 'amount');
    const exp = Number(f.starting || 0) + contrib - wd;
    if (!near(f.current, exp)) fail('Fund ' + f.id + ' ' + f.name + ': Current ' + money(f.current) + ' ≠ ' + money(exp));
    else pass('Fund ' + f.id + ' ' + f.name + ': current ' + money(exp) + ' (+' + money(contrib) + ' / −' + money(wd) + ')');
  });

  /* 7. debts vs quarterly review */
  const qdr = readTable_(tdef_('QDR')).filter(q => q.quarterEnd instanceof Date);
  readTable_(tdef_('DEBTS')).forEach(d => {
    const rows = qdr.filter(q => q.debtId === d.id).sort((a, b) => b.quarterEnd - a.quarterEnd);
    const exp = rows.length ? Number(rows[0].endingBalance || 0) : Number(d.originalBalance || 0);
    if (!near(d.latestBalance, exp)) fail('Debt ' + d.id + ': Latest Balance ' + money(d.latestBalance) + ' ≠ ' + money(exp));
    else pass('Debt ' + d.id + ' ' + d.name + ': latest balance ' + money(exp) + (rows.length ? ' from ' + mk(rows[0].quarterEnd) : ' (no review yet)'));
  });

  /* 8. splits */
  const parents = live.filter(t => t.splitRole === 'Parent');
  parents.forEach(p => {
    const kids = live.filter(t => t.parentTxId === p.id);
    const sum = kids.reduce((s, k) => s + Number(k.amount || 0), 0);
    if (p.type !== 'Split Parent') fail('Split parent ' + p.id + ' has Type ' + p.type);
    if (!near(p.splitDiff, Number(p.amount) - sum)) fail('Split parent ' + p.id + ': Split Difference ' + money(p.splitDiff) + ' ≠ ' + money(Number(p.amount) - sum));
    else if (!near(Number(p.amount) - sum, 0)) fail('Split parent ' + p.id + ' does not balance by ' + money(Number(p.amount) - sum));
    else pass('Split parent ' + p.id + ': ' + kids.length + ' children sum to ' + money(sum) + ' (difference 0.00); parent excluded from spending');
  });
  if (!parents.length) info('No split transactions to check.');

  /* 9. validation flags */
  const flagged = live.filter(t => String(t.validationFlag || '') !== '');
  const unexpected = flagged.filter(t => String(t.notes || '').toLowerCase().indexOf('intentionally') < 0);
  if (unexpected.length) fail(unexpected.length + ' transaction(s) carry a Validation Flag: ' + unexpected.slice(0, 5).map(t => t.id + ' (' + t.validationFlag + ')').join('; '));
  else pass('Validation Flags: ' + flagged.length + ' flagged row(s), all intentional' + (flagged.length ? ' — e.g. ' + flagged[0].id + ': ' + flagged[0].validationFlag : ''));

  /* 10. income linkage */
  const unlinked = inc.filter(i => i.linkedTx === 'Unlinked');
  info(inc.length + ' paychecks; ' + unlinked.length + ' without a linked deposit transaction');

  /* 11. dashboard */
  const dash = ss.getSheetByName(SHEETS.DASH);
  if (!dash) fail('Dashboard missing');
  else {
    const sel = dash.getRange(DASH.SELECTED_MONTH).getValue();
    const selKey = mk(sel);
    const selRow = summary.filter(s => mk(s.month) === selKey)[0];
    const gross = sumWhere(inc, i => mk(i.month) === selKey, 'gross');
    const take = sumWhere(inc, i => mk(i.month) === selKey, 'takeHome');
    const vals = dash.getRange('A6:H6').getValues()[0];
    const problems = [];
    if (!near(vals[0], gross)) problems.push('Gross card ' + money(vals[0]) + ' ≠ ' + money(gross));
    if (!near(vals[2], take)) problems.push('Take-Home card ' + money(vals[2]) + ' ≠ ' + money(take));
    if (selRow && !near(vals[4], selRow.spending)) problems.push('Spending card ≠ Monthly Summary');
    if (selRow && !near(vals[6], selRow.totalSavings)) problems.push('Total Savings card ≠ Monthly Summary');
    if (problems.length) fail('Dashboard cards (' + selKey + '): ' + problems.join('; ')); else pass('Dashboard cards match Income and Monthly Summary for ' + selKey);

    const groups = [['A', 'B', 'C', 'Ben'], ['D', 'E', 'F', 'Valerie'], ['G', 'H', 'I', null]];
    const hdrProblems = [];
    const fedProblems = [];
    groups.forEach(g => {
      const h = dash.getRange(g[0] + DASH.PAYROLL_HEADER + ':' + g[2] + DASH.PAYROLL_HEADER).getValues()[0];
      if (h[0] !== 'Deduction' || h[1] !== 'Amount' || h[2] !== '% of Gross') hdrProblems.push(g[3] || 'Household');
      const fed = dash.getRange(g[1] + DASH.PAYROLL_FIRST).getValue();
      const expFed = sumWhere(inc, i => mk(i.month) === selKey && (!g[3] || i.person === g[3]), 'fedTax');
      if (!near(fed, expFed)) fedProblems.push((g[3] || 'Household') + ' ' + money(fed) + ' ≠ ' + money(expFed));
      const tot = dash.getRange(g[1] + DASH.PAYROLL_TOTAL).getValue();
      const expTot = sumWhere(inc, i => mk(i.month) === selKey && (!g[3] || i.person === g[3]), 'totalDed');
      if (!near(tot, expTot)) fedProblems.push((g[3] || 'Household') + ' total ' + money(tot) + ' ≠ ' + money(expTot));
    });
    if (hdrProblems.length) fail('Payroll headers missing for ' + hdrProblems.join(', ')); else pass('Payroll Deductions: all three groups have Deduction | Amount | % of Gross headers');
    if (fedProblems.length) fail('Payroll Federal Tax / totals: ' + fedProblems.join('; ')); else pass('Payroll Deductions: Federal Tax and Total rows match Income for Ben, Valerie and Household');

    const flexLabel = dash.getRange('A' + DASH.FLEX_BAR).getDisplayValue();
    const expLabel = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM yyyy');
    if (flexLabel.indexOf(expLabel) < 0) fail('Current Flexible Spending label "' + flexLabel + '" does not name the current month'); else pass('Current Flexible Spending follows today\'s month (' + expLabel + ')');

    const credit = readTable_(tdef_('CREDIT')).filter(c => c.scoreDate instanceof Date && c.score !== '');
    [['Ben', DASH.CREDIT_BEN], ['Valerie', DASH.CREDIT_VAL]].forEach(p => {
      const rows = credit.filter(c => c.person === p[0]).sort((a, b) => b.scoreDate - a.scoreDate);
      const shown = dash.getRange('B' + p[1]).getValue();
      if (!rows.length) { if (shown === '') pass('Credit score ' + p[0] + ': no entries yet, Dashboard shows blank'); else fail('Credit score ' + p[0] + ': Dashboard shows ' + shown + ' but no entries exist'); }
      else if (Number(shown) === Number(rows[0].score)) pass('Credit score ' + p[0] + ': Dashboard shows latest (' + rows[0].score + ' on ' + mk(rows[0].scoreDate) + ')');
      else fail('Credit score ' + p[0] + ': Dashboard shows ' + shown + ' but latest is ' + rows[0].score);
    });
  }

  return { checks, failures, lines };
}

/* ===================================================================== */
/* 90_Main.gs
/* ===================================================================== */
/**
 * Household Finance Tracker — 90_Main.gs
 * Entry points: build/rebuild, custom menu, onEdit change-log trigger,
 * and the maintenance helpers (link deposits, split, snapshot, extend, clear sample).
 *
 * FIRST RUN: with a brand-new blank spreadsheet open, run buildWorkbookWithSample()
 * (or buildWorkbookEmpty()) from the Apps Script editor and authorize when asked.
 */

function buildWorkbookWithSample() { return buildWorkbook({ sample: true }); }
function buildWorkbookEmpty() { return buildWorkbook({ sample: false }); }

function buildWorkbook(options) {
  const opts = Object.assign({ sample: true }, options || {});
  const ss = ss_();
  const started = new Date();
  toast_('Building workbook… this takes a minute or two.', 'Finance Tracker');

  // Keep a scratch sheet so the spreadsheet is never empty while we rebuild.
  let scratch = ss.getSheetByName('_build');
  if (!scratch) scratch = ss.insertSheet('_build');
  ss.getSheets().forEach(sh => { if (sh.getName() !== '_build') ss.deleteSheet(sh); });
  ss.getNamedRanges().forEach(nr => nr.remove());
  TAB_ORDER.forEach(name => ss.insertSheet(name));

  // Phase 1 — reference tables
  buildCategories_();
  buildAccounts_(opts.sample);
  // Phase 2 — core raw tables
  buildCoreTables_();
  // Phase 3 — import / app infrastructure
  buildInfrastructureTables_();
  // Phase 4 — derived reporting
  buildDerivedTables_();
  // Phase 5 — dashboard & docs
  buildDashboard_();
  buildAppSetup_(opts.sample);
  buildSources_();
  buildStartHere_(opts.sample);
  // Sample data
  if (opts.sample) writeSampleData_();

  // Tab order, cleanup
  TAB_ORDER.forEach((name, i) => { ss.setActiveSheet(ss.getSheetByName(name)); ss.moveActiveSheet(i + 1); });
  ss.deleteSheet(ss.getSheetByName('_build'));
  if (ss.getName().indexOf('Untitled') === 0) ss.rename(HFT.TITLE);
  ss.setActiveSheet(ss.getSheetByName(SHEETS.DASH));
  SpreadsheetApp.flush();

  // Phase 6 — QA
  const qa = qaReport_();
  const secs = Math.round((new Date() - started) / 1000);
  const summary = 'Build finished in ' + secs + 's. QA: ' + (qa.failures === 0 ? 'all ' + qa.checks + ' checks passed.' : qa.failures + ' of ' + qa.checks + ' checks failed — open Finance Tracker → Run QA checks for details.');
  try {
    const r1 = ss.getRangeByName('QA_LAST_RUN'); if (r1) r1.setValue(new Date());
    const r2 = ss.getRangeByName('QA_LAST_RESULT'); if (r2) r2.setValue(qa.failures === 0 ? 'PASS (' + qa.checks + ' checks)' : 'FAIL — ' + qa.failures + ' of ' + qa.checks + ' checks');
  } catch (e) { /* ignore */ }
  Logger.log(summary + '\n' + qa.lines.join('\n'));
  toast_(summary, 'Finance Tracker');
  return { seconds: secs, qa };
}

/* ---------- menu ---------- */

function onOpen() {
  const ui = ui_();
  if (!ui) return;
  ui.createMenu('Finance Tracker')
    .addItem('Run QA checks', 'runQA')
    .addItem('Link income deposits to paychecks', 'linkIncomeDeposits')
    .addItem('Split a transaction…', 'splitTransactionPrompt')
    .addItem('Record net worth snapshot', 'recordNetWorthSnapshot')
    .addSeparator()
    .addItem('Extend formula rows (+500 per table)', 'extendFormulaRows')
    .addItem('Clear sample data…', 'clearSampleData')
    .addSeparator()
    .addItem('Rebuild workbook (destructive)…', 'rebuildWorkbookPrompt')
    .addToUi();
}

function rebuildWorkbookPrompt() {
  const ui = ui_();
  if (!ui) return buildWorkbook({ sample: true });
  const a = ui.alert('Rebuild workbook', 'This deletes EVERY tab and rebuilds the workbook from the script. All data in this spreadsheet will be lost.\n\nContinue?', ui.ButtonSet.YES_NO);
  if (a !== ui.Button.YES) return;
  const b = ui.alert('Sample data', 'Include tagged sample data so formulas and the Dashboard have something to show?', ui.ButtonSet.YES_NO_CANCEL);
  if (b === ui.Button.CANCEL) return;
  buildWorkbook({ sample: b === ui.Button.YES });
  ui.alert('Rebuild complete', 'The workbook was rebuilt. Review the QA result on App Setup.', ui.ButtonSet.OK);
}

/* ---------- onEdit: change log + timestamps ---------- */

function onEdit(e) {
  try {
    if (!e || !e.range) return;
    const sh = e.range.getSheet();
    const name = sh.getName();
    const key = Object.keys(TABLES).filter(k => TABLES[k].sheet === name && TABLES[k].logChanges)[0];
    if (!key) return;
    const def = TABLES[key];
    const r = e.range;
    if (r.getRow() < def.firstRow) return;
    const now = new Date();
    const who = userEmail_();
    if (!changeLogEnabled_()) { stampTx_(def, sh, r, e, now, who); return; }
    if (r.getNumRows() > 1 || r.getNumColumns() > 1) {
      appendChangeLog_({ table: key, recordId: '', field: r.getA1Notation(), action: 'Bulk Edit', notes: r.getNumRows() + 'x' + r.getNumColumns() + ' cells edited', user: who });
      return;
    }
    const col = r.getColumn();
    if (col > def.columns.length) return;
    const c = def.columns[col - 1];
    if (c.f || c.arrayFormula) return;
    const id = sh.getRange(r.getRow(), 1).getValue();
    const newVal = e.value === undefined ? r.getValue() : e.value;
    appendChangeLog_({ table: key, recordId: id, field: c.h, oldValue: e.oldValue === undefined ? '' : e.oldValue, newValue: newVal, action: 'Update', user: who });
    stampTx_(def, sh, r, e, now, who);
  } catch (err) { /* never block the user's edit */ }
}

function stampTx_(def, sh, r, e, now, who) {
  if (def.key !== 'TX' || r.getNumRows() > 1 || r.getNumColumns() > 1) return;
  const c = def.columns[r.getColumn() - 1];
  if (!c || c.key === 'updatedAt' || c.key === 'updatedBy' || c.key === 'deletedAt') return;
  const row = r.getRow();
  sh.getRange(row, colIndex_(def, 'updatedAt')).setValue(now);
  if (who) sh.getRange(row, colIndex_(def, 'updatedBy')).setValue(who);
  if (c.key === 'isDeleted') {
    const v = String(e.value === undefined ? r.getValue() : e.value).toUpperCase();
    sh.getRange(row, colIndex_(def, 'deletedAt')).setValue(v === 'TRUE' ? now : '');
  }
}

/* ---------- maintenance helpers ---------- */

/** Detect how far formulas currently extend (the sheet may have grown/shrunk since the build). */
function syncLastRow_(def) {
  const sh = getOrCreateSheet_(def.sheet);
  const fcol = def.columns.findIndex(c => c.f);
  if (fcol < 0) { def.lastRow = Math.max(def.lastRow, sh.getLastRow()); return def.lastRow; }
  const maxR = sh.getMaxRows();
  const formulas = sh.getRange(def.firstRow, fcol + 1, maxR - def.firstRow + 1, 1).getFormulas();
  let last = def.firstRow - 1;
  for (let i = formulas.length - 1; i >= 0; i--) if (formulas[i][0]) { last = def.firstRow + i; break; }
  def.lastRow = Math.max(last, def.firstRow);
  return def.lastRow;
}

function extendFormulaRows() {
  let n = 0;
  BUILD_ORDER.forEach(key => {
    const def = tdef_(key);
    syncLastRow_(def);
    extendTable_(def, def.lastRow + 500);
    n++;
  });
  alert_('Extend formula rows', 'Added 500 calculated rows to ' + n + ' tables.');
}

/** Fill Source Income ID on Income-type transactions that match exactly one paycheck. */
function linkIncomeDeposits() {
  const txDef = tdef_('TX'), incDef = tdef_('INCOME');
  const tx = readTable_(txDef);
  const inc = readTable_(incDef);
  const used = {};
  tx.forEach(t => { if (t.sourceIncomeId && t.isDeleted !== true) used[t.sourceIncomeId] = true; });
  const sh = getOrCreateSheet_(txDef.sheet);
  const col = colIndex_(txDef, 'sourceIncomeId');
  let linked = 0, ambiguous = 0, none = 0;
  const details = [];
  tx.filter(t => t.type === 'Income' && !t.sourceIncomeId && t.isDeleted !== true && t.date instanceof Date).forEach(t => {
    const cands = inc.filter(i => !used[i.id] && i.payDate instanceof Date
      && Math.abs(Number(i.takeHome) - Number(t.amount)) <= 0.01
      && Math.abs((i.payDate - t.date) / 86400000) <= 5
      && (!t.accountId || !i.depositAccount || i.depositAccount === t.accountId));
    if (cands.length === 1) {
      sh.getRange(t.__row, col).setValue(cands[0].id);
      used[cands[0].id] = true;
      linked++;
      details.push(t.id + ' → ' + cands[0].id);
      if (changeLogEnabled_()) appendChangeLog_({ table: 'TX', recordId: t.id, field: 'Source Income ID', oldValue: '', newValue: cands[0].id, action: 'Update', notes: 'linkIncomeDeposits' });
    } else if (cands.length > 1) ambiguous++; else none++;
  });
  alert_('Link income deposits', linked + ' deposit(s) linked.\n' + ambiguous + ' had more than one matching paycheck (link by hand).\n' + none + ' had no matching paycheck within 5 days.' + (details.length ? '\n\n' + details.slice(0, 20).join('\n') : ''));
}

/** Guided split: turn one bank transaction into a Split Parent with balanced children. */
function splitTransactionPrompt() {
  const ui = ui_();
  if (!ui) throw new Error('splitTransactionPrompt needs the Sheets UI.');
  const def = tdef_('TX');
  const sh = getOrCreateSheet_(def.sheet);
  const p1 = ui.prompt('Split a transaction', 'Transaction ID of the original bank transaction (e.g. TX-000123):', ui.ButtonSet.OK_CANCEL);
  if (p1.getSelectedButton() !== ui.Button.OK) return;
  const parentId = p1.getResponseText().trim();
  const row = findRowById_(def, parentId);
  if (row < 0) { ui.alert('Not found', 'No transaction with ID ' + parentId, ui.ButtonSet.OK); return; }
  const parent = {};
  const vals = sh.getRange(row, 1, 1, def.columns.length).getValues()[0];
  def.columns.forEach((c, i) => { parent[c.key] = vals[i]; });
  const p2 = ui.prompt('Child lines for ' + parentId + ' (' + Number(parent.amount).toFixed(2) + ')',
    'One child per line:  amount | Category | Subcategory | Spending Type (optional, default Flexible)\n\nExample:\n62.50 | Food | Groceries\n48 | Child Expenses | Supplies\n32 | Personal | Personal Care',
    ui.ButtonSet.OK_CANCEL);
  if (p2.getSelectedButton() !== ui.Button.OK) return;
  const lines = p2.getResponseText().split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) return;
  const children = [];
  let sum = 0;
  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split('|').map(s => s.trim());
    const amt = parseFloat(parts[0]);
    if (isNaN(amt) || !parts[1] || !parts[2]) { ui.alert('Could not read line ' + (i + 1), lines[i], ui.ButtonSet.OK); return; }
    let defaults = { needWant: '', fixedVariable: '', spendingType: 'Flexible' };
    try { defaults = taxonomyDefaults_(parts[1], parts[2]); } catch (e) { /* unknown pair: validation flag will show it */ }
    sum += amt;
    children.push({
      date: parent.date, description: String(parent.description) + ' — ' + parts[2], amount: amt, type: 'Expense',
      category: parts[1], subcategory: parts[2], accountId: parent.accountId, person: parent.person, hhPersonal: parent.hhPersonal,
      needWant: defaults.needWant, fixedVariable: defaults.fixedVariable, status: parent.status || 'Posted',
      notes: 'Split child of ' + parentId, createdAt: new Date(), createdBy: userEmail_() || 'split-helper',
      spendingType: parts[3] || defaults.spendingType || 'Flexible', fundingSource: parent.fundingSource || 'Monthly Cash Flow',
      splitRole: 'Child', parentTxId: parentId, receiptRef: parent.receiptRef,
    });
  }
  const diff = Number(parent.amount) - sum;
  if (Math.abs(diff) > 0.01) {
    const go = ui.alert('Children do not balance', 'Children total ' + sum.toFixed(2) + ' vs parent ' + Number(parent.amount).toFixed(2) + ' (difference ' + diff.toFixed(2) + ').\n\nCreate anyway? The parent will show "Split Does Not Balance" until fixed.', ui.ButtonSet.YES_NO);
    if (go !== ui.Button.YES) return;
  }
  syncLastRow_(def);
  let nextNum = parseInt(nextId_(def, 6).split('-')[1], 10);
  children.forEach(c => { c.id = 'TX-' + String(nextNum++).padStart(6, '0'); });
  writeRows_(def, children);
  sh.getRange(row, colIndex_(def, 'type')).setValue('Split Parent');
  sh.getRange(row, colIndex_(def, 'splitRole')).setValue('Parent');
  sh.getRange(row, colIndex_(def, 'updatedAt')).setValue(new Date());
  if (changeLogEnabled_()) {
    appendChangeLog_({ table: 'TX', recordId: parentId, field: 'Type', oldValue: parent.type, newValue: 'Split Parent', action: 'Split', notes: children.length + ' children: ' + children.map(c => c.id).join(', ') });
  }
  ui.alert('Split created', children.length + ' child rows added under ' + parentId + '. Difference: ' + diff.toFixed(2), ui.ButtonSet.OK);
}

/** Append (or refresh) this month's Net Worth Snapshot from Accounts + Debts. */
function recordNetWorthSnapshot() {
  const accounts = readTable_(tdef_('ACCOUNTS')).filter(a => a.includeNW === 'Yes');
  const debts = readTable_(tdef_('DEBTS'));
  const linked = {};
  debts.forEach(d => { if (d.linkedAccount) linked[d.linkedAccount] = true; });
  const sumType = (types) => accounts.filter(a => types.indexOf(a.accountType) >= 0).reduce((s, a) => s + Number(a.currentBalance || 0), 0);
  const unlinkedCC = accounts.filter(a => a.accountType === 'Credit Card' && !linked[a.id]).reduce((s, a) => s + Number(a.currentBalance || 0), 0);
  const unlinkedLoans = accounts.filter(a => a.accountType === 'Loan' && !linked[a.id]).reduce((s, a) => s + Number(a.currentBalance || 0), 0);
  const debtTotal = debts.reduce((s, d) => s + Number(d.latestBalance || 0), 0);
  const snap = {
    month: monthStart_(new Date()),
    cash: sumType(['Checking', 'Cash']),
    savings: sumType(['Savings', 'HSA']),
    retirement: sumType(['Retirement']),
    investments: sumType(['Investment']),
    property: sumType(['Property', 'Vehicle', 'Other']),
    otherDeprecated: '',
    totalDebt: unlinkedCC + unlinkedLoans + debtTotal,
    notes: 'Recorded ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + ' from Accounts + Debts' + (unlinkedLoans ? ' (includes ' + unlinkedLoans.toFixed(2) + ' of Loan-type accounts not in Debts)' : ''),
  };
  const def = tdef_('NW');
  const existing = readTable_(def).filter(r => r.month instanceof Date && r.month.getTime() === snap.month.getTime())[0];
  const ui = ui_();
  if (existing) {
    if (ui && ui.alert('Snapshot exists', 'A snapshot for this month already exists. Overwrite it?', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    writeRows_(def, [snap], existing.__row);
  } else {
    syncLastRow_(def);
    writeRows_(def, [snap]);
  }
  const nw = snap.cash + snap.savings + snap.retirement + snap.investments + snap.property - snap.totalDebt;
  alert_('Net worth snapshot recorded', 'Assets ' + (nw + snap.totalDebt).toFixed(2) + ' − debt ' + snap.totalDebt.toFixed(2) + ' = ' + nw.toFixed(2));
}

/** Remove every row tagged SAMPLE once real data is ready. */
function clearSampleData() {
  const ui = ui_();
  if (ui && ui.alert('Clear sample data', 'Delete every row whose Notes start with "SAMPLE" (and sample accounts ACC-001…ACC-005)? Real rows are kept.', ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const removed = {};
  SAMPLE_TABLES.forEach(key => {
    const def = tdef_(key);
    syncLastRow_(def);
    const sh = getOrCreateSheet_(def.sheet);
    const rows = readTable_(def).filter(r => isSampleRow_(def, r)).map(r => r.__row).sort((a, b) => b - a);
    if (!rows.length) return;
    // delete contiguous blocks from the bottom up
    let i = 0;
    while (i < rows.length) {
      let j = i;
      while (j + 1 < rows.length && rows[j + 1] === rows[j] - 1) j++;
      sh.deleteRows(rows[j], j - i + 1);
      i = j + 1;
    }
    // restore the formula/format rows that moved off the end
    const k = rows.length;
    sh.insertRowsAfter(sh.getMaxRows(), k);
    applyColumnRules_(def, def.lastRow - k + 1, def.lastRow);
    setNamedRange_('TBL_' + def.key, sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, def.columns.length));
    if (CF_BUILDERS[def.key]) CF_BUILDERS[def.key](sh, def);
    removed[def.sheet] = k;
  });
  const flag = ss_().getRangeByName('SETTING_SAMPLE_PRESENT');
  if (flag) flag.setValue(false);
  buildStartHere_(false);
  const lines = Object.keys(removed).map(s => s + ': ' + removed[s] + ' row(s)');
  alert_('Sample data cleared', lines.length ? lines.join('\n') : 'No sample rows found.');
}

/* ===================================================================== */
/* 95_Api.gs
/* ===================================================================== */
/**
 * Household Finance Tracker — 95_Api.gs
 * Web-app scaffold for the future browser UI.
 *
 *   Browser → JSON over HTTPS → doPost (this file) → raw Sheet tables
 *
 * Deploy: Apps Script editor → Deploy → New deployment → Web app
 *   (execute as: Me; access: Anyone with the link — the token below is the gate).
 * Then run setApiToken() once and copy the token it shows into the app's config.
 *
 * Request body (POST, JSON):
 *   { "token": "...", "action": "ping" }
 *   { "token": "...", "action": "list", "table": "TX", "includeDeleted": false }
 *   { "token": "...", "action": "append", "table": "TX", "record": { "date": "2026-11-07", "amount": 42.1, ... }, "user": "ben" }
 *   { "token": "...", "action": "update", "table": "TX", "id": "TX-000012", "changes": { "category": "Food" }, "user": "ben" }
 *   { "token": "...", "action": "softDelete", "table": "TX", "id": "TX-000012", "user": "ben" }
 *
 * The API never writes to Monthly Summary, Dashboard or any calculated column.
 */

const API_WRITABLE = ['INCOME', 'TX', 'RECUR', 'FUNDS', 'DEBTS', 'QDR', 'ACCOUNTS', 'CREDIT', 'BUDGET', 'PLAN', 'REVIEW', 'NW', 'STAGING'];
const API_REQUIRED = {
  INCOME: ['payDate', 'person', 'gross'],
  TX: ['date', 'amount', 'type'],
  RECUR: ['name', 'amount', 'frequency'],
  FUNDS: ['name', 'fundType'],
  DEBTS: ['name', 'debtType'],
  QDR: ['quarterEnd', 'debtId'],
  ACCOUNTS: ['name', 'accountType'],
  CREDIT: ['scoreDate', 'person', 'score'],
  BUDGET: ['month', 'category'],
  PLAN: ['month', 'target'],
  REVIEW: ['month'],
  NW: ['month'],
  STAGING: ['provider', 'date', 'amount'],
};
const API_ID_WIDTH = { TX: 6, STAGING: 6, INCOME: 4 };

function setApiToken() {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
  alert_('API token set', 'Store this token in your app\'s configuration — it is not shown again:\n\n' + token);
}

function doGet(e) {
  return json_({ ok: true, app: HFT.TITLE, schema: HFT.SCHEMA_VERSION, tables: Object.keys(TABLES), writable: API_WRITABLE });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Body must be JSON' }); }
  const token = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!token || body.token !== token) return json_({ ok: false, error: 'Unauthorized' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    switch (body.action) {
      case 'ping': return json_({ ok: true, time: new Date().toISOString(), schema: HFT.SCHEMA_VERSION });
      case 'list': return json_({ ok: true, rows: apiList_(body.table, body.includeDeleted === true) });
      case 'append': return json_({ ok: true, id: apiAppend_(body.table, body.record || {}, body.user) });
      case 'update': return json_({ ok: true, updated: apiUpdate_(body.table, body.id, body.changes || {}, body.user) });
      case 'softDelete': return json_({ ok: true, id: apiSoftDelete_(body.table, body.id, body.user) });
      default: return json_({ ok: false, error: 'Unknown action: ' + body.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function apiTable_(key) {
  if (!TABLES[key]) throw new Error('Unknown table: ' + key);
  return TABLES[key];
}

function apiWritable_(key) {
  const def = apiTable_(key);
  if (API_WRITABLE.indexOf(key) < 0) throw new Error(def.sheet + ' is read-only for the app');
  return def;
}

function apiSerialize_(def, row) {
  const o = {};
  def.columns.forEach(c => {
    const v = row[c.key];
    o[c.key] = (v instanceof Date) ? Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") : v;
  });
  o._row = row.__row;
  return o;
}

function apiCoerce_(def, record) {
  const out = {};
  def.columns.forEach(c => {
    if (c.f || c.arrayFormula) return; // calculated columns are never written
    if (!(c.key in record)) return;
    let v = record[c.key];
    if ((c.fmt === 'date' || c.fmt === 'datetime' || c.fmt === 'month') && typeof v === 'string' && v) {
      const d = new Date(v);
      if (isNaN(d.getTime())) throw new Error('Invalid date for ' + c.h + ': ' + v);
      v = c.fmt === 'month' ? new Date(d.getFullYear(), d.getMonth(), 1) : d;
    }
    if ((c.fmt === 'currency' || c.fmt === 'percent' || c.fmt === 'int') && v !== '' && v !== null && typeof v !== 'number') {
      const n = Number(v);
      if (isNaN(n)) throw new Error('Invalid number for ' + c.h + ': ' + v);
      v = n;
    }
    out[c.key] = v;
  });
  return out;
}

function apiList_(key, includeDeleted) {
  const def = apiTable_(key);
  let rows = readTable_(def);
  if (!includeDeleted && def.columns.some(c => c.key === 'isDeleted')) rows = rows.filter(r => r.isDeleted !== true);
  return rows.map(r => apiSerialize_(def, r));
}

function apiAppend_(key, record, user) {
  const def = apiWritable_(key);
  const rec = apiCoerce_(def, record);
  (API_REQUIRED[key] || []).forEach(f => { if (rec[f] === undefined || rec[f] === '') throw new Error('Missing required field: ' + f); });
  const idKey = def.columns[0].key;
  const idIsFormula = !!def.columns[0].f;
  if (!idIsFormula && !rec[idKey]) rec[idKey] = nextId_(def, API_ID_WIDTH[key] || 3);
  const now = new Date();
  if (key === 'TX') { rec.createdAt = rec.createdAt || now; rec.createdBy = rec.createdBy || user || 'api'; rec.status = rec.status || 'Posted'; }
  if (key === 'INCOME') rec.lastUpdated = now;
  if (key === 'ACCOUNTS' && rec.currentBalance !== undefined) rec.lastUpdated = now;
  syncLastRow_(def);
  writeRows_(def, [rec]);
  appendChangeLog_({ table: key, recordId: rec[idKey] || '', field: '(row)', newValue: JSON.stringify(rec).slice(0, 500), action: 'Insert', user: user || 'api' });
  return rec[idKey] || '';
}

function apiUpdate_(key, id, changes, user) {
  const def = apiWritable_(key);
  const row = findRowById_(def, id);
  if (row < 0) throw new Error('Record not found: ' + id);
  const sh = getOrCreateSheet_(def.sheet);
  const rec = apiCoerce_(def, changes);
  const updated = [];
  Object.keys(rec).forEach(k => {
    const col = colIndex_(def, k);
    if (k === def.columns[0].key) return; // IDs are immutable
    const cell = sh.getRange(row, col);
    const old = cell.getValue();
    cell.setValue(rec[k]);
    appendChangeLog_({ table: key, recordId: id, field: def.columns[col - 1].h, oldValue: old, newValue: rec[k], action: 'Update', user: user || 'api' });
    updated.push(k);
  });
  if (key === 'TX') {
    sh.getRange(row, colIndex_(def, 'updatedAt')).setValue(new Date());
    sh.getRange(row, colIndex_(def, 'updatedBy')).setValue(user || 'api');
  }
  return updated;
}

function apiSoftDelete_(key, id, user) {
  const def = apiWritable_(key);
  if (!def.columns.some(c => c.key === 'isDeleted')) throw new Error(def.sheet + ' has no Is Deleted column; soft delete is only defined for Transactions');
  const row = findRowById_(def, id);
  if (row < 0) throw new Error('Record not found: ' + id);
  const sh = getOrCreateSheet_(def.sheet);
  sh.getRange(row, colIndex_(def, 'isDeleted')).setValue(true);
  sh.getRange(row, colIndex_(def, 'deletedAt')).setValue(new Date());
  sh.getRange(row, colIndex_(def, 'updatedAt')).setValue(new Date());
  sh.getRange(row, colIndex_(def, 'updatedBy')).setValue(user || 'api');
  appendChangeLog_({ table: key, recordId: id, field: 'Is Deleted', oldValue: false, newValue: true, action: 'Soft Delete', user: user || 'api' });
  return id;
}

