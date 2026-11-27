/**
 * Household Finance Tracker — Helpers.gs
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

/** Resolve formula tokens (see Config.gs header). def/row may be null for off-table formulas. */
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
  else if (maxR > rows) sh.deleteRows(rows + 1, maxR - rows); // SAFETY-APPROVED: trims empty rows on a sheet being (re)built by buildWorkbook
  if (maxC < cols) sh.insertColumnsAfter(maxC, cols - maxC);
  else if (maxC > cols) sh.deleteColumns(cols + 1, maxC - cols); // SAFETY-APPROVED: trims empty columns on a sheet being (re)built by buildWorkbook
}

/** Make a tab at least rows × cols, never smaller: for a tab that holds more than one table (To-Do & Reminders), where trimming would cut off the tables below. */
function growSheet_(sh, rows, cols) {
  const maxR = sh.getMaxRows(), maxC = sh.getMaxColumns();
  if (maxR < rows) sh.insertRowsAfter(maxR, rows - maxR);
  if (maxC < cols) sh.insertColumnsAfter(maxC, cols - maxC);
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

/**
 * The breakdown under a summary box, one item per line (the owner, 2026-11-26): the names in one merged cell on the left and the
 * amounts in one on the right, each a formula or text whose lines are joined with CHAR(10), so every amount sits beside its name.
 * Both must give the same number of lines. sh: the sheet; row: the row; names/amounts: A1 column ranges such as 'A:C' and 'D:D';
 * bg: the box's fill (null for none). Returns nothing; the caller sets the row height (boxLinesHeight_).
 */
function putBoxLines_(sh, row, names, amounts, namesValue, amountsValue, bg) {
  // a dotted line from each name to its amount (the owner, 2026-11-27): dots after the name run to the edge of the names cell, dots
  // before the amount run back to the edge of the amounts cell; the cells clip them, so the line meets in the middle. A line that
  // starts with ~ is a caption: no dots, and the ~ is dropped. A little space keeps the text off the box edges.
  const body = (v) => String(v).charAt(0) === '=' ? String(v).slice(1) : '"' + String(v).replace(/"/g, '""') + '"';
  namesValue = '=REGEXREPLACE(REGEXREPLACE(' + body(namesValue) + ',"(?m)^([^~\\n][^\\n]*)$",CHAR(160)&"$1 "&REPT(". ",60)),"(?m)^~",CHAR(160))';
  amountsValue = '=REGEXREPLACE(' + body(amountsValue) + ',"(?m)^([^\\n]+)$",REPT(" .",40)&" $1"&CHAR(160)&CHAR(160))';
  const set = (cols, v, align) => {
    const [c1, c2] = cols.split(':');
    const r = sh.getRange(c1 + row + ':' + c2 + row);
    if (c1 !== c2) r.merge();
    if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v);
    r.setFontSize(11).setFontColor(COLORS.BOX_LINES).setFontStyle('normal').setHorizontalAlignment(align).setVerticalAlignment('top')
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
    if (bg) r.setBackground(bg);
  };
  set(names, namesValue, 'left');
  set(amounts, amountsValue, 'right');
}

/**
 * An explanation kept as a hover note instead of a line on the tab (the owner, 2026-11-26: as little to read on each tab as
 * possible). The note goes on anchorA1 (a section title); rowToQuiet, if given, is the row that held the line: left empty and short.
 */
function hoverNote_(sh, anchorA1, text, rowToQuiet) {
  sh.getRange(anchorA1).setNote(text);
  if (rowToQuiet) sh.setRowHeight(rowToQuiet, 6);
}

/** Row height for a box's breakdown of n lines at 11 pt. Pure. */
function boxLinesHeight_(n) { return Math.max(1, n) * 19 + 8; }

/** Lines of text joined for a breakdown cell: a formula piece per line, or plain text when every piece is a quoted string. */
function boxJoin_(pieces) { return '=' + pieces.join('&CHAR(10)&'); }

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
  if (spec.list) return b.requireValueInRange(listRange_(spec.list), true).setAllowInvalid(!spec.strict).setHelpText(spec.strict ? 'Pick a value from the list (add new ones below the list on the Categories tab).' : 'Pick a value from the list on the Categories tab.').build();
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
  if (def.sharesSheet) { growSheet_(sh, def.lastRow + 5, n); return buildSharedTable_(sh, def); }
  ensureSheetSize_(sh, def.lastRow + 5, totalCols);
  sh.clearConditionalFormatRules();
  if (def.keepExtras) {
    // Only the table columns are reset; helper areas to the right (e.g. reference lists) survive.
    const tableArea = sh.getRange(1, 1, sh.getMaxRows(), n);
    tableArea.clear(); // SAFETY-APPROVED: table area reset during buildWorkbook on a fresh sheet
    tableArea.clearDataValidations();
  } else {
    sh.clear(); // SAFETY-APPROVED: sheet reset during buildWorkbook on a fresh sheet
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
  sh.setFrozenRows(def.frozenRows !== undefined ? def.frozenRows : def.headerRow);
  if (def.freezeCols) sh.setFrozenColumns(def.freezeCols);
  setNamedRange_('TBL_' + def.key, sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, n));
  if (def.readOnly) {
    const p = sh.protect().setDescription(def.sheet + ' is calculated — edit the raw tables instead.');
    p.setWarningOnly(true);
  }
  return sh;
}

/**
 * A table on a tab another table built (sharesSheet in Config.gs, e.g. the Savings Journal under the To-Do checklist): writes
 * only its header and its own rows, and leaves the rest of the tab (the other tables, their formats and frozen rows) alone.
 * Its title and note are drawn by the tab's own presentation builder.
 */
function buildSharedTable_(sh, def) {
  const n = def.columns.length;
  const header = sh.getRange(def.headerRow, 1, 1, n);
  header.setValues([def.columns.map(c => c.h)]);
  styleHeader_(header);
  sh.setRowHeight(def.headerRow, 42);
  def.columns.forEach((c, i) => { if (c.w) sh.setColumnWidth(i + 1, c.w); });
  applyColumnRules_(def, def.firstRow, def.lastRow);
  setNamedRange_('TBL_' + def.key, sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, n));
  return sh;
}

/** The last row to read for a table: the sheet's last row, or for a fixedRows table (another table sits below it) its own lastRow. */
function tableReadEnd_(def, sh) {
  const last = sh.getLastRow();
  return def.fixedRows ? Math.min(last, def.lastRow) : last;
}

/* ---------- conditional formatting helpers ---------- */

/**
 * The conditional formats already on a tab that lie wholly outside rows fromRow..toRow. A tab holding more than one table
 * (To-Do & Reminders) keeps the other tables' formats when one table redraws its own.
 */
function rulesOutsideRows_(sh, fromRow, toRow) {
  return sh.getConditionalFormatRules().filter(r => {
    let rs;
    try { rs = r.getRanges ? r.getRanges() : (r.ranges || []); } catch (e) { return false; }
    return rs.length > 0 && rs.every(x => x.getRow() + x.getNumRows() - 1 < fromRow || x.getRow() > toRow);
  });
}

/**
 * Every other row a shade darker (the owner, 2026-11-27: easier to tell rows apart), as the last conditional format on the sheet so
 * a rule that colors a row for a reason (over budget, deleted, needs review) still wins. Rows with nothing in the range's first
 * column stay plain. A band rule already there for the same table (same top-left cell, whatever its length) is replaced, so running
 * it again, or after the table grew, adds nothing.
 */
function addBandRule_(sh, range) {
  const top = range.getRow(), col = colLetter_(range.getColumn()), a1 = range.getA1Notation();
  const isBand = (r) => {
    try {
      const c = r.getBooleanCondition ? r.getBooleanCondition() : null;
      const f = c ? String(c.getCriteriaValues()[0]) : String(r.formula || '');
      const rs = r.getRanges ? r.getRanges().map(x => x.getA1Notation()) : (r.ranges || []).map(x => x.getA1Notation ? x.getA1Notation() : String(x));
      return /ISEVEN\(ROW\(\)\)/.test(f) && rs.some(x => x.split(':')[0] === a1.split(':')[0]); // same top-left cell: the same table, even after it grew
    } catch (e) { return false; }
  };
  const rules = sh.getConditionalFormatRules().filter(r => !isBand(r));
  rules.push(cfRule_(range, '=AND(ISEVEN(ROW()),$' + col + top + '<>"")', COLORS.BAND));
  sh.setConditionalFormatRules(rules);
}

/**
 * A recurring bill's next payment date, as an array expression over Recurring Payments (the owner, 2026-11-27: the nanny still said
 * Nov 20 a week later). Next Payment Date is typed once; a date that has passed steps forward by the bill's frequency (a week, two
 * weeks, or 1, 3, 6 or 12 months) until it is today or later. With no date, the next time the Due Day comes round.
 * ref(key) gives the column reference for 'nextPayment', 'frequency' and 'dueDay' ([RECUR.x] or [@@x]).
 */
function recurNextDueExpr_(ref) {
  const np = ref('nextPayment'), f = ref('frequency'), dd = ref('dueDay');
  const days = 'IF(' + f + '="Weekly",7,14)';
  const isDays = '(' + f + '="Weekly")+(' + f + '="Biweekly")';
  const months = 'IF(' + f + '="Quarterly",3,IF(' + f + '="Semiannual",6,IF(' + f + '="Annual",12,1)))';
  const k = 'CEILING(((YEAR(TODAY())-YEAR(' + np + '))*12+MONTH(TODAY())-MONTH(' + np + '))/' + months + ')*' + months;
  const byMonths = 'EDATE(' + np + ',' + k + '+IF(EDATE(' + np + ',' + k + ')<TODAY(),' + months + ',0))';
  const fromDay = 'IF(DAY(TODAY())<=' + dd + ',DATE(YEAR(TODAY()),MONTH(TODAY()),IF(' + dd + '>DAY(EOMONTH(TODAY(),0)),DAY(EOMONTH(TODAY(),0)),' + dd + ')),DATE(YEAR(TODAY()),MONTH(TODAY())+1,IF(' + dd + '>DAY(EOMONTH(TODAY(),1)),DAY(EOMONTH(TODAY(),1)),' + dd + ')))';
  return 'ARRAYFORMULA(IF(N(+' + np + ')=0,IF(N(+' + dd + ')>0,' + fromDay + ',""),IF(' + np + '>=TODAY(),' + np + ',IF(' + isDays + '>0,' + np + '+' + days + '*CEILING((TODAY()-' + np + ')/' + days + '),' + byMonths + '))))';
}

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

/**
 * Read a table as an array of objects keyed by column key, with __row. Skips empty rows. Reading never creates a tab.
 * A table whose tab carries something below it (Savings & Reserves has the "About your accounts" reading section,
 * whose text sits in column A) sets idRegex in Config.gs: only rows whose first column matches it are records.
 */
function readTable_(def) {
  const sh = ss_().getSheetByName(def.sheet);
  if (!sh) return [];
  const last = Math.max(tableReadEnd_(def, sh), def.firstRow);
  // A column added to the schema exists on the tab only after Upgrade workbook. Until then read what is
  // there and treat the new columns as blank, so the new code never stops a sync on an older tab.
  const n = Math.min(def.columns.length, sh.getMaxColumns());
  if (last < def.firstRow) return [];
  const values = sh.getRange(def.firstRow, 1, last - def.firstRow + 1, n).getValues();
  const anchor = anchorCol_(def) - 1;
  const idOk = def.idRegex ? new RegExp(def.idRegex) : null;
  const out = [];
  values.forEach((row, i) => {
    if (row[anchor] === '' || row[anchor] === null) return;
    if (idOk && !idOk.test(String(row[0]))) return;
    const o = { __row: def.firstRow + i };
    def.columns.forEach((c, j) => { o[c.key] = j < n ? row[j] : ''; });
    out.push(o);
  });
  return out;
}

/**
 * A fund's current amount, worked out as Savings & Reserves' Current Amount does it (TABLES.FUNDS.current). Pure;
 * used by runQA and the AI snapshot. A fund with a Backing Account is that account's balance; any other fund is
 * Starting Amount + contributions (Savings and Transfer rows that name the fund) − withdrawals (Expense and Debt
 * Payment rows that name it, less Refunds). Soft-deleted rows are left out.
 * accountsById: { 'ACC-001': account row }. Returns { current, contributions, withdrawals, backed }.
 */
function fundCurrent_(fund, txRows, accountsById) {
  const n = (v) => { const x = Number(v); return (v === '' || v === null || v === undefined || isNaN(x)) ? 0 : x; };
  let contributions = 0, withdrawals = 0;
  (txRows || []).forEach(t => {
    if (t.isDeleted === true || !fund.id || t.fundId !== fund.id) return;
    if (t.type === 'Savings' || t.type === 'Transfer') contributions += n(t.amount);
    else if (t.type === 'Expense' || t.type === 'Debt Payment') withdrawals += n(t.amount);
    else if (t.type === 'Refund') withdrawals -= n(t.amount);
  });
  const backed = !!fund.backingAccount;
  const acc = backed ? (accountsById || {})[fund.backingAccount] : null;
  const current = backed ? n(acc ? acc.currentBalance : 0) : n(fund.starting) + contributions - withdrawals;
  return { current, contributions, withdrawals, backed };
}

/**
 * A fund's Status as the Savings & Reserves formula gives it, for a current amount worked out by fundCurrent_. Pure.
 * Funded (target reached), Past Target Date, Behind (Planned Monthly below what the target date needs), else On Track.
 */
function fundStatus_(fund, current, today) {
  const n = (v) => { const x = Number(v); return (v === '' || v === null || v === undefined || isNaN(x)) ? 0 : x; };
  const target = n(fund.target);
  if (target > 0 && current >= target) return 'Funded';
  const td = (fund.targetDate instanceof Date && !isNaN(fund.targetDate)) ? fund.targetDate : null;
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (td && td < day) return 'Past Target Date';
  if (td && fund.plannedMonthly !== '' && fund.plannedMonthly !== null && fund.plannedMonthly !== undefined) {
    const needed = Math.max(target - current, 0);
    const months = Math.max((td.getFullYear() - today.getFullYear()) * 12 + td.getMonth() - today.getMonth(), 1);
    if (n(fund.plannedMonthly) < (needed <= 0 ? 0 : needed / months)) return 'Behind';
  }
  return 'On Track';
}

function findRowById_(def, id) {
  const sh = ss_().getSheetByName(def.sheet);
  if (!sh) return -1;
  const last = tableReadEnd_(def, sh);
  if (last < def.firstRow) return -1;
  const ids = sh.getRange(def.firstRow, 1, last - def.firstRow + 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return def.firstRow + i;
  return -1;
}

/** Next empty data row (first blank anchor cell at/after firstRow). */
function nextEmptyRow_(def) {
  const sh = getOrCreateSheet_(def.sheet);
  const anchor = anchorCol_(def);
  const last = tableReadEnd_(def, sh);
  if (last < def.firstRow) return def.firstRow;
  const vals = sh.getRange(def.firstRow, anchor, last - def.firstRow + 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) if (vals[i][0] === '' || vals[i][0] === null) return def.firstRow + i;
  if (def.fixedRows && last >= def.lastRow) throw new Error(def.title + ' is full (' + (def.lastRow - def.firstRow + 1) + ' rows). Clear a finished row first.');
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
  // a tab not yet upgraded may be narrower than the schema: widen it (the upgrade writes the new headers)
  if (sh.getMaxColumns() < def.columns.length) sh.insertColumnsAfter(sh.getMaxColumns(), def.columns.length - sh.getMaxColumns());
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
  // Savings & Reserves keeps a reading section a few rows under the table: lift it out of the way before the table grows
  if (def.key === 'FUNDS' && typeof eraseFundsGuide_ === 'function') eraseFundsGuide_(sh, def);
  applyColumnRules_(def, def.lastRow + 1, newLastRow);
  def.lastRow = newLastRow;
  setNamedRange_('TBL_' + def.key, sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, def.columns.length));
  applyTableFormats_(sh, def);
  if (def.key === 'FUNDS' && typeof buildFundsGuide_ === 'function') buildFundsGuide_(sh, def);
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

/** A pending card charge older than this many days is left out of what is owed (it most likely never posted). */
const CARD_PENDING_DAYS = 10;

/**
 * Charges still pending on a set of card accounts, as the Financial Summary adds them to what is owed (the owner,
 * 2026-11-16). Pure. Reads Import Staging rows (every bank charge lands there first, reviewed or not): Pending?
 * ticked, not Superseded (its posted version has arrived) or Removed, dated within CARD_PENDING_DAYS of today,
 * summing the bank's own signed amount (a charge is positive, a payment or credit negative).
 */
function cardPendingCutoff_(today) {
  const t = today instanceof Date ? today : new Date();
  // Calendar days, like the Sheet's TODAY()-10, so a clock change never moves the boundary.
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() - CARD_PENDING_DAYS).getTime();
}

function cardPending_(stagingRows, accountIds, today) {
  const ids = {};
  (accountIds || []).forEach(id => { ids[id] = true; });
  const cutoff = cardPendingCutoff_(today);
  return Math.round((stagingRows || []).reduce((s, r) => {
    if (r.pending !== true || r.status === 'Superseded' || r.status === 'Removed' || !ids[r.accountId]) return s;
    if (!(r.date instanceof Date) || r.date.getTime() < cutoff) return s;
    const a = Number(r.amount);
    return isFinite(a) ? s + a : s;
  }, 0) * 100) / 100;
}

/* ---------- bank charges still waiting on Import Staging (the owner, 2026-11-27) ---------- */
// A charge that has not been reviewed and imported yet still counts as spending, as flexible spending under
// WAITING_LABEL, until its review moves it into its real category. Import Staging's Counts as Spending? column decides in
// the Sheet; isWaitingCharge_ is the same test here. WAITING_LABEL, WAITING_STATUSES, WAITING_NOT_SPENDING_BANK and the
// sum (WAITING_SUM_TPL) live in Config.gs.

/** What the test needs from the other tables: live Transactions (account, day, amount) and the bills that record themselves. Pure. */
function waitingContext_(txRows, recurRows) {
  const day = (d) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  const tx = {}, auto = {};
  (txRows || []).forEach(t => { if (t.isDeleted !== true && t.date instanceof Date && t.amount !== '') tx[t.accountId + '|' + day(t.date) + '|' + Number(t.amount).toFixed(2)] = true; });
  (recurRows || []).forEach(r => { if (r.autoRecord === true && r.active === true) auto[r.category + '|' + r.subcategory] = true; });
  return { tx, auto, day };
}

/** Is this Import Staging row a charge that counts as spending while it waits? Mirrors the Counts as Spending? formula. Pure. */
function isWaitingCharge_(r, ctx) {
  const a = Number(r && r.amount);
  if (!r || !(r.date instanceof Date) || WAITING_STATUSES.indexOf(r.status) < 0 || r.importedTxId) return false;
  if (!(r.suggestedType === 'Expense' || !r.suggestedType) || r.amount === '' || !isFinite(a) || !(a > 0) || Math.round(a * 100) === 100) return false;
  if (new RegExp(WAITING_NOT_SPENDING_BANK).test(String(r.bankCategory || ''))) return false;
  const c = ctx || waitingContext_([], []);
  if (c.tx[r.accountId + '|' + c.day(r.date) + '|' + a.toFixed(2)]) return false; // already on Transactions
  if (r.suggestedCategory && c.auto[r.suggestedCategory + '|' + r.suggestedSubcategory]) return false; // a bill that records itself
  return true;
}

/** Waiting charges dated from `from` to `to` (both included, whole days), added up. Pure. */
function waitingSpend_(stagingRows, from, to, ctx) {
  const lo = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const hi = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((stagingRows || []).reduce((s, r) => {
    if (!isWaitingCharge_(r, ctx)) return s;
    const t = new Date(r.date.getFullYear(), r.date.getMonth(), r.date.getDate()).getTime();
    return t >= lo && t <= hi ? s + Number(r.amount) : s;
  }, 0) * 100) / 100;
}

/**
 * The waiting charges as stand-in transactions, for the checks and the AI snapshot that recompute totals from Transactions:
 * flexible expenses in WAITING_LABEL, marked _waiting so a month is never counted as "a month with spending" because of them
 * (the Sheet counts those months from Transactions only). Pure.
 */
function waitingAsTransactions_(stagingRows, ctx) {
  return (stagingRows || []).filter(r => isWaitingCharge_(r, ctx)).map(r => ({
    id: r.importId, date: r.date, month: new Date(r.date.getFullYear(), r.date.getMonth(), 1), description: r.rawDescription,
    amount: Number(r.amount), type: 'Expense', category: WAITING_LABEL, subcategory: '', spendingType: 'Flexible', needWant: '',
    accountId: r.accountId, isDeleted: false, _waiting: true,
  }));
}

/** The same sum as a formula over Import Staging, for dates fromExpr to toExpr (Sheet expressions). Template text: resolve with resolveFormula_. */
function waitingSpendExpr_(fromExpr, toExpr) {
  return WAITING_SUM_TPL.replace('{from}', fromExpr).replace('{to}', toExpr);
}
