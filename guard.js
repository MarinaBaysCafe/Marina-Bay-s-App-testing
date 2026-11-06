/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved.
   Approval and activity log for risky actions (refund, delete, correct, manual discount).
   - MBGuard.ask({title, detail}) asks for the PIN (and an optional reason). If no PIN is set, it lets the action through.
   - MBGuard.log(action, detail, reason) writes a line to the activity log (kept on this phone, last 500 lines).
   There is one shared PIN, so the log records the cashier of the open shift and the POS name, not who typed the PIN. */
(function () {
  var KEY = 'marinabays_audit_v1', MAX = 500, fails = 0, lockUntil = 0;
  function load() { try { var v = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(v)) return v; } catch (e) {} return []; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function log(action, detail, reason) {
    var by = '', pos = '';
    try {
      var S = window.MBShift, cur = S && S.current && S.current();
      by = cur ? (cur.openedBy || '') : '';
      pos = cur && cur.pos ? cur.pos : (S && S.posName ? S.posName() : '');
    } catch (e) {}
    var list = load();
    list.push({ t: Date.now(), a: action, d: detail || '', by: by, pos: pos, why: reason || '' });
    if (list.length > MAX) list = list.slice(list.length - MAX);
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }
  function list(n) { return load().slice(-(n || 100)).reverse(); }

  function ask(o) {
    return new Promise(function (resolve) {
      var sec = window.MBSecurity;
      if (!sec || !sec.enabled()) { resolve({ ok: true, reason: '', noPin: true }); return; }
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:99998;background:rgba(6,30,42,.6);display:flex;align-items:center;justify-content:center;padding:20px';
      d.innerHTML = '<div style="background:#fff;color:#1c2b33;border-radius:12px;padding:18px;width:100%;max-width:320px;font-family:inherit">' +
        '<b style="font-size:17px">' + esc(o.title || 'PIN needed') + '</b>' +
        (o.detail ? '<p style="margin:6px 0 10px;font-size:14px;color:#5b6b73">' + esc(o.detail) + '</p>' : '') +
        '<input id="mbgWhy" type="text" maxlength="80" placeholder="Reason (optional)" autocomplete="off" style="width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:10px;border:1px solid #c9c1b5;border-radius:8px;margin-bottom:8px">' +
        '<input id="mbgPin" type="password" inputmode="numeric" maxlength="6" placeholder="PIN" autocomplete="off" style="width:100%;box-sizing:border-box;font:inherit;font-size:20px;letter-spacing:6px;text-align:center;padding:10px;border:1px solid #c9c1b5;border-radius:8px">' +
        '<div id="mbgErr" style="min-height:20px;margin:6px 0;font-size:13px;color:#b3261e"></div>' +
        '<div style="display:flex;gap:8px"><button id="mbgNo" type="button" style="flex:1;height:44px;border:1px solid #c9c1b5;background:#fff;border-radius:8px;font:inherit;cursor:pointer">Cancel</button>' +
        '<button id="mbgOk" type="button" style="flex:1;height:44px;border:none;background:#0d6e7e;color:#fff;border-radius:8px;font:inherit;font-weight:650;cursor:pointer">Confirm</button></div></div>';
      document.body.appendChild(d);
      var pin = d.querySelector('#mbgPin'), why = d.querySelector('#mbgWhy'), err = d.querySelector('#mbgErr'), ok = d.querySelector('#mbgOk');
      function done(r) { d.remove(); resolve(r); }
      async function go() {
        var n = Date.now();
        if (n < lockUntil) { err.textContent = 'Too many tries. Wait ' + Math.ceil((lockUntil - n) / 1000) + ' seconds.'; return; }
        if (!pin.value) { err.textContent = 'Enter the PIN'; return; }
        ok.disabled = true;
        var good = false;
        try { good = await sec.verify(pin.value); } catch (e) {}
        ok.disabled = false;
        if (good) { fails = 0; done({ ok: true, reason: why.value.trim() }); return; }
        fails++; pin.value = '';
        if (fails >= 5) { fails = 0; lockUntil = Date.now() + 30000; err.textContent = 'Too many tries. Wait 30 seconds.'; }
        else err.textContent = 'Wrong PIN';
        pin.focus();
      }
      ok.onclick = go;
      d.querySelector('#mbgNo').onclick = function () { done({ ok: false, reason: '' }); };
      pin.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
      setTimeout(function () { pin.focus(); }, 50);
    });
  }
  window.MBGuard = { ask: ask, log: log, list: list };
})();
