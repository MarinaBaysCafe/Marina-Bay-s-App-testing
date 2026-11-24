/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* Receipt numbers, order numbers and shift ids. Runs the real shift-lib.js with a fake storage. Run with:  node tests-shift.js */
var fs = require('fs'), path = require('path');
var store = {}, failKey = null;
global.localStorage = { getItem: function (k) { return k in store ? store[k] : null; }, setItem: function (k, v) { if (k === failKey) throw new Error('QuotaExceededError'); store[k] = String(v); }, removeItem: function (k) { delete store[k]; } };
global.sessionStorage = global.localStorage; global.window = global; global.navigator = {};
global.document = { addEventListener: function () {}, getElementById: function () { return null; }, createElement: function () { return { style: {} }; }, body: {}, readyState: 'complete' };
function boot(pre) {
  store = {}; failKey = null; delete global.MBCloud;
  Object.keys(pre || {}).forEach(function (k) { store[k] = JSON.stringify(pre[k]); });
  ['menu-default.js', 'inventory-default.js', 'app-data.js', 'shift-lib.js'].forEach(function (f) { (0, eval)(fs.readFileSync(path.join(__dirname, f), 'utf8')); });
  return global.MBShift;
}
var line = { name: 'Latte', opt: '16 oz Iced', price: 100, qty: 1, addons: [] };
function sell(S) { var s = S.makeSale([line], { disc: 0, discs: [], splits: [{ id: 'cash', name: 'Cash', cash: true, amt: 100 }], type: 'dine' }); return S.addSale(s) ? s : null; }
function eq(a, b) { var x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error('expected ' + y + ' but got ' + x); }
var tests = [];
function test(n, f) { tests.push({ n: n, f: f }); }

test('receipt numbers go up by one', function () {
  var S = boot(); S.start(500, 'Ana');
  eq([sell(S).rno, sell(S).rno, sell(S).rno], ['#1-1', '#1-2', '#1-3']);
});
test('a deleted order never gives its receipt number to the next order', function () {
  var S = boot(); S.start(500, 'Ana'); sell(S); sell(S); var last = sell(S);
  S.deleteSale(last.id); eq(sell(S).rno, '#1-4');
});
test('numbers continue after all sales are wiped (reset) or restored', function () {
  var S = boot(); S.start(500, 'Ana'); sell(S); sell(S);
  var dev = store.marinabays_device_v1, shifts = store.marinabays_shifts_v1;
  store = { marinabays_device_v1: dev, marinabays_shifts_v1: shifts };
  S = boot2(S, store); eq(sell(S).rno, '#1-3');
});
function boot2(S, keep) { var pre = {}; Object.keys(keep).forEach(function (k) { pre[k] = JSON.parse(keep[k]); }); return boot(pre); }
test('numbers continue after orders saved by the old numbering', function () {
  var S = boot({ marinabays_sales_v1: { sales: [{ id: 'a', rno: '#1-57', t: 1, shift: 1, n: 5, lines: [], net: 1, gross: 1, disc: 0 }] } });
  S.start(500, 'Ana'); eq(sell(S).rno, '#1-58');
});
test('a sale that could not be saved does not use up its number', function () {
  var S = boot(); S.start(500, 'Ana'); sell(S);
  failKey = 'marinabays_sales_v1';
  var s = S.makeSale([line], { disc: 0, discs: [], splits: [{ id: 'cash', name: 'Cash', cash: true, amt: 100 }], type: 'dine' });
  eq(S.addSale(s), false); failKey = null; eq(sell(S).rno, '#1-2');
});
test('order numbers inside a shift are not reused after a delete in the middle', function () {
  var S = boot(); S.start(500, 'Ana'); var a = sell(S), b = sell(S), c = sell(S);
  eq([a.n, b.n, c.n], [1, 2, 3]); S.deleteSale(b.id); eq(sell(S).n, 4);
});
test('every new order remembers which shift it belongs to', function () {
  var S = boot(); var cur = S.start(500, 'Ana'); if (!cur.id) throw new Error('shift has no id'); eq(sell(S).sid, cur.id);
});
test('two orders with the same receipt number: the earlier keeps it, the later gets a new one', function () {
  var S = boot({ marinabays_sales_v1: { sales: [
    { id: 'a', rno: '#1-5', t: 10, shift: 1, n: 1, lines: [], net: 1, gross: 1, disc: 0 }, { id: 'b', rno: '#1-5', t: 20, shift: 1, n: 2, lines: [], net: 1, gross: 1, disc: 0 }, { id: 'c', rno: '#1-6', t: 30, shift: 1, n: 3, lines: [], net: 1, gross: 1, disc: 0 }] } });
  eq(S.renumber('#1-5'), 1);
  var m = {}; S.sales().forEach(function (s) { m[s.id] = s.rno; }); eq(m, { a: '#1-5', b: '#1-7', c: '#1-6' });
  eq(S.renumber('#1-5'), 0);
});
test('sync warning: none without cloud, shows the count when changes are waiting or the phone is offline', function () {
  var S = boot(); eq(S.syncWarning('start'), '');
  global.MBCloud = { configured: true, status: function () { return { user: 'a@x.com', state: 'synced' }; }, pending: function () { return { sales: 2, shifts: 0 }; } };
  if (!/2 changes/.test(S.syncWarning('start'))) throw new Error('no count: ' + S.syncWarning('start'));
  if (!/End the shift/.test(S.syncWarning('close'))) throw new Error('close text');
  global.MBCloud.pending = function () { return {}; }; eq(S.syncWarning('start'), '');
  global.MBCloud.status = function () { return { user: 'a@x.com', state: 'offline' }; };
  if (!/offline/.test(S.syncWarning('start'))) throw new Error('offline text');
  global.MBCloud.status = function () { return { user: null, state: 'signedout' }; }; eq(S.syncWarning('start'), '');
});

function rec() { var out = []; var p = new Proxy({}, { get: function (t, k) { return function () { out.push(k + ':' + [].slice.call(arguments).join('|')); }; } }); p.out = out; return { p: p, out: out }; }
var Mn = require('./money.js'); global.MBMoney = Mn;
test('a discount chosen on one item is saved on that line and on the receipt', function () {
  var S = boot(); S.start(500, 'Ana');
  var cart = [{ name: 'Latte', opt: '16 oz Iced', price: 120, qty: 1, addons: [], ld: { kind: 'pct', value: 20, id: 'senior', name: 'Senior Citizen' } }, { name: 'Cake', opt: '', price: 80, qty: 1, addons: [] }];
  var od = Mn.orderDiscount({ lines: cart.map(function (l) { return { totalC: Mn.toC(l.price * l.qty), ld: l.ld || null }; }), presets: [], manual: null, rules: {} });
  var s = S.makeSale(cart, { disc: Mn.fromC(od.totalC), discs: od.recs.map(function (r) { return { id: r.id, name: r.name, pct: r.pct, amt: Mn.fromC(r.amtC) }; }), lineDisc: od.lineC.map(Mn.fromC), splits: [{ id: 'cash', name: 'Cash', cash: true, amt: 176 }], type: 'dine' });
  eq([s.gross, s.disc, s.net], [200, 24, 176]);
  eq([s.lines[0].disc, s.lines[0].dk, s.lines[0].dv, s.lines[0].dn, s.lines[0].di], [24, 'pct', 20, 'Senior Citizen', 'senior']);
  eq(s.lines[1].disc, undefined);
  var r = rec(); S.saleReceipt(r.p, s);
  var row = r.out.filter(function (x) { return /Senior Citizen 20%\|-24\.00/.test(x); }); eq(row.length, 1);
});
test('an order with no line discount prints the same as before', function () {
  var S = boot(); S.start(500, 'Ana'); var s = sell(S), r = rec(); S.saleReceipt(r.p, s);
  eq(r.out.filter(function (x) { return /Discount/.test(x); }), []);
  eq(s.lines[0].disc, undefined);
});

var fail = 0;
tests.forEach(function (t) { try { t.f(); console.log('PASS ' + t.n); } catch (e) { fail++; console.log('FAIL ' + t.n + '\n     ' + e.message); } });
console.log(fail ? fail + ' failed' : 'all ' + tests.length + ' passed'); process.exit(fail ? 1 : 0);
