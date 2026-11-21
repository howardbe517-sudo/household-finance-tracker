/**
 * Household Finance Tracker — Receipts.gs
 * Receipt photos (the owner, 2026-11-21): a Claude chat reads a receipt photo and writes one Paste Import block,
 * HFT-IMPORT v1 RECEIPT, one row per receipt line. Finance Tracker → Import the Paste Import tab (or Import from
 * Claude) then:
 *   1. checks each receipt (Trip ID): its lines add up to the receipt total (the difference is sales tax on the
 *      taxed lines), its categories exist, its account is known; a receipt that fails is left out and named;
 *   2. writes one Receipts row per Category · Subcategory piece (status Waiting), and, for lines marked itemize,
 *      one Grocery Items row per line (Source "Receipt photo"), adding new item numbers to Grocery Item Names;
 *   3. matches each Waiting receipt to its card charge (matchReceipts_, also run by every sync): the same account,
 *      the receipt total, from the day before the receipt to 5 days after (10 for a return), on Import Staging
 *      (posted, not yet imported) or Transactions (not split, not already tied to a receipt). The charge is
 *      split into the pieces (one piece: just categorized), the sales tax spread over the taxed lines in
 *      proportion, any rounding cent on the largest piece, so the pieces add up exactly to the charge. A return
 *      receipt (a negative total) is matched to the refund the same way and split into Refund rows.
 * A receipt pasted twice adds nothing (same Trip ID). A receipt whose charge never shows, or that fits two
 * charges, turns Check. Pending charges are left alone until they post.
 */

const RECEIPT = {
  KEY: 'RECEIPT',
  COLUMNS: ['tripKey', 'date', 'time', 'store', 'location', 'account', 'receiptTotal', 'itemNo', 'receiptName', 'qty', 'unitPrice', 'amount', 'discount', 'taxCode', 'category', 'subcategory', 'itemize', 'notes'],
  REQUIRED: ['tripKey', 'date', 'store', 'account', 'receiptTotal', 'amount', 'category', 'subcategory'],
  BEFORE_DAYS: 1, AFTER_DAYS: 5, RETURN_DAYS: 10, CHECK_AFTER_DAYS: 21,
  MAX_TAX: 0.07,          // sales tax is at most this share of the taxed lines (Michigan: 6%)
  USER: 'receipt-import',
};

/* ---------- pure (tested in Node) ---------- */

function rcpRound_(x) { return Math.round(Number(x || 0) * 100) / 100; }
function rcpDay_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function rcpIsDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
function rcpYmd_(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }

/** The Accounts row a receipt names: an Account ID, or last 4 digits listed in Card Last 4 (receipts). */
function receiptAccount_(value, accounts) {
  const v = String(value === null || value === undefined ? '' : value).trim();
  if (!v) return null;
  const byId = (accounts || []).filter(a => a.id && String(a.id).toUpperCase() === v.toUpperCase())[0];
  if (byId) return byId.id;
  const digits = v.replace(/\D/g, '').slice(-4);
  if (digits.length !== 4) return null;
  const hits = (accounts || []).filter(a => String(a.cardLast4 || '').split(/[^0-9]+/).filter(Boolean).indexOf(digits) >= 0);
  return hits.length === 1 ? hits[0].id : null;
}

/** Grocery Items' Item # for a receipt line: Costco numbers as printed, other stores STORE-number. */
function receiptItemNo_(store, itemNo) {
  const n = String(itemNo === null || itemNo === undefined ? '' : itemNo).trim().toUpperCase().replace(/\s+/g, '');
  if (!n) return '';
  const st = String(store || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  if (!st || st === 'COSTCO' || n.indexOf(st + '-') === 0) return n;
  return st + '-' + n;
}

/**
 * Reads a RECEIPT block (rows after the marker and header lines) into receipts. Pure.
 *   headers  the header line
 *   rows     the data lines (arrays of cells)
 *   ctx      { accounts: Accounts rows, pairs: { 'Category|Subcategory': true } }
 * Returns { error: text } for a block that cannot be read at all, else { trips: [{ tripKey, date, store, location,
 * accountId, total, lines: [...], pieces: [...], problems: [text] }] } in the order the receipts first appear.
 */
function parseReceiptRows_(headers, rows, ctx) {
  const idx = {};
  const unknown = [];
  (headers || []).forEach((h, i) => {
    const k = String(h === null || h === undefined ? '' : h).trim();
    if (!k) return;
    const hit = RECEIPT.COLUMNS.filter(c => c.toLowerCase() === k.toLowerCase())[0];
    if (hit) idx[hit] = i; else unknown.push(k);
  });
  if (unknown.length) return { error: 'These column names are not part of a RECEIPT block: ' + unknown.join(', ') + '. The columns are: ' + RECEIPT.COLUMNS.join(', ') + '.' };
  const missing = RECEIPT.REQUIRED.filter(c => idx[c] === undefined);
  if (missing.length) return { error: 'A RECEIPT block needs these columns: ' + missing.join(', ') + '.' };
  const cell = (r, k) => idx[k] === undefined ? '' : r[idx[k]];
  const txt = (v) => String(v === null || v === undefined ? '' : v).trim();
  const num = (v) => { if (v === '' || v === null || v === undefined) return null; if (typeof v === 'number') return v; const s = String(v).replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1'); return s === '' || isNaN(Number(s)) ? null : Number(s); };
  const day = (v) => {
    if (rcpIsDate_(v)) return rcpDay_(v);
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(txt(v));
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  };
  const byKey = {}, order = [];
  (rows || []).forEach((r, n) => {
    if (!r || r.every(v => v === '' || v === null || v === undefined)) return;
    const line = n + 1;
    const key = txt(cell(r, 'tripKey'));
    if (!key) { order.push({ tripKey: '(line ' + line + ')', lines: [], problems: ['line ' + line + ' has no tripKey'] }); return; }
    let t = byKey[key];
    if (!t) { t = byKey[key] = { tripKey: key, lines: [], problems: [] }; order.push(t); }
    const p = t.problems;
    if (!t.lines.length && !/^[A-Za-z0-9-]{3,60}$/.test(key)) p.push('tripKey "' + key + '" must be 3 to 60 letters, digits and dashes');
    const d = day(cell(r, 'date'));
    if (!d) p.push('line ' + line + ': date "' + txt(cell(r, 'date')) + '" is not yyyy-mm-dd');
    const tm = txt(cell(r, 'time'));
    let when = d;
    if (d && tm) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(tm);
      if (m) when = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(m[1]), Number(m[2]));
      else p.push('line ' + line + ': time "' + tm + '" is not HH:MM');
    }
    const total = num(cell(r, 'receiptTotal'));
    const amount = num(cell(r, 'amount'));
    let discount = num(cell(r, 'discount')) || 0;
    if (discount > 0) discount = -discount;                // a discount always lowers the line
    if (total === null) p.push('line ' + line + ': receiptTotal is not a number');
    if (amount === null) p.push('line ' + line + ': amount is not a number');
    const cat = txt(cell(r, 'category')), sub = txt(cell(r, 'subcategory'));
    if (!cat || !sub) p.push('line ' + line + ': category and subcategory are required');
    else if (ctx && ctx.pairs && !ctx.pairs[cat + '|' + sub]) p.push('line ' + line + ': "' + cat + ' → ' + sub + '" is not a Category and Subcategory on the Categories tab');
    const tc = txt(cell(r, 'taxCode')).toUpperCase();
    if (tc && ['T', 'N', 'F', 'X', 'Y'].indexOf(tc) < 0) p.push('line ' + line + ': taxCode "' + tc + '" is not T or N');
    const itemize = /^(true|yes|y|1|x)$/i.test(txt(cell(r, 'itemize')));
    if (itemize && !txt(cell(r, 'receiptName'))) p.push('line ' + line + ': an itemized line needs its receiptName');
    if (t.lines.length === 0) {
      t.date = when; t.store = txt(cell(r, 'store')); t.location = txt(cell(r, 'location')); t.total = total;
      t.account = txt(cell(r, 'account')); t.accountId = receiptAccount_(t.account, ctx && ctx.accounts);
      if (!t.store) p.push('store is required');
      if (!t.accountId) p.push('account "' + t.account + '" is not an Account ID or a card\'s last 4 digits on Accounts (Card Last 4)');
    } else {
      if (total !== null && t.total !== null && Math.abs(total - t.total) > 0.005) p.push('line ' + line + ': receiptTotal differs from the first line of this receipt');
      if (txt(cell(r, 'account')) && txt(cell(r, 'account')) !== t.account) p.push('line ' + line + ': account differs from the first line of this receipt');
    }
    t.lines.push({ line, itemNo: txt(cell(r, 'itemNo')), receiptName: txt(cell(r, 'receiptName')), qty: num(cell(r, 'qty')), unitPrice: num(cell(r, 'unitPrice')),
      amount: amount === null ? 0 : rcpRound_(amount), discount: rcpRound_(discount), net: rcpRound_((amount || 0) + discount),
      taxed: tc === 'T' || tc === 'X' || tc === 'Y', category: cat, subcategory: sub, itemize, notes: txt(cell(r, 'notes')) });
  });
  order.forEach(t => {
    if (!t.lines.length) return;
    const pieces = receiptPieces_(t.lines);
    t.pieces = pieces;
    if (t.total === null || t.problems.length) return;
    const ret = t.total < 0;
    const sum = rcpRound_(t.lines.reduce((s, l) => s + l.net, 0));
    const taxedSum = rcpRound_(t.lines.filter(l => l.taxed).reduce((s, l) => s + l.net, 0));
    const tax = rcpRound_(t.total - sum);
    const sign = ret ? -1 : 1;
    if (Math.abs(t.total) < 0.01) t.problems.push('the receipt total is $0');
    else if (pieces.some(pc => Math.abs(pc.amount) >= 0.005 && pc.amount * sign < 0)) {
      const odd = t.lines.filter(l => l.net * sign < 0).map(l => l.line);
      t.problems.push((ret ? 'a return receipt has a line that is not a return' : 'a purchase receipt has a returned item') + (odd.length ? ' (line ' + odd.join(', ') + ')' : '') + ' leaving its category below zero; send purchases and returns as separate receipts');
    }
    else if (tax * sign < -0.01 || tax * sign > Math.abs(taxedSum) * RECEIPT.MAX_TAX + 0.02 || (!taxedSum && Math.abs(tax) > 0.01))
      t.problems.push('the lines add up to ' + rcpMoney_(sum) + (taxedSum ? ' (taxed lines ' + rcpMoney_(taxedSum) + ')' : ', none taxed') + ' but the receipt total is ' + rcpMoney_(t.total));
  });
  return { trips: order };
}

function rcpMoney_(n) { const v = Number(n || 0); return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2); }

/** The Category · Subcategory pieces of a receipt's lines, largest first: { category, subcategory, amount, taxable, itemized }. Pure. */
function receiptPieces_(lines) {
  const by = {}, order = [];
  (lines || []).forEach(l => {
    const k = l.category + '|' + l.subcategory;
    if (!by[k]) { by[k] = { category: l.category, subcategory: l.subcategory, amount: 0, taxable: 0, itemized: false }; order.push(by[k]); }
    by[k].amount += l.net;
    if (l.taxed) by[k].taxable += l.net;
    if (l.itemize) by[k].itemized = true;
  });
  order.forEach(p => { p.amount = rcpRound_(p.amount); p.taxable = rcpRound_(p.taxable); });
  return order.filter(p => Math.abs(p.amount) >= 0.005 || p.itemized).sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
}

/** The pieces a charge is split into: those with an amount (a fully discounted itemized line is on Grocery Items only). */
function receiptChargePieces_(pieces) {
  return (pieces || []).filter(p => Math.abs(Number(p.amount || 0)) >= 0.005);
}

/**
 * What each piece of a receipt comes to on the card charge. Pure. The sales tax (the total less the pieces) is
 * spread over the pieces' taxed parts in proportion; with no taxed part it goes to the largest piece. Any
 * rounding cent goes to the largest piece, so the result adds up exactly to the total.
 * Returns [{ category, subcategory, amount (before tax), taxable, charged }] in the pieces' order.
 */
function receiptSplit_(pieces, total) {
  const list = (pieces || []).map(p => Object.assign({}, p, { charged: rcpRound_(p.amount) }));
  if (!list.length) return list;
  const tax = rcpRound_(Number(total) - list.reduce((s, p) => s + p.amount, 0));
  const taxBase = list.reduce((s, p) => s + p.taxable, 0);
  const largest = list.reduce((b, p) => Math.abs(p.amount) > Math.abs(b.amount) ? p : b, list[0]);
  if (tax !== 0) {
    if (Math.abs(taxBase) > 0.004) list.forEach(p => { p.charged = rcpRound_(p.amount + tax * p.taxable / taxBase); });
    else largest.charged = rcpRound_(largest.charged + tax);
  }
  const diff = rcpRound_(Number(total) - list.reduce((s, p) => s + p.charged, 0));
  if (diff !== 0) largest.charged = rcpRound_(largest.charged + diff);
  return list;
}

/**
 * The card charge (or, for a return, the refund) a receipt was paid with. Pure.
 *   trip     { date, accountId, total, store }
 *   txRows   Transactions rows; staged  Import Staging rows; taken  { 'tx:ID' | 'stg:ID': true } already used
 * A Transactions row fits when it is live, on the account, for the receipt total, an Expense (a return: a Refund or
 * Income), not split and not tied to a receipt; an Import Staging row fits when it is posted, waiting (Needs
 * Review, Needs Split or Ready), on the account and for the total (money out for a purchase, in for a return).
 * Both from the day before the receipt to RECEIPT.AFTER_DAYS after (RETURN_DAYS for a return). The closest in date
 * wins, a description naming the store breaking a tie. Returns { source: 'tx' | 'staging', row }, { ambiguous:
 * [text] } when two fit equally well, or null.
 */
function findReceiptCharge_(trip, txRows, staged, taken) {
  if (!trip || !rcpIsDate_(trip.date) || !trip.accountId || !trip.total) return null;
  const ret = trip.total < 0, want = Math.abs(rcpRound_(trip.total));
  const d0 = rcpDay_(trip.date);
  const from = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - RECEIPT.BEFORE_DAYS);
  const to = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + (ret ? RECEIPT.RETURN_DAYS : RECEIPT.AFTER_DAYS));
  const store = String(trip.store || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const names = (s) => store && String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '').indexOf(store) >= 0;
  const cands = [];
  (txRows || []).forEach(t => {
    if (!t.id || t.isDeleted === true || t.accountId !== trip.accountId || t.splitRole || t.parentTxId || t.receiptRef) return;
    if (t.status === 'Pending') return;   // a pending charge can still change amount (a tip): wait until it posts
    if ((taken || {})['tx:' + t.id]) return;
    if (ret ? (t.type !== 'Refund' && t.type !== 'Income') : t.type !== 'Expense') return;
    if (!rcpIsDate_(t.date) || Math.abs(Math.abs(Number(t.amount)) - want) > 0.005) return;
    const d = rcpDay_(t.date);
    if (d < from || d > to) return;
    cands.push({ source: 'tx', row: t, days: Math.abs(Math.round((d - d0) / 86400000)), named: names(t.description) });
  });
  const open = { 'Needs Review': true, 'Needs Split': true, 'Ready': true };
  (staged || []).forEach(s => {
    if (!s.importId || !open[s.status] || s.pending === true || s.importedTxId || s.accountId !== trip.accountId) return;
    if (s.pairedImportId || ['Transfer', 'Savings', 'Debt Payment'].indexOf(s.suggestedType) >= 0) return;   // a transfer or card payment, not a purchase
    if ((taken || {})['stg:' + s.importId]) return;
    const a = Number(s.amount);
    if (!rcpIsDate_(s.date) || Math.abs(Math.abs(a) - want) > 0.005 || (ret ? a >= 0 : a <= 0)) return;
    const d = rcpDay_(s.date);
    if (d < from || d > to) return;
    cands.push({ source: 'staging', row: s, days: Math.abs(Math.round((d - d0) / 86400000)), named: names(s.merchantName || s.rawDescription) });
  });
  if (!cands.length) return null;
  const score = (c) => c.days * 2 + (c.named ? 0 : 1);
  cands.sort((a, b) => score(a) - score(b));
  if (cands.length > 1 && score(cands[0]) === score(cands[1])) {
    return { ambiguous: cands.filter(c => score(c) === score(cands[0])).map(c => (c.source === 'tx' ? c.row.id : c.row.importId) + ' ' + rcpYmd_(c.row.date) + ' ' + String(c.row.description || c.row.merchantName || c.row.rawDescription || '').slice(0, 30)) };
  }
  return { source: cands[0].source, row: cands[0].row };
}

/* ---------- the import (from Paste Import) ---------- */

/**
 * Imports a RECEIPT block (called by importGrid_ in PasteImport.gs). opts.dryRun returns the summary only;
 * opts.confirm asks YES/NO in the Sheet first. Returns the same shape as importGrid_.
 */
function importReceiptGrid_(grid, opts) {
  opts = opts || {};
  const ss = ss_();
  if (!ss.getSheetByName(SHEETS.RECEIPTS)) return { status: 'error', table: RECEIPT.KEY, message: 'Run Finance Tracker → Upgrade workbook first: it adds the Receipts tab.' };
  const accounts = readTable_(tdef_('ACCOUNTS'));
  const pairs = {};
  TAXONOMY.forEach(t => { pairs[t[0] + '|' + t[1]] = true; });
  try { readTable_(tdef_('CATS')).forEach(c => { if (c.category && c.subcategory) pairs[c.category + '|' + c.subcategory] = true; }); } catch (e) { /* the built-in list is enough */ }
  const parsed = parseReceiptRows_(grid[1], grid.slice(2), { accounts, pairs });
  if (parsed.error) return { status: 'error', table: RECEIPT.KEY, message: parsed.error };
  const trips = parsed.trips;
  if (!trips.length) return { status: 'nothing', table: RECEIPT.KEY, message: 'The block has a header but no receipt lines.' };

  // a receipt already here (same Trip ID on Receipts, or on Grocery Items) is skipped
  const rDef = tdef_('RECEIPTS'), gDef = tdef_('GROC'), nDef = tdef_('GROCNAMES');
  syncLastRow_(rDef); syncLastRow_(gDef); syncLastRow_(nDef);
  const have = {};
  readTable_(rDef).forEach(r => { if (r.tripId && r.isDeleted !== true) have[String(r.tripId)] = 'Receipts'; });
  readTable_(gDef).forEach(l => { if (l.tripId && l.isDeleted !== true && !have[String(l.tripId)]) have[String(l.tripId)] = 'Grocery Items'; });
  const bad = trips.filter(t => t.problems.length);
  const dupes = trips.filter(t => !t.problems.length && have[t.tripKey]);
  const fresh = trips.filter(t => !t.problems.length && !have[t.tripKey]);
  const badText = bad.map(t => 'CHECK ' + t.tripKey + ': ' + t.problems.join('; '));
  const dupText = dupes.map(t => t.tripKey + ' (already on ' + have[t.tripKey] + ')');
  const describe = (t) => t.tripKey + ' · ' + rcpMoney_(t.total) + ' · ' + t.pieces.map(p => p.subcategory + ' ' + rcpMoney_(p.amount)).join(', ') + (t.lines.some(l => l.itemize) ? ' · ' + t.lines.filter(l => l.itemize).length + ' item(s) to Grocery Items' : '');
  if (!fresh.length) return { status: bad.length ? 'error' : 'nothing', table: RECEIPT.KEY, skipped: dupes.length,
    message: (bad.length ? 'Nothing was imported.\n' + badText.join('\n') : '') + (dupes.length ? (bad.length ? '\n' : '') + 'Already imported: ' + dupText.join(', ') : '') };
  const summary = fresh.length + ' receipt(s) will be added to Receipts' + (bad.length ? '; ' + bad.length + ' left out (CHECK)' : '') + (dupes.length ? '; ' + dupes.length + ' already imported' : '') + '.';
  if (opts.dryRun) return { status: 'preview', table: RECEIPT.KEY, sheet: rDef.sheet, imported: fresh.length, skipped: dupes.length, dupes: dupText, warnings: badText,
    preview: fresh.slice(0, 12).map(describe), message: summary };
  if (opts.confirm) {
    const ui = ui_();
    const msg = 'Import ' + fresh.length + ' receipt(s)?\n\n' + fresh.slice(0, 8).map(describe).join('\n') + (badText.length ? '\n\nLeft out (nothing is imported for these):\n' + badText.slice(0, 6).join('\n') : '') + (dupes.length ? '\n\nAlready imported: ' + dupText.join(', ') : '') +
      '\n\nEach receipt waits on the Receipts tab until its card charge is there, then the charge is split by it. Nothing is overwritten.';
    if (ui && ui.alert('Import receipts', msg, ui.ButtonSet.YES_NO) !== ui.Button.YES) return { status: 'cancelled', table: RECEIPT.KEY, message: 'Nothing was imported.' };
  }

  // write: Receipts rows (one per piece), Grocery Items rows (itemized lines), new Grocery Item Names
  const now = new Date();
  let rNum = parseInt(nextId_(rDef, 4).split('-')[1], 10);
  let gNum = parseInt(nextId_(gDef, 6).split('-')[1], 10);
  let nNum = parseInt(nextId_(nDef, 4).split('-')[1], 10);
  const names = {};
  readTable_(nDef).forEach(n => { if (n.itemNo) names[String(n.itemNo).toUpperCase()] = true; });
  const rRows = [], gRows = [], nRows = [];
  fresh.forEach(t => {
    const acct = accounts.filter(a => a.id === t.accountId)[0] || {};
    const paid = 'Receipt photo (Paste Import ' + rcpYmd_(now) + '). Paid ' + rcpMoney_(t.total) + ' on ' + (acct.name || t.accountId) + '.';
    t.pieces.forEach(p => rRows.push({ id: 'RCP-' + String(rNum++).padStart(4, '0'), tripId: t.tripKey, date: t.date, store: t.store, location: t.location, accountId: t.accountId,
      receiptTotal: t.total, category: p.category, subcategory: p.subcategory, amount: p.amount, taxable: p.taxable, itemized: p.itemized, status: 'Waiting', txId: '', splitAmount: '',
      notes: paid, createdAt: now, isDeleted: false }));
    t.lines.filter(l => l.itemize).forEach((l, i) => {
      const itemNo = receiptItemNo_(t.store, l.itemNo) || (String(t.store).toUpperCase().replace(/[^A-Z0-9]+/g, '') + '-' + t.tripKey.replace(/\D/g, '').slice(-12) + '-' + (i + 1));
      gRows.push({ id: 'GI-' + String(gNum++).padStart(6, '0'), tripId: t.tripKey, date: t.date, store: t.store, location: t.location, itemNo, receiptName: l.receiptName,
        qty: l.qty === null ? 1 : l.qty, unitPrice: l.unitPrice === null ? l.amount : l.unitPrice, amount: l.amount, discount: l.discount, net: l.net,
        source: GROC.PHOTO, receiptNo: '', txId: '', isDeleted: false, notes: paid + (l.notes ? ' ' + l.notes : '') });
      if (!names[itemNo.toUpperCase()]) {
        names[itemNo.toUpperCase()] = true;
        nRows.push({ id: 'GN-' + String(nNum++).padStart(4, '0'), store: t.store, itemNo, receiptName: l.receiptName, item: '', category: l.category, subcategory: l.subcategory,
          notes: 'Added from a receipt photo (' + t.tripKey + ').' });
      }
    });
  });
  writeRows_(rDef, rRows);
  if (gRows.length) writeRows_(gDef, gRows);
  if (nRows.length) writeRows_(nDef, nRows);
  const match = matchReceipts_();
  const when = Utilities.formatDate(now, 'America/Detroit', 'yyyy-MM-dd HH:mm');
  const status = fresh.length + ' receipt(s) → Receipts at ' + when + ' · ' + match.matched + ' matched to their charge and split' + (match.waiting ? ' · ' + match.waiting + ' waiting for the charge' : '') + (match.check ? ' · ' + match.check + ' to check' : '') +
    (gRows.length ? ' · ' + gRows.length + ' item(s) to Grocery Items' : '') + (bad.length ? ' · ' + bad.length + ' left out (CHECK)' : '') + (dupes.length ? ' · ' + dupes.length + ' already imported' : '');
  const st = ss.getRangeByName('PASTE_STATUS'); if (st) st.setValue(status);
  return { status: 'imported', table: RECEIPT.KEY, imported: fresh.length, skipped: dupes.length, warnings: badText, ids: rRows.map(r => r.id),
    message: status + (match.details.length ? '\n\n' + match.details.slice(0, 10).join('\n') : '') + (badText.length ? '\n\nNot imported:\n' + badText.join('\n') : '') };
}

/* ---------- matching a receipt to its charge (after the import and with every sync) ---------- */

/**
 * Matches every Waiting receipt to its card charge and splits the charge by it. A receipt still Waiting
 * RECEIPT.CHECK_AFTER_DAYS after its date, or that fits two charges equally, turns Check.
 * Returns { matched, waiting, check, details: [text] }.
 */
function matchReceipts_() {
  const out = { matched: 0, waiting: 0, check: 0, details: [] };
  const ss = ss_();
  if (!ss.getSheetByName(SHEETS.RECEIPTS)) return out;
  const rDef = tdef_('RECEIPTS');
  const rows = readTable_(rDef).filter(r => r.isDeleted !== true && r.tripId && r.status === 'Waiting');
  if (!rows.length) return out;
  const trips = {}, order = [];
  rows.forEach(r => { const k = String(r.tripId); if (!trips[k]) { trips[k] = { tripKey: k, date: r.date, store: r.store, accountId: r.accountId, total: Number(r.receiptTotal), rows: [] }; order.push(trips[k]); } trips[k].rows.push(r); });
  const txDef = tdef_('TX'), sDef = tdef_('STAGING');
  let tx = readTable_(txDef);
  let staged = ss.getSheetByName(sDef.sheet) ? readTable_(sDef) : [];
  const taken = {};
  const rSh = ss.getSheetByName(rDef.sheet);
  const setR = (r, k, v) => rSh.getRange(r.__row, colIndex_(rDef, k)).setValue(v);
  const today = rcpDay_(new Date());
  let ctx = null;
  // Two Waiting receipts on one account for the same total (two $25 trips a day apart) wait until each has a
  // charge of its own; then the earliest receipt takes the earliest charge, so charges are not swapped.
  const twinKey = (t) => t.accountId + '|' + Math.abs(rcpRound_(t.total)).toFixed(2);
  const twins = {};
  order.forEach(t => { (twins[twinKey(t)] = twins[twinKey(t)] || []).push(t); });
  const holdBack = {};
  Object.keys(twins).forEach(k => {
    const g = twins[k];
    if (g.length < 2) return;
    const probe = {};
    const allFit = g.slice().sort((a, b) => a.date - b.date).every(t => { const f = findReceiptCharge_(t, tx, staged, probe); if (!f || f.ambiguous) return false; probe[(f.source === 'tx' ? 'tx:' + f.row.id : 'stg:' + f.row.importId)] = true; return true; });
    if (!allFit) g.forEach(t => { holdBack[t.tripKey] = true; });
  });
  order.sort((a, b) => (rcpIsDate_(a.date) ? a.date.getTime() : 0) - (rcpIsDate_(b.date) ? b.date.getTime() : 0));
  order.forEach(t => {
    if (holdBack[t.tripKey]) {
      if (rcpIsDate_(t.date) && (today - rcpDay_(t.date)) / 86400000 > RECEIPT.CHECK_AFTER_DAYS) {
        t.rows.forEach(r => { setR(r, 'status', 'Check'); setR(r, 'notes', String(r.notes || '') + ' · CHECK: another receipt on this card has the same total and their charges could not be told apart; split the right one by hand.'); });
        out.check++; out.details.push('CHECK ' + t.tripKey + ': same total as another receipt');
      } else out.waiting++;
      return;
    }
    const found = findReceiptCharge_(t, tx, staged, taken);
    if (found && found.ambiguous) {
      t.rows.forEach(r => { setR(r, 'status', 'Check'); setR(r, 'notes', String(r.notes || '') + ' · CHECK: more than one charge fits (' + found.ambiguous.join('; ') + '); split the right one by hand (Split the selected row…).'); });
      out.check++; out.details.push('CHECK ' + t.tripKey + ': more than one charge fits');
      return;
    }
    if (!found) {
      if (rcpIsDate_(t.date) && (today - rcpDay_(t.date)) / 86400000 > RECEIPT.CHECK_AFTER_DAYS) {
        t.rows.forEach(r => { setR(r, 'status', 'Check'); setR(r, 'notes', String(r.notes || '') + ' · CHECK: no card charge for ' + rcpMoney_(t.total) + ' on ' + t.accountId + ' within ' + (t.total < 0 ? RECEIPT.RETURN_DAYS : RECEIPT.AFTER_DAYS) + ' days.'); });
        out.check++; out.details.push('CHECK ' + t.tripKey + ': no matching charge');
      } else out.waiting++;
      return;
    }
    taken[(found.source === 'tx' ? 'tx:' + found.row.id : 'stg:' + found.row.importId)] = true;
    ctx = ctx || importContext_();
    const res = applyReceiptToCharge_(t, found, ctx);
    t.rows.forEach(r => {
      const part = res.parts.filter(p => p.category === r.category && p.subcategory === r.subcategory)[0];
      setR(r, 'status', 'Matched'); setR(r, 'txId', res.txId); if (part) setR(r, 'splitAmount', part.charged);
    });
    // the itemized lines point at the charge, so the grocery job never splits it a second time
    const gDef = tdef_('GROC'), gSh = ss.getSheetByName(gDef.sheet);
    if (gSh) readTable_(gDef).filter(l => String(l.tripId) === t.tripKey && l.isDeleted !== true && !l.txId).forEach(l => gSh.getRange(l.__row, colIndex_(gDef, 'txId')).setValue(res.txId));
    out.matched++; out.details.push(t.tripKey + ' → ' + res.txId + ' (' + res.parts.map(p => p.subcategory + ' ' + rcpMoney_(p.charged)).join(', ') + ')');
    if (found.source === 'staging') staged = readTable_(sDef);
    tx = readTable_(txDef);
  });
  return out;
}

/**
 * Splits (or, with one piece, categorizes) a receipt's charge. found.source 'staging': the staged row becomes a
 * Transactions row (as Import reviewed rows does) and is marked Imported; 'tx': the row is changed in place.
 * Returns { txId, parts: receiptSplit_ result }.
 */
function applyReceiptToCharge_(t, found, ctx) {
  const txDef = tdef_('TX');
  const txSh = ss_().getSheetByName(txDef.sheet);
  const pieces = receiptChargePieces_(t.rows.map(r => ({ category: r.category, subcategory: r.subcategory, amount: Number(r.amount || 0), taxable: Number(r.taxable || 0) })));
  // the charge's own size wins over the receipt (they match to the cent), and pieces are positive amounts
  const ret = t.total < 0, sign = ret ? -1 : 1;
  const parts = receiptSplit_(pieces.map(p => Object.assign(p, { amount: p.amount * sign, taxable: p.taxable * sign })), Math.abs(t.total));
  const now = new Date();
  const kind = ret ? 'Refund' : 'Expense';
  const mark = 'Split by receipt ' + t.tripKey;
  const dflt = (p) => { try { return taxonomyDefaults_(p.category, p.subcategory); } catch (e) { return { needWant: '', fixedVariable: '', spendingType: 'Flexible' }; } };
  syncLastRow_(txDef);
  let nextNum = parseInt(nextId_(txDef, 6).split('-')[1], 10);
  let parent;
  if (found.source === 'staging') {
    const s = found.row;
    const id = 'TX-' + String(nextNum++).padStart(6, '0');
    parent = stagingToTransaction_(s, id, ctx);
    parent.type = parts.length > 1 ? 'Split Parent' : kind;
    parent.receiptRef = t.tripKey;
    parent.notes = String(parent.notes || '') + ' · ' + mark;
    if (parts.length === 1) {
      const d = dflt(parts[0]);
      Object.assign(parent, { category: parts[0].category, subcategory: parts[0].subcategory, needWant: d.needWant, fixedVariable: d.fixedVariable, spendingType: d.spendingType || 'Flexible', fundingSource: 'Monthly Cash Flow' });
    } else Object.assign(parent, { category: '', subcategory: '', splitRole: 'Parent', spendingType: '', fundingSource: '' });
    writeRows_(txDef, [parent]);
    s.importedTxId = id; s.status = IMPORT_STATUS.IMPORTED; s.reviewed = true; s.importedAt = now; s.suggestedType = parent.type;
    if (parts.length === 1) { s.suggestedCategory = parts[0].category; s.suggestedSubcategory = parts[0].subcategory; }
    writeStagingRow_(s);
    appendChangeLog_({ table: 'TX', recordId: id, field: '(row)', newValue: 'Imported from Import Staging ' + s.importId + ' by receipt', action: 'Import', user: RECEIPT.USER, notes: mark });
  } else {
    parent = found.row;
    const col = (k) => colIndex_(txDef, k);
    if (parts.length === 1) {
      const d = dflt(parts[0]);
      txSh.getRange(parent.__row, col('type')).setValue(kind);
      txSh.getRange(parent.__row, col('category')).setValue(parts[0].category);
      txSh.getRange(parent.__row, col('subcategory')).setValue(parts[0].subcategory);
      if (d.needWant) txSh.getRange(parent.__row, col('needWant')).setValue(d.needWant);
      txSh.getRange(parent.__row, col('spendingType')).setValue(d.spendingType || 'Flexible');
    } else {
      txSh.getRange(parent.__row, col('type')).setValue('Split Parent');
      txSh.getRange(parent.__row, col('splitRole')).setValue('Parent');
    }
    txSh.getRange(parent.__row, col('receiptRef')).setValue(t.tripKey);
    txSh.getRange(parent.__row, col('updatedAt')).setValue(now);
    txSh.getRange(parent.__row, col('updatedBy')).setValue(RECEIPT.USER);
    appendChangeLog_({ table: 'TX', recordId: parent.id, field: 'Type', oldValue: parent.type, newValue: parts.length > 1 ? 'Split Parent' : kind, action: parts.length > 1 ? 'Split' : 'Update', user: RECEIPT.USER, notes: mark });
  }
  if (parts.length > 1) {
    const children = parts.map(p => {
      const d = dflt(p);
      return {
        id: 'TX-' + String(nextNum++).padStart(6, '0'), date: parent.date, description: String(parent.description) + ' — ' + p.subcategory, amount: p.charged, type: kind,
        category: p.category, subcategory: p.subcategory, accountId: parent.accountId, person: parent.person || 'Household', hhPersonal: parent.hhPersonal || 'Household',
        needWant: d.needWant, fixedVariable: d.fixedVariable, status: parent.status || 'Posted', notes: 'Split child of ' + parent.id + ' · ' + mark,
        createdAt: now, createdBy: RECEIPT.USER, spendingType: d.spendingType || 'Flexible', fundingSource: 'Monthly Cash Flow',
        splitRole: 'Child', parentTxId: parent.id, receiptRef: t.tripKey,
      };
    });
    writeRows_(txDef, children);
    appendChangeLog_({ table: 'TX', recordId: parent.id, field: 'Split', newValue: children.length + ' children', action: 'Split', user: RECEIPT.USER, notes: mark + ': ' + children.map(c => c.id + ' ' + c.subcategory + ' ' + c.amount.toFixed(2)).join(', ') });
  }
  return { txId: parent.id, parts };
}

/**
 * A split charge the bank removed, or posted at another amount: its split children no longer match it. The
 * children are soft-deleted, the charge goes back to one row (removed: it stays deleted), and the receipt or
 * grocery trip that split it is freed: a receipt from a photo goes back to Waiting (or Check when the amount
 * changed, as it no longer matches the receipt), a grocery trip loses its Bank Charge so the grocery job looks
 * again. Returns the number of children soft-deleted.
 */
function releaseSplitCharge_(parentId, reason, newAmount) {
  if (!parentId) return 0;
  const ss = ss_();
  const txDef = tdef_('TX'), txSh = ss.getSheetByName(txDef.sheet);
  if (!txSh) return 0;
  const now = new Date();
  const tx = readTable_(txDef);
  const kids = tx.filter(t => t.parentTxId === parentId && t.isDeleted !== true);
  kids.forEach(k => {
    txSh.getRange(k.__row, colIndex_(txDef, 'isDeleted')).setValue(true);
    txSh.getRange(k.__row, colIndex_(txDef, 'deletedAt')).setValue(now);
    txSh.getRange(k.__row, colIndex_(txDef, 'updatedBy')).setValue(RECEIPT.USER);
  });
  const parent = tx.filter(t => t.id === parentId)[0];
  if (parent && parent.splitRole === 'Parent' && parent.isDeleted !== true) {
    txSh.getRange(parent.__row, colIndex_(txDef, 'type')).setValue(kids.some(k => k.type === 'Refund') ? 'Refund' : 'Expense');
    txSh.getRange(parent.__row, colIndex_(txDef, 'splitRole')).setValue('');
    txSh.getRange(parent.__row, colIndex_(txDef, 'receiptRef')).setValue('');
  }
  if (kids.length) appendChangeLog_({ table: 'TX', recordId: parentId, field: 'Split', oldValue: kids.length + ' children', newValue: 'children soft-deleted', action: 'Soft Delete', user: RECEIPT.USER, notes: reason + ': ' + kids.map(k => k.id).join(', ') });
  if (ss.getSheetByName(SHEETS.RECEIPTS)) {
    const rDef = tdef_('RECEIPTS'), rSh = ss.getSheetByName(rDef.sheet);
    readTable_(rDef).filter(r => r.txId === parentId && r.isDeleted !== true).forEach(r => {
      const changed = newAmount !== undefined && newAmount !== null;
      rSh.getRange(r.__row, colIndex_(rDef, 'status')).setValue(changed ? 'Check' : 'Waiting');
      rSh.getRange(r.__row, colIndex_(rDef, 'txId')).setValue('');
      rSh.getRange(r.__row, colIndex_(rDef, 'splitAmount')).setValue('');
      rSh.getRange(r.__row, colIndex_(rDef, 'notes')).setValue(String(r.notes || '') + ' · ' + reason + (changed ? ' (now ' + rcpMoney_(newAmount) + '); split it by hand or fix the receipt' : '; waiting for the charge again'));
    });
  }
  const gDef = tdef_('GROC'), gSh = ss.getSheetByName(gDef.sheet);
  if (gSh) readTable_(gDef).filter(l => String(l.txId) === parentId && l.isDeleted !== true).forEach(l => gSh.getRange(l.__row, colIndex_(gDef, 'txId')).setValue(''));
  return kids.length;
}

function describeReceipts_(r) {
  if (!r || !(r.matched || r.check)) return '';
  return (r.matched ? r.matched + ' receipt(s) matched and split' : '') + (r.check ? (r.matched ? ', ' : '') + r.check + ' receipt(s) to check on Receipts' : '');
}
