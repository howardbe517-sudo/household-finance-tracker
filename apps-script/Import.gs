/**
 * Household Finance Tracker — Import.gs
 * The bank-import engine: Import Rules matching, classification of staged
 * rows, transfer / card-payment pairing, pending→posted replacement, the
 * review step and promotion of staged rows into Transactions, plus the
 * split panel and rule dialog that work on a selected row.
 *
 * Everything that decides is a pure function (testable in Node); only the
 * *_ writers touch the Sheet.
 */

const IMPORT_STATUS = {
  REVIEW: 'Needs Review', SPLIT: 'Needs Split', READY: 'Ready', IMPORTED: 'Imported',
  IGNORED: 'Ignored', SUPERSEDED: 'Superseded', REMOVED: 'Removed',
};
const IMPORT_USER = 'bank-import';
const PAIR_WINDOW_DAYS = 3;

/* ---------- pure helpers ---------- */

function normalizeText_(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9*#&@. ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function dayDiff_(a, b) {
  if (!(a instanceof Date) || !(b instanceof Date)) return 9999;
  return Math.abs(Math.round((a - b) / 86400000));
}

function isOpenStatus_(status) {
  return status === IMPORT_STATUS.REVIEW || status === IMPORT_STATUS.SPLIT || status === IMPORT_STATUS.READY || !status;
}

/** Does one rule match a staged row? */
function ruleMatches_(rule, row) {
  if (rule.active === false || !rule.pattern) return false;
  if (rule.accountId && row.accountId && rule.accountId !== row.accountId) return false;
  const pat = normalizeText_(rule.pattern);
  if (!pat) return false;
  const hay = [normalizeText_(row.rawDescription), normalizeText_(row.merchantName)].filter(Boolean);
  const mt = rule.matchType || 'Contains';
  return hay.some(h => mt === 'Exact' ? h === pat : mt === 'Starts With' ? h.indexOf(pat) === 0 : h.indexOf(pat) >= 0);
}

/** Best rule for a row: account-specific beats general, Exact > Starts With > Contains, longer pattern wins ties. */
function findRule_(rules, row) {
  let best = null, bestScore = -1;
  rules.forEach(r => {
    if (!ruleMatches_(r, row)) return;
    const score = (r.accountId ? 100 : 0) + ({ 'Exact': 30, 'Starts With': 20, 'Contains': 10 }[r.matchType || 'Contains']) + Math.min(String(r.pattern).length, 9);
    if (score > bestScore) { best = r; bestScore = score; }
  });
  return best;
}

/**
 * Suggestions for a staged row. ctx = { rules, accountsById }.
 * Amount convention (Plaid's): positive = money leaving the account, negative = money arriving.
 */
function classifyRow_(row, ctx) {
  const out = { suggestedType: '', suggestedCategory: '', suggestedSubcategory: '', suggestedSpendingType: '', suggestedPerson: '', suggestedFundId: '', suggestedDebtId: '', ruleId: '', status: IMPORT_STATUS.REVIEW, autoImport: false };
  const acct = ctx.accountsById[row.accountId] || {};
  const isCard = acct.accountType === 'Credit Card';
  const isLoan = acct.accountType === 'Loan';
  const amount = Number(row.amount || 0);
  // an Income rule is for money coming in: a purchase at a shop that shares an employer's name must never be counted as pay
  const rule = findRule_((ctx.rules || []).filter(r => !(r.type === 'Income' && amount > 0)), row);
  if (isLoan && !rule) {
    // Activity inside a loan account is never income or spending: a payment received is the
    // loan's side of a Debt Payment (recorded from the paying account); interest is tracked on Debts.
    out.suggestedType = 'Transfer';
    return out;
  }
  if (rule) {
    out.suggestedType = rule.type || (amount < 0 ? (isCard ? 'Refund' : 'Income') : 'Expense');
    out.suggestedCategory = rule.category || '';
    out.suggestedSubcategory = rule.subcategory || '';
    out.suggestedSpendingType = rule.spendingType || '';
    out.suggestedPerson = rule.person || '';
    out.suggestedFundId = rule.fundId || '';
    out.suggestedDebtId = rule.debtId || '';
    out.ruleId = rule.id;
    if (rule.splitRequired === true) out.status = IMPORT_STATUS.SPLIT;
    else if (rule.autoImport === true) { out.status = IMPORT_STATUS.READY; out.autoImport = true; }
    return out;
  }
  out.suggestedType = amount < 0 ? (isCard ? 'Refund' : 'Income') : 'Expense';
  if (!out.suggestedCategory && (out.suggestedType === 'Expense' || out.suggestedType === 'Refund')) {
    // fill Need/Want-neutral defaults only; category stays blank so the row is clearly unreviewed
    out.suggestedSpendingType = '';
  }
  return out;
}

/**
 * Pair opposite movements between two owned accounts within a few days.
 * Returns [{ out: rowA, in: rowB, kind: 'transfer' | 'card-payment', debtId }].
 * Only open (not yet imported) rows take part, and each row pairs at most once.
 */
function pairTransfers_(rows, ctx) {
  const open = rows.filter(r => isOpenStatus_(r.status) && !r.pairedImportId && r.date instanceof Date && r.amount !== '' && r.amount !== null);
  const used = {};
  const pairs = [];
  const outs = open.filter(r => Number(r.amount) > 0).sort((a, b) => a.date - b.date);
  const ins = open.filter(r => Number(r.amount) < 0);
  outs.forEach(o => {
    if (used[o.importId]) return;
    const cand = ins.filter(i => !used[i.importId] && i.accountId !== o.accountId
      && Math.abs(Math.abs(Number(i.amount)) - Number(o.amount)) < 0.005 && dayDiff_(i.date, o.date) <= PAIR_WINDOW_DAYS)
      .sort((a, b) => dayDiff_(a.date, o.date) - dayDiff_(b.date, o.date))[0];
    if (!cand) return;
    used[o.importId] = used[cand.importId] = true;
    const inAcct = ctx.accountsById[cand.accountId] || {};
    const outAcct = ctx.accountsById[o.accountId] || {};
    const inIsCard = inAcct.accountType === 'Credit Card';
    const outIsCard = outAcct.accountType === 'Credit Card';
    if (inIsCard && !outIsCard) {
      const debt = (ctx.debts || []).filter(d => d.linkedAccount === cand.accountId)[0];
      pairs.push({ out: o, in: cand, kind: 'card-payment', debtId: debt ? debt.id : '' });
    } else {
      pairs.push({ out: o, in: cand, kind: 'transfer', debtId: '' });
    }
  });
  return pairs;
}

/** Apply a pair to both rows' suggestion fields (mutates). */
function applyPair_(pair) {
  const o = pair.out, i = pair.in;
  o.pairedImportId = i.importId; i.pairedImportId = o.importId;
  if (pair.kind === 'card-payment' && pair.debtId) {
    o.suggestedType = 'Debt Payment'; o.suggestedCategory = 'Debt Payments'; o.suggestedSubcategory = 'Credit Card Payment';
    o.suggestedSpendingType = ''; o.suggestedDebtId = pair.debtId;
  } else {
    o.suggestedType = 'Transfer'; o.suggestedCategory = ''; o.suggestedSubcategory = ''; o.suggestedSpendingType = ''; o.suggestedDebtId = '';
  }
  i.suggestedType = 'Transfer'; i.suggestedCategory = ''; i.suggestedSubcategory = ''; i.suggestedSpendingType = '';
  o.status = IMPORT_STATUS.READY; i.status = IMPORT_STATUS.READY;
  o.pairKind = i.pairKind = pair.kind;
}

/** Find the paycheck a deposit belongs to. incomeRows: Income table; usedIds: already-linked Income IDs. */
function matchIncome_(amount, date, accountId, incomeRows, usedIds) {
  const abs = Math.abs(Number(amount || 0));
  const cands = (incomeRows || []).filter(i => !usedIds[i.id] && i.payDate instanceof Date
    && Math.abs(incomeTakeHome_(i) - abs) <= 0.01 && dayDiff_(i.payDate, date) <= 5
    && (!accountId || !i.depositAccount || i.depositAccount === accountId));
  return cands.length === 1 ? cands[0] : null;
}

/** Validation before a staged row may become a transaction. Returns [] when fine. */
function promotionProblems_(row) {
  const p = [];
  const type = row.suggestedType;
  if (!type) p.push('no Type');
  if (!(row.date instanceof Date)) p.push('no Date');
  if (row.amount === '' || row.amount === null || isNaN(Number(row.amount))) p.push('no Amount');
  if (!row.accountId) p.push('no Account ID');
  if (row.status === IMPORT_STATUS.SPLIT) p.push('needs the split panel');
  if (['Expense', 'Refund', 'Income', 'Savings', 'Debt Payment'].indexOf(type) >= 0 && !row.suggestedCategory) p.push('no Category');
  if ((type === 'Expense' || type === 'Refund') && !row.suggestedSubcategory) p.push('no Subcategory');
  if ((type === 'Expense' || type === 'Refund') && !row.suggestedSpendingType) p.push('no Spending Type');
  if (type === 'Savings' && !row.suggestedFundId) p.push('no Fund ID');
  if (type === 'Debt Payment' && !row.suggestedDebtId) p.push('no Debt ID');
  return p;
}

/** Build the Transactions row object for a staged row (pure). */
function stagingToTransaction_(row, txId, ctx) {
  const type = row.suggestedType;
  let defaults = { needWant: '', fixedVariable: '' };
  if (row.suggestedCategory && row.suggestedSubcategory) { try { defaults = taxonomyDefaults_(row.suggestedCategory, row.suggestedSubcategory); } catch (e) { /* custom pair */ } }
  const tx = {
    id: txId, date: row.date, description: row.merchantName || row.rawDescription, amount: Math.abs(Number(row.amount)),
    type, category: row.suggestedCategory || '', subcategory: row.suggestedSubcategory || '', accountId: row.accountId,
    person: row.suggestedPerson || 'Household', hhPersonal: 'Household', fixedVariable: defaults.fixedVariable, needWant: defaults.needWant,
    fundId: row.suggestedFundId || '', debtId: row.suggestedDebtId || '', recurring: !!row.ruleId && (ctx.rulesById[row.ruleId] || {}).autoImport === true,
    status: row.pending === true ? 'Pending' : 'Posted', notes: 'Imported from ' + (row.provider || 'bank feed') + ' · ' + (row.externalTxId || row.importId) + (row.pairKind ? ' · auto-paired ' + row.pairKind : ''),
    createdAt: new Date(), createdBy: IMPORT_USER,
    spendingType: (type === 'Expense' || type === 'Refund') ? (row.suggestedSpendingType || '') : '',
    fundingSource: (type === 'Expense' || type === 'Refund') ? (row.suggestedFundId ? ((ctx.fundsById[row.suggestedFundId] || {}).fundType === 'Emergency Fund' ? 'Emergency Fund' : 'Sinking Fund') : 'Monthly Cash Flow') : '',
    sourceIncomeId: '', receiptRef: '',
  };
  if (type === 'Income') {
    const inc = matchIncome_(row.amount, row.date, row.accountId, ctx.incomeRows, ctx.usedIncomeIds);
    if (inc) { tx.sourceIncomeId = inc.id; ctx.usedIncomeIds[inc.id] = true; }
  }
  return tx;
}

/* ---------- context loading ---------- */

function importContext_() {
  const accounts = readTable_(tdef_('ACCOUNTS'));
  const accountsById = {};
  accounts.forEach(a => { accountsById[a.id] = a; });
  const rules = readTable_(tdef_('RULES')).filter(r => r.active !== false);
  const rulesById = {};
  rules.forEach(r => { rulesById[r.id] = r; });
  const funds = readTable_(tdef_('FUNDS'));
  const fundsById = {};
  funds.forEach(f => { fundsById[f.id] = f; });
  const debts = readTable_(tdef_('DEBTS'));
  const incomeRows = readTable_(tdef_('INCOME'));
  const cats = readTable_(tdef_('CATS')).filter(c => c.category);
  const usedIncomeIds = {};
  readTable_(tdef_('TX')).forEach(t => { if (t.sourceIncomeId && t.isDeleted !== true) usedIncomeIds[t.sourceIncomeId] = true; });
  return { accounts, accountsById, rules, rulesById, funds, fundsById, debts, incomeRows, usedIncomeIds, cats,
    autoPairs: settingAutoPairs_() };
}

function settingAutoPairs_() {
  try { const r = ss_().getRangeByName('SETTING_AUTO_PAIRS'); return r ? r.getValue() !== false : true; } catch (e) { return true; }
}

function startDate_() {
  const v = PropertiesService.getScriptProperties().getProperty(PLAID_PROPS.START_DATE);
  if (!v) return null;
  const d = new Date(v + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/* ---------- writers ---------- */

/** Write (or rewrite) one staged row by its sheet row number. */
function writeStagingRow_(row) {
  const def = tdef_('STAGING');
  const o = {};
  def.columns.forEach(c => { o[c.key] = row[c.key] === undefined || row[c.key] === null ? '' : row[c.key]; });
  writeRows_(def, [o], row.__row);
}

/**
 * Upsert normalized bank items into Import Staging and promote what may go straight in.
 * items: [{ externalTxId, accountId, date, rawDescription, merchantName, amount, pending, pendingTxId, bankCategory }]
 * Returns counts.
 */
function ingestItems_(provider, items, ctx) {
  const def = tdef_('STAGING');
  syncLastRow_(def);
  ctx = ctx || importContext_();
  const existing = readTable_(def);
  const byExternal = {};
  existing.forEach(r => { if (r.externalTxId) byExternal[r.externalTxId] = r; });
  const start = startDate_();
  const counts = { added: 0, updated: 0, superseded: 0, skippedBeforeStart: 0, autoImported: 0, paired: 0, duplicates: 0 };
  let nextNum = parseInt(nextId_(def, 6).split('-')[1], 10);
  const newRows = [];
  const touched = {};

  items.forEach(it => {
    if (!it.externalTxId) return;
    if (start && it.date instanceof Date && it.date < start) { counts.skippedBeforeStart++; return; }
    const prev = byExternal[it.externalTxId];
    if (prev) {
      // modified: refresh facts, keep review state
      let changed = false;
      ['amount', 'date', 'rawDescription', 'merchantName', 'pending', 'bankCategory'].forEach(k => {
        const nv = it[k] === undefined ? prev[k] : it[k];
        if (String(prev[k]) !== String(nv)) { prev[k] = nv; changed = true; }
      });
      if (changed) {
        if (prev.status === IMPORT_STATUS.IMPORTED && prev.importedTxId) updateImportedTx_(prev);
        writeStagingRow_(prev); counts.updated++;
      }
      return;
    }
    const row = {
      importId: 'IMP-' + String(nextNum++).padStart(6, '0'), provider, externalTxId: it.externalTxId, accountId: it.accountId || '',
      date: it.date, rawDescription: it.rawDescription || '', amount: it.amount, pending: it.pending === true,
      merchantName: it.merchantName || '', bankCategory: it.bankCategory || '', pendingTxId: it.pendingTxId || '', notes: '',
      reviewed: false, importedTxId: '', pairedImportId: '', importedAt: '',
    };
    const cls = classifyRow_(row, ctx);
    Object.assign(row, cls);
    // posted version of a pending charge we already hold
    if (it.pendingTxId && byExternal[it.pendingTxId]) {
      const old = byExternal[it.pendingTxId];
      if (old.status === IMPORT_STATUS.IMPORTED && old.importedTxId) {
        row.status = IMPORT_STATUS.IMPORTED; row.importedTxId = old.importedTxId; row.importedAt = new Date(); row.reviewed = true;
        ['suggestedType', 'suggestedCategory', 'suggestedSubcategory', 'suggestedSpendingType', 'suggestedPerson', 'suggestedFundId', 'suggestedDebtId', 'ruleId'].forEach(k => { row[k] = old[k]; });
        updateImportedTx_(row);
      } else if (isOpenStatus_(old.status)) {
        // carry the owner's review work over, then retire the pending row
        ['suggestedType', 'suggestedCategory', 'suggestedSubcategory', 'suggestedSpendingType', 'suggestedPerson', 'suggestedFundId', 'suggestedDebtId', 'ruleId', 'reviewed'].forEach(k => { if (old[k] !== '' && old[k] !== null && old[k] !== undefined && old[k] !== false) row[k] = old[k]; });
        if (old.status === IMPORT_STATUS.SPLIT) row.status = IMPORT_STATUS.SPLIT;
        else if (old.reviewed === true) row.status = IMPORT_STATUS.READY;
      }
      if (old.status !== IMPORT_STATUS.REMOVED) { old.status = IMPORT_STATUS.SUPERSEDED; old.notes = (old.notes ? old.notes + ' · ' : '') + 'replaced by ' + row.externalTxId; writeStagingRow_(old); counts.superseded++; }
    }
    newRows.push(row); byExternal[row.externalTxId] = row; counts.added++;
  });

  if (newRows.length) {
    const firstNew = nextEmptyRow_(def);
    writeRows_(def, newRows.map(r => { const o = {}; def.columns.forEach(c => { o[c.key] = r[c.key] === undefined ? '' : r[c.key]; }); return o; }), firstNew);
    newRows.forEach((r, i) => { r.__row = firstNew + i; });
  }

  // pairing across everything still open
  const open = existing.filter(r => isOpenStatus_(r.status)).concat(newRows);
  const pairs = pairTransfers_(open, ctx);
  pairs.forEach(p => { applyPair_(p); writeStagingRow_(p.out); writeStagingRow_(p.in); touched[p.out.importId] = touched[p.in.importId] = true; });
  counts.paired = pairs.length * 2;

  // promotion of auto-import rules and (optionally) pairs
  const toPromote = newRows.filter(r => r.autoImport && r.status === IMPORT_STATUS.READY && !r.pairedImportId)
    .concat(ctx.autoPairs ? open.filter(r => r.pairedImportId && r.status === IMPORT_STATUS.READY && !r.importedTxId) : []);
  const uniq = [];
  const seen = {};
  toPromote.forEach(r => { if (!seen[r.importId]) { seen[r.importId] = true; uniq.push(r); } });
  const promoted = promoteRows_(uniq, ctx);
  counts.autoImported = promoted.length;
  return counts;
}

/** Create Transactions rows for staged rows and mark them Imported. Returns the staged rows promoted. */
function promoteRows_(rows, ctx) {
  if (!rows.length) return [];
  ctx = ctx || importContext_();
  const txDef = tdef_('TX');
  syncLastRow_(txDef);
  let nextNum = parseInt(nextId_(txDef, 6).split('-')[1], 10);
  const ok = [], txRows = [];
  rows.forEach(r => {
    if (promotionProblems_(r).length) return;
    const id = 'TX-' + String(nextNum++).padStart(6, '0');
    txRows.push(stagingToTransaction_(r, id, ctx));
    r.importedTxId = id; r.status = IMPORT_STATUS.IMPORTED; r.reviewed = true; r.importedAt = new Date();
    ok.push(r);
  });
  if (!txRows.length) return [];
  writeRows_(txDef, txRows);
  ok.forEach(r => writeStagingRow_(r));
  txRows.forEach(t => appendChangeLog_({ table: 'TX', recordId: t.id, field: '(row)', newValue: t.description + ' ' + t.amount, action: 'Import', user: IMPORT_USER, notes: t.notes }));
  return ok;
}

/** A staged row's facts changed after it was imported: reflect amount/date/status on the transaction. */
function updateImportedTx_(row) {
  const txDef = tdef_('TX');
  const r = findRowById_(txDef, row.importedTxId);
  if (r < 0) return;
  const sh = getOrCreateSheet_(txDef.sheet);
  const amountCell = sh.getRange(r, colIndex_(txDef, 'amount'));
  const old = amountCell.getValue();
  const nv = Math.abs(Number(row.amount));
  if (Math.abs(Number(old) - nv) > 0.004) { amountCell.setValue(nv); appendChangeLog_({ table: 'TX', recordId: row.importedTxId, field: 'Amount ($)', oldValue: old, newValue: nv, action: 'Update', user: IMPORT_USER, notes: 'bank posted a different amount' }); }
  if (row.date instanceof Date) sh.getRange(r, colIndex_(txDef, 'date')).setValue(row.date);
  sh.getRange(r, colIndex_(txDef, 'status')).setValue(row.pending === true ? 'Pending' : 'Posted');
  sh.getRange(r, colIndex_(txDef, 'updatedAt')).setValue(new Date());
  sh.getRange(r, colIndex_(txDef, 'updatedBy')).setValue(IMPORT_USER);
}

/** The bank withdrew these transactions: retire staged rows and soft-delete imported ones. */
function removeItems_(externalIds) {
  if (!externalIds || !externalIds.length) return 0;
  const def = tdef_('STAGING');
  const rows = readTable_(def);
  const txDef = tdef_('TX');
  const sh = getOrCreateSheet_(txDef.sheet);
  let n = 0;
  externalIds.forEach(id => {
    const r = rows.filter(x => x.externalTxId === id)[0];
    if (!r || r.status === IMPORT_STATUS.REMOVED) return;
    if (r.status === IMPORT_STATUS.IMPORTED && r.importedTxId) {
      const txRow = findRowById_(txDef, r.importedTxId);
      if (txRow > 0) {
        sh.getRange(txRow, colIndex_(txDef, 'isDeleted')).setValue(true);
        sh.getRange(txRow, colIndex_(txDef, 'deletedAt')).setValue(new Date());
        sh.getRange(txRow, colIndex_(txDef, 'updatedBy')).setValue(IMPORT_USER);
        appendChangeLog_({ table: 'TX', recordId: r.importedTxId, field: 'Is Deleted', oldValue: false, newValue: true, action: 'Soft Delete', user: IMPORT_USER, notes: 'bank removed ' + id });
      }
    }
    r.status = IMPORT_STATUS.REMOVED; r.notes = (r.notes ? r.notes + ' · ' : '') + 'removed by bank';
    writeStagingRow_(r); n++;
  });
  return n;
}

/* ---------- owner actions (menu) ---------- */

/**
 * Fill what the owner left blank on a reviewed expense row so that a tick plus a Category is
 * enough: a category with one active subcategory uses it; otherwise the category's "Other" line
 * stands in (noted on the row); a blank Spending Type takes the subcategory's default from the
 * Categories tab. Pure apart from reading ctx.cats. Returns the notes added (empty = nothing done).
 */
function completeReviewedRow_(row, ctx) {
  const notes = [];
  const type = row.suggestedType;
  if (!(type === 'Expense' || type === 'Refund') || !row.suggestedCategory) return notes;
  const cats = (ctx.cats || []).filter(c => c.category === row.suggestedCategory && c.active !== false);
  if (!row.suggestedSubcategory && cats.length) {
    const pick = cats.length === 1 ? cats[0] : (cats.filter(c => /^Other\b/.test(String(c.subcategory)))[0] || null);
    if (pick) {
      row.suggestedSubcategory = pick.subcategory;
      if (cats.length > 1) notes.push('subcategory defaulted to ' + pick.subcategory + ' (none chosen)');
    }
  }
  if (!row.suggestedSpendingType && row.suggestedSubcategory) {
    const match = cats.filter(c => c.subcategory === row.suggestedSubcategory)[0];
    let st = match ? match.spendingType : '';
    if (!st) { try { st = taxonomyDefaults_(row.suggestedCategory, row.suggestedSubcategory).spendingType; } catch (e) { st = ''; } }
    if (st) row.suggestedSpendingType = st;
  }
  if (notes.length) row.notes = (row.notes ? row.notes + ' · ' : '') + notes.join(' · ');
  return notes;
}

/** The import of every row ticked Reviewed?, without a dialog: used by the menu item and by every sync. */
function importReviewedRows_(ctx) {
  const def = tdef_('STAGING');
  ctx = ctx || importContext_();
  const rows = readTable_(def).filter(r => r.reviewed === true && isOpenStatus_(r.status) && !r.importedTxId);
  const problems = [];
  const good = [];
  rows.forEach(r => {
    completeReviewedRow_(r, ctx);
    const p = promotionProblems_(r);
    if (p.length) problems.push(r.importId + ' (' + (r.rawDescription || '').slice(0, 30) + '): ' + p.join(', ')); else good.push(r);
  });
  const done = promoteRows_(good, ctx);
  return { reviewed: rows.length, imported: done.length, problems };
}

/** Finance Tracker → Import reviewed rows (every sync does the same). */
function importReviewedRows() {
  const r = importReviewedRows_();
  let msg = r.imported + ' row(s) imported into Transactions.';
  if (r.problems.length) msg += '\n\n' + r.problems.length + ' reviewed row(s) could not be imported yet:\n' + r.problems.slice(0, 15).join('\n') + (r.problems.length > 15 ? '\n…' : '');
  if (!r.reviewed) msg = 'No rows are ticked Reviewed? on Import Staging. Tick the rows you have checked (a Category is enough for an expense), then run this again or wait for the next sync.';
  if (r.imported) { try { const dep = describeIncomeFromDeposits_(ensureIncomeFromDeposits_()); if (dep) msg += '\n\nIncome: ' + dep + '.'; } catch (e) { Logger.log('ensureIncomeFromDeposits_: ' + (e && e.message || e)); } }
  if (r.imported) { try { const auto = describeRecurringAuto_(recordRecurringBills_()); if (auto) msg += '\n\nRecurring bills: ' + auto; } catch (e) { Logger.log('recordRecurringBills_: ' + (e && e.message || e)); } }
  if (r.imported) { try { refreshSpendingNotes_(); } catch (e) { Logger.log('refreshSpendingNotes_: ' + (e && e.message || e)); } }
  alert_('Import reviewed rows', msg);
  return { imported: r.imported, problems: r.problems };
}

/** Finance Tracker → Apply rules to waiting rows now (every sync does the same). Fills blank suggestions; never overwrites a row already ticked Reviewed?. Returns { updated, imported }. */
function reapplyRules() {
  const r = reclassifyOpenRows_(importContext_(), null);
  alert_('Apply rules', r.updated + ' waiting row(s) updated from Import Rules; ' + r.imported + ' imported into Transactions.\n\nThis also happens on its own with every sync, so this menu item is only for when you do not want to wait.');
  return r;
}

function reclassifyOpenRows_(ctx, onlyRuleId) {
  const def = tdef_('STAGING');
  const rows = readTable_(def).filter(r => isOpenStatus_(r.status) && r.reviewed !== true);
  let n = 0;
  const toPromote = [];
  rows.forEach(r => {
    const cls = classifyRow_(r, ctx);
    if (!cls.ruleId) return;
    if (onlyRuleId && cls.ruleId !== onlyRuleId) return;
    if (r.ruleId === cls.ruleId && r.suggestedCategory === cls.suggestedCategory && r.status === cls.status) return;
    Object.assign(r, cls);
    writeStagingRow_(r); n++;
    if (cls.autoImport && r.status === IMPORT_STATUS.READY) toPromote.push(r);
  });
  const promoted = toPromote.length ? promoteRows_(toPromote, ctx) : [];
  return { updated: n, imported: promoted.length };
}

/** The staged (or transaction) row under the cursor, or null. */
function selectedRow_(tableKey) {
  const def = tdef_(tableKey);
  const ss = ss_();
  const sh = ss.getActiveSheet();
  if (!sh || sh.getName() !== def.sheet) return null;
  const r = ss.getActiveRange() ? ss.getActiveRange().getRow() : 0;
  if (r < def.firstRow) return null;
  const vals = sh.getRange(r, 1, 1, def.columns.length).getValues()[0];
  const o = { __row: r };
  def.columns.forEach((c, i) => { o[c.key] = vals[i]; });
  const anchor = def.columns[anchorCol_(def) - 1].key;
  return o[anchor] === '' ? null : o;
}

/* ---------- rule dialog ---------- */

function makeRuleFromRow() {
  const ui = ui_();
  const row = selectedRow_('STAGING');
  if (!row) { alert_('Make a rule', 'Click a row on the Import Staging tab first, then run this again.'); return; }
  const html = HtmlService.createHtmlOutputFromFile('RuleDialog').setWidth(560).setHeight(640);
  ui.showModalDialog(html, 'Make a rule from ' + row.importId);
}

/** Data for the rule dialog: the selected row plus dropdown choices. */
function getRuleDialogContext() {
  const row = selectedRow_('STAGING');
  if (!row) throw new Error('Click a row on Import Staging first.');
  const accounts = readTable_(tdef_('ACCOUNTS')).map(a => ({ id: a.id, name: a.name }));
  const funds = readTable_(tdef_('FUNDS')).map(f => ({ id: f.id, name: f.name }));
  const debts = readTable_(tdef_('DEBTS')).map(d => ({ id: d.id, name: d.name }));
  const taxonomy = TAXONOMY.map(t => ({ category: t[0], subcategory: t[1], spendingType: t[4] }));
  const lists = {};
  LISTS.forEach(l => { lists[l.key] = l.values; });
  return {
    row: { importId: row.importId, rawDescription: row.rawDescription, merchantName: row.merchantName, accountId: row.accountId, amount: row.amount,
      suggestedType: row.suggestedType, suggestedCategory: row.suggestedCategory, suggestedSubcategory: row.suggestedSubcategory,
      suggestedSpendingType: row.suggestedSpendingType, suggestedPerson: row.suggestedPerson, suggestedFundId: row.suggestedFundId, suggestedDebtId: row.suggestedDebtId },
    suggestedPattern: row.merchantName || normalizeText_(row.rawDescription).replace(/\s+\d{3,}.*$/, '').trim(),
    accounts, funds, debts, taxonomy, lists,
  };
}

/** Save a rule from the dialog and apply it to waiting rows. */
function saveRuleFromDialog(p) {
  const def = tdef_('RULES');
  syncLastRow_(def);
  const id = nextId_(def, 3);
  const rule = {
    id, pattern: p.pattern, matchType: p.matchType || 'Contains', accountId: p.accountId || '', type: p.type || 'Expense',
    category: p.category || '', subcategory: p.subcategory || '', spendingType: p.spendingType || '', person: p.person || '',
    fundId: p.fundId || '', debtId: p.debtId || '', autoImport: p.autoImport === true, splitRequired: p.splitRequired === true, active: true,
    createdAt: new Date(), notes: p.notes || '',
  };
  writeRows_(def, [rule]);
  appendChangeLog_({ table: 'RULES', recordId: id, field: '(row)', newValue: rule.pattern + ' → ' + rule.type + ' ' + rule.category + ' / ' + rule.subcategory, action: 'Insert', user: userEmail_() || 'rule-dialog' });
  const r = reclassifyOpenRows_(importContext_(), id);
  return { ruleId: id, updatedRows: r.updated, importedRows: r.imported };
}

/* ---------- split panel ---------- */

function showSplitPanel() {
  const ui = ui_();
  const html = HtmlService.createHtmlOutputFromFile('SplitPanel').setTitle('Split a transaction');
  ui.showSidebar(html);
}

/** Context for the split panel: the selected row on Import Staging or Transactions. */
function getSplitContext() {
  const sh = ss_().getActiveSheet();
  const name = sh ? sh.getName() : '';
  let src = null;
  if (name === SHEETS.STAGING) {
    const r = selectedRow_('STAGING');
    if (r) src = { source: 'staging', id: r.importId, row: r.__row, description: r.merchantName || r.rawDescription, amount: Math.abs(Number(r.amount || 0)), date: r.date, accountId: r.accountId, alreadyImported: r.status === IMPORT_STATUS.IMPORTED };
  } else if (name === SHEETS.TX) {
    const r = selectedRow_('TX');
    if (r) src = { source: 'tx', id: r.id, row: r.__row, description: r.description, amount: Math.abs(Number(r.amount || 0)), date: r.date, accountId: r.accountId, isParent: r.splitRole === 'Parent', childCount: 0 };
  }
  const taxonomy = TAXONOMY.filter(t => ['Income', 'Savings', 'Debt Payments'].indexOf(t[0]) < 0).map(t => ({ category: t[0], subcategory: t[1], spendingType: t[4] }));
  return { selected: src, sheet: name, taxonomy, spendingTypes: LISTS.filter(l => l.key === 'SPENDING_TYPES')[0].values };
}

/**
 * Save a split from the panel. p = { source, id, children: [{ amount, category, subcategory, spendingType, note }] }
 * Staging source: creates the Split Parent from the staged row, then the children, and marks the row Imported.
 * Transactions source: converts the existing row into the parent (same as the prompt helper).
 */
function saveSplitFromPanel(p) {
  const txDef = tdef_('TX');
  const children = (p.children || []).filter(c => Number(c.amount) > 0);
  if (!children.length) throw new Error('Add at least one child line.');
  const sum = children.reduce((s, c) => s + Number(c.amount), 0);
  let parent, parentId, parentRowNum;
  syncLastRow_(txDef);
  let nextNum = parseInt(nextId_(txDef, 6).split('-')[1], 10);
  const now = new Date();
  const who = userEmail_() || 'split-panel';
  if (p.source === 'staging') {
    const sDef = tdef_('STAGING');
    const sRow = findRowById_(sDef, p.id);
    if (sRow < 0) throw new Error('Staged row not found: ' + p.id);
    const vals = getOrCreateSheet_(sDef.sheet).getRange(sRow, 1, 1, sDef.columns.length).getValues()[0];
    const s = { __row: sRow }; sDef.columns.forEach((c, i) => { s[c.key] = vals[i]; });
    if (s.status === IMPORT_STATUS.IMPORTED) throw new Error('This row was already imported (' + s.importedTxId + '). Open it on Transactions to split it.');
    parentId = 'TX-' + String(nextNum++).padStart(6, '0');
    parent = {
      id: parentId, date: s.date, description: s.merchantName || s.rawDescription, amount: Math.abs(Number(s.amount)), type: 'Split Parent', accountId: s.accountId,
      person: s.suggestedPerson || 'Household', hhPersonal: 'Household', status: s.pending === true ? 'Pending' : 'Posted',
      notes: 'Imported from ' + (s.provider || 'bank feed') + ' · ' + s.externalTxId + ' · split into ' + children.length, createdAt: now, createdBy: who, splitRole: 'Parent', receiptRef: p.receiptRef || '',
    };
    writeRows_(txDef, [parent]);
    s.importedTxId = parentId; s.status = IMPORT_STATUS.IMPORTED; s.reviewed = true; s.importedAt = now; s.suggestedType = 'Split Parent';
    writeStagingRow_(s);
  } else {
    parentRowNum = findRowById_(txDef, p.id);
    if (parentRowNum < 0) throw new Error('Transaction not found: ' + p.id);
    const sh = getOrCreateSheet_(txDef.sheet);
    const vals = sh.getRange(parentRowNum, 1, 1, txDef.columns.length).getValues()[0];
    parent = {}; txDef.columns.forEach((c, i) => { parent[c.key] = vals[i]; });
    parentId = parent.id;
    sh.getRange(parentRowNum, colIndex_(txDef, 'type')).setValue('Split Parent');
    sh.getRange(parentRowNum, colIndex_(txDef, 'splitRole')).setValue('Parent');
    sh.getRange(parentRowNum, colIndex_(txDef, 'updatedAt')).setValue(now);
    sh.getRange(parentRowNum, colIndex_(txDef, 'updatedBy')).setValue(who);
    if (p.receiptRef) sh.getRange(parentRowNum, colIndex_(txDef, 'receiptRef')).setValue(p.receiptRef);
  }
  const rows = children.map(c => {
    let d = { needWant: '', fixedVariable: '', spendingType: 'Flexible' };
    try { d = taxonomyDefaults_(c.category, c.subcategory); } catch (e) { /* custom pair */ }
    return {
      id: 'TX-' + String(nextNum++).padStart(6, '0'), date: parent.date, description: String(parent.description) + ' — ' + c.subcategory, amount: Number(c.amount), type: 'Expense',
      category: c.category, subcategory: c.subcategory, accountId: parent.accountId, person: parent.person || 'Household', hhPersonal: parent.hhPersonal || 'Household',
      fixedVariable: d.fixedVariable, needWant: d.needWant, status: parent.status || 'Posted', notes: (c.note ? c.note + ' · ' : '') + 'Split child of ' + parentId,
      createdAt: now, createdBy: who, spendingType: c.spendingType || d.spendingType || 'Flexible', fundingSource: 'Monthly Cash Flow',
      splitRole: 'Child', parentTxId: parentId, receiptRef: parent.receiptRef || '',
    };
  });
  writeRows_(txDef, rows);
  appendChangeLog_({ table: 'TX', recordId: parentId, field: 'Type', oldValue: parent.type === 'Split Parent' ? '' : parent.type, newValue: 'Split Parent', action: 'Split', user: who, notes: rows.length + ' children: ' + rows.map(r => r.id).join(', ') });
  return { parentId, children: rows.map(r => r.id), difference: Math.round((Number(parent.amount) - sum) * 100) / 100 };
}
