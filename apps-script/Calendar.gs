/**
 * Household Finance Tracker — Calendar.gs
 * The bills and paychecks calendar: Finance Tracker → 📅 Calendar opens a pop-up with
 * one month at a time (this month first, arrows for the others). It shows:
 *   - every active bill on Recurring Payments on its due day (weekly bills, such as childcare, repeat
 *     on the weekday of their Next Payment Date);
 *   - every paycheck on Expected Income, counted forward and back from its last pay date;
 *   - every utility bill on Utility Bills, and for months whose bill has not arrived yet an estimate
 *     (the same month last year, else the average of the last 12 bills) on the usual due day;
 *   - each credit card with a Payment Due Day on Accounts, on that day, at what is owed on it now (posted
 *     balance plus pending charges) until a payment to the card is seen; bills charged to that card still
 *     show on their own days but are counted once, inside the card payment;
 *   - each card or loan on Debts with a minimum payment and due day that no Recurring Payments row
 *     already covers;
 *   - each savings transfer from checking: a fund on Savings & Reserves with a Planned Monthly, on the schedule
 *     its recent Savings transactions follow (the Roth IRA, $50 every Monday), counted with the bills.
 * An item shows as paid (or received) when the tracker has the matching payment. Anything paid that
 * the tracker has not seen yet (childcare by Venmo) can be ticked off by hand in the pop-up; those
 * ticks are kept in Script Properties, change no table and no total, and are only for the calendar.
 *
 * Speed (the owner, 2026-11-17: "very slow when I pull it up"): the tables are read once, as the pop-up
 * opens, trimmed to the columns the calendar uses, and handed to the page with it. Each month, arrow click and
 * tick is then worked out in the pop-up by CalendarMath.html (pure, shared with the Node tests); a tick is
 * saved in the background.
 */

const CAL_CHECKS_PROP = 'CALENDAR_CHECKS';
const CAL_KEEP_MONTHS = 13;      // ticks older than this are dropped when a new one is saved

/** Finance Tracker → 📅 Calendar */
function showBillsCalendar() {
  toast_('Opening the calendar…', 'Calendar');
  const t = HtmlService.createTemplateFromFile('CalendarDialog');
  // "<" is escaped so no text in the data can close the page's script tag.
  t.dataJson = JSON.stringify(calendarPayload_(new Date())).replace(/</g, '\\u003c');
  ui_().showModalDialog(t.evaluate().setWidth(1260).setHeight(780), 'Bills & paychecks');
}

/** The columns the calendar uses, per table. */
const CAL_COLUMNS = {
  recur: ['id', 'name', 'group', 'category', 'subcategory', 'amount', 'frequency', 'dueDay', 'nextPayment', 'accountId', 'autoPay', 'active', 'notes'],
  billChanges: ['id', 'recurId', 'date', 'usualAmount', 'newAmount', 'notes', 'isDeleted'],
  expect: ['id', 'person', 'employer', 'frequency', 'typicalTakeHome', 'active', 'lastPayDate'],
  income: ['id', 'person', 'employer', 'payDate', 'takeHome'],
  util: ['id', 'utility', 'provider', 'dueDate', 'amount', 'status', 'paidDate'],
  debts: ['id', 'name', 'minPayment', 'dueDay', 'latestBalance', 'linkedAccount'],
  tx: ['id', 'date', 'description', 'amount', 'type', 'category', 'subcategory', 'debtId', 'fundId', 'isDeleted', 'splitRole', 'notes'],
  funds: ['id', 'name', 'plannedMonthly'],
  accounts: ['id', 'name', 'accountType', 'currentBalance', 'lastUpdated', 'paymentDueDay'],
  staging: ['importId', 'accountId', 'date', 'rawDescription', 'amount', 'status', 'suggestedType', 'pairedImportId', 'importedTxId'],
};

/**
 * Everything the pop-up needs, read once: the tables trimmed to CAL_COLUMNS (dates as "D:yyyy-mm-dd" text),
 * the ticks, and for each card with a Payment Due Day what is owed on it now (balance plus pending charges,
 * worked out here with cardPending_ as the Financial Summary does). Only rows that can matter are kept:
 * a transaction's notes only say whether it is an automatic bill entry, and Import Staging keeps only the
 * rows of the cards with a due day: their payments, and their charges of the last 75 days.
 */
function calendarPayload_(today) {
  const t0 = today instanceof Date ? today : new Date();
  const isDate = (v) => Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
  const trim = (rows, keys) => rows.map(r => { const o = {}; keys.forEach(k => { const v = r[k]; o[k] = isDate(v) ? 'D:' + calYmd_(v) : v; }); return o; });
  const tables = { recur: 'RECUR', expect: 'EXPECT', income: 'INCOME', util: 'UTIL', debts: 'DEBTS', tx: 'TX', accounts: 'ACCOUNTS', funds: 'FUNDS' };
  const out = { autoMark: AUTO_RECORD_MARK, utilMap: UTILITY_FROM_SUBCATEGORY, checks: calendarChecks_(), cardOwed: {} };
  Object.keys(tables).forEach(k => { out[k] = trim(readTable_(tdef_(tables[k])), CAL_COLUMNS[k]); });
  out.billChanges = calendarBillChanges_();
  out.tx.forEach(t => { t.notes = String(t.notes || '').indexOf(AUTO_RECORD_MARK) >= 0 ? AUTO_RECORD_MARK : ''; });
  const cards = out.accounts.filter(a => a.id && a.accountType === 'Credit Card' && Number(a.paymentDueDay) > 0).map(a => a.id);
  out.staging = [];
  if (cards.length) {
    const staged = readTable_(tdef_('STAGING'));
    cards.forEach(id => {
      const acc = out.accounts.filter(a => a.id === id)[0];
      const bal = Number(acc.currentBalance);
      out.cardOwed[id] = acc.currentBalance === '' || isNaN(bal) ? null : Math.round((bal + cardPending_(staged, [id], t0)) * 100) / 100;
    });
    // The cards' payments (money in), and their charges of the last 75 days (to tell a bill already charged).
    const since = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - 75);
    out.staging = trim(staged.filter(x => cards.indexOf(x.accountId) >= 0 && (Number(x.amount) < 0 || (x.date instanceof Date && x.date >= since))), CAL_COLUMNS.staging);
  }
  return out;
}

/** The Bill Changes still in force, as the pop-up takes them (dates as "D:yyyy-mm-dd"). */
function calendarBillChanges_() {
  if (!ss_().getSheetByName(SHEETS.BILLCHG)) return []; // before Upgrade workbook adds the tab
  return readTable_(tdef_('BILLCHG')).filter(c => c.isDeleted !== true && c.recurId && c.date instanceof Date).map(c => {
    const o = {}; CAL_COLUMNS.billChanges.forEach(k => { o[k] = k === 'date' ? 'D:' + calYmd_(c[k]) : c[k]; }); return o;
  });
}

/**
 * Changes one bill on one date (the owner, 2026-11-17: the nanny out sick for two days, so this week's
 * childcare is less). Written to Bill Changes; the calendar shows the new amount for that date only, and that
 * month's Monthly Plan counts the difference. A change already there for the same bill and date is undone
 * first (Is Deleted ticked; rows are never removed); typing the usual amount just undoes it.
 * Returns the changes in force, for the pop-up to redraw.
 */
function saveBillChange(recurId, ymd, newAmount, note) {
  const bill = calendarChangeableBill_(recurId, ymd);
  const amount = Math.round(Number(newAmount) * 100) / 100;
  if (newAmount === '' || newAmount === null || !isFinite(amount) || amount < 0 || amount > 100000) throw new Error('Type an amount of $0 or more.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    calendarUndoChanges_(recurId, bill.date);
    const usual = Number(bill.row.amount);
    if (!(isFinite(usual) && Math.abs(usual - amount) < 0.005)) {
      const def = tdef_('BILLCHG');
      writeRows_(def, [{ id: nextId_(def, 4), recurId: bill.row.id, billName: String(bill.row.name || '').trim(), date: bill.date,
        usualAmount: isFinite(usual) ? usual : '', newAmount: amount, notes: String(note || '').slice(0, 200), createdAt: new Date(), isDeleted: false }]);
    }
  } finally { lock.releaseLock(); }
  return calendarBillChanges_();
}

/** Puts a bill back to its usual amount on that date (the change's Is Deleted is ticked). */
function undoBillChange(recurId, ymd) {
  const bill = calendarChangeableBill_(recurId, ymd);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { calendarUndoChanges_(recurId, bill.date); } finally { lock.releaseLock(); }
  return calendarBillChanges_();
}

/** The Recurring Payments row and date of a change, checked: an active bill outside the Loans group. */
function calendarChangeableBill_(recurId, ymd) {
  if (!ss_().getSheetByName(SHEETS.BILLCHG)) throw new Error('Run Finance Tracker → Upgrade workbook first: it adds the Bill Changes tab.');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
  if (!m) throw new Error('That date could not be read.');
  const row = readTable_(tdef_('RECUR')).filter(r => r.id === String(recurId || ''))[0];
  if (!row || row.active !== true) throw new Error('That bill is not an active row on Recurring Payments.');
  if (row.group === 'Loans') throw new Error('Loan payments are changed on Debts, not here.');
  return { row: row, date: new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) };
}

/** Ticks Is Deleted on every change in force for this bill and date. Changes only those cells. */
function calendarUndoChanges_(recurId, date) {
  const def = tdef_('BILLCHG');
  const sh = ss_().getSheetByName(def.sheet);
  const colDel = def.columns.findIndex(c => c.key === 'isDeleted') + 1, colAt = def.columns.findIndex(c => c.key === 'deletedAt') + 1;
  const ymd = calYmd_(date);
  readTable_(def).filter(c => c.recurId === recurId && c.isDeleted !== true && c.date instanceof Date && calYmd_(c.date) === ymd).forEach(c => {
    sh.getRange(c.__row, colDel).setValue(true);
    sh.getRange(c.__row, colAt).setValue(new Date());
  });
}

/** Ticks (or unticks) an item as paid but not in the tracker yet. The pop-up has already redrawn itself. */
function setCalendarCheck(key, on) {
  key = String(key || '');
  if (!/^[A-Za-z0-9|:_\- &]{3,80}$/.test(key)) throw new Error('That calendar item could not be saved.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const checks = calendarChecks_();
    if (on) checks[key] = calYmd_(new Date()); else delete checks[key];
    // Keep the store small: drop ticks on items dated more than CAL_KEEP_MONTHS ago.
    const cutoff = calYmd_(new Date(new Date().getFullYear(), new Date().getMonth() - CAL_KEEP_MONTHS, 1));
    Object.keys(checks).forEach(k => { const d = calKeyDate_(k); if (d && d < cutoff) delete checks[k]; });
    PropertiesService.getScriptProperties().setProperty(CAL_CHECKS_PROP, JSON.stringify(checks));
  } finally { lock.releaseLock(); }
  return true;
}

function calendarChecks_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(CAL_CHECKS_PROP);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch (e) { return {}; }
}

/* ---------- dates in item keys (also in CalendarMath.html, for the pop-up) ---------- */

function calYmd_(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

/** The yyyy-mm-dd date inside an item key (the last one), or ''. */
function calKeyDate_(k) {
  const m = String(k).match(/(\d{4}-\d{2}-\d{2})(?!.*\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}
