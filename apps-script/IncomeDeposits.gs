/**
 * Income from bank deposits.
 *
 * The Income tab is the only place income is counted from. A paycheck that arrives in checking is a
 * Transactions row of type Income; until now it only counted once a pay stub had been entered and
 * linked to it. This module gives every Income-type deposit that has no paycheck an Income row of its
 * own, so the money counts the day it lands and no stub is needed:
 *
 *  - a deposit from a known employer (the employer's name is in the bank description, or the same
 *    description was linked to that employer before) gets a row whose take-home is the deposit, with
 *    gross pay and each deduction scaled from the most recent real stub for that employer;
 *  - any other Income deposit gets a row at the deposit amount with no deductions.
 *
 * Every such row says "From bank deposit TX-…" in Notes. When a real stub for the same paycheck is
 * pasted later, Paste Import writes the stub over that row (same Income ID, so the link stays) instead
 * of adding a second paycheck.
 */

const INCOME_FROM_DEPOSIT_MARK = 'From bank deposit';
const INCOME_DEDUCTIONS = ['fedTax', 'stateTax', 'ssMed', 'health', 'retirement', 'otherDed'];
// words that say nothing about who paid: never enough on their own to tie a deposit to an employer
const DEPOSIT_GENERIC_WORDS = ['LLC', 'LTD', 'INC', 'CORP', 'CORPORATION', 'COMPANY', 'THE', 'AND', 'PUBLIC', 'SCHOOL', 'SCHOOLS', 'DISTRICT',
  'PAYROLL', 'PAYMENT', 'DIRECT', 'DEPOSIT', 'MOBILE', 'CHECK', 'TRANSFER', 'ONLINE', 'FROM', 'CREDIT', 'SALARY', 'WAGES', 'PPD', 'ACH', 'DES', 'DEP'];

/** Take-home of an Income row: the calculated column when it holds a number, else gross − deductions. */
function incomeTakeHome_(r) {
  if (r.takeHome !== '' && r.takeHome !== null && r.takeHome !== undefined && typeof r.takeHome !== 'string' && !isNaN(Number(r.takeHome))) return Number(r.takeHome);
  return Math.round((Number(r.gross || 0) - INCOME_DEDUCTIONS.reduce((s, k) => s + Number(r[k] || 0), 0)) * 100) / 100;
}

function isDepositIncomeRow_(r) { return String(r.notes || '').indexOf(INCOME_FROM_DEPOSIT_MARK) >= 0; }

/** Upper-case letter-only words of a bank description or employer name ("Martha's V 3314" → MARTHAS, V). */
function depositWords_(text) {
  return String(text || '').toUpperCase().replace(/['’`]/g, '').replace(/[^A-Z]+/g, ' ').trim().split(' ').filter(w => w);
}

/** The words of a name that identify it: four letters or more and not generic. */
function significantWords_(text) {
  return depositWords_(text).filter(w => w.length >= 4 && DEPOSIT_GENERIC_WORDS.indexOf(w) < 0);
}

/** Description with the numbers taken out, for "the same deposit text as last time". '' when nothing identifying is left. */
function depositKey_(description) {
  const words = depositWords_(description);
  return significantWords_(description).length ? words.join(' ') : '';
}

/**
 * Which regular paycheck a deposit belongs to. Pure.
 *   tx       { description, person }
 *   sources  [{ person, employer }]            every person + employer known from Expected Income and Income
 *   history  { depositKey: { person, employer } }  descriptions already linked to a paycheck
 * Returns { person, employer, how } or null when it cannot tell (or two employers fit equally well).
 */
function matchDepositSource_(tx, sources, history) {
  const persons = LISTS.filter(l => l.key === 'PERSONS')[0].values;
  const txPerson = persons.indexOf(tx.person) >= 0 ? tx.person : '';
  const fits = (s) => !txPerson || !s.person || s.person === txPerson;
  const key = depositKey_(tx.description);
  if (key && history && history[key] && fits(history[key])) return { person: history[key].person, employer: history[key].employer, how: 'same bank description as an earlier paycheck' };
  const words = depositWords_(tx.description);
  const has = (w) => words.some(d => d === w || (d.length >= 5 && w.indexOf(d) === 0) || (w.length >= 5 && d.indexOf(w) === 0));
  let best = [], bestScore = 0;
  (sources || []).filter(fits).forEach(s => {
    const sig = significantWords_(s.employer);
    if (!sig.length || !has(sig[0])) return;       // the first identifying word of the employer must be there
    const score = sig.filter(has).length;
    if (score > bestScore) { best = [s]; bestScore = score; } else if (score === bestScore) best.push(s);
  });
  if (best.length !== 1) return null;
  return { person: best[0].person, employer: best[0].employer, how: 'employer name in the bank description' };
}

/**
 * Gross pay and deductions for a deposit, scaled from a real stub so that gross − deductions is the
 * deposit to the cent. Pure. Returns null when the stub cannot be used.
 */
function estimatePaycheckFromDeposit_(amount, stub) {
  const net = Math.round(Number(amount) * 100) / 100;
  const stubNet = stub ? incomeTakeHome_(stub) : 0;
  if (!(net > 0) || !(stubNet > 0) || !(Number(stub.gross) > 0)) return null;
  const ratio = net / stubNet;
  const out = {};
  let ded = 0;
  INCOME_DEDUCTIONS.forEach(k => {
    const v = Number(stub[k] || 0);
    if (!v) return;
    out[k] = Math.round(v * ratio * 100) / 100;
    ded += out[k];
  });
  out.gross = Math.round((net + ded) * 100) / 100;
  return out;
}

/** Income Type for a deposit with no stub to copy from, from the transaction's subcategory. */
function incomeTypeFromSubcategory_(sub) {
  const types = LISTS.filter(l => l.key === 'INCOME_TYPES')[0].values;
  return types.indexOf(sub) >= 0 ? sub : 'Other';
}

/**
 * Gives every Income-type transaction that has no paycheck an Income row (see the file comment) and
 * writes that row's ID into the transaction's Source Income ID. Deposits that match a stub exactly are
 * linked to the stub first. Adds rows only; never changes or removes an entered paycheck. Safe to run
 * again: a deposit that already has a Source Income ID is left alone.
 * Returns { linked, created, estimated, plain, held: [text], details: [text] }.
 */
function ensureIncomeFromDeposits_() {
  const out = { linked: 0, created: 0, estimated: 0, plain: 0, held: [], details: [] };
  const txDef = tdef_('TX'), incDef = tdef_('INCOME');
  if (!ss_().getSheetByName(txDef.sheet) || !ss_().getSheetByName(incDef.sheet)) return out;
  try { out.linked = linkIncomeDeposits_().linked; } catch (e) { Logger.log('linkIncomeDeposits_: ' + (e && e.message || e)); }

  const tx = readTable_(txDef);
  const open = tx.filter(t => t.type === 'Income' && !t.sourceIncomeId && t.isDeleted !== true && t.date instanceof Date
    && Number(t.amount) > 0 && t.status !== 'Pending').sort((a, b) => a.date - b.date);
  if (!open.length) return out;

  syncLastRow_(incDef);
  const income = readTable_(incDef);
  const byId = {}; income.forEach(i => { byId[i.id] = i; });
  const linkedIds = {}; tx.forEach(t => { if (t.sourceIncomeId && t.isDeleted !== true) linkedIds[t.sourceIncomeId] = true; });
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

  // who pays regularly, and which bank descriptions have already been tied to a paycheck
  const sources = [], seenSource = {};
  const addSource = (person, employer) => {
    if (!employer) return;
    const k = String(person || '').toLowerCase() + '|' + String(employer).trim().toLowerCase();
    if (!seenSource[k]) { seenSource[k] = true; sources.push({ person: person || '', employer: String(employer).trim() }); }
  };
  const expDef = tdef_('EXPECT');
  if (ss_().getSheetByName(expDef.sheet)) readTable_(expDef).forEach(x => addSource(x.person, x.employer));
  income.filter(i => !isDepositIncomeRow_(i)).forEach(i => addSource(i.person, i.employer));
  const history = {}, clash = {};
  tx.forEach(t => {
    const inc = t.sourceIncomeId && t.isDeleted !== true ? byId[t.sourceIncomeId] : null;
    const key = inc && inc.employer ? depositKey_(t.description) : '';
    if (!key || clash[key]) return;
    if (history[key] && !(same(history[key].employer, inc.employer) && same(history[key].person, inc.person))) { delete history[key]; clash[key] = true; return; }
    if (sources.some(s => same(s.employer, inc.employer) && same(s.person, inc.person))) history[key] = { person: inc.person, employer: inc.employer };
  });

  const persons = LISTS.filter(l => l.key === 'PERSONS')[0].values;
  const today = todayMidnight_();
  const fresh = [], links = [];
  open.forEach(t => {
    const amount = Math.round(Number(t.amount) * 100) / 100;
    const src = matchDepositSource_(t, sources, history);
    const sample = /SAMPLE/.test(String(t.notes || '')) ? 'SAMPLE — ' : '';
    const row = { payDate: t.date, depositAccount: t.accountId || '', lastUpdated: today };
    let stub = null;
    if (src) {
      const stubs = income.filter(i => !isDepositIncomeRow_(i) && same(i.person, src.person) && same(i.employer, src.employer) && i.payDate instanceof Date)
        .sort((a, b) => a.payDate - b.payDate);
      // a stub for this very paycheck that is still unlinked means the amounts differ: adding a row would count the paycheck twice
      const waiting = stubs.filter(i => !linkedIds[i.id] && dayDiff_(i.payDate, t.date) <= 3)[0];
      if (waiting) {
        out.held.push(t.id + ' (' + money_(amount) + ') looks like paycheck ' + waiting.id + ', but that stub\'s take-home is ' + money_(incomeTakeHome_(waiting)) + '. Correct the stub, or type ' + waiting.id + ' into the deposit\'s Source Income ID.');
        return;
      }
      const usable = stubs.filter(i => Number(i.gross) > 0 && incomeTakeHome_(i) > 0);
      const before = usable.filter(i => i.payDate.getTime() <= t.date.getTime() + 5 * 86400000);
      stub = before.length ? before[before.length - 1] : (usable.length ? usable[usable.length - 1] : null);
    }
    const est = stub ? estimatePaycheckFromDeposit_(amount, stub) : null;
    if (est) {
      Object.keys(est).forEach(k => { row[k] = est[k]; });
      row.person = src.person; row.employer = src.employer; row.incomeType = stub.incomeType || 'Salary';
      row.notes = sample + INCOME_FROM_DEPOSIT_MARK + ' ' + t.id + ' (no pay stub). Take-home is the deposit; gross pay and deductions are estimated from ' + stub.id + '.';
      out.estimated++;
    } else {
      row.gross = amount;
      row.person = src ? src.person : (persons.indexOf(t.person) >= 0 ? t.person : '');
      row.employer = src ? src.employer : String(t.description || '').trim().slice(0, 60);
      row.incomeType = incomeTypeFromSubcategory_(t.subcategory);
      row.notes = sample + INCOME_FROM_DEPOSIT_MARK + ' ' + t.id + ' (no pay stub). Recorded at the deposit amount; no deductions are known.';
      out.plain++;
    }
    fresh.push(row);
    links.push(t);
  });
  if (!fresh.length) return out;

  const width = (incDef.idPattern || '').split('-').pop().length || 4;
  let nextNum = parseInt(nextId_(incDef, width).split('-')[1], 10);
  fresh.forEach(row => { row.id = incDef.idPrefix + '-' + String(nextNum++).padStart(width, '0'); });
  writeRows_(incDef, fresh);
  const sh = getOrCreateSheet_(txDef.sheet);
  const col = colIndex_(txDef, 'sourceIncomeId');
  const log = changeLogEnabled_();
  links.forEach((t, i) => {
    sh.getRange(t.__row, col).setValue(fresh[i].id);
    out.details.push(t.id + ' → ' + fresh[i].id + ' (' + (fresh[i].employer || 'no source') + ')');
    if (log) {
      appendChangeLog_({ table: 'INCOME', recordId: fresh[i].id, field: '(row)', newValue: 'Created from bank deposit ' + t.id, action: 'Insert', user: 'income-from-deposits' });
      appendChangeLog_({ table: 'TX', recordId: t.id, field: 'Source Income ID', oldValue: '', newValue: fresh[i].id, action: 'Update', notes: 'ensureIncomeFromDeposits' });
    }
  });
  out.created = fresh.length;
  return out;
}

/** One line for the sync and upgrade reports, or '' when nothing happened. */
function describeIncomeFromDeposits_(r) {
  if (!r) return '';
  const parts = [];
  if (r.linked) parts.push(r.linked + ' deposit(s) linked to a pay stub');
  if (r.created) parts.push(r.created + ' deposit(s) counted as income without a stub' + (r.estimated ? ' (' + r.estimated + ' with gross and deductions estimated from the last stub' + (r.plain ? ', ' + r.plain + ' at the deposit amount' : '') + ')' : ''));
  let text = parts.join('; ');
  if (r.held && r.held.length) text += (text ? '\n' : '') + r.held.length + ' deposit(s) left for you to check:\n' + r.held.slice(0, 6).join('\n');
  return text;
}

/**
 * For a pasted stub: the Income row made from the bank deposit of that same paycheck, if there is one,
 * so the stub replaces it instead of becoming a second paycheck. Pure.
 *   exact: same person, take-home within a cent, within 5 days;
 *   else:  the only deposit row for that person and employer within 3 days.
 */
function findDepositRowForStub_(stub, existing, taken) {
  const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const pool = (existing || []).filter(e => isDepositIncomeRow_(e) && !(taken || {})[e.id] && e.payDate instanceof Date && same(e.person, stub.person));
  const net = incomeTakeHome_(stub);
  const exact = pool.filter(e => Math.abs(incomeTakeHome_(e) - net) <= 0.01 && dayDiff_(e.payDate, stub.payDate) <= 5)
    .sort((a, b) => dayDiff_(a.payDate, stub.payDate) - dayDiff_(b.payDate, stub.payDate));
  if (exact.length) return exact[0];
  const near = pool.filter(e => same(e.employer, stub.employer) && dayDiff_(e.payDate, stub.payDate) <= 3);
  return near.length === 1 ? near[0] : null;
}

/** Writes an object's values over one existing row, leaving the ID and every formula column as they are. */
function overwriteRowValues_(def, rowNum, obj) {
  const sh = getOrCreateSheet_(def.sheet);
  let seg = null;
  const flush = () => { if (seg) { sh.getRange(rowNum, seg.start, 1, seg.vals.length).setValues([seg.vals]); seg = null; } };
  def.columns.forEach((c, i) => {
    if (c.f || c.arrayFormula || c.key === 'id') { flush(); return; }
    if (!seg) seg = { start: i + 1, vals: [] };
    seg.vals.push(obj[c.key] === undefined || obj[c.key] === null ? '' : obj[c.key]);
  });
  flush();
}
