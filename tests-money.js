/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* Runs in the browser (tests.html) and in Node: node tests-money.js */
(function () {
  var isNode = typeof module !== 'undefined' && module.exports;
  var M = isNode ? require('./money.js') : window.MBMoney;
  var results = [];
  function test(name, fn) { try { fn(); results.push({ name: name, ok: true }); } catch (e) { results.push({ name: name, ok: false, err: e.message }); } }
  function eq(got, want) { var a = JSON.stringify(got), b = JSON.stringify(want); if (a !== b) throw new Error('expected ' + b + ' but got ' + a); }

  test('toC: half-centavo and float noise', function () {
    eq(M.toC(1.005), 101); eq(M.toC(1.15), 115); eq(M.toC(0.1 + 0.2), 30); eq(M.toC(19.99), 1999);
    eq(M.toC('12.50'), 1250); eq(M.toC(-2.5), -250); eq(M.toC('abc'), 0); eq(M.toC(null), 0);
  });
  test('fmt', function () { eq(M.fmt(123456), '1,234.56'); eq(M.fmt(-5), '-0.05'); eq(M.fmt(0), '0.00'); eq(M.fmt(100000000), '1,000,000.00'); });
  test('pctC: half up on odd percents', function () {
    eq(M.pctC(29000, 20), 5800); eq(M.pctC(380, 7.5), 29); eq(M.pctC(12345, 10), 1235); eq(M.pctC(0, 20), 0);
  });
  test('pctC agrees with the old peso rounding on whole-peso prices at 10 and 20 percent', function () {
    for (var p = 1; p <= 2000; p++) [10, 20].forEach(function (pct) {
      var old = Math.round(p * pct / 100 * 100); eq(M.pctC(p * 100, pct), old);
    });
  });
  test('split adds up exactly', function () {
    eq(M.split(1000, [1, 1, 1]), [334, 333, 333]); eq(M.split(100, [0, 0]), [100, 0]); eq(M.split(2600, [12000, 14000]), [1200, 1400]);
    var seed = 7; function rnd(n) { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; }
    for (var t = 0; t < 2000; t++) {
      var w = [], k = 1 + rnd(6), total = rnd(100000), sum = 0, i;
      for (i = 0; i < k; i++) w.push(rnd(50000));
      var parts = M.split(total, w); for (i = 0; i < k; i++) { sum += parts[i]; if (parts[i] < 0) throw new Error('negative part'); }
      if (sum !== total) throw new Error('parts ' + sum + ' not ' + total);
    }
  });
  test('vatSplit', function () { eq(M.vatSplit(11200, 12), { net: 10000, vat: 1200 }); eq(M.vatSplit(29000, 12), { net: 25893, vat: 3107 }); });
  test('exemptDiscount: VAT-registered takes VAT off first', function () {
    eq(M.exemptDiscount(29000, { vatRegistered: true }), { base: 25893, vatRemoved: 3107, discount: 5179, due: 20714 });
  });
  test('exemptDiscount: not VAT-registered discounts the price', function () {
    eq(M.exemptDiscount(29000, { vatRegistered: false }), { base: 29000, vatRemoved: 0, discount: 5800, due: 23200 });
  });
  test('stackPct', function () {
    eq(M.stackPct([20, 20], false), 20); eq(M.stackPct([20, 20], true), 40); eq(M.stackPct([70, 60], true), 100); eq(M.stackPct([], true), 0);
  });
  test('lineDiscount never goes above the line', function () {
    eq(M.lineDiscount(5000, 'fixed', 80), 5000); eq(M.lineDiscount(5000, 'fixed', 10), 1000); eq(M.lineDiscount(5000, 'pct', 20), 1000); eq(M.lineDiscount(5000, 'pct', 150), 5000);
  });

  function od(lines, presets, manual, rules) { return M.orderDiscount({ lines: lines, presets: presets || [], manual: manual || null, rules: rules }); }
  function sumRecs(r) { var t = 0; r.recs.forEach(function (x) { t += x.amtC; }); return t; }
  var L = function (c, ld) { return { totalC: c, ld: ld || null }; };
  test('orderDiscount: no discount chosen', function () { var r = od([L(12000), L(14000)]); eq(r.totalC, 0); eq(r.recs, []); eq(r.grossC, 26000); });
  test('orderDiscount: same answers as before when no line discount is used', function () {
    var r = od([L(12000), L(14000)], [{ id: 'senior', name: 'Senior', pct: 20, scope: 'all' }]); eq(r.totalC, 5200); eq(sumRecs(r), 5200);
    var r2 = od([L(12000), L(14000)], [{ id: 'pwd', name: 'PWD', pct: 20, scope: 0 }]); eq(r2.totalC, 2400);
    var r3 = od([L(10000)], [], { kind: 'peso', value: 30 }); eq(r3.totalC, 3000);
    var r4 = od([L(10000)], [], { kind: 'pct', value: 15 }); eq(r4.totalC, 1500);
  });
  test('orderDiscount: a discount on one line', function () {
    var r = od([L(12000, { kind: 'pct', value: 20, id: 'senior', name: 'Senior' }), L(14000)]); eq(r.lineC, [2400, 0]); eq(r.totalC, 2400); eq(r.recs[0].kind, 'line'); eq(r.recs[0].line, 0);
  });
  test('orderDiscount: a fixed peso discount cannot go above its line', function () {
    var r = od([L(5000, { kind: 'fixed', value: 80 })]); eq(r.lineC, [5000]); eq(r.totalC, 5000);
  });
  test('orderDiscount: order-level discounts are taken from what is left after line discounts', function () {
    var r = od([L(10000, { kind: 'pct', value: 50 }), L(10000)], [{ id: 'emp', name: 'Employee', pct: 10, scope: 'all' }]);
    eq(r.totalC, 5000 + 1500); eq(sumRecs(r), r.totalC);
  });
  test('orderDiscount: never more than the order, and the parts always add up', function () {
    var r = od([L(10000, { kind: 'pct', value: 60 })], [{ id: 'a', name: 'A', pct: 100, scope: 'all' }], { kind: 'peso', value: 500 });
    eq(r.totalC, 10000); eq(sumRecs(r), 10000); r.recs.forEach(function (x) { if (x.amtC < 0) throw new Error('negative'); });
  });
  test('orderDiscount: presets add up when stacking is on, only the biggest counts when it is off', function () {
    var P = [{ id: 'pwd', name: 'PWD', pct: 20, scope: 'all' }, { id: 'sc', name: 'Senior', pct: 20, scope: 'all' }, { id: 'emp', name: 'Employee', pct: 10, scope: 'all' }];
    var on = od([L(29000)], P, null, { stack: true }), off = od([L(29000)], P, null, { stack: false });
    eq(on.totalC, 14500); eq(sumRecs(on), 14500); eq(off.totalC, 5800); eq(sumRecs(off), 5800);
    eq(off.recs.length, 1);
  });
  test('orderDiscount: stays exact on odd amounts (the parts add up to the total)', function () {
    var seed = 11; function rnd(n) { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; }
    for (var t = 0; t < 1500; t++) {
      var lines = [], k = 1 + rnd(4), i;
      for (i = 0; i < k; i++) lines.push(L(100 + rnd(40000), rnd(2) ? { kind: rnd(2) ? 'pct' : 'fixed', value: 1 + rnd(60), id: 'x', name: 'X' } : null));
      var pre = [{ id: 'a', name: 'A', pct: [7.5, 10, 12.5, 20][rnd(4)], scope: 'all' }, { id: 'b', name: 'B', pct: 20, scope: rnd(k) }];
      var r = od(lines, pre, rnd(2) ? { kind: 'peso', value: rnd(300) } : { kind: 'pct', value: rnd(40) }, { stack: !!rnd(2) });
      if (sumRecs(r) !== r.totalC) throw new Error('recs ' + sumRecs(r) + ' total ' + r.totalC);
      if (r.totalC > r.grossC || r.totalC < 0) throw new Error('total out of range');
    }
  });

  var fails = results.filter(function (r) { return !r.ok; }).length;
  if (isNode) {
    results.forEach(function (r) { console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + (r.ok ? '' : '  ' + r.err)); });
    console.log(fails ? fails + ' failed' : 'all ' + results.length + ' passed');
    process.exit(fails ? 1 : 0);
  } else {
    var out = document.getElementById('out'); out.innerHTML = '';
    var h = document.createElement('p'); h.className = fails ? 'bad' : 'good';
    h.textContent = fails ? fails + ' of ' + results.length + ' tests failed' : 'All ' + results.length + ' tests passed'; out.appendChild(h);
    results.forEach(function (r) { var d = document.createElement('div'); d.className = r.ok ? 'good' : 'bad'; d.textContent = (r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.ok ? '' : '  ' + r.err); out.appendChild(d); });
  }
})();
