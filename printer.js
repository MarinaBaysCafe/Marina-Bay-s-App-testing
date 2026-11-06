/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* Receipt printing for Marina Bay's Cafe apps (shared by every page).

   Printers are set up once in printers.html, like the Printers screen in a POS app.
   Each printer has a connection type:
     ble     Bluetooth LE thermal printer, sent directly with Web Bluetooth (Chrome)
     usb     USB thermal printer, sent directly with WebUSB (Chrome)
     rawbt   Android app RawBT, which can reach Bluetooth, USB and network (port 9100) printers
     dialog  the normal browser print dialog, sized for 58 mm or 80 mm paper
   Each printer also chooses which receipts it prints ("counter", "expense"). */
(function () {
  var KEY = 'marinabays_printers_v2';
  var OLD_KEY = 'marinabays_printer_v1';
  var TZ = 'Asia/Manila';

  var TYPES = { ble: 'Bluetooth (BLE)', usb: 'USB', rawbt: 'RawBT app (Android)', dialog: 'Print dialog' };
  var KINDS = { counter: 'Money counter receipts', expense: 'Expense receipts', pos: 'POS order receipts', shift: 'Shift reports' };
  var BLE_SERVICES = [
    '000018f0-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb', '0000fff0-0000-1000-8000-00805f9b34fb',
    '0000fee7-0000-1000-8000-00805f9b34fb', '0000ae30-0000-1000-8000-00805f9b34fb',
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
  ];
  var can = {
    ble: !!(typeof navigator !== 'undefined' && navigator.bluetooth),
    usb: !!(typeof navigator !== 'undefined' && navigator.usb),
    rawbt: typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || ''),
    dialog: true
  };

  /* ---------- stored settings ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function newPrinter(type) {
    return { id: uid(), name: '', type: type || (can.ble ? 'ble' : 'dialog'), width: 58, copies: 1, cut: false,
             devName: '', usb: null, drawer: 'off', drawerPin: 0, kinds: ['counter', 'expense', 'pos', 'shift'] };
  }
  var state = { v: 3, printers: [], receipt: { shop: "MARINA BAY'S CAFE", details: '', footer: '', logo: true } };
  (function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.printers)) {
        state.printers = s.printers;
        state.receipt = Object.assign(state.receipt, s.receipt || {});
        if (!s.v || s.v < 3) { // POS and shift receipts were added later: printers that took everything now take them too
          state.printers.forEach(function (pr) {
            if (pr.kinds.indexOf('counter') !== -1 && pr.kinds.indexOf('expense') !== -1) {
              if (pr.kinds.indexOf('pos') === -1) pr.kinds.push('pos');
              if (pr.kinds.indexOf('shift') === -1) pr.kinds.push('shift');
            }
          });
        }
        return;
      }
      var o = JSON.parse(localStorage.getItem(OLD_KEY)); // earlier single-printer settings
      if (o) {
        var p = newPrinter(o.mode === 'dialog' ? 'dialog' : 'ble');
        p.name = 'My printer'; p.width = o.width === 80 ? 80 : 58; p.devName = o.name || '';
        state.printers.push(p);
      }
    } catch (e) {}
  })();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var conns = {}; // live connections by printer id (kept while the page is open)

  /* ---------- text helpers ---------- */
  function ascii(s) {
    return String(s).replace(/₱/g, 'P').replace(/[\u00a0\u2009\u202f]/g, ' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '?');
  }
  function spaces(n) { return n > 0 ? new Array(n + 1).join(' ') : ''; }
  function repeat(ch, n) { return new Array(n + 1).join(ch); }
  function wrap(s, w, indent) {
    var words = s.split(' '), out = [], line = '', pre = '';
    words.forEach(function (word) {
      while (word.length > w - pre.length) {
        if (line) { out.push(pre + line); pre = indent || ''; line = ''; }
        var room = w - pre.length;
        out.push(pre + word.slice(0, room)); pre = indent || ''; word = word.slice(room);
      }
      if (!line) line = word;
      else if ((pre + line + ' ' + word).length <= w) line += ' ' + word;
      else { out.push(pre + line); pre = indent || ''; line = word; }
    });
    if (line) out.push(pre + line);
    return out;
  }
  function nowPH() {
    return new Date().toLocaleString('en-PH', { timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function build(fn, width) {
    var w = width === 80 ? 48 : 32, L = [], r = state.receipt;
    var p = {
      w: w,
      text: function (s, o) {
        wrap(ascii(s), w, (o && o.indent) || '').forEach(function (ln) { L.push({ s: ln, b: !!(o && o.b) }); });
      },
      center: function (s, o) {
        wrap(ascii(s), w, '').forEach(function (ln) {
          L.push({ s: spaces(Math.floor((w - ln.length) / 2)) + ln, b: !!(o && o.b) });
        });
      },
      row: function (l, rt, o) {
        l = ascii(l); rt = ascii(rt);
        if (l.length + rt.length + 1 > w) l = l.slice(0, Math.max(1, w - rt.length - 1));
        L.push({ s: l + spaces(w - l.length - rt.length) + rt, b: !!(o && o.b) });
      },
      rule: function (ch) { L.push({ s: repeat(ch || '-', w), b: false }); },
      logo: function () { if (window.MB_RECEIPT_LOGO && r.logo !== false) L.push({ s: '', b: false, img: true }); },
      feed: function (n) { for (var i = 0; i < (n || 1); i++) L.push({ s: '', b: false }); },
      // shop name, details, title, dates (uses the Receipt settings)
      header: function (title, dateText) {
        p.logo();
        if (r.shop) p.center(r.shop, { b: true });
        String(r.details || '').split('\n').forEach(function (l) { if (l.trim()) p.center(l.trim()); });
        p.center(title);
        if (dateText) p.text(dateText);
        p.text('Printed ' + nowPH());
        p.rule('=');
      },
      footer: function () {
        p.rule();
        p.center('Amounts in PHP');
        String(r.footer || '').split('\n').forEach(function (l) { if (l.trim()) p.center(l.trim()); });
      }
    };
    fn(p);
    return L;
  }
  function preview(fn, width) {
    return build(fn, width).map(function (l) { return l.img ? '[ logo ]' : l.s; }).join('\n');
  }
  // same as preview, but shows the real logo picture
  function previewHtml(fn, width) {
    function e(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
    return build(fn, width).map(function (l) {
      if (l.img) return '<img src="icons/receipt-logo.png" alt="Logo" style="display:block;margin:6px auto;width:' + Math.round(window.MB_RECEIPT_LOGO.w / 2) + 'px;image-rendering:pixelated">';
      return (l.b ? '<b>' + e(l.s) + '</b>' : e(l.s)) + '\n';
    }).join('');
  }

  /* ---------- ESC/POS bytes ---------- */
  function toBytes(lines, pr) {
    var out = [0x1b, 0x40], bold = false;
    lines.forEach(function (l) {
      if (l.img) { out = out.concat(logoBytes()); return; }
      if (l.b !== bold) { bold = l.b; out.push(0x1b, 0x45, bold ? 1 : 0); }
      for (var i = 0; i < l.s.length; i++) out.push(l.s.charCodeAt(i));
      out.push(0x0a);
    });
    if (bold) out.push(0x1b, 0x45, 0);
    if (pr.cut) out.push(0x1b, 0x64, 3, 0x1d, 0x56, 0x42, 0x00); // feed, partial cut
    else out.push(0x1b, 0x64, 4);                                  // feed
    return out;
  }
  // logo as an ESC/POS raster picture (GS v 0), centered
  function logoBytes() {
    var g = window.MB_RECEIPT_LOGO, bin = atob(g.data), out = [0x1b, 0x61, 0x01], xb = g.w / 8;
    out.push(0x1d, 0x76, 0x30, 0x00, xb & 255, xb >> 8, g.h & 255, g.h >> 8);
    for (var i = 0; i < bin.length; i++) out.push(bin.charCodeAt(i));
    out.push(0x0a, 0x1b, 0x61, 0x00);
    return out;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- Bluetooth LE ---------- */
  async function openBLE(pr, device) {
    var server = await device.gatt.connect();
    var services = await server.getPrimaryServices(), ch = null;
    for (var i = 0; i < services.length && !ch; i++) {
      var chars = await services[i].getCharacteristics();
      for (var j = 0; j < chars.length; j++) {
        var c = chars[j];
        if (c.uuid.indexOf('00002a') === 0) continue;
        if (c.properties.write || c.properties.writeWithoutResponse) { ch = c; break; }
      }
    }
    if (!ch) { try { device.gatt.disconnect(); } catch (e) {} throw new Error('Printer found, but its printing channel is not recognized. Try the RawBT option instead'); }
    device.addEventListener('gattserverdisconnected', function () { delete conns[pr.id]; if (pr.devName && !pr._unpaired) setTimeout(function () { connectBLE(pr, false).catch(function () {}); }, 1500); });
    pr.devName = device.name || pr.devName; save();
    conns[pr.id] = { device: device, char: ch };
    return conns[pr.id];
  }
  async function connectBLE(pr, forcePicker) {
    if (!can.ble) throw new Error('Bluetooth is not available in this browser');
    var c = conns[pr.id];
    if (c && c.device && c.device.gatt.connected) return c;
    if (!forcePicker && pr.devName && navigator.bluetooth.getDevices) {
      try {
        var known = (await navigator.bluetooth.getDevices()).filter(function (d) { return d.name === pr.devName; })[0];
        if (known) return await openBLE(pr, known);
      } catch (e) {}
    }
    var device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
    return await openBLE(pr, device);
  }
  async function sendBLE(c, bytes) {
    var size = 20, noResp = !!c.char.properties.writeWithoutResponse;
    for (var i = 0; i < bytes.length; i += size) {
      var chunk = new Uint8Array(bytes.slice(i, i + size));
      if (noResp && c.char.writeValueWithoutResponse) await c.char.writeValueWithoutResponse(chunk);
      else if (c.char.writeValueWithResponse) await c.char.writeValueWithResponse(chunk);
      else await c.char.writeValue(chunk);
      await sleep(15);
    }
  }

  /* ---------- USB ---------- */
  async function openUSB(pr, forcePicker) {
    if (!can.usb) throw new Error('USB printing is not available in this browser');
    var c = conns[pr.id];
    if (!forcePicker && c && c.usb && c.usb.opened) return c;
    var dev = null;
    if (!forcePicker && pr.usb) {
      var list = await navigator.usb.getDevices();
      dev = list.filter(function (d) { return d.vendorId === pr.usb.vid && d.productId === pr.usb.pid; })[0] || null;
    }
    if (!dev) {
      dev = await navigator.usb.requestDevice({ filters: [] });
      pr.usb = { vid: dev.vendorId, pid: dev.productId };
      pr.devName = dev.productName || 'USB printer'; save();
    }
    if (!dev.opened) await dev.open();
    if (dev.configuration === null) await dev.selectConfiguration(1);
    var best = null;
    dev.configuration.interfaces.forEach(function (itf) {
      itf.alternates.forEach(function (alt) {
        alt.endpoints.forEach(function (ep) {
          if (ep.direction === 'out' && ep.type === 'bulk') {
            var score = alt.interfaceClass === 7 ? 2 : 1;
            if (!best || score > best.score) best = { n: itf.interfaceNumber, alt: alt.alternateSetting, ep: ep.endpointNumber, score: score };
          }
        });
      });
    });
    if (!best) throw new Error('No printing channel found on this USB device');
    if (!(c && c.usb === dev && c.claimed)) await dev.claimInterface(best.n);
    if (best.alt) await dev.selectAlternateInterface(best.n, best.alt);
    conns[pr.id] = { usb: dev, ep: best.ep, claimed: true };
    return conns[pr.id];
  }
  async function sendUSB(c, bytes) {
    var u = new Uint8Array(bytes);
    for (var i = 0; i < u.length; i += 4096) await c.usb.transferOut(c.ep, u.slice(i, i + 4096));
  }

  /* ---------- RawBT (Android app) ---------- */
  function sendRawBT(bytes) {
    if (!can.rawbt) throw new Error('RawBT only works on Android');
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    window.location.href = 'intent:base64,' + btoa(bin) + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;';
  }

  /* ---------- print dialog ---------- */
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function printDialog(lines, width) {
    var pw = width === 80 ? '80mm' : '58mm';
    var logoUrl = new URL('icons/receipt-logo.png', window.location.href).href, hasLogo = false;
    var body = lines.map(function (l) {
      if (l.img) { hasLogo = true; return '<img src="' + logoUrl + '" alt="" style="display:block;margin:0 auto 1mm;width:' + Math.round(window.MB_RECEIPT_LOGO.w / 8) + 'mm">'; }
      return l.b ? '<b>' + esc(l.s) + '</b>' : esc(l.s);
    }).join('\n');
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title><style>' +
      '@page{size:' + pw + ' auto;margin:2mm}html,body{margin:0;background:#fff}' +
      'pre{margin:0;color:#000;white-space:pre;font:2.5mm/1.3 "Courier New",Courier,monospace}b{font-weight:700}' +
      '</style></head><body><pre>' + body + '</pre></body></html>';
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(function () {
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {}
      setTimeout(function () { f.remove(); }, 3000);
    }, hasLogo ? 600 : 250);
  }

  /* ---------- sending ---------- */
  /* Cash drawer: ESC p m t1 t2 pulses the drawer connected to the printer's RJ11/RJ12 port.
     pr.drawer: 'off' | 'all' (every charge) | 'cash' (cash sales only). pr.drawerPin: 0 (pin 2) or 1 (pin 5). */
  function kickBytes(pr) { return [0x1b, 0x70, pr.drawerPin ? 1 : 0, 0x19, 0xfa]; }
  function wantKick(pr, opts) {
    if (!opts || !opts.sale || pr.type === 'dialog') return false;
    return pr.drawer === 'all' || (pr.drawer === 'cash' && !!opts.cash);
  }
  async function sendTo(pr, fn, opts) {
    var lines = build(fn, pr.width), bytes = [];
    for (var i = 0; i < (pr.copies || 1); i++) bytes = bytes.concat(toBytes(lines, pr));
    if (wantKick(pr, opts)) bytes = bytes.concat(kickBytes(pr));
    if (pr.type === 'ble') await sendBLE(await connectBLE(pr, false), bytes);
    else if (pr.type === 'usb') await sendUSB(await openUSB(pr, false), bytes);
    else if (pr.type === 'rawbt') sendRawBT(bytes);
    else printDialog(lines, pr.width);
  }
  function cancelled(e) { return e && e.name === 'NotFoundError' && /cancel|no device selected|not selected/i.test(e.message || ''); }

  // kind: 'counter' or 'expense'. Returns a short message to show, or ''.
  async function print(kind, fn, opts) {
    var ps = state.printers.filter(function (p) { return p.kinds.indexOf(kind) !== -1; });
    if (!ps.length) {
      if (confirm('No printer is set up for this receipt yet. Open printer settings?')) window.location.href = 'printers.html';
      return '';
    }
    var direct = ps.filter(function (p) { return p.type === 'ble' || p.type === 'usb'; });
    var handoff = ps.filter(function (p) { return p.type === 'rawbt' || p.type === 'dialog'; });
    var done = [], failed = [], fallbackWidth = 58;
    for (var i = 0; i < direct.length; i++) {
      try { await sendTo(direct[i], fn, opts); done.push(direct[i].name); }
      catch (e) {
        if (cancelled(e)) return '';
        delete conns[direct[i].id];
        failed.push(direct[i].name + ': ' + ((e && e.message) || e));
        fallbackWidth = direct[i].width;
      }
    }
    if (failed.length && confirm('Could not print.\n' + failed.join('\n') + '\n\nUse the print dialog instead?')) {
      handoff.push({ type: 'dialog', width: fallbackWidth, name: 'Print dialog' });
      failed = [];
    }
    for (var j = 0; j < handoff.length; j++) {
      try { await sendTo(handoff[j], fn, opts); done.push(handoff[j].name); }
      catch (e2) { failed.push(handoff[j].name + ': ' + ((e2 && e2.message) || e2)); }
    }
    if (failed.length) return 'Could not print: ' + failed[0];
    return done.length ? 'Sent to ' + done.join(', ') : '';
  }

  /* ---------- helpers for the settings page ---------- */
  function testFn(p) {
    p.logo();
    p.center(state.receipt.shop || 'TEST', { b: true });
    p.center('Printer test');
    p.rule('=');
    p.text('1234567890123456789012345678901234567890123456789'.slice(0, p.w));
    p.row('Left', 'Right');
    p.row('TOTAL', '1,234.50', { b: true });
    p.rule();
    p.center('If this looks right, you are set');
  }
  async function pair(pr) {
    if (pr.type === 'ble') await connectBLE(pr, true);
    else if (pr.type === 'usb') await openUSB(pr, true);
  }
  // Unpair: disconnect, make the browser forget the device, and clear it from the printer.
  async function unpair(pr) {
    pr._unpaired = true;
    var c = conns[pr.id]; delete conns[pr.id];
    try {
      if (c && c.device) { try { c.device.gatt.disconnect(); } catch (e) {} if (c.device.forget) await c.device.forget(); }
      if (pr.devName && navigator.bluetooth && navigator.bluetooth.getDevices) {
        var l = await navigator.bluetooth.getDevices();
        for (var i = 0; i < l.length; i++) if (l[i].name === pr.devName && l[i].forget) await l[i].forget();
      }
      if (c && c.usb) { try { await c.usb.close(); } catch (e) {} if (c.usb.forget) await c.usb.forget(); }
      else if (pr.usb && navigator.usb) {
        var ul = await navigator.usb.getDevices();
        for (var j = 0; j < ul.length; j++) if (ul[j].vendorId === pr.usb.vid && ul[j].productId === pr.usb.pid && ul[j].forget) await ul[j].forget();
      }
    } catch (e) {}
    pr.devName = ''; pr.usb = null; pr._unpaired = false; save();
  }
  // Reconnect to saved Bluetooth printers when a page opens, so the first receipt prints right away.
  function warm() {
    state.printers.forEach(function (pr) { if (pr.type === 'ble' && pr.devName) connectBLE(pr, false).catch(function () {}); });
  }
  async function test(pr) { await sendTo(pr, testFn); }
  // send only the drawer pulse (no paper). Used by the Test button and the POS Drawer button.
  async function sendKick(pr) {
    var bytes = kickBytes(pr);
    if (pr.type === 'ble') await sendBLE(await connectBLE(pr, false), bytes);
    else if (pr.type === 'usb') await sendUSB(await openUSB(pr, false), bytes);
    else if (pr.type === 'rawbt') sendRawBT(bytes);
    else throw new Error('The print dialog cannot open a cash drawer');
  }
  async function testDrawer(pr) { await sendKick(pr); }
  function hasDrawer() { return state.printers.some(function (p) { return p.drawer && p.drawer !== 'off' && p.type !== 'dialog'; }); }
  /* Open the drawer without printing. opts.sale: also respect "cash sales only". Returns a short message. */
  async function openDrawer(opts) {
    opts = opts || {};
    var ps = state.printers.filter(function (p) {
      if (!p.drawer || p.drawer === 'off' || p.type === 'dialog') return false;
      if (opts.skipReceiptPrinters && p.kinds.indexOf('pos') !== -1) return false; // the receipt already carries the pulse
      return opts.manual ? true : (p.drawer === 'all' || (p.drawer === 'cash' && !!opts.cash));
    });
    if (!ps.length) return '';
    var failed = '';
    for (var i = 0; i < ps.length; i++) {
      try { await sendKick(ps[i]); } catch (e) { failed = (e && e.message) || String(e); }
    }
    return failed ? 'Could not open the cash drawer: ' + failed : '';
  }
  function isCancel(e) { return cancelled(e); }

  /* ---------- small link shown inside the apps (More tab) ---------- */
  function mount(el) {
    var n = state.printers.length;
    el.innerHTML = '<a class="item mb-link" href="printers.html"><b>Printers and receipts</b><span>' +
      (n ? n + (n === 1 ? ' printer' : ' printers') + ' set up' : 'No printer set up yet') + '</span></a>';
    if (!document.getElementById('mb-link-style')) {
      var s = document.createElement('style');
      s.id = 'mb-link-style';
      s.textContent = '.mb-link{text-decoration:none;color:var(--ink);box-sizing:border-box}';
      document.head.appendChild(s);
    }
  }
  // print button style used by the apps
  (function () {
    var s = document.createElement('style');
    s.textContent =
      '.mb-print{display:block;width:calc(100% - 32px);margin:14px 16px 0;height:46px;border:1.5px solid var(--teal);background:#fff;color:var(--teal);font:inherit;font-weight:650;font-size:16px;border-radius:6px;cursor:pointer}' +
      '.mb-print:active{background:var(--soft)}.mb-print:disabled{opacity:.6}';
    document.head.appendChild(s);
  })();

  window.MBPrinter = {
    unpair: unpair, warm: warm,
    print: print, mount: mount, preview: preview, previewHtml: previewHtml, save: save, state: state, can: can,
    TYPES: TYPES, KINDS: KINDS, newPrinter: newPrinter, pair: pair, test: test, isCancel: isCancel,
    testDrawer: testDrawer, openDrawer: openDrawer, hasDrawer: hasDrawer
  };
})();
