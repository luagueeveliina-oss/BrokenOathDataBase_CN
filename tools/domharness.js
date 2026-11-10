// Minimal DOM harness so page scripts can be executed and checked under Node.
'use strict';
const fs = require('fs');
const path = require('path');

class El {
  constructor(tag, id) {
    this.tagName = (tag || 'div').toUpperCase();
    this.id = id || '';
    this._html = '';
    this._attrs = {};
    this.dataset = {};
    this.style = new Proxy({}, { set: (t, k, v) => { t[k] = v; return true; }, get: (t, k) => t[k] || '' });
    this.children = [];
    this.classList = {
      _s: new Set(),
      add(...c) { c.forEach(x => this._s.add(x)); },
      remove(...c) { c.forEach(x => this._s.delete(x)); },
      toggle(c, on) { if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); return on; },
      contains(c) { return this._s.has(c); },
    };
    this.value = '';
    this.hidden = false;
    this.textContent = '';
    this.offsetHeight = 600;
    this.offsetWidth = 900;
  }
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() { return this._html; }
  setAttribute(k, v) { this._attrs[k] = v; }
  getAttribute(k) { return this._attrs[k]; }
  removeAttribute(k) { delete this._attrs[k]; }
  addEventListener() {}
  removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { this.children.push(...c); }
  insertAdjacentHTML(pos, h) { this._html += h; }
  querySelector() { if (!this._q) this._q = new El('div'); return this._q; }
  querySelectorAll() { return []; }
  closest() { return null; }
  focus() {}
  setPointerCapture() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 800 }; }
  click() {}
}

const registry = new Map();
const doc = {
  documentElement: new El('html'),
  body: new El('body'),
  activeElement: new El('div'),
  getElementById(id) { if (!registry.has(id)) registry.set(id, new El('div', id)); return registry.get(id); },
  querySelector() { return new El('div'); },
  querySelectorAll() { return []; },
  createElement(t) { return new El(t); },
  createElementNS(ns, t) { return new El(t); },
  addEventListener() {},
  removeEventListener() {},
};

global.window = global;
global.document = doc;
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.location = { hash: '', search: '', href: 'file:///test.html', reload() {}, pathname: '/test.html' };
global.history = { replaceState() {}, pushState() {} };
Object.defineProperty(global, 'navigator', { value: { userAgent: 'node' }, configurable: true, writable: true });
global.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} });
global.URLSearchParams = URLSearchParams;
global.requestAnimationFrame = (f) => f();
global.setTimeout = setTimeout;
global.clearTimeout = clearTimeout;
global.Event = class { constructor(t) { this.type = t; } };
global.ResizeObserver = class { observe() {} };
global.console.warn = () => {};
global.window.scrollTo = () => {};
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.dispatchEvent = () => {};

function run(file) {
  const code = fs.readFileSync(file, 'utf8');
  // eslint-disable-next-line no-new-func
  new Function(code).call(global);
}

function extractScripts(htmlFile) {
  const html = fs.readFileSync(htmlFile, 'utf8');
  const out = [];
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) out.push(m[2]);
  return out;
}

module.exports = { El, doc, registry, run, extractScripts, global };
