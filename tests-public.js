/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* The public menu copy and the QR code. Run with:  node tests-public.js */
var fs = require('fs'), path = require('path'), M = require('./menu-snapshot.js');
var qrcode = (0, eval)(fs.readFileSync(path.join(__dirname, 'qrcode.js'), 'utf8') + '\n;qrcode');
function eq(a, b) { var x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error('expected ' + y + ' but got ' + x); }
var menu = {
  categories: [{ id: 'c1', name: 'Coffee', group: 'Drinks', note: 'Must try!', sizes: ['16 oz'], lid: 'flat', cost: 5 }, { id: 'c2', name: 'Empty', group: 'Drinks', note: '', sizes: [], lid: 'none' }, { id: 'c3', name: 'Snacks', group: 'Food', note: '' }],
  items: [
    { id: 'i1', cat: 'c1', name: 'Latte', desc: 'Espresso and milk', best: true, soldOut: false, check: false, note: 'secret supplier note', cost: 41.5, recipe: [{ id: 'x', qty: 2 }], stock: 12, options: [{ label: '16 oz iced', price: 120, cost: 30 }, { label: '22 oz iced', price: '140' }] },
    { id: 'i2', cat: 'c1', name: 'Mocha', desc: '', best: false, soldOut: true, check: false, options: [{ label: 'Regular', price: 130 }] },
    { id: 'i3', cat: 'c1', name: 'Price check me', desc: '', check: true, options: [{ label: 'Regular', price: 1 }] },
    { id: 'i4', cat: 'c3', name: 'Bad price', desc: '', options: [{ label: 'Regular', price: 'abc' }, { label: 'Big', price: 55.5 }] },
    { id: 'i5', cat: 'c3', name: '<img src=x onerror=alert(1)>', desc: 'line one\nline two', options: [{ label: 'Regular', price: 10 }] }
  ],
  addonGroups: [{ id: 'g1', name: 'Extras', cats: ['c1', 'c2'], items: [{ id: 'a1', name: 'Extra shot', price: 30, cost: 8 }, { id: 'a2', name: 'Free?', price: 'x' }] }, { id: 'g2', name: 'Only empty', cats: ['c2'], items: [{ name: 'Nothing', price: 1 }] }]
};
var tests = [];
function test(n, f) { tests.push({ n: n, f: f }); }

test('only whitelisted fields leave the cafe: no cost, recipe, stock, internal note, lid or sizes', function () {
  var r = M.build(menu, { name: 'Marina Bay', note: 'Hello' }), s = r.json;
  ['cost', 'recipe', 'stock', 'secret supplier', 'lid', 'sizes', '"check"'].forEach(function (w) { if (s.indexOf(w) !== -1) throw new Error('leaked: ' + w); });
  var allowed = { v: 1, name: 1, note: 1, cats: 1, addons: 1, id: 1, n: 1, g: 1, t: 1, i: 1, d: 1, b: 1, s: 1, o: 1, l: 1, p: 1, c: 1 };
  (function scan(x) { if (Array.isArray(x)) x.forEach(scan); else if (x && typeof x === 'object') Object.keys(x).forEach(function (k) { if (!allowed[k]) throw new Error('unexpected key ' + k); scan(x[k]); }); })(r.snap);
});
test('sold out and best seller are marked, plain size has no label, prices are numbers', function () {
  var r = M.build(menu), c = r.snap.cats[0];
  eq(c.i[0].b, 1); eq(c.i[1].s, 1); eq(c.i[1].o, [{ l: '', p: 130 }]); eq(c.i[0].o, [{ l: '16 oz iced', p: 120 }, { l: '22 oz iced', p: 140 }]);
});
test('items that need a price check are left out and counted; bad prices are dropped; empty sections are not shown', function () {
  var r = M.build(menu); eq(r.skipped, 1); eq(r.snap.cats.map(function (c) { return c.n; }), ['Coffee', 'Snacks']);
  eq(r.snap.cats[1].i[0].o, [{ l: 'Big', p: 55.5 }]); eq(r.items, 4);
});
test('add-on groups only for sections that are shown, and only valid ones', function () {
  var r = M.build(menu); eq(r.snap.addons, [{ n: 'Extras', c: ['c1'], i: [{ n: 'Extra shot', p: 30 }] }]);
});
test('text is kept as plain text and cleaned', function () {
  var r = M.build(menu); eq(r.snap.cats[1].i[1].d, 'line one line two'); eq(r.snap.cats[1].i[1].n, '<img src=x onerror=alert(1)>');
});
test('the fingerprint changes when a price changes and stays when nothing does', function () {
  var a = M.build(menu).json, b = M.build(menu).json; eq(M.hash(a), M.hash(b));
  var m2 = JSON.parse(JSON.stringify(menu)); m2.items[0].options[0].price = 125; if (M.hash(M.build(m2).json) === M.hash(a)) throw new Error('same');
});
test('parseRest accepts a good answer and refuses bad ones', function () {
  var good = { fields: { json: { stringValue: M.build(menu).json }, by: { stringValue: 'a@b.c' }, t: { timestampValue: '2026-11-24T01:02:03Z' } } };
  var r = M.parseRest(good); eq(r.snap.cats.length, 2); eq(r.t, '2026-11-24T01:02:03Z');
  eq(M.parseRest(null), null); eq(M.parseRest({}), null); eq(M.parseRest({ fields: { json: { stringValue: 'not json' } } }), null);
  eq(M.parseRest({ fields: { json: { stringValue: '{"v":2,"cats":[]}' } } }), null);
  eq(M.parseRest({ fields: { json: { stringValue: new Array(M.MAX_JSON + 5).join('a') } } }), null);
});
test('table label and peso format', function () {
  eq(M.tableLabel('5'), '5'); eq(M.tableLabel('A-12'), 'A-12'); eq(M.tableLabel('<b>'), ''); eq(M.tableLabel('1234567'), ''); eq(M.tableLabel(null), '');
  eq(M.peso(120), '\u20b1120'); eq(M.peso(55.5), '\u20b155.50'); eq(M.peso(1234.05), '\u20b11,234.05');
});
test('table lists: ranges, commas, labels, limits', function () {
  eq(M.tables('1-3'), ['1', '2', '3']); eq(M.tables('1, 3, A2'), ['1', '3', 'A2']); eq(M.tables(''), []); eq(M.tables('5-3'), []);
  eq(M.tables('2 2 2'), ['2']); eq(M.tables('<b> 4'), ['4']); eq(M.tables('1-200'), []); eq(M.tables('1-60').length, 60); eq(M.tables('1-60,70').length, 60);
});
test('QR drawing path covers exactly the dark squares', function () {
  var q = qrcode(0, 'M'); q.addData('https://example.com/menu-public.html'); q.make(); var n = q.getModuleCount(), dark = 0, r, c;
  for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (q.isDark(r, c)) dark++;
  var path = M.qrPath(function (a, b) { return q.isDark(a, b); }, n, 4), sum = 0, re = /h(\d+)v1/g, m;
  while ((m = re.exec(path))) sum += +m[1]; eq(sum, dark);
});
test('the QR library makes a stable code for the menu address', function () {
  var url = 'https://example.github.io/shop/menu-public.html?table=5', q = qrcode(0, 'M'); q.addData(url); q.make();
  var n = q.getModuleCount(); if (n < 21 || n > 80) throw new Error('size ' + n);
  var finder = true; for (var i = 0; i < 7; i++) { if (!q.isDark(0, i) || !q.isDark(i, 0)) finder = false; }
  eq(finder, true);
  var q2 = qrcode(0, 'M'); q2.addData(url); q2.make(); var a = '', b = '';
  for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) { a += q.isDark(r, c) ? 1 : 0; b += q2.isDark(r, c) ? 1 : 0; }
  eq(a, b);
});
var fail = 0;
tests.forEach(function (t) { try { t.f(); console.log('PASS ' + t.n); } catch (e) { fail++; console.log('FAIL ' + t.n + '\n     ' + e.message); } });
console.log(fail ? fail + ' failed' : 'all ' + tests.length + ' passed'); process.exit(fail ? 1 : 0);
