/* Copyright (c) 2026 Marina Bay's Cafe. All rights reserved. */
/* Page tests in a simulated browser: the public menu, the QR print page and the publish box.
   This is a test tool only, the apps do not need it. To run it once: make an empty folder, run `npm install jsdom`,
   then `NODE_PATH=<that folder>/node_modules node tests-dom.js` from the cafe folder. */
const { JSDOM, VirtualConsole } = require('jsdom'); const http = require('http');
const path = require('path'), fs = require('fs');
const ROOT = __dirname;
const M = require(ROOT + '/menu-snapshot.js');
const menu = {
  categories: [{ id: 'c1', name: 'Coffee', group: 'Drinks', note: 'Must try!' }, { id: 'c3', name: 'Snacks', group: 'Food', note: '' }],
  items: [
    { id: 'i1', cat: 'c1', name: 'Latte', desc: 'Espresso and milk', best: true, options: [{ label: '16 oz iced', price: 120 }, { label: '22 oz iced', price: 140 }] },
    { id: 'i2', cat: 'c1', name: 'Mocha', soldOut: true, options: [{ label: 'Regular', price: 130 }] },
    { id: 'i5', cat: 'c3', name: '<img src=x onerror=window.__pwned=1>', desc: 'x', options: [{ label: 'Regular', price: 10 }] }],
  addonGroups: [{ id: 'g1', name: 'Extras', cats: ['c1'], items: [{ name: 'Extra shot', price: 30 }] }]
};
const rest = { fields: { json: { stringValue: M.build(menu, { name: "Marina Bay's Cafe", note: 'Open daily 8am to 9pm' }).json }, by: { stringValue: 'a@b.c' }, t: { timestampValue: '2026-11-24T01:02:03Z' } } };
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '')); fs.readFile(f, (e, b) => { if (e) { res.statusCode = 404; res.end(); } else { res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); res.end(b); } }); });
let BASE = '';
async function open(file, query, pre) {
  const vc = new VirtualConsole(); const errors = []; vc.on('jsdomError', e => errors.push(String(e.message).slice(0, 160))); vc.on('error', e => errors.push(String(e).slice(0, 160)));
  const dom = await JSDOM.fromURL(BASE + file + (query || ''), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { w.print = () => { w.__printed = 1; }; if (pre) pre(w); } });
  await sleep(900); dom.errors = errors; return dom;
}
(async function () {
  await new Promise(r => server.listen(0, '127.0.0.1', r)); BASE = 'http://127.0.0.1:' + server.address().port + '/';
  // ---- public page: good answer, table, search, safety
  let dom = await open('menu-public.html', '?table=5', w => { w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(rest) }); });
  let d = dom.window.document;
  ok(d.querySelectorAll('section').length === 2, 'public page shows two sections');
  ok(d.getElementById('tableChip').textContent === 'Table 5' && !d.getElementById('tableChip').hidden, 'public page shows the table');
  ok(d.getElementById('notice').textContent === 'Open daily 8am to 9pm', 'public page shows the message');
  ok(/Sold out/.test(d.body.textContent) && /Best seller/.test(d.body.textContent), 'sold out and best seller are written as text');
  ok(/\u20b1120/.test(d.body.textContent) && /Extra shot \+\u20b130/.test(d.body.textContent), 'prices and add-ons show');
  ok(!dom.window.__pwned && d.querySelectorAll('img[src="x"]').length === 0, 'a name with HTML is shown as text, not run');
  ok(/Menu updated/.test(d.getElementById('foot').textContent), 'footer shows the update date');
  const q = d.getElementById('q'); q.value = 'latte'; q.dispatchEvent(new dom.window.Event('input'));
  ok(d.querySelectorAll('article.item').length === 1, 'search narrows to one item');
  q.value = 'zzz'; q.dispatchEvent(new dom.window.Event('input')); ok(/Nothing matches/.test(d.getElementById('main').textContent), 'search with no match says so');
  ok(dom.errors.length === 0, 'public page has no script errors ' + dom.errors.join('|'));
  ok(dom.window.localStorage.getItem('mb_public_menu_v1'), 'menu copy is saved on the phone for next time');
  dom.window.close();
  // ---- bad table, and fetch fails with a saved copy, then without
  dom = await open('menu-public.html', '?table=%3Cb%3E', w => { w.fetch = () => Promise.reject(new Error('offline')); w.localStorage.setItem('mb_public_menu_v1', JSON.stringify({ snap: JSON.parse(rest.fields.json.stringValue), t: '2026-11-24T01:02:03Z' })); });
  d = dom.window.document;
  ok(d.getElementById('tableChip').hidden, 'a bad table value is ignored');
  ok(d.querySelectorAll('section').length === 2 && /saved on this phone/.test(d.getElementById('foot').textContent), 'offline: the saved menu is shown and says so');
  dom.window.close();
  dom = await open('menu-public.html', '', w => { w.fetch = () => Promise.reject(new Error('offline')); });
  d = dom.window.document; ok(/could not load/i.test(d.body.textContent) && d.querySelector('#status button'), 'offline with no copy: friendly message with Try again');
  dom.window.close();
  dom = await open('menu-public.html', '', w => { w.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve({ fields: { json: { stringValue: '{"v":9}' } } }) }); });
  ok(/could not load/i.test(dom.window.document.body.textContent), 'a wrong or tampered answer is refused');
  dom.window.close();
  // ---- QR print page
  dom = await open('qr-print.html', '');
  d = dom.window.document;
  ok(d.querySelectorAll('.card').length === 1 && d.querySelector('.card svg path').getAttribute('d').length > 100, 'QR page draws one card with a code');
  ok(d.getElementById('qUrl').value === BASE + 'menu-public.html', 'QR page uses this site address');
  const t = d.getElementById('qTables'); t.value = '1-3'; t.dispatchEvent(new dom.window.Event('input'));
  ok(d.querySelectorAll('.card').length === 3 && /Table 2/.test(d.body.textContent) && /table=2/.test(d.body.textContent), 'table numbers make one card each with the table in the address');
  d.getElementById('qLayout').value = 'poster'; d.getElementById('qLayout').dispatchEvent(new dom.window.Event('change'));
  ok(d.body.classList.contains('poster') && /A4/.test(d.getElementById('pgsz').textContent), 'poster layout sets the A4 page');
  const u = d.getElementById('qUrl'); u.value = 'javascript:alert(1)'; u.dispatchEvent(new dom.window.Event('input'));
  ok(d.getElementById('qPrint').disabled && d.querySelectorAll('.card').length === 0, 'a non-web address is refused');
  u.value = BASE + 'menu-public.html'; u.dispatchEvent(new dom.window.Event('input')); t.value = '<b>'; t.dispatchEvent(new dom.window.Event('input'));
  ok(d.getElementById('qPrint').disabled && /No table numbers/.test(d.getElementById('qMsg').textContent), 'unusable table text is refused');
  t.value = ''; t.dispatchEvent(new dom.window.Event('input')); d.getElementById('qPrint').click(); ok(dom.window.__printed === 1, 'print button opens the print window');
  ok(dom.errors.length === 0, 'QR page has no script errors ' + dom.errors.join('|'));
  dom.window.close();
  // ---- menu app publish box
  let published = null;
  dom = await open('menu.html', '', w => { w.__st = { user: null }; });
  d = dom.window.document;
  ok(/Not published yet/.test(d.getElementById('pubStatus').textContent) && /Sign in on the Sync page/.test(d.getElementById('pubStatus').textContent) && d.getElementById('pubGo').disabled, 'menu app: not signed in, button is off and says why');
  dom.window.MBCloud = Object.assign(dom.window.MBCloud || {}, { status: () => ({ user: 'a@b.c' }), publishMenu: async j => { published = j; } });
  await sleep(2800);
  ok(!d.getElementById('pubGo').disabled, 'menu app: signed in, button is on');
  d.getElementById('pubNote').value = 'Hi'; d.getElementById('pubGo').click(); await sleep(100);
  const snap = JSON.parse(published || '{}');
  ok(snap.v === 1 && snap.note === 'Hi' && snap.cats && snap.cats.length > 0, 'menu app: publish sends the safe copy');
  ok(!/"cost"|"recipe"|"stock"/.test(published || ''), 'menu app: nothing private in what was sent');
  ok(/Up to date/.test(d.getElementById('pubStatus').textContent), 'menu app: says up to date after publishing');
  ok(dom.errors.length === 0, 'menu app has no script errors ' + dom.errors.join('|'));
  dom.window.close();
  console.log(fail ? fail + ' failed' : 'all ' + pass + ' passed'); process.exit(fail ? 1 : 0);
})();
