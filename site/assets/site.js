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
    arrowUp: '<svg viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
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
  BO.VER = BO.VER || '0.56.5';
  BO.mountHeader = function (active) {
    const host = document.getElementById('bo-top');
    if (!host) return;
    const nav = PAGES.map(([href, label]) => {
      const on = href === active ? ' aria-current="page"' : '';
      return `<a href="${href}"${on}>${label[BO.LANG]}</a>`;
    }).join('');
    host.className = 'bo-top';
    host.innerHTML = `<div class="bo-top-in">
      <a class="bo-brand" href="index.html" aria-label="破誓资料库 首页">
        <span class="bo-mark">${I.seal}</span>
        <span class="bo-brand-name">破誓<b>DB</b></span>
        <span class="bo-brand-sub">Broken Oath Database</span>
      </a>
      <nav class="bo-nav" aria-label="主导航">${nav}</nav>
      <div class="bo-tools">
        <span class="bo-ver" title="游戏版本">${BO.esc(BO.VER)}</span>
        <form class="bo-search" role="search" action="items.html" method="get">
          ${I.search}
          <input type="search" name="q" autocomplete="off" aria-label="搜索物品库"
                 placeholder="${BO.LANG ? 'Search items…' : '搜索物品库…'}">
        </form>
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
    const L = BO.LANG;
    host.innerHTML = `<div class="bo-foot">
      <div class="bo-foot-in">
        <div><h5>${L ? 'Database' : '资料库'}</h5><ul>
          <li><a href="index.html">${L ? 'Overview' : '总览'}</a></li>
          <li><a href="items.html#uniques">${L ? 'Unique items' : '传奇物品'}</a></li>
          <li><a href="items.html#bases">${L ? 'Base items' : '底材'}</a></li>
          <li><a href="items.html#affixes">${L ? 'Item mods' : '词缀'}</a></li>
          <li><a href="items.html#runewords">${L ? 'Runewords' : '符文之语'}</a></li>
        </ul></div>
        <div><h5>${L ? 'Mechanics' : '机制与图鉴'}</h5><ul>
          <li><a href="skills.html">${L ? 'Skills & gems' : '技能与宝石'}</a></li>
          <li><a href="tree.html">${L ? 'Passive tree' : '天赋树'}</a></li>
          <li><a href="bestiary.html">${L ? 'Bestiary' : '怪物图鉴'}</a></li>
          <li><a href="about.html">${L ? 'Numbers & rules' : '数值与规则'}</a></li>
        </ul></div>
        <div><h5>${L ? 'About' : '关于本站'}</h5>
          <p>${L
            ? `Unofficial Chinese database for Broken Oath PlayTest ${BO.esc(BO.VER)} — generated directly from the game data files.`
            : `《破誓》PlayTest ${BO.esc(BO.VER)} 非官方中文资料库 · 数据由游戏数据文件直接生成。`}</p>
        </div>
      </div>
      <div class="bo-foot-bottom">${L
        ? 'Broken Oath Database · Fan-made, not affiliated with the developers · <a href="about.html">Sources & disclaimer</a>'
        : '破誓 · 中文资料库 · 非官方粉丝作品，与开发团队无关联 · <a href="about.html">数据来源与免责声明</a>'}</div>
    </div>
    <a href="#top" class="to-top" id="boToTop" aria-label="${L ? 'Back to top' : '回到顶部'}" title="${L ? 'Back to top' : '回到顶部'}">${I.arrowUp}</a>`;

    const tt = host.querySelector('#boToTop');
    if (tt) {
      const sync = () => tt.classList.toggle('on', (window.scrollY || 0) > 420);
      window.addEventListener('scroll', sync, { passive: true });
      sync();
      tt.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  };

  // ---------------- 悬浮信息卡 ----------------
  BO.tips = BO.tips || {};
  let tipEl = null, tipHost = null;
  function tipNode() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'bo-tip';
      tipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function tipPlace(x, y) {
    const el = tipNode();
    const vw = window.innerWidth || 1200, vh = window.innerHeight || 800;
    const r = el.getBoundingClientRect();
    let left = x + 16, top = y + 16;
    if (left + r.width > vw - 10) left = Math.max(10, x - r.width - 16);
    if (top + r.height > vh - 10) top = Math.max(10, y - r.height - 16);
    el.style.left = left + 'px';
    el.style.top = top + 'px';
  }
  function tipHide() {
    if (tipEl) tipEl.classList.remove('on');
    tipHost = null;
  }
  BO.mountTips = function () {
    if (BO._tipBound) return;
    BO._tipBound = true;
    const find = t => (t && t.closest ? t.closest('[data-tip]') : null);
    const open = (host, x, y) => {
      const make = BO.tips[host.getAttribute('data-tip')];
      if (!make) return;
      const el = tipNode();
      el.innerHTML = typeof make === 'function' ? make() : make;
      el.classList.add('on');
      tipHost = host;
      tipPlace(x, y);
    };
    document.addEventListener('mouseover', e => {
      const host = find(e.target);
      if (!host || host === tipHost) return;
      open(host, e.clientX, e.clientY);
    });
    document.addEventListener('mousemove', e => {
      if (tipHost) tipPlace(e.clientX, e.clientY);
    });
    document.addEventListener('mouseout', e => {
      const host = find(e.target);
      if (!host) return;
      if (e.relatedTarget && host.contains(e.relatedTarget)) return;
      tipHide();
    });
    document.addEventListener('focusin', e => {
      const host = find(e.target);
      if (!host) return;
      const r = host.getBoundingClientRect();
      open(host, r.left, r.bottom);
    });
    document.addEventListener('focusout', tipHide);
    window.addEventListener('scroll', tipHide, { passive: true });
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
