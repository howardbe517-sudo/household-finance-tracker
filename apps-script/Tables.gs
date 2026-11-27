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

// Grocery receipt lines: a line set aside (a duplicate trip) is greyed out
CF_BUILDERS.GROC = (sh, def) => {
  sh.setConditionalFormatRules([
    cfRule_(rowRange_(sh, def), '=' + cellRef_(def, 'isDeleted') + '=TRUE', null, COLORS.DELETED_TEXT, { italic: true }),
  ]);
};

CF_BUILDERS.GROCNAMES = (sh, def) => {
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'item'), '=AND(' + cellRef_(def, 'itemNo') + '<>"",' + cellRef_(def, 'item') + '="")', COLORS.WARN_FILL, COLORS.WARN_FONT),
  ]);
};

// Receipts: a removed row is greyed out; Waiting is amber, Check is red.
CF_BUILDERS.RECEIPTS = (sh, def) => {
  const st = cellRef_(def, 'status');
  sh.setConditionalFormatRules([
    cfRule_(rowRange_(sh, def), '=' + cellRef_(def, 'isDeleted') + '=TRUE', null, COLORS.DELETED_TEXT, { strike: true }),
    cfRule_(colRange_(sh, def, 'status'), '=' + st + '="Check"', COLORS.WARN_FILL, COLORS.WARN_FONT),
    cfRule_(colRange_(sh, def, 'status'), '=' + st + '="Waiting"', '#FFF4DB', '#7A4F0E'),
  ]);
};

// Bill Changes: an undone change (Is Deleted) is greyed out.
CF_BUILDERS.BILLCHG = (sh, def) => {
  sh.setConditionalFormatRules([
    cfRule_(rowRange_(sh, def), '=' + cellRef_(def, 'isDeleted') + '=TRUE', null, COLORS.DELETED_TEXT, { strike: true }),
  ]);
};

// a finished to-do goes grey with a line through it (the owner, 2026-11-27: a checklist). The strategies and the Savings Journal
// share the tab, so their formats are kept; any older rule over the checklist rows (the 200-row layout of 3.25) is replaced.
CF_BUILDERS.TODO = (sh, def) => {
  sh.setConditionalFormatRules(rulesOutsideRows_(sh, def.firstRow, def.lastRow).concat([
    cfRule_(rowRange_(sh, def), '=' + cellRef_(def, 'done') + '=TRUE', null, COLORS.DELETED_TEXT, { strike: true }),
  ]));
};

/**
 * A Savings Journal row's Saved per Year, as its formula works it out (TABLES.SAVEJ.yearly). Pure.
 * (Old Cost − New Cost) × times a year; '' (shown blank) until What We Changed, Old Cost, New Cost and How Often are all filled in.
 * Like N() in the formula, a cost that is not a number counts as 0.
 */
function savingsPerYear_(r) {
  const blank = (v) => v === '' || v === null || v === undefined;
  if (!r || blank(r.change)) return '';
  if (blank(r.often) || blank(r.oldCost) || blank(r.newCost)) return '';
  const n = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;
  return (n(r.oldCost) - n(r.newCost)) * (SAVING_TIMES_A_YEAR[r.often] || 0);
}

/**
 * Totals of the Savings Journal, as the summary line and Our Money-Saving Strategies show them. Pure.
 * journal: SAVEJ rows; strategies: STRAT rows. One-time savings are kept apart from the yearly figures.
 * Returns { perYear, oneTime, count, byStrategy: [{ strategy, changes, perYear }] }.
 */
function savingsTotals_(journal, strategies) {
  const rows = (journal || []).filter(r => r.change !== '' && r.change !== null && r.change !== undefined);
  const yearlyOf = (r) => { const y = savingsPerYear_(r); return y === '' ? 0 : y; };
  const recurring = (r) => r.often !== 'One time';
  return {
    perYear: rows.filter(recurring).reduce((s, r) => s + yearlyOf(r), 0),
    oneTime: rows.filter(r => !recurring(r)).reduce((s, r) => s + yearlyOf(r), 0),
    count: rows.length,
    byStrategy: (strategies || []).filter(st => st.strategy !== '' && st.strategy !== null && st.strategy !== undefined).map(st => {
      const mine = rows.filter(r => String(r.strategy).toLowerCase() === String(st.strategy).toLowerCase());
      return { strategy: st.strategy, changes: mine.length, perYear: mine.filter(recurring).reduce((s, r) => s + yearlyOf(r), 0) };
    }),
  };
}

// a finished goal turns green
CF_BUILDERS.GOALPLAN = (sh, def) => {
  sh.setConditionalFormatRules([
    cfRule_(rowRange_(sh, def), '=AND(ISNUMBER(' + cellRef_(def, 'progress') + '),' + cellRef_(def, 'progress') + '>=1)', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
  ]);
};

/**
 * One goal's figures, as the Goals & Progress formulas work them out. Pure.
 *   g            a Goals & Progress row ({ goal, kind, debtId, fundId, target, start })
 *   debtBalance  that debt's balance (goalDebtBalance_), or null when the goal names no debt, the debt is not found or it has no balance yet
 *   fundCurrent  that fund's Current Amount, or null likewise
 * Returns { current, left, progress }: each '' where the Sheet shows a blank.
 */
/** The balance a goal reads from its debt: null (shown blank) when the debt has no balance yet, i.e. Latest Balance is blank, or zero with no "as of" date. Pure. */
function goalDebtBalance_(d) {
  if (!d || d.latestBalance === '' || d.latestBalance === null || d.latestBalance === undefined) return null;
  if (Number(d.latestBalance) === 0 && !(d.balanceAsOf instanceof Date)) return null;
  return Number(d.latestBalance);
}

function goalProgress_(g, debtBalance, fundCurrent) {
  const num = (v) => { const x = Number(v); return (v === '' || v === null || v === undefined || isNaN(x)) ? 0 : x; };
  const current = g.debtId ? (debtBalance === null || debtBalance === undefined ? '' : num(debtBalance)) : g.fundId ? (fundCurrent === null || fundCurrent === undefined ? '' : num(fundCurrent)) : '';
  if (!g.goal || current === '') return { current: '', left: '', progress: '' };
  if (g.kind !== 'Pay off debt' && g.kind !== 'Save up') return { current, left: '', progress: '' }; // no Kind chosen yet: nothing to measure against
  const target = num(g.target), start = num(g.start);
  const clamp = (x) => Math.min(1, Math.max(0, x));
  if (g.kind === 'Pay off debt') return { current, left: Math.max(0, current - target), progress: start - target <= 0 ? '' : clamp((start - current) / (start - target)) };
  return { current, left: target <= 0 ? '' : Math.max(0, target - current), progress: target - start <= 0 ? '' : clamp((current - start) / (target - start)) };
}

CF_BUILDERS.REVIEW = (sh, def) => {
  const s = cellRef_(def, 'status');
  sh.setConditionalFormatRules([
    cfRule_(colRange_(sh, def, 'status'), '=' + s + '="Complete"', COLORS.UNDER_FILL, COLORS.UNDER_FONT),
    cfRule_(colRange_(sh, def, 'status'), '=' + s + '="In Progress"', COLORS.WARN_FILL, COLORS.WARN_FONT),
  ]);
};

/* ---------- presentation sections ---------- */

/* To-Do & Reminders: above the checklist (row 3), the automatic reminders from the hidden Reminders tab, so everything to do is on
   the first tab (the owner, 2026-11-27). The strip sits above the header and is merged across only, so the to-do rows below can be
   dragged into any order (rows that pass through a box merged down several rows cannot be moved). Holds no entered data: redrawn
   by build and upgrade. */
const TODO_SIDE = { FIRST_COL: 7, WIDTH: 6, STRIP_ROW: 3, STRIP_HEIGHT: 120 }; // FIRST_COL/WIDTH: where the box sat before, cleared on upgrade
function buildTodoTop_(sh, def) {
  const n = def.columns.length, c1 = TODO_SIDE.FIRST_COL, w = TODO_SIDE.WIDTH, all = c1 + w - 1;
  growSheet_(sh, def.lastRow + 5, all); // never trims: the strategies and the Savings Journal sit below the checklist
  sh.getRange(1, 1, 1, all).setBackground(COLORS.NAVY);
  sh.getRange(2, 1, 1, all).setBackground(COLORS.WHITE);
  // the side panel of the first layout (a box merged down the rows beside the checklist): emptied, so rows can be moved
  const side = sh.getRange(TODO_SIDE.STRIP_ROW, c1, def.lastRow - TODO_SIDE.STRIP_ROW + 1, w);
  side.breakApart();
  side.clear(); // SAFETY-APPROVED: the old side panel was calculated (one formula box and its labels); no entered data is kept there
  side.clearDataValidations();
  const strip = sh.getRange(TODO_SIDE.STRIP_ROW, 1, 1, n);
  strip.breakApart();
  strip.merge();
  // the cell itself, not the REMINDERS_BOX name: the name is removed and set again each time the Reminders tab is rebuilt, and a
  // formula that used it was left with #REF! (an empty box) after the first upgrade (fixed 2026-11-27)
  strip.setFormula('="Automatic reminders (each clears itself when you update what it asks for)"&CHAR(10)&IFERROR(\'' + SHEETS.REMINDERS + '\'!$A$' + REMINDERS.BOX_FIRST + ',"")');
  strip.setWrap(true).setVerticalAlignment('top').setHorizontalAlignment('left').setFontSize(10).setFontStyle('normal').setBackground(COLORS.WARN_FILL).setFontColor(COLORS.WARN_FONT)
    .setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(TODO_SIDE.STRIP_ROW, TODO_SIDE.STRIP_HEIGHT);
  sh.setFrozenRows(def.frozenRows !== undefined ? def.frozenRows : def.headerRow); // none: the tab now runs down to the Savings Journal
  emptyOldTodoRows_(sh, def);
}

/**
 * Once, when the strategies and the Savings Journal arrive (3.27): the checklist used to run to row 204, so the rows below its 15
 * still carry its empty checkboxes, date and name dropdowns. They are emptied, so the two new tables start on clean rows. Only when
 * the strategies are not there yet and every one of those cells is blank or an unticked box; anything entered is left alone (the
 * upgrade's first check, todoOverflowConflict_, stops before any change and asks for those to-dos to be moved up).
 */
function emptyOldTodoRows_(sh, def) {
  const strat = TABLES.STRAT;
  if (sh.getRange(strat.headerRow, 1).getValue() !== '') return;
  const last = sh.getLastRow();
  if (last <= def.lastRow) return;
  const rng = sh.getRange(def.lastRow + 1, 1, last - def.lastRow, def.columns.length);
  const vals = rng.getValues();
  if (vals.some(row => row.some(v => v !== '' && v !== false && v !== null))) return;
  rng.clearDataValidations();
  rng.setValues(vals.map(row => row.map(() => '')));
  rng.setNumberFormat('General').setFontLine('none').setFontColor(COLORS.TEXT).setBackground(null);
}

/**
 * The To-Do & Reminders tab below the checklist: a bar over Our Money-Saving Strategies, a bar over the Savings Journal and the
 * journal's summary line (the owner, 2026-11-27). Holds no entered data (only titles and one formula), so build and upgrade
 * simply redraw it. Nothing is merged, so every row can still be dragged.
 */
function buildSavingsSection_(sh) {
  const todo = TABLES.TODO, strat = TABLES.STRAT, jr = TABLES.SAVEJ;
  const W = jr.columns.length;
  todo.columns.forEach((c, i) => { if (c.w) sh.setColumnWidth(i + 1, c.w); });
  jr.columns.forEach((c, i) => { if (c.w && i >= todo.columns.length) sh.setColumnWidth(i + 1, c.w); });
  const bar = (row, def) => {
    const r = sh.getRange(row, 1, 1, W);
    r.setValues([[def.title + '   ·   ' + def.note].concat(Array(W - 1).fill(''))]);
    r.setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(11).setFontWeight('normal').setWrap(false).setVerticalAlignment('middle');
    sh.getRange(row, 1).setFontWeight('bold');
    sh.setRowHeight(row, 30);
  };
  bar(strat.headerRow - 1, strat);
  bar(jr.headerRow - 2, jr);
  const yr = colRef_('SAVEJ', 'yearly'), often = colRef_('SAVEJ', 'often'), what = colRef_('SAVEJ', 'change');
  const sum = sh.getRange(jr.headerRow - 1, 1, 1, W);
  sum.setValues([Array(W).fill('')]);
  sum.setBackground(COLORS.UNDER_FILL).setFontColor(COLORS.UNDER_FONT).setFontSize(11).setFontWeight('bold').setWrap(false).setVerticalAlignment('middle');
  sh.getRange(jr.headerRow - 1, 1).setFormula('="Saving about "&TEXT(SUMIFS(' + yr + ',' + often + ',"<>One time"),"$#,##0")&" a year (about "&TEXT(SUMIFS(' + yr + ',' + often + ',"<>One time")/12,"$#,##0")&" a month)   ·   one-time savings "&TEXT(SUMIFS(' + yr + ',' + often + ',"One time"),"$#,##0")&"   ·   "&COUNTIF(' + what + ',"<>")&" change(s) logged"');
  sh.setRowHeight(jr.headerRow - 1, 28);
}

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
  // the next date steps forward past dates by the bill's frequency (recurNextDueExpr_), so a weekly bill keeps showing up
  sh.getRange(9, 6).setFormula(R('=IFERROR(LET(nd,' + recurNextDueExpr_(k => '[@@' + k + ']') + ',ARRAY_CONSTRAIN(SORT(FILTER({[@@name],nd,[@@amount],[@@group]},[@@active]=TRUE,nd<>"",nd>=TODAY(),nd<=TODAY()+14),2,TRUE),20,4)),"Nothing due in the next 14 days")'));
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

/** A table's conditional formats (its CF_BUILDERS entry, if any), then every other row a shade darker. */
function applyTableFormats_(sh, def) {
  if (typeof CF_BUILDERS !== 'undefined' && CF_BUILDERS[def.key]) CF_BUILDERS[def.key](sh, def);
  if (def.lastRow >= def.firstRow) addBandRule_(sh, sh.getRange(def.firstRow, 1, def.lastRow - def.firstRow + 1, def.columns.length));
}

function buildCoreTables_() {
  ['TODO', 'STRAT', 'SAVEJ', 'GOALPLAN', 'INCOME', 'EXPECT', 'TX', 'RECUR', 'BILLCHG', 'UTIL', 'GROCNAMES', 'GROC', 'RECEIPTS', 'FUNDS', 'DEBTS', 'QDR', 'CREDIT'].forEach(key => {
    const def = tdef_(key);
    const sh = buildTableSheet_(def);
    if (key === 'RECUR') buildRecurringTop_(sh, def);
    if (key === 'DEBTS') buildDebtsTop_(sh, def);
    if (key === 'FUNDS') buildFundsGuide_(sh, def);
    if (key === 'TODO') buildTodoTop_(sh, def);
    if (key === 'SAVEJ') buildSavingsSection_(sh);
    applyTableFormats_(sh, def);
  });
}

function buildInfrastructureTables_() {
  ['STAGING', 'RULES', 'CONN', 'LOG'].forEach(key => {
    const def = tdef_(key);
    const sh = buildTableSheet_(def);
    applyTableFormats_(sh, def);
  });
}

function buildDerivedTables_() {
  ['BUDGET', 'PLAN', 'SUMMARY', 'REVIEW', 'NW'].forEach(key => {
    const def = tdef_(key);
    const sh = buildTableSheet_(def);
    if (key === 'NW') buildNetWorthHelper_(sh, def);
    applyTableFormats_(sh, def);
  });
}

/* ---------- Savings & Reserves: "About your accounts", a reading section under the funds table ---------- */

// Account types described in the section, in this order (the owner, 2026-11-15: no savings or investment accounts;
// the retirement accounts and the HSA, then the pension last). A pension is listed even though it is not counted in net worth.
// HEAD: rows above the column headers (section bar, the owner's note from App Setup, the explanation line).
const FUNDS_GUIDE = { TYPES: ['Retirement', 'HSA', 'Pension'], ROWS: 12, GAP: 3, HEAD: 3 };

/**
 * Draws the "About your accounts" section a few rows under the Savings & Reserves table: a reading section, not a
 * working one (the owner, 2026-11-15). One row per retirement account and HSA that counts in net worth, then the
 * pension, each with its name, its type and "What it is": the About This Account text on Accounts, written in plain
 * words without balances or contribution amounts (those change, and the table above shows them). The line under the
 * section bar shows the owner's note from App Setup (SETTING_ACCOUNTS_NOTE, for example what still needs checking), and
 * stays empty when that setting is blank. Holds no entered data: redrawn by buildWorkbook and by every upgrade. If the
 * table is ever extended past this section, the upgrade draws it again under the new end of the table.
 */
function buildFundsGuide_(sh, def) {
  const F = (t) => resolveFormula_(t, null, null);
  const W = def.columns.length;
  const top = def.lastRow + FUNDS_GUIDE.GAP;
  const last = top + FUNDS_GUIDE.HEAD + FUNDS_GUIDE.ROWS;
  if (sh.getMaxRows() < last + 1) sh.insertRowsAfter(sh.getMaxRows(), last + 1 - sh.getMaxRows());
  if (sh.getMaxColumns() < W) sh.insertColumnsAfter(sh.getMaxColumns(), W - sh.getMaxColumns());
  sh.getRange(top, 1, last - top + 1, W).breakApart().setBackground(null).setFontWeight('normal').setFontStyle('normal').setFontSize(10).setFontColor(COLORS.TEXT).setWrap(false).setVerticalAlignment('top')
    .setNumberFormat('General').setHorizontalAlignment('left').setBorder(false, false, false, false, false, false);
  styleSectionBar_(sh.getRange(top, 1, 1, W), 'About your accounts — what each one is and how it works');
  // the owner's note (App Setup → Note at the top of About your accounts); blank setting, empty line
  sh.getRange(top + 1, 1, 1, W).merge().setWrap(true).setFontWeight('bold').setFontColor(COLORS.WARN_FONT);
  sh.getRange(top + 1, 1).setFormula('=IFERROR(IF(TRIM(SETTING_ACCOUNTS_NOTE&"")="","","Note: "&SETTING_ACCOUNTS_NOTE),"")');
  sh.setRowHeight(top + 1, 48);
  sh.getRange(top + 2, 1, 1, W).merge().setValue('A reading section: what your retirement accounts, HSA and pension are and how they work. Balances and what goes in each paycheck are in the table above. The text comes from the About This Account column on the Accounts tab: change the wording there.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9).setWrap(true);
  sh.setRowHeight(top + 2, 30);
  const hdr = top + FUNDS_GUIDE.HEAD;
  // Column F is the table's first calculated column, which tells the tracker where the table ends (syncLastRow_):
  // it must never hold a formula here, so "What it is" spans D to the last column with its formula in D.
  const heads = [['B', 'B', 'Account'], ['C', 'C', 'Type'], ['D', colLetter_(W), 'What it is']];
  heads.forEach(h => { const r = sh.getRange(h[0] + hdr + ':' + h[1] + hdr); if (h[0] !== h[1]) r.merge(); r.setValue(h[2]); styleHeader_(r); });
  const typeTest = FUNDS_GUIDE.TYPES.map(t => '([ACCOUNTS.accountType]="' + t + '")').join('+');
  const cond = '[ACCOUNTS.id]<>"",(' + typeTest + ')>0,(([ACCOUNTS.includeNW]="Yes")+([ACCOUNTS.accountType]="Pension"))>0';
  // in the order of TYPES (the pension last), and in the Accounts order within a type
  const order = 'IFERROR(MATCH([ACCOUNTS.accountType],{"' + FUNDS_GUIDE.TYPES.join('","') + '"},0),99)';
  const list = 'SORT(FILTER([ACCOUNTS.id],' + cond + '),FILTER(' + order + ',' + cond + '),TRUE,FILTER(ROW([ACCOUNTS.id]),' + cond + '),TRUE)';
  const at = (col) => 'INDEX([ACCOUNTS.' + col + '],MATCH(id,[ACCOUNTS.id],0))';
  for (let k = 1; k <= FUNDS_GUIDE.ROWS; k++) {
    const r = hdr + k;
    const cell = (expr) => F('=ARRAYFORMULA(IFERROR(LET(id,INDEX(' + list + ',' + k + '),' + expr + '),""))');
    sh.getRange('B' + r).setFormula(cell(at('name'))).setFontWeight('bold').setWrap(true);
    sh.getRange('C' + r).setFormula(cell(at('accountType')));
    // merge first, then put the formula in the first cell only, so the merged-over cells (F above all) stay empty
    sh.getRange('D' + r + ':' + colLetter_(W) + r).merge().setWrap(true);
    sh.getRange('D' + r).setFormula(cell('IF(' + at('about') + '="","(No description yet: write one in About This Account on the Accounts tab.)",' + at('about') + ')'));
    sh.setRowHeight(r, 70);
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
  const n = FUNDS_GUIDE.ROWS + FUNDS_GUIDE.HEAD + 1, W = def.columns.length;
  if (sh.getMaxRows() < top + n - 1) return;
  const rng = sh.getRange(top, 1, n, W);
  rng.breakApart();
  rng.setValues(Array.from({ length: n }, () => Array(W).fill('')));
  rng.setBackground(null).setFontWeight('normal').setFontStyle('normal').setFontSize(10).setFontColor(COLORS.TEXT).setWrap(false)
    .setBorder(false, false, false, false, false, false);
  for (let r = top; r < top + n; r++) sh.setRowHeight(r, 21);
}
