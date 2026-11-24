/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* Money in whole centavos (integers). Not used by the app screens yet: this is the tested base for the
   discount, VAT and centavo work. All rounding is "half up" and done with integer maths only. */
(function (root) {
  'use strict';
  function sign(n) { return n < 0 ? -1 : 1; }
  // peso amount (number or text like "12.50") -> whole centavos. toPrecision removes float noise (1.005 * 100 = 100.49999...)
  function toC(pesos) {
    var n = Number(pesos); if (!isFinite(n)) return 0;
    return sign(n) * Math.round(Number((Math.abs(n) * 100).toPrecision(12)));
  }
  function fromC(c) { return c / 100; }
  function fmt(c) {
    c = Math.round(c) || 0;
    var a = Math.abs(c), whole = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ','), r = a % 100;
    return (c < 0 ? '-' : '') + whole + '.' + (r < 10 ? '0' : '') + r;
  }
  // a * num / den, rounded half up (integers in, integer out)
  function mulDiv(a, num, den) {
    var s = sign(a) * sign(num), x = Math.abs(a) * Math.abs(num);
    return s * Math.floor((2 * x + den) / (2 * den));
  }
  // percent of an amount. pct may have up to 2 decimals (7.5, 12.5, 20)
  function pctC(cents, pct) { return mulDiv(cents, Math.round(pct * 100), 10000); }
  // share a total over weights so the parts add up exactly (largest remainder). Parts are >= 0 for total >= 0.
  function split(total, weights) {
    var n = weights.length, sum = 0, i;
    for (i = 0; i < n; i++) sum += weights[i];
    var out = [], rem = [], used = 0;
    if (!n) return out;
    if (sum <= 0) { for (i = 0; i < n; i++) out.push(i === 0 ? total : 0); return out; }
    for (i = 0; i < n; i++) {
      var q = Math.floor(total * weights[i] / sum);
      out.push(q); rem.push({ i: i, r: total * weights[i] - q * sum }); used += q;
    }
    rem.sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    for (var k = 0; k < total - used; k++) out[rem[k % n].i] += 1;
    return out;
  }
  // price that already includes VAT -> { net, vat }
  function vatSplit(grossC, ratePct) {
    var net = mulDiv(grossC, 10000, 10000 + Math.round(ratePct * 100));
    return { net: net, vat: grossC - net };
  }
  // Senior / PWD style discount. VAT-registered: VAT is taken off first and the discount is on the VAT-free base.
  // Not VAT-registered: the discount is on the price. The owner must confirm the rule with an accountant or BIR guidance.
  function exemptDiscount(grossC, o) {
    o = o || {};
    var pct = o.discPct == null ? 20 : o.discPct;
    if (o.vatRegistered) {
      var v = vatSplit(grossC, o.vatPct == null ? 12 : o.vatPct), d = pctC(v.net, pct);
      return { base: v.net, vatRemoved: v.vat, discount: d, due: v.net - d };
    }
    var d2 = pctC(grossC, pct);
    return { base: grossC, vatRemoved: 0, discount: d2, due: grossC - d2 };
  }
  // several percent discounts: stacking off = only the biggest one counts; on = they add up, never above 100
  function stackPct(list, allowStack) {
    var t = 0, mx = 0;
    list.forEach(function (p) { t += p; if (p > mx) mx = p; });
    return allowStack ? Math.min(t, 100) : mx;
  }
  // discount on one line: never more than the line itself
  function lineDiscount(lineC, kind, value) {
    var d = kind === 'pct' ? pctC(lineC, value) : toC(value);
    return Math.max(0, Math.min(d, lineC));
  }
  /* Whole-order discount maths, in centavos.
     lines:   [{ totalC, ld: { kind: 'pct'|'fixed', value, id, name } | null }]   (ld = the discount chosen on that cart line)
     presets: [{ id, name, pct, scope: 'all' | <line index> }]                   (the preset toggles on the charge screen)
     manual:  { kind: 'pct'|'peso', value }                                       ("Other discount")
     rules:   { stack: true|false }   stack false = of several presets on the same part, only the biggest counts
     Order: line discounts first, then presets and the manual discount on what is left. Nothing can go below zero.
     Returns { grossC, lineC: [discount per line], totalC, recs: [{ id, name, pct, line, amtC, kind }] } where the recs add up to totalC. */
  function orderDiscount(input) {
    var lines = input.lines || [], presets = input.presets || [], manual = input.manual || null, stack = !(input.rules && input.rules.stack === false);
    var grossC = 0, lineC = [], remC = [], remTotal = 0, ldTotal = 0, recs = [], orderRecs = [];
    lines.forEach(function (l, i) {
      var d = l.ld ? lineDiscount(l.totalC, l.ld.kind, l.ld.value) : 0;
      grossC += l.totalC; lineC.push(d); remC.push(l.totalC - d); remTotal += l.totalC - d; ldTotal += d;
      if (d > 0) recs.push({ id: l.ld.id || 'custom', name: l.ld.name || (l.ld.kind === 'pct' ? l.ld.value + '%' : 'Discount'), pct: l.ld.kind === 'pct' ? Number(l.ld.value) : 0, line: i, amtC: d, kind: 'line' });
    });
    function group(list, baseC, line) {
      if (!list.length || baseC <= 0) return;
      var pcts = list.map(function (p) { return Math.min(Math.max(Number(p.pct) || 0, 0), 100); });
      var total = pctC(baseC, stackPct(pcts, stack));
      var weights = pcts.map(function (p) { return stack ? p : 0; });
      if (!stack) { var mx = Math.max.apply(null, pcts), w = pcts.indexOf(mx); weights[w] = 1; }
      split(total, weights).forEach(function (a, k) { orderRecs.push({ id: list[k].id, name: list[k].name, pct: pcts[k], line: line, amtC: a, kind: 'preset' }); });
    }
    group(presets.filter(function (p) { return p.scope === 'all' || !lines[p.scope]; }), remTotal, 'all');
    lines.forEach(function (l, i) { group(presets.filter(function (p) { return p.scope !== 'all' && String(p.scope) === String(i) && lines[i]; }), remC[i], i); });
    if (manual && Number(manual.value) > 0) {
      var mc = manual.kind === 'pct' ? pctC(remTotal, Math.min(Number(manual.value), 100)) : toC(manual.value);
      orderRecs.push({ id: 'manual', name: 'Discount', pct: manual.kind === 'pct' ? Number(manual.value) : 0, line: 'all', amtC: mc, kind: 'manual' });
    }
    var want = 0; orderRecs.forEach(function (r) { want += r.amtC; });
    var cap = Math.min(want, remTotal);
    if (cap < want) { var fixed = split(cap, orderRecs.map(function (r) { return r.amtC; })); orderRecs.forEach(function (r, k) { r.amtC = fixed[k]; }); }
    recs = recs.concat(orderRecs.filter(function (r) { return r.amtC > 0; }));
    return { grossC: grossC, lineC: lineC, totalC: ldTotal + cap, recs: recs };
  }
  var api = { orderDiscount: orderDiscount, toC: toC, fromC: fromC, fmt: fmt, mulDiv: mulDiv, pctC: pctC, split: split, vatSplit: vatSplit,
              exemptDiscount: exemptDiscount, stackPct: stackPct, lineDiscount: lineDiscount };
  root.MBMoney = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
