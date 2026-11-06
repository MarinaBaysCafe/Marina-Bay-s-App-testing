/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* Shared data for the point of sale, menu editor and recipes.
   The menu is data, not code. It starts from menu-default.js and, once edited in the app,
   is kept on the device under MENU_KEY. Recipes are kept under RECIPES_KEY. */
(function () {
  var MENU_KEY = 'marinabays_menu_v1';
  var RECIPES_KEY = 'marinabays_recipes_v1';
  var INV_KEY = 'marinabays_inventory_v1';

  function uid(p) { return (p || 'x') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function peso(n) { return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function pesoShort(n) {
    n = Number(n);
    return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- menu ---------- */
  function defaultMenu() {
    var d = window.MB_DEFAULT_MENU ? clone(window.MB_DEFAULT_MENU) : { categories: [], items: [], addonGroups: [] };
    d.addonGroups = d.addonGroups || [];
    return d;
  }
  function loadMenu() {
    try {
      var m = JSON.parse(localStorage.getItem(MENU_KEY));
      if (m && Array.isArray(m.categories) && Array.isArray(m.items)) { m.addonGroups = m.addonGroups || []; return m; }
    } catch (e) {}
    return defaultMenu();
  }
  var menu = loadMenu();
  function saveMenu() { try { localStorage.setItem(MENU_KEY, JSON.stringify(menu)); return true; } catch (e) { return false; } }
  function resetMenu() { menu = defaultMenu(); saveMenu(); return menu; }
  function setMenu(m) { menu = m; menu.addonGroups = menu.addonGroups || []; return saveMenu(); }
  function getMenu() { return menu; }

  function cat(id) { return menu.categories.filter(function (c) { return c.id === id; })[0] || null; }
  function item(id) { return menu.items.filter(function (i) { return i.id === id; })[0] || null; }
  function itemsIn(catId) { return menu.items.filter(function (i) { return i.cat === catId; }); }
  function addonsFor(catId) {
    var out = [];
    menu.addonGroups.forEach(function (g) { if ((g.cats || []).indexOf(catId) !== -1) out.push(g); });
    return out;
  }
  function priceText(it) {
    var p = (it.options || []).map(function (o) { return Number(o.price); }).filter(function (n) { return !isNaN(n); });
    if (!p.length) return 'No price';
    var lo = Math.min.apply(null, p), hi = Math.max.apply(null, p);
    return lo === hi ? pesoShort(lo) : pesoShort(lo) + ' to ' + pesoShort(hi);
  }
  function plainOption(it) { return it.options && it.options.length === 1 && (it.options[0].label === 'Regular' || !it.options[0].label); }

  /* ---------- recipes ---------- */
  function loadRecipes() {
    try { var r = JSON.parse(localStorage.getItem(RECIPES_KEY)); if (r && Array.isArray(r.recipes)) return r; } catch (e) {}
    return { recipes: [] };
  }
  var recipes = loadRecipes();
  function saveRecipes() { try { localStorage.setItem(RECIPES_KEY, JSON.stringify(recipes)); return true; } catch (e) { return false; } }
  function getRecipes() { return recipes; }
  function setRecipes(r) { recipes = r; return saveRecipes(); }
  function recipeCost(r) {
    var t = 0; (r.ingredients || []).forEach(function (g) { t += Number(g.c) || 0; }); return t;
  }

  /* ---------- inventory ---------- */
  function defaultInventory() {
    var d = window.MB_DEFAULT_INVENTORY ? clone(window.MB_DEFAULT_INVENTORY) : { items: [] };
    d.items = d.items || [];
    return d;
  }
  /* old list -> new sheet layout: same-name items keep their count, unit and note; old items that held stock and are not on the new list are kept under "Bar" */
  function migrateInventory(old) {
    var d = defaultInventory(), left = old.items.slice();
    d.items.forEach(function (n) {
      var k = left.findIndex(function (o) { return String(o.name).toLowerCase() === n.name.toLowerCase(); });
      if (k < 0) return; var o = left.splice(k, 1)[0];
      n.qty = o.qty; n.unit = o.unit || ''; n.note = o.note || ''; n.updated = o.updated || '';
    });
    left.forEach(function (o) { if (o.qty > 0) { o.group = 'Bar'; d.items.push(o); } });
    d.countedOn = old.countedOn || ''; try { localStorage.setItem(INV_KEY, JSON.stringify(d)); } catch (e) {}
    return d;
  }
  function loadInventory() {
    try {
      var v = JSON.parse(localStorage.getItem(INV_KEY));
      if (v && Array.isArray(v.items)) {
        var want = (window.MB_DEFAULT_INVENTORY || {}).layout || 1;
        var cur = v.layout || (v.items.some(function (i) { return i.group === 'Stockroom'; }) ? want : 1);
        return cur < want ? migrateInventory(v) : v;
      }
    } catch (e) {}
    return defaultInventory();
  }
  var inventory = loadInventory();
  function saveInventory() { try { localStorage.setItem(INV_KEY, JSON.stringify(inventory)); return true; } catch (e) { return false; } }
  function getInventory() { return inventory; }
  function setInventory(v) { inventory = v; return saveInventory(); }
  function resetInventory() { inventory = defaultInventory(); saveInventory(); return inventory; }

  /* ---------- files ---------- */
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function todayPH() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function toast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove('on'); }, 2000);
  }

  window.MBData = {
    uid: uid, clone: clone, peso: peso, pesoShort: pesoShort, esc: esc, download: download, todayPH: todayPH, toast: toast,
    getMenu: getMenu, setMenu: setMenu, saveMenu: saveMenu, resetMenu: resetMenu, defaultMenu: defaultMenu,
    cat: cat, item: item, itemsIn: itemsIn, addonsFor: addonsFor, priceText: priceText, plainOption: plainOption,
    getInventory: getInventory, setInventory: setInventory, saveInventory: saveInventory, resetInventory: resetInventory,
    getRecipes: getRecipes, setRecipes: setRecipes, saveRecipes: saveRecipes, recipeCost: recipeCost
  };
})();
