/**
 * Household Finance Tracker — Plaid.gs
 * The bank feed. Talks to Plaid from Apps Script (UrlFetchApp); no server.
 *
 *  - Connect a bank: Plaid Hosted Link (Plaid hosts the connect page, including
 *    the banks' own OAuth logins) → public token → access token kept in Script
 *    Properties → Connections row + account mapping.
 *  - Nightly sync: /transactions/sync per connection (cursor-based) → Import
 *    Staging via Import.gs; balances → Accounts. Balance-only connections use
 *    /accounts/get.
 *  - Every write is preceded by a layout check; a changed layout pauses the
 *    sync with a message instead of writing into the wrong column.
 *
 * Secrets: PLAID_CLIENT_ID and PLAID_SECRET are typed into Script Properties
 * by the owner (Project Settings → Script Properties). Access tokens are
 * stored there by the connect flow. None of them appear on any tab.
 */

const PLAID_HOSTS = { production: 'https://production.plaid.com', sandbox: 'https://sandbox.plaid.com' };
// Plaid refuses a Link token with no products ("must provide at least one product") and never
// accepts "balance" as a product: Balance comes free with whatever else is asked for. So a
// balance-only connection (HSAs, some savings products that offer neither transactions nor
// holdings) asks for the cheapest product the institution is likely to allow: account details
// (auth) first, account-holder details (identity) as the fallback. The sync never calls either;
// it only reads /accounts/get for these connections.
const PLAID_PRODUCTS = { spending: ['transactions'], investments: ['investments'], balance: ['auth'], balanceIdentity: ['identity'] };
const PLAID_PRODUCT_LABEL = { spending: 'transactions', investments: 'investments', balance: 'balance', balanceIdentity: 'balance' };

/* ---------- configuration ---------- */

function plaidProps_() { return PropertiesService.getScriptProperties(); }

function plaidConfig_() {
  const p = plaidProps_();
  const clientId = p.getProperty(PLAID_PROPS.CLIENT_ID);
  const secret = p.getProperty(PLAID_PROPS.SECRET);
  const env = (p.getProperty(PLAID_PROPS.ENV) || 'production').toLowerCase();
  if (!clientId || !secret) throw new Error('Plaid is not set up yet. Add PLAID_CLIENT_ID and PLAID_SECRET under Project Settings → Script Properties (see the handoff page).');
  if (!PLAID_HOSTS[env]) throw new Error('PLAID_ENV must be production or sandbox.');
  return { clientId, secret, env, host: PLAID_HOSTS[env] };
}

function accessToken_(connId) { return plaidProps_().getProperty(PLAID_PROPS.TOKEN_PREFIX + connId); }

/** POST to Plaid. Throws a readable error on any Plaid error. */
function plaidCall_(path, body) {
  const cfg = plaidConfig_();
  const payload = Object.assign({ client_id: cfg.clientId, secret: cfg.secret }, body || {});
  const res = UrlFetchApp.fetch(cfg.host + path, { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true });
  const code = res.getResponseCode();
  let data = {};
  try { data = JSON.parse(res.getContentText()); } catch (e) { data = {}; }
  if (code !== 200 || data.error_code) {
    const err = new Error('Plaid ' + path + ' failed: ' + (data.error_code || code) + ' — ' + (data.error_message || data.display_message || res.getContentText().slice(0, 200)));
    err.plaidCode = data.error_code || String(code);
    throw err;
  }
  return data;
}

function daysRequested_() {
  const start = startDate_();
  if (!start) return 90;
  const days = Math.ceil((todayMidnight_() - start) / 86400000) + 1;
  return Math.max(1, Math.min(730, days));
}

/* ---------- owner actions: setup ---------- */

/** Finance Tracker → Bank feed → Set history start date. */
function setPlaidStartDate() {
  const ui = ui_();
  const current = plaidProps_().getProperty(PLAID_PROPS.START_DATE) || '';
  const p = ui.prompt('History start date', 'Transactions dated before this day are not imported. Enter yyyy-mm-dd' + (current ? ' (currently ' + current + ')' : '') + ':', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  const v = p.getResponseText().trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(new Date(v + 'T00:00:00').getTime())) { ui.alert('Not a date', 'Please enter the date as yyyy-mm-dd, for example 2026-11-01.', ui.ButtonSet.OK); return; }
  plaidProps_().setProperty(PLAID_PROPS.START_DATE, v);
  ui.alert('Start date saved', 'Imports start at ' + v + '. Set this before connecting banks: it also decides how much history Plaid is asked for (' + daysRequested_() + ' days).', ui.ButtonSet.OK);
}

/** Finance Tracker → Bank feed → Status. Never shows secret values. */
function plaidStatus() {
  const p = plaidProps_();
  const has = k => (p.getProperty(k) ? 'set' : 'missing');
  const conns = readTable_(tdef_('CONN'));
  const trig = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncAllConnections').length;
  const lines = [
    'PLAID_CLIENT_ID: ' + has(PLAID_PROPS.CLIENT_ID),
    'PLAID_SECRET: ' + has(PLAID_PROPS.SECRET),
    'PLAID_ENV: ' + (p.getProperty(PLAID_PROPS.ENV) || 'production (default)'),
    'History start date: ' + (p.getProperty(PLAID_PROPS.START_DATE) || 'not set (defaults to 90 days)'),
    'Nightly sync trigger: ' + (trig ? 'on' : 'off'),
    'Connections: ' + conns.length + ' of 10 Trial slots' + (conns.length ? '\n' + conns.map(c => '  ' + c.id + ' ' + c.institution + ' — ' + c.status + (c.lastSync instanceof Date ? ' (last sync ' + Utilities.formatDate(c.lastSync, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ')' : '')).join('\n') : ''),
  ];
  alert_('Bank feed status', lines.join('\n'));
  return lines;
}

/** Finance Tracker → Bank feed → Turn nightly sync on. */
function enableNightlySync() {
  plaidConfig_();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncAllConnections').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncAllConnections').timeBased().everyDays(1).atHour(5).create();
  alert_('Nightly sync', 'The bank feed will sync every day around 5 AM (' + Session.getScriptTimeZone() + '). Use Bank feed → Sync now to run it any time.');
}

function disableNightlySync() {
  const ts = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncAllConnections');
  ts.forEach(t => ScriptApp.deleteTrigger(t));
  alert_('Nightly sync', ts.length ? 'Nightly sync is off. Connections are kept; turn it back on any time.' : 'Nightly sync was already off.');
}

/* ---------- owner actions: connect / repair ---------- */

/** Finance Tracker → Bank feed → Connect a bank… */
function connectBank() {
  plaidConfig_();
  const ui = ui_();
  const html = HtmlService.createHtmlOutputFromFile('ConnectDialog').setWidth(620).setHeight(700);
  ui.showModalDialog(html, 'Connect a bank through Plaid');
}

/** Data for the connect dialog. */
function getConnectContext() {
  const conns = readTable_(tdef_('CONN')).map(c => ({ id: c.id, institution: c.institution, status: c.status, products: c.products }));
  const accounts = readTable_(tdef_('ACCOUNTS')).map(a => ({ id: a.id, name: a.name, accountType: a.accountType, externalAccountId: a.externalAccountId, connectionId: a.connectionId }));
  return { connections: conns, slotsUsed: conns.length, accounts, startDate: plaidProps_().getProperty(PLAID_PROPS.START_DATE) || '', daysRequested: daysRequested_() };
}

/**
 * Step 1 of connecting: create a Hosted Link session. mode = 'spending' | 'investments' | 'balance' | 'balanceIdentity'.
 * For a repair pass { connectionId } instead; Plaid then reopens the same connection (no new slot).
 */
function startHostedLink(opts) {
  opts = opts || {};
  const body = {
    client_name: HFT.TITLE, language: 'en', country_codes: ['US'],
    user: { client_user_id: 'household-' + ss_().getId().slice(0, 12) },
    hosted_link: { url_lifetime_seconds: 1800, is_mobile_app: false },
  };
  if (opts.connectionId) {
    const token = accessToken_(opts.connectionId);
    if (!token) throw new Error('No access token stored for ' + opts.connectionId + '.');
    body.access_token = token; // update (repair) mode: same Item, no new slot
  } else {
    const mode = PLAID_PRODUCTS[opts.mode] ? opts.mode : 'spending';
    body.products = PLAID_PRODUCTS[mode];
    if (mode === 'spending') body.transactions = { days_requested: daysRequested_() };
  }
  const res = plaidCall_('/link/token/create', body);
  plaidProps_().setProperty(PLAID_PROPS.PENDING_LINK, JSON.stringify({ link_token: res.link_token, mode: opts.mode || 'spending', connectionId: opts.connectionId || '', created: new Date().toISOString() }));
  return { url: res.hosted_link_url, expiresAt: res.expiration };
}

/** Step 2: the owner says they finished in Plaid's window. Exchanges the token and lists the accounts to map. */
function finishHostedLink() {
  const raw = plaidProps_().getProperty(PLAID_PROPS.PENDING_LINK);
  if (!raw) throw new Error('No connection in progress. Start again with Connect a bank.');
  const pending = JSON.parse(raw);
  const got = plaidCall_('/link/token/get', { link_token: pending.link_token });
  const sessions = got.link_sessions || [];
  const done = sessions.filter(s => s.results && s.results.item_add_results && s.results.item_add_results.length)[0];
  if (pending.connectionId) {
    // repair: Plaid reports the session; nothing to exchange
    const finished = sessions.some(s => s.finished_at) || !!done;
    if (!finished) return { status: 'not_finished' };
    setConnectionStatus_(pending.connectionId, 'Active', 'Repaired ' + new Date().toISOString().slice(0, 10), '');
    plaidProps_().deleteProperty(PLAID_PROPS.PENDING_LINK);
    const synced = syncConnectionById_(pending.connectionId);
    return { status: 'repaired', connectionId: pending.connectionId, synced };
  }
  if (!done) return { status: 'not_finished' };
  const result = done.results.item_add_results[0];
  const ex = plaidCall_('/item/public_token/exchange', { public_token: result.public_token });
  const institution = (result.institution && result.institution.name) || 'Unknown institution';
  const connDef = tdef_('CONN');
  syncLastRow_(connDef);
  const existing = readTable_(connDef);
  const dup = existing.filter(c => c.itemId === ex.item_id)[0];
  const connId = dup ? dup.id : nextId_(connDef, 3);
  plaidProps_().setProperty(PLAID_PROPS.TOKEN_PREFIX + connId, ex.access_token);
  plaidProps_().deleteProperty(PLAID_PROPS.PENDING_LINK);
  const sameInstitution = existing.filter(c => c.institution === institution && c.id !== connId).length > 0;
  if (!dup) {
    writeRows_(connDef, [{ id: connId, institution, itemId: ex.item_id, products: PLAID_PRODUCT_LABEL[pending.mode] || 'transactions',
      status: 'Pending', lastResult: 'Connected; map the accounts to finish.', lastError: '', syncCursor: '', addedOn: new Date(),
      notes: sameInstitution ? 'Possible duplicate: another connection to this institution already exists. Each uses a Trial slot.' : '' }]);
    appendChangeLog_({ table: 'CONN', recordId: connId, field: '(row)', newValue: institution, action: 'Insert', user: userEmail_() || 'connect-dialog' });
  }
  const acc = plaidCall_('/accounts/get', { access_token: ex.access_token });
  const accounts = (acc.accounts || []).map(a => ({ externalId: a.account_id, name: a.official_name || a.name, mask: a.mask || '', type: a.type, subtype: a.subtype || '',
    current: a.balances ? a.balances.current : '' }));
  const mine = readTable_(tdef_('ACCOUNTS')).map(a => ({ id: a.id, name: a.name, accountType: a.accountType, institution: a.institution || '', taken: !!a.externalAccountId }));
  accounts.forEach(a => { a.guessType = guessAccountType_(a.type, a.subtype); });
  return { status: 'connected', connectionId: connId, institution, accounts, existingAccounts: mine, possibleDuplicate: sameInstitution };
}

/**
 * Step 3: map Plaid accounts to Accounts rows.
 * p = { connectionId, mappings: [{ externalId, accountId | 'new' | 'skip', name, mask, type, subtype, importTx, current }] }
 */
function finishAccountMapping(p) {
  const accDef = tdef_('ACCOUNTS');
  syncLastRow_(accDef);
  const sh = getOrCreateSheet_(accDef.sheet);
  const rows = readTable_(accDef);
  const byId = {}; rows.forEach(r => { byId[r.id] = r; });
  let linked = 0, created = 0;
  const newRows = [];
  let nextNum = parseInt(nextId_(accDef, 3).split('-')[1], 10);
  (p.mappings || []).forEach(m => {
    if (m.accountId === 'skip') return;
    const guessType = guessAccountType_(m.type, m.subtype);
    const now = new Date();
    if (m.accountId && m.accountId !== 'new' && byId[m.accountId]) {
      const r = byId[m.accountId];
      sh.getRange(r.__row, colIndex_(accDef, 'externalAccountId')).setValue(m.externalId);
      sh.getRange(r.__row, colIndex_(accDef, 'connectionId')).setValue(p.connectionId);
      sh.getRange(r.__row, colIndex_(accDef, 'importTx')).setValue(m.importTx === true);
      if (m.current !== '' && m.current !== null && m.current !== undefined) { sh.getRange(r.__row, colIndex_(accDef, 'currentBalance')).setValue(Number(m.current)); sh.getRange(r.__row, colIndex_(accDef, 'lastUpdated')).setValue(now); sh.getRange(r.__row, colIndex_(accDef, 'lastSynced')).setValue(now); }
      appendChangeLog_({ table: 'ACCOUNTS', recordId: r.id, field: 'External Account ID', oldValue: r.externalAccountId, newValue: m.externalId, action: 'Update', user: userEmail_() || 'connect-dialog' });
      linked++;
    } else {
      newRows.push({ id: 'ACC-' + String(nextNum++).padStart(3, '0'), name: m.name + (m.mask ? ' ····' + m.mask : ''), institution: p.institution || '', accountType: guessType,
        owner: '', includeNW: 'Yes', startingBalance: '', currentBalance: m.current === '' || m.current === null || m.current === undefined ? '' : Number(m.current), lastUpdated: now,
        notes: 'Created by the bank feed on ' + now.toISOString().slice(0, 10), externalAccountId: m.externalId, connectionId: p.connectionId, importTx: m.importTx === true, lastSynced: now });
      created++;
    }
  });
  if (newRows.length) { writeRows_(accDef, newRows); newRows.forEach(r => appendChangeLog_({ table: 'ACCOUNTS', recordId: r.id, field: '(row)', newValue: r.name, action: 'Insert', user: userEmail_() || 'connect-dialog' })); }
  setConnectionStatus_(p.connectionId, 'Active', 'Accounts mapped: ' + linked + ' linked, ' + created + ' created.', '');
  const synced = syncConnectionById_(p.connectionId);
  return { linked, created, synced };
}

/** Plaid account type/subtype → the tracker's Account Type. */
function guessAccountType_(type, subtype) {
  const typeMap = { depository: { checking: 'Checking', savings: 'Savings', hsa: 'HSA', 'cash management': 'Cash', paypal: 'Cash', prepaid: 'Cash' }, credit: { 'credit card': 'Credit Card', paypal: 'Credit Card' }, investment: { ira: 'Retirement', roth: 'Retirement', '401k': 'Retirement', '403B': 'Retirement', hsa: 'HSA' }, loan: {} };
  return (typeMap[type] || {})[subtype] || ({ depository: 'Checking', credit: 'Credit Card', investment: 'Investment', loan: 'Loan' }[type] || 'Other');
}

/** Finance Tracker → Bank feed → Repair a connection… (update mode; never a new slot). */
function repairConnection() {
  const ui = ui_();
  const conns = readTable_(tdef_('CONN'));
  if (!conns.length) { alert_('Repair a connection', 'No connections yet.'); return; }
  const p = ui.prompt('Repair a connection', 'Which connection? Enter its ID:\n' + conns.map(c => c.id + ' — ' + c.institution + ' (' + c.status + ')').join('\n'), ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  const id = p.getResponseText().trim().toUpperCase();
  if (!conns.some(c => c.id === id)) { ui.alert('Not found', id + ' is not a connection ID.', ui.ButtonSet.OK); return; }
  const res = startHostedLink({ connectionId: id });
  const html = HtmlService.createHtmlOutput('<p style="font:14px system-ui">Open this link, sign in to the bank again, then come back and run <b>Bank feed → Finish connecting</b>:</p><p><a href="' + res.url + '" target="_blank" rel="noopener">' + res.url + '</a></p>').setWidth(560).setHeight(200);
  ui.showModalDialog(html, 'Repair ' + id);
}

/** Finance Tracker → Bank feed → Finish connecting (after Plaid's window was closed). */
function finishConnectingPrompt() {
  const res = finishHostedLink();
  if (res.status === 'not_finished') { alert_('Not finished yet', 'Plaid has not reported a completed connection. Finish the steps in Plaid\'s window, then run this again.'); return; }
  if (res.status === 'repaired') { alert_('Connection repaired', res.connectionId + ' is active again. ' + summarizeSync_(res.synced)); return; }
  // a fresh connection needs the mapping dialog
  const ui = ui_();
  const html = HtmlService.createHtmlOutputFromFile('ConnectDialog').setWidth(620).setHeight(700);
  ui.showModalDialog(html, 'Finish connecting ' + res.institution);
}

/* ---------- sync ---------- */

function setConnectionStatus_(connId, status, result, error) {
  const def = tdef_('CONN');
  const r = findRowById_(def, connId);
  if (r < 0) return;
  const sh = getOrCreateSheet_(def.sheet);
  if (status) sh.getRange(r, colIndex_(def, 'status')).setValue(status);
  if (result !== undefined) sh.getRange(r, colIndex_(def, 'lastResult')).setValue(result);
  if (error !== undefined) sh.getRange(r, colIndex_(def, 'lastError')).setValue(error);
  sh.getRange(r, colIndex_(def, 'lastSync')).setValue(new Date());
}

function saveCursor_(connId, cursor) {
  const def = tdef_('CONN');
  const r = findRowById_(def, connId);
  if (r > 0) getOrCreateSheet_(def.sheet).getRange(r, colIndex_(def, 'syncCursor')).setValue(cursor || '');
}

/** Headers must match the schema before the feed writes anything. Throws a plain-language error. */
function layoutCheck_() {
  const problems = [];
  ['STAGING', 'ACCOUNTS', 'CONN', 'TX', 'RULES'].forEach(key => {
    const def = tdef_(key);
    const sh = ss_().getSheetByName(def.sheet);
    if (!sh) { problems.push('the ' + def.sheet + ' tab is missing'); return; }
    const hdr = sh.getRange(def.headerRow, 1, 1, def.columns.length).getValues()[0];
    def.columns.forEach((c, i) => { if (hdr[i] !== c.h) problems.push(def.sheet + ' column ' + colLetter_(i + 1) + ' should be "' + c.h + '" but is "' + hdr[i] + '"'); });
  });
  if (problems.length) throw new Error('Layout changed: ' + problems.slice(0, 3).join('; ') + (problems.length > 3 ? ' (and more)' : '') + '. The sync paused and nothing was written. Run Finance Tracker → Upgrade workbook, or restore the headers.');
}

/** Normalize one Plaid transaction into the engine's shape. accountMap: plaid account_id → ACC row. */
function normalizePlaidTx_(t, accountMap) {
  const acc = accountMap[t.account_id];
  const d = t.date ? new Date(t.date + 'T00:00:00') : null;
  const pfc = t.personal_finance_category || {};
  return {
    externalTxId: t.transaction_id, accountId: acc ? acc.id : '', date: d, rawDescription: t.name || t.original_description || '',
    merchantName: t.merchant_name || '', amount: Number(t.amount), pending: t.pending === true, pendingTxId: t.pending_transaction_id || '',
    bankCategory: [pfc.primary, pfc.detailed].filter(Boolean).join(' / '),
  };
}

/** Write Plaid balances to Accounts for every mapped account. */
function updateBalances_(plaidAccounts, accountMap) {
  const def = tdef_('ACCOUNTS');
  const sh = getOrCreateSheet_(def.sheet);
  const now = new Date();
  let n = 0;
  (plaidAccounts || []).forEach(a => {
    const row = accountMap[a.account_id];
    if (!row || !a.balances) return;
    const bal = a.balances.current === null || a.balances.current === undefined ? a.balances.available : a.balances.current;
    if (bal === null || bal === undefined) return;
    sh.getRange(row.__row, colIndex_(def, 'currentBalance')).setValue(Number(bal));
    sh.getRange(row.__row, colIndex_(def, 'lastUpdated')).setValue(now);
    sh.getRange(row.__row, colIndex_(def, 'lastSynced')).setValue(now);
    n++;
  });
  return n;
}

function syncConnectionById_(connId) {
  const conn = readTable_(tdef_('CONN')).filter(c => c.id === connId)[0];
  if (!conn) throw new Error('Connection not found: ' + connId);
  return syncConnection_(conn);
}

/** Sync one connection. Returns a summary object; records errors on the Connections row instead of throwing. */
function syncConnection_(conn) {
  const summary = { connectionId: conn.id, institution: conn.institution, added: 0, updated: 0, removed: 0, autoImported: 0, balances: 0, skippedBeforeStart: 0, error: '' };
  try {
    layoutCheck_();
    const token = accessToken_(conn.id);
    if (!token) throw new Error('No access token stored for ' + conn.id + '. Use Repair a connection.');
    const accounts = readTable_(tdef_('ACCOUNTS')).filter(a => a.connectionId === conn.id && a.externalAccountId);
    const accountMap = {};
    accounts.forEach(a => { accountMap[a.externalAccountId] = a; });
    const importable = {};
    accounts.forEach(a => { if (a.importTx === true) importable[a.externalAccountId] = true; });
    const products = String(conn.products || '');
    if (products.indexOf('transactions') >= 0) {
      let cursor = conn.syncCursor || '';
      let hasMore = true, guard = 0;
      const added = [], modified = [], removed = [];
      let lastAccounts = null;
      while (hasMore && guard++ < 50) {
        const body = { access_token: token, count: 500, options: { include_personal_finance_category: true } };
        if (cursor) body.cursor = cursor;
        const res = plaidCall_('/transactions/sync', body);
        (res.added || []).forEach(t => added.push(t));
        (res.modified || []).forEach(t => modified.push(t));
        (res.removed || []).forEach(t => removed.push(t));
        if (res.accounts) lastAccounts = res.accounts;
        cursor = res.next_cursor; hasMore = res.has_more === true;
      }
      const ctx = importContext_();
      const items = added.concat(modified).filter(t => importable[t.account_id]).map(t => normalizePlaidTx_(t, accountMap));
      const counts = ingestItems_('Plaid', items, ctx);
      summary.added = counts.added; summary.updated = counts.updated; summary.autoImported = counts.autoImported; summary.skippedBeforeStart = counts.skippedBeforeStart;
      summary.removed = removeItems_(removed.map(r => r.transaction_id));
      if (lastAccounts) summary.balances = updateBalances_(lastAccounts, accountMap);
      saveCursor_(conn.id, cursor); // only after every write succeeded
    } else {
      const res = plaidCall_('/accounts/get', { access_token: token });
      summary.balances = updateBalances_(res.accounts, accountMap);
    }
    setConnectionStatus_(conn.id, 'Active', summarizeSync_(summary), '');
  } catch (e) {
    summary.error = String(e && e.message || e);
    const code = e && e.plaidCode;
    const needsAttention = code === 'ITEM_LOGIN_REQUIRED' || code === 'PENDING_EXPIRATION' || code === 'PENDING_DISCONNECT' || code === 'ITEM_LOCKED' || code === 'USER_PERMISSION_REVOKED';
    setConnectionStatus_(conn.id, needsAttention ? 'Needs Attention' : undefined, undefined, summary.error);
  }
  return summary;
}

function summarizeSync_(s) {
  if (!s) return '';
  if (s.error) return 'Error: ' + s.error;
  return s.added + ' new, ' + s.updated + ' updated, ' + s.removed + ' removed, ' + s.autoImported + ' auto-imported, ' + s.balances + ' balance(s)' + (s.skippedBeforeStart ? ', ' + s.skippedBeforeStart + ' before start date' : '');
}

/** Nightly trigger and Finance Tracker → Bank feed → Sync now. */
function syncAllConnections() {
  const conns = readTable_(tdef_('CONN')).filter(c => c.status === 'Active' || c.status === 'Needs Attention');
  const results = conns.map(syncConnection_);
  const lines = results.map(r => r.institution + ': ' + summarizeSync_(r));
  Logger.log(lines.join('\n'));
  return results;
}

function syncNow() {
  plaidConfig_();
  const results = syncAllConnections();
  alert_('Bank feed sync', results.length ? results.map(r => r.institution + ' (' + r.connectionId + '): ' + summarizeSync_(r)).join('\n') : 'No active connections yet. Use Bank feed → Connect a bank.');
  return results;
}
