/* Broken Oath 中文资料库 — 共享脚本 */
(function () {
  'use strict';
  const BO = window.BO = window.BO || {};
  const root = document.documentElement;

  // ---------------- language ----------------
  BO.LANG = 0; // 0 = 中文, 1 = English
  try {
    const saved = localStorage.getItem('bo_lang');
    if (saved === 'en') BO.LANG = 1;
  } catch (e) {}
  root.setAttribute('data-lang', BO.LANG ? 'en' : 'zh');

  /** pick from a [zh,en] pair */
  BO.T = function (p) {
    if (!p) return '';
    if (typeof p === 'string') return p;
    return (p[BO.LANG] && String(p[BO.LANG]).trim()) || p[1] || p[0] || '';
  };
  BO.T2 = function (p) { // both languages, zh + en
    if (!p) return '';
    if (typeof p === 'string') return p;
    const zh = p[0] || '', en = p[1] || '';
    if (zh && en && zh !== en) return zh + ' · ' + en;
    return zh || en;
  };
  BO.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  };
  let TERMS = [];
  BO.setTerms = function (q) {
    TERMS = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  };
  /** escape + mark search term hits */
  BO.hl = function (s) {
    let out = BO.esc(s);
    if (!TERMS.length) return out;
    for (const t of TERMS) {
      if (t.length < 1) continue;
      const re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(/(<[^>]*>)|([^<]+)/g, (m, tag, txt) => tag ? tag : txt.replace(re, '<mark>$1</mark>'));
    }
    return out;
  };

  // ---------------- icons ----------------
  const I = {
    seal: '<svg viewBox="0 0 24 24"><path d="M12 2.6 20 6.4v5.2c0 4.6-3.3 8.2-8 9.8-4.7-1.6-8-5.2-8-9.8V6.4Z"/><path d="M12 7.4v5.2M12 15.6h.01"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v2M12 19.5v2M4.7 4.7l1.4 1.4M17.9 17.9l1.4 1.4M2.5 12h2M19.5 12h2M4.7 19.3l1.4-1.4M17.9 6.1l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20.5 13.2A8.6 8.6 0 1 1 10.8 3.5a6.7 6.7 0 0 0 9.7 9.7Z"/></svg>',
    filter: '<svg viewBox="0 0 24 24"><path d="M4 5h16l-6 7.4V19l-4 2v-8.6Z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    zoomIn: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5"/></svg>',
    zoomOut: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2M8.5 11h5"/></svg>',
    reset: '<svg viewBox="0 0 24 24"><path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V9h4.5"/></svg>',
    sword: '<svg viewBox="0 0 24 24"><path d="M14.5 3.5 20.5 3.5 20.5 9.5 9.5 20.5 3.5 20.5 3.5 14.5Z"/><path d="m12 8 4 4"/></svg>',
    gem: '<svg viewBox="0 0 24 24"><path d="M6 3h12l4 6-10 12L2 9Z"/><path d="M2 9h20M9 3l-3 6 6 12 6-12-3-6"/></svg>',
    rune: '<svg viewBox="0 0 24 24"><path d="M12 2.5 20 7v10l-8 4.5L4 17V7Z"/><path d="M9 9h6M9 15h6M12 7v10"/></svg>',
    tree: '<svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="2"/><circle cx="5.5" cy="13" r="2"/><circle cx="18.5" cy="13" r="2"/><circle cx="12" cy="19.5" r="2"/><path d="M12 6.5v11M10.6 5.8 6.6 11.4M13.4 5.8l4 5.6M7.4 14.2l3.3 3.9M16.6 14.2l-3.3 3.9"/></svg>',
    skull: '<svg viewBox="0 0 24 24"><path d="M12 2.5c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4.2 2.6 5.4v3.1c0 1 .8 1.9 1.9 1.9h6c1.1 0 1.9-.9 1.9-1.9v-3.1c1.5-1.2 2.6-3 2.6-5.4 0-4-3.1-7-7.5-7Z"/><path d="M9.3 10.2h.01M14.7 10.2h.01M10.5 14.5l1.5 1.5 1.5-1.5"/></svg>',
    scroll: '<svg viewBox="0 0 24 24"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>',
    flask: '<svg viewBox="0 0 24 24"><path d="M9 2.5h6M10 2.5v6L5.2 18a2 2 0 0 0 1.8 3h10a2 2 0 0 0 1.8-3L14 8.5v-6"/><path d="M7.2 14h9.6"/></svg>',
    book: '<svg viewBox="0 0 24 24"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22Z"/><path d="M8 6h8M8 10h8"/></svg>',
  };
  BO.I = I;

  // ---------------- theme ----------------
  function currentTheme() {
    const t = root.getAttribute('data-theme');
    if (t) return t;
    return (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  try {
    const saved = localStorage.getItem('bo_theme');
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) {}

  // ---------------- page chrome ----------------
  const PAGES = [
    ['index.html', ['总览', 'Overview']],
    ['items.html', ['物品', 'Items']],
    ['skills.html', ['技能', 'Skills']],
    ['tree.html', ['天赋树', 'Passive Tree']],
    ['bestiary.html', ['图鉴', 'Bestiary']],
    ['about.html', ['关于', 'About']],
  ];
  BO.mountHeader = function (active) {
    const host = document.getElementById('bo-top');
    if (!host) return;
    const nav = PAGES.map(([href, label]) => {
      const on = href === active ? ' aria-current="page"' : '';
      return `<a href="${href}"${on}>${label[BO.LANG]}</a>`;
    }).join('');
    host.className = 'bo-top';
    host.innerHTML = `<div class="bo-top-in">
      <a class="bo-brand" href="index.html">
        <span class="bo-mark">${I.seal}</span>
        <span class="bo-name"><b>破誓</b> 资料库<span>Broken Oath Database</span></span>
      </a>
      <nav class="bo-nav">${nav}</nav>
      <div class="bo-tools">
        <button class="bo-btn" id="boLang" title="切换语言 / Switch language"><span class="zh">中</span>/<span class="en">EN</span></button>
        <button class="bo-btn" id="boTheme" title="明暗主题"></button>
      </div>
    </div>`;
    const themeBtn = host.querySelector('#boTheme');
    const paint = () => {
      const dark = currentTheme() === 'dark';
      themeBtn.innerHTML = dark ? I.sun : I.moon;
      themeBtn.title = dark ? '切换到浅色 / Light' : '切换到深色 / Dark';
    };
    themeBtn.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('bo_theme', next); } catch (e) {}
      paint();
      window.dispatchEvent(new Event('bo-theme'));
    });
    paint();
    host.querySelector('#boLang').addEventListener('click', () => {
      BO.LANG = BO.LANG ? 0 : 1;
      try { localStorage.setItem('bo_lang', BO.LANG ? 'en' : 'zh'); } catch (e) {}
      root.setAttribute('data-lang', BO.LANG ? 'en' : 'zh');
      location.reload();
    });
    BO.setDocumentTitle = (zh, en) => { document.title = (BO.LANG ? en : zh) + ' · 破誓资料库'; };
  };

  BO.mountFooter = function () {
    const host = document.getElementById('bo-foot');
    if (!host) return;
    host.className = 'bo-foot';
    host.innerHTML = `<div class="wrap"><footer class="bo-foot"><div class="row">
      <div>破誓 · 中文资料库 · 数据版本 ${BO.VER || 'r92'} · 本地静态站</div>
      <div><a href="about.html">数据来源与免责声明</a></div>
    </div></footer></div>`;
  };

  // ---------------- small helpers ----------------
  BO.num = function (v, digits) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (!isFinite(n)) return '—';
    if (digits) return n.toFixed(digits);
    return n.toLocaleString('en-US');
  };
  BO.debounce = function (fn, ms) {
    let t;
    return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
  };
  BO.qs = function (name) {
    return new URLSearchParams(location.search).get(name);
  };
  BO.fmtRange = function (min, max) {
    if (min === max) return String(min);
    return min + '–' + max;
  };
  /** facet engine: groups = [{id,label,values:Map(value->count),selected:Set}] */
  BO.renderFacets = function (host, groups, onChange) {
    const html = groups.filter(g => g.values && g.values.size > 1).map(g => {
      const chips = [...g.values.entries()]
        .sort((a, b) => (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }))
        .map(([v, c]) => {
          const on = g.selected.has(v);
          const dis = !c && !on;
          const label = g.display ? g.display(v) : v;
          return `<button class="chip" data-g="${BO.esc(g.id)}" data-v="${BO.esc(v)}" aria-pressed="${on}"${dis ? ' disabled' : ''}>${BO.esc(label)} <b>${c || 0}</b></button>`;
        }).join('');
      return `<div class="facet"><h4>${BO.esc(g.label)}${g.selected.size ? `<button class="chip clr" data-clear="${BO.esc(g.id)}" style="padding:0 7px;font-size:.68rem">清除</button>` : ''}</h4><div class="chips">${chips}</div></div>`;
    }).join('');
    host.innerHTML = html || '<div class="side-empty">当前分类没有可用筛选项</div>';
    host.onclick = (ev) => {
      const b = ev.target.closest('.chip');
      if (!b || b.disabled) return;
      if (b.dataset.clear) { onChange(b.dataset.clear, null); return; }
      onChange(b.dataset.g, b.dataset.v);
    };
  };
  BO.empty = (msg) => `<div class="empty">${msg}</div>`;
  /** hide the facet column when a page has no facets to show */
  BO.collapseSide = function () {
    const side = document.getElementById('side');
    const layout = document.querySelector('.layout');
    if (!side || !layout) return;
    const has = side.querySelector('.facet, .chips');
    side.style.display = has ? '' : 'none';
    layout.style.gridTemplateColumns = has ? '' : 'minmax(0,1fr)';
  };
})();
