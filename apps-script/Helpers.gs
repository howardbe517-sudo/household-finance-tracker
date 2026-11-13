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

/** Read a table as an array of objects keyed by column key, with __row. Skips empty rows. Reading never creates a tab. */
function readTable_(def) {
  const sh = ss_().getSheetByName(def.sheet);
  if (!sh) return [];
  const last = Math.max(sh.getLastRow(), def.firstRow);
  // A column added to the schema exists on the tab only after Upgrade workbook. Until then read what is
  // there and treat the new columns as blank, so the new code never stops a sync on an older tab.
  const n = Math.min(def.columns.length, sh.getMaxColumns());
  if (last < def.firstRow) return [];
  const values = sh.getRange(def.firstRow, 1, last - def.firstRow + 1, n).getValues();
  const anchor = anchorCol_(def) - 1;
  const out = [];
  values.forEach((row, i) => {
    if (row[anchor] === '' || row[anchor] === null) return;
    const o = { __row: def.firstRow + i };
    def.columns.forEach((c, j) => { o[c.key] = j < n ? row[j] : ''; });
    out.push(o);
  });
  return out;
}

function findRowById_(def, id) {
  const sh = ss_().getSheetByName(def.sheet);
  if (!sh) return -1;
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
