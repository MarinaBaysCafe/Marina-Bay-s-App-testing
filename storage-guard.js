/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved.
   Storage guard. Browsers keep about 5 million characters per app. This measures how much is used, warns before it is full,
   and asks the browser not to clear the data when the phone is low on space. */
(function () {
  var LIMIT = 5000000, WARN_KEY = 'mb_store_warn';

  function usage() {
    var total = 0, rows = [], i, k, n;
    try {
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i); n = k.length + String(localStorage.getItem(k) || '').length;
        total += n; rows.push({ key: k, chars: n });
      }
    } catch (e) {}
    rows.sort(function (a, b) { return b.chars - a.chars; });
    return { used: total, limit: LIMIT, pct: Math.min(100, Math.round(total / LIMIT * 100)), top: rows.slice(0, 6) };
  }
  function text() {
    var u = usage(), m = Math.round(u.used / 100000) / 10;
    return u.pct + '% (' + m + ' million of about 5 million characters)';
  }
  // resolves true (protected), false (not protected) or null (this browser cannot tell)
  function persist() {
    try {
      if (!(navigator.storage && navigator.storage.persisted)) return Promise.resolve(null);
      return navigator.storage.persisted().then(function (p) { return p ? true : (navigator.storage.persist ? navigator.storage.persist() : false); }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  // one short message when the storage is getting full: once a day from 70%, once per visit from 90%
  function warn() {
    var u = usage(); if (u.pct < 70) return false;
    var day = new Date().toISOString().slice(0, 10), seen = '', sess = '';
    try { seen = localStorage.getItem(WARN_KEY) || ''; sess = sessionStorage.getItem(WARN_KEY) || ''; } catch (e) {}
    var high = u.pct >= 90;
    if (high ? sess : (seen === day || sess)) return false;
    try { sessionStorage.setItem(WARN_KEY, '1'); localStorage.setItem(WARN_KEY, day); } catch (e) {}
    var msg = high ? 'Storage is almost full (' + u.pct + '%). Save a backup now in Data, or new sales may not save.' : 'Storage is ' + u.pct + '% full. Save a backup in Data soon.';
    if (window.MBData && window.MBData.toast) window.MBData.toast(msg);
    return msg;
  }
  window.MBStorage = { usage: usage, text: text, persist: persist, warn: warn };
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(warn, 1500); persist(); });
  }
})();
