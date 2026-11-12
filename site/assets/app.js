/* ==========================================================================
   Broken Oath Data Base — shared application layer
   Shell, search, API cache, formatting and small UI components.
   ========================================================================== */
(function () {
  'use strict';

  var BO = window.BO = window.BO || {};
  var root = document.documentElement;

  /* ---------------------------------------------------------------- 1. lang */
  BO.LANG = 0;
  root.setAttribute('data-lang', 'zh');

  BO.T = function (p) {
    if (p == null) return '';
    if (typeof p === 'string') return p;
    if (Array.isArray(p)) {
      var v = p[BO.LANG];
      return (v && String(v).trim()) || p[1] || p[0] || '';
    }
    return String(p);
  };
  BO.T2 = function (p) {
    if (!p) return '';
    if (typeof p === 'string') return p;
    var a = p[0] || '', b = p[1] || '';
    return (a && b && a !== b) ? a + ' · ' + b : (a || b);
  };

  BO.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  BO.attr = function (s) { return BO.esc(s).replace(/'/g, '&#39;'); };

  var TERMS = [];
  BO.setTerms = function (q) {
    TERMS = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  };
  BO.hl = function (s) {
    var out = BO.esc(s);
    if (!TERMS.length) return out;
    TERMS.forEach(function (t) {
      var re = new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(/(<[^>]*>)|([^<]+)/g, function (m, tag, txt) {
        return tag ? tag : txt.replace(re, '<mark>$1</mark>');
      });
    });
    return out;
  };

  /* --------------------------------------------------------------- 2. icons */
  var UI = {
    search: '<circle cx="11" cy="11" r="6.4"/><path d="m20 20-4.1-4.1"/>',
    close: '<path d="M5 5l14 14M19 5 5 19"/>',
    sun: '<circle cx="12" cy="12" r="3.4"/><path d="M12 2.6v2M12 19.4v2M4.8 4.8l1.4 1.4M17.8 17.8l1.4 1.4M2.6 12h2M19.4 12h2M4.8 19.2l1.4-1.4M17.8 6.2l1.4-1.4"/>',
    moon: '<path d="M20.4 13.3A8.5 8.5 0 1 1 10.7 3.6a6.6 6.6 0 0 0 9.7 9.7Z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    arrow: '<path d="M4 12h15M13 6l6 6-6 6"/>',
    arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6H5V6h6"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="1.4"/><path d="M15 5H5v10"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    chart: '<path d="M4 20V5M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-7"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0Z"/><path d="M8 6H4v2a3 3 0 0 0 3 3M16 6h4v2a3 3 0 0 1-3 3M12 13v5M9 21h6"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>',
    warning: '<path d="M12 3 2.8 20h18.4Z"/><path d="M12 9v5M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
    db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    flame: '<path d="M12 3s5 5 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c0-3 2-5 2-8Z"/>',
    shield: '<path d="M12 3 20 6v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6Z"/><path d="M12 8v7"/>',
    sword: '<path d="M14.5 3.5H20.5V9.5L9.5 20.5H3.5V14.5Z"/><path d="m11.5 8.5 4 4"/>',
    spark: '<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 16v5M16.5 18.5h5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1.7 1.7"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1.7-1.7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    grid: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    skull: '<path d="M12 3c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4.2 2.6 5.4V19c0 1 .8 1.9 1.9 1.9h6c1.1 0 1.9-.9 1.9-1.9v-3.6c1.5-1.2 2.6-3 2.6-5.4 0-4-3.1-7-7.5-7Z"/><path d="M9.3 10.2h.01M14.7 10.2h.01M10.5 14.5l1.5 1.5 1.5-1.5"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8M17 14a5 5 0 0 1 4 5"/>',
    rune: '<path d="M12 2.5 20 7v10l-8 4.5L4 17V7Z"/><path d="M9.5 9h5M9.5 15h5M12 7v10"/>',
    book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3Z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
    crown: '<path d="m4 8 4 3 4-6 4 6 4-3-1.5 10h-13Z"/><path d="M6.5 21h11"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    discord: '<path d="M8.5 7.5c2.4-1 4.6-1 7 0M8.5 7.5 6 18c2 1.2 3.6 1.7 6 1.7s4-.5 6-1.7L15.5 7.5"/><path d="M9.5 14h.01M14.5 14h.01"/>'
  };
  var sprite = null;
  function ensureSprite() {
    if (sprite || !document.body) return;
    sprite = document.createElement('div');
    sprite.id = 'bo-sprite';
    sprite.setAttribute('aria-hidden', 'true');
    sprite.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    sprite.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg">' +
      Object.keys(UI).map(function (k) {
        return '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + UI[k] + '</symbol>';
      }).join('') + '</svg>';
    document.body.appendChild(sprite);
  }
  BO.ico = function (name, cls) {
    ensureSprite();
    return '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  };
  BO.mark = function (cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 40 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 2.5 36 9.2v13.5C36 33 28.8 40.4 20 45.5 11.2 40.4 4 33 4 22.7V9.2Z"/>' +
      '<path d="M20 9v21M12.5 15.5h15M14 31l6 4.2 6-4.2"/>' +
      '<circle cx="20" cy="21" r="5.2" opacity=".55"/>' +
      '<path d="M27.5 8.5 31 5M12.5 8.5 9 5" opacity=".55"/></svg>';
  };

  /* ------------------------------------------------------------- 3. format */
  BO.num = function (v, digits) {
    if (v == null || v === '') return '—';
    var n = Number(v);
    if (!isFinite(n)) return '—';
    if (digits != null) return n.toFixed(digits);
    return n.toLocaleString('en-US');
  };
  // Ladder / cards use compact English suffixes (100M, 1.2B), never 万/亿.
  // Detailed places (planner, build sheet) use BO.num() so every digit is visible.
  BO.big = function (v) {
    if (v == null || v === '') return '—';
    var n = Number(v);
    if (!isFinite(n)) return '—';
    var a = Math.abs(n);
    function trim(x, d) {
      var s = x.toFixed(d);
      if (s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
      return s;
    }
    if (a >= 1e12) return trim(n / 1e12, 2) + 'T';
    if (a >= 1e9) return trim(n / 1e9, 2) + 'B';
    if (a >= 1e6) return trim(n / 1e6, 2) + 'M';
    if (a >= 1e3) return trim(n / 1e3, 1) + 'K';
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  };
  BO.pct = function (v, d) { return v == null ? '—' : Number(v).toFixed(d == null ? 1 : d) + '%'; };
  BO.fmtDate = function (iso, withTime) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    var p = function (x) { return String(x).padStart(2, '0'); };
    var s = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    if (withTime) s += ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    return s;
  };
  BO.ago = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso).getTime();
    if (!isFinite(d)) return '—';
    var s = Math.max(0, Math.floor((Date.now() - d) / 1000));
    if (s < 45) return '刚刚';
    if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
    if (s < 86400 * 30) return Math.floor(s / 86400) + ' 天前';
    return BO.fmtDate(iso);
  };
  BO.dur = function (ms) {
    if (!isFinite(ms) || ms <= 0) return '已结束';
    var m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d > 0) return d + ' 天 ' + (h % 24) + ' 小时';
    if (h > 0) return h + ' 小时 ' + (m % 60) + ' 分';
    return m + ' 分';
  };
  BO.debounce = function (fn, ms) {
    var t;
    return function () {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, a); }, ms);
    };
  };
  BO.qs = function (name) { return new URLSearchParams(location.search).get(name); };
  BO.hash = function () { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return location.hash.slice(1); } };
  BO.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  BO.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { BO.toast('已复制'); }, function () { BO.toast('复制失败', true); });
    }
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); BO.toast('已复制'); } catch (e) { BO.toast('复制失败', true); }
    document.body.removeChild(ta);
  };
  BO.toast = function (msg, bad) {
    var el = document.getElementById('bo-toast');
    if (!el) { el = document.createElement('div'); el.id = 'bo-toast'; el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.className = 'toast on' + (bad ? ' bad' : '');
    clearTimeout(BO._toastT);
    BO._toastT = setTimeout(function () { el.className = 'toast' + (bad ? ' bad' : ''); }, 2200);
  };
  BO.pretty = function (id) {
    if (!id) return '未知';
    if (id === 'hidden') return '未公开';
    return String(id).replace(/[_-]+/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  };

  /* -------------------------------------------------------------- 4. names */
  BO.CLASSES = {
    Warrior: { zh: '战士', en: 'Warrior', color: '#c46a4a' },
    Mage: { zh: '法师', en: 'Mage', color: '#6f9ed6' },
    Ranger: { zh: '游侠', en: 'Ranger', color: '#7fbf6a' },
    Samurai: { zh: '武士', en: 'Samurai', color: '#d9a441' },
    Paladin: { zh: '圣骑士', en: 'Paladin', color: '#e3d3a1' },
    Necromancer: { zh: '死灵法师', en: 'Necromancer', color: '#a98bd6' }
  };
  BO.CLASS_LIST = ['Warrior', 'Mage', 'Ranger', 'Samurai', 'Paladin', 'Necromancer'];
  BO.classZh = function (id) { var c = BO.CLASSES[id]; return c ? (BO.LANG ? c.en : c.zh) : BO.pretty(id); };
  BO.classColor = function (id) { var c = BO.CLASSES[id]; return c ? c.color : '#8d8980'; };
  BO.ASPECTS = {
    Fire: { zh: '火焰', en: 'Fire', color: '#c8563f' },
    Lightning: { zh: '雷电', en: 'Lightning', color: '#d9b441' },
    Cold: { zh: '冰霜', en: 'Cold', color: '#6f9ed6' },
    Arcane: { zh: '奥术', en: 'Arcane', color: '#ab8fd8' },
    Poison: { zh: '毒素', en: 'Poison', color: '#7fae5a' },
    Physical: { zh: '钢铁', en: 'Iron', color: '#b8b2a4' }
  };
  BO.aspectZh = function (id) { var a = BO.ASPECTS[id]; return a ? (BO.LANG ? a.en : a.zh) : BO.pretty(id); };
  BO.aspectColor = function (id) { var a = BO.ASPECTS[id]; return a ? a.color : '#8d8980'; };
  BO.SLOTS = {
    MainHand: ['主手', 'Main hand'], OffHand: ['副手', 'Off hand'], Helm: ['头盔', 'Helm'],
    Chest: ['胸甲', 'Chest'], Gloves: ['手套', 'Gloves'], Boots: ['靴子', 'Boots'],
    Belt: ['腰带', 'Belt'], Amulet: ['项链', 'Amulet'], Ring1: ['戒指 1', 'Ring 1'],
    Ring2: ['戒指 2', 'Ring 2'], Ring: ['戒指', 'Ring'], Idol: ['神像', 'Idol'],
    DwarvenRune: ['矮人符文', 'Dwarven rune'], Body: ['胸甲', 'Body']
  };
  BO.slotZh = function (id) { var s = BO.SLOTS[id]; return s ? (BO.LANG ? s[1] : s[0]) : BO.pretty(id); };
  BO.SLOT_ORDER = ['MainHand', 'OffHand', 'Helm', 'Chest', 'Gloves', 'Boots', 'Belt', 'Amulet', 'Ring1', 'Ring2', 'DwarvenRune', 'Idol'];

  BO.NAMES = null;
  BO.names = function (table, id) {
    if (!BO.NAMES) BO.NAMES = window.BO_NAMES || {};
    var t = BO.NAMES[table];
    if (t && t[id]) return t[id];
    var low = String(id == null ? '' : id).toLowerCase();
    if (t && t[low]) return t[low];
    var ex = BO.NAMES.extra && BO.NAMES.extra[table];
    return (ex && (ex[id] || ex[low])) || null;
  };
  BO.hasLocal = function (table, id) {
    if (!BO.NAMES) BO.NAMES = window.BO_NAMES || {};
    return !!(BO.NAMES[table] && BO.NAMES[table][id]);
  };
  BO.nm = function (table, id, en) {
    var v = BO.names(table, id);
    if (!v) return en ? BO.pretty(id) : BO.pretty(id);
    if (BO.LANG) return v[1] || v[0] || BO.pretty(id);
    return v[0] || v[1] || BO.pretty(id);
  };
  BO.namePair = function (table, id) {
    var v = BO.names(table, id);
    return v || null;
  };
  BO.skillNm = function (id) {
    var k = String(id || '').toLowerCase();
    return BO.nm('skills', k) === BO.pretty(k) ? BO.nm('skills', id) : BO.nm('skills', k);
  };
  BO.supNm = function (id) {
    var k = String(id || '').toLowerCase();
    return BO.nm('supports', k) === BO.pretty(k) ? BO.nm('supports', id) : BO.nm('supports', k);
  };
  BO.uniqueNm = function (id) { return BO.nm('uniques', id); };
  BO.baseNm = function (id) { return BO.nm('bases', id); };
  BO.nodeNm = function (id) { return BO.nm('nodes', id); };
  BO.dragonNm = function (id) { return BO.nm('dragon', id); };

  BO.ART = {
    unique: { table: 'uniques', prefix: 'u:', glyph: 'sword', tint: '#af6025' },
    base: { table: 'bases', prefix: 'b:', glyph: 'shield', tint: '#c8c8c8' },
    rune: { table: 'runes', prefix: 'r:', glyph: 'rune', tint: '#aa9e82' },
    jewel: { table: 'runes', prefix: 'j:', glyph: 'rune', tint: '#aa9e82' },
    skill: { table: 'skills', prefix: 'sk:', glyph: 'spark', tint: '#1ba29b' },
    support: { table: 'supports', prefix: 'sp:', glyph: 'link', tint: '#8fb0e8' }
  };
  BO.icon = function (key, glyph, tint, w, h) {
    var src = (window.BO_ICONS || {})[key];
    var size = (w && h) ? ';width:' + w + 'px;height:' + h + 'px' : '';
    var style = '--ico:' + (tint || '#a8a8a8') + size;
    if (src) return '<span class="ico ico-img" style="' + style + '"><img src="' + BO.attr(src) + '" alt="" decoding="async"></span>';
    return '<span class="ico" style="' + style + '"><svg viewBox="0 0 24 24">' + (UI[glyph] || UI.rune) + '</svg></span>';
  };
  BO.art = function (kind, id, w, h) {
    var a = BO.ART[kind] || BO.ART.base;
    return BO.icon(a.prefix + id, a.glyph, a.tint, w, h);
  };
  BO.itemArt = function (rec, kind) {
    var id = rec && (rec.id || rec.i);
    if (!id) return BO.icon('', 'sword');
    if (kind === 'unique' && rec.baseId) return BO.art('base', rec.baseId);
    return BO.art(kind || 'base', id);
  };

  /* ---------------------------------------------------------------- 5. API */
  BO.API_BASE = 'https://api.playbrokenoath.com/v1/';
  BO.VER_LOCAL = '0.56.5';
  var apiCache = {};
  var liveCache = {};

  function timeout(ms) {
    var c = new AbortController();
    var t = setTimeout(function () { c.abort(); }, ms);
    return { signal: c.signal, done: function () { clearTimeout(t); } };
  }
  function fetchJSON(url, ms) {
    var to = timeout(ms || 9000);
    return fetch(url, { signal: to.signal, headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) { to.done(); return j; }, function (e) { to.done(); throw e; });
  }

  function seedFor(path) {
    var s = window.BO_API_SEED;
    if (!s) return null;
    if (path === 'version.json') return s.version || null;
    if (path === 'leagues.json') return s.leagues || null;
    if (path === 'game-data/index.json') return s.gameData || null;
    var m;
    if (s.current) {
      if (path === 'ladder/' + s.current + '.json') return s.ladder || null;
      if (path === 'meta/' + s.current + '.json') return s.meta || null;
      m = /^builds\/([^/]+)\/([^/]+)\.json$/.exec(path);
      if (m && m[1] === s.current && s.lists) return s.lists[m[2]] || null;
      m = /^builds\/([^/]+)\/([^/]+)\/([^/]+)\.json$/.exec(path);
      if (m && m[1] === s.current && s.details) {
        for (var i = 0; i < s.details.length; i++) if (s.details[i].hero === m[3]) return s.details[i];
      }
    }
    return null;
  }

  BO.api = {
    seed: function () { return window.BO_API_SEED || null; },
    manifest: function () {
      if (apiCache['manifest.json']) return Promise.resolve(apiCache['manifest.json']);
      return fetchJSON('assets/api/manifest.json', 5000).then(function (j) {
        apiCache['manifest.json'] = j;
        return j;
      }).catch(function () {
        var s = window.BO_API_SEED;
        var fake = s ? {
          synced_at: s.synced_at, patch: (s.version || {}).patch, game_build: (s.version || {}).game_build,
          current_league: s.current, files: {}, seed: true
        } : { synced_at: null, patch: BO.VER_LOCAL, files: {}, seed: true };
        apiCache['manifest.json'] = fake;
        return fake;
      });
    },
    load: function (path) {
      if (apiCache[path]) return Promise.resolve(apiCache[path]);
      var seeded = seedFor(path);
      if (seeded) { apiCache[path] = seeded; return Promise.resolve(seeded); }
      return fetchJSON('assets/api/' + path, 7000).then(function (j) {
        apiCache[path] = j; return j;
      });
    },
    live: function (path, force) {
      if (!force && liveCache[path] && Date.now() - liveCache[path].t < 15 * 60000) return Promise.resolve(liveCache[path].v);
      return fetchJSON(BO.API_BASE + path, 15000).then(function (j) {
        liveCache[path] = { t: Date.now(), v: j };
        return j;
      });
    },
    build: function (league, cls, hero) {
      var path = 'builds/' + league + '/' + cls + '/' + hero + '.json';
      return BO.api.load(path).catch(function () { return BO.api.live(path); });
    },
    version: function () { return BO.api.load('version.json'); },
    leagues: function () { return BO.api.load('leagues.json'); },
    ladder: function (league) {
      return BO.api.load('ladder/' + league + '.json').catch(function () { return BO.api.live('ladder/' + league + '.json'); });
    },
    meta: function (league) {
      return BO.api.load('meta/' + league + '.json').catch(function () { return BO.api.live('meta/' + league + '.json'); });
    },
    list: function (league, cls) {
      return BO.api.load('builds/' + league + '/' + cls + '.json').catch(function () { return BO.api.live('builds/' + league + '/' + cls + '.json'); });
    }
  };

  /* ---------------------------------------------------------- 6. league utils */
  function tms(iso) { var d = new Date(iso); return isNaN(d.getTime()) ? 0 : d.getTime(); }
  BO.leagueStatus = function (l, now) {
    now = now || Date.now();
    var a = tms(l.starts_at), b = tms(l.ends_at);
    if (a && now < a) return 'upcoming';
    if (b && now > b) return 'ended';
    return 'live';
  };
  BO.leagueVariant = function (l) {
    var s = l.hardcore ? 'HC' : 'SC';
    s += l.trade ? ' · 交易' : ' · SSF';
    return BO.LANG ? s.replace('交易', 'Trade').replace('SSF', 'SSF') : s;
  };
  BO.leagueShort = function (l) {
    var bits = [l.hardcore ? 'HC' : 'SC'];
    bits.push(l.trade ? (BO.LANG ? 'Trade' : '交易') : 'SSF');
    return bits.join(' / ');
  };
  BO.leagueSort = function (list) {
    list = Array.isArray(list) ? list : ((list && list.leagues) || []);
    var now = Date.now();
    return list.slice().sort(function (a, b) {
      var sa = BO.leagueStatus(a, now), sb = BO.leagueStatus(b, now);
      var rank = { live: 0, upcoming: 1, ended: 2 };
      if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
      if (sa === 'ended') return tms(b.ends_at) - tms(a.ends_at);
      return tms(b.starts_at) - tms(a.starts_at);
    });
  };
  BO.currentLeague = function (leagues) {
    var list = (leagues && leagues.leagues) || [];
    var now = Date.now();
    var live = list.filter(function (l) { return BO.leagueStatus(l, now) === 'live'; });
    if (live.length) {
      live.sort(function (a, b) {
        return (a.trade === b.trade ? 0 : a.trade ? -1 : 1) ||
          (a.hardcore === b.hardcore ? 0 : a.hardcore ? 1 : -1) ||
          (tms(b.starts_at) - tms(a.starts_at));
      });
      return live[0].id;
    }
    var recent = list.slice().sort(function (a, b) { return tms(b.starts_at) - tms(a.starts_at); });
    return recent.length ? recent[0].id : null;
  };
  BO.seasonName = function (l) {
    if (!l) return '';
    return l.season_name || l.name || l.id;
  };

  /* ------------------------------------------------------------- 7. shell */
  BO.PLANNER_PUBLIC = true;
  BO.PLANNER_ENABLED = true;
  var PAGES = [
    ['index.html', ['首页', 'Home']],
    ['items.html', ['物品', 'Items']],
    ['skills.html', ['技能', 'Skills']],
    ['ladder.html', ['天梯', 'Ladder']],
    ['builds.html', ['构筑库', 'Builds']],
    ['meta.html', ['环境', 'Meta']],
    ['planner.html', ['模拟构筑', 'Planner']],
    ['bestiary.html', ['图鉴', 'Bestiary']],
    ['about.html', ['关于', 'About']]
  ];
  var NAV = [
    { href: 'index.html', label: ['首页', 'Home'] },
    {
      label: ['数据库', 'Database'], items: [
        ['items.html', ['物品', 'Items'], ['传奇 · 底材 · 词缀 · 符文', 'Uniques, bases, mods, runes']],
        ['skills.html', ['技能', 'Skills'], ['技能宝石 · 辅助 · 誓约', 'Gems, supports, vows']],
        ['bestiary.html', ['图鉴', 'Bestiary'], ['怪物 · 守护者', 'Monsters and guardians']]
      ]
    },
    {
      label: ['天梯', 'Ladder'], items: [
        ['ladder.html', ['天梯榜', 'Ladder'], ['每职业前 200 · 15 分钟', 'Top 200 per class']],
        ['builds.html', ['构筑库', 'Builds'], ['官方已发布的构筑', 'Published builds']],
        ['meta.html', ['环境统计', 'Meta'], ['职业 · 技能 · 传奇占比', 'Class, skill and unique shares']]
      ]
    },
    { href: 'planner.html', label: ['模拟构筑', 'Planner'] },
    { href: 'about.html', label: ['关于', 'About'] }
  ];
  BO.PAGES = PAGES;

  function navActive(active, href) {
    if (href === active) return true;
    if (href === 'ladder.html' && /^(ladder|build|builds)\.html$/.test(active)) return true;
    if (href === 'builds.html' && /^(build|builds)\.html$/.test(active)) return true;
    if (href === 'items.html' && active === 'items.html') return true;
    return false;
  }

  function renderNav(active) {
    return NAV.map(function (item) {
      if (item.href) {
        var on = navActive(active, item.href);
        return '<a class="navlink" href="' + item.href + '"' + (on ? ' aria-current="page"' : '') + '>' + BO.T(item.label) + '</a>';
      }
      var groupOn = item.items.some(function (x) { return navActive(active, x[0]); });
      return '<div class="navgroup">' +
        '<button class="navbtn' + (groupOn ? ' on' : '') + '" aria-expanded="false" aria-haspopup="true">' +
        BO.T(item.label) + BO.ico('chevron', 'chev') + '</button>' +
        '<div class="navmenu">' + item.items.map(function (x) {
          return '<a href="' + x[0] + '"><span>' + BO.T(x[1]) + '</span><small>' + BO.T(x[2]) + '</small></a>';
        }).join('') + '</div></div>';
    }).join('');
  }

  BO.mountHeader = function (active) {
    var host = document.getElementById('bo-top');
    if (!host) return;
    var seed = window.BO_API_SEED;
    var patch = (seed && seed.version && seed.version.patch) || BO.VER_LOCAL;
    host.className = 'site-top';
    host.innerHTML =
      '<div class="friends"><div class="friends-in"><span>' + (BO.LANG ? 'Friends' : '友站') + '</span>' +
      '<a href="https://broked-db.pages.dev/" target="_blank" rel="noopener">Broken Oath DB' + BO.ico('ext') + '</a>' +
      '<a href="https://lilshrimper.github.io/broken-oath-builder/" target="_blank" rel="noopener">Broken Oath Builder' + BO.ico('ext') + '</a>' +
      '</div></div>' +
      '<header class="topbar"><div class="topbar-in">' +
      '<a class="brand" href="index.html" aria-label="Broken Oath Data Base · 首页"><span class="brand-mark">' + BO.mark() + '</span>' +
      '<span class="brand-text"><span class="brand-name">Broken Oath <b>Data Base</b></span><span class="brand-sub">' + (BO.LANG ? 'Unofficial companion' : '非官方中文资料库') + '</span></span></a>' +
      '<nav class="mainnav" aria-label="' + (BO.LANG ? 'Main navigation' : '主导航') + '">' + renderNav(active) + '</nav>' +
      '<div class="tools">' +
      '<button class="tool-btn searchbtn" id="boSearchBtn" aria-label="' + (BO.LANG ? 'Search' : '全局搜索') + '">' + BO.ico('search') +
      '<span>' + (BO.LANG ? 'Search items, skills…' : '搜索物品、技能…') + '</span><kbd>/</kbd></button>' +
      '<span class="tool-btn verbtn" title="' + (BO.LANG ? 'Game patch' : '游戏版本') + '"><span class="verchip">' + BO.esc(patch) + '</span></span>' +
      '<button class="tool-btn" id="boThemeBtn" title="' + (BO.LANG ? '切换主题' : '切换明暗') + '"></button>' +
      '<button class="tool-btn mobilebtn" id="boMenuBtn" aria-label="' + (BO.LANG ? 'Menu' : '菜单') + '">' + BO.ico('menu') + '</button>' +
      '</div></div></header>' +
      '<div class="mobilenav" id="boMobileNav" hidden>' +
      '<div class="mn-head"><span>' + (BO.LANG ? 'Menu' : '导航') + '</span><button class="tool-btn" id="boMenuClose">' + BO.ico('close') + '</button></div>' +
      PAGES.filter(function (p) { return p[0] !== 'planner.html' || BO.PLANNER_ENABLED; }).map(function (p) {
        return '<a href="' + p[0] + '"' + (p[0] === active ? ' class="on"' : '') + '>' + BO.T(p[1]) + '</a>';
      }).join('') +
      '</div>';

    var ver = document.querySelector('.verchip');
    if (ver) ver.textContent = patch;

    // live version patch in the footer chip (no per-visitor API call: seed/manifest only)
    BO.api.manifest().then(function (m) {
      if (!m || !m.patch) return;
      document.querySelectorAll('.verchip').forEach(function (el) {
        el.textContent = m.patch;
        el.title = 'Patch ' + m.patch + ' · game build ' + (m.game_build || '—') + ' · 同步于 ' + BO.fmtDate(m.synced_at, true);
      });
    }).catch(function () {});

    var themeBtn = host.querySelector('#boThemeBtn');
    try {
      var qt = new URLSearchParams(location.search).get('theme');
      if (qt === 'light' || qt === 'dark') root.setAttribute('data-theme', qt);
    } catch (e) {}
    function theme() {
      var t = root.getAttribute('data-theme');
      if (t) return t;
      try {
        var q = new URLSearchParams(location.search).get('theme');
        if (q === 'light' || q === 'dark') return q;
      } catch (e) {}
      return (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
    }
    function paintTheme() {
      var dark = theme() === 'dark';
      themeBtn.innerHTML = BO.ico(dark ? 'sun' : 'moon');
      themeBtn.title = dark ? '切换到浅色' : '切换到深色';
    }
    themeBtn.addEventListener('click', function () {
      var next = theme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('bo_theme', next); } catch (e) {}
      paintTheme();
    });
    paintTheme();

    // dropdowns
    var groups = host.querySelectorAll('.navgroup');
    Array.prototype.forEach.call(groups, function (g) {
      var btn = g.querySelector('.navbtn');
      var close = function () { g.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = g.classList.contains('open');
        Array.prototype.forEach.call(groups, function (x) {
          x.classList.remove('open');
          var b = x.querySelector('.navbtn');
          if (b) b.setAttribute('aria-expanded', 'false');
        });
        if (!open) { g.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      });
      g.addEventListener('mouseenter', function () {
        if (window.innerWidth > 940) { g.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      });
      g.addEventListener('mouseleave', function () {
        if (window.innerWidth > 940) close();
      });
      g.addEventListener('focusout', function (e) {
        if (!g.contains(e.relatedTarget)) close();
      });
    });
    document.addEventListener('click', function () {
      Array.prototype.forEach.call(groups, function (g) {
        g.classList.remove('open');
        var b = g.querySelector('.navbtn');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        Array.prototype.forEach.call(groups, function (g) {
          g.classList.remove('open');
          var b = g.querySelector('.navbtn');
          if (b) b.setAttribute('aria-expanded', 'false');
        });
      }
    });

    // mobile menu
    var mnav = host.querySelector('#boMobileNav');
    var mbtn = host.querySelector('#boMenuBtn');
    function closeMobile() { mnav.hidden = true; document.body.classList.remove('nav-open'); }
    mbtn.addEventListener('click', function () {
      mnav.hidden = false;
      document.body.classList.add('nav-open');
    });
    host.querySelector('#boMenuClose').addEventListener('click', closeMobile);
    mnav.addEventListener('click', function (e) { if (e.target.closest('a')) closeMobile(); });

    BO.mountSearch(active);
  };

  BO.mountFooter = function () {
    var host = document.getElementById('bo-foot');
    if (!host) return;
    var year = new Date().getFullYear();
    host.innerHTML =
      '<footer class="footer"><div class="foot-grid">' +
      '<div class="foot-brand"><a class="brand" href="index.html"><span class="brand-mark">' + BO.mark() + '</span>' +
      '<span class="brand-text"><span class="brand-name">Broken Oath <b>Data Base</b></span><span class="brand-sub">' + (BO.LANG ? 'Unofficial companion' : '非官方中文资料库') + '</span></span></a>' +
      '<p>' + (BO.LANG
        ? 'A fan-made database for Broken Oath: ladder, published builds, items, gems, guardians and the game\'s numbers. Not affiliated with the developers.'
        : '《破誓》非官方粉丝资料库：天梯、官方构筑、物品、技能、守护者与游戏数值。与开发团队无关联、未获背书。') + '</p>' +
      '<div class="mt8"><span class="credit">' + BO.ico('db') + ' Data: Broken Oath public API</span></div></div>' +
      '<div class="foot-col"><h5>' + (BO.LANG ? 'Database' : '资料库') + '</h5>' +
      '<a href="items.html">' + (BO.LANG ? 'Items' : '物品') + '</a><a href="items.html#uniques">' + (BO.LANG ? 'Uniques' : '传奇') + '</a>' +
      '<a href="items.html#affixes">' + (BO.LANG ? 'Item mods' : '词缀') + '</a><a href="skills.html">' + (BO.LANG ? 'Skills' : '技能') + '</a>' +
      '<a href="bestiary.html">' + (BO.LANG ? 'Bestiary' : '图鉴') + '</a></div>' +
      '<div class="foot-col"><h5>' + (BO.LANG ? 'Ladder' : '天梯') + '</h5>' +
      '<a href="ladder.html">' + (BO.LANG ? 'Ladder' : '天梯榜') + '</a><a href="builds.html">' + (BO.LANG ? 'Builds' : '构筑库') + '</a>' +
      '<a href="meta.html">' + (BO.LANG ? 'Meta' : '环境统计') + '</a><a href="planner.html">' + (BO.LANG ? 'Planner' : '模拟构筑') + '</a></div>' +
      '<div class="foot-col"><h5>' + (BO.LANG ? 'About' : '关于') + '</h5>' +
      '<a href="about.html#sources">' + (BO.LANG ? 'Data sources' : '数据来源') + '</a>' +
      '<a href="about.html#api">' + (BO.LANG ? 'Public API' : '公开 API') + '</a>' +
      '<a href="about.html#disclaimer">' + (BO.LANG ? 'Disclaimer' : '免责声明') + '</a>' +
      '<a href="https://api.playbrokenoath.com/" target="_blank" rel="noopener">' + (BO.LANG ? 'API docs' : 'API 文档') + BO.ico('ext') + '</a></div>' +
      '</div><div class="foot-bottom"><div class="foot-bottom-in">' +
      '<span>© ' + year + ' Broken Oath Data Base · ' + (BO.LANG ? 'Fan project' : '粉丝作品') + ' · ' + (BO.LANG ? 'patch' : '版本') + ' <b class="verchip">' + BO.VER_LOCAL + '</b></span>' +
      '<span class="foot-disc">' + (BO.LANG
        ? 'Game names, art and data belong to their owners. Ladder and build data: Broken Oath public API, cached by this site. No player identities are shown.'
        : '游戏名称、美术与数据归其各自所有者。天梯与构筑数据来自 Broken Oath public API，由本站缓存。不展示任何玩家身份信息。') + '</span>' +
      '</div></div></footer>' +
      '<a href="#top" class="to-top" id="boToTop" aria-label="' + (BO.LANG ? 'Back to top' : '回到顶部') + '">' + BO.ico('arrowUp') + '</a>';

    var top = host.querySelector('#boToTop');
    function syncTop() { top.classList.toggle('on', (window.scrollY || 0) > 500); }
    window.addEventListener('scroll', syncTop, { passive: true });
    syncTop();
    top.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  BO.mountShell = function (active) {
    BO.mountHeader(active);
    BO.mountFooter();
    if (document.body) document.body.id = document.body.id || 'top';
  };
  BO.setDocumentTitle = function (zh, en) {
    document.title = (BO.LANG ? en : zh) + ' · Broken Oath Data Base';
  };

  /* ------------------------------------------------------------ 8. search */
  BO.mountSearch = function (active) {
    var layer = document.createElement('div');
    layer.className = 'search-layer';
    layer.id = 'boSearchLayer';
    layer.innerHTML = '<div class="search-box" role="dialog" aria-modal="true" aria-label="' + (BO.LANG ? 'Search' : '搜索') + '">' +
      '<div class="search-top">' + BO.ico('search') +
      '<input class="search-input" id="boSearchInput" type="search" autocomplete="off" spellcheck="false" placeholder="' + (BO.LANG ? 'Search items, skills, gems, monsters…' : '搜索物品、技能、宝石、怪物…') + '">' +
      '<button class="search-close" id="boSearchClose" aria-label="' + (BO.LANG ? 'Close' : '关闭') + '">' + BO.ico('close') + '</button></div>' +
      '<div class="search-results" id="boSearchResults"></div>' +
      '<div class="search-foot"><span>' + BO.ico('arrowUp') + ' ' + BO.ico('arrow') + ' ' + (BO.LANG ? 'navigate' : '选择') + '</span><span>Enter ' + (BO.LANG ? 'open' : '打开') + '</span><span>Esc ' + (BO.LANG ? 'close' : '关闭') + '</span><span class="sp">' + (BO.LANG ? 'Global index · 1,700 entries' : '全局索引 · 1,700+ 条') + '</span></div>' +
      '</div>';
    document.body.appendChild(layer);
    var input = layer.querySelector('#boSearchInput');
    var results = layer.querySelector('#boSearchResults');
    var index = null, loading = false, rows = [], cursor = -1;

    function open() {
      layer.classList.add('open');
      setTimeout(function () { input.focus(); }, 30);
      if (!index && !loading) loadIndex();
      if (input.value) run(input.value);
    }
    function close() {
      layer.classList.remove('open');
      input.value = '';
      results.innerHTML = '';
      cursor = -1;
    }
    BO.closeSearch = close;

    function loadIndex() {
      loading = true;
      results.innerHTML = '<div class="loading"><span class="spinner"></span>' + (BO.LANG ? 'Loading index…' : '正在载入索引…') + '</div>';
      var s = document.createElement('script');
      s.src = 'assets/data/search.js';
      s.onload = function () {
        index = window.BO_SEARCH || [];
        loading = false;
        if (input.value) run(input.value); else renderDefault();
      };
      s.onerror = function () {
        loading = false;
        results.innerHTML = '<div class="search-empty">' + (BO.LANG ? 'Search index failed to load.' : '搜索索引载入失败。') + '</div>';
      };
      document.head.appendChild(s);
    }

    function renderDefault() {
      results.innerHTML = '<div class="search-empty">' + (BO.LANG ? 'Type to search 1,700 items, gems and monsters. Try “storm”, “神像”, “guardian”…' : '输入关键词搜索 1700 条物品、宝石与怪物。试试「风暴」「idol」「guardian」…') + '</div>';
    }

    function score(r, q) {
      var z = (r.z || '').toLowerCase(), e = (r.e || '').toLowerCase(), s = (r.s || '').toLowerCase(), id = (r.i || '').toLowerCase();
      if (z === q || e === q || id === q) return 0;
      if (z.indexOf(q) === 0 || e.indexOf(q) === 0) return 1;
      if (z.indexOf(q) >= 0 || e.indexOf(q) >= 0) return 2;
      if (id.indexOf(q) >= 0 || s.indexOf(q) >= 0) return 3;
      return 9;
    }
    function run(q) {
      if (!index) { loadIndex(); return; }
      var term = String(q || '').trim().toLowerCase();
      if (!term) { renderDefault(); return; }
      var parts = term.split(/\s+/).filter(Boolean);
      var found = [];
      for (var i = 0; i < index.length; i++) {
        var r = index[i];
        var hay = ((r.z || '') + ' ' + (r.e || '') + ' ' + (r.i || '') + ' ' + (r.s || '')).toLowerCase();
        var ok = true;
        for (var j = 0; j < parts.length; j++) if (hay.indexOf(parts[j]) < 0) { ok = false; break; }
        if (!ok) continue;
        r._s = score(r, term);
        found.push(r);
      }
      found.sort(function (a, b) { return a._s - b._s || (a.z || '').localeCompare(b.z || '', 'zh'); });
      found = found.slice(0, 40);
      rows = found;
      cursor = -1;
      if (!found.length) {
        results.innerHTML = '<div class="search-empty">' + (BO.LANG ? 'No match. Try a shorter keyword.' : '没有匹配结果，试试更短的关键词。') + '</div>';
        return;
      }
      var groups = {}, order = [];
      found.forEach(function (r) {
        var g = r.g || '其他';
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push(r);
      });
      var html = '';
      order.forEach(function (g) {
        html += '<div class="sr-label">' + BO.esc(g) + '</div>';
        groups[g].slice(0, 8).forEach(function (r) {
          var idx = rows.indexOf(r);
          var icon = r.k ? BO.icon(r.k, 'rune', r.c || '#a8a8a8', 30, 30) : '<span class="glyph">' + BO.ico('rune') + '</span>';
          html += '<button class="sr-item" data-i="' + idx + '">' + '<span class="sr-ico">' + icon + '</span>' +
            '<span class="sr-txt"><b>' + BO.esc(r.z || r.e || r.i) + '</b><span>' + BO.esc(r.s || r.e || '') + '</span></span>' +
            '<span class="sr-kind">' + BO.esc(r.g || '') + '</span></button>';
        });
      });
      results.innerHTML = html;
      Array.prototype.forEach.call(results.querySelectorAll('.sr-item'), function (btn) {
        btn.addEventListener('click', function () { go(rows[+btn.dataset.i]); });
        btn.addEventListener('mouseenter', function () {
          cursor = +btn.dataset.i;
          Array.prototype.forEach.call(results.querySelectorAll('.sr-item'), function (b) { b.classList.toggle('on', +b.dataset.i === cursor); });
        });
      });
    }
    function go(r) {
      if (!r) return;
      close();
      location.href = r.u;
    }
    function move(d) {
      if (!rows.length) return;
      cursor = (cursor + d + rows.length) % rows.length;
      Array.prototype.forEach.call(results.querySelectorAll('.sr-item'), function (b) {
        b.classList.toggle('on', +b.dataset.i === cursor);
      });
      var el = results.querySelector('.sr-item.on');
      if (el) el.scrollIntoView({ block: 'nearest' });
    }

    input.addEventListener('input', BO.debounce(function () { run(input.value); }, 90));
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (cursor >= 0) go(rows[cursor]); else if (rows[0]) go(rows[0]); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    layer.addEventListener('click', function (e) { if (e.target === layer) close(); });
    layer.querySelector('#boSearchClose').addEventListener('click', close);

    var btn = document.getElementById('boSearchBtn');
    if (btn) btn.addEventListener('click', open);
    try {
      var sp = new URLSearchParams(location.search);
      if (sp.get('search') === '1') {
        setTimeout(function () {
          open();
          var sq = sp.get('q');
          if (sq) { input.value = sq; run(sq); }
        }, 60);
      }
    } catch (e) {}
    document.addEventListener('keydown', function (e) {
      if ((e.key === '/' || (e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey))) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        e.preventDefault(); open();
      }
      if (e.key === 'Escape' && layer.classList.contains('open')) close();
    });
  };

  /* -------------------------------------------------------- 9. small components */
  BO.loadScript = function (src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      document.head.appendChild(s);
    });
  };

  BO.card = function (html, cls) { return '<article class="item-card ' + (cls || '') + '">' + html + '</article>'; };
  BO.empty = function (title, sub) {
    return '<div class="empty"><h3>' + BO.esc(title) + '</h3>' + (sub ? '<p>' + BO.esc(sub) + '</p>' : '') + '</div>';
  };
  BO.errorBox = function (msg, retryId) {
    return '<div class="errorbox">' + BO.ico('warning') + ' <b>' + (BO.LANG ? 'Could not load data.' : '数据加载失败。') + '</b> ' + BO.esc(msg || '') +
      (retryId ? ' <button class="btn btn-sm" id="' + retryId + '">' + (BO.LANG ? 'Retry' : '重试') + '</button>' : '') + '</div>';
  };
  BO.loading = function (msg) { return '<div class="loading"><span class="spinner"></span>' + (msg || (BO.LANG ? 'Loading…' : '正在载入…')) + '</div>'; };

  BO.popup = function (html, cls) {
    BO.closePopup();
    var layer = document.createElement('div');
    layer.className = 'popup-layer';
    layer.id = 'boPopupLayer';
    layer.innerHTML = '<div class="popup ' + (cls || '') + '" role="dialog" aria-modal="true">' +
      '<button class="popup-close" aria-label="关闭">' + BO.ico('close') + '</button>' + html + '</div>';
    document.body.appendChild(layer);
    document.body.style.overflow = 'hidden';
    layer.addEventListener('click', function (e) { if (e.target === layer) BO.closePopup(); });
    layer.querySelector('.popup-close').addEventListener('click', BO.closePopup);
    var onKey = function (e) { if (e.key === 'Escape') BO.closePopup(); };
    document.addEventListener('keydown', onKey);
    layer._onKey = onKey;
    return layer;
  };
  BO.closePopup = function () {
    var layer = document.getElementById('boPopupLayer');
    if (!layer) return;
    if (layer._onKey) document.removeEventListener('keydown', layer._onKey);
    layer.remove();
    document.body.style.overflow = '';
  };

  /* item popup builders -------------------------------------------------- */
  function mods(list, cls) {
    if (!list || !list.length) return '';
    return '<ul class="ip-mods ' + (cls || '') + '">' + list.map(function (m) {
      return '<li>' + BO.hl(BO.T(m)) + '</li>';
    }).join('') + '</ul>';
  }
  function statRow(label, value) {
    return '<div class="ip-stat"><span>' + label + '</span><b>' + value + '</b></div>';
  }
  BO.itemPopup = function (kind, rec) {
    if (!rec) return;
    var html = '', name = BO.T(rec.n), cls = 'normal', icon = '';
    if (kind === 'unique') {
      cls = 'unique';
      icon = BO.art(rec.baseId ? 'base' : 'unique', rec.baseId || rec.id);
      html += '<div class="ip-head"><div class="ip-art">' + icon + '</div><div class="ip-name unique">' + BO.hl(name) + '</div>' +
        '<div class="ip-base">' + BO.hl(BO.T(rec.base)) + '</div><div class="ip-meta">' +
        '<span>Lv ' + rec.lvl + '</span><span>·</span><span>红色阶级 ' + (['I', 'II', 'III', 'IV', 'V', 'VI'][rec.tier - 1] || rec.tier) + '</span>' +
        (rec.drop ? '<span>· 权重 ' + rec.drop + '</span>' : '') + '</div></div>';
      html += '<div class="ip-body">' + mods(rec.mods, 'unique') + (rec.flav && (rec.flav[0] || rec.flav[1]) ? '<div class="ip-flav">' + BO.hl(BO.T(rec.flav)) + '</div>' : '') + '</div>';
      html += '<div class="ip-foot"><span>' + BO.T([rec.clsZh, rec.cls]) + ' · ' + BO.T([rec.slotZh, rec.slot]) + '</span><span>' + (rec.forged && rec.forged.length ? '可烬铸' : '') + '</span></div>';
    } else if (kind === 'base') {
      icon = BO.art('base', rec.id);
      html += '<div class="ip-head"><div class="ip-art">' + icon + '</div><div class="ip-name normal">' + BO.hl(name) + '</div>' +
        '<div class="ip-base">' + BO.T([rec.clsZh, rec.cls]) + ' · ' + BO.T([rec.slotZh, rec.slot]) + '</div>' +
        '<div class="ip-meta"><span>Lv ' + rec.lvl + '</span><span>·</span><span>尺寸 ' + String(rec.size || '1x1').replace('x', '×') + '</span></div></div>';
      html += '<div class="ip-body">';
      var stats = [];
      if (rec.dmg) stats.push(statRow('物理伤害', rec.dmg[0] + '–' + rec.dmg[1]));
      if (rec.aps) stats.push(statRow('攻击速度', rec.aps + '/秒'));
      if (rec.crit) stats.push(statRow('暴击率', rec.crit + '%'));
      if (rec.ar) stats.push(statRow('护甲', rec.ar));
      if (rec.ev) stats.push(statRow('闪避值', rec.ev));
      if (rec.es) stats.push(statRow('能量护盾', rec.es));
      if (rec.block) stats.push(statRow('格挡', rec.block + '%'));
      if (stats.length) html += '<div class="ip-sec"><div class="ip-label">属性</div><div class="ip-stats">' + stats.join('') + '</div></div>';
      if (rec.impl && rec.impl.length) html += '<div class="ip-sec"><div class="ip-label">固有词缀</div>' + mods(rec.impl, 'imp') + '</div>';
      var req = [];
      if (rec.req) ['str', 'dex', 'int'].forEach(function (k) { if (rec.req[k]) req.push({ str: '力量', dex: '敏捷', int: '智力' }[k] + ' ' + rec.req[k]); });
      html += '<div class="ip-sec"><div class="ip-req">' + (req.length ? '需求：' + req.join(' · ') : '无属性需求') + (rec.nw ? ' · 可开孔' : '') + '</div></div>';
      html += '</div><div class="ip-foot"><span>' + (rec.tags || []).map(function (t) { return BO.T(t); }).join(' · ') + '</span><span>' + (rec.drop ? '掉落权重 ' + rec.drop : '') + '</span></div>';
    } else if (kind === 'rune' || kind === 'jewel') {
      icon = BO.art(kind, rec.id);
      var isJewel = kind === 'jewel';
      html += '<div class="ip-head"><div class="ip-art">' + icon + '</div><div class="ip-name normal">' + BO.hl(name) + '</div>' +
        '<div class="ip-base">' + (isJewel ? '珠宝' : '符文') + ' · 阶级 ' + rec.tier + (rec.lore && rec.lore[0] ? ' · ' + BO.T(rec.lore) : '') + '</div>' +
        '<div class="ip-meta"><span>Lv ' + rec.lvl + '</span><span>·</span><span>权重 ' + rec.weight + '</span></div></div>';
      html += '<div class="ip-body"><div class="ip-sec"><div class="ip-label">嵌入武器</div>' + mods(rec.w) + '</div>' +
        '<div class="ip-sec"><div class="ip-label">嵌入护甲</div>' + mods(rec.a) + '</div></div>';
      html += '<div class="ip-foot"><span>' + (isJewel ? '珠宝' : '符文') + '</span><span>阶梯 ' + rec.tier + '</span></div>';
    } else if (kind === 'runeword') {
      cls = 'magic';
      html += '<div class="ip-head"><div class="ip-name magic">' + BO.hl(name) + '</div><div class="ip-base">' + BO.T([rec.clsZh, rec.cls]) + ' · ' + BO.T([rec.buildZh, rec.build]) + '</div>' +
        '<div class="ip-meta"><span>Lv ' + rec.lvl + '</span><span>·</span><span>' + rec.sockets + ' 孔</span></div></div>';
      html += '<div class="ip-body"><div class="ip-sec"><div class="ip-label">符文序列</div><div class="row" style="color:var(--currency);font-family:var(--font-disp);font-size:16px">' +
        rec.runes.map(function (r) { return BO.esc(BO.T(r)); }).join(' · ') + '</div></div>' +
        '<div class="ip-sec"><div class="ip-label">可嵌入</div><div class="chips">' + rec.bases.map(function (b) { return '<span class="tag">' + BO.esc(BO.T(b)) + '</span>'; }).join('') + '</div></div>' +
        '<div class="ip-sec"><div class="ip-label">词缀</div>' + mods(rec.mods) + '</div>' +
        (rec.power && rec.power.length ? '<div class="ip-sec"><div class="ip-label">注入奖励</div>' + mods(rec.power, 'unique') + '</div>' : '') +
        (rec.flav && (rec.flav[0] || rec.flav[1]) ? '<div class="ip-flav">' + BO.T(rec.flav) + '</div>' : '') + '</div>';
      if (rec.bands && rec.bands.length) {
        html += '<div class="ip-sec" style="padding:0 22px 14px"><div class="ip-label">物品等级强化</div>' +
          rec.bands.map(function (b) { return '<div class="small muted">ilvl ' + b.ilvl + '+</div>' + mods(b.lines); }).join('') + '</div>';
      }
    } else if (kind === 'affix') {
      html += '<div class="ip-head"><div class="ip-name magic">' + BO.T([rec.typeZh, rec.type]) + ' · ' + BO.esc(rec.groupZh || rec.group) + '</div>' +
        '<div class="ip-base">' + rec.onZh.map(function (s) { return BO.esc(s); }).join(' · ') + '</div></div><div class="ip-body">' +
        '<table class="tbl compact"><thead><tr><th>阶级</th><th>名号</th><th>iLvl</th><th>数值</th><th>权重</th></tr></thead><tbody>' +
        rec.tiers.map(function (t, i) {
          return '<tr' + (i === 0 ? ' style="color:var(--gold)"' : '') + '><td class="mono">' + t.t + '</td><td>' + BO.hl(BO.T(t.name)) + '</td><td class="mono">' + t.ilvl + '</td><td>' + BO.hl(BO.T(t.line || rec.top)) + '</td><td class="mono">' + (t.w == null ? '' : t.w) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } else if (kind === 'potion') {
      html += '<div class="ip-head"><div class="ip-name normal">' + BO.hl(name) + '</div><div class="ip-base">' + BO.T([rec.roleZh, rec.role]) + '</div></div>' +
        '<div class="ip-body">' + (rec.text ? '<div class="ip-sec"><div class="ip-label">效果</div><div class="small">' + BO.hl(BO.T(rec.text)) + '</div></div>' : '') +
        mods(rec.mods) + '</div>';
    }
    BO.popup(html);
  };

  /* ----------------------------------------------------------- 10. misc UI */
  BO.tabs = function (host, items, active, onChange) {
    host.innerHTML = items.map(function (it) {
      return '<button class="tab" role="tab" data-k="' + BO.attr(it[0]) + '" aria-selected="' + (it[0] === active) + '">' +
        BO.esc(BO.T(it[1])) + (it[2] != null ? '<i>' + it[2] + '</i>' : '') + '</button>';
    }).join('');
    host.onclick = function (e) {
      var b = e.target.closest('.tab');
      if (!b || b.getAttribute('aria-selected') === 'true') return;
      Array.prototype.forEach.call(host.querySelectorAll('.tab'), function (x) { x.setAttribute('aria-selected', 'false'); });
      b.setAttribute('aria-selected', 'true');
      onChange(b.dataset.k);
    };
  };
  BO.facets = function (host, groups, onChange) {
    var html = groups.filter(function (g) { return g.values && g.values.size > 1; }).map(function (g) {
      var chips = Array.from(g.values.entries()).sort(function (a, b) {
        return (b[1] - a[1]) || String(a[0]).localeCompare(String(b[0]), 'zh');
      }).map(function (pair) {
        var v = pair[0], c = pair[1], on = g.selected.has(v);
        return '<button class="chip" data-g="' + BO.attr(g.id) + '" data-v="' + BO.attr(v) + '" aria-pressed="' + on + '">' +
          BO.esc(g.display ? g.display(v) : v) + ' <b>' + c + '</b></button>';
      }).join('');
      return '<div class="facet"><h4>' + BO.esc(g.label) + (g.selected.size ? '<button class="facet-reset" data-clear="' + BO.attr(g.id) + '">清除</button>' : '') + '</h4><div class="chips">' + chips + '</div></div>';
    }).join('');
    host.innerHTML = html || '<div class="facet"><h4>筛选</h4><div class="small muted">当前分类没有可用筛选项</div></div>';
    host.onclick = function (e) {
      var b = e.target.closest('.chip, .facet-reset');
      if (!b) return;
      if (b.dataset.clear) onChange(b.dataset.clear, null);
      else onChange(b.dataset.g, b.dataset.v);
    };
  };
  BO.readHash = function () {
    var raw = BO.hash();
    var i = raw.indexOf('?');
    return {
      path: i < 0 ? raw : raw.slice(0, i),
      params: new URLSearchParams(i < 0 ? '' : raw.slice(i + 1))
    };
  };
  BO.pager = function (page, pages, onGo) {
    if (pages <= 1) return '';
    var out = [];
    out.push('<button data-p="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>‹</button>');
    var from = Math.max(1, page - 2), to = Math.min(pages, page + 2);
    if (from > 1) out.push('<button data-p="1">1</button>');
    if (from > 2) out.push('<span class="info">…</span>');
    for (var i = from; i <= to; i++) out.push('<button data-p="' + i + '"' + (i === page ? ' class="on"' : '') + '>' + i + '</button>');
    if (to < pages - 1) out.push('<span class="info">…</span>');
    if (to < pages) out.push('<button data-p="' + pages + '">' + pages + '</button>');
    out.push('<button data-p="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>›</button>');
    out.push('<span class="info">共 ' + pages + ' 页</span>');
    var host = document.createElement('div');
    host.className = 'pager';
    host.innerHTML = out.join('');
    host.onclick = function (e) {
      var b = e.target.closest('button[data-p]');
      if (b && !b.disabled) onGo(+b.dataset.p);
    };
    return host;
  };

  /* ---------------------------------------------------------- 11. build cards */
  BO.supportIcons = function (ids, max) {
    ids = (ids || []).filter(function (x) { return x && x !== 'hidden'; }).slice(0, max || 6);
    return ids.map(function (id) {
      var key = String(id).toLowerCase();
      var src = (window.BO_ICONS || {})['sp:' + key];
      if (src) return '<span class="ico ico-img" style="--ico:#8fb0e8" title="' + BO.attr(BO.supNm(key)) + '"><img src="' + BO.attr(src) + '" alt=""></span>';
      return '<span class="ico" style="--ico:#8fb0e8" title="' + BO.attr(BO.supNm(key)) + '"><svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1.7 1.7"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1.7-1.7"/></svg></span>';
    }).join('');
  };
  BO.heroUrl = function (league, cls, hero) {
    return 'build.html?league=' + encodeURIComponent(league) + '&class=' + encodeURIComponent(cls) + '&hero=' + encodeURIComponent(hero);
  };
  BO.buildCard = function (row, league, opts) {
    opts = opts || {};
    var cls = row.class || opts.cls || '';
    var skill = row.main_skill || '';
    var skillId = String(skill).toLowerCase();
    var main = skillId && skillId !== 'hidden' ? BO.namePair('skills', skillId) : null;
    var skillName = main ? (BO.LANG ? main[1] : main[0]) : '未公开';
    var supports = row.main_supports || [];
    var mainKey = String(skill).toLowerCase();
    var mainSrc = (window.BO_ICONS || {})['sk:' + mainKey];
    var mainIcon = mainSrc ? '<span class="ico ico-img" style="--ico:#1ba29b"><img src="' + BO.attr(mainSrc) + '" alt=""></span>'
      : '<span class="ico" style="--ico:#1ba29b"><svg viewBox="0 0 24 24"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/></svg></span>';
    return '<a class="build-card" href="' + BO.heroUrl(league, cls, row.hero) + '">' +
      '<div class="bc-top">' + mainIcon +
      '<span class="bc-txt"><span class="bc-name">' + BO.esc(skillName) + '</span><span class="bc-sub">' + BO.esc(BO.classZh(cls)) + ' · ' + BO.esc(BO.aspectZh(row.ascendancy)) + ' · Lv ' + row.level + '</span></span>' +
      '<span class="bc-dps"><b>' + (row.guardian_dps_median ? BO.big(row.guardian_dps_median) : '—') + '</b><span>GUARDIAN DPS</span></span></div>' +
      '<div class="bc-suports">' + BO.supportIcons(supports, 6) + '</div>' +
      '<div class="bc-foot"><span>RL ' + (row.rupture_level == null ? '—' : row.rupture_level) + ' · #' + (row.class_rank || row.rank || '—') + '</span><span>' + (row.has_build === false ? '' : '查看构筑 →') + '</span></div></a>';
  };

  /* --------------------------------------------------------- 12. class chip */
  BO.classChip = function (cls) {
    return '<span class="cls-chip c-' + BO.attr(cls) + '">' + BO.esc(BO.classZh(cls)) + '</span>';
  };
  BO.aspectChip = function (aspect) {
    if (!aspect) return '<span class="tag">未选择龙相</span>';
    var color = BO.aspectColor(aspect);
    return '<span class="tag" style="border-color:' + color + '55;color:' + color + ';background:' + color + '14">' + BO.esc(BO.aspectZh(aspect)) + '</span>';
  };
  BO.leagueOptions = function (leagues, current) {
    var list = BO.leagueSort(leagues && leagues.leagues ? leagues.leagues : leagues);
    return list.map(function (l) {
      var nm = BO.seasonName(l) + ' · ' + BO.leagueShort(l);
      return '<option value="' + BO.attr(l.id) + '"' + (l.id === current ? ' selected' : '') + '>' + BO.esc(nm) + '</option>';
    }).join('');
  };
  BO.statusLabel = function (l) {
    var s = BO.leagueStatus(l);
    return s === 'live' ? (BO.LANG ? 'Live' : '进行中') : s === 'upcoming' ? (BO.LANG ? 'Upcoming' : '即将开始') : (BO.LANG ? 'Ended' : '已结束');
  };

  /* ------------------------------------------------------ 13. bootstrap */
  BO.init = function (active, fn) {
    BO.mountShell(active);
    try { fn(); } catch (e) {
      console.error(e);
      var main = document.getElementById('main');
      if (main) main.insertAdjacentHTML('afterbegin', BO.errorBox(e.message));
    }
  };
})();
