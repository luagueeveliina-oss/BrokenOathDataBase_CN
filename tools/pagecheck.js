/* Minimal page runner: executes a site page (external + inline scripts) with a
   fake DOM and local API snapshots. Prints JS errors and rendered container sizes. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const API = path.join(ROOT, 'site', 'assets', 'api');
const SCRATCH = path.join(ROOT, 'tools', '_scratch', 'api');

class El {
  constructor(tag, id) {
    this.tagName = (tag || 'div').toUpperCase();
    this.id = id || '';
    this._html = '';
    this.textContent = '';
    this.value = '';
    this.hidden = false;
    this.dataset = {};
    this.style = new Proxy({}, { get: (t, k) => t[k] || '', set: (t, k, v) => { t[k] = v; return true; } });
    const classes = new Set();
    this.classList = {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: (c, on) => { if (on === undefined) on = !classes.has(c); on ? classes.add(c) : classes.delete(c); return on; },
      contains: c => classes.has(c)
    };
    this.children = [];
    this._q = new Map();
    this.offsetHeight = 600;
    this.offsetWidth = 900;
    this.scrollY = 0;
  }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  addEventListener() {}
  removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { this.children.push(...c); }
  insertAdjacentHTML(pos, h) { this._html += h; }
  querySelector(sel) {
    if (!this._q.has(sel)) this._q.set(sel, new El('div'));
    return this._q.get(sel);
  }
  querySelectorAll() { return []; }
  closest() { return null; }
  setAttribute(k, v) { this['_a_' + k] = v; if (k === 'hidden') this.hidden = true; }
  getAttribute(k) { return this['_a_' + k] == null ? null : this['_a_' + k]; }
  removeAttribute(k) { delete this['_a_' + k]; }
  remove() {}
  focus() {}
  scrollIntoView() {}
  click() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 800 }; }
}

const registry = new Map();
function getEl(id) {
  if (!registry.has(id)) registry.set(id, new El('div', id));
  return registry.get(id);
}

const doc = {
  documentElement: new El('html'),
  body: new El('body'),
  head: new El('head'),
  activeElement: new El('div'),
  getElementById: getEl,
  querySelector: sel => (sel[0] === '#' ? getEl(sel.slice(1)) : new El('div')),
  querySelectorAll: () => [],
  createElement: t => new El(t),
  createElementNS: (ns, t) => new El(t),
  addEventListener() {},
  removeEventListener() {}
};

global.window = global;
global.document = doc;
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.location = { hash: '', search: '', href: 'file:///index.html', pathname: '/index.html', protocol: 'file:', reload() {} };
global.history = { replaceState() {}, pushState() {} };
try { Object.defineProperty(global, 'navigator', { value: { userAgent: 'node', clipboard: null }, configurable: true }); } catch (e) {}
global.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.dispatchEvent = () => {};
global.scrollTo = () => {};
global.requestAnimationFrame = f => f();
global.cancelAnimationFrame = () => {};
global.ResizeObserver = class { observe() {} };
global.IntersectionObserver = class { observe() {} };
global.URLSearchParams = URLSearchParams;
global.Event = class { constructor(t) { this.type = t; } };
global.AbortController = AbortController;
global.fetch = async (url) => {
  const u = String(url);
  let file = null;
  if (u.startsWith('assets/api/')) file = path.join(API, u.slice('assets/api/'.length));
  else if (u.startsWith('assets/')) file = path.join(SITE, u);
  else if (u.startsWith('https://api.playbrokenoath.com/v1/')) file = path.join(SCRATCH, u.slice('https://api.playbrokenoath.com/v1/'.length));
  if (file && fs.existsSync(file)) {
    return { ok: true, status: 200, json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
  }
  return { ok: false, status: 404, json: async () => ({}) };
};

let scripts = [];
let errors = [];
process.on('unhandledRejection', e => errors.push('unhandled: ' + (e && e.message || e)));
process.on('uncaughtException', e => errors.push('uncaught: ' + (e && e.message || e)));

function runFile(file) {
  try {
    new Function(fs.readFileSync(file, 'utf8')).call(global);
  } catch (e) {
    errors.push(path.relative(SITE, file) + ': ' + e.message);
  }
}

function collect(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  const out = [];
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const src = /src="([^"]+)"/.exec(attrs);
    if (src) out.push({ src: src[1] });
    else if (m[2].trim()) out.push({ code: m[2] });
  }
  return out;
}

(async () => {
  const page = process.argv[2] || 'index.html';
  if (process.argv[5]) global.location.hash = process.argv[5];
  if (process.argv[6]) global.location.search = process.argv[6];
  const htmlFile = path.join(SITE, page);
  const list = collect(htmlFile);
  for (const item of list) {
    if (item.src) {
      if (item.src.startsWith('http')) continue;
      const file = path.join(SITE, item.src.replace(/\?.*$/, ''));
      if (fs.existsSync(file)) runFile(file);
      else errors.push('missing script ' + item.src);
      await new Promise(r => setImmediate(r));
    } else {
      try { new Function(item.code).call(global); }
      catch (e) { errors.push('inline: ' + e.message); }
    }
  }
  // let promise chains resolve
  await new Promise(r => setTimeout(r, 1200));
  console.log('PAGE', page, 'scripts', list.length);
  if (errors.length) {
    console.log('ERRORS');
    errors.forEach(e => console.log('  ' + e));
  } else console.log('  no JS errors');
  const ids = ['liveCard', 'leagueRail', 'statGrid', 'topLadder', 'classShare', 'skillShare', 'buildGrid', 'dbCards', 'dataNoteText', 'list', 'results', 'side', 'metaBody', 'buildBody', 'ladderBody', 'ladderPager', 'cards', 'buildsBody', 'detailBody'];
  for (const id of ids) {
    const e = registry.get(id);
    if (e) console.log('  #' + id + ' html=' + e._html.length + ' chars');
  }
  let all = '';
  for (const e of registry.values()) all += e._html;
  for (const bad of ['undefined', 'NaN', '[object Object]']) {
    const n = all.split(bad).length - 1;
    if (n) console.log('  WARN token "' + bad + '" x' + n);
  }
  console.log('  body children=' + doc.body.children.length + ' ids=' + doc.body.children.map(x => x.id).join(','));
  if (process.argv[3]) {
    const e = registry.get(process.argv[3]);
    if (e) console.log('--- ' + process.argv[3] + ' ---\n' + e._html.slice(0, 120000));
  }
  if (process.argv[4]) {
    try {
      const fn = new Function('return (async () => {' + process.argv[4] + '})()');
      const res = await fn();
      console.log('EVAL ' + (typeof res === 'string' ? res : JSON.stringify(res)));
    } catch (e) {
      console.log('EVAL ERR ' + (e && e.stack || e));
    }
  }
  process.exit(errors.length ? 1 : 0);
})();
