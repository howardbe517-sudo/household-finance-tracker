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

/**
 * Bring the Categories tab up to the taxonomy in Config without rebuilding it: append any
 * category/subcategory pair that is missing (new IDs follow the existing numbering) and untick
 * Active? on a pair the taxonomy no longer has. Nothing is removed, so rows that use an old pair
 * still read. Safe to run more than once. Returns a list of plain-language report lines.
 */
function ensureCategories_() {
  const def = tdef_('CATS');
  if (!ss_().getSheetByName(def.sheet)) return [];
  syncLastRow_(def);
  const rows = readTable_(def).filter(r => r.category);
  const have = {};
  const catId = {};
  const subCount = {};
  let maxCat = 0;
  rows.forEach(r => {
    have[r.category + '|' + r.subcategory] = r;
    if (r.categoryId && !catId[r.category]) catId[r.category] = r.categoryId;
    subCount[r.category] = (subCount[r.category] || 0) + 1;
    const n = parseInt(String(r.categoryId || '').replace('CAT-', ''), 10);
    if (!isNaN(n) && n > maxCat) maxCat = n;
  });
  const fresh = [];
  const want = {};
  TAXONOMY.forEach(t => {
    const [category, subcategory, needWant, fixedVariable, spendingType] = t;
    want[category + '|' + subcategory] = true;
    if (have[category + '|' + subcategory]) return;
    if (!catId[category]) { maxCat++; catId[category] = 'CAT-' + String(maxCat).padStart(2, '0'); subCount[category] = 0; }
    subCount[category]++;
    const ci = catId[category].replace('CAT-', '');
    fresh.push({ categoryId: catId[category], category, subcategoryId: 'SUB-' + ci + String(subCount[category]).padStart(2, '0'), subcategory, needWant, fixedVariable, active: true, spendingType });
  });
  const report = [];
  if (fresh.length) {
    writeRows_(def, fresh);
    report.push('Categories: added ' + fresh.map(f => f.category + ' / ' + f.subcategory).join(', '));
  }
  const sh = getOrCreateSheet_(def.sheet);
  rows.forEach(r => {
    if (want[r.category + '|' + r.subcategory] || r.active === false) return;
    sh.getRange(r.__row, colIndex_(def, 'active')).setValue(false);
    report.push('Categories: ' + r.category + ' / ' + r.subcategory + ' is no longer in the taxonomy; Active? unticked (rows that use it still read)');
  });
  return report;
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
  const real = 'Real account — enter owner, balances and Last Updated (or let the bank feed fill balances).';
  rows.push({ id: 'ACC-006', name: 'PayPal', institution: 'PayPal', accountType: 'Cash', includeNW: 'Yes', notes: real, importTx: true });
  rows.push({ id: 'ACC-007', name: 'Independent Bank Checking', institution: 'Independent Bank', accountType: 'Checking', includeNW: 'Yes', notes: real, importTx: true });
  rows.push({ id: 'ACC-008', name: 'Independent Bank Savings', institution: 'Independent Bank', accountType: 'Savings', includeNW: 'Yes', notes: real, importTx: true });
  rows.push({ id: 'ACC-009', name: 'Independent Bank Credit Card', institution: 'Independent Bank', accountType: 'Credit Card', includeNW: 'Yes', notes: real + ' Link to a Debts row if you track its balance there.', importTx: true });
  rows.push({ id: 'ACC-010', name: 'Capital One Credit Card', institution: 'Capital One', accountType: 'Credit Card', includeNW: 'Yes', notes: real + ' Link to a Debts row if you track its balance there.', importTx: true });
  rows.push({ id: 'ACC-011', name: 'Acorns Account', institution: 'Acorns', accountType: 'Investment', includeNW: 'Yes', notes: real + ' Balance only.', importTx: false });
  rows.push({ id: 'ACC-012', name: 'Fidelity Roth IRA', institution: 'Fidelity', accountType: 'Retirement', includeNW: 'Yes', notes: real + ' Balance only.', importTx: false });
  rows.push({ id: 'ACC-013', name: 'HealthEquity HSA', institution: 'HealthEquity', accountType: 'HSA', includeNW: 'Yes', notes: real + ' Balance only.', importTx: false });
  writeRows_(def, rows, def.firstRow);
  CF_BUILDERS.ACCOUNTS(sh, def);
}

/* ---------- App Setup ---------- */

function buildAppSetup_(withSample) {
  const ss = ss_();
  const sh = getOrCreateSheet_(SHEETS.SETUP);
  sh.clear(); // SAFETY-APPROVED: App Setup is a documentation tab rebuilt by buildWorkbook
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  ensureSheetSize_(sh, 240, 8); // the data dictionary grows with every column note; keep headroom
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
  kv('Bank feed: auto-import detected transfers and card payments', true, { name: 'SETTING_AUTO_PAIRS', checkbox: true });
  kv('Week starts on (flexible-spending guidance)', 'Monday');
  kv('PSLF count reminder after (months)', 12, { name: 'SETTING_PSLF_REMINDER_MONTHS' });
  kv('Credit score reminder after (months)', 3, { name: 'SETTING_CREDIT_REMINDER_MONTHS' });
  kv('Pay stub reminder after (months, per regular paycheck)', 6, { name: 'SETTING_PAYSTUB_REMINDER_MONTHS' });
  kv('Email reminders (sent by the nightly sync, at most monthly)', true, { name: 'SETTING_REMINDER_EMAIL', checkbox: true });
  kv('Debt payoff plan: extra toward debts each month (Payoff planner)', 0, { name: 'SETTING_DEBT_EXTRA_ALL', fmt: FORMATS.currency });
  kv('Debt payoff plan: order (Avalanche = highest rate first, Snowball = smallest balance first)', 'Avalanche', { name: 'SETTING_DEBT_EXTRA_METHOD' });
  kv('Last QA run', '', { name: 'QA_LAST_RUN', fmt: FORMATS.datetime });
  kv('Last QA result', '', { name: 'QA_LAST_RESULT' });
  r++;

  section('Architecture');
  [
    'Browser / web UI  →  validated JSON  →  Google Apps Script web app (doPost in Api.gs)  →  these Sheet tables.',
    'Never expose spreadsheet credentials to the browser. The Apps Script layer owns writes and validation; this Sheet stays the durable store and backup.',
    'The app reads and writes the RAW tables only (Income, Transactions, Recurring Payments, Savings & Reserves, Debts, Quarterly Debt Review, Accounts, Credit Scores, Monthly Budget, Monthly Plan, Monthly Review, Net Worth Snapshots, Import Staging, Change Log).',
    'Calculated sheets (Monthly Summary, Dashboard) and calculated columns (listed below) are read-only for the app.',
    'Bank feed (3.1): Plaid → nightly sync (Plaid.gs) → Import Staging, classified by Import Rules (Import.gs). Rows wait for review unless their rule says Auto-import; detected transfers and card payments are auto-imported when the setting above is on. Import reviewed rows / the split panel create the Transactions rows. Plaid secrets live in Script Properties: PLAID_CLIENT_ID, PLAID_SECRET, PLAID_START_DATE, PLAID_ACCESS_TOKEN_<Connection ID>.',
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
  line('Categories · Childcare (one subcategory, Nanny) is separate from Child Expenses (Clothing, Medical, Activities, Education, Supplies, Toys, Other); the Financial Summary shows each and the two combined. Only rows ticked Active? on the Categories tab appear in the dropdowns.');
  r++;

  section('Validation Flag messages (Transactions column Z)');
  ['Missing Date', 'Missing Type', 'Missing Amount', 'Missing Category', 'Missing Subcategory', 'Subcategory Does Not Match Category',
    'Missing Spending Type', 'Missing Fund ID', 'Missing Debt ID', 'Set Split Role to Parent', 'Parent Must Be Type Split Parent',
    'Missing Parent Transaction ID', 'Parent Transaction ID Not Found', 'Split Does Not Balance', 'Missing Source Income ID',
    'Source Income ID Not Found', 'Deposit Does Not Match Take-Home', 'Income ID Linked More Than Once'].forEach(m => line('• ' + m));
  r++;

  section('Menu: Finance Tracker');
  ['Import reviewed rows — turns every Import Staging row ticked Reviewed? into a Transactions row.',
    'Split the selected row… — side panel that splits a staged or recorded transaction into balanced children.',
    'Make a rule from the selected row… — creates an Import Rules row from a staged transaction and applies it to waiting rows.',
    'Re-apply rules to waiting rows — fills suggestions on unreviewed staged rows after rules change.',
    'Bank feed → Status / Set history start date / Connect a bank / Finish connecting / Repair a connection / Sync now / nightly sync on-off.',
    'Upgrade workbook (keeps data) — adds new tabs, columns and lists after a script update; never deletes rows.',
    'Run QA checks — scans every tab for formula errors and re-computes key totals independently.',
    'Link income deposits — links Income-type transactions to their pay stub by amount and date, and gives a deposit with no stub its own row on Income so it counts (every sync does the same).',
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

  section('What this tracker is');
  line('A household finance workbook that fills itself in. The bank feed brings in balances and transactions every night; a paycheck counts as income the day it lands in checking, with no pay stub needed; everything you see on the summary tabs is calculated from those records. You type very little: a category now and then, the few numbers no lender provides.');
  line('Spending = Expense − Refund. Debt payments, savings transfers, account transfers and Split Parent rows are never spending. Income is take-home from paychecks. Months are calendar months. Financial rows are never deleted; a row is marked deleted instead and every total skips it.');
  r++;

  section('The tabs, in the order they sit');
  [
    ['Start Here', 'This page: how the tracker works and what its words mean.'],
    ['Financial Summary', 'Where you stand: tonight\'s balances at the top (checking, savings split into yours to keep and parked for bills, each card with what is owed and when it is due), then averages over the last months, month by month, Children (childcare and other child costs), Fees (card, late and bank fees for the year), Savings & Reserves, Debts, income by person, payroll deductions, credit scores, net worth.'],
    ['Spending', 'How this month is going. Pick the Month in B3. At the top: rows waiting for review, expected take-home, spent so far, the flexible figure and this week\'s suggestion. Then each category beside a typical month (Compare with, in E3, chooses which months are averaged: the last 3, 6 or 12 full months, or the same three months a year ago), fixed vs flexible, needs vs wants and recurring bills (hover over any of those three tiles for the list behind the number), every recurring bill with paid-this-month, the flexible subcategories, six months side by side, a bar for each category\'s average, and the monthly checklist.'],
    ['Utilities', 'Gas, electric and water, the bills that change from month to month (fixed bills such as internet stay on Recurring Payments): the next bill, the last 12 months, cost by month and this year against last year, with a Show menu at the top for one utility or all of them.'],
    ['Savings & Reserves', 'Funds: the emergency fund and investment accounts fed by the bank feed, sinking funds, and Parked for Bills pots (money passing through savings for a bill).'],
    ['Debts', 'Every debt with its rate, minimum, due day, live balance where the lender is connected, estimated interest, PSLF progress, interest pauses and the planned extra payment from the Payoff planner.'],
    ['Goals', 'Five big text boxes for goals in your own words.'],
    ['Income · Expected Income', 'Income is the paycheck database (gross, deductions, take-home). A paycheck that arrives in checking gets its row here on its own; Notes say "From bank deposit" and, without a stub, the gross and deductions on it are estimates. Expected Income holds the typical paycheck per employer and the pay frequency, which drive the expected monthly take-home and the automatic flexible target.'],
    ['Transactions · Import Staging', 'Transactions is the master ledger. Import Staging is where bank rows land first; reviewing a row is pick a Category, tick Reviewed?, and the next sync takes it in.'],
    ['Utility Bills', 'One row per utility bill. Utility payments from the bank feed file themselves here; past bills come in from statements through Import from Claude.'],
    ['Recurring Payments', 'Expected bills, subscriptions and loan payments with their day of the month; they feed the monthly plan and the Spending tab.'],
    ['Monthly Budget · Monthly Plan · Monthly Summary · Monthly Review', 'Planned vs actual by category; the flexible target and weekly guidance (automatic unless you set one); calculated monthly results; your month-end notes.'],
    ['Quarterly Debt Review · Net Worth Snapshots · Credit Scores', 'Debt balances by quarter where no lender is connected; net worth history; credit scores typed in by hand.'],
    ['Reminders', 'Last tab: the few things only you can do (PSLF counts, credit scores), also emailed monthly.'],
    ['Categories · App Setup · Sources · Import Rules · Connections · Paste Import · Accounts · Change Log', 'The machinery: the category list and dropdowns, settings, design sources, the rules that classify bank rows, the bank logins, the paste-import landing area, the account list, and the audit log.'],
  ].forEach(([tab, what]) => line(tab + ' — ' + what));
  r++;

  section('How money gets in');
  line('Bank feed: every night (and on Finance Tracker → Bank feed → Sync now) the connected banks send balances and new transactions. Balances update Accounts, Savings & Reserves, Debts and the Dashboard. Transactions land on Import Staging.');
  line('Rules: an Import Rule matches a bank description ("CAPITAL ONE AUTO" → Debt Payment on the car loan). A rule marked Auto-import sends matching rows straight to Transactions; others pre-fill the row for you. Make one from any staged row with Finance Tracker → Make a rule from the selected row. Every sync re-checks the waiting rows against the rules.');
  line('Review: for a row no rule knows, pick a Category and tick Reviewed?. The next sync imports it. A category with one subcategory (Childcare → Nanny) fills itself in; a wider category uses its "Other" line unless you pick one.');
  line('Paychecks: nothing to do. When the deposit reaches checking and is imported as Income, the next sync adds it to Income at the amount deposited. For a known employer the gross pay and deductions are estimated from the last pay stub you gave; the take-home is always the real deposit. The pay stub is where the gross pay and deductions come from, so Reminders asks for a fresh one per employer every six months (the number is on App Setup): give it to Claude and paste the block into Finance Tracker → Import from Claude. It replaces the estimate for that paycheck.');
  line('By hand, rarely: PSLF counts from studentaid.gov, credit scores, the HSA balance until it connects, the amount parked in savings when a new Parked for Bills pot starts. The Reminders tab nags about the first two.');
  r++;

  section('Definitions');
  line('Spending Type — how much control you have over an expense month to month. Fixed: the same every month and already committed (rent, car insurance, the nanny, subscriptions, the gym). Flexible: day-to-day spending you steer week by week (groceries, dining out, fuel, personal care, pharmacy, toys). Planned Irregular: expected but not monthly (property tax, registration, travel, annual fees). Unexpected: could not be planned (doctor visits, medical bills, repairs). The Dashboard\'s Current Flexible Spending and the weekly suggestion count only Flexible rows, because that is the part you can still change this month.', { bold: false });
  line('Need / Want — could it be cut if it had to be? Groceries, childcare, utilities and insurance are Needs; dining out, coffee, entertainment and toys are Wants. A line can be a Want and Fixed at the same time (a streaming service): committed, but cuttable.');
  line('Both defaults come from the subcategory on the Categories tab and fill in when a transaction is categorized. Change them on any single transaction when a purchase does not fit its usual pattern.');
  line('Category and Subcategory — the category is the grouping the budget and the Spending tab work with (Housing, Food, Childcare, Child Expenses …); the subcategory is the line inside it (Groceries, Dining Out, Nanny, Toys). Childcare is what you pay someone to watch the children; Child Expenses is everything else for them. The Spending tab shows them together as Children and apart in their own colours.');
  line('Spending — expenses minus refunds. Not spending: a Debt Payment (money to a loan or card balance), Savings (money into a fund or investment), a Transfer between your own accounts, and a Split Parent (a receipt split into children, which are the spending).');
  line('Expected Take-Home — the paychecks expected this month at their typical amounts, counted by how many paydays fall in the month (a biweekly pay has three some months). Flexible target = expected take-home ± adjustment − bills − debt payments − planned savings; the Spending tab shows the arithmetic under the two cards.');
  line('Parked for Bills — a fund on Savings & Reserves for money moved into savings to pay a bill later. Deposits tagged for it add to it, the bill going out takes from it; the savings balance minus the parked money is what is yours to keep. Set up for the car payment.');
  line('Planned Extra Payment — the extra you chose in the Payoff planner for a debt, or the household extra on App Setup; the monthly plan treats it like a bill.');
  line('Selected Month vs this week — the Spending tab follows the Selected Month (B3 on Spending); Current Flexible Spending always follows today\'s week.');
  line('Typical Month — on the Spending tab, the average of the months chosen by Compare with. Months with no spending recorded are left out of the average, and a dash shows until there is one full month. Nothing on the tab predicts the rest of the month; it only sets what has happened beside what is typical.');
  r++;

  section('The menu, in plain words');
  line('Bank feed → Sync now: fresh balances from the banks, new transactions, rules re-checked, reviewed rows imported. Import from Claude (paste): an optional pay stub, or other rows Claude prepared. Payoff planner: the slider for extra debt payments. Show reminders: what only you can do. Run QA checks: recomputes the key totals and compares them with the formulas. Upgrade workbook (keeps data): after a change to the script, redraws the calculated tabs and adds new columns without touching your rows.');
  r++;

  if (withSample) {
    section('Sample data is loaded (every row is tagged SAMPLE)');
    check('When your real data is in: Finance Tracker → Clear sample data…');
    r++;
  }

  section('Rules the app (and humans) must keep');
  APP_RULES.forEach((rule, i) => line((i + 1) + '. ' + rule));
  r++;

  section('Build');
  line('Built ' + Utilities.formatDate(nowStamp_(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ' · schema ' + HFT.SCHEMA_VERSION + ' · script ' + HFT.BUILD_VERSION);
  line('Source & documentation: ' + HFT.REPO_URL);
  sh.getRange(3, 1, r, 3).setFontColor(COLORS.TEXT);
  sh.setFrozenRows(2);
}
