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
 *     already covers.
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
  recur: ['id', 'name', 'category', 'subcategory', 'amount', 'frequency', 'dueDay', 'nextPayment', 'accountId', 'autoPay', 'active', 'notes'],
  expect: ['id', 'person', 'employer', 'frequency', 'typicalTakeHome', 'active', 'lastPayDate'],
  income: ['id', 'person', 'employer', 'payDate', 'takeHome'],
  util: ['id', 'utility', 'provider', 'dueDate', 'amount', 'status', 'paidDate'],
  debts: ['id', 'name', 'minPayment', 'dueDay', 'latestBalance', 'linkedAccount'],
  tx: ['id', 'date', 'description', 'amount', 'type', 'category', 'subcategory', 'debtId', 'isDeleted', 'splitRole', 'notes'],
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
  const tables = { recur: 'RECUR', expect: 'EXPECT', income: 'INCOME', util: 'UTIL', debts: 'DEBTS', tx: 'TX', accounts: 'ACCOUNTS' };
  const out = { autoMark: AUTO_RECORD_MARK, utilMap: UTILITY_FROM_SUBCATEGORY, checks: calendarChecks_(), cardOwed: {} };
  Object.keys(tables).forEach(k => { out[k] = trim(readTable_(tdef_(tables[k])), CAL_COLUMNS[k]); });
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
