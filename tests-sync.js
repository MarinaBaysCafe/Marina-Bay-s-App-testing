/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* Two-phone sync simulation. Runs the real cloud.js against a fake in-memory Firestore. Run with:  node tests-sync.js */
var vm = require('vm'), fs = require('fs'), path = require('path');
var CLOUD = fs.readFileSync(path.join(__dirname, 'cloud.js'), 'utf8');
var INV = 'marinabays_inventory_v1', EXP = 'marinabays_expenses_v1';
var tick = function (ms) { return new Promise(function (r) { setTimeout(r, ms || 15); }); };

function makeDb() { return { colls: {}, clock: 1000, listeners: [], writes: 0 }; }
function coll(db, c) { return db.colls[c] || (db.colls[c] = {}); }
function put(db, c, d) {
  db.clock += 1; db.writes += 1;
  coll(db, c)[d.id] = { v: d.data.v, d: d.data.d, by: d.data.by, s: db.clock };
  db.listeners.filter(function (l) { return l.coll === c; }).forEach(function (l) { deliver(l, [{ id: d.id, v: d.data.v, d: d.data.d ? 1 : 0, s: db.clock }]); });
}
function deliver(l, docs) {
  if (!l.phone.online || l.phone.hold) { l.queue = l.queue.concat(docs); return; }
  setTimeout(function () { l.cb(docs, false); }, 0);
}
function makeBackend(db, phone) {
  return {
    init: function () { return Promise.resolve(); },
    onAuth: function (cb) { setTimeout(function () { cb({ email: phone.name + '@x.com', uid: phone.name }); }, 0); },
    signIn: function () { return Promise.resolve(); }, signInGoogle: function () { return Promise.resolve(); }, signOut: function () { return Promise.resolve(); },
    setMany: async function (c, docs) { if (!phone.online) throw new Error('Failed to get document because the client is offline.'); docs.forEach(function (d) { put(db, c, d); }); },
    publishMenu: async function (json, email) { if (!phone.online) throw new Error('Failed to get document because the client is offline.'); db.public = { json: json, by: email }; },
    setManyChecked: async function (c, docs, H) {
      if (!phone.online) throw new Error('Failed to get document because the client is offline.');
      var res = { written: [], conflicts: [] };
      docs.forEach(function (d) {
        var x = coll(db, c)[d.id];
        if (x && !(H(String(x.v || '')) === d.expect.h && (x.d ? 1 : 0) === d.expect.d)) res.conflicts.push({ id: d.id, v: x.v, d: x.d ? 1 : 0, s: x.s });
        else { put(db, c, d); res.written.push(d.id); }
      });
      return res;
    },
    listen: function (c, since, cb) {
      var l = { coll: c, cb: cb, phone: phone, queue: [] }; db.listeners.push(l);
      var docs = Object.keys(coll(db, c)).filter(function (id) { return coll(db, c)[id].s >= (since || 0); }).map(function (id) { var x = coll(db, c)[id]; return { id: id, v: x.v, d: x.d ? 1 : 0, s: x.s }; });
      deliver(l, docs.length || !since ? docs : []);
      if (!docs.length) setTimeout(function () { if (phone.online && !phone.hold) cb([], false); }, 0);
      return function () { db.listeners = db.listeners.filter(function (x) { return x !== l; }); };
    }
  };
}
function makePhone(name, db, opts) {
  opts = opts || {};
  var phone = { name: name, online: true, hold: false, failKey: null, reloads: 0, handlers: {}, btn: { onclick: null }, els: [] };
  function Store() { this.m = {}; }
  Store.prototype.getItem = function (k) { return k in this.m ? this.m[k] : null; };
  Store.prototype.setItem = function (k, v) { if (phone.failKey === k) throw new Error('QuotaExceededError'); this.m[k] = String(v); };
  Store.prototype.removeItem = function (k) { delete this.m[k]; };
  var ls = new Store(); phone.ls = ls;
  Object.keys(opts.preload || {}).forEach(function (k) { ls.m[k] = JSON.stringify(opts.preload[k]); });
  ls.m.marinabays_cloud_on = '1';
  var sb = { Storage: Store, localStorage: ls, sessionStorage: new Store(), console: console, JSON: JSON, Date: Date, Math: Math, Promise: Promise, Object: Object, Array: Array, String: String, Number: Number, Error: Error, RegExp: RegExp,
             setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: function () {}, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN };
  sb.window = sb;
  sb.addEventListener = function (t, f) { phone.handlers[t] = f; };
  sb.location = { reload: function () { phone.reloads++; } };
  sb.MB_FIREBASE_CONFIG = { projectId: 'test' };
  sb.MBCloudBackend = makeBackend(db, phone);
  sb.document = {
    currentScript: { getAttribute: function (k) { return k === 'data-uses' ? (opts.uses || '') : null; } }, hidden: false, addEventListener: function () {},
    getElementById: function (id) { return phone.els.filter(function (e) { return e.id === id; })[0] || null; },
    createElement: function () { return { style: {}, id: '', querySelector: function () { return phone.btn; } }; },
    body: { appendChild: function (el) { phone.els.push(el); } }
  };
  vm.createContext(sb); vm.runInContext(CLOUD, sb);
  phone.cloud = sb.MBCloud;
  phone.get = function (k) { var v = ls.getItem(k); return v ? JSON.parse(v) : null; };
  phone.set = function (k, o) { ls.setItem(k, JSON.stringify(o)); };
  phone.goOffline = function () { phone.online = false; };
  phone.goOnline = function () { phone.online = true; phone.release(); };
  phone.release = function () { phone.hold = false; if (!phone.online) return; db.listeners.filter(function (l) { return l.phone === phone; }).forEach(function (l) { var last = {}; l.queue.forEach(function (d) { last[d.id] = d; }); var q = Object.keys(last).map(function (k) { return last[k]; }); l.queue = []; if (q.length) setTimeout(function () { l.cb(q, false); }, 0); }); };
  return phone;
}
async function settle(phones, rounds) {
  for (var i = 0; i < (rounds || 6); i++) { phones.forEach(function (p) { p.cloud.syncNow(); }); await tick(20); }
}
function pendingTotal(p) { var t = 0, o = p.cloud.pending(); Object.keys(o).forEach(function (k) { t += o[k]; }); return t; }
function days(p, day) { var o = p.get(EXP); return ((o && o.days && o.days[day]) || []).map(function (e) { return e.id; }).sort(); }
function qty(p, id) { var o = p.get(INV); var it = o && o.items.filter(function (i) { return i.id === id; })[0]; return it ? it.qty : undefined; }
function cloudDoc(db, c, id) { var x = coll(db, c)[id]; return x ? JSON.parse(x.v) : undefined; }
function eq(a, b) { var x = JSON.stringify(a), y = JSON.stringify(b); if (x !== y) throw new Error('expected ' + y + ' but got ' + x); }

var D1 = '2026-11-17';
var inv0 = function (q) { return { items: [{ id: 'cup', name: 'Cups', qty: q, unit: 'pcs' }, { id: 'lid', name: 'Lids', qty: 50, unit: 'pcs' }], countedOn: '', layout: 1 }; };
var exp0 = function (list) { var d = {}; d[D1] = list; return { days: d, cats: ['Food'], lastCat: '', lastSrc: 'cash' }; };
var E = function (id, amt) { return { id: id, amt: amt, cat: 'Food', note: '', src: 'cash', t: 1 }; };

async function pair(q, list, optsB) {
  var db = makeDb();
  var A = makePhone('A', db, { preload: (function () { var o = {}; o[INV] = inv0(q); o[EXP] = exp0(list); return o; })() });
  await settle([A]);
  var B = makePhone('B', db, optsB || {});
  await settle([A, B]);
  return { db: db, A: A, B: B };
}
var tests = [];
function test(name, fn) { tests.push({ name: name, fn: fn }); }

test('new phone downloads what another phone uploaded', async function () {
  var x = await pair(100, [E('e1', 10)]);
  eq(qty(x.B, 'cup'), 100); eq(days(x.B, D1), ['e1']);
});
test('two phones add expenses on the same day while offline: both are kept', async function () {
  var x = await pair(100, [E('e1', 10)]);
  x.A.goOffline(); x.B.goOffline();
  var a = x.A.get(EXP); a.days[D1].push(E('eA', 20)); x.A.set(EXP, a);
  var b = x.B.get(EXP); b.days[D1].push(E('eB', 30)); x.B.set(EXP, b);
  x.A.goOnline(); await settle([x.A, x.B]); x.B.goOnline(); await settle([x.A, x.B]);
  eq(days(x.A, D1), ['e1', 'eA', 'eB']); eq(days(x.B, D1), ['e1', 'eA', 'eB']);
  eq(cloudDoc(x.db, 'sync_expenses', 'day:' + D1).map(function (e) { return e.id; }).sort(), ['e1', 'eA', 'eB']);
});
test('one phone deletes an expense, the other adds one: the delete stays and the new one is kept', async function () {
  var x = await pair(100, [E('e1', 10), E('e2', 20)]);
  x.A.goOffline(); x.B.goOffline();
  var a = x.A.get(EXP); a.days[D1] = a.days[D1].filter(function (e) { return e.id !== 'e1'; }); x.A.set(EXP, a);
  var b = x.B.get(EXP); b.days[D1].push(E('e3', 5)); x.B.set(EXP, b);
  x.A.goOnline(); await settle([x.A, x.B]); x.B.goOnline(); await settle([x.A, x.B]);
  eq(days(x.A, D1), ['e2', 'e3']); eq(days(x.B, D1), ['e2', 'e3']);
});
test('two phones sell stock at the same time: both sales count', async function () {
  var x = await pair(100, []);
  x.A.goOffline(); x.B.goOffline();
  var a = x.A.get(INV); a.items[0].qty = 95; x.A.set(INV, a);
  var b = x.B.get(INV); b.items[0].qty = 97; x.B.set(INV, b);
  x.A.goOnline(); await settle([x.A, x.B]); x.B.goOnline(); await settle([x.A, x.B]);
  eq(qty(x.A, 'cup'), 92); eq(qty(x.B, 'cup'), 92); eq(cloudDoc(x.db, 'sync_inventory', 'item:cup').qty, 92);
});
test('a restock on one phone and a sale on an offline phone: both count', async function () {
  var x = await pair(100, []);
  x.B.goOffline();
  var a = x.A.get(INV); a.items[0].qty = 200; x.A.set(INV, a); await settle([x.A]);
  var b = x.B.get(INV); b.items[0].qty = 99; x.B.set(INV, b);
  x.B.goOnline(); await settle([x.A, x.B]);
  eq(qty(x.A, 'cup'), 199); eq(qty(x.B, 'cup'), 199);
});
test('phone comes online and uploads BEFORE it hears about the other change: it merges instead of overwriting', async function () {
  var x = await pair(100, []);
  x.B.goOffline();
  var b = x.B.get(INV); b.items[0].qty = 97; x.B.set(INV, b);
  var a = x.A.get(INV); a.items[0].qty = 95; x.A.set(INV, a); await settle([x.A]);
  x.B.hold = true; x.B.online = true;
  await settle([x.A, x.B]);
  x.B.release(); await settle([x.A, x.B]);
  eq(qty(x.A, 'cup'), 92); eq(qty(x.B, 'cup'), 92); eq(cloudDoc(x.db, 'sync_inventory', 'item:cup').qty, 92);
});
test('quantity never goes below zero when both phones sold the last items', async function () {
  var x = await pair(3, []);
  x.A.goOffline(); x.B.goOffline();
  var a = x.A.get(INV); a.items[0].qty = 0; x.A.set(INV, a);
  var b = x.B.get(INV); b.items[0].qty = 0; x.B.set(INV, b);
  x.A.goOnline(); await settle([x.A, x.B]); x.B.goOnline(); await settle([x.A, x.B]);
  eq(qty(x.A, 'cup'), 0); eq(qty(x.B, 'cup'), 0);
});
test('a page that holds stock in memory waits for Refresh, and does not upload over the other phone meanwhile', async function () {
  var x = await pair(100, [], { uses: 'inventory' });
  x.B.handlers.pointerdown && x.B.handlers.pointerdown();       // the person already touched the page
  x.B.goOffline();
  var b = x.B.get(INV); b.items[0].qty = 97; x.B.set(INV, b);
  var a = x.A.get(INV); a.items[0].qty = 95; x.A.set(INV, a); await settle([x.A]);
  x.B.goOnline(); await settle([x.A, x.B]);
  eq(cloudDoc(x.db, 'sync_inventory', 'item:cup').qty, 95);      // not overwritten by 97
  eq(qty(x.B, 'cup'), 97);                                       // the page's own data is untouched until Refresh
  if (!x.B.btn.onclick) throw new Error('no Refresh bar shown');
  x.B.btn.onclick(); await settle([x.A, x.B]);
  eq(qty(x.B, 'cup'), 92); eq(cloudDoc(x.db, 'sync_inventory', 'item:cup').qty, 92); eq(x.B.reloads > 0, true);
});
test('storage full on a phone does not delete anything in the cloud, and it recovers later', async function () {
  var x = await pair(100, [E('e1', 10)]);
  var before = Object.keys(coll(x.db, 'sync_inventory')).length;
  var C = makePhone('C', x.db, {}); C.failKey = INV;
  await settle([x.A, x.B, C], 8);
  var docs = coll(x.db, 'sync_inventory'), deleted = Object.keys(docs).filter(function (k) { return docs[k].d; });
  eq(Object.keys(docs).length, before); eq(deleted, []);
  eq(C.cloud.status().state, 'error');
  C.failKey = null; C.cloud.resync(); await settle([x.A, x.B, C], 8);
  eq(qty(C, 'cup'), 100); eq(deleted.length, 0);
});
test('everything settles: no pending changes and a second round writes nothing', async function () {
  var x = await pair(100, [E('e1', 10)]);
  x.A.goOffline(); x.B.goOffline();
  var a = x.A.get(INV); a.items[0].qty = 90; x.A.set(INV, a);
  var b = x.B.get(INV); b.items[0].qty = 80; x.B.set(INV, b);
  var b2 = x.B.get(EXP); b2.days[D1].push(E('eB', 1)); x.B.set(EXP, b2);
  x.A.goOnline(); x.B.goOnline(); await settle([x.A, x.B], 8);
  eq(pendingTotal(x.A), 0); eq(pendingTotal(x.B), 0);
  var w = x.db.writes; await settle([x.A, x.B], 4); eq(x.db.writes, w);
  eq(qty(x.A, 'cup'), 70); eq(qty(x.B, 'cup'), 70);
});

test('publishing the public menu works when signed in and says why when not', async function () {
  var db = makeDb(), A = makePhone('A', db, {}); await settle([A]);
  await A.cloud.publishMenu('{"v":1,"cats":[]}'); eq(db.public, { json: '{"v":1,"cats":[]}', by: 'A@x.com' });
  A.goOffline(); var err = ''; try { await A.cloud.publishMenu('{}'); } catch (e) { err = e.message; } if (!/offline/.test(err)) throw new Error('no offline error: ' + err);
});
var SALES = 'marinabays_sales_v1';
function bigSales(n) { var a = []; for (var i = 0; i < n; i++) a.push({ id: 'sale-' + i, rno: '#1-' + (i + 1), t: 1000 + i, shift: 1, n: i + 1, lines: [{ name: 'Spanish Latte', opt: '16 oz Iced', price: 120, addons: [{ n: 'Extra shot', p: 30 }], note: 'less sugar', qty: 1, cup: '16oz dabba', lid: 'Flat lids' }], gross: 150, disc: 0, net: 150, pay: 'cash', ca: 150, pays: [], discs: [], tend: 200, change: 50, ref: 0 }); return { sales: a }; }
test('the sync memory is small: sales are kept as short fingerprints, not a second full copy', async function () {
  var db = makeDb(), pre = {}; pre[SALES] = bigSales(300);
  var A = makePhone('A', db, { preload: pre }); await settle([A]);
  var meta = JSON.parse(A.ls.getItem('marinabays_sync_v2')), recs = meta.ds.sales.rec, ids = Object.keys(recs);
  eq(ids.length, 300); eq(Object.keys(recs[ids[0]]).sort(), ['d', 'h']);
  var dataSize = A.ls.getItem(SALES).length, metaSize = A.ls.getItem('marinabays_sync_v2').length;
  if (metaSize > dataSize * 0.25) throw new Error('sync memory ' + metaSize + ' is more than a quarter of the data ' + dataSize);
  eq(pendingTotal(A), 0);
});
test('changing one sale uploads only that sale', async function () {
  var db = makeDb(), pre = {}; pre[SALES] = bigSales(50);
  var A = makePhone('A', db, { preload: pre }); await settle([A]);
  var w = db.writes, o = A.get(SALES); o.sales[7].ref = 1; A.set(SALES, o); await settle([A]);
  eq(db.writes - w, 1);
});
test('upgrade from the older sync memory: nothing is uploaded again and nothing is lost', async function () {
  var db = makeDb(), pre = {}; pre[SALES] = bigSales(40); pre[INV] = inv0(100); pre[EXP] = exp0([E('e1', 10)]);
  var A = makePhone('A', db, { preload: pre }); await settle([A]);
  var v1 = { v: 1, last: 0, ds: {} };
  Object.keys(db.colls).forEach(function (c) { var n = c.replace('sync_', ''), rec = {}; Object.keys(db.colls[c]).forEach(function (id) { rec[id] = { v: db.colls[c][id].v, d: db.colls[c][id].d ? 1 : 0 }; }); v1.ds[n] = { init: true, since: 0, rec: rec }; });
  var pre2 = {}; pre2[SALES] = A.get(SALES); pre2[INV] = A.get(INV); pre2[EXP] = A.get(EXP); pre2.marinabays_sync_v1 = v1;
  var w = db.writes, C = makePhone('C', db, { preload: pre2 }); await settle([C], 5);
  eq(db.writes, w); eq(pendingTotal(C), 0);
  if (!C.ls.getItem('marinabays_sync_v2')) throw new Error('no new sync memory written');
  if (!C.ls.getItem('marinabays_sync_v1')) throw new Error('older sync memory removed too early');
  var o = C.get(SALES); o.sales[3].ref = 1; C.set(SALES, o); await settle([C]);
  eq(db.writes - w, 1);
});

(async function () {
  var fail = 0;
  for (var i = 0; i < tests.length; i++) {
    try { await tests[i].fn(); console.log('PASS ' + tests[i].name); }
    catch (e) { fail++; console.log('FAIL ' + tests[i].name + '\n     ' + e.message); }
  }
  console.log(fail ? fail + ' failed' : 'all ' + tests.length + ' passed');
  process.exit(fail ? 1 : 0);
})();
