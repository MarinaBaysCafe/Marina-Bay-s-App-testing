/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* The public menu. build() makes the small, safe copy of the menu that anyone may read. Only the fields written in build()
   ever leave the cafe: no costs, recipes, stock, sales, staff or internal notes. parseRest() reads that copy back. */
(function (root) {
  'use strict';
  var VERSION = 1, MAX_JSON = 250000;
  function str(x, n) { return String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
  function price(x) { var n = Number(x); return (x !== '' && x !== null && isFinite(n) && n >= 0 && n < 1000000) ? Math.round(n * 100) / 100 : null; }
  function build(menu, opts) {
    opts = opts || {};
    var snap = { v: VERSION, name: str(opts.name, 60), note: str(opts.note, 160), cats: [], addons: [] }, skipped = 0, inc = {};
    var items = (menu && menu.items) || [];
    ((menu && menu.categories) || []).forEach(function (c) {
      var list = [];
      items.forEach(function (it) {
        if (it.cat !== c.id) return;
        if (it.check) { skipped++; return; }                       // the price still needs checking: not shown to customers
        var o = (it.options || []).map(function (x) { return { l: str(x.label === 'Regular' ? '' : x.label, 30), p: price(x.price) }; }).filter(function (x) { return x.p !== null; });
        list.push({ id: str(it.id, 40), n: str(it.name, 60), d: str(it.desc, 120), b: it.best ? 1 : 0, s: it.soldOut ? 1 : 0, o: o });
      });
      if (!list.length) return;
      inc[c.id] = 1;
      snap.cats.push({ id: str(c.id, 40), n: str(c.name, 60), g: str(c.group, 30), t: str(c.note, 60), i: list });
    });
    ((menu && menu.addonGroups) || []).forEach(function (g) {
      var cats = (g.cats || []).filter(function (id) { return inc[id]; }).map(function (id) { return str(id, 40); });
      var its = (g.items || []).map(function (a) { return { n: str(a.name, 50), p: price(a.price) }; }).filter(function (a) { return a.n && a.p !== null; });
      if (cats.length && its.length) snap.addons.push({ n: str(g.name, 50), c: cats, i: its });
    });
    var json = JSON.stringify(snap);
    return { snap: snap, json: json, skipped: skipped, ok: json.length <= MAX_JSON, items: snap.cats.reduce(function (t, c) { return t + c.i.length; }, 0) };
  }
  // short fingerprint, to tell whether the menu changed since it was published
  function hash(s) {
    s = String(s); var h1 = 0xdeadbeef, h2 = 0x41c6ce57, i, ch;
    for (i = 0; i < s.length; i++) { ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + '.' + s.length.toString(36);
  }
  // the answer of the Firestore REST address for the public document
  function parseRest(r) {
    try {
      var f = r && r.fields, j = f && f.json && f.json.stringValue;
      if (typeof j !== 'string' || j.length > MAX_JSON) return null;
      var s = JSON.parse(j);
      if (!s || s.v !== VERSION || !Array.isArray(s.cats) || !Array.isArray(s.addons || [])) return null;
      return { snap: s, t: f.t && f.t.timestampValue ? String(f.t.timestampValue) : '' };
    } catch (e) { return null; }
  }
  function tableLabel(x) { x = String(x == null ? '' : x); return /^[A-Za-z0-9-]{1,6}$/.test(x) ? x : ''; }
  // "1-10", "1,2,5" or "A1 A2" -> a list of table labels (at most 60, no repeats). Empty text -> []
  function tables(text) {
    var out = [], seen = {};
    function add(t) { if (t && !seen[t] && out.length < 60) { seen[t] = 1; out.push(t); } }
    String(text == null ? '' : text).split(/[,;\s]+/).forEach(function (tok) {
      if (!tok) return;
      var m = /^(\d{1,3})-(\d{1,3})$/.exec(tok);
      if (m) { var a = +m[1], b = +m[2]; if (a <= b && b - a < 60) for (var i = a; i <= b; i++) add(String(i)); return; }
      add(tableLabel(tok));
    });
    return out;
  }
  // the dark squares of a QR code as one drawing path (runs of squares are joined). The code gets a quiet border of `quiet` squares.
  function qrPath(isDark, n, quiet) {
    quiet = quiet == null ? 4 : quiet; var d = '', r, c, s;
    for (r = 0; r < n; r++) { c = 0; while (c < n) { if (isDark(r, c)) { s = c; while (c < n && isDark(r, c)) c++; d += 'M' + (s + quiet) + ' ' + (r + quiet) + 'h' + (c - s) + 'v1h-' + (c - s) + 'z'; } else c++; } }
    return d;
  }
  function peso(n) {
    var neg = n < 0, a = Math.abs(n), whole = String(Math.floor(a)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), c = Math.round((a - Math.floor(a)) * 100);
    return (neg ? '-' : '') + '\u20b1' + whole + (c ? '.' + (c < 10 ? '0' : '') + c : '');
  }
  var api = { VERSION: VERSION, MAX_JSON: MAX_JSON, build: build, hash: hash, parseRest: parseRest, tableLabel: tableLabel, tables: tables, qrPath: qrPath, peso: peso };
  root.MBMenuSnap = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
