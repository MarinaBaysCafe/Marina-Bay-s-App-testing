/* Daily inventory log: beginning / used / ending per item per day, plus a small .xlsx writer.
   Used = automatic (cups and lids from sales) + manual entries. Beginning and ending can be typed over. */
(function () {
  /* Ledger: every stock change is recorded with the stock level just before it (b), so each day reads
     Beg + Added - Used = End, and Beg is the previous day's End. Kinds: auto (cups/lids taken out at shift close),
     used (manual use or loss), add (restock), init (first count, changes nothing). */
  var KEY = 'marinabays_invlog_v2';
  function D() { return window.MBData; }
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && v.days) return v; } catch (e) {} return { days: {} }; }
  var log = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(log)); return true; } catch (e) { return false; } }
  function items() { return D().getInventory().items || []; }
  function item(id) { return items().filter(function (i) { return i.id === id; })[0]; }
  function localToday() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  function addDays(d, n) { var x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function push(id, k, n, before) {
    var d = localToday(), day = log.days[d] || (log.days[d] = {}), l = day[id] || (day[id] = []);
    l.push({ k: k, n: n, b: before, t: Date.now() }); return save();
  }
  /* called by shift close after it lowers cups/lids */
  function clear() { log = { days: {} }; try { localStorage.removeItem(KEY); } catch (e) {} }
  function logAuto(id, before, after) { var n = before - after; if (n > 0) push(id, 'auto', n, before); }
  function restoreAuto(id, before, after) { var n = after - before; if (n > 0) push(id, 'auto', -n, before); }
  /* One cell of today's sheet. field: oi (opening), in, out (total out; orders already counted stay), ci (closing count).
     Typing CI works out OUT (or IN if you counted more than expected). Returns '' or a message. */
  function setDay(id, field, v) {
    var it = item(id), d = localToday(); if (!it) return 'Item not found';
    var r = range(d, d)[d].filter(function (x) { return x.item.id === id; })[0], beg = r.beg, add = r.added, auto = r.auto, man = r.man;
    if (beg == null) { if (field === 'oi' || field === 'ci') beg = v; else beg = 0; add = 0; man = 0; }
    if (field === 'oi') beg = v;
    else if (field === 'in') add = v;
    else if (field === 'out') man = Math.max(0, v - auto);
    else if (field === 'ci') { var base = beg + add - auto; if (v <= base) man = base - v; else { man = 0; add = v - beg + auto; } }
    var end = beg + add - auto - man; if (end < 0) return 'Out is more than the total';
    var day = log.days[d] || (log.days[d] = {}), keep = (day[id] || []).filter(function (e) { return e.k === 'auto'; }), t = Date.now(), es = [];
    if (add > 0) es.push({ k: 'add', n: add, t: t });
    es = es.concat(keep); if (man > 0) es.push({ k: 'used', n: man, t: t });
    if (!es.length) es.push({ k: 'init', n: beg, t: t });
    var run = beg; es.forEach(function (e) { e.b = run; run += e.k === 'add' ? e.n : e.k === 'init' ? 0 : -e.n; });
    it.qty = end; it.updated = D().todayPH(); day[id] = es;
    return D().saveInventory() && save() ? '' : 'Could not save. Storage may be full.';
  }
  /* called by the Inventory page whenever a count is changed there */
  function onQty(id, oldQ, newQ) {
    if (newQ == null || oldQ === newQ) return;
    if (oldQ == null) { push(id, 'init', newQ, newQ); return; }
    if (newQ > oldQ) push(id, 'add', newQ - oldQ, oldQ); else push(id, 'used', oldQ - newQ, oldQ);
  }
  /* the form on the calendar: kind is 'add' or 'used'; changes the stock count too. Returns '' on success or a message. */
  function adjust(kind, id, n, date) {
    if (date && date < localToday()) return lateAdjust(kind, id, n, date);
    var it = item(id); if (!it) return 'Item not found';
    if (it.qty == null) return 'Count this item first on the Inventory page';
    var before = it.qty, after = kind === 'add' ? before + n : Math.max(0, before - n);
    if (after === before) return 'Nothing to change';
    it.qty = after; it.updated = D().todayPH();
    if (!D().saveInventory()) { it.qty = before; return 'Could not save. Storage may be full.'; }
    onQty(id, before, after); return '';
  }
  /* A change for an earlier day that was forgotten at the time (up to LATE_DAYS back).
     The stock count today changes by the same amount, the entry is placed at the start of that day, and every
     later entry for the item is shifted so Beg + Added - Used = End still holds on every day. */
  var LATE_DAYS = 30;
  function lateAdjust(kind, id, n, date) {
    var it = item(id); if (!it) return 'Item not found';
    if (it.qty == null) return 'Count this item first on the Inventory page';
    var today = localToday();
    if (date < addDays(today, -LATE_DAYS)) return 'Late entries only go back ' + LATE_DAYS + ' days';
    var delta = kind === 'add' ? n : -n;
    if (it.qty + delta < 0) return 'Not enough stock now to take ' + n + ' off';
    // stock at the start of that day = stock now minus everything recorded from that day until now
    var net = 0;
    Object.keys(log.days).forEach(function (d) {
      if (d < date) return;
      (log.days[d][id] || []).forEach(function (e) { if (e.k === 'add') net += e.n; else if (e.k === 'auto' || e.k === 'used') net -= e.n; });
    });
    var beg = it.qty - net;
    var before = it.qty;
    it.qty = it.qty + delta; it.updated = D().todayPH();
    if (!D().saveInventory()) { it.qty = before; return 'Could not save. Storage may be full.'; }
    Object.keys(log.days).forEach(function (d) {
      if (d < date) return;
      (log.days[d][id] || []).forEach(function (e) { e.b += delta; });
    });
    var day = log.days[date] || (log.days[date] = {}), l = day[id] || (day[id] = []);
    l.unshift({ k: kind === 'add' ? 'add' : 'used', n: n, b: beg, t: Date.now(), late: today });
    if (!save()) return 'Saved the stock, but the daily record could not be saved. Storage may be full.';
    return '';
  }
  /* rows per date: {item, beg, added, auto, man, used, end} */
  function range(from, to) {
    var out = {}, run = {}, today = localToday(), its = items();
    for (var d = from; d <= to; d = addDays(d, 1)) {
      var day = log.days[d] || {}, rows = [];
      its.forEach(function (it) {
        var l = day[it.id] || [], added = 0, auto = 0, man = 0;
        l.forEach(function (e) { if (e.k === 'add') added += e.n; else if (e.k === 'auto') auto += e.n; else if (e.k === 'used') man += e.n; });
        var beg = l.length ? l[0].b : (run[it.id] != null ? run[it.id] : (d === today && it.qty != null ? it.qty : null));
        var end = beg == null ? null : beg + added - auto - man;
        if (d === today && it.qty != null) end = it.qty;
        run[it.id] = end;
        rows.push({ item: it, beg: beg, added: added, auto: auto, man: man, used: auto + man, end: end });
      });
      out[d] = rows;
    }
    return out;
  }

  /* ---------- minimal .xlsx writer (stored zip, no compression) ---------- */
  var T = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function u8(s) { return new TextEncoder().encode(s); }
  function zip(files) {
    var parts = [], cen = [], off = 0;
    function w16(a, v) { a.push(v & 255, (v >> 8) & 255); } function w32(a, v) { w16(a, v & 0xFFFF); w16(a, (v >>> 16) & 0xFFFF); }
    files.forEach(function (f) {
      var nm = u8(f.name), data = u8(f.data), c = crc(data), h = [];
      w32(h, 0x04034b50); w16(h, 20); w16(h, 0x0800); w16(h, 0); w16(h, 0); w16(h, 0x21); w32(h, c); w32(h, data.length); w32(h, data.length); w16(h, nm.length); w16(h, 0);
      parts.push(new Uint8Array(h), nm, data);
      var e = []; w32(e, 0x02014b50); w16(e, 20); w16(e, 20); w16(e, 0x0800); w16(e, 0); w16(e, 0); w16(e, 0x21); w32(e, c); w32(e, data.length); w32(e, data.length); w16(e, nm.length); w16(e, 0); w16(e, 0); w16(e, 0); w16(e, 0); w32(e, 0); w32(e, off);
      cen.push(new Uint8Array(e), nm); off += h.length + nm.length + data.length;
    });
    var csz = 0; cen.forEach(function (p) { csz += p.length; });
    var end = []; w32(end, 0x06054b50); w16(end, 0); w16(end, 0); w16(end, files.length); w16(end, files.length); w32(end, csz); w32(end, off); w16(end, 0);
    return new Blob(parts.concat(cen, [new Uint8Array(end)]), { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function xe(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function col(i) { return String.fromCharCode(65 + i); }
  /* sheet = { name, widths:[..], rows:[ [ {v, s} | v ... ] ] }, styles: 1 bold, 2 bold+grey fill, 3 title */
  function sheetXml(sh) {
    var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" state="frozen"/></sheetView></sheetViews><cols>';
    sh.widths.forEach(function (w, i) { x += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; });
    x += '</cols><sheetData>';
    sh.rows.forEach(function (r, ri) {
      x += '<row r="' + (ri + 1) + '">';
      r.forEach(function (c, ci) {
        if (c == null) return; if (typeof c !== 'object') c = { v: c };
        if (c.v === '' || c.v == null) { if (c.s) x += '<c r="' + col(ci) + (ri + 1) + '" s="' + c.s + '"/>'; return; }
        var s = c.s ? ' s="' + c.s + '"' : '', ref = col(ci) + (ri + 1);
        x += typeof c.v === 'number' ? '<c r="' + ref + '"' + s + '><v>' + c.v + '</v></c>' : '<c r="' + ref + '"' + s + ' t="inlineStr"><is><t>' + xe(c.v) + '</t></is></c>';
      });
      x += '</row>';
    });
    return x + '</sheetData></worksheet>';
  }
  function xlsx(sheets) {
    var f = [], ct = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    var wb = '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>', rel = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    sheets.forEach(function (sh, i) {
      var n = i + 1;
      ct += '<Override PartName="/xl/worksheets/sheet' + n + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
      wb += '<sheet name="' + xe(sh.name) + '" sheetId="' + n + '" r:id="rId' + n + '"/>';
      rel += '<Relationship Id="rId' + n + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + n + '.xml"/>';
      f.push({ name: 'xl/worksheets/sheet' + n + '.xml', data: sheetXml(sh) });
    });
    rel += '<Relationship Id="rIdS" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    f.unshift({ name: '[Content_Types].xml', data: ct + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: wb + '</sheets></workbook>' }, { name: 'xl/_rels/workbook.xml.rels', data: rel },
      { name: 'xl/styles.xml', data: '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDCE8EE"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf/><xf fontId="1" applyFont="1"/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf fontId="2" applyFont="1"/></cellXfs></styleSheet>' });
    return zip(f);
  }
  function sheetFor(name, title, dayRows, cols) {
    var rows = [[{ v: title, s: 3 }], [], [{ v: 'Item', s: 2 }, { v: 'Beg', s: 2 }, { v: 'Added', s: 2 }, { v: 'Used', s: 2 }, { v: 'End', s: 2 }, { v: 'Units', s: 2 }]], last = null;
    dayRows.forEach(function (r) {
      var g = r.item.group || 'Other';
      if (g !== last) { rows.push([{ v: g, s: 1 }]); last = g; }
      rows.push([r.item.name, r.beg == null ? '' : r.beg, r.added, r.used, r.end == null ? '' : r.end, r.item.unit || '']);
    });
    return { name: name, widths: [34, 10, 10, 10, 10, 12], rows: rows };
  }
  function exportXlsx(from, to, day) {
    var rg = range(from, to), dates = Object.keys(rg).sort(), first = rg[dates[0]], lastR = rg[dates[dates.length - 1]];
    var month = first.map(function (r, i) {
      var used = 0, added = 0, beg = null; dates.forEach(function (d) { used += rg[d][i].used; added += rg[d][i].added; if (beg == null) beg = rg[d][i].beg; });
      return { item: r.item, beg: beg, added: added, used: used, end: lastR[i].end };
    });
    var dr = rg[day] || range(day, day)[day];
    var blob = xlsx([sheetFor('Month', 'Inventory ' + from + ' to ' + to, month), sheetFor(day, 'Inventory ' + day, dr)]);
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inventory-' + from.slice(0, 7) + '.xlsx';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  window.MBInvLog = { clear: clear, range: range, adjust: adjust, onQty: onQty, logAuto: logAuto, restoreAuto: restoreAuto, setDay: setDay, exportXlsx: exportXlsx, localToday: localToday, addDays: addDays, LATE_DAYS: LATE_DAYS };
})();
