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
// loans: a lender or student loan servicer. Liabilities gives the balance plus rate, minimum payment,
// due date and (for student loans) repayment plan and status; the sync writes those to Debts.
const PLAID_PRODUCTS = { spending: ['transactions'], investments: ['investments'], balance: ['auth'], balanceIdentity: ['identity'], loans: ['liabilities'] };
const PLAID_PRODUCT_LABEL = { spending: 'transactions', investments: 'investments', balance: 'balance', balanceIdentity: 'balance', loans: 'liabilities' };

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
    'Connections: ' + conns.length + ' of ' + PLAID_TRIAL_LIMIT + ' Trial slots (the Plaid dashboard also counts connections that never reached the Sheet)' + (conns.length ? '\n' + conns.map(c => '  ' + c.id + ' ' + c.institution + ' — ' + c.status + (c.lastSync instanceof Date ? ' (last sync ' + Utilities.formatDate(c.lastSync, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') + ')' : '')).join('\n') : ''),
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
  const pendingMapping = pendingMapping_();
  const accounts = readTable_(tdef_('ACCOUNTS')).map(a => ({ id: a.id, name: a.name, accountType: a.accountType, externalAccountId: a.externalAccountId, connectionId: a.connectionId }));
  const owners = (LISTS.filter(l => l.key === 'OWNERS')[0] || { values: [] }).values;
  return { connections: conns, slotsUsed: conns.length, slotLimit: PLAID_TRIAL_LIMIT, owners, accounts, startDate: plaidProps_().getProperty(PLAID_PROPS.START_DATE) || '', daysRequested: daysRequested_(), pendingMapping };
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
    if (mode === 'spending') {
      body.transactions = { days_requested: daysRequested_() };
      // card APRs, minimum payments and due dates where the bank offers them; banks that do not are still listed
      body.required_if_supported_products = ['liabilities'];
    }
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
    setConnectionField_(pending.connectionId, 'liabilities', ''); // ask the lender again after a repair
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
  return buildMapping_(connId, institution, pending.mode || 'spending', sameInstitution);
}

/**
 * Reads the connection's accounts from Plaid and remembers them in Script Properties until the
 * owner has matched them to Accounts rows, so closing the dialog early (or reloading the Sheet)
 * never loses a connected bank: the dialog and Bank feed → Finish connecting pick it up again.
 */
function buildMapping_(connId, institution, mode, possibleDuplicate) {
  const token = accessToken_(connId);
  if (!token) throw new Error('No access token stored for ' + connId + '.');
  const acc = plaidCall_('/accounts/get', { access_token: token });
  const accounts = (acc.accounts || []).map(a => ({ externalId: a.account_id, name: a.official_name || a.name, mask: a.mask || '', type: a.type, subtype: a.subtype || '',
    current: a.balances ? a.balances.current : '', guessType: guessAccountType_(a.type, a.subtype) }));
  const result = { status: 'connected', connectionId: connId, institution, mode: mode || 'spending', accounts, possibleDuplicate: !!possibleDuplicate };
  plaidProps_().setProperty(PLAID_PROPS.PENDING_MAP, JSON.stringify(result));
  result.existingAccounts = existingAccountsForMapping_();
  return result;
}

function existingAccountsForMapping_() {
  return readTable_(tdef_('ACCOUNTS')).map(a => ({ id: a.id, name: a.name, accountType: a.accountType, institution: a.institution || '', taken: !!a.externalAccountId }));
}

/** The Connections product label → the dialog's kind of connection. */
function modeFromProducts_(label) {
  return { transactions: 'spending', investments: 'investments', balance: 'balance', liabilities: 'loans' }[String(label || '').trim()] || 'spending';
}

/**
 * A connected bank still waiting for its accounts to be matched, or null. Remembered in Script
 * Properties by buildMapping_; failing that, rebuilt from a Connections row that is still Pending
 * (an older connection made before this was remembered).
 */
function pendingMapping_() {
  const raw = plaidProps_().getProperty(PLAID_PROPS.PENDING_MAP);
  let m = null;
  if (raw) {
    try { m = JSON.parse(raw); } catch (e) { m = null; }
    if (m && !accessToken_(m.connectionId)) { plaidProps_().deleteProperty(PLAID_PROPS.PENDING_MAP); m = null; }
  }
  if (!m) {
    const conn = readTable_(tdef_('CONN')).filter(c => String(c.status) === 'Pending' && accessToken_(c.id))[0];
    if (conn) return buildMapping_(conn.id, conn.institution, modeFromProducts_(conn.products), false);
    return null;
  }
  m.existingAccounts = existingAccountsForMapping_();
  return m;
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
  const loans = []; // [accountId, mapping] for every loan account, so a Debts row can be linked
  let nextNum = parseInt(nextId_(accDef, 3).split('-')[1], 10);
  (p.mappings || []).forEach(m => {
    if (m.accountId === 'skip') return;
    const guessType = guessAccountType_(m.type, m.subtype);
    const now = new Date();
    if (m.accountId && m.accountId !== 'new' && byId[m.accountId]) {
      const r = byId[m.accountId];
      if (m.type === 'loan' || m.type === 'credit') loans.push([r.id, m, r.name]);
      sh.getRange(r.__row, colIndex_(accDef, 'externalAccountId')).setValue(m.externalId);
      sh.getRange(r.__row, colIndex_(accDef, 'connectionId')).setValue(p.connectionId);
      sh.getRange(r.__row, colIndex_(accDef, 'importTx')).setValue(m.importTx === true);
      if (m.current !== '' && m.current !== null && m.current !== undefined) { sh.getRange(r.__row, colIndex_(accDef, 'currentBalance')).setValue(Number(m.current)); sh.getRange(r.__row, colIndex_(accDef, 'lastUpdated')).setValue(now); sh.getRange(r.__row, colIndex_(accDef, 'lastSynced')).setValue(now); }
      appendChangeLog_({ table: 'ACCOUNTS', recordId: r.id, field: 'External Account ID', oldValue: r.externalAccountId, newValue: m.externalId, action: 'Update', user: userEmail_() || 'connect-dialog' });
      linked++;
    } else {
      const newId = 'ACC-' + String(nextNum++).padStart(3, '0');
      if (m.type === 'loan' || m.type === 'credit') loans.push([newId, m, m.name + (m.mask ? ' ····' + m.mask : '')]);
      newRows.push({ id: newId, name: m.name + (m.mask ? ' ····' + m.mask : ''), institution: p.institution || '', accountType: guessType,
        owner: '', includeNW: 'Yes', startingBalance: '', currentBalance: m.current === '' || m.current === null || m.current === undefined ? '' : Number(m.current), lastUpdated: now,
        notes: 'Created by the bank feed on ' + now.toISOString().slice(0, 10), externalAccountId: m.externalId, connectionId: p.connectionId, importTx: m.importTx === true, lastSynced: now });
      created++;
    }
  });
  if (newRows.length) { writeRows_(accDef, newRows); newRows.forEach(r => appendChangeLog_({ table: 'ACCOUNTS', recordId: r.id, field: '(row)', newValue: r.name, action: 'Insert', user: userEmail_() || 'connect-dialog' })); }
  const debts = { linked: 0, reused: 0, created: 0, none: 0 };
  loans.forEach(l => { debts[ensureDebtRowForLoan_(l[0], l[1], l[2], p)]++; });
  setConnectionStatus_(p.connectionId, 'Active', 'Accounts mapped: ' + linked + ' linked, ' + created + ' created.' + (debts.reused || debts.created ? ' Debts rows: ' + debts.reused + ' matched, ' + debts.created + ' created.' : ''), '');
  const rawMap = plaidProps_().getProperty(PLAID_PROPS.PENDING_MAP);
  if (rawMap) { try { if (JSON.parse(rawMap).connectionId === p.connectionId) plaidProps_().deleteProperty(PLAID_PROPS.PENDING_MAP); } catch (e) { plaidProps_().deleteProperty(PLAID_PROPS.PENDING_MAP); } }
  const synced = syncConnectionById_(p.connectionId);
  return { linked, created, debts, synced };
}

/**
 * Every loan account the feed brings in gets a Debts row, so its balance, rate and payments flow
 * into the debt totals without typing. Reuses an empty row the owner already made for it (same
 * owner and debt type, no linked account, no balance) before creating one. A credit card only
 * reuses an empty Credit Card row whose lender matches the institution (cards paid in full each
 * month need no Debts row, so none is created).
 * Returns 'linked' (a row already pointed at this account), 'reused', 'created' or 'none'.
 */
function ensureDebtRowForLoan_(accountId, m, accountName, p) {
  const def = tdef_('DEBTS');
  syncLastRow_(def);
  const debts = readTable_(def);
  if (debts.some(d => d.linkedAccount === accountId)) return 'linked';
  const sub = String(m.subtype || '').toLowerCase();
  const isCard = m.type === 'credit';
  const isStudent = /student/.test(sub);
  const debtType = isCard ? 'Credit Card' : isStudent ? 'Student Loan' : /auto/.test(sub) ? 'Auto Loan' : /mortgage|home/.test(sub) ? 'Mortgage' : 'Personal Loan';
  const owner = p.owner || 'Household';
  const group = isStudent ? 'Student Loans' : 'Household';
  const today = new Date().toISOString().slice(0, 10);
  const sh = getOrCreateSheet_(def.sheet);
  const instWord = String(p.institution || '').toLowerCase().split(' ')[0];
  const empty = (d) => !d.linkedAccount && d.debtType === debtType && !(Number(d.originalBalance) > 0);
  const placeholder = isCard
    ? debts.filter(d => empty(d) && instWord && String(d.lender || '').toLowerCase().indexOf(instWord) >= 0)[0]
    : debts.filter(d => empty(d) && String(d.owner || '') === owner)[0];
  if (!placeholder && isCard) return 'none';
  if (placeholder) {
    const put = (key, val) => sh.getRange(placeholder.__row, colIndex_(def, key)).setValue(val);
    put('linkedAccount', accountId);
    if (!placeholder.lender) put('lender', p.institution || '');
    if (!placeholder.group) put('group', group);
    put('notes', (placeholder.notes ? placeholder.notes + ' ' : '') + 'Linked to ' + accountName + ' by the bank feed on ' + today + '.');
    appendChangeLog_({ table: 'DEBTS', recordId: placeholder.id, field: 'Linked Account ID', oldValue: '', newValue: accountId, action: 'Update', user: userEmail_() || 'connect-dialog' });
    return 'reused';
  }
  const id = nextId_(def, 3);
  writeRows_(def, [{ id, name: accountName, debtType, lender: p.institution || '', owner, group, linkedAccount: accountId,
    notes: 'Created by the bank feed on ' + today + '. The balance comes from the linked account; rate, minimum payment, due day and original principal arrive with the sync where the lender provides them.' }]);
  appendChangeLog_({ table: 'DEBTS', recordId: id, field: '(row)', newValue: accountName, action: 'Insert', user: userEmail_() || 'connect-dialog' });
  return 'created';
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
  let res;
  if (plaidProps_().getProperty(PLAID_PROPS.PENDING_LINK)) {
    res = finishHostedLink();
    if (res.status === 'not_finished') { alert_('Not finished yet', 'Plaid has not reported a completed connection. Finish the steps in Plaid\'s window, then run this again.'); return; }
    if (res.status === 'repaired') { alert_('Connection repaired', res.connectionId + ' is active again. ' + summarizeSync_(res.synced)); return; }
  } else {
    res = pendingMapping_(); // a bank that connected earlier but whose accounts were never matched
    if (!res) { alert_('Nothing to finish', 'No connection is waiting. Every connected bank has its accounts matched; use Connect a bank… to add another.'); return; }
  }
  // the dialog opens straight on step 3 (the pending mapping is remembered in Script Properties)
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
  const hist = [];
  (plaidAccounts || []).forEach(a => {
    const row = accountMap[a.account_id];
    if (!row || !a.balances) return;
    const bal = a.balances.current === null || a.balances.current === undefined ? a.balances.available : a.balances.current;
    if (bal === null || bal === undefined) return;
    sh.getRange(row.__row, colIndex_(def, 'currentBalance')).setValue(Number(bal));
    sh.getRange(row.__row, colIndex_(def, 'lastUpdated')).setValue(now);
    sh.getRange(row.__row, colIndex_(def, 'lastSynced')).setValue(now);
    hist.push({ accountId: row.id, accountName: row.name, accountType: row.accountType, institution: row.institution, balance: Number(bal) });
    n++;
  });
  try { recordBalanceHistory_(hist); } catch (e) { Logger.log('recordBalanceHistory_: ' + (e && e.message || e)); }
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
    if (products.indexOf('transactions') >= 0 || products.indexOf('liabilities') >= 0) summary.liabilities = syncLiabilities_(conn, token, accountMap);
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
  return s.added + ' new, ' + s.updated + ' updated, ' + s.removed + ' removed, ' + s.autoImported + ' auto-imported, ' + s.balances + ' balance(s)' + (s.liabilities ? ', ' + s.liabilities + ' debt row(s) updated from the lender' : '') + (s.skippedBeforeStart ? ', ' + s.skippedBeforeStart + ' before start date' : '');
}

/* ---------- lender data (Plaid Liabilities) → Debts ---------- */

function setConnectionField_(connId, key, value) {
  const def = tdef_('CONN');
  const r = findRowById_(def, connId);
  if (r < 0) return;
  getOrCreateSheet_(def.sheet).getRange(r, colIndex_(def, key)).setValue(value);
}

/**
 * Reads /liabilities/get for a connection and writes what the lender reports into every Debts row
 * linked to one of its accounts: Interest Rate (APR), Minimum Payment, Due Day, Next Payment Due,
 * Last Payment, Loan Status / Plan, and Original Balance when it was blank. Returns the number of
 * Debts rows updated. A login whose institution does not offer Liabilities is marked once on the
 * Connections tab and not asked again (Repair clears the mark).
 */
function syncLiabilities_(conn, token, accountMap) {
  if (String(conn.liabilities || '').indexOf('Not available') === 0) return 0;
  let res;
  try { res = plaidCall_('/liabilities/get', { access_token: token }); }
  catch (e) { setConnectionField_(conn.id, 'liabilities', 'Not available: ' + (e.plaidCode || String(e.message || e)).slice(0, 160)); return 0; }
  const li = res.liabilities || {};
  const def = tdef_('DEBTS');
  syncLastRow_(def);
  const debts = readTable_(def);
  const sh = getOrCreateSheet_(def.sheet);
  const byAccount = {};
  debts.forEach(d => { if (d.linkedAccount) (byAccount[d.linkedAccount] = byAccount[d.linkedAccount] || []).push(d); });
  const now = new Date();
  let n = 0;
  const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? undefined : Number(v);
  const dateOf = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined; };
  const dayOf = (iso) => { const d = dateOf(iso); return d ? d.getDate() : undefined; };
  const lastPay = (x) => (x.last_payment_date || x.last_payment_amount != null) ? [x.last_payment_date || '', x.last_payment_amount != null ? '$' + Number(x.last_payment_amount).toFixed(2) : ''].filter(Boolean).join(' · ') : undefined;
  const write = (d, vals) => {
    Object.keys(vals).forEach(k => { if (vals[k] !== undefined) sh.getRange(d.__row, colIndex_(def, k)).setValue(vals[k]); });
    sh.getRange(d.__row, colIndex_(def, 'feedUpdated')).setValue(now);
    n++;
  };
  const rowsFor = (plaidAccountId) => { const acc = accountMap[plaidAccountId]; return acc ? (byAccount[acc.id] || []) : []; };
  (li.credit || []).forEach(c => rowsFor(c.account_id).forEach(d => {
    const apr = (c.aprs || []).filter(a => a.apr_type === 'purchase_apr')[0] || (c.aprs || [])[0];
    write(d, { apr: apr && num(apr.apr_percentage) !== undefined ? num(apr.apr_percentage) / 100 : undefined, minPayment: num(c.minimum_payment_amount), dueDay: dayOf(c.next_payment_due_date),
      nextDue: dateOf(c.next_payment_due_date), lastPayment: lastPay(c), loanStatus: c.is_overdue === true ? 'Overdue' : (c.is_overdue === false ? 'Current' : undefined) });
  }));
  (li.student || []).forEach(s => rowsFor(s.account_id).forEach(d => {
    const plan = s.repayment_plan ? (s.repayment_plan.description || s.repayment_plan.type || '') : '';
    const status = s.loan_status ? (s.loan_status.type || '') : '';
    write(d, { apr: num(s.interest_rate_percentage) !== undefined ? num(s.interest_rate_percentage) / 100 : undefined, minPayment: num(s.minimum_payment_amount), dueDay: dayOf(s.next_payment_due_date),
      nextDue: dateOf(s.next_payment_due_date), lastPayment: lastPay(s), loanStatus: [plan, status, s.is_overdue === true ? 'overdue' : ''].filter(Boolean).join(' · ') || undefined,
      originalBalance: !(Number(d.originalBalance) > 0) ? num(s.origination_principal_amount) : undefined });
  }));
  (li.mortgage || []).forEach(mo => rowsFor(mo.account_id).forEach(d => {
    write(d, { apr: mo.interest_rate && num(mo.interest_rate.percentage) !== undefined ? num(mo.interest_rate.percentage) / 100 : undefined, minPayment: num(mo.next_monthly_payment), dueDay: dayOf(mo.next_payment_due_date),
      nextDue: dateOf(mo.next_payment_due_date), lastPayment: lastPay(mo), originalBalance: !(Number(d.originalBalance) > 0) ? num(mo.origination_principal_amount) : undefined });
  }));
  const found = (li.credit || []).length + (li.student || []).length + (li.mortgage || []).length;
  setConnectionField_(conn.id, 'liabilities', found ? (n ? 'Yes' : 'Yes (no Debts row is linked to these accounts yet)') : 'Yes (nothing reported for these accounts)');
  return n;
}

/* ---------- month rows that should always exist ---------- */

/**
 * Makes sure Monthly Plan has a row for the current month (target carried from the latest month
 * that has one) and Monthly Budget has this month's category rows (copied from the latest month
 * that has any). Runs with every sync; safe to run any time.
 */
function ensureMonthRows_() {
  const cur = monthStart_(new Date());
  const same = (a, b) => a instanceof Date && b instanceof Date && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const label = (d) => Utilities.formatDate(d, 'America/Detroit', 'MMMM yyyy');
  const out = { plan: false, budget: 0 };
  const planDef = tdef_('PLAN');
  syncLastRow_(planDef);
  const plans = readTable_(planDef).filter(r => r.month instanceof Date);
  if (!plans.some(r => same(r.month, cur))) {
    const last = plans.filter(r => r.month < cur).sort((a, b) => b.month - a.month)[0];
    writeRows_(planDef, [{ month: cur, target: last ? last.target : '', notes: last ? 'Added automatically; target carried from ' + label(last.month) + '.' : 'Added automatically. Enter the Monthly Flexible Target.' }]);
    appendChangeLog_({ table: 'PLAN', recordId: 'PLAN-' + Utilities.formatDate(cur, 'America/Detroit', 'yyyyMM'), field: '(row)', newValue: label(cur), action: 'Insert', user: 'bank-feed' });
    out.plan = true;
  }
  const budDef = tdef_('BUDGET');
  syncLastRow_(budDef);
  const buds = readTable_(budDef).filter(r => r.month instanceof Date);
  if (!buds.some(r => same(r.month, cur))) {
    const lastMonth = buds.filter(r => r.month < cur).map(r => r.month).sort((a, b) => b - a)[0];
    if (lastMonth) {
      const rows = buds.filter(r => same(r.month, lastMonth)).map(r => ({ month: cur, category: r.category, planned: r.planned, notes: 'Carried forward automatically from ' + label(lastMonth) + '.' }));
      writeRows_(budDef, rows);
      out.budget = rows.length;
    }
  }
  return out;
}

/** Nightly trigger and Finance Tracker → Bank feed → Sync now. */
function syncAllConnections() {
  const conns = readTable_(tdef_('CONN')).filter(c => c.status === 'Active' || c.status === 'Needs Attention');
  const results = conns.map(syncConnection_);
  try { ensureMonthRows_(); } catch (e) { Logger.log('ensureMonthRows_: ' + (e && e.message || e)); }
  try { sendReminders_(); } catch (e) { Logger.log('sendReminders_: ' + (e && e.message || e)); }
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

/* ---------- reminders: the few things that still need a hand ---------- */

/**
 * What is due for the owner to do by hand: a student loan's PSLF official count never entered or
 * last confirmed more than SETTING_PSLF_REMINDER_MONTHS ago (default 12), and a person's credit
 * score never entered or older than SETTING_CREDIT_REMINDER_MONTHS (default 3). Returns [{ key, text }].
 */
function dueReminders_() {
  const ss = ss_();
  const monthsRange = ss.getRangeByName('SETTING_PSLF_REMINDER_MONTHS');
  const months = monthsRange && Number(monthsRange.getValue()) > 0 ? Number(monthsRange.getValue()) : 12;
  const cutoff = addMonths_(monthStart_(new Date()), -months);
  const out = [];
  readTable_(tdef_('DEBTS')).filter(d => d.group === 'Student Loans').forEach(d => {
    const asOf = d.pslfAsOf instanceof Date ? d.pslfAsOf : null;
    if (asOf && asOf >= cutoff) return;
    out.push({ key: 'pslf:' + d.id, text: 'PSLF count for ' + d.name + ': ' + (asOf ? 'last confirmed ' + Utilities.formatDate(asOf, 'America/Detroit', 'MMM d, yyyy') : 'never entered') + '. Read it on studentaid.gov and update PSLF Official Count and PSLF Count As Of on Debts.' });
  });
  const creditRange = ss.getRangeByName('SETTING_CREDIT_REMINDER_MONTHS');
  const creditMonths = creditRange && Number(creditRange.getValue()) > 0 ? Number(creditRange.getValue()) : 3;
  const creditCutoff = addMonths_(monthStart_(new Date()), -creditMonths);
  const scores = readTable_(tdef_('CREDIT')).filter(s => s.scoreDate instanceof Date);
  const persons = (LISTS.filter(l => l.key === 'PERSONS')[0] || { values: [] }).values;
  persons.forEach(pn => {
    const latest = scores.filter(s => s.person === pn).sort((a, b) => b.scoreDate - a.scoreDate)[0];
    if (latest && latest.scoreDate >= creditCutoff) return;
    out.push({ key: 'credit:' + pn, text: 'Credit score for ' + pn + ': ' + (latest ? 'last entered ' + Utilities.formatDate(latest.scoreDate, 'America/Detroit', 'MMM d, yyyy') : 'never entered') + '. Enter the latest score on the Credit Scores tab (any free score you already look at).' });
  });
  return out;
}

/** Finance Tracker → Show reminders. */
function showReminders() {
  const due = dueReminders_();
  alert_('Reminders', due.length ? due.map(r => '• ' + r.text).join('\n\n') : 'Nothing due. The Dashboard\'s Reminders box shows the same list.');
}

/**
 * Emails the owner the due reminders, at most once every 30 days, when App Setup's Email
 * reminders setting is on. Runs at the end of every sync. Returns the number of emails sent.
 */
function sendReminders_() {
  const ss = ss_();
  const onRange = ss.getRangeByName('SETTING_REMINDER_EMAIL');
  if (onRange && onRange.getValue() !== true) return 0;
  const due = dueReminders_();
  if (!due.length) return 0;
  const props = plaidProps_();
  const last = props.getProperty('REMINDER_LAST_SENT');
  if (last && (Date.now() - new Date(last).getTime()) < 30 * 86400000) return 0;
  const to = (Session.getEffectiveUser && Session.getEffectiveUser().getEmail()) || userEmail_();
  if (!to) return 0;
  const body = 'Hello,\n\nThe Household Finance Tracker has ' + due.length + ' reminder(s):\n\n' + due.map(r => '• ' + r.text).join('\n\n') +
    '\n\nOpen the Sheet: ' + ss.getUrl() + '\n\nThis email is sent at most once a month while something is due. Turn it off on App Setup (Email reminders).';
  MailApp.sendEmail(to, 'Finance Tracker: ' + due.length + ' reminder(s)', body);
  props.setProperty('REMINDER_LAST_SENT', new Date().toISOString());
  return 1;
}
