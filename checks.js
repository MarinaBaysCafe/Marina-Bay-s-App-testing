/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved.
   Data checks. Looks for records that do not make sense and offers choices for each one.
   Nothing is changed unless the person taps a choice. "Keep it" hides that problem on this device. */
(function () {
  var S = window.MBShift, D = window.MBData;
  var EXP_KEY = 'marinabays_expenses_v1', MONEY_KEY = 'marinabays_money_v1', OK_KEY = 'marinabays_checks_ok_v1';
  var N = D.peso;

  function load(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); if (v) return v; } catch (e) {} return d; }
  function okSet() { return load(OK_KEY, {}); }
  function keep(id) { var o = okSet(); o[id] = 1; try { localStorage.setItem(OK_KEY, JSON.stringify(o)); } catch (e) {} }
  function expStore() { return load(EXP_KEY, { days: {} }); }
  function saveExp(st) { localStorage.setItem(EXP_KEY, JSON.stringify(st)); }
  function dayName(k) { return new Date(k + 'T00:00:00Z').toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'short', day: 'numeric' }); }
  function median(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : 0; }

  function find() {
    var out = [], ok = okSet(), sh = S.shifts(), sales = S.sales(), today = S.phDate(Date.now()), cur = sh.cur;
    function add(i) { if (!ok[i.id]) out.push(i); }

    /* 1. a shift that has been open for too long */
    if (cur && Date.now() - cur.openedAt > 16 * 3600 * 1000) {
      var mine = S.salesOf(cur.no), lastT = mine.length ? mine[mine.length - 1].t : cur.openedAt;
      add({ id: 'stale-' + cur.no, title: 'Shift ' + cur.no + ' is still open',
        detail: 'It was opened ' + S.fmtDT(cur.openedAt) + ', more than 16 hours ago. It may have been forgotten.',
        choices: [
          { label: 'End it at the last sale (' + S.fmtTime(lastT) + ')', ask: 'Actual cash in the drawer for Shift ' + cur.no + '?', run: function (v) { S.close(cur.openedBy, parseFloat(v), lastT); } },
          { label: 'Keep it open', keep: true }] });
    }

    /* 2. shifts with a big cash difference */
    sh.hist.forEach(function (r) {
      if (r.diff != null && Math.abs(r.diff) >= 100) add({ id: 'diff-' + r.no, title: 'Shift ' + r.no + ' cash is off by ' + S.sg(r.diff),
        detail: 'Expected ' + N(r.expected) + ', counted ' + N(r.actual) + ' on ' + dayName(S.phDate(r.closedAt || r.openedAt)) + '.',
        choices: [{ label: 'Open the report', href: 'shift.html?no=' + r.no }, { label: 'It is fine, hide this', keep: true }] });
    });

    /* 3. the starting cash is not the usual one */
    var cnt = {}; sh.hist.forEach(function (r) { cnt[r.startCash] = (cnt[r.startCash] || 0) + 1; });
    var usual = null, best = 0; Object.keys(cnt).forEach(function (k) { if (cnt[k] > best) { best = cnt[k]; usual = +k; } });
    if (sh.hist.length >= 3 && best / sh.hist.length >= 0.6) sh.hist.forEach(function (r) {
      if (r.startCash !== usual) add({ id: 'start-' + r.no, title: 'Shift ' + r.no + ' started with ' + N(r.startCash),
        detail: 'Most shifts start with ' + N(usual) + '. A different amount changes the expected cash.',
        choices: [{ label: 'Change it to ' + N(usual), run: function () {
          var old = r.startCash; r.startCash = usual; r.expected = S.r2(r.expected + usual - old);
          if (r.actual != null) { r.diff = S.r2(r.actual - r.expected); r.excess = S.r2(r.actual - usual); } S.saveShifts(); } },
          { label: 'Keep ' + N(r.startCash), keep: true }] });
    });

    /* 4. orders that do not add up */
    var noShift = sales.filter(function (s) { return s.shift == null || (!(cur && cur.no === s.shift) && !sh.hist.some(function (h) { return h.no === s.shift; })); });
    if (noShift.length) add({ id: 'noshift-' + noShift.length + '-' + noShift[0].id, title: noShift.length + (noShift.length === 1 ? ' order has' : ' orders have') + ' no shift',
      detail: 'Sales made when no shift was open. They are in the daily totals but not in any shift report.',
      choices: [{ label: 'Delete ' + (noShift.length === 1 ? 'it' : 'them'), danger: 1, run: function () { noShift.forEach(function (s) { sales.splice(sales.indexOf(s), 1); }); S.saveSales(); } }, { label: 'Keep', keep: true }] });
    sales.forEach(function (s) {
      if (!s.ref && (s.net <= 0 || !s.lines || !s.lines.length)) add({ id: 'zero-' + s.id, title: 'Order ' + s.n + ' on ' + dayName(S.phDate(s.t)) + ' is ' + N(s.net),
        detail: 'An order with no items or no amount.',
        choices: [{ label: 'Delete order', danger: 1, run: function () { sales.splice(sales.indexOf(s), 1); S.saveSales(); } }, { label: 'Keep', keep: true }] });
      var ca = S.cashOf(s);
      if (!s.ref && ca > 0 && s.tend + 0.005 < ca) add({ id: 'tend-' + s.id, title: 'Order ' + s.n + ' on ' + dayName(S.phDate(s.t)) + ': cash received is less than the bill',
        detail: 'Cash received ' + N(s.tend) + ' but the cash part of the bill is ' + N(ca) + '.',
        choices: [{ label: 'Set cash received to ' + N(ca), run: function () { s.tend = ca; s.change = 0; S.saveSales(); } }, { label: 'Keep', keep: true }] });
    });

    /* 5. expenses that look wrong */
    var st = expStore(), days = Object.keys(st.days || {}).sort(), all = [];
    days.forEach(function (k) { (st.days[k] || []).forEach(function (e) { all.push({ k: k, e: e }); }); });
    var med = median(all.map(function (x) { return +x.e.amt || 0; }));
    function dropExp(k, e) { var st2 = expStore(); st2.days[k] = (st2.days[k] || []).filter(function (x) { return x.id !== e.id; }); if (!st2.days[k].length) delete st2.days[k]; saveExp(st2); }
    all.forEach(function (x) {
      var e = x.e, big = e.amt >= 10000 || (all.length >= 8 && e.amt >= med * 15 && e.amt >= 2000);
      if (big) add({ id: 'big-' + e.id, title: N(e.amt) + ' ' + e.cat + ' on ' + dayName(x.k) + ' looks very large',
        detail: (e.note ? e.note + '. ' : '') + 'Much more than the usual expense. Maybe an extra zero.',
        choices: [{ label: 'Change it', href: 'expenses.html?date=' + x.k }, { label: 'Delete', danger: 1, run: function () { dropExp(x.k, e); } }, { label: 'It is right', keep: true }] });
      if (x.k > today) add({ id: 'future-' + e.id, title: 'Expense ' + N(e.amt) + ' is dated ' + dayName(x.k) + ', in the future',
        detail: e.cat + (e.note ? ' · ' + e.note : ''),
        choices: [{ label: 'Move to today', run: function () { var s2 = expStore(); s2.days[x.k] = (s2.days[x.k] || []).filter(function (z) { return z.id !== e.id; }); if (!s2.days[x.k].length) delete s2.days[x.k]; (s2.days[today] = s2.days[today] || []).push(e); saveExp(s2); } },
          { label: 'Delete', danger: 1, run: function () { dropExp(x.k, e); } }, { label: 'Keep', keep: true }] });
    });
    days.forEach(function (k) {
      var seen = {};
      (st.days[k] || []).forEach(function (e) {
        var key = [e.cat, e.amt, e.src, e.note || ''].join('|'), first = seen[key];
        if (first && Math.abs((e.t || 0) - (first.t || 0)) < 10 * 60 * 1000) add({ id: 'dup-' + e.id, title: 'Possible double entry: ' + N(e.amt) + ' ' + e.cat + ' on ' + dayName(k),
          detail: 'Same category, amount and note entered twice within 10 minutes.',
          choices: [{ label: 'Delete the extra one', danger: 1, run: function () { dropExp(k, e); } }, { label: 'Both are real', keep: true }] });
        else seen[key] = e;
      });
    });

    /* 6. the money counter does not match the shift's cash */
    var money = load(MONEY_KEY, {});
    Object.keys(money).forEach(function (k) {
      var c = S.countedCash(k), cl = sh.hist.filter(function (h) { return S.phDate(h.closedAt || h.openedAt) === k && h.actual != null; });
      if (c > 0 && cl.length === 1 && Math.abs(c - cl[0].actual) >= 1 && !(cur && S.phDate(cur.openedAt) === k)) {
        var h = cl[0];
        add({ id: 'count-' + k + '-' + h.no + '-' + c + '-' + h.actual, title: 'Money counter and Shift ' + h.no + ' disagree on ' + dayName(k),
          detail: 'The counter says ' + N(c) + ' but the shift was closed with ' + N(h.actual) + '.',
          choices: [{ label: 'Use the counter: ' + N(c), run: function () { h.actual = c; h.diff = S.r2(c - h.expected); h.excess = S.r2(c - h.startCash); S.saveShifts(); } },
            { label: 'Keep the shift: ' + N(h.actual), keep: true }] });
      }
    });
    return out;
  }

  window.MBChecks = { find: find, keep: keep, count: function () { try { return find().length; } catch (e) { return 0; } } };
})();
