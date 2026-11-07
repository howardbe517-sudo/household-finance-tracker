/**
 * Household Finance Tracker — Reference.gs
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
    sh.getRange(LIST_FIRST_ROW, col, listSpan, 1).clearContent(); // SAFETY-APPROVED: reference-list column reset during buildWorkbook
    sh.getRange(LIST_FIRST_ROW, col, list.values.length, 1).setValues(list.values.map(v => [v]));
    sh.setColumnWidth(col, 150);
    setNamedRange_('LIST_' + list.key, sh.getRange(LIST_FIRST_ROW, col, listSpan, 1));
    col++;
  });
  DERIVED_LISTS.forEach(list => {
    sh.getRange(4, col).setValue(list.header);
    sh.getRange(4, col).setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontWeight('bold').setWrap(true);
    sh.getRange(LIST_FIRST_ROW, col, listSpan, 1).clearContent(); // SAFETY-APPROVED: derived-list column reset during buildWorkbook
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
  sh.clear(); // SAFETY-APPROVED: App Setup is a documentation tab rebuilt by buildWorkbook
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
    'Browser / web UI  →  validated JSON  →  Google Apps Script web app (doPost in Api.gs)  →  these Sheet tables.',
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
  sh.clear(); // SAFETY-APPROVED: Sources is a documentation tab rebuilt by buildWorkbook
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
  sh.clear(); // SAFETY-APPROVED: Start Here is a documentation tab rebuilt by buildWorkbook (also after Clear sample data)
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
