/**
 * Minimal in-memory mock of the Google Apps Script Spreadsheet service,
 * just enough to execute the build script end-to-end under Node.js and
 * catch runtime errors, bad references and malformed formulas.
 *
 * It does NOT evaluate formulas — formula cells read back as ''.
 * The in-sheet QA routine (80_QA.gs) covers formula correctness once built.
 */
'use strict';

function colLetter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function colNumber(letters) { let n = 0; for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64); return n; }
function parseA1(a1) {
  const m = /^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/.exec(a1);
  if (!m) throw new Error('Mock: unsupported A1 notation ' + a1);
  const c1 = colNumber(m[1]), r1 = +m[2];
  const c2 = m[3] ? colNumber(m[3]) : c1, r2 = m[4] ? +m[4] : r1;
  return { row: r1, col: c1, numRows: r2 - r1 + 1, numCols: c2 - c1 + 1 };
}

class Range {
  constructor(sheet, row, col, numRows, numCols) {
    if (row < 1 || col < 1 || numRows < 1 || numCols < 1) throw new Error(`Mock: invalid range on ${sheet.name}: r${row} c${col} ${numRows}x${numCols}`);
    if (row + numRows - 1 > sheet.maxRows || col + numCols - 1 > sheet.maxCols) {
      throw new Error(`Mock: range out of bounds on ${sheet.name}: ${colLetter(col)}${row}:${colLetter(col + numCols - 1)}${row + numRows - 1} (sheet is ${sheet.maxRows}x${sheet.maxCols})`);
    }
    Object.assign(this, { sheet, row, col, numRows, numCols });
  }
  _each(fn) { for (let r = 0; r < this.numRows; r++) for (let c = 0; c < this.numCols; c++) fn(this.row + r, this.col + c, r, c); }
  getRow() { return this.row; } getColumn() { return this.col; } getNumRows() { return this.numRows; } getNumColumns() { return this.numCols; }
  getSheet() { return this.sheet; }
  setNumberFormat(f) { for (let r = 0; r < this.numRows; r++) for (let c = 0; c < this.numCols; c++) this.sheet._get(this.row + r, this.col + c).nf = f; return this; }
  getNumberFormat() { return this.sheet._get(this.row, this.col).nf || 'General'; }
  getA1Notation() { return colLetter(this.col) + this.row + (this.numRows > 1 || this.numCols > 1 ? ':' + colLetter(this.col + this.numCols - 1) + (this.row + this.numRows - 1) : ''); }
  setValue(v) { this._each((r, c) => this.sheet._set(r, c, v)); return this; }
  setValues(vals) {
    if (vals.length !== this.numRows || vals[0].length !== this.numCols) throw new Error(`Mock: setValues size mismatch on ${this.sheet.name}!${this.getA1Notation()}: got ${vals.length}x${vals[0].length}`);
    this._each((r, c, i, j) => this.sheet._set(r, c, vals[i][j])); return this;
  }
  setFormula(f) { this._each((r, c) => this.sheet._set(r, c, f, true)); return this; }
  setFormulas(fs) {
    if (fs.length !== this.numRows || fs[0].length !== this.numCols) throw new Error(`Mock: setFormulas size mismatch on ${this.sheet.name}!${this.getA1Notation()}`);
    this._each((r, c, i, j) => this.sheet._set(r, c, fs[i][j], true)); return this;
  }
  getValue() { return this.sheet._get(this.row, this.col).v; }
  getValues() { const out = []; for (let r = 0; r < this.numRows; r++) { const row = []; for (let c = 0; c < this.numCols; c++) row.push(this.sheet._get(this.row + r, this.col + c).v); out.push(row); } return out; }
  getDisplayValues() { return this.getValues().map(row => row.map(v => v === null || v === undefined ? '' : String(v))); }
  getDisplayValue() { const v = this.getValue(); return v === null || v === undefined ? '' : String(v); }
  getFormula() { return this.sheet._get(this.row, this.col).f || ''; }
  getFormulas() { const out = []; for (let r = 0; r < this.numRows; r++) { const row = []; for (let c = 0; c < this.numCols; c++) row.push(this.sheet._get(this.row + r, this.col + c).f || ''); out.push(row); } return out; }
  setDataValidation(dv) { this._each((r, c) => { this.sheet._cell(r, c).dv = dv; }); return this; }
  getDataValidation() { return this.sheet._get(this.row, this.col).dv || null; }
  clearDataValidations() { this._each((r, c) => { const cell = this.sheet.grid.get(r + ',' + c); if (cell) cell.dv = null; }); return this; }
  clear() { this._each((r, c) => this.sheet.grid.delete(r + ',' + c)); return this; }
  clearContent() { this._each((r, c) => { const cell = this.sheet.grid.get(r + ',' + c); if (cell) { cell.v = ''; cell.f = null; } }); return this; }
  merge() { this.sheet.merges.push(this.getA1Notation()); return this; }
  mergeAcross() { for (let r = 0; r < this.numRows; r++) this.sheet.merges.push(colLetter(this.col) + (this.row + r) + ':' + colLetter(this.col + this.numCols - 1) + (this.row + r)); return this; }
  breakApart() { this.sheet.merges = []; return this; }
  getMergedRanges() {
    return this.sheet.merges.map(parseA1).filter(m => !(m.row + m.numRows - 1 < this.row || m.row > this.row + this.numRows - 1 || m.col + m.numCols - 1 < this.col || m.col > this.col + this.numCols - 1)).map(m => ({ getA1Notation: () => colLetter(m.col) + m.row }));
  }
  setNote(n) { this.sheet._get(this.row, this.col).note = n; return this; }
  setNotes(ns) { for (let r = 0; r < this.numRows; r++) for (let c = 0; c < this.numCols; c++) this.sheet._get(this.row + r, this.col + c).note = ns[r][c]; return this; }
  getNote() { return this.sheet._get(this.row, this.col).note || ''; }
  clearNote() { this._each((r, c) => { const cell = this.sheet.grid.get(r + ',' + c); if (cell) cell.note = ''; }); return this; }
}
['setBackground', 'setFontColor', 'setFontWeight', 'setFontSize', 'setFontStyle', 'setWrap', 'setVerticalAlignment', 'setHorizontalAlignment', 'setBorder', 'setStrikethrough', 'setFontLine', 'setFontFamily', 'setBackgrounds', 'setFontColors', 'setTextStyle', 'activate'].forEach(m => { Range.prototype[m] = function () { return this; }; });

class Protection {
  constructor(sheet) { this.sheet = sheet; this.warningOnly = false; this.unprotected = []; }
  setDescription(d) { this.description = d; return this; }
  setWarningOnly(b) { this.warningOnly = b; return this; }
  setUnprotectedRanges(rs) { this.unprotected = rs; return this; }
  remove() { this.sheet.protections = this.sheet.protections.filter(p => p !== this); }
}

class Sheet {
  constructor(ss, name) {
    Object.assign(this, { ss, name, grid: new Map(), maxRows: 1000, maxCols: 26, frozenRows: 0, frozenCols: 0, cfRules: [], merges: [], protections: [], colWidths: {}, rowHeights: {}, hiddenGridlines: false });
    this.sheetId = Sheet._nextId = (Sheet._nextId || 0) + 1;
  }
  getSheetId() { return this.sheetId; }
  _cell(r, c) { const k = r + ',' + c; let cell = this.grid.get(k); if (!cell) { cell = { v: '', f: null, dv: null }; this.grid.set(k, cell); } return cell; }
  _get(r, c) { return this.grid.get(r + ',' + c) || { v: '', f: null, dv: null }; }
  _set(r, c, v, isFormula) {
    if (r > this.maxRows || c > this.maxCols) throw new Error(`Mock: write outside sheet ${this.name} at ${colLetter(c)}${r}`);
    const cell = this._cell(r, c);
    if (isFormula || (typeof v === 'string' && v.charAt(0) === '=')) { cell.f = v; cell.v = ''; this.ss.allFormulas.push({ sheet: this.name, a1: colLetter(c) + r, f: v }); }
    else { cell.v = v === undefined || v === null ? '' : v; cell.f = null; }
  }
  getName() { return this.name; }
  getRange(a, b, c, d) {
    if (typeof a === 'string') { const p = parseA1(a.replace(/\$/g, '')); return new Range(this, p.row, p.col, p.numRows, p.numCols); }
    return new Range(this, a, b, c === undefined ? 1 : c, d === undefined ? 1 : d);
  }
  getMaxRows() { return this.maxRows; } getMaxColumns() { return this.maxCols; }
  getLastRow() { let last = 0; for (const [k, cell] of this.grid) { if (cell.v !== '' || cell.f) { const r = +k.split(',')[0]; if (r > last) last = r; } } return last; }
  getLastColumn() { let last = 0; for (const [k, cell] of this.grid) { if (cell.v !== '' || cell.f) { const c = +k.split(',')[1]; if (c > last) last = c; } } return last; }
  getDataRange() { return new Range(this, 1, 1, Math.max(1, this.getLastRow()), Math.max(1, this.getLastColumn())); }
  insertRowsAfter(after, n) { this.maxRows += n; return this; }
  insertRowsBefore(before, n) { this.maxRows += n; return this; }
  insertColumnsAfter(after, n) { this.maxCols += n; return this; }
  deleteRows(start, n) {
    const ng = new Map();
    for (const [k, cell] of this.grid) { const [r, c] = k.split(',').map(Number); if (r >= start && r < start + n) continue; ng.set((r >= start + n ? r - n : r) + ',' + c, cell); }
    this.grid = ng; this.maxRows -= n; return this;
  }
  deleteColumns(start, n) {
    const ng = new Map();
    for (const [k, cell] of this.grid) { const [r, c] = k.split(',').map(Number); if (c >= start && c < start + n) continue; ng.set(r + ',' + (c >= start + n ? c - n : c), cell); }
    this.grid = ng; this.maxCols -= n; return this;
  }
  setColumnWidth(c, w) { if (c < 1 || c > this.maxCols) throw new Error('Those columns are out of bounds. (mock: column ' + c + ' on ' + this.name + ', ' + this.maxCols + ' wide)'); this.colWidths[c] = w; return this; }
  setColumnWidths(c, n, w) { if (c < 1 || c + n - 1 > this.maxCols) throw new Error('Those columns are out of bounds. (mock: columns ' + c + '+' + n + ' on ' + this.name + ')'); for (let i = 0; i < n; i++) this.colWidths[c + i] = w; return this; }
  setRowHeight(r, h) { if (r < 1 || r > this.maxRows) throw new Error('Those rows are out of bounds. (mock: row ' + r + ' on ' + this.name + ', ' + this.maxRows + ' tall)'); this.rowHeights[r] = h; return this; }
  setFrozenRows(n) { this.frozenRows = n; return this; } setFrozenColumns(n) { this.frozenCols = n; return this; }
  clear() { this.grid = new Map(); this.merges = []; return this; }
  clearConditionalFormatRules() { this.cfRules = []; return this; }
  setConditionalFormatRules(rules) { this.cfRules = rules; return this; }
  getConditionalFormatRules() { return this.cfRules; }
  setHiddenGridlines(b) { this.hiddenGridlines = b; return this; }
  hideSheet() { this.hidden = true; return this; }
  showSheet() { this.hidden = false; return this; }
  isSheetHidden() { return this.hidden === true; }
  protect() { const p = new Protection(this); this.protections.push(p); return p; }
  getProtections() { return this.protections.slice(); }
  setTabColor() { return this; }
  newChart() { const sheet = this; const c = { ranges: [], options: {}, type: null, pos: null }; const b = { setChartType(t) { c.type = t; return b; }, addRange(r) { c.ranges.push(r); return b; }, setNumHeaders() { return b; }, setPosition(r, col) { c.pos = [r, col]; return b; }, setOption(k, v) { c.options[k] = v; return b; }, build() { return c; } }; c.modify = () => b; c.getContainerInfo = () => ({ getAnchorRow: () => c.pos[0], getAnchorColumn: () => c.pos[1] }); return b; }
  insertChart(c) { (this.charts = this.charts || []).push(c); return this; }
  getCharts() { return (this.charts || []).slice(); }
  updateChart(c) { return this; }
  removeChart(c) { this.charts = (this.charts || []).filter(x => x !== c); return this; }
  activate() { this.ss.active = this; return this; }
}

class NamedRange { constructor(ss, name, range) { this.ss = ss; this.name = name; this.range = range; } getName() { return this.name; } getRange() { return this.range; } remove() { this.ss.namedRanges.delete(this.name); } }

class Spreadsheet {
  constructor() { this.sheets = [new Sheet(this, 'Sheet1')]; this.namedRanges = new Map(); this.allFormulas = []; this.active = this.sheets[0]; this.name = 'Untitled spreadsheet'; this.toasts = []; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { if (this.getSheetByName(n)) throw new Error('Mock: sheet exists ' + n); const s = new Sheet(this, n); this.sheets.push(s); return s; }
  deleteSheet(s) { if (this.sheets.length === 1) throw new Error('Mock: cannot delete the only sheet'); this.sheets = this.sheets.filter(x => x !== s); }
  getSheets() { return this.sheets.slice(); }
  getNamedRanges() { return [...this.namedRanges.values()]; }
  setNamedRange(name, range) { this.namedRanges.set(name, new NamedRange(this, name, range)); }
  getRangeByName(name) { const nr = this.namedRanges.get(name); return nr ? nr.range : null; }
  setActiveSheet(s) { this.active = s; return s; }
  getActiveSheet() { return this.active; }
  getActiveRange() { return this.activeRange || null; }
  moveActiveSheet(pos) { this.sheets = this.sheets.filter(s => s !== this.active); this.sheets.splice(pos - 1, 0, this.active); }
  getId() { return 'MOCK_SPREADSHEET_ID'; }
  getName() { return this.name; } rename(n) { this.name = n; }
  getSpreadsheetTimeZone() { return 'America/Detroit'; }
  toast(msg) { this.toasts.push(msg); }
  flush() {}
  getUrl() { return 'https://docs.google.com/spreadsheets/d/MOCK'; }
}

function dvBuilder() {
  const spec = {};
  const b = {
    requireCheckbox() { spec.type = 'checkbox'; return b; },
    requireDate() { spec.type = 'date'; return b; },
    requireNumberBetween(lo, hi) { spec.type = 'number'; spec.lo = lo; spec.hi = hi; return b; },
    requireValueInRange(r, show) { spec.type = 'range'; spec.range = r; return b; },
    requireValueInList(vals) { spec.type = 'list'; spec.values = vals; return b; },
    setAllowInvalid(v) { spec.allowInvalid = v; return b; },
    setHelpText(t) { spec.help = t; return b; },
    build() { return spec; },
  };
  return b;
}
function cfBuilder() {
  const rule = {};
  const b = {
    whenFormulaSatisfied(f) { rule.formula = f; return b; },
    setRanges(rs) { rule.ranges = rs; return b; },
    setBackground(c) { rule.bg = c; return b; }, setFontColor(c) { rule.fg = c; return b; },
    setBold(v) { rule.bold = v; return b; }, setStrikethrough(v) { rule.strike = v; return b; }, setItalic(v) { rule.italic = v; return b; },
    build() { return rule; },
  };
  return b;
}

function makeGlobals() {
  const ss = new Spreadsheet();
  const logs = [];
  const alerts = [];
  const dialogs = [];
  const mails = [];
  const props = {};
  const triggers = [];
  const fetches = [];
  const ui = {
    ButtonSet: { OK: 'OK', OK_CANCEL: 'OK_CANCEL', YES_NO: 'YES_NO', YES_NO_CANCEL: 'YES_NO_CANCEL' },
    Button: { OK: 'OK', CANCEL: 'CANCEL', YES: 'YES', NO: 'NO' },
    alert(title, msg) { alerts.push([title, msg]); return 'YES'; },
    promptAnswer: null,
    prompt(title, msg) { const a = ui.promptAnswer; return { getSelectedButton: () => (a === null ? 'CANCEL' : 'OK'), getResponseText: () => (a === null ? '' : String(a)) }; },
    createMenu() { const m = { addItem: () => m, addSeparator: () => m, addSubMenu: () => m, addToUi: () => m }; return m; },
    showSidebar(h) { dialogs.push(['sidebar', h]); },
    showModalDialog(h, t) { dialogs.push(['modal', t]); },
  };
  // UrlFetchApp: tests register a handler (url, payloadObj) => ({ code, body })
  const fetchHandler = { fn: null };
  const UrlFetchApp = {
    fetch(url, opts) {
      const payload = opts && opts.payload ? JSON.parse(opts.payload) : {};
      fetches.push({ url, payload });
      if (!fetchHandler.fn) throw new Error('Mock: no UrlFetchApp handler registered for ' + url);
      const res = fetchHandler.fn(url, payload);
      const code = res.code || 200;
      const text = typeof res.body === 'string' ? res.body : JSON.stringify(res.body || {});
      return { getResponseCode: () => code, getContentText: () => text };
    },
  };
  const htmlOut = (content) => { const o = { _c: content, setWidth() { return o; }, setHeight() { return o; }, setTitle() { return o; }, getContent() { return content; } }; return o; };
  const trig = (fn) => ({ getHandlerFunction: () => fn, getUniqueId: () => fn + '-' + triggers.length });
  const g = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      getUi: () => ui,
      newDataValidation: dvBuilder,
      newConditionalFormatRule: cfBuilder,
      BorderStyle: { SOLID: 'SOLID', SOLID_MEDIUM: 'SOLID_MEDIUM' },
      ProtectionType: { SHEET: 'SHEET', RANGE: 'RANGE' },
      CopyPasteType: { PASTE_FORMULA: 'PASTE_FORMULA' },
      flush() {},
    },
    Utilities: {
      sleep() {},
      DigestAlgorithm: { MD5: 'MD5' }, Charset: { UTF_8: 'UTF_8' },
      computeDigest(alg, text) { const h = require('crypto').createHash('md5').update(String(text), 'utf8').digest(); return Array.from(h).map(b => (b > 127 ? b - 256 : b)); },
      formatDate(d, tz, fmt) { const p = n => String(n).padStart(2, '0'); return fmt.replace('yyyy', d.getFullYear()).replace('MMMM', d.toLocaleString('en-US', { month: 'long' })).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate())).replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds())).replace("'T'", 'T'); },
      getUuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => { const r = Math.random() * 16 | 0; return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); },
    },
    Session: { getScriptTimeZone: () => 'America/Detroit', getActiveUser: () => ({ getEmail: () => 'tester@example.com' }), getEffectiveUser: () => ({ getEmail: () => 'tester@example.com' }) },
    MailApp: { sendEmail: (to, subject, body) => { mails.push({ to, subject, body }); } },
    Logger: { log: (m) => logs.push(String(m)) },
    PropertiesService: { getScriptProperties: () => ({ getProperty(k) { return Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null; }, setProperty(k, v) { props[k] = String(v); return this; }, deleteProperty(k) { delete props[k]; return this; }, getProperties() { return Object.assign({}, props); } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
    ContentService: { createTextOutput: (t) => ({ _t: t, setMimeType() { return this; }, getContent() { return this._t; } }), MimeType: { JSON: 'JSON' } },
    UrlFetchApp,
    Charts: { ChartType: { LINE: 'LINE', COLUMN: 'COLUMN', BAR: 'BAR' } },
    HtmlService: { createHtmlOutputFromFile: (name) => htmlOut('<file:' + name + '>'), createHtmlOutput: (html) => htmlOut(html), createTemplateFromFile: (name) => ({ evaluate: () => htmlOut('<template:' + name + '>') }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: (t) => { const i = triggers.indexOf(t); if (i >= 0) triggers.splice(i, 1); },
      newTrigger: (fn) => { const b = { timeBased: () => b, everyDays: () => b, atHour: () => b, create: () => { const t = trig(fn); triggers.push(t); return t; } }; return b; },
    },
    console,
    __ss: ss, __logs: logs, __alerts: alerts, __dialogs: dialogs, __mails: mails, __props: props, __triggers: triggers, __fetches: fetches, __fetchHandler: fetchHandler,
  };
  return g;
}

module.exports = { makeGlobals, colLetter, parseA1 };
