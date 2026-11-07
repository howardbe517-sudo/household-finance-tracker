/**
 * Household Finance Tracker — Api.gs
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
