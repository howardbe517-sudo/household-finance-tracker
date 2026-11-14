/**
 * Household Finance Tracker — Tables.gs
 * Phases 2–4: core raw tables, import infrastructure and derived reporting tables.
 * The generic builder (Helpers.gs) lays down headers/formulas/validations;
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

CF_BUILDERS.EXPECT = (sh, def) => {
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'deviation'), '=AND(ISNUMBER(' + cellRef_(def, 'deviation') + '),ABS(' + cellRef_(def, 'deviation') + ')>=50)', COLORS.WARN_FILL, COLORS.WARN_FONT),
  ]);
};

CF_BUILDERS.DEBTS = (sh, def) => {
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'apr'), '=AND(ISNUMBER(' + cellRef_(def, 'apr') + '),' + cellRef_(def, 'apr') + '>=0.15)', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(colRange_(sh, def, 'balanceAsOf'), '=' + cellRef_(def, 'balanceAsOf') + '="No review yet"', COLORS.WARN_FILL, COLORS.WARN_FONT),
    cfRule_(colRange_(sh, def, 'estMonthlyInterest'), '=AND(' + cellRef_(def, 'interestPaused') + '=TRUE,OR(' + cellRef_(def, 'pausedUntil') + '="",' + cellRef_(def, 'pausedUntil') + '>=TODAY()))', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
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
  const st = cellRef_(def, 'status');
  sh.setConditionalFormatRules([
    cfRule_(rowRange_(sh, def), '=OR(' + st + '="Imported",' + st + '="Superseded",' + st + '="Removed",' + st + '="Ignored")', null, COLORS.DELETED_TEXT),
    cfRule_(rowRange_(sh, def), '=AND(' + cellRef_(def, 'duplicate') + '=TRUE,' + st + '<>"Imported")', COLORS.OVER_FILL, COLORS.OVER_FONT),
    cfRule_(colRange_(sh, def, 'status'), '=' + st + '="Needs Split"', COLORS.WARN_FILL, COLORS.WARN_FONT, { bold: true }),
    cfRule_(colRange_(sh, def, 'status'), '=' + st + '="Needs Review"', COLORS.UNCATEGORIZED, COLORS.OVER_FONT),
    cfRule_(colRange_(sh, def, 'status'), '=' + st + '="Ready"', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(colRange_(sh, def, 'reviewed'), '=' + cellRef_(def, 'reviewed') + '=TRUE', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(colRange_(sh, def, 'suggestedCategory'), '=AND(' + cellRef_(def, 'importId') + '<>"",' + cellRef_(def, 'suggestedCategory') + '="",OR(' + st + '="Needs Review",' + st + '=""))', COLORS.UNCATEGORIZED, COLORS.OVER_FONT),
  ].concat(categoryCellRules_(sh, def, 'suggestedCategory')));
};

CF_BUILDERS.RULES = (sh, def) => {
  sh.setConditionalFormatRules([
    cfRule_(rowRange_(sh, def), '=AND(' + cellRef_(def, 'id') + '<>"",' + cellRef_(def, 'active') + '<>TRUE)', null, COLORS.DELETED_TEXT),
    cfRule_(colRange_(sh, def, 'autoImport'), '=' + cellRef_(def, 'autoImport') + '=TRUE', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(colRange_(sh, def, 'splitRequired'), '=' + cellRef_(def, 'splitRequired') + '=TRUE', COLORS.WARN_FILL, COLORS.WARN_FONT),
  ].concat(categoryCellRules_(sh, def, 'category')));
};

CF_BUILDERS.CONN = (sh, def) => {
  const st = cellRef_(def, 'status');
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'status'), '=' + st + '="Active"', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(colRange_(sh, def, 'status'), '=' + st + '="Needs Attention"', COLORS.OVER_FILL, COLORS.OVER_FONT, { bold: true }),
    cfRule_(colRange_(sh, def, 'status'), '=OR(' + st + '="Pending",' + st + '="Disconnected")', COLORS.WARN_FILL, COLORS.WARN_FONT),
    cfRule_(colRange_(sh, def, 'lastError'), '=' + cellRef_(def, 'lastError') + '<>""', COLORS.OVER_FILL, COLORS.OVER_FONT),
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

CF_BUILDERS.UTIL = (sh, def) => {
  const s = cellRef_(def, 'status');
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'status'), '=' + s + '="Due"', COLORS.WARN_FILL, COLORS.WARN_FONT),
    cfRule_(colRange_(sh, def, 'status'), '=' + s + '="Paid"', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
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
    // the owner wants subscriptions and memberships added up together (2026-11-12)
    ['Subscriptions & Memberships (Monthly)', R('=SUMIFS([@@monthlyEq],[@@group],"Subscriptions",[@@active],TRUE)+SUMIFS([@@monthlyEq],[@@group],"Memberships",[@@active],TRUE)')],
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
  // 2026-11-12 (the owner's choice): one household total instead of household / student loans / all debt, and no
  // "Current Quarter Ends". A loan kept off the books (no balance entered, PSLF count only) simply adds nothing.
  // The band used to hold seven boxes: empty the two rows first so boxes that no longer exist do not linger.
  sh.getRange(4, 1, 2, W).breakApart().setValue('').setBackground(null).setFontWeight('normal').setFontSize(10)
    .setBorder(false, false, false, false, false, false);
  const kpis = [
    ['Household Debt', R('=SUM([@@latestBalance])'), FORMATS.currency],
    ['Estimated Monthly Interest', R('=SUM([@@estMonthlyInterest])'), FORMATS.currency],
    ['Total Minimum Payments', R('=SUM([@@minPayment])'), FORMATS.currency],
    // PSLF: the lowest estimated count among each person's student loans (the loan furthest from 120)
    ['PSLF Progress (of 120)', R('=IFERROR(TEXTJOIN(" · ",TRUE,MAP(UNIQUE(FILTER([@@owner],([@@group]="Student Loans")*([@@pslfEstimated]<>""))),LAMBDA(o,o&" "&MINIFS([@@pslfEstimated],[@@owner],o,[@@group],"Student Loans")&"/120"))),"No count entered")'), '@', 11],
  ];
  kpis.forEach((k, i) => {
    const c = 1 + i * 2;
    sh.getRange(4, c, 1, 2).breakApart().merge().setValue(k[0]).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(5, c, 1, 2).breakApart().merge().setFormula(k[1]).setNumberFormat(k[2]).setFontSize(k[3] || 14).setFontWeight('bold').setHorizontalAlignment('center')
      .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(5, 34);
  sh.getRange(6, 1).setValue('Interest figures are estimates (Latest Balance × APR). Statements may differ because most lenders accrue daily.').setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
}

/* ---------- Debts: "Paused · 6.0%" in the APR cell while a pause is in effect ---------- */

function debtPauseActive_(paused, until) {
  const isDate = Object.prototype.toString.call(until) === '[object Date]' && !isNaN(until);
  return paused === true && (!isDate || until >= todayMidnight_());
}

/** Shows the word Paused in front of the rate while Interest Paused? is on (and Paused Until has not passed); plain rate otherwise. */
function setAprFormat_(sh, def, row, paused) {
  sh.getRange(row, colIndex_(def, 'apr')).setNumberFormat(paused ? '"Paused · "' + FORMATS.percent : FORMATS.percent);
}

/** Refreshes every Debts row's APR display from its pause state (nightly, after an upgrade, and on edit). */
function refreshDebtPauseFormats_() {
  const def = tdef_('DEBTS');
  const sh = ss_().getSheetByName(def.sheet);
  if (!sh) return 0;
  let n = 0;
  readTable_(def).forEach(d => { setAprFormat_(sh, def, d.__row, debtPauseActive_(d.interestPaused, d.pausedUntil)); n++; });
  return n;
}

/** Net Worth Snapshots: live tracked-net-worth helper in columns L:M. */
function buildNetWorthHelper_(sh, def) {
  const F = (t) => resolveFormula_(t, null, null);
  const c = def.columns.length + 2; // leave one blank column
  // Redrawable: if rows were deleted (clearSampleData) the strip may have shifted up and its note
  // merge moved; unmerge and reset the area before writing it again. No cell holding entered
  // data lives in these two columns.
  sh.getRange(4, c, 8, 2).breakApart().setFontStyle('normal').setFontSize(10).setFontColor(null).setWrap(false).setFontWeight('normal').setBackground(null);
  for (let r = 5; r <= 11; r++) sh.setRowHeight(r, 21);
  sh.setColumnWidth(c, 260); sh.setColumnWidth(c + 1, 130);
  styleSectionBar_(sh.getRange(4, c, 1, 2), 'Current Tracked Net Worth (live)');
  const rows = [
    ['Tracked Assets', F('=SUMIFS([ACCOUNTS.currentBalance],[ACCOUNTS.includeNW],"Yes",[ACCOUNTS.accountType],"<>Credit Card",[ACCOUNTS.accountType],"<>Loan",[ACCOUNTS.accountType],"<>Pension")')],
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
  ['INCOME', 'EXPECT', 'TX', 'RECUR', 'UTIL', 'FUNDS', 'DEBTS', 'QDR', 'CREDIT'].forEach(key => {
    const def = tdef_(key);
    const sh = buildTableSheet_(def);
    if (key === 'RECUR') buildRecurringTop_(sh, def);
    if (key === 'DEBTS') buildDebtsTop_(sh, def);
    if (key === 'FUNDS') buildFundsGuide_(sh, def);
    CF_BUILDERS[key](sh, def);
  });
}

function buildInfrastructureTables_() {
  ['STAGING', 'RULES', 'CONN', 'LOG'].forEach(key => {
    const def = tdef_(key);
    const sh = buildTableSheet_(def);
    if (CF_BUILDERS[key]) CF_BUILDERS[key](sh, def);
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

/* ---------- Savings & Reserves: "About your accounts", a reading section under the funds table ---------- */

// Account types described in the section, in this order. A pension is listed even though it is not counted in net worth.
const FUNDS_GUIDE = { TYPES: ['Savings', 'Investment', 'Retirement', 'HSA', 'Pension'], ROWS: 12, GAP: 3 };

/**
 * Draws the "About your accounts" section a few rows under the Savings & Reserves table: one row per savings,
 * investment, retirement and HSA account (and the pension), with its balance, last update, how it stays current
 * (bank feed, or typed by hand plus payroll deposits) and what it is. "What it is" is the account's About This Account
 * text on Accounts, written by the owner; everything else is calculated, so the section never goes stale. Holds no
 * entered data: redrawn by buildWorkbook and by every upgrade. If the table is ever extended past this section, the
 * upgrade draws it again under the new end of the table.
 */
function buildFundsGuide_(sh, def) {
  const F = (t) => resolveFormula_(t, null, null);
  const W = def.columns.length;
  const top = def.lastRow + FUNDS_GUIDE.GAP;
  const last = top + 2 + FUNDS_GUIDE.ROWS;
  if (sh.getMaxRows() < last + 1) sh.insertRowsAfter(sh.getMaxRows(), last + 1 - sh.getMaxRows());
  if (sh.getMaxColumns() < W) sh.insertColumnsAfter(sh.getMaxColumns(), W - sh.getMaxColumns());
  sh.getRange(top, 1, last - top + 1, W).breakApart().setBackground(null).setFontWeight('normal').setFontStyle('normal').setFontSize(10).setFontColor(COLORS.TEXT).setWrap(false).setVerticalAlignment('top');
  styleSectionBar_(sh.getRange(top, 1, 1, W), 'About your accounts — what each one is and how it stays current');
  sh.getRange(top + 1, 1, 1, W).merge().setValue('Savings, investment, retirement and HSA accounts from the Accounts tab, and the pension. "What it is" comes from the About This Account column on Accounts: change the wording there. The other columns fill in on their own.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9).setWrap(true);
  sh.setRowHeight(top + 1, 30);
  const hdr = top + 2;
  // Column F is the table's first calculated column, which tells the tracker where the table ends (syncLastRow_):
  // it must never hold a formula here, so Last Updated spans E:F and its formula sits in E.
  const heads = [['B', 'B', 'Account'], ['C', 'C', 'Type'], ['D', 'D', 'Balance'], ['E', 'F', 'Last Updated'], ['G', 'I', 'How it stays current'], ['J', colLetter_(W), 'What it is']];
  heads.forEach(h => { const r = sh.getRange(h[0] + hdr + ':' + h[1] + hdr); if (h[0] !== h[1]) r.merge(); r.setValue(h[2]); styleHeader_(r); });
  const typeTest = FUNDS_GUIDE.TYPES.map(t => '([ACCOUNTS.accountType]="' + t + '")').join('+');
  const list = 'FILTER([ACCOUNTS.id],[ACCOUNTS.id]<>"",(' + typeTest + ')>0,(([ACCOUNTS.includeNW]="Yes")+([ACCOUNTS.accountType]="Pension"))>0)';
  const at = (col) => 'INDEX([ACCOUNTS.' + col + '],MATCH(id,[ACCOUNTS.id],0))';
  for (let k = 1; k <= FUNDS_GUIDE.ROWS; k++) {
    const r = hdr + k;
    const cell = (expr) => F('=IFERROR(LET(id,INDEX(' + list + ',' + k + '),' + expr + '),"")');
    sh.getRange('B' + r).setFormula(cell(at('name'))).setFontWeight('bold').setWrap(true);
    sh.getRange('C' + r).setFormula(cell(at('accountType')));
    sh.getRange('D' + r).setFormula(cell('IF(' + at('accountType') + '="Pension","—",' + at('currentBalance') + ')')).setNumberFormat(FORMATS.currency).setHorizontalAlignment('right');
    // merge first, then put the formula in the first cell only, so the merged-over cells (F above all) stay empty
    sh.getRange('E' + r + ':F' + r).merge().setNumberFormat(FORMATS.date).setHorizontalAlignment('center');
    sh.getRange('E' + r).setFormula(cell('IF(' + at('lastUpdated') + '="","",' + at('lastUpdated') + ')'));
    sh.getRange('G' + r + ':I' + r).merge().setWrap(true).setFontSize(9);
    sh.getRange('G' + r).setFormula(cell(
      'IF(' + at('connectionId') + '<>"","Bank feed, every night",' +
      'IF(' + at('accountType') + '="Pension","Not a balance: a monthly income in retirement. Update the projected benefit on Accounts once a year.",' +
      '"Typed by hand from the provider website"&IF(AND(' + at('payrollSource') + '<>"",ISNUMBER(' + at('payrollPerPaycheck') + ')),"; each paycheck from "&IFERROR(INDEX([EXPECT.employer],MATCH(' + at('payrollSource') + ',[EXPECT.id],0)),' + at('payrollSource') + ')&" adds "&TEXT(' + at('payrollPerPaycheck') + ',"$#,##0.00"),"")&". A reminder asks for the real balance now and then."))'));
    sh.getRange('J' + r + ':' + colLetter_(W) + r).merge().setWrap(true);
    sh.getRange('J' + r).setFormula(cell('IF(' + at('about') + '="","(No description yet: write one in About This Account on the Accounts tab.)",' + at('about') + ')'));
    sh.setRowHeight(r, 78);
  }
  sh.getRange(hdr, 2, FUNDS_GUIDE.ROWS + 1, W - 1).setBorder(true, true, true, true, false, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
}

/**
 * Empties the About your accounts section at its current place (under def.lastRow) so the table can grow through
 * those rows; extendTable_ draws it again under the new end. The section holds only calculated text, no entered data,
 * so it is overwritten with blanks rather than cleared.
 */
function eraseFundsGuide_(sh, def) {
  const top = def.lastRow + FUNDS_GUIDE.GAP;
  const n = FUNDS_GUIDE.ROWS + 3, W = def.columns.length;
  if (sh.getMaxRows() < top + n - 1) return;
  const rng = sh.getRange(top, 1, n, W);
  rng.breakApart();
  rng.setValues(Array.from({ length: n }, () => Array(W).fill('')));
  rng.setBackground(null).setFontWeight('normal').setFontStyle('normal').setFontSize(10).setFontColor(COLORS.TEXT).setWrap(false)
    .setBorder(false, false, false, false, false, false);
  for (let r = top; r < top + n; r++) sh.setRowHeight(r, 21);
}
