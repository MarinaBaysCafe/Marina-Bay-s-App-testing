/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* Storage meter and warning. Run with:  node tests-storage.js */
var fs = require('fs'), path = require('path');
function Store() { this.m = {}; }
Store.prototype.getItem = function (k) { return k in this.m ? this.m[k] : null; };
Store.prototype.setItem = function (k, v) { this.m[k] = String(v); };
Store.prototype.key = function (i) { return Object.keys(this.m)[i] || null; };
Object.defineProperty(Store.prototype, 'length', { get: function () { return Object.keys(this.m).length; } });
var toasts;
function boot() {
  global.localStorage = new Store(); global.sessionStorage = new Store(); global.window = global; toasts = [];
  global.MBData = { toast: function (m) { toasts.push(m); } };
  (0, eval)(fs.readFileSync(path.join(__dirname, 'storage-guard.js'), 'utf8'));
  return global.MBStorage;
}
function fill(chars) { localStorage.setItem('marinabays_sales_v1', new Array(chars - 'marinabays_sales_v1'.length + 1).join('x')); }
function eq(a, b) { var x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error('expected ' + y + ' but got ' + x); }
var tests = [];
function test(n, f) { tests.push({ n: n, f: f }); }

test('usage counts keys and values and lists the biggest first', function () {
  var G = boot(); localStorage.setItem('a', '12345'); localStorage.setItem('bb', '1');
  var u = G.usage(); eq(u.used, 1 + 5 + 2 + 1); eq(u.top[0].key, 'a'); eq(u.pct, 0);
});
test('no message below 70 percent', function () { var G = boot(); fill(3000000); eq(G.warn(), false); eq(toasts.length, 0); });
test('from 70 percent: one message, not repeated the same day', function () {
  var G = boot(); fill(3750000); var m = G.warn(); if (!/75%/.test(m)) throw new Error('message: ' + m);
  G.warn(); sessionStorage.setItem('mb_store_warn', ''); G.warn(); eq(toasts.length, 1);
});
test('from 90 percent: a stronger message', function () {
  var G = boot(); fill(4600000); var m = G.warn(); if (!/almost full/.test(m)) throw new Error('message: ' + m); eq(toasts.length, 1);
});
test('persist answers null when the browser cannot tell', function () {
  var G = boot(); global.navigator = {}; return G.persist().then(function (p) { eq(p, null); });
});

(async function () {
  var fail = 0;
  for (var i = 0; i < tests.length; i++) { try { await tests[i].f(); console.log('PASS ' + tests[i].n); } catch (e) { fail++; console.log('FAIL ' + tests[i].n + '\n     ' + e.message); } }
  console.log(fail ? fail + ' failed' : 'all ' + tests.length + ' passed'); process.exit(fail ? 1 : 0);
})();
