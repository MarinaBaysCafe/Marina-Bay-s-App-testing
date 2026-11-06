/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved.

   Sales and shifts for the point of sale, and the end-of-shift report.

   A shift is opened with a starting cash amount. Every sale made while it is open belongs to it.
   When the shift ends, the report is worked out and saved, like the shift report on a POS receipt:
     Cash drawer    starting cash + cash payments - cash refunds - cash paid out (cash expenses) = expected cash
                    actual cash (counted) and the difference
     Sales summary  gross sales, refunds, discounts, net sales, cash, e-wallet
     Expenses       every expense recorded during the shift
     Cups and lids  how many of each were used by the drinks sold

   Lids: a drink in a hot size uses a black lid. Otherwise the menu section decides: "dome" (round, frappe),
   "flat", or "none". Cups are named from the size: 16 oz iced -> 16oz dabba, 12 oz hot -> 12oz double wall. */
(function () {
  var D = window.MBData;
  var SALES_KEY = 'marinabays_sales_v1', SHIFTS_KEY = 'marinabays_shifts_v1', POS_KEY = 'marinabays_posname_v1', USER_KEY = 'marinabays_lastuser_v1';
  var EXP_KEY = 'marinabays_expenses_v1', MONEY_KEY = 'marinabays_money_v1';
  var TZ = 'Asia/Manila', STORE = "Marina Bay's Cafe";
  // details printed on order and sale receipts
  var CAFE = {
    address: 'B28 L2 Ph1 Bagong Nayon 2, Barangay San Isidro, Antipolo City, Rizal 1870',
    tin: '204-229-455-00000',
    phone: '0922 962 5660',
    email: 'marinabayscafe@gmail.com',
    lines: ['Calm in every cup...', 'Thanks for sailing by!']
  };
  // The details printed on POS receipts. They come from Printers > Receipt on this device;
  // anything not set there falls back to the CAFE values above.
  function cafe() {
    var r = (window.MBPrinter && window.MBPrinter.state.receipt) || {};
    function pick(k, d) { return typeof r[k] === 'string' ? r[k] : d; }
    return {
      address: pick('address', CAFE.address), tin: pick('tin', CAFE.tin),
      phone: pick('phone', CAFE.phone), email: pick('email', CAFE.email),
      thanks: pick('thanks', CAFE.lines.join('\n'))
    };
  }
  function lines(t) { return String(t || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function typeText(t) { return t === 'take' ? 'Take out' : 'Dine in'; }
  var DENOMS = [1000, 500, 200, 100, 50, 20, 10, 5, 1];

  function load(key, dflt) { try { var v = JSON.parse(localStorage.getItem(key)); if (v) return v; } catch (e) {} return dflt; }
  var sales = load(SALES_KEY, { sales: [] });
  if (!Array.isArray(sales.sales)) sales.sales = [];
  var shifts = load(SHIFTS_KEY, { nextNo: 1, cur: null, hist: [] });
  shifts.hist = shifts.hist || []; if (!shifts.nextNo) shifts.nextNo = 1;
  function saveSales() { try { localStorage.setItem(SALES_KEY, JSON.stringify(sales)); return true; } catch (e) { return false; } }
  function saveShifts() { try { localStorage.setItem(SHIFTS_KEY, JSON.stringify(shifts)); return true; } catch (e) { return false; } }

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function num(n) { return Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function sg(n) { n = Number(n) || 0; return (n < 0 ? '-' : n > 0 ? '+' : '') + '₱' + num(Math.abs(n)); }
  function phDate(ts) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts)); }
  function fmtDT(ts) {
    if (!ts) return '-';
    return new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: '2-digit', day: '2-digit', year: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true })
      .format(new Date(ts)).replace(',', '').replace(/[\u202f\u00a0]/g, ' ');
  }
  function fmtTime(ts) {
    return new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(ts)).replace(/[\u202f\u00a0]/g, ' ');
  }
  function nextDate(d) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); }

  /* ---------- cups and lids ---------- */
  function cupName(label) {
    var m = /(\d+)\s*oz/i.exec(label || ''); if (!m) return null;
    return m[1] + 'oz ' + (/hot/i.test(label) ? 'double wall' : 'dabba');
  }
  function lidName(cat, label) {
    if (!cupName(label)) return null;
    if (cat && cat.lid === 'none') return null;
    if (/hot/i.test(label)) return 'Black lids';
    var dome = cat && (cat.lid === 'dome' || (cat.lid === undefined && /blend|frappe/i.test((cat.name || '') + ' ' + (cat.note || ''))));
    return dome ? 'Dome lids' : 'Flat lids';
  }

  /* ---------- sales ---------- */
  // cartLines come from the POS cart; pay = { disc, method, tend }
  function makeSale(cartLines, pay) {
    var gross = 0, lines = cartLines.map(function (l) {
      var unit = Number(l.price) || 0; (l.addons || []).forEach(function (a) { unit += Number(a.p) || 0; });
      gross += unit * l.qty;
      var catId = l.cat || ((D.item(String(l.k || '').split('|')[0]) || {}).cat), cat = catId ? D.cat(catId) : null;
      return { name: l.name, opt: l.opt || '', price: Number(l.price) || 0, addons: (l.addons || []).map(function (a) { return { n: a.n, p: Number(a.p) || 0 }; }),
               note: l.note || '', qty: l.qty, cup: cupName(l.opt), lid: lidName(cat, l.opt) };
    });
    gross = r2(gross);
    var disc = r2(Math.min(pay.disc || 0, gross)), net = r2(gross - disc);
    var pays = [], nonCash = 0, cashTend = 0;
    if (pay.splits) {
      pay.splits.forEach(function (x) { var a = r2(x.amt); if (a <= 0) return; if (x.cash) cashTend += a; else { pays.push({ id: x.id, name: x.name, amt: a }); nonCash += a; } });
      if (nonCash > net) { var left = net; pays.forEach(function (x) { x.amt = r2(Math.min(x.amt, left)); left = r2(left - x.amt); }); pays = pays.filter(function (x) { return x.amt > 0; }); nonCash = net; }
    } else if (pay.method === 'ewallet') { pays.push({ id: 'ewallet', name: 'E-wallet', amt: net }); nonCash = net; }
    else cashTend = pay.tend || net;
    var ca = r2(net - nonCash);
    var cur = shifts.cur, count = cur ? sales.sales.filter(function (s) { return s.shift === cur.no; }).length : 0;
    var posNo = /(\d+)/.exec(cur && cur.pos ? cur.pos : posName());
    return { id: D.uid('sale'), type: pay.type === 'take' ? 'take' : 'dine', emp: cur ? cur.openedBy || '' : '', pos: cur && cur.pos ? cur.pos : posName(),
             rno: '#' + (posNo ? posNo[1] : '1') + '-' + (sales.sales.length + 1), t: Date.now(), shift: cur ? cur.no : null, n: count + 1, lines: lines, gross: gross, disc: disc, net: net,
             pay: nonCash === 0 ? 'cash' : (ca === 0 ? 'ewallet' : 'split'), ca: ca, pays: pays, discs: pay.discs || [],
             tend: r2(cashTend), change: r2(Math.max(0, cashTend - ca)), ref: 0 };
  }
  function cashOf(s) { return s.ca != null ? s.ca : (s.pay === 'cash' ? s.net : 0); }
  /* Cups and lids come off the stock the moment an order is saved (s.inv remembers what was taken) and go back on a refund or delete. */
  function stockOut(s) {
    var items = D.getInventory().items || [], need = {}, took = {};
    (s.lines || []).forEach(function (l) { [l.cup, l.lid].forEach(function (k) { if (k) need[k] = (need[k] || 0) + l.qty; }); });
    Object.keys(need).forEach(function (k) {
      var it = items.filter(function (i) { return String(i.name).toLowerCase() === k.toLowerCase(); })[0]; if (!it || it.qty == null) return;
      var before = it.qty, after = Math.max(0, before - need[k]); if (after === before) return;
      it.qty = after; it.updated = phDate(Date.now()); took[it.id] = before - after;
      if (window.MBInvLog) window.MBInvLog.logAuto(it.id, before, after);
    });
    s.inv = took; if (Object.keys(took).length) D.saveInventory();
  }
  function stockBack(s) {
    if (!s || !s.inv) return; var items = D.getInventory().items || [], back = false;
    Object.keys(s.inv).forEach(function (id) {
      var it = items.filter(function (i) { return i.id === id; })[0]; if (!it || it.qty == null) return;
      var before = it.qty; it.qty = before + s.inv[id]; it.updated = phDate(Date.now()); back = true;
      if (window.MBInvLog) window.MBInvLog.restoreAuto(id, before, it.qty);
    });
    s.inv = null; if (back) D.saveInventory();
  }
  /* orders of a shift saved before this existed, or on another phone, are taken off when the shift closes */
  function settleShift(no) { sales.sales.forEach(function (s) { if (s.shift === no && !s.ref && s.inv === undefined) stockOut(s); }); saveSales(); }
  function addSale(s) { stockOut(s); sales.sales.push(s); return saveSales(); }
  function refund(id) { var s = sales.sales.filter(function (x) { return x.id === id; })[0]; if (!s || s.ref) return false; s.ref = 1; s.refT = Date.now(); stockBack(s); return saveSales(); }
  /* Delete an order. Only orders of the shift that is still open (a closed shift's report is already fixed). */
  function deleteSale(id) {
    var s = sales.sales.filter(function (x) { return x.id === id; })[0], cur = shifts.cur;
    if (!s || !cur || s.shift !== cur.no) return false;
    if (!s.ref) stockBack(s);
    sales.sales = sales.sales.filter(function (x) { return x.id !== id; }); return saveSales();
  }
  /* Delete a closed shift and all of its orders. Expenses and the money counter are left alone. */
  function deleteShift(no) {
    var h = shifts.hist.filter(function (x) { return x.no === no; })[0]; if (!h) return false;
    sales.sales.forEach(function (x) { if (x.shift === no && !x.ref) stockBack(x); });
    sales.sales = sales.sales.filter(function (x) { return x.shift !== no; });
    shifts.hist = shifts.hist.filter(function (x) { return x.no !== no; });
    return saveSales() && saveShifts();
  }
  function salesOf(no) { return sales.sales.filter(function (s) { return s.shift === no; }); }

  /* ---------- shifts ---------- */
  function posName() { try { return localStorage.getItem(POS_KEY) || 'POS 1'; } catch (e) { return 'POS 1'; } }
  function setPosName(n) { try { localStorage.setItem(POS_KEY, String(n || 'POS 1').trim() || 'POS 1'); } catch (e) {} }
  function lastUser() { try { return localStorage.getItem(USER_KEY) || ''; } catch (e) { return ''; } }
  function rememberUser(n) { try { localStorage.setItem(USER_KEY, n || ''); } catch (e) {} }
  function current() { return shifts.cur; }
  function lastActual() { var h = shifts.hist[shifts.hist.length - 1]; return h && h.actual != null ? h.actual : ''; }
  // the starting cash entered on the last shift (open or closed). Next shift starts with the same amount.
  function lastStart() {
    var c = shifts.cur, h = shifts.hist[shifts.hist.length - 1], v = c ? c.startCash : (h ? h.startCash : null);
    return v == null ? '' : v;
  }
  function start(cash, by) {
    if (shifts.cur) return shifts.cur;
    var maxNo = shifts.hist.reduce(function (m, h) { return Math.max(m, h.no); }, 0);
    shifts.cur = { no: Math.max(shifts.nextNo, maxNo + 1), openedAt: Date.now(), openedBy: String(by || '').trim(), startCash: r2(cash), pos: posName() };
    shifts.nextNo = shifts.cur.no + 1; rememberUser(shifts.cur.openedBy); saveShifts(); return shifts.cur;
  }

  /* ---------- expenses and counted cash (kept by the other apps) ---------- */
  function expensesBetween(from, to) {
    var store = load(EXP_KEY, { days: {} }), out = [], d = phDate(from), last = phDate(to), guard = 0;
    while (d <= last && guard++ < 40) {
      (store.days && store.days[d] || []).forEach(function (e) {
        if (e.t ? (e.t >= from && e.t <= to) : true) out.push({ cat: e.cat, note: e.note || '', amt: Number(e.amt) || 0, src: e.src === 'online' ? 'online' : 'cash', t: e.t || 0 });
      });
      d = nextDate(d);
    }
    return out;
  }
  function countedCash(date) {
    var r = load(MONEY_KEY, {})[date], t = 0; if (!r) return 0;
    DENOMS.forEach(function (d) { t += d * ((r.counts || {})[d] || 0); });
    return t;
  }

  /* ---------- everything by calendar day ---------- */
  function emptyDay(date) {
    return { date: date, orders: 0, gross: 0, refunds: 0, discounts: 0, net: 0, cash: 0, ewallet: 0, drinks: 0, cups: {}, lids: {},
             expenses: [], expCash: 0, expOnline: 0, counted: 0, online: 0, shifts: [], after: 0 };
  }
  function buildIndex() {
    var idx = {};
    function d(date) { return idx[date] || (idx[date] = emptyDay(date)); }
    sales.sales.forEach(function (s) {
      var x = d(phDate(s.t)); x.orders++; x.gross += s.gross;
      if (s.ref) x.refunds += s.gross;
      else { x.discounts += s.disc; x.cash += cashOf(s); x.ewallet += s.net - cashOf(s); }
      s.lines.forEach(function (l) {
        if (l.cup) { x.cups[l.cup] = (x.cups[l.cup] || 0) + l.qty; x.drinks += l.qty; }
        if (l.lid) x.lids[l.lid] = (x.lids[l.lid] || 0) + l.qty;
      });
    });
    var ex = load(EXP_KEY, { days: {} }).days || {};
    Object.keys(ex).forEach(function (date) {
      (ex[date] || []).forEach(function (e) {
        var x = d(date), a = Number(e.amt) || 0;
        x.expenses.push({ cat: e.cat, note: e.note || '', amt: a, src: e.src === 'online' ? 'online' : 'cash', t: e.t || 0 });
        if (e.src === 'online') x.expOnline += a; else x.expCash += a;
      });
    });
    var money = load(MONEY_KEY, {});
    Object.keys(money).forEach(function (date) {
      var c = countedCash(date), o = Number(money[date] && money[date].online) || 0;
      if (c > 0 || o > 0) { var x = d(date); x.counted = c; x.online = o; }
    });
    shifts.hist.forEach(function (r) { d(phDate(r.closedAt || r.openedAt)).shifts.push({ no: r.no, open: false, openedAt: r.openedAt, closedAt: r.closedAt, net: r.net, diff: r.diff, pos: r.pos }); });
    if (shifts.cur) d(phDate(shifts.cur.openedAt)).shifts.push({ no: shifts.cur.no, open: true, openedAt: shifts.cur.openedAt, closedAt: null, net: null, diff: null, pos: shifts.cur.pos });
    Object.keys(idx).forEach(function (k) {
      var x = idx[k];
      x.gross = r2(x.gross); x.refunds = r2(x.refunds); x.discounts = r2(x.discounts); x.cash = r2(x.cash); x.ewallet = r2(x.ewallet);
      x.net = r2(x.gross - x.refunds - x.discounts); x.expCash = r2(x.expCash); x.expOnline = r2(x.expOnline);
      x.after = r2(x.net - x.expCash - x.expOnline);
    });
    return idx;
  }
  function day(date) { return buildIndex()[date] || emptyDay(date); }
  // totals for each day of a month, and the month's total
  function month(y, m) {
    var idx = buildIndex(), days = {}, tot = emptyDay(y + '-' + (m < 9 ? '0' : '') + (m + 1)), n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (var i = 1; i <= n; i++) {
      var key = y + '-' + (m < 9 ? '0' : '') + (m + 1) + '-' + (i < 10 ? '0' : '') + i, x = idx[key];
      if (!x) continue;
      days[key] = x;
      tot.orders += x.orders; tot.net += x.net; tot.gross += x.gross; tot.drinks += x.drinks; tot.expCash += x.expCash; tot.expOnline += x.expOnline;
    }
    tot.net = r2(tot.net); tot.expCash = r2(tot.expCash); tot.expOnline = r2(tot.expOnline); tot.after = r2(tot.net - tot.expCash - tot.expOnline);
    return { days: days, total: tot };
  }

  /* ---------- take the cups and lids used out of the inventory ---------- */
  function deductInventory(rep) {
    var items = (D.getInventory().items || []), used = [];
    function find(name) { name = String(name).toLowerCase(); return items.filter(function (i) { return String(i.name).toLowerCase() === name; })[0]; }
    [rep.cups, rep.lids].forEach(function (map) {
      Object.keys(map || {}).forEach(function (k) {
        var it = find(k); if (!it) return;
        var before = it.qty == null ? 0 : it.qty, after = Math.max(0, before - map[k]);
        it.qty = after; it.updated = phDate(Date.now()); if (window.MBInvLog) window.MBInvLog.logAuto(it.id, before, after); used.push({ name: it.name, used: map[k], before: before, after: after });
      });
    });
    if (used.length) D.saveInventory();
    return used;
  }

  /* ---------- the report ---------- */
  function report(sh, opts) {
    opts = opts || {};
    var upto = opts.closedAt || Date.now(), ss = salesOf(sh.no);
    var gross = 0, refunds = 0, disc = 0, cashPay = 0, cashRef = 0, salesCash = 0, ewallet = 0, drinks = 0, cups = {}, lids = {};
    ss.forEach(function (s) {
      gross += s.gross;
      cashPay += cashOf(s);
      if (s.ref) { refunds += s.gross; cashRef += cashOf(s); }
      else { disc += s.disc; salesCash += cashOf(s); ewallet += s.net - cashOf(s); }
      s.lines.forEach(function (l) {
        if (l.cup) { cups[l.cup] = (cups[l.cup] || 0) + l.qty; drinks += l.qty; }
        if (l.lid) lids[l.lid] = (lids[l.lid] || 0) + l.qty;
      });
    });
    var ex = expensesBetween(sh.openedAt, upto), paidOut = 0, expCash = 0, expOnline = 0;
    ex.forEach(function (e) { if (e.src === 'cash') { expCash += e.amt; paidOut += e.amt; } else expOnline += e.amt; });
    var expected = r2(sh.startCash + cashPay - cashRef - paidOut);
    var actual = opts.actual === undefined || opts.actual === null || opts.actual === '' ? null : r2(opts.actual);
    return {
      no: sh.no, store: STORE, pos: sh.pos || posName(), openedAt: sh.openedAt, openedBy: sh.openedBy || '',
      closedAt: opts.closedAt || null, closedBy: opts.closedBy || '', startCash: r2(sh.startCash),
      cashPayments: r2(cashPay), cashRefunds: r2(cashRef), paidOut: r2(paidOut), expected: expected, actual: actual,
      diff: actual === null ? null : r2(actual - expected),
      excess: actual === null ? null : r2(actual - sh.startCash), cashSales: r2(cashPay - cashRef),
      gross: r2(gross), refunds: r2(refunds), discounts: r2(disc), net: r2(gross - refunds - disc), cash: r2(salesCash), ewallet: r2(ewallet), orders: ss.length,
      expenses: ex, expCash: r2(expCash), expOnline: r2(expOnline), drinks: drinks, cups: cups, lids: lids
    };
  }
  function close(closedBy, actual, at) {
    var cur = shifts.cur; if (!cur) return null;
    var r = report(cur, { closedAt: at || Date.now(), closedBy: String(closedBy || '').trim(), actual: actual });
    shifts.hist.push(r); shifts.cur = null; rememberUser(r.closedBy); saveShifts(); return r;
  }

  /* ---------- receipts (p is the printer's line builder) ---------- */
  function sortedKeys(o) { return Object.keys(o).sort(); }
  function reportReceipt(p, r) {
    p.header(r.closedAt ? 'Shift report' : 'Shift report (still open)');
    p.text('Shift number: ' + r.no);
    p.text('Store: ' + r.store);
    p.text('POS: ' + r.pos);
    p.rule();
    p.row('Shift opened', fmtDT(r.openedAt));
    if (r.openedBy) p.text('  By: ' + r.openedBy, { indent: '      ' });
    p.row('Shift closed', r.closedAt ? fmtDT(r.closedAt) : 'not yet');
    if (r.closedAt && r.closedBy) p.text('  By: ' + r.closedBy, { indent: '      ' });
    p.rule(); p.center('Cash drawer'); p.rule();
    p.row('Starting cash', num(r.startCash));
    p.row('Cash payments', num(r.cashPayments));
    p.row('Cash refunds', num(r.cashRefunds));
    p.row('Paid out (expenses)', num(r.paidOut));
    p.row('Expected cash amount', num(r.expected));
    p.row('Actual cash amount', r.actual === null ? '-' : num(r.actual));
    p.row('Difference', r.diff === null ? '-' : (r.diff > 0 ? '+' : '') + num(r.diff), { b: true });
    p.rule(); p.center('Sales summary'); p.rule();
    p.row('Orders', String(r.orders));
    p.row('Gross sales', num(r.gross), { b: true });
    p.row('Refunds', num(r.refunds));
    p.row('Discounts', num(r.discounts));
    p.row('Net sales', num(r.net), { b: true });
    p.row('Cash', num(r.cash));
    p.row('E-wallet', num(r.ewallet));
    p.rule(); p.center('Expenses'); p.rule();
    if (!r.expenses.length) p.text('No expenses');
    r.expenses.forEach(function (e) {
      p.row(e.cat, num(e.amt));
      p.text('  ' + (e.src === 'online' ? 'Online' : 'Cash') + (e.note ? ' - ' + e.note : ''), { indent: '    ' });
    });
    p.row('Paid in cash', num(r.expCash));
    p.row('Paid online', num(r.expOnline));
    p.row('Total expenses', num(r.expCash + r.expOnline), { b: true });
    p.rule(); p.center('Cups used'); p.rule();
    if (!r.drinks) p.text('No drinks sold');
    sortedKeys(r.cups).forEach(function (k) { p.row(k, String(r.cups[k])); });
    if (r.drinks) p.row('Total cups', String(r.drinks), { b: true });
    p.rule(); p.center('Lids used'); p.rule();
    if (!sortedKeys(r.lids).length) p.text('No lids used');
    sortedKeys(r.lids).forEach(function (k) { p.row(k, String(r.lids[k])); });
    p.rule();
    p.center(fmtDT(r.closedAt || Date.now()));
    p.footer();
  }
  // top part shared by order and sale receipts: logo, shop, address, TIN, employee, POS, order type
  function slipHead(p, o) {
    var r = (window.MBPrinter && window.MBPrinter.state.receipt) || {};
    p.logo();
    p.center(r.shop || STORE, { b: true });
    var c = cafe();
    if (lines(c.address).length) { lines(c.address).forEach(function (l) { p.center(l); }); p.feed(1); }
    if (String(c.tin).trim()) { p.center('TIN #' + String(c.tin).trim()); p.feed(1); }
    if (o.emp) p.text('Employee: ' + o.emp);
    p.text('POS: ' + (o.pos || posName()));
    p.rule('.');
    p.text(typeText(o.type));
    p.rule('.');
  }
  // items: name and line total, then qty x price, then size, add-ons and note
  function slipLines(p, lines) {
    lines.forEach(function (l) {
      var unit = Number(l.price) || 0; (l.addons || []).forEach(function (a) { unit += Number(a.p) || 0; });
      p.row(l.name, num(unit * l.qty));
      p.text(l.qty + ' x \u20b1' + num(unit), { indent: '' });
      var extra = []; if (l.opt) extra.push(l.opt); (l.addons || []).forEach(function (a) { extra.push('+ ' + a.n); });
      extra.forEach(function (x) { p.text('  ' + x, { indent: '    ' }); });
      if (l.note) p.text('  Note: ' + l.note, { indent: '    ' });
    });
  }
  // bottom part: contact, thank you lines, date and receipt number
  function slipFoot(p, when, no) {
    p.rule('.');
    var c = cafe();
    if (String(c.phone).trim()) p.center(String(c.phone).trim());
    if (String(c.email).trim()) p.center(String(c.email).trim());
    lines(c.thanks).forEach(function (ln) { p.feed(1); p.center(ln); });
    p.feed(1);
    p.row(when, no || '');
  }
  function saleReceipt(p, s) {
    slipHead(p, { type: s.type, emp: s.emp, pos: s.pos });
    slipLines(p, s.lines);
    p.rule('.');
    if (s.disc) { p.row('Subtotal', num(s.gross)); p.row('Discount', '-' + num(s.disc)); }
    p.row('Total', num(s.net), { b: true });
    (s.discs || []).forEach(function (d) { p.text('  ' + d.name + (d.pct ? ' ' + d.pct + '%' : '') + (d.item ? ' (' + d.item + ')' : ''), { indent: '    ' }); });
    if (s.pays && s.pays.length) s.pays.forEach(function (x) { p.row(x.name, num(x.amt)); });
    else if (s.pay === 'ewallet') p.row('E-wallet', num(s.tend));
    if (cashOf(s) > 0 || (!s.pays && s.pay === 'cash')) { p.row('Cash', num(s.tend)); p.row('Change', num(s.change)); }
    if (s.ref) p.center('REFUNDED', { b: true });
    slipFoot(p, fmtDT(s.t), s.rno || '#' + (sales.sales.indexOf(s) + 1));
  }
  // order slip printed before payment, from the POS cart
  function orderReceipt(p, cartLines, o) {
    var cur = shifts.cur, total = 0;
    cartLines.forEach(function (l) { var u = Number(l.price) || 0; (l.addons || []).forEach(function (a) { u += Number(a.p) || 0; }); total += u * l.qty; });
    slipHead(p, { type: o.type, emp: cur ? cur.openedBy : '', pos: cur && cur.pos ? cur.pos : posName() });
    slipLines(p, cartLines);
    p.rule('.');
    p.row('Total', num(total), { b: true });
    p.center('Not yet paid');
    slipFoot(p, fmtDT(Date.now()), '');
  }

  window.MBShift = {
    num: num, sg: sg, fmtDT: fmtDT, fmtTime: fmtTime, phDate: phDate, r2: r2, cupName: cupName, lidName: lidName,
    sales: function () { return sales.sales; }, salesOf: salesOf, makeSale: makeSale, cashOf: cashOf, addSale: addSale, refund: refund, deleteSale: deleteSale, deleteShift: deleteShift,
    shifts: function () { return shifts; }, saveShifts: saveShifts, index: buildIndex, day: day, month: month, deductInventory: deductInventory, settleShift: settleShift, current: current, start: start, close: close, report: report, lastActual: lastActual,
    lastStart: lastStart, saveSales: saveSales, posName: posName, setPosName: setPosName, lastUser: lastUser, countedCash: countedCash, expensesBetween: expensesBetween,
    reportReceipt: reportReceipt, saleReceipt: saleReceipt, orderReceipt: orderReceipt, typeText: typeText, cafe: cafe
  };
})();
