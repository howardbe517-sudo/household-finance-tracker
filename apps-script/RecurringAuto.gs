/**
 * Bills that record themselves.
 *
 * Spending is counted from Transactions, so a bill counts only once its payment has been imported
 * and categorized. Rent is a fixed amount that the owner pays by Venmo, where the bank description
 * says nothing, so it would show late or not at all. A Recurring Payments row with "Record
 * Automatically?" ticked is therefore written to Transactions on its due day at its Amount.
 *
 * So the bill counts once and never twice, that automatic entry holds only what real payments have
 * not covered yet: when a payment in the same month is categorized with the bill's Category and
 * Subcategory, the automatic entry is reduced by it, and once the payments reach the Amount the
 * automatic entry is soft-deleted. The month's total for the bill is the Amount (or the real
 * payments, if they come to more).
 *
 * Monthly bills only. Rows are added, their amount adjusted, or soft-deleted; nothing is removed
 * and no other transaction is touched.
 */

const AUTO_RECORD_MARK = 'Recorded automatically';

function autoRecordKey_(recId, month) {
  return '[' + recId + '|' + month.getFullYear() + '-' + ('0' + (month.getMonth() + 1)).slice(-2) + ']';
}

function isAutoRecordRow_(t) { return String(t.notes || '').indexOf(AUTO_RECORD_MARK) >= 0; }

/**
 * What the automatic entry of one bill should be for one month. Pure.
 *   rec    Recurring Payments row ({ id, amount, category, subcategory, dueDay })
 *   txRows Transactions rows
 *   month  first of the month
 *   today  today's date
 * Returns { due, date, paid, remainder, existing }: whether the due day has arrived, the date of
 * the entry, the real payments so far (expenses minus refunds in the bill's category and
 * subcategory that month, automatic entries left out), what is still uncovered, and the automatic
 * entry already there for that bill and month (soft-deleted or not), if any.
 */
function autoRecordPlan_(rec, txRows, month, today) {
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const day = Math.min(Math.max(1, Math.round(Number(rec.dueDay) || 1)), lastDay);
  const date = new Date(month.getFullYear(), month.getMonth(), day);
  const key = autoRecordKey_(rec.id, month);
  let paid = 0, existing = null;
  (txRows || []).forEach(t => {
    if (String(t.notes || '').indexOf(key) >= 0) { existing = t; return; }
    if (t.isDeleted === true || isAutoRecordRow_(t) || !(t.date instanceof Date)) return;
    if (t.date.getFullYear() !== month.getFullYear() || t.date.getMonth() !== month.getMonth()) return;
    if (t.category !== rec.category || t.subcategory !== rec.subcategory) return;
    if (t.type === 'Expense') paid += Number(t.amount || 0); else if (t.type === 'Refund') paid -= Number(t.amount || 0);
  });
  paid = Math.round(paid * 100) / 100;
  const remainder = Math.max(0, Math.round((Number(rec.amount || 0) - paid) * 100) / 100);
  return { due: today.getTime() >= date.getTime(), date, paid, remainder, existing };
}

/**
 * Keeps the automatic entries right for every Recurring Payments row ticked "Record Automatically?":
 * adds this month's entry once its due day has come, and brings the entries of this month and the
 * two before it in line with the real payments (reduce, restore, or soft-delete when covered).
 * Runs with every sync, the upgrade, after reviewed rows are imported, and when a transaction or a
 * recurring bill is edited. Safe to run again. Returns { created, adjusted, closed, skipped: [text], details: [text] }.
 */
function recordRecurringBills_() {
  const out = { created: 0, adjusted: 0, closed: 0, skipped: [], details: [] };
  const recDef = tdef_('RECUR'), txDef = tdef_('TX');
  if (!ss_().getSheetByName(recDef.sheet) || !ss_().getSheetByName(txDef.sheet)) return out;
  const recs = readTable_(recDef).filter(r => r.autoRecord === true && r.active === true);
  if (!recs.length) return out;
  const sh = getOrCreateSheet_(txDef.sheet);
  const today = todayMidnight_();
  const thisMonth = monthStart_(today);
  const now = new Date();
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const col = (k) => colIndex_(txDef, k);
  const log = changeLogEnabled_();
  let tx = readTable_(txDef);
  recs.forEach(rec => {
    const name = String(rec.name || rec.id).trim();
    if (!(Number(rec.amount) > 0) || !rec.category || !rec.subcategory) { out.skipped.push(name + ': needs an Amount, a Category and a Subcategory'); return; }
    if (rec.frequency && rec.frequency !== 'Monthly') { out.skipped.push(name + ': only Monthly bills can be recorded automatically (this one is ' + rec.frequency + ')'); return; }
    [0, -1, -2].forEach(back => {
      const month = addMonths_(thisMonth, back);
      const plan = autoRecordPlan_(rec, tx, month, today);
      const label = MONTHS[month.getMonth()] + ' ' + month.getFullYear();
      const ex = plan.existing;
      if (!ex) {
        if (back !== 0 || !plan.due || plan.remainder <= 0) return; // past months are never back-filled
        let d = { needWant: '', fixedVariable: '', spendingType: '' };
        try { d = taxonomyDefaults_(rec.category, rec.subcategory); } catch (e) { /* a category the owner added */ }
        const id = nextId_(txDef, (txDef.idPattern || '').split('-').pop().length || 6);
        writeRows_(txDef, [{
          id, date: plan.date, description: name + ' (recorded automatically)', amount: plan.remainder, type: 'Expense',
          category: rec.category, subcategory: rec.subcategory, accountId: rec.accountId || '', person: rec.owner || 'Household', hhPersonal: rec.hhPersonal || 'Household',
          fixedVariable: d.fixedVariable || '', needWant: d.needWant || '', recurring: true, status: 'Posted',
          notes: (/SAMPLE/.test(String(rec.notes || '')) ? 'SAMPLE — ' : '') + AUTO_RECORD_MARK + ' from Recurring Payments ' + rec.id + ' for ' + label + ' ' + autoRecordKey_(rec.id, month) + '. Holds what real payments categorized ' + rec.category + ' / ' + rec.subcategory + ' have not covered yet; it shrinks as they arrive and is marked deleted once they cover the bill.',
          createdAt: now, createdBy: 'recurring-auto', spendingType: d.spendingType || 'Fixed', fundingSource: 'Monthly Cash Flow',
        }]);
        out.created++; out.details.push(name + ' ' + label + ': recorded ' + moneyNote_(plan.remainder) + (plan.paid > 0 ? ' (' + moneyNote_(plan.paid) + ' already paid)' : ''));
        if (log) appendChangeLog_({ table: 'TX', recordId: id, field: '(row)', newValue: 'Recorded automatically from ' + rec.id + ' for ' + label, action: 'Insert', user: 'recurring-auto' });
        tx = readTable_(txDef); // the new row is part of the ledger for the months and bills still to check
        return;
      }
      const wasDeleted = ex.isDeleted === true;
      if (plan.remainder <= 0) {
        if (wasDeleted) return;
        sh.getRange(ex.__row, col('isDeleted')).setValue(true);
        sh.getRange(ex.__row, col('deletedAt')).setValue(now);
        sh.getRange(ex.__row, col('updatedAt')).setValue(now);
        out.closed++; out.details.push(name + ' ' + label + ': covered by ' + moneyNote_(plan.paid) + ' in real payments, automatic entry ' + ex.id + ' closed');
        if (log) appendChangeLog_({ table: 'TX', recordId: ex.id, field: 'Is Deleted', oldValue: 'FALSE', newValue: 'TRUE', action: 'Update', user: 'recurring-auto', notes: 'real payments cover ' + rec.id + ' for ' + label });
        return;
      }
      if (!wasDeleted && Math.abs(Number(ex.amount || 0) - plan.remainder) < 0.005) return;
      sh.getRange(ex.__row, col('amount')).setValue(plan.remainder);
      sh.getRange(ex.__row, col('updatedAt')).setValue(now);
      if (wasDeleted) { sh.getRange(ex.__row, col('isDeleted')).setValue(false); sh.getRange(ex.__row, col('deletedAt')).setValue(''); }
      out.adjusted++; out.details.push(name + ' ' + label + ': ' + moneyNote_(plan.paid) + ' paid so far, automatic entry ' + ex.id + ' now ' + moneyNote_(plan.remainder));
      if (log) appendChangeLog_({ table: 'TX', recordId: ex.id, field: 'Amount ($)', oldValue: ex.amount, newValue: plan.remainder, action: 'Update', user: 'recurring-auto', notes: 'real payments toward ' + rec.id + ' for ' + label + ': ' + plan.paid });
    });
  });
  return out;
}

/** One line for the sync and upgrade reports, or '' when nothing happened. */
function describeRecurringAuto_(r) {
  if (!r) return '';
  const parts = [];
  if (r.created) parts.push(r.created + ' bill(s) recorded automatically');
  if (r.adjusted) parts.push(r.adjusted + ' automatic entry(ies) adjusted for payments that arrived');
  if (r.closed) parts.push(r.closed + ' automatic entry(ies) closed because the bill is paid');
  let text = parts.join('; ');
  if (r.details && r.details.length) text += (text ? ':\n' : '') + r.details.slice(0, 6).join('\n');
  if (r.skipped && r.skipped.length) text += (text ? '\n' : '') + 'Not recorded: ' + r.skipped.slice(0, 4).join('; ');
  return text;
}
