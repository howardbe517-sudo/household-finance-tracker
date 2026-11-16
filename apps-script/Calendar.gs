/**
 * Household Finance Tracker — Calendar.gs
 * The bills and paychecks calendar: Finance Tracker → Bills & paychecks calendar… opens a pop-up with
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
 * The month is worked out by calendarMonth_ (pure, tested in Node); this file's other functions only
 * read the Sheet and keep the ticks.
 */

const CAL_CHECKS_PROP = 'CALENDAR_CHECKS';
const CAL_KEEP_MONTHS = 13;      // ticks older than this are dropped when a new one is saved
const CAL_PAY_WINDOW = 3;        // a paycheck counts as received within 3 days of its payday
const CAL_INCOME_WINDOW = 3;

/** Finance Tracker → Bills & paychecks calendar… */
function showBillsCalendar() {
  const html = HtmlService.createHtmlOutputFromFile('CalendarDialog').setWidth(1060).setHeight(720);
  ui_().showModalDialog(html, 'Bills & paychecks');
}

/** One month for the pop-up. year and month (1–12) default to this month. */
function getCalendarMonth(year, month) {
  const today = new Date();
  const y = Number(year) || today.getFullYear();
  const m = Number(month) ? Number(month) - 1 : today.getMonth();
  const src = {
    recur: readTable_(tdef_('RECUR')),
    expect: readTable_(tdef_('EXPECT')),
    income: readTable_(tdef_('INCOME')),
    util: readTable_(tdef_('UTIL')),
    debts: readTable_(tdef_('DEBTS')),
    tx: readTable_(tdef_('TX')),
    accounts: readTable_(tdef_('ACCOUNTS')),
    staging: readTable_(tdef_('STAGING')),
  };
  return calendarView_(y, m, src, today, calendarChecks_());
}

/** Ticks (or unticks) an item as paid but not in the tracker yet. Returns the month again. */
function setCalendarCheck(key, on, year, month) {
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
  return getCalendarMonth(year, month);
}

function calendarChecks_() {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(CAL_CHECKS_PROP);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === 'object' ? o : {};
  } catch (e) { return {}; }
}

/* ---------- pure ---------- */

function calYmd_(d) {
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

/** The yyyy-mm-dd date inside an item key (the last one), or ''. */
function calKeyDate_(k) {
  const m = String(k).match(/(\d{4}-\d{2}-\d{2})(?!.*\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function calIsDate_(v) { return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime()); }
function calDay_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function calAddDays_(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function calDaysBetween_(a, b) { return Math.round((calDay_(b).getTime() - calDay_(a).getTime()) / 86400000); }
function calNum_(v) { const x = Number(v); return (v === '' || v === null || v === undefined || isNaN(x)) ? null : x; }
function calRound_(x) { return Math.round(x * 100) / 100; }

/** A day of the month, moved to the month's last day when the month is shorter (a bill due on the 31st). */
function calDayIn_(y, m, day) {
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(Math.max(1, Math.round(day)), last));
}

/** The dates in [from, to] that are a whole number of steps of `days` days from anchor. */
function calStepDates_(anchor, days, from, to) {
  const out = [];
  const k0 = Math.ceil(calDaysBetween_(anchor, from) / days);
  for (let k = k0; ; k++) {
    const d = calAddDays_(calDay_(anchor), k * days);
    if (d > to) break;
    if (d >= from) out.push(d);
  }
  return out;
}

/** The dates in month (y, m) for a bill that comes every `months` months from anchor, on `day`. */
function calMonthStepDates_(anchor, months, day, y, m) {
  const diff = (y - anchor.getFullYear()) * 12 + (m - anchor.getMonth());
  if (((diff % months) + months) % months !== 0) return [];
  return [calDayIn_(y, m, day || anchor.getDate())];
}

/**
 * The month as the pop-up draws it. Pure. The grid runs from the Sunday on or before the 1st to the Saturday on
 * or after the last day, and, in the current month, on far enough that the 7 days after today are always on
 * it (the owner, 2026-11-16: "always show the days for the upcoming week"). Days of the months before and after
 * are filled with their own items (spill), worked out for their own month; the totals stay this month's.
 * Adds { gridStart 'yyyy-mm-dd', gridDays, spill: [items] } to calendarMonth_'s result.
 */
function calendarView_(y, m, src, today, checks) {
  const res = calendarMonth_(y, m, src, today, checks);
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const t0 = calDay_(today instanceof Date ? today : new Date());
  const gridStart = calAddDays_(first, -first.getDay());
  let gridEnd = calAddDays_(last, 6 - last.getDay());
  if (t0 >= first && t0 <= last) { const wk = calAddDays_(t0, 7); while (gridEnd < wk) gridEnd = calAddDays_(gridEnd, 7); }
  const spill = [];
  if (gridStart < first) {
    const p = new Date(y, m - 1, 1), from = calYmd_(gridStart);
    calendarMonth_(p.getFullYear(), p.getMonth(), src, today, checks).items.forEach(it => { if (it.date >= from) spill.push(it); });
  }
  if (gridEnd > last) {
    const n = new Date(y, m + 1, 1), to = calYmd_(gridEnd);
    calendarMonth_(n.getFullYear(), n.getMonth(), src, today, checks).items.forEach(it => { if (it.date <= to) spill.push(it); });
  }
  res.gridStart = calYmd_(gridStart);
  res.gridDays = calDaysBetween_(gridStart, gridEnd) + 1;
  res.spill = spill;
  return res;
}

/**
 * Everything on the calendar for one month. Pure.
 *   y, m      the year and month (0–11)
 *   src       { recur, expect, income, util, debts, tx, accounts, staging }: rows as readTable_ returns them
 *   today     today's date
 *   checks    { itemKey: 'yyyy-mm-dd ticked' }: items ticked as paid by hand
 * Returns { year, month, label, today, items: [...], totals: {...}, notShown: [text] }. Each item:
 *   { key, date 'yyyy-mm-dd', kind 'bill'|'pay'|'utility'|'debt', name, amount, estimate, status, statusText,
 *     detail, onCard, paidAmount, checked }
 * status: 'paid' (the tracker has the payment), 'checked' (ticked by hand), 'partial', 'due' (still to come),
 * 'late' (its day passed within the last 31 days and nothing has been seen), 'past' (older and nothing seen);
 * for paychecks 'received', 'checked', 'expected', 'late', 'past'.
 */
function calendarMonth_(y, m, src, today, checks) {
  src = src || {}; checks = checks || {};
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const t0 = calDay_(today instanceof Date ? today : new Date());
  const items = [], notShown = [];
  const accName = {}, cardIds = {}, cardDue = {}, cardBills = {};
  (src.accounts || []).forEach(a => {
    if (!a.id) return;
    accName[a.id] = a.name || a.id;
    if (a.accountType === 'Credit Card') { cardIds[a.id] = true; if (calNum_(a.paymentDueDay)) cardDue[a.id] = a; }
  });

  // Transactions that can pay a bill: live, not a split parent, not an automatic stand-in for a bill.
  const autoMark = typeof AUTO_RECORD_MARK === 'string' ? AUTO_RECORD_MARK : 'Recorded automatically';
  const payTx = (src.tx || []).filter(t => t.id && t.isDeleted !== true && t.splitRole !== 'Parent' && calIsDate_(t.date) &&
    String(t.notes || '').indexOf(autoMark) < 0 &&
    (t.type === 'Expense' || t.type === 'Debt Payment' || t.type === 'Savings' || t.type === 'Transfer'))
    .map(t => ({ t, used: false }))
    .sort((a, b) => a.t.date - b.t.date);
  const pairKey = (c, s) => String(c || '') + '|' + String(s || '');

  /* -- Recurring Payments -- */
  // A utility tracked bill by bill on Utility Bills is shown from there, not again from Recurring Payments.
  const utilMap = typeof UTILITY_FROM_SUBCATEGORY === 'object' ? UTILITY_FROM_SUBCATEGORY : { 'Natural Gas': 'Gas', 'Electric': 'Electric', 'Water & Sewer': 'Water & Sewer' };
  const utilTracked = {};
  (src.util || []).forEach(u => { if (u.id && u.utility) utilTracked[u.utility] = true; });
  const recur = (src.recur || []).filter(r => r.id && r.active === true && !(r.category === 'Housing' && utilTracked[utilMap[r.subcategory]]));
  const pairCount = {};
  recur.forEach(r => { const k = pairKey(r.category, r.subcategory); pairCount[k] = (pairCount[k] || 0) + 1; });
  const lastTxDate = (r) => {
    let best = null;
    payTx.forEach(p => {
      if (pairKey(p.t.category, p.t.subcategory) !== pairKey(r.category, r.subcategory)) return;
      const amt = calNum_(r.amount);
      if (pairCount[pairKey(r.category, r.subcategory)] > 1 && amt !== null && Math.abs(Number(p.t.amount) - amt) > Math.max(1, amt * 0.1)) return;
      if (!best || p.t.date > best) best = p.t.date;
    });
    return best;
  };
  recur.forEach(r => {
    const amt = calNum_(r.amount);
    const day = calNum_(r.dueDay);
    const next = calIsDate_(r.nextPayment) ? r.nextPayment : null;
    const freq = r.frequency || 'Monthly';
    let dates = [], window = 10, early = null;
    if (freq === 'Weekly' || freq === 'Biweekly') {
      const anchor = next || lastTxDate(r);
      // A payment counts for the date before it, up to 5 days late (10 for biweekly): Venmo can take
      // days to show. It may be 1 day early (3 for biweekly). The windows of two dates never overlap.
      window = freq === 'Weekly' ? 5 : 10;
      early = freq === 'Weekly' ? 1 : 3;
      if (anchor) dates = calStepDates_(anchor, freq === 'Weekly' ? 7 : 14, first, last);
      else { notShown.push(r.name + ' (' + freq.toLowerCase() + '): add a Next Payment Date on Recurring Payments to place it'); return; }
    } else if (freq === 'Monthly') {
      if (day) dates = [calDayIn_(y, m, day)];
      else if (next) dates = [calDayIn_(y, m, next.getDate())];
      else { notShown.push(r.name + ': add a Due Day on Recurring Payments to place it'); return; }
    } else {
      const months = freq === 'Quarterly' ? 3 : freq === 'Semiannual' ? 6 : 12;
      window = 15;
      if (!next) { notShown.push(r.name + ' (' + freq.toLowerCase() + '): add a Next Payment Date on Recurring Payments to place it'); return; }
      dates = calMonthStepDates_(next, months, day, y, m);
    }
    if (amt === null && dates.length) notShown.push(r.name + ': shown without an amount until Amount is filled in on Recurring Payments');
    const shared = pairCount[pairKey(r.category, r.subcategory)] > 1;
    dates.forEach(d => {
      // Payments within the window with the bill's Category and Subcategory. Where several bills share
      // them, only a payment within 10% (at least $1) of this bill's Amount counts, the closest one. Otherwise
      // every payment in the window adds up (rent paid in several Venmo payments); a weekly or biweekly bill
      // needs half its Amount to show as paid (a short childcare week), any other bill 90%. The windows of
      // two dates of one bill never overlap (weekly 1 day early to 5 late, biweekly 3 early to 10 late,
      // 10 days either side for monthly, 15 for longer).
      const from = calAddDays_(d, -(early === null ? window : early)), to = calAddDays_(d, window);
      const cands = payTx.filter(p => !p.used && p.t.date >= from && p.t.date <= to && pairKey(p.t.category, p.t.subcategory) === pairKey(r.category, r.subcategory));
      let matched = [];
      if (shared) {
        const ok = cands.filter(p => amt === null || Math.abs(Number(p.t.amount) - amt) <= Math.max(1, amt * 0.1));
        ok.sort((a, b) => Math.abs(calDaysBetween_(a.t.date, d)) - Math.abs(calDaysBetween_(b.t.date, d)));
        if (ok.length) matched = [ok[0]];
      } else {
        matched = cands;
      }
      matched.forEach(p => { p.used = true; });
      const paid = calRound_(matched.reduce((s, p) => s + (Number(p.t.amount) || 0), 0));
      const onCard = !!(r.accountId && cardIds[r.accountId]);
      const inCardPayment = onCard && !!cardDue[r.accountId];
      if (inCardPayment) cardBills[r.accountId] = (cardBills[r.accountId] || 0) + (amt || 0);
      items.push(calItem_({
        key: r.id + '|' + calYmd_(d), date: d, kind: 'bill', name: String(r.name || r.id).trim(), amount: amt,
        estimate: false, paidAmount: matched.length ? paid : null, matched: matched.map(p => p.t),
        onCard, account: r.accountId ? (accName[r.accountId] || r.accountId) : '', autoPay: r.autoPay === true,
        share: shared ? 0 : (freq === 'Weekly' || freq === 'Biweekly') ? 0.5 : 0.9,
        inTotals: !inCardPayment, cardName: inCardPayment ? calCardName_(cardDue[r.accountId]) : '',
      }, t0, checks));
    });
  });

  /* -- Credit card payments (Accounts: Payment Due Day) -- */
  const staging = (src.staging || []).filter(x => x.importId && calIsDate_(x.date) && x.status !== 'Superseded' && x.status !== 'Removed');
  // A payment to the card: money in, labelled Transfer or Debt Payment (as the feed pairs card payments), or
  // paired with the checking side. The description is used only for a row with no type yet, so a refund
  // ("AMAZON PAYMENTS REFUND") is never taken for a payment.
  const isCardPayment = (x) => Number(x.amount) < 0 && (x.suggestedType === 'Transfer' || x.suggestedType === 'Debt Payment' ||
    (!!x.pairedImportId && x.suggestedType !== 'Refund' && x.suggestedType !== 'Income') ||
    (!x.suggestedType && /PAYMENT|PYMT|THANK YOU/i.test(String(x.rawDescription || '')) && !/REFUND|RETURN|CREDIT/i.test(String(x.rawDescription || ''))));
  Object.keys(cardDue).forEach(id => {
    const a = cardDue[id];
    const day = calNum_(a.paymentDueDay);
    const d = calDayIn_(y, m, day);
    // A payment to the card since the previous due date counts, up to 3 days late (as for a debt), so a
    // payment never pays two months. The card's own side of the payment is read from Import Staging.
    const prev = calDayIn_(y, m - 1, day);
    const pays = staging.filter(x => x.accountId === id && isCardPayment(x) && x.date > calAddDays_(prev, 3) && x.date <= calAddDays_(d, 3));
    const paid = calRound_(pays.reduce((s2, x) => s2 - Number(x.amount), 0));
    // Until then: what is owed on the card now, as the Financial Summary shows it (posted balance plus
    // charges still pending at the bank).
    const bal = calNum_(a.currentBalance);
    const owed = bal === null ? null : calRound_(bal + (typeof cardPending_ === 'function' ? cardPending_(src.staging || [], [id], t0) : 0));
    const fd = (x) => (x.getMonth() + 1) + '/' + x.getDate();
    const fm = (x) => '$' + Number(x).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    // Until it is paid: for this cycle's payment (the next due date, or one just missed), what is owed on the
    // card now, or this month's bills charged to it if those come to more (a bill charged after today is not
    // owed yet). A later month's payment would repeat that figure, so it uses the card's recent payments.
    let nextDue = calDayIn_(t0.getFullYear(), t0.getMonth(), day);
    if (nextDue < t0) nextDue = calDayIn_(t0.getFullYear(), t0.getMonth() + 1, day);
    const bills = calRound_(cardBills[id] || 0);
    let est = null, basis = '';
    if (d <= nextDue) {
      est = owed === null ? (bills || null) : Math.max(owed, bills);
      basis = owed !== null && owed >= bills ? 'what is owed on the card now, including charges not due yet' : "this month's bills charged to the card";
    } else {
      const recent = staging.filter(x => x.accountId === id && isCardPayment(x) && x.date > calAddDays_(t0, -92)).map(x => -Number(x.amount));
      const avg = recent.length ? calRound_(recent.reduce((s2, v) => s2 + v, 0) / recent.length) : null;
      est = avg === null ? (owed === null ? (bills || null) : Math.max(owed, bills)) : Math.max(avg, bills);
      basis = avg === null ? 'what is owed on the card now' : 'the average of the card payments in the last 3 months';
    }
    items.push(calItem_({
      key: id + '|' + calYmd_(d), date: d, kind: 'card', name: calCardName_(a) + ' payment',
      chip: /card/i.test(String(a.name || id).split(/\s+/)[0]) ? calCardName_(a) : String(a.name || id).split(/\s+/)[0] + ' card',
      amount: pays.length ? paid : est, estimate: !pays.length, estimateBasis: basis,
      paidAmount: pays.length ? paid : null, share: 0, matched: [], onCard: false, account: '',
      extra: pays.length ? pays.map(x => fd(x.date) + ' payment ' + fm(-Number(x.amount))).join('; ') : '',
    }, t0, checks));
  });

  /* -- Debts with a minimum payment that no Recurring Payments row covers -- */
  (src.debts || []).forEach(dbt => {
    const min = calNum_(dbt.minPayment), day = calNum_(dbt.dueDay);
    if (!dbt.id || !min || min <= 0 || !day) return;
    if (dbt.linkedAccount && cardDue[dbt.linkedAccount]) return; // shown as a card payment instead
    const bal = calNum_(dbt.latestBalance);
    if (bal !== null && bal <= 0) return;
    // Covered by a Recurring Payments row: the same due day and amount, or a row that names this debt.
    const idRe = new RegExp('\\b' + String(dbt.id).replace(/[^A-Za-z0-9-]/g, '') + '\\b');
    const covered = recur.some(r => (calNum_(r.dueDay) === day && calNum_(r.amount) !== null && Math.abs(calNum_(r.amount) - min) < 1) ||
      idRe.test(String(r.name || '') + ' ' + String(r.notes || '')));
    if (covered) return;
    const d = calDayIn_(y, m, day);
    // A payment to this debt since the previous due date counts (cards are often paid early), up to 3 days
    // late. The previous month's 3 late days are left to that month, so one payment never pays two months.
    const prev = calDayIn_(y, m - 1, day);
    const matched = payTx.filter(p => !p.used && p.t.debtId === dbt.id && p.t.type === 'Debt Payment' && p.t.date > calAddDays_(prev, 3) && p.t.date <= calAddDays_(d, 3));
    matched.forEach(p => { p.used = true; });
    const paid = calRound_(matched.reduce((s, p) => s + (Number(p.t.amount) || 0), 0));
    items.push(calItem_({
      key: dbt.id + '|' + calYmd_(d), date: d, kind: 'debt', name: String(dbt.name || dbt.id) + ' (minimum)', amount: min,
      estimate: false, paidAmount: matched.length ? paid : null, matched: matched.map(p => p.t), onCard: false,
      account: '', share: 0.9,
    }, t0, checks));
  });

  /* -- Utility bills -- */
  const util = (src.util || []).filter(u => u.id && calIsDate_(u.dueDate));
  const byUtil = {};
  util.forEach(u => { const k = u.utility || u.provider || 'Utility'; (byUtil[k] = byUtil[k] || []).push(u); });
  Object.keys(byUtil).forEach(k => {
    const bills = byUtil[k].sort((a, b) => a.dueDate - b.dueDate);
    const inMonth = bills.filter(u => u.dueDate >= first && u.dueDate <= last);
    inMonth.forEach(u => {
      const amt = calNum_(u.amount);
      const paidHere = u.status === 'Paid' || calIsDate_(u.paidDate);
      items.push(calItem_({
        key: u.id, date: calDay_(u.dueDate), kind: 'utility', name: k + (u.provider ? ' (' + u.provider + ')' : ''), amount: amt,
        estimate: false, paidAmount: paidHere ? amt : null, matched: [], paidOn: calIsDate_(u.paidDate) ? u.paidDate : null,
        utilityPaid: paidHere, onCard: false, account: '', share: 0,
      }, t0, checks));
    });
    // No bill yet for this month: estimate it, but only for months after the newest bill, and only for
    // a utility that is still billing (a bill due in the last 3 months).
    const newest = bills[bills.length - 1];
    if (inMonth.length || newest.dueDate >= first) return;
    if (newest.dueDate < calAddDays_(t0, -92)) return;
    const lastYear = bills.filter(u => u.dueDate.getFullYear() === y - 1 && u.dueDate.getMonth() === m && calNum_(u.amount) !== null);
    const last12 = bills.slice(-12).map(u => calNum_(u.amount)).filter(a => a !== null);
    const est = lastYear.length ? calNum_(lastYear[lastYear.length - 1].amount) : (last12.length ? calRound_(last12.reduce((s, a) => s + a, 0) / last12.length) : null);
    const d = calDayIn_(y, m, newest.dueDate.getDate());
    items.push(calItem_({
      key: 'UTIL:' + k + '|' + calYmd_(d), date: d, kind: 'utility', name: k + (newest.provider ? ' (' + newest.provider + ')' : ''),
      amount: est, estimate: true, estimateBasis: lastYear.length ? 'same month last year' : 'average of the last ' + last12.length + ' bills',
      paidAmount: null, matched: [], onCard: false, account: '', share: 0,
    }, t0, checks));
  });

  /* -- Paychecks -- */
  const income = (src.income || []).filter(i => i.id && calIsDate_(i.payDate)).map(i => ({ i, used: false }));
  (src.expect || []).filter(e => e.id && e.active === true).forEach(e => {
    const freq = e.frequency;
    // Count from the paycheck that fits the pay cycle best, so a bonus or a late deposit for the same
    // employer does not shift the schedule: of the last 6 paychecks, the one that the most others are a
    // whole number of cycles away from (weekly, biweekly), or that is on the most common day of the
    // month (monthly); on a tie, the newest.
    const mine = income.filter(x => x.i.person === e.person && x.i.employer === e.employer).map(x => calDay_(x.i.payDate)).sort((a, b) => b - a).slice(0, 6);
    let anchor = calIsDate_(e.lastPayDate) ? e.lastPayDate : null;
    if (mine.length) anchor = calPayAnchor_(mine, freq) || anchor;
    let dates = [];
    if (freq === 'Weekly' || freq === 'Biweekly') {
      if (!anchor) { notShown.push((e.person ? e.person + ' · ' : '') + (e.employer || e.id) + ': no paycheck on Income yet to count paydays from'); return; }
      dates = calStepDates_(anchor, freq === 'Weekly' ? 7 : 14, calAddDays_(first, -CAL_PAY_WINDOW), calAddDays_(last, CAL_PAY_WINDOW));
    } else if (freq === 'Semimonthly') {
      dates = [new Date(y, m, 15), new Date(y, m + 1, 0)];
    } else if (freq === 'Monthly') {
      if (!anchor) { notShown.push((e.person ? e.person + ' · ' : '') + (e.employer || e.id) + ': no paycheck on Income yet to count paydays from'); return; }
      dates = [calDayIn_(y, m, anchor.getDate())];
    } else return;
    const typical = calNum_(e.typicalTakeHome);
    dates.forEach(d => {
      const hit = income.filter(x => !x.used && x.i.person === e.person && x.i.employer === e.employer && Math.abs(calDaysBetween_(x.i.payDate, d)) <= CAL_INCOME_WINDOW)
        .sort((a, b) => Math.abs(calDaysBetween_(a.i.payDate, d)) - Math.abs(calDaysBetween_(b.i.payDate, d)))[0];
      if (hit) hit.used = true;
      const shown = hit ? calDay_(hit.i.payDate) : d;
      if (shown < first || shown > last) return; // the padding days only catch a payday that moved
      const take = hit ? calNum_(hit.i.takeHome) : null;
      items.push(calItem_({
        key: e.id + '|' + calYmd_(d), date: shown, kind: 'pay', name: (e.person ? e.person + ' · ' : '') + (e.employer || 'Paycheck'), chip: e.employer || e.person || 'Paycheck',
        amount: take !== null ? take : typical, estimate: !hit, received: !!hit, matched: [], onCard: false, account: '',
      }, t0, checks));
    });
  });
  // Other pay on Income this month (a bonus, a one-off) that is not one of the expected paydays.
  income.filter(x => !x.used && x.i.payDate >= first && x.i.payDate <= last).forEach(x => {
    items.push(calItem_({
      key: x.i.id, date: calDay_(x.i.payDate), kind: 'pay', name: (x.i.person ? x.i.person + ' · ' : '') + (x.i.employer || 'Income'), chip: x.i.employer || x.i.person || 'Income',
      amount: calNum_(x.i.takeHome), estimate: false, received: true, matched: [], onCard: false, account: '',
    }, t0, checks));
  });

  items.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.kind === 'pay' ? -1 : b.kind === 'pay' ? 1 : a.name.localeCompare(b.name)));

  const sum = (f) => calRound_(items.filter(f).reduce((s, it) => s + (it.amount || 0), 0));
  const isBill = (it) => it.kind !== 'pay' && it.inTotals !== false;
  const settled = (it) => it.status === 'paid' || it.status === 'checked' || it.status === 'received';
  const totals = {
    comingIn: sum(it => it.kind === 'pay'),
    stillComingIn: sum(it => it.kind === 'pay' && !settled(it) && it.status !== 'past'),
    bills: sum(isBill),
    billsOnCards: sum(it => isBill(it) && it.onCard),
    inCardPayments: sum(it => it.kind !== 'pay' && it.inTotals === false),
    stillToPay: calRound_(items.filter(it => isBill(it) && !settled(it) && it.status !== 'past').reduce((s, it) => s + Math.max(0, (it.amount || 0) - (it.status === 'partial' ? (it.paidAmount || 0) : 0)), 0)),
    lateCount: items.filter(it => isBill(it) && it.status === 'late').length,
    lateAmount: sum(it => isBill(it) && it.status === 'late'),
    estimates: items.some(it => it.estimate),
  };
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return { year: y, month: m + 1, label: months[m] + ' ' + y, today: calYmd_(t0), firstWeekday: first.getDay(), daysInMonth: last.getDate(), items, totals, notShown };
}

/** A card's name without its ····1234 ending, as the calendar names its payment. Pure. */
function calCardName_(a) { return String((a && (a.name || a.id)) || 'Card').replace(/\s*·.*$/, ''); }

/** The paycheck date (newest first in `dates`) that the pay cycle is best counted from. Pure. */
function calPayAnchor_(dates, freq) {
  if (!dates.length) return null;
  if (freq === 'Weekly' || freq === 'Biweekly') {
    const step = freq === 'Weekly' ? 7 : 14;
    let best = null, bestFit = -1;
    dates.forEach(a => {
      const fit = dates.filter(d => ((calDaysBetween_(a, d) % step) + step) % step === 0).length;
      if (fit > bestFit) { best = a; bestFit = fit; }
    });
    return best;
  }
  if (freq === 'Monthly') {
    const cnt = {};
    dates.forEach(d => { cnt[d.getDate()] = (cnt[d.getDate()] || 0) + 1; });
    let best = null;
    dates.forEach(d => { if (!best || cnt[d.getDate()] > cnt[best.getDate()]) best = d; });
    return best;
  }
  return dates[0];
}

/** Sets an item's status and the line of detail the pop-up shows. Pure. */
function calItem_(o, t0, checks) {
  const fmt = (x) => '$' + Number(x || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fd = (d) => (d.getMonth() + 1) + '/' + d.getDate();
  const checked = Object.prototype.hasOwnProperty.call(checks, o.key);
  let status, statusText;
  const past = o.date < t0;
  // More than a month back, a missing payment is history (often from before the tracker started), not
  // something still owed: it is shown, but left out of what is still to pay or still to come in.
  const old = o.date < new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() - 31);
  if (o.kind === 'pay') {
    if (o.received) { status = 'received'; statusText = 'Received'; }
    else if (checked) { status = 'checked'; statusText = 'Received (ticked; not in the tracker yet)'; }
    else if (old) { status = 'past'; statusText = 'No paycheck on Income'; }
    else if (past) { status = 'late'; statusText = 'Not on Income yet'; }
    else { status = 'expected'; statusText = 'Expected'; }
  } else {
    const full = o.paidAmount !== null && (!o.share || o.amount === null || o.paidAmount >= o.amount * o.share - 0.005);
    if (o.utilityPaid || full) { status = 'paid'; statusText = o.kind === 'card' && o.paidAmount !== null ? 'Paid ' + fmt(o.paidAmount) : 'Paid'; }
    else if (checked) { status = 'checked'; statusText = 'Paid (ticked; not in the tracker yet)'; }
    else if (o.paidAmount !== null && o.paidAmount > 0) { status = 'partial'; statusText = fmt(o.paidAmount) + ' paid so far'; }
    else if (old) { status = 'past'; statusText = 'No payment found in the tracker'; }
    else if (past) { status = 'late'; statusText = 'Not seen in the tracker yet'; }
    else { status = 'due'; statusText = 'Due'; }
  }
  const bits = [];
  if (o.estimate && o.kind === 'pay') bits.push('typical take-home');
  if (o.estimate && o.kind !== 'pay') bits.push('estimate: ' + (o.estimateBasis || 'no bill yet'));
  if (o.extra) bits.push(o.extra);
  if (o.inTotals === false) bits.push('counted once, in the ' + (o.cardName || o.account) + ' payment');
  if (o.matched && o.matched.length) bits.push(o.matched.map(t => fd(t.date) + ' ' + String(t.description || '').slice(0, 40) + ' ' + fmt(t.amount)).join('; '));
  if (o.paidOn) bits.push('paid ' + fd(o.paidOn));
  if (o.account) bits.push((o.onCard ? 'charged to ' : 'from ') + o.account);
  if (o.autoPay) bits.push('auto-pay');
  return {
    key: o.key, date: calYmd_(o.date), kind: o.kind, name: o.name, chip: o.chip || String(o.name).replace(/\s*\(.*\)\s*$/, '') || o.name, amount: o.amount === null || o.amount === undefined ? null : calRound_(o.amount),
    estimate: !!o.estimate, onCard: !!o.onCard, paidAmount: o.paidAmount === null || o.paidAmount === undefined ? null : o.paidAmount,
    checked, status, statusText, detail: bits.join(' · '), inTotals: o.inTotals !== false,
    canCheck: status !== 'paid' && status !== 'received',
  };
}
