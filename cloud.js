/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved.

   Cloud sync for the Marina Bay's Cafe apps.

   The apps keep working from the phone's own storage (fast, and fine offline). This file copies
   changes to Firebase in the background and brings in changes made on other phones.

   How it merges: every list (menu, inventory, recipes, counter days, expense days) is split into
   small records. Each record is saved on its own, so two phones changing different items never
   overwrite each other. If two phones change the SAME record, stock quantities are added up (each phone's change counts)
   and expense lists keep both phones' entries. Other records: the one saved last wins. A phone never writes over
   a record that changed in the cloud since it last looked; it merges first.
   A phone that has never synced a list takes the cloud version of records that already exist there,
   and uploads the records the cloud does not have yet.

   Load order on each page:  firebase-config.js, then this file (data-uses="menu,inventory" etc. says
   which lists the page holds in memory, so the page is reloaded when those change). */
(function () {
  var cfg = window.MB_FIREBASE_CONFIG || null;
  var META_KEY = 'marinabays_sync_v2', OLD_META_KEY = 'marinabays_sync_v1', ON_KEY = 'marinabays_cloud_on';
  var FB_BASE = 'https://www.gstatic.com/firebasejs/10.14.1/';
  var LS = window.localStorage;
  var origSet = Storage.prototype.setItem, origGet = Storage.prototype.getItem;
  var me = document.currentScript;
  var uses = {};
  String((me && me.getAttribute('data-uses')) || '').split(',').forEach(function (s) { s = s.trim(); if (s) uses[s] = true; });

  /* ---------- turning lists into records ---------- */
  function S(o) { return JSON.stringify(o); }
  function ids(arr) { return (arr || []).map(function (x) { return x.id; }); }
  function collect(m, prefix) {
    var out = {};
    Object.keys(m).forEach(function (k) { if (k.indexOf(prefix) === 0) out[k.slice(prefix.length)] = JSON.parse(m[k]); });
    return out;
  }
  function ordered(byId, order) {
    var out = [], seen = {};
    (order || []).forEach(function (id) { if (byId[id] && !seen[id]) { out.push(byId[id]); seen[id] = 1; } });
    Object.keys(byId).sort().forEach(function (id) { if (!seen[id]) out.push(byId[id]); });
    return out;
  }
  function ord(m) { try { return m.ord ? JSON.parse(m.ord) : {}; } catch (e) { return {}; } }

  /* ---------- merging two versions of one record ---------- */
  function jparse(x) { try { return JSON.parse(x); } catch (e) { return undefined; } }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  // a stock item changed on two phones: the quantity change of each phone is added up, and a phone's own other edits stay
  function mergeItem(bs, ls, cs) {
    var b = jparse(bs), l = jparse(ls), c = jparse(cs);
    if (!b || !l || !c || typeof b !== 'object') return null;
    if (typeof b.qty !== 'number' || typeof l.qty !== 'number' || typeof c.qty !== 'number') return null;
    var out = {}, k;
    for (k in c) out[k] = c[k];
    for (k in l) if (!same(l[k], b[k])) out[k] = l[k];
    out.qty = Math.max(0, Math.round((c.qty + (l.qty - b.qty)) * 10000) / 10000);
    return S(out);
  }
  // a list of entries (expenses of one day): keep what both phones added, keep what either phone removed, own edits win
  function mergeList(bs, ls, cs, key) {
    var b = bs == null ? [] : jparse(bs), l = jparse(ls), c = jparse(cs);
    if (!Array.isArray(b) || !Array.isArray(l) || !Array.isArray(c)) return null;
    var kf = key ? function (x) { return x && x[key]; } : function (x) { return typeof x === 'string' ? x : null; };
    var B = Object.create(null), L = Object.create(null), C = Object.create(null), ok = true;
    function idx(arr, M) { arr.forEach(function (x) { var k = kf(x); if (k == null) ok = false; else M[k] = x; }); }
    idx(b, B); idx(l, L); idx(c, C);
    if (!ok) return null;
    var out = [], seen = Object.create(null);
    function take(x) {
      var k = kf(x); if (seen[k]) return; seen[k] = 1;
      var inB = k in B, inL = k in L, inC = k in C;
      if (inB && (!inL || !inC)) return;
      if (inL && inC) out.push(same(L[k], B[k]) ? C[k] : L[k]);
      else out.push(inL ? L[k] : C[k]);
    }
    l.forEach(take); c.forEach(take);
    return S(out);
  }

  var DS = {
    menu: {
      key: 'marinabays_menu_v1', coll: 'sync_menu',
      to: function (o) {
        var m = {};
        (o.categories || []).forEach(function (c) { m['cat:' + c.id] = S(c); });
        (o.items || []).forEach(function (i) { m['item:' + i.id] = S(i); });
        (o.addonGroups || []).forEach(function (g) { m['grp:' + g.id] = S(g); });
        m.ord = S({ cats: ids(o.categories), items: ids(o.items), grps: ids(o.addonGroups) });
        return m;
      },
      from: function (m) {
        var od = ord(m);
        return { categories: ordered(collect(m, 'cat:'), od.cats), items: ordered(collect(m, 'item:'), od.items), addonGroups: ordered(collect(m, 'grp:'), od.grps) };
      }
    },
    inventory: {
      key: 'marinabays_inventory_v1', coll: 'sync_inventory',
      to: function (o) {
        var m = {};
        (o.items || []).forEach(function (i) { m['item:' + i.id] = S(i); });
        m.ord = S({ items: ids(o.items), countedOn: o.countedOn || '', layout: o.layout || 0 });
        return m;
      },
      from: function (m, ex) {
        var od = ord(m);
        return { countedOn: od.countedOn || (ex && ex.countedOn) || '', layout: od.layout || 0, items: ordered(collect(m, 'item:'), od.items) };
      }
    },
    recipes: {
      key: 'marinabays_recipes_v1', coll: 'sync_recipes',
      to: function (o) { var m = {}; (o.recipes || []).forEach(function (r) { m['rec:' + r.id] = S(r); }); return m; },
      from: function (m) {
        var list = []; var c = collect(m, 'rec:');
        Object.keys(c).forEach(function (id) { list.push(c[id]); });
        list.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
        return { recipes: list };
      }
    },
    counter: {
      key: 'marinabays_money_v1', coll: 'sync_counter',
      to: function (o) {
        var m = {};
        Object.keys(o).forEach(function (d) {
          var r = o[d]; if (!r) return;
          var any = (Number(r.online) || 0) > 0;
          Object.keys(r.counts || {}).forEach(function (k) { if (r.counts[k] > 0) any = true; });
          if (any) m['day:' + d] = S(r);
        });
        return m;
      },
      from: function (m) { return collect(m, 'day:'); }
    },
    sales: {
      key: 'marinabays_sales_v1', coll: 'sync_sales',
      to: function (o) { var m = {}; (o.sales || []).forEach(function (s) { m['sale:' + s.id] = S(s); }); return m; },
      from: function (m) {
        var c = collect(m, 'sale:'), list = [];
        Object.keys(c).forEach(function (id) { list.push(c[id]); });
        list.sort(function (a, b) { return a.t - b.t; });
        return { sales: list };
      }
    },
    shifts: {
      key: 'marinabays_shifts_v1', coll: 'sync_shifts',
      to: function (o) {
        var m = {};
        (o.hist || []).forEach(function (h) { m['hist:' + h.no] = S(h); });
        m.cur = S(o.cur || null); m.meta = S({ nextNo: o.nextNo || 1 });
        return m;
      },
      from: function (m) {
        var c = collect(m, 'hist:'), list = [], top = 0;
        Object.keys(c).forEach(function (no) { list.push(c[no]); if (c[no].no > top) top = c[no].no; });
        list.sort(function (a, b) { return a.no - b.no; });
        var cur = m.cur ? JSON.parse(m.cur) : null, next = m.meta ? JSON.parse(m.meta).nextNo || 1 : 1;
        return { nextNo: Math.max(next, top + 1, cur ? cur.no + 1 : 1), cur: cur, hist: list };
      }
    },
    config: {
      key: 'marinabays_config_v1', coll: 'sync_config',
      to: function (o) { return { cfg: S(o) }; },
      from: function (m) { try { return m.cfg ? JSON.parse(m.cfg) : {}; } catch (e) { return {}; } }
    },
    invlog: {
      key: 'marinabays_invlog_v2', coll: 'sync_invlog',
      to: function (o) {
        var m = {};
        Object.keys(o.days || {}).forEach(function (d) {
          Object.keys(o.days[d] || {}).forEach(function (id) { if ((o.days[d][id] || []).length) m['e:' + d + '|' + id] = S(o.days[d][id]); });
        });
        return m;
      },
      from: function (m) {
        var days = {};
        Object.keys(m).forEach(function (k) {
          if (k.indexOf('e:') !== 0) return;
          var p = k.slice(2).split('|'), d = p[0], id = p.slice(1).join('|');
          (days[d] = days[d] || {})[id] = JSON.parse(m[k]);
        });
        return { days: days };
      }
    },
    expenses: {
      key: 'marinabays_expenses_v1', coll: 'sync_expenses',
      to: function (o) {
        var m = {};
        Object.keys(o.days || {}).forEach(function (d) { if ((o.days[d] || []).length) m['day:' + d] = S(o.days[d]); });
        m.cats = S(o.cats || []);
        return m;
      },
      from: function (m, ex) {
        ex = ex || {};
        return { days: collect(m, 'day:'), cats: m.cats ? JSON.parse(m.cats) : (ex.cats || []), lastCat: ex.lastCat || '', lastSrc: ex.lastSrc || 'cash' };
      }
    }
  };
  DS.inventory.merge = function (id, b, l, c) { return id.indexOf('item:') === 0 ? mergeItem(b, l, c) : null; };
  DS.expenses.merge = function (id, b, l, c) { return id.indexOf('day:') === 0 ? mergeList(b, l, c, 'id') : (id === 'cats' ? mergeList(b, l, c, null) : null); };
  function mergeRec(n, id, b, l, c) { var f = DS[n].merge; if (!f) return null; try { return f(id, b, l, c); } catch (e) { return null; } }
  function toApply(r) { return r.merge ? { id: r.id, v: r.mv, cv: r.v, d: 0 } : r; }
  var NAMES = Object.keys(DS);
  var KEYMAP = {}; NAMES.forEach(function (n) { KEYMAP[DS[n].key] = n; });

  /* ---------- what was last synced (per record) ---------- */
  /* What each record looked like at the last sync is kept as a short fingerprint (h), not as a second full copy.
     Only the lists that are merged (stock items, expense days) keep the full text (v), because a merge needs it. */
  function H(str) {
    str = String(str); var h1 = 0xdeadbeef, h2 = 0x41c6ce57, ch, i;
    for (i = 0; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + '.' + str.length.toString(36);
  }
  function mk(n, v, d) { var r = { h: H(v || ''), d: d ? 1 : 0 }; if (!d && DS[n] && DS[n].merge) r.v = v; return r; }
  var meta = (function () {
    try {
      var m = JSON.parse(origGet.call(LS, META_KEY));
      if (m && m.ds) {
        if (m.v1At && Date.now() - m.v1At > 7 * 86400000) { try { LS.removeItem(OLD_META_KEY); } catch (e) {} }   // the older copy is dropped after a week
        return m;
      }
    } catch (e) {}
    try {       // first start of this version: build the compact copy from the older one. The older one stays for a week, so going back to the older app still works.
      var o = JSON.parse(origGet.call(LS, OLD_META_KEY));
      if (o && o.ds) {
        Object.keys(o.ds).forEach(function (n) { var rec = o.ds[n].rec || {}; Object.keys(rec).forEach(function (id) { rec[id] = mk(n, rec[id].v || '', rec[id].d); }); });
        o.v = 2; o.v1At = Date.now();
        try { origSet.call(LS, META_KEY, JSON.stringify(o)); } catch (e) {}
        return o;
      }
    } catch (e) {}
    return { v: 2, ds: {}, last: 0 };
  })();
  function saveMeta() { try { origSet.call(LS, META_KEY, JSON.stringify(meta)); } catch (e) {} }
  function dm(n) { return meta.ds[n] || (meta.ds[n] = { init: false, since: 0, rec: {} }); }
  function readObj(n) { try { var r = origGet.call(LS, DS[n].key); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
  function localMap(n) { var o = readObj(n); if (!o) return null; try { return DS[n].to(o); } catch (e) { return null; } }

  // records that differ from what was last synced
  function diff(n) {
    var lm = localMap(n); if (!lm) return [];
    var sh = dm(n).rec, out = [], pm = pend[n] || {};
    Object.keys(lm).forEach(function (id) { var s = sh[id]; if (pm[id] && pm[id].merge) return; if (!s || s.d || s.h !== H(lm[id])) out.push({ id: id, v: lm[id], d: 0 }); });
    Object.keys(sh).forEach(function (id) { if (!sh[id].d && !(id in lm)) out.push({ id: id, v: '', d: 1 }); });
    return out;
  }
  function pendingCounts() { var o = {}; NAMES.forEach(function (n) { o[n] = dm(n).init ? diff(n).length : 0; }); return o; }

  /* ---------- status ---------- */
  var st = { state: cfg ? 'idle' : 'off', msg: '', last: meta.last || 0, user: null };
  var listeners = [];
  function setStatus(state, msg) {
    st.state = state; st.msg = msg || ''; st.last = meta.last || 0;
    listeners.slice().forEach(function (f) { try { f(getStatus()); } catch (e) {} });
  }
  function getStatus() { return { state: st.state, msg: st.msg, last: st.last, user: st.user, configured: !!cfg }; }
  function friendly(e) {
    var c = (e && (e.code || e.message)) || String(e);
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(c)) return 'Wrong email or password.';
    if (/too-many-requests/.test(c)) return 'Too many tries. Wait a few minutes and try again.';
    if (/network|unavailable|offline|dynamically imported|Failed to fetch|import/i.test(c)) return 'Could not reach Firebase. Check the internet connection. The apps keep working and will sync later.';
    if (/permission-denied/.test(c)) return 'Firebase refused this account. Check the Firestore rules and that the account exists.';
    if (/operation-not-allowed/.test(c)) return 'Email/Password sign-in is not turned on in Firebase.';
    return String(c);
  }

  /* ---------- real Firebase (can be replaced for tests) ---------- */
  function firebaseBackend() {
    var FB = null;
    function load() {
      if (FB) return Promise.resolve(FB);
      return Promise.all([import(FB_BASE + 'firebase-app.js'), import(FB_BASE + 'firebase-auth.js'), import(FB_BASE + 'firebase-firestore.js')]).then(function (m) {
        var app = m[0].initializeApp(cfg);
        FB = { au: m[1], fs: m[2], auth: m[1].getAuth(app), db: m[2].getFirestore(app) };
        try { m[1].getRedirectResult(FB.auth).catch(function () {}); } catch (e) {}
        return FB;
      });
    }
    return {
      init: function () { return load(); },
      onAuth: function (cb) { FB.au.onAuthStateChanged(FB.auth, function (u) { cb(u ? { email: u.email, uid: u.uid } : null); }); },
      signIn: function (email, pw) { return FB.au.signInWithEmailAndPassword(FB.auth, email, pw); },
      // Google sign-in: a popup first, and a full-page redirect when the popup cannot open (some phones and installed apps)
      signInGoogle: async function () {
        var provider = new FB.au.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        try { return await FB.au.signInWithPopup(FB.auth, provider); }
        catch (e) {
          if (e && /popup-blocked|operation-not-supported-in-this-environment|web-storage-unsupported/.test(e.code || '')) {
            try { origSet.call(LS, ON_KEY, '1'); } catch (x) {}
            return FB.au.signInWithRedirect(FB.auth, provider);
          }
          throw e;
        }
      },
      signOut: function () { return FB.au.signOut(FB.auth); },
      setMany: function (coll, docs) {
        var F = FB.fs, chunks = [], i;
        for (i = 0; i < docs.length; i += 400) chunks.push(docs.slice(i, i + 400));
        return chunks.reduce(function (p, ch) {
          return p.then(function () {
            var b = F.writeBatch(FB.db);
            ch.forEach(function (d) { b.set(F.doc(FB.db, coll, d.id), { v: d.data.v, d: d.data.d, by: d.data.by, s: F.serverTimestamp() }); });
            return b.commit();
          });
        }, Promise.resolve());
      },
      // the public menu: one small document anyone can read (see firestore.rules). Staff only can write it.
      publishMenu: async function (json, email) {
        var F = FB.fs;
        await F.setDoc(F.doc(FB.db, 'public_menu', 'current'), { json: String(json), by: String(email || ''), t: F.serverTimestamp() });
      },
      // write only if the cloud still holds the version this phone last saw; otherwise hand the cloud version back
      setManyChecked: async function (coll, docs, H) {
        var F = FB.fs, res = { written: [], conflicts: [] }, i;
        for (i = 0; i < docs.length; i += 100) {
          var ch = docs.slice(i, i + 100);
          var r = await F.runTransaction(FB.db, async function (tx) {
            var refs = ch.map(function (d) { return F.doc(FB.db, coll, d.id); });
            var snaps = await Promise.all(refs.map(function (rf) { return tx.get(rf); }));
            var out = { written: [], conflicts: [] };
            snaps.forEach(function (sn, k) {
              var d = ch[k], x = sn.exists() ? sn.data() : null;
              if (x && !(H(String(x.v || '')) === d.expect.h && (x.d ? 1 : 0) === d.expect.d)) out.conflicts.push({ id: d.id, v: x.v || '', d: x.d ? 1 : 0, s: x.s && x.s.toMillis ? x.s.toMillis() : 0 });
              else { tx.set(refs[k], { v: d.data.v, d: d.data.d, by: d.data.by, s: F.serverTimestamp() }); out.written.push(d.id); }
            });
            return out;
          });
          res.written = res.written.concat(r.written); res.conflicts = res.conflicts.concat(r.conflicts);
        }
        return res;
      },
      listen: function (coll, sinceMs, cb, onErr) {
        var F = FB.fs;
        var q = sinceMs ? F.query(F.collection(FB.db, coll), F.where('s', '>=', F.Timestamp.fromMillis(sinceMs))) : F.collection(FB.db, coll);
        return F.onSnapshot(q, function (snap) {
          var docs = [];
          snap.docChanges().forEach(function (ch) {
            if (ch.type === 'removed') return;
            var x = ch.doc.data({ serverTimestamps: 'estimate' });
            docs.push({ id: ch.doc.id, v: x.v || '', d: x.d ? 1 : 0, s: x.s && x.s.toMillis ? x.s.toMillis() : 0 });
          });
          cb(docs, !!snap.metadata.fromCache);
        }, onErr);
      }
    };
  }
  var backend = window.MBCloudBackend || firebaseBackend();

  /* ---------- reading from the cloud ---------- */
  var user = null, started = false, unsubs = [], applying = false, pend = {};
  var interacted = false, loadedAt = Date.now();
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (t) { window.addEventListener(t, function () { interacted = true; }, { capture: true, passive: true }); });

  function updateSince(n, docs) { var d = dm(n); docs.forEach(function (r) { if (r.s && r.s > d.since) d.since = r.s; }); }

  function classify(n, r, lm) {
    var d = dm(n), sh = d.rec[r.id];
    if (sh && sh.h === H(r.v || '') && !!sh.d === !!r.d) return 'same';
    var lv = lm[r.id];
    if (r.d ? lv === undefined : lv === r.v) return 'adopt';
    var base = sh && !sh.d ? sh.v : undefined;
    return lv !== base ? 'localwins' : 'fresh';
  }
  function applyRecs(n, recs) {
    var d = dm(n), m = localMap(n) || {}, nr = [];
    recs.forEach(function (r) {
      if (r.d) { delete m[r.id]; nr.push([r.id, { v: '', d: 1 }]); }
      else { m[r.id] = r.v; nr.push([r.id, mk(n, r.cv != null ? r.cv : r.v, 0)]); }
    });
    var obj = DS[n].from(m, readObj(n));
    applying = true;
    try { origSet.call(LS, DS[n].key, JSON.stringify(obj)); }
    catch (e) {
      // the phone could not store the new data (probably full). Do NOT mark these records as synced:
      // otherwise the next upload would read them as deleted on this phone and delete them for everyone.
      d.init = false; saveMeta();
      setStatus('error', 'This phone could not save the latest data. Storage may be full. Download a backup, then free some space.');
      return false;
    } finally { applying = false; }
    nr.forEach(function (x) { d.rec[x[0]] = x[1]; });
    saveMeta();
    return true;
  }
  function reloadSoon() {
    try {
      var last = +sessionStorage.getItem('mb_cloud_reload') || 0;
      if (Date.now() - last < 10000) return false;
      sessionStorage.setItem('mb_cloud_reload', String(Date.now()));
    } catch (e) {}
    setTimeout(function () { window.location.reload(); }, 300);
    return true;
  }

  // first time this phone reads a list: the cloud wins for records that exist there, local-only records get uploaded
  function initial(n, docs) {
    var d = dm(n), lm = localMap(n) || {}, take = [];
    docs.forEach(function (r) {
      var has = r.id in lm;
      if (r.d) { if (has) take.push(r); else d.rec[r.id] = mk(n, '', 1); return; }
      if (has && lm[r.id] === r.v) { d.rec[r.id] = mk(n, r.v, 0); return; }
      if (has) { var mv0 = mergeRec(n, r.id, undefined, lm[r.id], r.v); if (mv0 != null && mv0 !== r.v) { take.push({ id: r.id, v: mv0, cv: r.v, d: 0 }); return; } }
      take.push(r);
    });
    if (take.length && !applyRecs(n, take)) return;   // keep the cursor and stay un-initialised, so this retries
    updateSince(n, docs);
    d.init = true; saveMeta();
    if (take.length && uses[n]) reloadSoon();
    push(n);
  }

  function incremental(n, docs) {
    var d = dm(n), lm = localMap(n) || {}, fresh = [];
    docs.forEach(function (r) {
      var c = classify(n, r, lm);
      if (c === 'adopt') d.rec[r.id] = mk(n, r.d ? '' : r.v, r.d);
      else if (c === 'fresh') fresh.push(r);
      else if (c === 'localwins') {
        // this phone changed the record too: the cloud version becomes the starting point and the local change goes up on top of it
        var sh = d.rec[r.id], pm = pend[n] && pend[n][r.id];
        var base = pm && pm.merge ? pm.base : (sh && !sh.d ? sh.v : undefined);
        var mv = r.d ? null : mergeRec(n, r.id, base, lm[r.id], r.v);
        d.rec[r.id] = mk(n, r.d ? '' : r.v, r.d);
        if (mv != null && mv !== lm[r.id]) fresh.push({ id: r.id, v: r.v, d: 0, merge: true, base: base, mv: mv });
      }
    });
    updateSince(n, docs); saveMeta();
    if (!fresh.length) return;
    if (!uses[n]) { applyRecs(n, fresh.map(toApply)); return; }       // this page does not hold that list in memory
    if (!interacted && Date.now() - loadedAt < 8000 && reloadSoon()) { applyRecs(n, fresh.map(toApply)); return; }
    var p = pend[n] || (pend[n] = {});
    fresh.forEach(function (r) { p[r.id] = r; });
    banner();
  }

  /* ---------- writing to the cloud ---------- */
  var timers = {}, pushing = {};
  function schedule(n) { clearTimeout(timers[n]); timers[n] = setTimeout(function () { push(n); }, 1200); }
  async function push(n) {
    if (!user || !backend || pushing[n]) return;
    var d = dm(n); if (!d.init) return;
    var ch = diff(n); if (!ch.length) return;
    pushing[n] = true;
    try {
      var known = [], plain = [], conflicts = [];
      function doc(c) { return { id: c.id, data: { v: c.v, d: c.d, by: user.email || '' } }; }
      ch.forEach(function (c) { (d.rec[c.id] && backend.setManyChecked ? known : plain).push(c); });
      if (plain.length) {                                   // records the cloud has never seen from this phone
        await backend.setMany(DS[n].coll, plain.map(doc));
        plain.forEach(function (c) { d.rec[c.id] = mk(n, c.v, c.d); if (pend[n]) delete pend[n][c.id]; });
      }
      if (known.length) {                                   // records that exist: only write over the version this phone last saw
        var res = await backend.setManyChecked(DS[n].coll, known.map(function (c) {
          var x = doc(c), sh = d.rec[c.id]; x.expect = { h: sh.h, d: sh.d ? 1 : 0 }; return x;
        }), H);
        var bad = {}; res.conflicts.forEach(function (x) { bad[x.id] = 1; });
        known.forEach(function (c) { if (!bad[c.id]) { d.rec[c.id] = mk(n, c.v, c.d); if (pend[n]) delete pend[n][c.id]; } });
        conflicts = res.conflicts;
      }
      meta.last = Date.now(); saveMeta(); setStatus('synced');
      if (conflicts.length) incremental(n, conflicts);      // someone else changed it first: merge, then upload again
    } catch (e) { setStatus(/offline|unavailable|network|Failed to fetch/i.test(String((e && (e.code || e.message)) || e)) ? 'offline' : 'error', friendly(e)); }
    pushing[n] = false;
    if (diff(n).length) schedule(n);   // changes made while sending
  }
  function flush() { NAMES.forEach(function (n) { push(n); }); }

  // notice every save the apps make to a synced list
  if (cfg) {
    Storage.prototype.setItem = function (k, v) {
      origSet.apply(this, arguments);
      if (!applying && this === LS && KEYMAP[k]) schedule(KEYMAP[k]);
    };
  }

  /* ---------- start and stop ---------- */
  function begin() {
    end(); setStatus('syncing');
    NAMES.forEach(function (n) {
      var d = dm(n);
      unsubs.push(backend.listen(DS[n].coll, d.init ? d.since : 0, function (docs, fromCache) {
        if (!dm(n).init) { if (fromCache) return; initial(n, docs); }
        else { if (fromCache && !docs.length) return; incremental(n, docs); }
        if (st.state !== 'error') setStatus('synced');
      }, function (err) { setStatus('error', friendly(err)); }));
    });
  }
  function end() { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; }

  async function start() {
    if (!cfg) { setStatus('off', 'Firebase is not set up.'); return; }
    if (started) return;
    started = true; setStatus('connecting');
    try {
      await backend.init(cfg);
      backend.onAuth(function (u) {
        user = u; st.user = u ? u.email : null;
        if (u) begin(); else { end(); setStatus('signedout'); }
      });
    } catch (e) { started = false; setStatus('offline', friendly(e)); }
  }

  /* ---------- small bar when another phone changed something ---------- */
  function banner() {
    if (document.getElementById('mb-cloud-bar') || !document.body) return;
    var b = document.createElement('div');
    b.id = 'mb-cloud-bar';
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9998;background:#0d3a4e;color:#fff;font:14px system-ui,sans-serif;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center';
    b.innerHTML = '<span>Updated on another phone.</span><button style="border:1.5px solid #fff;background:none;color:#fff;border-radius:6px;font:inherit;padding:4px 12px;cursor:pointer">Refresh</button>';
    b.querySelector('button').onclick = function () {
      NAMES.forEach(function (n) {
        var p = pend[n]; if (!p) return;
        var lm = localMap(n) || {}, take = [];
        Object.keys(p).forEach(function (id) {
          var r = p[id];
          if (r.merge) { var mv = mergeRec(n, id, r.base, lm[id], r.v); if (mv != null && mv !== lm[id]) take.push({ id: id, v: mv, cv: r.v, d: 0 }); }
          else if (classify(n, r, lm) === 'fresh') take.push(r);
        });
        if (take.length) applyRecs(n, take);
      });
      pend = {}; window.location.reload();
    };
    document.body.appendChild(b);
  }

  /* ---------- for the Sync page ---------- */
  window.MBCloud = {
    configured: !!cfg,
    status: getStatus,
    onStatus: function (f) { listeners.push(f); },
    names: NAMES.slice(),
    pending: pendingCounts,
    publishMenu: async function (json) {
      if (!user) throw new Error('Sign in on the Sync page first.');
      if (!backend || !backend.publishMenu) throw new Error('Publishing is not available here.');
      await backend.publishMenu(json, user.email || '');
    },
    start: start,
    signIn: async function (email, pw) {
      await start();
      if (!started) throw new Error(st.msg || 'Could not reach Firebase');
      await backend.signIn(String(email).trim(), pw);
      try { origSet.call(LS, ON_KEY, '1'); } catch (e) {}
    },
    signInGoogle: async function () {
      await start();
      if (!started) throw new Error(st.msg || 'Could not reach Firebase');
      await backend.signInGoogle();
      try { origSet.call(LS, ON_KEY, '1'); } catch (e) {}
    },
    signOut: async function () {
      try { origSet.call(LS, ON_KEY, '0'); } catch (e) {}
      end(); if (started) await backend.signOut();
    },
    syncNow: function () { if (!user) return Promise.resolve(); flush(); return Promise.resolve(); },
    // forget what was synced; the next sync treats the cloud as the source for records it has
    resync: function () { end(); meta.ds = {}; saveMeta(); if (user) begin(); }
  };

  /* ---------- automatic ---------- */
  window.addEventListener('online', function () { if (cfg && origGet.call(LS, ON_KEY) === '1') { if (!started) start(); else flush(); } });
  document.addEventListener('visibilitychange', function () { if (document.hidden) flush(); });
  setInterval(function () { if (user) flush(); }, 60000);
  if (cfg && origGet.call(LS, ON_KEY) === '1') start();
})();
