/* Editable app settings: payment methods, discount presets, inventory units, auto-print.
   Defaults match the old hard-coded behavior. Stored under CFG_KEY. */
(function () {
  var KEY = 'marinabays_config_v1';
  function defaults() {
    return {
      autoPrint: true,
      methods: [{ id: 'cash', name: 'Cash', cash: true }, { id: 'ewallet', name: 'E-wallet', cash: false }],
      discounts: [
        { id: 'pwd', name: 'PWD', pct: 20 },
        { id: 'senior', name: 'Senior Citizen', pct: 20 },
        { id: 'employee', name: 'Employee', pct: 10 }
      ],
      units: ['pcs', 'box', 'pack', 'bottle']
    };
  }
  function load() {
    var d = defaults();
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      if (v) {
        if (typeof v.autoPrint === 'boolean') d.autoPrint = v.autoPrint;
        ['methods', 'discounts', 'units'].forEach(function (k) { if (Array.isArray(v[k]) && v[k].length) d[k] = v[k]; });
      }
    } catch (e) {}
    if (!d.methods.some(function (m) { return m.id === 'cash'; })) d.methods.unshift(defaults().methods[0]);
    return d;
  }
  var cfg = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); return true; } catch (e) { return false; } }
  function uid(p) { return p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  /* Safe reset: only settings, never sales, shifts, menu, inventory or recipes.
     A backup copy of the current settings is kept under KEY+'_backup' so it can be undone. */
  function resetSettings() {
    try { localStorage.setItem(KEY + '_backup', JSON.stringify(cfg)); } catch (e) {}
    cfg = defaults(); return save();
  }
  function undoReset() {
    try { var b = JSON.parse(localStorage.getItem(KEY + '_backup')); if (b) { cfg = b; return save(); } } catch (e) {}
    return false;
  }
  window.MBConfig = { get: function () { return cfg; }, save: save, uid: uid, defaults: defaults, resetSettings: resetSettings, undoReset: undoReset,
    hasBackup: function () { return !!localStorage.getItem(KEY + '_backup'); } };
})();
