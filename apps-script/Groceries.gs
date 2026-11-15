/**
 * Household Finance Tracker — Groceries.gs
 * The Groceries tab (the owner, 2026-11-15) and the two jobs that keep its receipt data honest.
 *
 * Data: Grocery Items (TABLES.GROC) holds one row per receipt line. Costco is the only store whose
 * receipts carry items. Lines arrive two ways, both written by Claude: from Costco's purchase export
 * (Source "Costco export") or from a photo of a paper receipt (Source "Receipt photo"). Grocery
 * Item Names (TABLES.GROCNAMES) gives each item number a readable name and a category.
 *
 *  - reconcileGroceryTrips_: a trip that came in both ways is counted once. Trips are matched on
 *    location, day and item subtotal; the export copy is kept (it has the item numbers and coupons
 *    exactly as Costco recorded them) and the photo copy is soft-deleted. Two copies from the same
 *    source keep the first.
 *  - splitGroceryCharges_: each trip's card charge (a Transactions row whose description mentions
 *    Costco, dated the trip day or up to five days later, for the subtotal plus at most the sales
 *    tax) is split by the receipt into Groceries, Household Supplies, Child Supplies, Fuel and so on.
 *    The sales tax goes to the taxed parts: alcohol and non-food. A trip whose lines are all
 *    one subcategory just sets that charge's category instead of splitting it.
 *
 * The tab: a Month to look at (B3); tiles for that month; grocery spending by store for the last
 * 12 months (from Transactions, Food → Groceries); what was bought that month, item by item; the top
 * items over the last 12 months with their price then and now; and every receipt. Receipts from
 * other stores (Meijer, Target) work the same way when a photo is sent: their item numbers are
 * kept as STORE-number on Grocery Item Names, so they never clash with Costco's, and one readable
 * name (Blueberries) adds up across stores.
 */

const GROC = {
  MONTH_CELL: 'B3',
  TILE_LABEL: 5, TILE_VALUE: 6, TILE_SUB: 7,
  STORE_BAR: 9, STORE_NOTE: 10, STORE_HEADER: 11, STORE_FIRST: 12, STORE_MONTHS: 12, STORE_COLS: 4,
  ITEM_BAR: 25, ITEM_NOTE: 26, ITEM_HEADER: 27, ITEM_FIRST: 28, ITEM_ROWS: 90,
  TOP_BAR: 120, TOP_NOTE: 121, TOP_HEADER: 122, TOP_FIRST: 123, TOP_ROWS: 30,
  TRIP_BAR: 155, TRIP_NOTE: 156, TRIP_HEADER: 157, TRIP_FIRST: 158, TRIP_ROWS: 150,
  LAST_ROW: 310, WIDTH: 9,
  // the two graphs to the right of the tables (the owner, 2026-11-15): a bar for each month and a line for the
  // 3-month average. Costco food (Food → Groceries and Alcohol lines on Costco receipts) for 24 months beside the store table;
  // groceries at every store (Transactions) for 12 months beside "What you bought". The numbers behind them sit
  // under the graphs, in columns K to M.
  GRAPH_COL: 11, GRAPH1_ROW: 9, GRAPH2_ROW: 27, COSTCO_MONTHS: 24, GROC_MONTHS: 12,
  GDATA1_BAR: 60, GDATA1_HEADER: 61, GDATA2_BAR: 88, GDATA2_HEADER: 89, GRAPH_WIDTH: 3,
  BAR_COLOR: '#1F6F78', LINE_COLOR: '#C2551F',
  CHARGE_DAYS: 5,      // a card charge posts on the trip day or up to this many days later
  MAX_TAX: 0.07,       // the charge is the subtotal plus at most this share in sales tax (Michigan: 6%)
  EXPORT: 'Costco export', PHOTO: 'Receipt photo',
  MARK: 'Costco receipt',
};

/* ---------- pure helpers (tested in Node) ---------- */

function grocRound_(x) { return Math.round(Number(x || 0) * 100) / 100; }

function grocDayKey_(d) {
  if (!(d instanceof Date)) return String(d || '').slice(0, 10);
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}

/**
 * Groups receipt lines into trips. Pure. Lines marked deleted are left out.
 * Returns [{ tripId, date, day, store, location, source, subtotal, saved, rows: [line], txId, firstRow }]
 * in the order the trips first appear.
 */
function groceryTrips_(lines) {
  const byId = {};
  const order = [];
  (lines || []).forEach(l => {
    if (l.isDeleted === true || !l.tripId) return;
    let t = byId[l.tripId];
    if (!t) {
      t = byId[l.tripId] = { tripId: l.tripId, date: l.date, day: grocDayKey_(l.date), store: l.store, location: l.location, source: l.source,
        subtotal: 0, saved: 0, rows: [], txId: '', firstRow: l.__row || 0 };
      order.push(t);
    }
    t.subtotal += Number(l.net || 0);
    t.saved -= Number(l.discount || 0);
    t.rows.push(l);
    if (l.txId && !t.txId) t.txId = String(l.txId);
  });
  order.forEach(t => { t.subtotal = grocRound_(t.subtotal); t.saved = grocRound_(t.saved); });
  return order;
}

/** The key two copies of one trip share: location, day and item subtotal. */
function groceryTripKey_(t) {
  return String(t.location || '').trim().toUpperCase() + '|' + t.day + '|' + grocRound_(t.subtotal).toFixed(2);
}

/**
 * Which trips are second copies of another. Pure. For each key, the copy kept is the first export
 * copy if there is one, otherwise the first copy; every other copy is returned with { keep } set to
 * the trip it duplicates.
 */
function groceryDuplicateTrips_(trips) {
  const groups = {};
  (trips || []).forEach(t => { const k = groceryTripKey_(t); (groups[k] = groups[k] || []).push(t); });
  const out = [];
  Object.keys(groups).forEach(k => {
    const g = groups[k];
    if (g.length < 2) return;
    const keep = g.filter(t => t.source === GROC.EXPORT)[0] || g[0];
    g.forEach(t => { if (t !== keep) out.push({ trip: t, keep }); });
  });
  return out;
}

/**
 * The card charge a trip was paid with, among Transactions rows. Pure.
 *   trip   from groceryTrips_
 *   txRows Transactions rows
 *   taken  { txId: true } for charges already matched to another trip
 * A candidate is a live Expense, not part of a split, whose description mentions the store, dated the
 * trip day or up to GROC.CHARGE_DAYS later, for at least the subtotal and at most the subtotal plus
 * GROC.MAX_TAX of it (plus a cent). The closest in date wins, then the closest in amount.
 */
function findGroceryCharge_(trip, txRows, taken) {
  if (!trip || !(trip.subtotal > 0)) return null;
  const day = trip.date instanceof Date ? new Date(trip.date.getFullYear(), trip.date.getMonth(), trip.date.getDate()) : null;
  if (!day) return null;
  const store = String(trip.store || 'Costco').toLowerCase();
  const lo = trip.subtotal - 0.01, hi = trip.subtotal * (1 + GROC.MAX_TAX) + 0.01;
  let best = null, bestScore = Infinity;
  (txRows || []).forEach(t => {
    if (t.isDeleted === true || t.type !== 'Expense' || t.splitRole || t.parentTxId) return;
    if ((taken || {})[t.id]) return;
    if (String(t.description || '').toLowerCase().indexOf(store) < 0) return;
    if (!(t.date instanceof Date)) return;
    const d = new Date(t.date.getFullYear(), t.date.getMonth(), t.date.getDate());
    const days = Math.round((d - day) / 86400000);
    if (days < 0 || days > GROC.CHARGE_DAYS) return;
    const amt = Number(t.amount || 0);
    if (amt < lo || amt > hi) return;
    const score = days * 1000 + Math.abs(amt - trip.subtotal);
    if (score < bestScore) { bestScore = score; best = t; }
  });
  return best;
}

/**
 * How a trip's charge splits by the receipt. Pure.
 *   trip    from groceryTrips_, its lines carrying category and subcategory
 *   charge  the card charge amount
 * Returns [{ category, subcategory, amount }], largest first, summing exactly to the charge. What
 * the charge holds over the item subtotal is sales tax: it goes to the taxed parts (everything but
 * Food → Groceries, so alcohol and non-food) in proportion to their size, or to the largest part
 * when every part is groceries.
 */
function groceryChargeSplit_(trip, charge) {
  const parts = {};
  trip.rows.forEach(l => {
    const cat = l.category || 'Food', sub = l.subcategory || 'Groceries';
    const k = cat + '|' + sub;
    parts[k] = parts[k] || { category: cat, subcategory: sub, amount: 0 };
    parts[k].amount += Number(l.net || 0);
  });
  let list = Object.keys(parts).map(k => parts[k]).filter(p => Math.abs(p.amount) >= 0.005);
  list.forEach(p => { p.amount = grocRound_(p.amount); });
  list.sort((a, b) => b.amount - a.amount);
  if (!list.length) return [];
  const tax = grocRound_(Number(charge) - list.reduce((s, p) => s + p.amount, 0));
  const taxed = list.filter(p => !(p.category === 'Food' && p.subcategory === 'Groceries') && p.amount > 0); // alcohol and non-food are taxed; groceries are not
  if (tax !== 0) {
    if (taxed.length) {
      const base = taxed.reduce((s, p) => s + p.amount, 0);
      taxed.forEach(p => { p.amount = grocRound_(p.amount + tax * p.amount / base); });
    } else {
      list[0].amount = grocRound_(list[0].amount + tax);
    }
  }
  const diff = grocRound_(Number(charge) - list.reduce((s, p) => s + p.amount, 0));
  if (diff !== 0) list[0].amount = grocRound_(list[0].amount + diff);
  return list;
}

/* ---------- jobs on the Sheet (run with every sync and the upgrade) ---------- */

/** Soft-deletes the second copy of any trip. Returns { removed, details: [text] }. */
function reconcileGroceryTrips_() {
  const out = { removed: 0, details: [] };
  const def = tdef_('GROC');
  const sh = ss_().getSheetByName(def.sheet);
  if (!sh) return out;
  const lines = readTable_(def);
  const dups = groceryDuplicateTrips_(groceryTrips_(lines));
  if (!dups.length) return out;
  const now = new Date();
  const cDel = colIndex_(def, 'isDeleted'), cAt = colIndex_(def, 'deletedAt'), cNotes = colIndex_(def, 'notes'), cTx = colIndex_(def, 'txId');
  dups.forEach(d => {
    const why = 'Duplicate of trip ' + d.keep.tripId + ' (same store, day and total' + (d.keep.source === GROC.EXPORT && d.trip.source !== GROC.EXPORT ? '; the export copy is kept' : '') + ')';
    d.trip.rows.forEach(l => {
      sh.getRange(l.__row, cDel).setValue(true);
      sh.getRange(l.__row, cAt).setValue(now);
      sh.getRange(l.__row, cNotes).setValue(l.notes ? String(l.notes) + ' · ' + why : why);
    });
    // a charge already split by the removed copy stays linked through the kept one, so it is not split twice
    if (d.trip.txId && !d.keep.txId) {
      d.keep.rows.forEach(l => sh.getRange(l.__row, cTx).setValue(d.trip.txId));
      d.keep.txId = d.trip.txId;
    }
    out.removed++;
    out.details.push(d.trip.tripId + ' (' + d.trip.source + ') duplicates ' + d.keep.tripId);
  });
  return out;
}

/**
 * Matches each trip without a Bank Charge to its card charge and splits the charge by the receipt.
 * Returns { split, categorized, details: [text] }.
 */
function splitGroceryCharges_() {
  const out = { split: 0, categorized: 0, details: [] };
  const gDef = tdef_('GROC'), txDef = tdef_('TX');
  const ss = ss_();
  if (!ss.getSheetByName(gDef.sheet) || !ss.getSheetByName(txDef.sheet)) return out;
  const lines = readTable_(gDef);
  const trips = groceryTrips_(lines).filter(t => !t.txId && t.subtotal > 0);
  if (!trips.length) return out;
  const gSh = ss.getSheetByName(gDef.sheet), txSh = ss.getSheetByName(txDef.sheet);
  const tx = readTable_(txDef);
  const taken = {};
  lines.forEach(l => { if (l.txId) taken[String(l.txId)] = true; });
  const col = (k) => colIndex_(txDef, k);
  const log = changeLogEnabled_();
  const now = new Date();
  trips.forEach(trip => {
    const charge = findGroceryCharge_(trip, tx, taken);
    if (!charge) return;
    taken[charge.id] = true;
    const parts = groceryChargeSplit_(trip, Number(charge.amount));
    if (!parts.length) return;
    const mark = GROC.MARK + ' ' + trip.tripId;
    if (parts.length === 1) {
      const p = parts[0];
      let dflt = { needWant: '', spendingType: 'Flexible' };
      try { dflt = taxonomyDefaults_(p.category, p.subcategory); } catch (e) { /* the validation flag shows an unknown pair */ }
      txSh.getRange(charge.__row, col('category')).setValue(p.category);
      txSh.getRange(charge.__row, col('subcategory')).setValue(p.subcategory);
      if (!charge.needWant && dflt.needWant) txSh.getRange(charge.__row, col('needWant')).setValue(dflt.needWant);
      if (!charge.spendingType) txSh.getRange(charge.__row, col('spendingType')).setValue(dflt.spendingType || 'Flexible');
      txSh.getRange(charge.__row, col('receiptRef')).setValue(trip.tripId);
      txSh.getRange(charge.__row, col('updatedAt')).setValue(now);
      out.categorized++;
      out.details.push(charge.id + ' (' + trip.day + ') set to ' + p.subcategory + ' from the receipt');
    } else {
      syncLastRow_(txDef);
      let nextNum = parseInt(nextId_(txDef, 6).split('-')[1], 10);
      const children = parts.map(p => {
        let dflt = { needWant: '', fixedVariable: '', spendingType: 'Flexible' };
        try { dflt = taxonomyDefaults_(p.category, p.subcategory); } catch (e) { /* the validation flag shows an unknown pair */ }
        return {
          id: 'TX-' + String(nextNum++).padStart(6, '0'),
          date: charge.date, description: String(charge.description) + ' — ' + p.subcategory, amount: p.amount, type: 'Expense',
          category: p.category, subcategory: p.subcategory, accountId: charge.accountId, person: charge.person, hhPersonal: charge.hhPersonal,
          needWant: dflt.needWant, fixedVariable: dflt.fixedVariable, status: charge.status || 'Posted',
          notes: 'Split child of ' + charge.id + ' · ' + mark, createdAt: now, createdBy: 'receipt-split',
          spendingType: dflt.spendingType || 'Flexible', fundingSource: charge.fundingSource || 'Monthly Cash Flow',
          splitRole: 'Child', parentTxId: charge.id, receiptRef: trip.tripId,
        };
      });
      writeRows_(txDef, children);
      txSh.getRange(charge.__row, col('type')).setValue('Split Parent');
      txSh.getRange(charge.__row, col('splitRole')).setValue('Parent');
      txSh.getRange(charge.__row, col('receiptRef')).setValue(trip.tripId);
      txSh.getRange(charge.__row, col('updatedAt')).setValue(now);
      if (log) appendChangeLog_({ table: 'TX', recordId: charge.id, field: 'Type', oldValue: charge.type, newValue: 'Split Parent', action: 'Split', user: 'receipt-split', notes: mark + ': ' + children.map(c => c.id + ' ' + c.subcategory + ' ' + c.amount.toFixed(2)).join(', ') });
      out.split++;
      out.details.push(charge.id + ' (' + trip.day + ', ' + Number(charge.amount).toFixed(2) + ') split into ' + parts.map(p => p.subcategory + ' ' + p.amount.toFixed(2)).join(', '));
    }
    trip.rows.forEach(l => gSh.getRange(l.__row, colIndex_(gDef, 'txId')).setValue(charge.id));
  });
  return out;
}

function describeGroceries_(r) {
  if (!r) return '';
  const bits = [];
  if (r.removed) bits.push(r.removed + ' duplicate trip(s) set aside');
  if (r.split) bits.push(r.split + ' Costco charge(s) split by receipt');
  if (r.categorized) bits.push(r.categorized + ' Costco charge(s) categorized from the receipt');
  return bits.join(', ');
}

/** Both jobs, in order: duplicates first so a trip is never split twice. */
function refreshGroceries_() {
  const a = reconcileGroceryTrips_();
  const b = splitGroceryCharges_();
  return { removed: a.removed, split: b.split, categorized: b.categorized, details: a.details.concat(b.details) };
}

/* ---------- the Groceries tab ---------- */

function buildGroceries_() {
  const sh = getOrCreateSheet_(SHEETS.GROCERY);
  const F = (t) => resolveFormula_(t, null, null);
  const W = GROC.WIDTH;
  sh.getCharts().forEach(c => sh.removeChart(c));
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: the Groceries tab is calculated (formulas only; its one input, Month, is put back by the upgrade); rebuilt by buildWorkbook / upgradeWorkbook
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  ensureSheetSize_(sh, GROC.LAST_ROW, GROC.GRAPH_COL + GROC.GRAPH_WIDTH - 1);
  sh.setHiddenGridlines(true);
  [190, 130, 110, 110, 110, 110, 105, 105, 110, 24, 90, 110, 120].forEach((w, i) => sh.setColumnWidth(i + 1, w)); // J is a narrow gap before the graphs
  sh.getRange(1, 1, GROC.LAST_ROW, W).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');
  const L = (c) => colLetter_(c);
  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const note = (row, text) => { mergePut('A' + row + ':' + L(W) + row, text).setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9).setWrap(true); sh.setRowHeight(row, 30); };
  const header = (row, heads) => heads.forEach((h, i) => styleHeader_(put(L(i + 1) + row, h)));
  const SEL = '$B$3';

  // Transactions: grocery spending (Food → Groceries, expenses minus refunds, deleted rows and split parents left out) and the store of each row
  // groceries are Food → Groceries and Food → Alcohol (the owner, 2026-11-15: "I only drink when I eat"); alcohol is shown on its own too
  const gTx = '([TX.category]="Food")*(([TX.subcategory]="Groceries")+([TX.subcategory]="Alcohol"))*([TX.isDeleted]<>TRUE)*(([TX.type]="Expense")-([TX.type]="Refund"))';
  const aTx = '([TX.category]="Food")*([TX.subcategory]="Alcohol")*([TX.isDeleted]<>TRUE)*(([TX.type]="Expense")-([TX.type]="Refund"))';
  const storeOf = 'IF(REGEXMATCH([TX.description]&"","(?i)costco"),"Costco",TRIM(REGEXREPLACE([TX.description]&""," — .*$","")))';
  const txMonth = (m) => '([TX.date]>=' + m + ')*([TX.date]<EDATE(' + m + ',1))';
  // Grocery Items: live lines, numbers made safe
  const live = '([GROC.id]<>"")*([GROC.isDeleted]<>TRUE)';
  const net = 'IF(ISNUMBER([GROC.net]),[GROC.net],0)';
  const qty = 'IF(ISNUMBER([GROC.qty]),[GROC.qty],0)';

  /* --- title, Month --- */
  mergePut('A1:' + L(W) + '1', 'Groceries').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  mergePut('A2:' + L(W) + '2', 'What groceries cost, store by store, and what you buy at Costco item by item. Store totals come from Transactions (Food → Groceries and Alcohol: alcohol counts as groceries, and has its own column). The item detail comes from Costco receipts (the Grocery Items tab), which Claude adds from Costco\'s purchase export or a photo of a receipt; each Costco charge is split by its receipt, so only the food counts as groceries.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9).setWrap(true);
  sh.setRowHeight(2, 42);
  put('A3', 'Month').setFontWeight('bold');
  put(GROC.MONTH_CELL, monthStart_(todayMidnight_())).setNumberFormat('mmmm yyyy').setBackground(COLORS.INPUT).setFontWeight('bold')
    .setBorder(true, true, true, true, false, false, COLORS.NAVY, SpreadsheetApp.BorderStyle.SOLID)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).setHelpText('Type any date in the month to look at, for example 10/1/2026.').build());
  mergePut('C3:' + L(W) + '3', 'the tiles and "What you bought" follow this month; type any date in the month you want').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  setNamedRange_('GROC_MONTH', sh.getRange(GROC.MONTH_CELL));
  const M = 'DATE(YEAR(' + SEL + '),MONTH(' + SEL + '),1)';

  /* --- tiles --- */
  const grocIn = (m) => 'SUMPRODUCT(' + gTx + '*' + txMonth(m) + ',IF(ISNUMBER([TX.amount]),[TX.amount],0))';
  const costcoIn = (m) => 'SUMPRODUCT(' + gTx + '*' + txMonth(m) + '*(' + storeOf + '="Costco"),IF(ISNUMBER([TX.amount]),[TX.amount],0))';
  const tiles = [
    { cols: ['A', 'B'], label: 'Groceries, all stores', fmt: '$#,##0.00',
      f: F('=ARRAYFORMULA(' + grocIn(M) + ')'),
      sub: F('=ARRAYFORMULA(LET(t,' + grocIn(M) + ',c,' + costcoIn(M) + ',a,SUMPRODUCT(' + aTx + '*' + txMonth(M) + ',IF(ISNUMBER([TX.amount]),[TX.amount],0)),IF(t=0,"no grocery spending recorded","Costco "&TEXT(c,"$#,##0")&" · other stores "&TEXT(t-c,"$#,##0")&IF(a<>0," · alcohol "&TEXT(a,"$#,##0")&" of it",""))))') },
    { cols: ['C', 'D'], label: 'Costco share of groceries', fmt: '0%',
      f: F('=ARRAYFORMULA(LET(t,' + grocIn(M) + ',c,' + costcoIn(M) + ',IF(t=0,"—",c/t)))'),
      sub: 'the food part of Costco charges, out of all grocery spending' },
    { cols: ['E', 'F'], label: 'Receipts', fmt: '0',
      f: F('=ARRAYFORMULA(IFERROR(ROWS(UNIQUE(FILTER([GROC.tripId],' + live + '*([GROC.month]=' + M + ')))),0))'),
      // how many receipts from each store (the owner, 2026-11-15: "5" alone read as five Costco trips), then the total
      sub: F('=ARRAYFORMULA(LET(g,' + live + '*([GROC.month]=' + M + '),s,SUMPRODUCT(g,' + net + '),' +
        'by,IFERROR(TEXTJOIN(" · ",TRUE,MAP(UNIQUE(FILTER([GROC.store],g<>0,[GROC.store]<>"")),LAMBDA(st,ROWS(UNIQUE(FILTER([GROC.tripId],g<>0,[GROC.store]=st)))&" "&st))),""),' +
        'IF(s=0,"no receipts this month",by&" · "&TEXT(s,"$#,##0.00")&" on the receipts")))') },
    { cols: ['G', 'I'], label: 'Typical grocery month', fmt: '$#,##0.00',
      f: F('=ARRAYFORMULA(LET(mstart,DATE(YEAR(TODAY()),MONTH(TODAY()),1),v,MAP({1;2;3},LAMBDA(k,' + grocIn('EDATE(mstart,-k)') + ')),n,SUM(--(v>0)),IF(n=0,"—",SUM(v)/n)))'),
      sub: 'the last 3 full months with grocery spending, averaged' },
  ];
  tiles.forEach(t => {
    mergePut(t.cols[0] + GROC.TILE_LABEL + ':' + t.cols[1] + GROC.TILE_LABEL, t.label).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(t.cols[0] + GROC.TILE_VALUE + ':' + t.cols[1] + GROC.TILE_VALUE, t.f).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat(t.fmt);
    mergePut(t.cols[0] + GROC.TILE_SUB + ':' + t.cols[1] + GROC.TILE_SUB, t.sub).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center').setWrap(true);
    sh.getRange(t.cols[0] + GROC.TILE_LABEL + ':' + t.cols[1] + GROC.TILE_SUB).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(GROC.TILE_VALUE, 40); sh.setRowHeight(GROC.TILE_SUB, 30);

  /* --- grocery spending by store, last 12 months --- */
  styleSectionBar_(sh.getRange('A' + GROC.STORE_BAR + ':' + L(W) + GROC.STORE_BAR), 'Grocery spending by store — the last 12 months');
  note(GROC.STORE_NOTE, 'From Transactions, Food → Groceries and Food → Alcohol (alcohol counts as groceries; the Alcohol column shows how much of the Total it was). Costco counts only the food part of each trip once its charge is split by the receipt. The four stores you spent most at in the last 12 months get a column (Costco first); the rest are under Other. Months before the bank feed started are blank.');
  const hdr = GROC.STORE_HEADER;
  styleHeader_(put('A' + hdr, 'Month'));
  const start12 = 'EDATE(DATE(YEAR(TODAY()),MONTH(TODAY()),1),-' + (GROC.STORE_MONTHS - 1) + ')';
  // the store columns: one spilled row of up to four names
  put('B' + hdr, F('=ARRAYFORMULA(IFERROR(LET(s,' + storeOf + ',g,' + gTx + '*([TX.date]>=' + start12 + '),u,UNIQUE(FILTER(s,g<>0,s<>"")),tot,MAP(u,LAMBDA(x,SUMPRODUCT(g*(s=x),IF(ISNUMBER([TX.amount]),[TX.amount],0)))),TRANSPOSE(ARRAY_CONSTRAIN(SORT(u,u<>"Costco",TRUE,tot,FALSE),' + GROC.STORE_COLS + ',1))),""))'));
  styleHeader_(sh.getRange(hdr, 2, 1, GROC.STORE_COLS));
  const otherCol = 2 + GROC.STORE_COLS, totCol = otherCol + 1, shareCol = totCol + 1;
  styleHeader_(put(L(otherCol) + hdr, 'Other'));
  styleHeader_(put(L(totCol) + hdr, 'Total'));
  styleHeader_(put(L(shareCol) + hdr, 'Costco share'));
  const alcCol = shareCol + 1;
  styleHeader_(put(L(alcCol) + hdr, 'Alcohol (in Total)'));
  for (let k = 0; k < GROC.STORE_MONTHS; k++) {
    const r = GROC.STORE_FIRST + k;
    const mCell = '$A' + r;
    put('A' + r, '=EDATE(DATE(YEAR(TODAY()),MONTH(TODAY()),1),-' + k + ')').setNumberFormat('mmm yyyy');
    for (let j = 0; j < GROC.STORE_COLS; j++) {
      const h = L(2 + j) + '$' + hdr;
      put(L(2 + j) + r, F('=ARRAYFORMULA(IF(' + h + '="","",LET(v,SUMPRODUCT(' + gTx + '*' + txMonth(mCell) + '*(' + storeOf + '=' + h + '),IF(ISNUMBER([TX.amount]),[TX.amount],0)),IF(v=0,"",v))))'));
    }
    put(L(totCol) + r, F('=ARRAYFORMULA(LET(v,' + grocIn(mCell) + ',IF(v=0,"",v)))'));
    put(L(otherCol) + r, '=IF(' + L(totCol) + r + '="","",LET(v,' + L(totCol) + r + '-SUM(B' + r + ':' + L(1 + GROC.STORE_COLS) + r + '),IF(ABS(v)<0.005,"",v)))');
    put(L(shareCol) + r, F('=ARRAYFORMULA(IF(' + L(totCol) + r + '="","",' + costcoIn(mCell) + '/' + L(totCol) + r + '))'));
    put(L(alcCol) + r, F('=ARRAYFORMULA(LET(v,SUMPRODUCT(' + aTx + '*' + txMonth(mCell) + ',IF(ISNUMBER([TX.amount]),[TX.amount],0)),IF(v=0,"",v)))'));
  }
  sh.getRange(GROC.STORE_FIRST, 2, GROC.STORE_MONTHS, totCol - 1).setNumberFormat(FORMATS.currency);
  sh.getRange(GROC.STORE_FIRST, shareCol, GROC.STORE_MONTHS, 1).setNumberFormat('0%');
  sh.getRange(GROC.STORE_FIRST, alcCol, GROC.STORE_MONTHS, 1).setNumberFormat(FORMATS.currency).setFontColor(COLORS.MUTED_TEXT);
  sh.getRange(GROC.STORE_FIRST, totCol, GROC.STORE_MONTHS, 1).setFontWeight('bold');
  sh.getRange(hdr, 1, GROC.STORE_MONTHS + 1, alcCol).setBorder(true, true, true, true, false, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  /* --- what you bought in the month --- */
  styleSectionBar_(sh.getRange('A' + GROC.ITEM_BAR + ':' + L(W) + GROC.ITEM_BAR), 'What you bought — the Month above, item by item, from receipts');
  put('A' + GROC.ITEM_NOTE, F('=ARRAYFORMULA(LET(s,SUMPRODUCT(' + live + '*([GROC.month]=' + M + '),' + net + '),IF(s=0,"No receipts for "&TEXT(' + SEL + ',"mmmm yyyy")&" yet.","Every item on the "&TEXT(' + SEL + ',"mmmm yyyy")&" receipts (Costco, and any other store whose receipt was sent), most spent first: "&TEXT(s,"$#,##0.00")&" in all, before sales tax. Spent is after coupons; Average Price is what one cost before coupons. Rename an item or change its category on Grocery Item Names.")))'));
  sh.getRange('A' + GROC.ITEM_NOTE + ':' + L(W) + GROC.ITEM_NOTE).merge().setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9).setWrap(true);
  sh.setRowHeight(GROC.ITEM_NOTE, 30);
  header(GROC.ITEM_HEADER, ['Item', 'Kind', 'Times Bought', 'Quantity', 'Spent', 'Average Price', 'Saved']);
  put('A' + GROC.ITEM_FIRST, F('=ARRAYFORMULA(IFERROR(LET(g,' + live + '*([GROC.month]=' + M + '),n,' + net + ',q,' + qty + ',p,IF(ISNUMBER([GROC.amount]),[GROC.amount],0),d,IF(ISNUMBER([GROC.discount]),[GROC.discount],0),' +
    'u,UNIQUE(FILTER([GROC.item],g<>0,[GROC.item]<>"")),' +
    'kind,MAP(u,LAMBDA(x,INDEX(FILTER([GROC.subcategory],g<>0,[GROC.item]=x),1))),' +
    'cnt,MAP(u,LAMBDA(x,SUMPRODUCT(g*([GROC.item]=x)))),' +
    'qt,MAP(u,LAMBDA(x,SUMPRODUCT(g*([GROC.item]=x),q))),' +
    'sp,MAP(u,LAMBDA(x,SUMPRODUCT(g*([GROC.item]=x),n))),' +
    'avg,MAP(u,LAMBDA(x,LET(a,SUMPRODUCT(g*([GROC.item]=x),p),c,SUMPRODUCT(g*([GROC.item]=x),q),IF(c=0,"",a/c)))),' +
    'sv,MAP(u,LAMBDA(x,LET(v,-SUMPRODUCT(g*([GROC.item]=x),d),IF(v=0,"",v)))),' +
    'ARRAY_CONSTRAIN(SORT({u,kind,cnt,qt,sp,avg,sv},5,FALSE),' + GROC.ITEM_ROWS + ',7)),""))'));
  sh.getRange(GROC.ITEM_FIRST, 5, GROC.ITEM_ROWS, 3).setNumberFormat(FORMATS.currency);
  sh.getRange(GROC.ITEM_FIRST, 3, GROC.ITEM_ROWS, 2).setNumberFormat('0');

  /* --- top items, last 12 months --- */
  styleSectionBar_(sh.getRange('A' + GROC.TOP_BAR + ':' + L(W) + GROC.TOP_BAR), 'What you buy most — the last 12 months, and how the price has moved');
  note(GROC.TOP_NOTE, 'The ' + GROC.TOP_ROWS + ' items you spent most on in the last 12 months (this month included). Earlier Price is what one cost on the first purchase in those 12 months, Latest Price on the most recent; both are before coupons.');
  header(GROC.TOP_HEADER, ['Item', 'Kind', 'Times Bought', 'Spent', 'Per Month', 'Earlier Price', 'Latest Price', 'Change', 'Last Bought']);
  const s12 = 'EDATE(DATE(YEAR(TODAY()),MONTH(TODAY()),1),-11)';
  put('A' + GROC.TOP_FIRST, F('=ARRAYFORMULA(IFERROR(LET(g,' + live + '*([GROC.date]>=' + s12 + '),n,' + net + ',' +
    'u,UNIQUE(FILTER([GROC.item],g<>0,[GROC.item]<>"")),' +
    'kind,MAP(u,LAMBDA(x,INDEX(FILTER([GROC.subcategory],g<>0,[GROC.item]=x),1))),' +
    'cnt,MAP(u,LAMBDA(x,SUMPRODUCT(g*([GROC.item]=x)))),' +
    'sp,MAP(u,LAMBDA(x,SUMPRODUCT(g*([GROC.item]=x),n))),' +
    'pm,sp/12,' +
    'first,MAP(u,LAMBDA(x,INDEX(SORT(FILTER({[GROC.date],[GROC.unitPrice]},g<>0,[GROC.item]=x,ISNUMBER([GROC.unitPrice]),[GROC.unitPrice]>0),1,TRUE),1,2))),' +
    'last,MAP(u,LAMBDA(x,INDEX(SORT(FILTER({[GROC.date],[GROC.unitPrice]},g<>0,[GROC.item]=x,ISNUMBER([GROC.unitPrice]),[GROC.unitPrice]>0),1,FALSE),1,2))),' +
    'lastd,MAP(u,LAMBDA(x,MAX(FILTER([GROC.date],g<>0,[GROC.item]=x)))),' +
    'chg,IFERROR(IF(last=first,"",last-first),""),' +
    'ARRAY_CONSTRAIN(SORT({u,kind,cnt,sp,pm,IFERROR(first,""),IFERROR(last,""),chg,lastd},4,FALSE),' + GROC.TOP_ROWS + ',9)),""))'));
  sh.getRange(GROC.TOP_FIRST, 3, GROC.TOP_ROWS, 1).setNumberFormat('0');
  sh.getRange(GROC.TOP_FIRST, 4, GROC.TOP_ROWS, 4).setNumberFormat(FORMATS.currency);
  sh.getRange(GROC.TOP_FIRST, 8, GROC.TOP_ROWS, 1).setNumberFormat('+$#,##0.00;-$#,##0.00;""');
  sh.getRange(GROC.TOP_FIRST, 9, GROC.TOP_ROWS, 1).setNumberFormat(FORMATS.date);

  /* --- every Costco trip --- */
  styleSectionBar_(sh.getRange('A' + GROC.TRIP_BAR + ':' + L(W) + GROC.TRIP_BAR), 'Receipts — every trip, newest first');
  note(GROC.TRIP_NOTE, 'One row per receipt (Costco trips, and other stores when a receipt photo is sent). Spent is the items after coupons, before sales tax. Bank Charge is the card charge the trip was matched to and split by; "waiting" means that charge has not come in yet (or the trip is older than the bank feed). A trip sent twice (a photo, then the export) shows once.');
  header(GROC.TRIP_HEADER, ['Date', 'Store', 'Items', 'Spent', 'Saved', 'Food', 'Not Food', 'Source', 'Bank Charge']);
  put('A' + GROC.TRIP_FIRST, F('=ARRAYFORMULA(IFERROR(LET(g,' + live + ',n,' + net + ',' +
    'u,UNIQUE(FILTER([GROC.tripId],g<>0,[GROC.tripId]<>"")),' +
    'dt,MAP(u,LAMBDA(x,MIN(FILTER([GROC.date],g<>0,[GROC.tripId]=x)))),' +
    'loc,MAP(u,LAMBDA(x,INDEX(FILTER(TRIM([GROC.store]&" "&PROPER([GROC.location])),g<>0,[GROC.tripId]=x),1))),' +
    'cnt,MAP(u,LAMBDA(x,SUMPRODUCT(g*([GROC.tripId]=x)))),' +
    'sp,MAP(u,LAMBDA(x,SUMPRODUCT(g*([GROC.tripId]=x),n))),' +
    'sv,MAP(u,LAMBDA(x,LET(v,-SUMPRODUCT(g*([GROC.tripId]=x),IF(ISNUMBER([GROC.discount]),[GROC.discount],0)),IF(v=0,"",v)))),' +
    'fd,MAP(u,LAMBDA(x,SUMPRODUCT(g*([GROC.tripId]=x)*([GROC.category]="Food"),n))),' +
    'src,MAP(u,LAMBDA(x,INDEX(FILTER([GROC.source],g<>0,[GROC.tripId]=x),1))),' +
    'tx,MAP(u,LAMBDA(x,LET(t,INDEX(FILTER([GROC.txId],g<>0,[GROC.tripId]=x),1),IF(t="","waiting",t)))),' +
    'ARRAY_CONSTRAIN(SORT({dt,loc,cnt,sp,sv,fd,sp-fd,src,tx},1,FALSE),' + GROC.TRIP_ROWS + ',9)),""))'));
  sh.getRange(GROC.TRIP_FIRST, 1, GROC.TRIP_ROWS, 1).setNumberFormat(FORMATS.date);
  sh.getRange(GROC.TRIP_FIRST, 3, GROC.TRIP_ROWS, 1).setNumberFormat('0');
  sh.getRange(GROC.TRIP_FIRST, 4, GROC.TRIP_ROWS, 4).setNumberFormat(FORMATS.currency);

  // every table on the tab reads from the left, under its column title (the owner, 2026-11-15)
  [[GROC.STORE_FIRST, GROC.STORE_MONTHS, W], [GROC.ITEM_FIRST, GROC.ITEM_ROWS, 7], [GROC.TOP_FIRST, GROC.TOP_ROWS, 9], [GROC.TRIP_FIRST, GROC.TRIP_ROWS, 9]]
    .forEach(t => sh.getRange(t[0], 1, t[1], t[2]).setHorizontalAlignment('left'));

  /* --- the two graphs, to the right: a bar per month and the 3-month average as a line --- */
  const gc = GROC.GRAPH_COL, gl = (k) => L(gc + k);
  const costcoFood = (m) => 'SUMPRODUCT(' + live + '*([GROC.store]="Costco")*([GROC.category]="Food")*(([GROC.subcategory]="Groceries")+([GROC.subcategory]="Alcohol"))*([GROC.month]>=' + m + ')*([GROC.month]<EDATE(' + m + ',1)),' + net + ')';
  const costcoFood3 = (m) => 'SUMPRODUCT(' + live + '*([GROC.store]="Costco")*([GROC.category]="Food")*(([GROC.subcategory]="Groceries")+([GROC.subcategory]="Alcohol"))*([GROC.month]>=EDATE(' + m + ',-2))*([GROC.month]<EDATE(' + m + ',1)),' + net + ')/3';
  const dataBlock = (bar, hdr, months, title, heads, rowF) => {
    styleSectionBar_(sh.getRange(gl(0) + bar + ':' + gl(2) + bar), title);
    heads.forEach((h, j) => styleHeader_(put(gl(j) + hdr, h)));
    for (let k = 0; k < months; k++) {
      const r = hdr + 1 + k;
      const mExpr = 'EDATE(DATE(YEAR(TODAY()),MONTH(TODAY()),1),' + (k - (months - 1)) + ')'; // oldest first, this month last
      put(gl(0) + r, '=TEXT(' + mExpr + ',"mmm yy")'); // text, so the graph prints every month as a label
      const f = rowF(mExpr);
      put(gl(1) + r, f[0]); put(gl(2) + r, f[1]);
    }
    sh.getRange(hdr + 1, gc + 1, months, 2).setNumberFormat(FORMATS.currency);
    sh.getRange(hdr + 1, gc, months, 3).setHorizontalAlignment('left');
  };
  dataBlock(GROC.GDATA1_BAR, GROC.GDATA1_HEADER, GROC.COSTCO_MONTHS, 'Numbers behind the Costco graph', ['Month', 'Costco food', '3-month average'],
    (m) => [F('=ARRAYFORMULA(' + costcoFood(m) + ')'), F('=ARRAYFORMULA(' + costcoFood3(m) + ')')]);
  // groceries at every store come from Transactions, which start when the bank feed did: earlier months stay blank
  const first = 'IFERROR(EOMONTH(MINIFS([TX.date],[TX.category],"Food",[TX.subcategory],"Groceries"),-1)+1,0)';
  dataBlock(GROC.GDATA2_BAR, GROC.GDATA2_HEADER, GROC.GROC_MONTHS, 'Numbers behind the groceries graph', ['Month', 'Groceries', '3-month average'],
    (m) => [F('=ARRAYFORMULA(LET(fm,' + first + ',IF(OR(fm=0,' + m + '<fm),"",' + grocIn(m) + ')))'),
      F('=ARRAYFORMULA(LET(fm,' + first + ',IF(OR(fm=0,' + m + '<fm),"",LET(ms,MAP({0;1;2},LAMBDA(j,EDATE(' + m + ',-j))),ok,ms>=fm,SUM(IF(ok,MAP(ms,LAMBDA(x,' + grocIn('x') + ')),0))/SUM(--ok)))))')]);
  const graph = (row, hdr, months, title) => sh.newChart().setChartType(Charts.ChartType.COMBO)
    .addRange(sh.getRange(hdr, gc, months + 1, 3))
    .setNumHeaders(1)
    .setPosition(row, gc, 0, 0)
    .setOption('title', title).setOption('legend', { position: 'bottom' })
    .setOption('seriesType', 'bars')
    .setOption('series', { 0: { type: 'bars', color: GROC.BAR_COLOR }, 1: { type: 'line', color: GROC.LINE_COLOR, lineWidth: 3, pointSize: 0 } })
    .setOption('hAxis', { showTextEvery: months > 12 ? 2 : 1, slantedText: true, slantedTextAngle: 45, textStyle: { fontSize: 10 } })
    .setOption('vAxis', { format: '$#,##0', minValue: 0 }).setOption('interpolateNulls', false)
    .setOption('width', 620).setOption('height', 330)
    .build();
  sh.insertChart(graph(GROC.GRAPH1_ROW, GROC.GDATA1_HEADER, GROC.COSTCO_MONTHS, 'Costco food by month (last 24 months) — bars: each month · line: 3-month average'));
  sh.insertChart(graph(GROC.GRAPH2_ROW, GROC.GDATA2_HEADER, GROC.GROC_MONTHS, 'Groceries at every store by month — bars: each month · line: 3-month average'));
}
