/**
 * Household Finance Tracker — Config.gs
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
  SCHEMA_VERSION: '3.3-interest-pause-2026-11-09',
  BUILD_VERSION: '1.3.0',
  REPO_URL: 'https://github.com/howardbe517-sudo/household-finance-tracker',
  PERSONS: ['Ben', 'Valerie'],
  SAMPLE_TAG: 'SAMPLE',
  SAMPLE_USER: 'sample-data',
};

const SHEETS = {
  START: 'Start Here',
  DASH: 'Dashboard',
  GOALS: 'Goals',
  REMINDERS: 'Reminders',
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
  RULES: 'Import Rules',
  CONN: 'Connections',
  LOG: 'Change Log',
  CREDIT: 'Credit Scores',
};

const TAB_ORDER = [
  // The owner's order (2026-11-09): the three tabs looked at most first, then goals and reminders,
  // the ledgers and derived tables, and the setup and feed tabs at the end.
  SHEETS.DASH, SHEETS.FUNDS, SHEETS.DEBTS, SHEETS.GOALS, SHEETS.REMINDERS,
  SHEETS.INCOME, SHEETS.TX, SHEETS.RECUR, SHEETS.BUDGET, SHEETS.PLAN, SHEETS.SUMMARY,
  SHEETS.QDR, SHEETS.NW, SHEETS.REVIEW, SHEETS.CREDIT, SHEETS.CATS,
  SHEETS.START, SHEETS.SETUP, SHEETS.SOURCES, SHEETS.STAGING, SHEETS.RULES, SHEETS.CONN,
  SHEETS.ACCOUNTS, SHEETS.LOG,
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
  { key: 'ACCOUNT_TYPES', header: 'Account Types', values: ['Checking', 'Savings', 'Cash', 'Credit Card', 'Investment', 'Retirement', 'HSA', 'Loan', 'Property', 'Vehicle', 'Other', 'Pension'] },
  { key: 'INCOME_TYPES', header: 'Income Types', values: ['Salary', 'Hourly Wages', 'Bonus', 'Commission', 'Side Income', 'Reimbursement', 'Other'] },
  { key: 'FUND_TYPES', header: 'Fund Types', values: ['Emergency Fund', 'Sinking Fund', 'Short-Term Goal', 'Retirement', 'Education', 'Other'] },
  { key: 'DEBT_TYPES', header: 'Debt Types', values: ['Credit Card', 'Student Loan', 'Auto Loan', 'Mortgage', 'Personal Loan', 'Medical', 'Tax Debt', 'Other'] },
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
  { key: 'DEBT_GROUPS', header: 'Debt Groups', values: ['Household', 'Student Loans'] },
  { key: 'MATCH_TYPES', header: 'Rule Match Types', values: ['Contains', 'Starts With', 'Exact'] },
  { key: 'STAGING_STATUSES', header: 'Import Statuses', values: ['Needs Review', 'Needs Split', 'Ready', 'Imported', 'Ignored', 'Superseded', 'Removed'] },
  { key: 'CONNECTION_STATUSES', header: 'Connection Statuses', values: ['Active', 'Needs Attention', 'Disconnected', 'Pending'] },
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
    { key: 'externalAccountId', h: 'External Account ID', w: 200,
      note: 'Added in 3.1: the bank feed\'s own ID for this account (Plaid account_id). Filled when a connection is finished; links synced transactions to this row.' },
    { key: 'connectionId', h: 'Connection ID', w: 110, v: { idsOf: 'CONN' },
      note: 'Added in 3.1: the Connections row (bank login) this account belongs to.' },
    { key: 'importTx', h: 'Import Transactions?', w: 110, v: { checkbox: true },
      note: 'Added in 3.1: ticked = the sync lands this account\'s transactions in Import Staging; unticked = balance only (Acorns, Fidelity, HSA).' },
    { key: 'lastSynced', h: 'Last Synced', w: 130, fmt: C.dt,
      note: 'Added in 3.1: when the bank feed last updated this balance.' },
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
  note: 'One row per debt. Latest Balance comes from the linked account\'s nightly balance when there is one, else the newest Quarterly Debt Review, else Original Balance. For linked cards and loans the bank feed also fills the rate, minimum payment, due day and next due date. PSLF: type the official count from studentaid.gov now and then; the tracker counts payments since.',
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
      f: '=IF([@id]="","",LET(q,MAXIFS([QDR.quarterEnd],[QDR.debtId],[@id]),ab,IFERROR(INDEX([ACCOUNTS.currentBalance],MATCH([@linkedAccount],[ACCOUNTS.id],0)),""),ad,IFERROR(N(INDEX([ACCOUNTS.lastUpdated],MATCH([@linkedAccount],[ACCOUNTS.id],0))),0),' +
         'IF(AND([@linkedAccount]<>"",ISNUMBER(ab),ad>=q),ab,IF(q=0,N([@originalBalance]),SUMIFS([QDR.endingBalance],[QDR.debtId],[@id],[QDR.quarterEnd],q)))))',
      note: 'Changed in 3.1: when the debt is linked to an account whose balance is newer than the last quarterly review (e.g. a card or loan synced by the bank feed), that live balance is shown; otherwise the latest review; otherwise the original balance.' },
    { key: 'balanceAsOf', h: 'Balance As Of', w: 110, fmt: C.date,
      f: '=IF([@id]="","",LET(q,MAXIFS([QDR.quarterEnd],[QDR.debtId],[@id]),ab,IFERROR(INDEX([ACCOUNTS.currentBalance],MATCH([@linkedAccount],[ACCOUNTS.id],0)),""),ad,IFERROR(N(INDEX([ACCOUNTS.lastUpdated],MATCH([@linkedAccount],[ACCOUNTS.id],0))),0),' +
         'IF(AND([@linkedAccount]<>"",ISNUMBER(ab),ad>=q),IF(ad=0,"Linked account",ad),IF(q=0,"No review yet",q))))',
      note: 'Date of the balance shown: the linked account\'s Last Updated, or the review\'s Quarter End.' },
    { key: 'targetPayoff', h: 'Target Payoff Date', w: 115, fmt: C.date, v: { date: true } },
    { key: 'linkedAccount', h: 'Linked Account ID', w: 115, v: { idsOf: 'ACCOUNTS' } },
    { key: 'notes', h: 'Notes', w: 220 },
    { key: 'estMonthlyInterest', h: 'Estimated Monthly Interest', w: 130, fmt: C.cur,
      f: '=IF([@id]="","",IF(AND([@interestPaused]=TRUE,OR([@pausedUntil]="",[@pausedUntil]>=TODAY())),0,N([@latestBalance])*N([@apr])/12))',
      note: 'Changed in 3.3: 0 while Interest Paused? is ticked (and Paused Until, if set, has not passed).' },
    { key: 'estAnnualInterest', h: 'Estimated Annual Interest', w: 130, fmt: C.cur,
      f: '=IF([@id]="","",IF(AND([@interestPaused]=TRUE,OR([@pausedUntil]="",[@pausedUntil]>=TODAY())),0,N([@latestBalance])*N([@apr])))' },
    { key: 'group', h: 'Debt Group', w: 110, v: { list: 'DEBT_GROUPS' },
      note: 'Added in 3.1: Household or Student Loans. Student loans are totalled separately everywhere (they would swamp the household total); net worth still counts both.' },
    { key: 'nextDue', h: 'Next Payment Due', w: 110, fmt: C.date,
      note: 'Added in 3.2: written by the bank feed (Plaid Liabilities) where the lender provides it. The feed also fills Interest Rate, Minimum Payment and Due Day for linked cards and loans.' },
    { key: 'lastPayment', h: 'Last Payment (feed)', w: 150, note: 'Added in 3.2: date and amount of the last payment the lender reported.' },
    { key: 'loanStatus', h: 'Loan Status / Plan', w: 180, note: 'Added in 3.2: repayment plan and status reported by a student loan servicer; Current or Overdue for a card.' },
    { key: 'pslfOfficial', h: 'PSLF Official Count', w: 110, fmt: C.int,
      note: 'Added in 3.2: the qualifying-payment count shown on studentaid.gov the last time you checked. Entered by hand (there is no feed for it); the tracker counts payments made since.' },
    { key: 'pslfAsOf', h: 'PSLF Count As Of', w: 110, fmt: C.date, v: { date: true }, note: 'Added in 3.2: the date that official count was read.' },
    { key: 'pslfSince', h: 'Payments Since Count', w: 110, fmt: C.int,
      f: '=IF(OR([@id]="",[@pslfOfficial]=""),"",IFERROR(ROWS(UNIQUE(FILTER([TX.month],[TX.debtId]=[@id],[TX.type]="Debt Payment",[TX.isDeleted]<>TRUE,[TX.date]>N([@pslfAsOf])))),0))',
      note: 'Added in 3.2: months with a Debt Payment to this debt after the as-of date (one per month, as PSLF counts them).' },
    { key: 'pslfEstimated', h: 'PSLF Estimated Count', w: 110, fmt: C.int, f: '=IF(OR([@id]="",[@pslfOfficial]=""),"",N([@pslfOfficial])+N([@pslfSince]))',
      note: 'Added in 3.2: official count + payments since. An estimate until studentaid.gov confirms it.' },
    { key: 'pslfRemaining', h: 'PSLF Remaining (of 120)', w: 120, fmt: C.int, f: '=IF([@pslfEstimated]="","",MAX(120-[@pslfEstimated],0))' },
    { key: 'feedUpdated', h: 'Feed Updated', w: 130, fmt: C.dt, note: 'Added in 3.2: when the bank feed last wrote lender data to this row.' },
    { key: 'interestPaused', h: 'Interest Paused?', w: 95, v: { checkbox: true },
      note: 'Added in 3.3: tick while a debt is in forbearance, a 0% period or any relief that stops interest. The estimated interest for the row drops to 0 (the band and the AI snapshot follow); the balance and payments are unaffected.' },
    { key: 'pausedUntil', h: 'Paused Until', w: 110, fmt: C.date, v: { date: true },
      note: 'Added in 3.3: optional end date of the pause. After it passes, interest counts again by itself; leave blank for an open-ended pause.' },
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
    { key: 'group', h: 'Debt Group', w: 110,
      f: '=IF([@debtId]="","",IFERROR(INDEX([DEBTS.group],MATCH([@debtId],[DEBTS.id],0)),"Household"))',
      note: 'Added in 3.1: copied from the Debts row so monthly totals can keep student loans separate.' },
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
    { key: 'status', h: 'Status', w: 110, v: { list: 'STAGING_STATUSES' },
      note: 'Added in 3.1: Needs Review → tick Reviewed? → Import reviewed rows → Imported. Needs Split rows go through the split panel. Superseded = replaced by the posted version of a pending charge.' },
    { key: 'suggestedType', h: 'Suggested Type', w: 110, v: { list: 'TRANSACTION_TYPES' }, note: 'Added in 3.1.' },
    { key: 'suggestedPerson', h: 'Suggested Person', w: 110, v: { list: 'OWNERS' }, note: 'Added in 3.1.' },
    { key: 'suggestedFundId', h: 'Suggested Fund ID', w: 110, v: { idsOf: 'FUNDS' }, note: 'Added in 3.1.' },
    { key: 'suggestedDebtId', h: 'Suggested Debt ID', w: 110, v: { idsOf: 'DEBTS' }, note: 'Added in 3.1.' },
    { key: 'ruleId', h: 'Matched Rule ID', w: 110, v: { idsOf: 'RULES' }, note: 'Added in 3.1: the Import Rules row that filled the suggestions.' },
    { key: 'merchantName', h: 'Merchant (from bank)', w: 160, note: 'Added in 3.1: the cleaned merchant name the bank feed supplies; used by rules.' },
    { key: 'bankCategory', h: 'Bank Category', w: 160, note: 'Added in 3.1: the feed\'s own category guess, for reference only.' },
    { key: 'pendingTxId', h: 'Pending Transaction ID', w: 170, note: 'Added in 3.1: for a posted charge, the ID of the pending charge it replaces.' },
    { key: 'pairedImportId', h: 'Paired Import ID', w: 120, note: 'Added in 3.1: the other side of a detected transfer or card payment.' },
    { key: 'importedAt', h: 'Imported At', w: 130, fmt: C.dt, note: 'Added in 3.1.' },
  ],
};

TABLES.RULES = {
  key: 'RULES', sheet: SHEETS.RULES, headerRow: 4, firstRow: 5, lastRow: 204,
  title: 'Import Rules — How Bank Descriptions Become Categories',
  note: 'One row per pattern. A synced transaction whose description or merchant matches gets the Type, Category, Subcategory and Spending Type below. Auto-import? sends it straight to Transactions; otherwise it waits in Import Staging pre-filled. Split Required? always holds it for the split panel. Make rules from Import Staging with Finance Tracker → Make a rule from this row.',
  idPrefix: 'RULE', idPattern: 'RULE-001', logChanges: true,
  columns: [
    { key: 'id', h: 'Rule ID', w: 95 },
    { key: 'pattern', h: 'Match Text', w: 220 },
    { key: 'matchType', h: 'Match Type', w: 100, v: { list: 'MATCH_TYPES' } },
    { key: 'accountId', h: 'Account ID (optional)', w: 120, v: { idsOf: 'ACCOUNTS' } },
    { key: 'type', h: 'Type', w: 110, v: { list: 'TRANSACTION_TYPES' } },
    { key: 'category', h: 'Category', w: 130, v: { derived: 'ALL_CATEGORIES' } },
    { key: 'subcategory', h: 'Subcategory', w: 170, v: { derived: 'ALL_SUBCATEGORIES' } },
    { key: 'spendingType', h: 'Spending Type', w: 120, v: { list: 'SPENDING_TYPES' } },
    { key: 'person', h: 'Person', w: 95, v: { list: 'OWNERS' } },
    { key: 'fundId', h: 'Fund ID', w: 95, v: { idsOf: 'FUNDS' } },
    { key: 'debtId', h: 'Debt ID', w: 95, v: { idsOf: 'DEBTS' } },
    { key: 'autoImport', h: 'Auto-import?', w: 90, v: { checkbox: true } },
    { key: 'splitRequired', h: 'Split Required?', w: 100, v: { checkbox: true } },
    { key: 'active', h: 'Active?', w: 70, v: { checkbox: true } },
    { key: 'matches', h: 'Matches', w: 80, fmt: C.int, f: '=IF([@id]="","",COUNTIF([STAGING.ruleId],[@id]))' },
    { key: 'createdAt', h: 'Created At', w: 130, fmt: C.dt },
    { key: 'notes', h: 'Notes', w: 220 },
  ],
};

TABLES.CONN = {
  key: 'CONN', sheet: SHEETS.CONN, headerRow: 4, firstRow: 5, lastRow: 54,
  title: 'Connections — Bank Logins Feeding the Tracker',
  note: 'One row per bank login connected through Plaid. Each uses one of the free Trial slots (20 on your plan) permanently, so repairs always use the Repair action (never disconnect and reconnect). Access tokens are kept in the script\'s Script Properties, never on this tab.',
  idPrefix: 'CONN', idPattern: 'CONN-001', logChanges: true,
  columns: [
    { key: 'id', h: 'Connection ID', w: 110 },
    { key: 'institution', h: 'Institution', w: 200 },
    { key: 'itemId', h: 'Plaid Item ID', w: 220 },
    { key: 'products', h: 'Products', w: 150 },
    { key: 'status', h: 'Status', w: 120, v: { list: 'CONNECTION_STATUSES' } },
    { key: 'accountsLinked', h: 'Accounts Linked', w: 100, fmt: C.int, f: '=IF([@id]="","",COUNTIF([ACCOUNTS.connectionId],[@id]))' },
    { key: 'lastSync', h: 'Last Sync', w: 130, fmt: C.dt },
    { key: 'lastResult', h: 'Last Result', w: 260 },
    { key: 'lastError', h: 'Last Error', w: 300 },
    { key: 'syncCursor', h: 'Sync Cursor', w: 120 },
    { key: 'addedOn', h: 'Added On', w: 110, fmt: C.date },
    { key: 'notes', h: 'Notes', w: 220 },
    { key: 'liabilities', h: 'Liabilities Feed', w: 220, note: 'Added in 3.2: whether Plaid supplies rates, minimum payments and due dates for this login (Yes, or Not available with the reason).' },
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
    { key: 'reviewedDebt', h: 'Reviewed Household Debt', w: 120, fmt: C.cur, renamedFrom: 'Reviewed Debt Balance',
      f: '=IF([@month]="","",IF(MAXIFS([QDR.quarterEnd],[QDR.quarterEnd],"<="&EOMONTH([@month],0))=0,"",SUMIFS([QDR.endingBalance],[QDR.quarterEnd],MAXIFS([QDR.quarterEnd],[QDR.quarterEnd],"<="&EOMONTH([@month],0)),[QDR.group],"<>Student Loans")))',
      note: 'Changed in 3.1: excludes debts in the Student Loans group (see the Student Loan Balance column).' },
    { key: 'netWorthSnapshot', h: 'Net Worth Snapshot', w: 120, fmt: C.cur,
      f: '=IF([@month]="","",IFERROR(INDEX([NW.netWorth],MATCH([@month],[NW.month],0)),""))' },
    { key: 'retirement', h: 'Retirement Savings', w: 110, fmt: C.cur, f: '=IF([@month]="","",SUMIFS([INCOME.retirement],[INCOME.month],[@month]))' },
    { key: 'totalSavings', h: 'Total Savings', w: 105, fmt: C.cur, f: '=IF([@month]="","",[@cashSavings]+[@retirement])' },
    { key: 'totalSavingsRate', h: 'Total Savings Rate of Gross', w: 125, fmt: C.pct,
      f: '=IF(OR([@month]="",SUMIFS([INCOME.gross],[INCOME.month],[@month])=0),"",[@totalSavings]/SUMIFS([INCOME.gross],[INCOME.month],[@month]))' },
    { key: 'txIncomeDeposits', h: 'Transaction Income Deposits', w: 130, fmt: C.cur,
      f: '=IF([@month]="","",SUMIFS([TX.amount],[TX.month],[@month],[TX.type],"Income",[TX.isDeleted],"<>TRUE"))' },
    { key: 'incomeReconciliation', h: 'Income Reconciliation', w: 120, fmt: C.cur, f: '=IF([@month]="","",[@txIncomeDeposits]-[@income])' },
    { key: 'studentLoans', h: 'Student Loan Balance', w: 120, fmt: C.cur,
      f: '=IF([@month]="","",IF(MAXIFS([QDR.quarterEnd],[QDR.quarterEnd],"<="&EOMONTH([@month],0))=0,"",SUMIFS([QDR.endingBalance],[QDR.quarterEnd],MAXIFS([QDR.quarterEnd],[QDR.quarterEnd],"<="&EOMONTH([@month],0)),[QDR.group],"Student Loans")))',
      note: 'Added in 3.1: the Student Loans group from the latest Quarterly Debt Review, kept apart from household debt.' },
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
    { key: 'totalDebt', h: 'Household Debt Balance', w: 115, fmt: C.cur, renamedFrom: 'Total Debt Balance', f: '=IF([@month]="","",IFERROR(INDEX([SUMMARY.reviewedDebt],MATCH([@month],[SUMMARY.month],0)),""))',
      note: 'Changed in 3.1: household debt only; student loans have their own column.' },
    { key: 'wentWell', h: 'What Went Well', w: 240 },
    { key: 'adjust', h: 'What to Adjust', w: 240 },
    { key: 'focus', h: 'Next Month Focus', w: 240 },
    { key: 'reviewedBy', h: 'Reviewed By', w: 100, v: { list: 'OWNERS' } },
    { key: 'reviewedOn', h: 'Reviewed On', w: 105, fmt: C.date, v: { date: true } },
    { key: 'notes', h: 'Notes', w: 200 },
    { key: 'studentLoans', h: 'Student Loan Balance', w: 120, fmt: C.cur, f: '=IF([@month]="","",IFERROR(INDEX([SUMMARY.studentLoans],MATCH([@month],[SUMMARY.month],0)),""))',
      note: 'Added in 3.1.' },
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
const BUILD_ORDER = ['CATS', 'ACCOUNTS', 'INCOME', 'TX', 'RECUR', 'FUNDS', 'DEBTS', 'QDR', 'CREDIT', 'STAGING', 'RULES', 'CONN', 'LOG', 'BUDGET', 'PLAN', 'SUMMARY', 'REVIEW', 'NW'];

/** Script Properties used by the bank feed (values are set by hand or by the connect flow; never in code). */
/**
 * The accounts block at the top of the Dashboard (the owner's choice, 2026-11-09): checking and
 * savings on the left, the credit cards on the right in this order. Each line sums the Accounts
 * rows whose institution contains the text and whose type matches. Edit here to change the block.
 */
const DASH_ACCOUNTS = {
  main: [
    { label: 'Checking', sub: 'Independent Bank', type: 'Checking', institution: 'Independent Bank' },
    { label: 'Savings', sub: 'Independent Bank', type: 'Savings', institution: 'Independent Bank' },
  ],
  cards: ['Independent Bank', 'American Express', 'Capital One'],
};

// Plaid's free Trial cap on connected institutions (the dashboard's "connections"), as shown on the owner's plan page.
const PLAID_TRIAL_LIMIT = 20;

const PLAID_PROPS = {
  CLIENT_ID: 'PLAID_CLIENT_ID',
  SECRET: 'PLAID_SECRET',
  ENV: 'PLAID_ENV',                 // production (the free Trial runs against production)
  START_DATE: 'PLAID_START_DATE',   // yyyy-mm-dd; transactions before this date are not imported
  TOKEN_PREFIX: 'PLAID_ACCESS_TOKEN_', // + Connection ID
  PENDING_LINK: 'PLAID_PENDING_LINK',  // JSON of the hosted Link session in progress
  PENDING_MAP: 'PLAID_PENDING_MAP',    // JSON of a connected bank whose accounts are not yet mapped
};

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
