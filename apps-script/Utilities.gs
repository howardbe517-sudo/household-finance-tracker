/**
 * Household Finance Tracker — Utilities.gs
 * The Utilities tab (the owner's design, 2026-11-12): a "Show" dropdown at the top (All utilities,
 * or one utility) that every tile, chart and table on the tab follows; tiles for the next bill,
 * the last 12 months, the average and the latest bill against a year ago; a cost-by-month line
 * chart (one line per utility, plus the total when showing all) and a this-year-vs-last-year
 * chart; and the bill history. Everything reads the Utility Bills table (TABLES.UTIL).
 *
 * linkUtilityPayments_ keeps that table current: every sync files each utility payment from
 * Transactions as a paid bill, completing the matching bill when one is already there.
 */

const UTILITIES = {
  SHOW_CELL: 'B3', ALL: 'All utilities',
  TILE_LABEL: 5, TILE_VALUE: 6, TILE_SUB: 7,
  CHART1_ROW: 9, CHART2_ROW: 27, CHART_HEIGHT_ROWS: 17,
  HIST_BAR: 45, HIST_HEADER: 46, HIST_FIRST: 47, HIST_ROWS: 120,
  // chart data, calculated, to the right of the tab
  DATA_COL: 12, MONTHS: 18, DATA_HEADER: 4, DATA_FIRST: 5, YOY_HEADER: 25, YOY_FIRST: 26,
  LAST_ROW: 168,
  // one colour per utility, in UTILITY_TYPES order; the total line last
  COLORS: { 'Gas': '#C2551F', 'Electric': '#1F6FB2', 'Water & Sewer': '#1C8C8C', 'Trash & Recycling': '#6B7C8D', 'Internet': '#7A4FB5', 'Phone': '#3D8B37', 'Other': '#9A6B3F' },
  TOTAL_COLOR: '#1F2933', LAST_YEAR_COLOR: '#9AA8B6',
};

function utilityTypes_() {
  return (LISTS.filter(l => l.key === 'UTILITY_TYPES')[0] || { values: [] }).values;
}

function buildUtilities_() {
  const sh = getOrCreateSheet_(SHEETS.UTILITIES);
  const F = (t) => resolveFormula_(t, null, null);
  sh.getCharts().forEach(c => sh.removeChart(c));
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: the Utilities tab is calculated (formulas and charts; its one input, Show, is put back by the upgrade); rebuilt by buildWorkbook / upgradeWorkbook
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());
  const types = utilityTypes_();
  const dataCols = 1 + types.length + 1; // month, each utility, total
  ensureSheetSize_(sh, UTILITIES.LAST_ROW, UTILITIES.DATA_COL + dataCols);
  sh.setHiddenGridlines(true);
  [110, 130, 160, 105, 70, 95, 90, 75, 110, 30, 30].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, UTILITIES.LAST_ROW, 9).setFontColor(COLORS.TEXT).setFontSize(10).setVerticalAlignment('middle');
  const put = (a1, v) => { const r = sh.getRange(a1); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const mergePut = (a1, v) => { const r = sh.getRange(a1).merge(); if (typeof v === 'string' && v.charAt(0) === '=') r.setFormula(v); else r.setValue(v); return r; };
  const SEL = '$B$3';
  const ALL = '"' + UTILITIES.ALL + '"';
  const crit = 'IF(' + SEL + '=' + ALL + ',"*",' + SEL + ')';          // SUMIFS criterion on Utility
  const match = '((' + SEL + '=' + ALL + ')+([UTIL.utility]=' + SEL + ')>0)'; // FILTER condition on Utility

  /* --- title, Show --- */
  mergePut('A1:I1', 'Utilities').setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(16).setFontWeight('bold');
  sh.setRowHeight(1, 40);
  mergePut('A2:I2', 'Gas, electric, water and the other utility bills: what is due, what they have cost, and how each month compares with a year ago. Pick a utility in Show to see it alone. Bills come from the Utility Bills tab, which every sync keeps up to date.')
    .setFontStyle('italic').setFontColor(COLORS.MUTED_TEXT).setFontSize(9).setWrap(true);
  sh.setRowHeight(2, 30);
  put('A3', 'Show').setFontWeight('bold');
  put(UTILITIES.SHOW_CELL, UTILITIES.ALL).setBackground(COLORS.INPUT).setFontWeight('bold')
    .setBorder(true, true, true, true, false, false, COLORS.NAVY, SpreadsheetApp.BorderStyle.SOLID)
    .setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([UTILITIES.ALL].concat(types), true).setAllowInvalid(false).setHelpText('Pick a utility to see it alone, or All utilities.').build());
  sh.getRange('B3:C3').merge();
  mergePut('D3:I3', 'every tile, chart and table below follows this choice').setFontColor(COLORS.MUTED_TEXT).setFontSize(9);
  setNamedRange_('UTIL_SHOW', sh.getRange(UTILITIES.SHOW_CELL));

  /* --- tiles --- */
  const LM = 'MAXIFS([UTIL.month],[UTIL.status],"Paid",[UTIL.utility],' + crit + ')';
  const tiles = [
    { cols: ['A', 'B'], label: 'Next bill', fmt: '$#,##0.00',
      f: F('=LET(n,SUMIFS([UTIL.amount],[UTIL.status],"Due",[UTIL.utility],' + crit + '),IF(n=0,"—",n))'),
      sub: F('=IFERROR(TEXTJOIN(" · ",TRUE,FILTER([UTIL.utility]&" due "&TEXT([UTIL.dueDate],"mmm d"),[UTIL.status]="Due",' + match + ')),"nothing due")') },
    { cols: ['C', 'D'], label: 'Last 12 months', fmt: '$#,##0.00',
      f: F('=SUMIFS([UTIL.amount],[UTIL.status],"Paid",[UTIL.utility],' + crit + ',[UTIL.dueDate],">"&EDATE(TODAY(),-12))'),
      sub: F('=IF(' + SEL + '<>' + ALL + ',"bills due in the last 12 months",IFERROR(TEXTJOIN(" · ",TRUE,MAP(UNIQUE(FILTER([UTIL.utility],[UTIL.utility]<>"")),LAMBDA(u,LOWER(u)&" "&TEXT(SUMIFS([UTIL.amount],[UTIL.status],"Paid",[UTIL.utility],u,[UTIL.dueDate],">"&EDATE(TODAY(),-12)),"$#,##0")))),""))') },
    { cols: ['E', 'G'], label: 'Average per month', fmt: '$#,##0.00',
      f: '=C' + UTILITIES.TILE_VALUE + '/12',
      sub: 'the last 12 months divided by 12' },
    { cols: ['H', 'I'], label: 'Latest bill vs a year ago', fmt: '+$#,##0.00;-$#,##0.00;$0.00',
      f: F('=IFERROR(LET(lm,' + LM + ',now,SUMIFS([UTIL.amount],[UTIL.month],lm,[UTIL.utility],' + crit + '),ago,SUMIFS([UTIL.amount],[UTIL.month],EDATE(lm,-12),[UTIL.utility],' + crit + '),IF(OR(lm=0,ago=0),"—",now-ago)),"—")'),
      sub: F('=IFERROR(LET(lm,' + LM + ',now,SUMIFS([UTIL.amount],[UTIL.month],lm,[UTIL.utility],' + crit + '),ago,SUMIFS([UTIL.amount],[UTIL.month],EDATE(lm,-12),[UTIL.utility],' + crit + '),IF(lm=0,"no paid bills yet",TEXT(lm,"mmm yyyy")&" "&TEXT(now,"$#,##0.00")&IF(ago=0," · no bill a year earlier"," · a year earlier "&TEXT(ago,"$#,##0.00")))),"")') },
  ];
  tiles.forEach(t => {
    mergePut(t.cols[0] + UTILITIES.TILE_LABEL + ':' + t.cols[1] + UTILITIES.TILE_LABEL, t.label).setBackground(COLORS.PALE_BLUE).setFontWeight('bold').setHorizontalAlignment('center');
    mergePut(t.cols[0] + UTILITIES.TILE_VALUE + ':' + t.cols[1] + UTILITIES.TILE_VALUE, t.f).setFontSize(18).setFontWeight('bold').setHorizontalAlignment('center').setNumberFormat(t.fmt);
    mergePut(t.cols[0] + UTILITIES.TILE_SUB + ':' + t.cols[1] + UTILITIES.TILE_SUB, t.sub).setFontSize(8).setFontColor(COLORS.MUTED_TEXT).setHorizontalAlignment('center').setWrap(true);
    sh.getRange(t.cols[0] + UTILITIES.TILE_LABEL + ':' + t.cols[1] + UTILITIES.TILE_SUB).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  sh.setRowHeight(UTILITIES.TILE_VALUE, 40); sh.setRowHeight(UTILITIES.TILE_SUB, 30);

  /* --- chart data (calculated) to the right: cost by month, and this year vs last year --- */
  const dc = UTILITIES.DATA_COL;
  const L = (c) => colLetter_(c);
  put(L(dc) + (UTILITIES.DATA_HEADER - 1), 'Chart data (calculated)').setFontSize(8).setFontColor(COLORS.MUTED_TEXT);
  put(L(dc) + UTILITIES.DATA_HEADER, 'Month');
  types.forEach((u, j) => {
    // a utility the Show choice leaves out, or one with no bills yet, gets no header and no values, so the chart draws no line for it
    put(L(dc + 1 + j) + UTILITIES.DATA_HEADER, F('=IF(AND(OR(' + SEL + '=' + ALL + ',' + SEL + '="' + u + '"),COUNTIF([UTIL.utility],"' + u + '")>0),"' + u + '","")'));
  });
  const totCol = dc + 1 + types.length;
  put(L(totCol) + UTILITIES.DATA_HEADER, '=IF(' + SEL + '=' + ALL + ',"All utilities","")');
  for (let k = 0; k < UTILITIES.MONTHS; k++) {
    const r = UTILITIES.DATA_FIRST + k;
    put(L(dc) + r, '=EDATE(DATE(YEAR(TODAY()),MONTH(TODAY()),1),' + (k - (UTILITIES.MONTHS - 2)) + ')').setNumberFormat('mmm yy');
    types.forEach((u, j) => {
      const hdr = L(dc + 1 + j) + '$' + UTILITIES.DATA_HEADER;
      put(L(dc + 1 + j) + r, F('=IF(' + hdr + '="","",LET(v,SUMIFS([UTIL.amount],[UTIL.utility],"' + u + '",[UTIL.month],$' + L(dc) + r + '),IF(v=0,"",v)))'));
    });
    put(L(totCol) + r, F('=IF(' + L(totCol) + '$' + UTILITIES.DATA_HEADER + '="","",LET(v,SUMIFS([UTIL.amount],[UTIL.month],$' + L(dc) + r + '),IF(v=0,"",v)))'));
  }
  const dataLast = UTILITIES.DATA_FIRST + UTILITIES.MONTHS - 1;
  sh.getRange(UTILITIES.DATA_FIRST, dc + 1, UTILITIES.MONTHS, types.length + 1).setNumberFormat(FORMATS.currency);
  put(L(dc) + UTILITIES.YOY_HEADER, 'Month');
  put(L(dc + 1) + UTILITIES.YOY_HEADER, '=YEAR(TODAY())-1');
  put(L(dc + 2) + UTILITIES.YOY_HEADER, '=YEAR(TODAY())');
  for (let m = 0; m < 12; m++) {
    const r = UTILITIES.YOY_FIRST + m;
    put(L(dc) + r, ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]);
    [1, 2].forEach(off => put(L(dc + off) + r, F('=LET(v,SUMIFS([UTIL.amount],[UTIL.utility],' + crit + ',[UTIL.month],DATE(' + L(dc + off) + '$' + UTILITIES.YOY_HEADER + ',' + (m + 1) + ',1)),IF(v=0,"",v))')));
  }
  sh.getRange(UTILITIES.YOY_FIRST, dc + 1, 12, 2).setNumberFormat(FORMATS.currency);
  sh.getRange(UTILITIES.DATA_HEADER - 1, dc, UTILITIES.YOY_FIRST + 12 - (UTILITIES.DATA_HEADER - 1), dataCols).setFontSize(8).setFontColor(COLORS.MUTED_TEXT);

  /* --- charts --- */
  const series = {};
  types.forEach((u, j) => { series[j] = { color: UTILITIES.COLORS[u] || COLORS.NAVY, lineWidth: 3, pointSize: 5 }; });
  series[types.length] = { color: UTILITIES.TOTAL_COLOR, lineWidth: 1, lineDashStyle: [2, 3], pointSize: 0 };
  const c1 = sh.newChart().setChartType(Charts.ChartType.LINE)
    .addRange(sh.getRange(UTILITIES.DATA_HEADER, dc, UTILITIES.MONTHS + 1, dataCols))
    .setNumHeaders(1)
    .setPosition(UTILITIES.CHART1_ROW, 1, 0, 0)
    .setOption('title', 'Cost by month').setOption('legend', { position: 'bottom' }).setOption('series', series)
    .setOption('vAxis', { format: '$#,##0' }).setOption('interpolateNulls', false)
    .setOption('width', 900).setOption('height', 340)
    .build();
  sh.insertChart(c1);
  const c2 = sh.newChart().setChartType(Charts.ChartType.LINE)
    .addRange(sh.getRange(UTILITIES.YOY_HEADER, dc, 13, 3))
    .setNumHeaders(1)
    .setPosition(UTILITIES.CHART2_ROW, 1, 0, 0)
    .setOption('title', 'This year vs last year').setOption('legend', { position: 'bottom' })
    .setOption('series', { 0: { color: UTILITIES.LAST_YEAR_COLOR, lineWidth: 2, lineDashStyle: [6, 4], pointSize: 4 }, 1: { color: '#C2551F', lineWidth: 3, pointSize: 5 } })
    .setOption('vAxis', { format: '$#,##0' }).setOption('interpolateNulls', false)
    .setOption('width', 900).setOption('height', 340)
    .build();
  sh.insertChart(c2);

  /* --- bill history, newest first --- */
  styleSectionBar_(sh.getRange('A' + UTILITIES.HIST_BAR + ':I' + UTILITIES.HIST_BAR), 'Bill history — newest first');
  const hdr = sh.getRange('A' + UTILITIES.HIST_HEADER + ':I' + UTILITIES.HIST_HEADER);
  hdr.setValues([['Due', 'Utility', 'Provider', 'Period Ends', 'Days', 'Amount', 'Per Day', 'Status', 'vs a Year Ago']]);
  styleHeader_(hdr); hdr.setHorizontalAlignment('center');
  const hf = UTILITIES.HIST_FIRST, hl = UTILITIES.HIST_FIRST + UTILITIES.HIST_ROWS - 1;
  put('A' + hf, F('=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({[UTIL.dueDate],[UTIL.utility],[UTIL.provider],[UTIL.periodEnd],[UTIL.days],[UTIL.amount],[UTIL.perDay],[UTIL.status]},[UTIL.dueDate]<>"",' + match + '),1,FALSE),' + UTILITIES.HIST_ROWS + ',8),"No bills yet. They arrive with the next sync, or from statements through Finance Tracker → Import from Claude.")'));
  put('I' + hf, F('=IFERROR(MAP(A' + hf + ':A' + hl + ',B' + hf + ':B' + hl + ',F' + hf + ':F' + hl + ',LAMBDA(d,u,a,IF(NOT(ISNUMBER(d)),"",LET(p,SUMIFS([UTIL.amount],[UTIL.utility],u,[UTIL.month],EDATE(DATE(YEAR(d),MONTH(d),1),-12)),IF(p=0,"",a-p))))),"")'));
  sh.getRange('A' + hf + ':A' + hl).setNumberFormat(FORMATS.date);
  sh.getRange('D' + hf + ':D' + hl).setNumberFormat('mmm d');
  sh.getRange('E' + hf + ':E' + hl).setNumberFormat(FORMATS.int);
  sh.getRange('F' + hf + ':G' + hl).setNumberFormat(FORMATS.currency);
  sh.getRange('I' + hf + ':I' + hl).setNumberFormat('+$#,##0.00;-$#,##0.00;$0.00');
  sh.setConditionalFormatRules([
    cfRule_(sh.getRange('H' + hf + ':H' + hl), '=$H' + hf + '="Due"', COLORS.WARN_FILL, COLORS.WARN_FONT),
    cfRule_(sh.getRange('I' + hf + ':I' + hl), '=AND(ISNUMBER($I' + hf + '),$I' + hf + '>0)', null, COLORS.OVER_FONT),
    cfRule_(sh.getRange('I' + hf + ':I' + hl), '=AND(ISNUMBER($I' + hf + '),$I' + hf + '<0)', null, COLORS.UNDER_FONT),
  ]);
  const prot = sh.protect().setDescription('The Utilities tab is calculated. Change Show in B3; bills live on the Utility Bills tab.');
  prot.setWarningOnly(true);
  prot.setUnprotectedRanges([sh.getRange(UTILITIES.SHOW_CELL)]);
}

/**
 * File every utility payment on Transactions as a paid bill on Utility Bills. A payment is a
 * Transactions row (not deleted, Expense) whose subcategory is in UTILITY_FROM_SUBCATEGORY and that
 * no bill names yet. It completes the bill of the same utility, with no Transaction ID, within $1
 * (or 1%) of its amount, or up to $5 (or 3%) over it for a card fee, and 25 days of its due date (a Due bill becomes Paid; a Paid bill from a
 * statement gets the link). Otherwise it adds a Paid bill dated the payment day. Safe to run again:
 * a payment already named by a bill is skipped. Returns { linked, created }.
 */
function linkUtilityPayments_() {
  const def = tdef_('UTIL');
  if (!ss_().getSheetByName(def.sheet)) return { linked: 0, created: 0 };
  syncLastRow_(def);
  const bills = readTable_(def);
  const named = {};
  bills.forEach(b => { if (b.txId) named[b.txId] = true; });
  const pays = readTable_(tdef_('TX')).filter(t => t.id && !named[t.id] && t.isDeleted !== true && t.type === 'Expense' && UTILITY_FROM_SUBCATEGORY[t.subcategory] && t.date instanceof Date);
  if (!pays.length) return { linked: 0, created: 0 };
  const sh = getOrCreateSheet_(def.sheet);
  const col = (k) => colIndex_(def, k);
  let linked = 0;
  const fresh = [];
  pays.sort((a, b) => a.date - b.date).forEach(t => {
    const utility = UTILITY_FROM_SUBCATEGORY[t.subcategory];
    const amt = Math.abs(Number(t.amount || 0));
    // the payment may run a little over the bill: paying a utility by card often adds a flat processing fee
    const fits = (b) => { const diff = amt - Number(b.amount || 0); return Math.abs(diff) <= Math.max(1, amt * 0.01) || (diff > 0 && diff <= Math.max(5, amt * 0.03)); };
    const bill = bills.filter(b => !b.txId && b.utility === utility && b.dueDate instanceof Date && fits(b) && Math.abs(b.dueDate - t.date) <= 25 * 86400000)
      .sort((a, b) => Math.abs(a.dueDate - t.date) - Math.abs(b.dueDate - t.date))[0];
    if (bill) {
      sh.getRange(bill.__row, col('txId')).setValue(t.id);
      sh.getRange(bill.__row, col('status')).setValue('Paid');
      if (!(bill.paidDate instanceof Date)) sh.getRange(bill.__row, col('paidDate')).setValue(t.date);
      const over = Math.round((amt - Number(bill.amount || 0)) * 100) / 100;
      if (over >= 0.5) sh.getRange(bill.__row, col('notes')).setValue((bill.notes ? bill.notes + ' · ' : '') + 'Paid $' + amt.toFixed(2) + ', $' + over.toFixed(2) + ' over the bill (card or processing fee).');
      bill.txId = t.id;
      linked++;
    } else {
      const sample = String(t.notes || '').indexOf(HFT.SAMPLE_TAG) === 0 || t.createdBy === HFT.SAMPLE_USER;
      fresh.push({ utility, provider: t.description || '', dueDate: t.date, amount: amt, status: 'Paid', paidDate: t.date, txId: t.id, source: 'Bank feed',
        notes: (sample ? HFT.SAMPLE_TAG + ' · ' : '') + 'Filed from ' + t.id + ' by the sync.' });
    }
  });
  if (fresh.length) {
    let next = parseInt(nextId_(def, 4).split('-')[1], 10);
    fresh.forEach(r => { r.id = def.idPrefix + '-' + String(next++).padStart(4, '0'); });
    writeRows_(def, fresh);
  }
  return { linked, created: fresh.length };
}
