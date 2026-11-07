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
