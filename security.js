/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved.
   PIN lock for the Marina Bay's Cafe apps. Loaded in the <head> of every page.
   The PIN is never stored. Only a salted PBKDF2 hash is kept on this device.
   This keeps casual users out. It does not encrypt the data stored in the browser. */
(function () {
  var KEY = 'marinabays_security_v1';
  var S_OK = 'mb_unlocked', S_LAST = 'mb_last';
  var MAX_FAILS = 5, LOCKOUT_MS = 30000, ITER = 150000;

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  var cfg = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {} }
  function enabled() { return !!(cfg.pin && cfg.pin.hash); }
  function canHash() { return !!(window.crypto && window.crypto.subtle && window.TextEncoder); }

  /* ---------- hashing ---------- */
  function toHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function fromHex(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  function randomHex(n) { var a = new Uint8Array(n); window.crypto.getRandomValues(a); return toHex(a); }
  async function derive(secret, saltHex) {
    var key = await window.crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveBits']);
    var bits = await window.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(saltHex), iterations: ITER, hash: 'SHA-256' }, key, 256);
    return toHex(bits);
  }
  function same(a, b) { if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
  async function check(rec, secret) { return !!rec && same(await derive(secret, rec.salt), rec.hash); }
  function normRecovery(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function newRecoveryCode() {
    var al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', a = new Uint8Array(12), out = '';
    window.crypto.getRandomValues(a);
    for (var i = 0; i < 12; i++) { out += al[a[i] % al.length]; if (i % 4 === 3 && i < 11) out += '-'; }
    return out;
  }

  /* ---------- session ---------- */
  function now() { return Date.now(); }
  function unlockedNow() {
    if (!enabled()) return true;
    try {
      if (sessionStorage.getItem(S_OK) !== '1') return false;
      var lim = (cfg.auto || 0) * 60000;
      if (lim && now() - (+sessionStorage.getItem(S_LAST) || 0) > lim) return false;
      return true;
    } catch (e) { return false; }
  }
  function touch() { try { sessionStorage.setItem(S_LAST, String(now())); } catch (e) {} }
  function markUnlocked() { try { sessionStorage.setItem(S_OK, '1'); } catch (e) {} touch(); }

  /* ---------- screen ---------- */
  var root = document.documentElement;
  var st = document.createElement('style');
  st.textContent =
    'html.mb-locked body > :not(#mb-lock){visibility:hidden}' +
    '#mb-lock{position:fixed;inset:0;z-index:99999;background:linear-gradient(rgba(6,30,42,.6),rgba(6,30,42,.75)),url(icons/sea.jpg) center/cover no-repeat,#0d3a4e;color:#fff;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;padding:20px;overflow:auto}' +
    '#mb-lock .mb-box{width:100%;max-width:320px;text-align:center}' +
    '#mb-lock img{width:64px;height:64px;padding:4px;background:#fff;border-radius:50%;box-shadow:0 0 0 2px #b08a57}' +
    '#mb-lock h1{font-family:"Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;font-size:24px;margin:12px 0 2px;font-weight:700}' +
    '#mb-lock p{margin:0 0 14px;color:#a9c8d2;font-size:14px;min-height:20px}' +
    '#mb-lock p.err{color:#ffb4a8}' +
    '#mb-lock .mb-dots{display:flex;justify-content:center;gap:12px;margin:6px 0 18px;min-height:16px}' +
    '#mb-lock .mb-dots i{width:14px;height:14px;border-radius:50%;border:1.5px solid #fff;display:block}' +
    '#mb-lock .mb-dots i.on{background:#fff}' +
    '#mb-lock .mb-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
    '#mb-lock .mb-pad button{height:58px;border:1.5px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);border-radius:14px;font:inherit;font-size:22px;color:#fff;cursor:pointer}' +
    '#mb-lock .mb-pad button:active{background:rgba(255,255,255,.22)}' +
    '#mb-lock .mb-pad button.mb-small{font-size:14px;color:#a9c8d2}' +
    '#mb-lock .mb-pad button:disabled{opacity:.4}' +
    '#mb-lock .mb-link{margin-top:16px;border:none;background:none;font:inherit;font-size:14px;color:#d8c49d;text-decoration:underline;cursor:pointer;padding:8px}' +
    '#mb-lock input{width:100%;height:46px;border:1.5px solid #c9c1b5;color:#14262e;background:#fff;border-radius:10px;padding:0 12px;font:inherit;font-size:18px;text-align:center;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px}' +
    '#mb-lock .mb-go{width:100%;height:46px;border:none;border-radius:12px;background:#b08a57;color:#0d2a38;font:inherit;font-weight:700;font-size:16px;cursor:pointer}';
  (document.head || root).appendChild(st);

  var entry = '', busy = false, tick = null;
  function showLock() {
    if (!enabled()) return;
    root.classList.add('mb-locked');
    if (!document.body) { document.addEventListener('DOMContentLoaded', showLock); return; }
    if (document.getElementById('mb-lock')) return;
    var d = document.createElement('div');
    d.id = 'mb-lock'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Enter PIN');
    var keys = '';
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (k) { keys += '<button data-k="' + k + '">' + k + '</button>'; });
    keys += '<button class="mb-small" data-k="clear">Clear</button><button data-k="0">0</button><button class="mb-small" data-k="del">Delete</button>';
    d.innerHTML =
      '<div class="mb-box" id="mb-main"><img src="icons/logo-64.png" alt=""><h1>Marina Bay\'s Cafe</h1><p id="mb-msg">Enter your PIN</p>' +
      '<div class="mb-dots" id="mb-dots"></div><div class="mb-pad" id="mb-pad">' + keys + '</div>' +
      '<button class="mb-link" id="mb-forgot">Forgot PIN?</button></div>' +
      '<div class="mb-box" id="mb-rec" hidden><img src="icons/logo-64.png" alt=""><h1>Reset the PIN</h1><p id="mb-rmsg">Enter the recovery code you wrote down when you set the PIN.</p>' +
      '<input id="mb-code" type="text" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX" aria-label="Recovery code">' +
      '<button class="mb-go" id="mb-reset">Reset PIN</button><button class="mb-link" id="mb-back">Back</button></div>';
    document.body.appendChild(d);
    d.querySelector('#mb-pad').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]'); if (!b) return; press(b.getAttribute('data-k'));
    });
    d.querySelector('#mb-forgot').onclick = function () { d.querySelector('#mb-main').hidden = true; d.querySelector('#mb-rec').hidden = false; d.querySelector('#mb-code').focus(); };
    d.querySelector('#mb-back').onclick = function () { d.querySelector('#mb-rec').hidden = true; d.querySelector('#mb-main').hidden = false; };
    d.querySelector('#mb-reset').onclick = recover;
    entry = ''; paintDots(); checkLockout();
  }
  function paintDots() {
    var el = document.getElementById('mb-dots'); if (!el) return;
    var n = (cfg.pin && cfg.pin.len) || 4, h = '';
    for (var i = 0; i < n; i++) h += '<i class="' + (i < entry.length ? 'on' : '') + '"></i>';
    el.innerHTML = h;
  }
  function say(msg, err) { var m = document.getElementById('mb-msg'); if (m) { m.textContent = msg; m.className = err ? 'err' : ''; } }
  function checkLockout() {
    var left = Math.ceil(((cfg.until || 0) - now()) / 1000), pad = document.getElementById('mb-pad');
    clearInterval(tick);
    if (left > 0) {
      if (pad) pad.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      say('Too many tries. Wait ' + left + ' seconds.', true);
      tick = setInterval(function () {
        var l = Math.ceil(((cfg.until || 0) - now()) / 1000);
        if (l <= 0) { clearInterval(tick); if (pad) pad.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); say('Enter your PIN'); }
        else say('Too many tries. Wait ' + l + ' seconds.', true);
      }, 1000);
    }
  }
  function press(k) {
    if (busy || (cfg.until || 0) > now()) return;
    if (k === 'del') entry = entry.slice(0, -1);
    else if (k === 'clear') entry = '';
    else if (entry.length < ((cfg.pin && cfg.pin.len) || 4)) entry += k;
    paintDots();
    say('Enter your PIN');
    if (entry.length === ((cfg.pin && cfg.pin.len) || 4)) submit();
  }
  async function submit() {
    busy = true;
    var ok = false;
    try { ok = canHash() && await check(cfg.pin, entry); } catch (e) { ok = false; }
    busy = false;
    if (ok) { cfg.fails = 0; cfg.until = 0; save(); unlock(); return; }
    cfg.fails = (cfg.fails || 0) + 1;
    entry = ''; paintDots();
    if (!canHash()) say('Open the app from its https link to unlock.', true);
    else if (cfg.fails >= MAX_FAILS) { cfg.until = now() + LOCKOUT_MS; cfg.fails = 0; save(); checkLockout(); }
    else { save(); say('Wrong PIN. Try again.', true); }
  }
  async function recover() {
    var code = normRecovery(document.getElementById('mb-code').value), msg = document.getElementById('mb-rmsg'), ok = false;
    try { ok = canHash() && !!cfg.recovery && await check(cfg.recovery, code); } catch (e) {}
    if (!ok) { msg.textContent = 'That code does not match.'; msg.className = 'err'; return; }
    delete cfg.pin; delete cfg.recovery; cfg.fails = 0; cfg.until = 0; save();
    markUnlocked(); hideLock();
    window.location.href = 'security.html?new=1';
  }
  function hideLock() {
    var d = document.getElementById('mb-lock'); if (d) d.remove();
    root.classList.remove('mb-locked'); clearInterval(tick); entry = '';
  }
  function unlock() { markUnlocked(); hideLock(); }
  function lockNow() { try { sessionStorage.removeItem(S_OK); } catch (e) {} showLock(); }

  /* ---------- auto lock ---------- */
  function guard() { if (enabled() && !unlockedNow()) showLock(); }
  var lastTouch = 0;
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach(function (t) {
    window.addEventListener(t, function () {
      var n = now(); if (n - lastTouch < 3000) return; lastTouch = n;
      if (unlockedNow()) touch();
    }, { passive: true, capture: true });
  });
  setInterval(guard, 10000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) guard(); });
  window.addEventListener('pageshow', guard);

  if (!unlockedNow()) showLock();

  /* ---------- used by security.html ---------- */
  window.MBSecurity = {
    enabled: enabled, canHash: canHash, lockNow: lockNow,
    auto: function () { return cfg.auto || 0; },
    setAuto: function (min) { cfg.auto = Math.max(0, +min || 0); save(); touch(); },
    verify: async function (pin) { return enabled() && canHash() && await check(cfg.pin, String(pin)); },
    // returns the recovery code (shown once)
    setPin: async function (pin) {
      pin = String(pin);
      if (!/^\d{4,6}$/.test(pin)) throw new Error('The PIN must be 4 to 6 digits');
      if (!canHash()) throw new Error('A PIN needs the https link of the app');
      var salt = randomHex(16), code = newRecoveryCode(), rs = randomHex(16);
      cfg.pin = { salt: salt, hash: await derive(pin, salt), len: pin.length };
      cfg.recovery = { salt: rs, hash: await derive(normRecovery(code), rs) };
      cfg.fails = 0; cfg.until = 0; if (cfg.auto === undefined) cfg.auto = 10;
      save(); markUnlocked(); return code;
    },
    removePin: function () { delete cfg.pin; delete cfg.recovery; cfg.fails = 0; cfg.until = 0; save(); },
    _check: guard
  };
})();
