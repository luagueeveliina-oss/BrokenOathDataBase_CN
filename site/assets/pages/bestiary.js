/* Bestiary — monsters, guardians and rift modifiers. */
(function () {
  'use strict';
  var BO = window.BO;
  var M = window.BO_MOBS || { monsters: [], guardians: [], tiers: [] };
  var S = { cat: 'mobs', q: '', sort: 'life', f: {}, page: 1, per: 50, pin: '' };
  var ROLE_ZH = { bruiser: '猛攻', leaper: '跃击', charger: '冲锋', pulser: '脉冲', caster: '施法', swarm: '虫群', shield: '持盾', archer: '弓手', summoner: '召唤', stalker: '潜行', flyer: '飞行', brute: '蛮力' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return BO.esc(s); }
  function T(p) { return BO.T(p); }
  function roleName(r) { return ROLE_ZH[r] || r || '—'; }
  function isGuardianMob(m) { return /^g_/.test(m.id); }

  var CATS = [
    { k: 'mobs', zh: '怪物', en: 'Monsters', arr: function () { return M.monsters; }, facets: [['type', '类型', function (m) { return [isGuardianMob(m) ? '守护者随从' : '普通怪物']; }], ['role', '角色', function (m) { return m.role ? [roleName(m.role)] : []; }]], sorts: ['life', 'dmg', 'xp', 'name'] },
    { k: 'bosses', zh: '守护者', en: 'Guardians', arr: function () { return M.guardians; }, facets: [], sorts: ['name'] },
    { k: 'mech', zh: '首领机制', en: 'Modifiers', arr: function () { return M.tiers; }, facets: [], sorts: ['rl', 'name'] }
  ];
  function catOf(k) { return CATS.find(function (c) { return c.k === k; }) || CATS[0]; }
  function arrOf(k) { return catOf(k).arr(); }
  CATS.forEach(function (c) { c.arr().forEach(function (r) { if (!r._s) r._s = JSON.stringify(r).toLowerCase(); }); });

  function readHash() {
    var h = BO.readHash();
    var path = h.path, qs = h.params;
    var i = path.indexOf('/');
    var cat = i < 0 ? path : path.slice(0, i);
    var id = i < 0 ? '' : path.slice(i + 1);
    if (!cat) return false;
    var def = CATS.find(function (c) { return c.k === cat; });
    if (!def) return false;
    S.cat = cat;
    S.pin = id && def.arr().some(function (r) { return r.id === id; }) ? id : '';
    S.q = ''; S.f = {}; S.page = 1;
    if (qs) {
      if (qs.has('q')) S.q = (qs.get('q') || '').trim();
      var valid = (def.facets || []).map(function (f) { return f[0]; });
      qs.forEach(function (v, k) { if (k !== 'q' && valid.indexOf(k) >= 0 && v) (S.f[k] || (S.f[k] = new Set())).add(v); });
    }
    var qel = $('q'); if (qel) qel.value = S.q;
    return true;
  }
  readHash();
  var q0 = new URLSearchParams(location.search).get('q');
  if (q0) S.q = q0;

  function filtered(k) {
    var def = catOf(k);
    var arr = def.arr();
    if (S.pin && k === S.cat) return arr.filter(function (r) { return r.id === S.pin; });
    if (S.q) {
      var terms = S.q.toLowerCase().split(/\s+/).filter(Boolean);
      arr = arr.filter(function (r) { return terms.every(function (t) { return r._s.indexOf(t) >= 0; }); });
    }
    (def.facets || []).forEach(function (f) {
      var set = S.f[f[0]];
      if (!set || !set.size) return;
      arr = arr.filter(function (r) { return f[2](r).some(function (v) { return set.has(v); }); });
    });
    return arr;
  }

  /* ------------------------------------------------------------- popups */
  function monsterPopup(m) {
    BO.popup('<div class="ip-head"><div class="ip-name normal">' + esc(T(m.n)) + '</div><div class="ip-base">' + (isGuardianMob(m) ? '守护者随从' : '怪物') + (m.role ? ' · ' + esc(roleName(m.role)) : '') + '</div></div><div class="ip-body">' +
      '<div class="ip-stats">' +
      '<div class="ip-stat"><span>生命</span><b>' + (m.life == null ? '—' : BO.num(m.life)) + '</b></div>' +
      '<div class="ip-stat"><span>伤害</span><b>' + (m.dmin == null ? '—' : m.dmin + '–' + m.dmax) + '</b></div>' +
      '<div class="ip-stat"><span>经验</span><b>' + (m.xp == null ? '—' : m.xp) + '</b></div>' +
      '<div class="ip-stat"><span>护甲</span><b>' + (m.armour == null ? '—' : m.armour) + '</b></div>' +
      '<div class="ip-stat"><span>步行 / 奔跑</span><b>' + (m.walk || 0) + ' / ' + (m.run || 0) + '</b></div>' +
      '<div class="ip-stat"><span>仇恨范围</span><b>' + (m.aggro || 0) + '</b></div>' +
      '</div>' +
      ((m.atk || []).length ? '<div class="ip-sec"><div class="ip-label">攻击模式</div><table class="tbl compact"><thead><tr><th>类型</th><th class="num">倍率</th><th class="num">冷却</th><th class="num">距离</th><th class="num">角度</th></tr></thead><tbody>' +
        m.atk.map(function (a) { return '<tr><td>' + esc(a.kind || '—') + '</td><td class="num">' + (a.dmg == null ? '—' : a.dmg) + '</td><td class="num">' + (a.cd == null ? '—' : a.cd + 's') + '</td><td class="num">' + (a.range == null ? '—' : a.range) + '</td><td class="num">' + (a.angle == null ? '—' : a.angle) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '') + '</div>');
  }

  function guardianPopup(g) {
    BO.popup('<div class="ip-head"><div class="ip-name unique">' + esc(T(g.n)) + '</div><div class="ip-base">守护者 · 生命系数 ' + g.life + '×</div></div><div class="ip-body">' +
      (g.lore && (g.lore[0] || g.lore[1]) ? '<div class="ip-flav">' + esc(T(g.lore)) + '</div>' : '') +
      ((g.variants || []).length ? '<div class="ip-sec"><div class="ip-label">变体</div><table class="tbl compact"><thead><tr><th>变体</th><th>元素</th><th>抗性</th><th class="num">体型</th></tr></thead><tbody>' +
        g.variants.map(function (v) { return '<tr><td>' + esc(T(v.n)) + '</td><td>' + esc(v.element || '—') + '</td><td class="mono">' + Object.keys(v.resist || {}).map(function (k) { return k + ' +' + v.resist[k] + '%'; }).join(', ') + '</td><td class="num">' + (v.scale == null ? '—' : v.scale) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' : '') +
      ((g.phases || []).length ? '<div class="ip-sec"><div class="ip-label">阶段</div><ol class="phase-list">' + g.phases.map(function (p) { return '<li><b>P' + p.Phase + '</b><span>' + esc(p.Text) + '</span></li>'; }).join('') + '</ol></div>' : '') +
      '</div>');
  }

  function mechPopup(t) {
    BO.popup('<div class="ip-head"><div class="ip-name magic">' + esc(T(t.n)) + '</div><div class="ip-base">裂隙机制 · RL ' + t.fromRL + '+</div></div><div class="ip-body">' +
      (t.text && (t.text[0] || t.text[1]) ? '<div class="ip-sec"><div class="small" style="color:var(--fg2);line-height:1.8">' + esc(T(t.text)) + '</div></div>' : '') +
      '<div class="ip-stats"><div class="ip-stat"><span>起始 RL</span><b>' + t.fromRL + '</b></div><div class="ip-stat"><span>伤害系数</span><b>' + (t.damage == null ? '—' : t.damage) + '</b></div>' +
      (t.every ? '<div class="ip-stat"><span>出现间隔</span><b>每 ' + t.every + ' 级</b></div>' : '') + (t.count ? '<div class="ip-stat"><span>层数</span><b>' + t.count + '</b></div>' : '') +
      (t.pinnacle ? '<div class="ip-stat"><span>巅峰</span><b>是</b></div>' : '') + '</div></div>');
  }

  function openItem(kind, id) {
    if (kind === 'mobs') { var m = M.monsters.find(function (x) { return x.id === id; }); if (m) monsterPopup(m); }
    else if (kind === 'bosses') { var g = M.guardians.find(function (x) { return x.id === id; }); if (g) guardianPopup(g); }
    else { var t = M.tiers.find(function (x) { return x.id === id; }); if (t) mechPopup(t); }
  }

  /* -------------------------------------------------------------- cards */
  function dmgOf(m) { return m.dmin == null ? '—' : m.dmin + '–' + m.dmax; }

  function mobTable(rows) {
    return '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>怪物</th><th class="num">生命</th><th class="num">伤害</th><th class="num">经验</th><th class="num hide-sm">护甲</th><th class="num hide-sm">移速</th><th class="num hide-sm">攻击</th></tr></thead><tbody>' +
      rows.map(function (m) {
        return '<tr class="clickable" data-id="' + BO.attr(m.id) + '"><td class="name"><a href="#mobs/' + encodeURIComponent(m.id) + '">' + esc(T(m.n)) + '</a>' + (m.role ? ' <span class="tag">' + esc(roleName(m.role)) + '</span>' : '') + '</td>' +
          '<td class="num">' + (m.life == null ? '—' : BO.num(m.life)) + '</td><td class="num">' + dmgOf(m) + '</td><td class="num">' + (m.xp == null ? '—' : m.xp) + '</td>' +
          '<td class="num hide-sm">' + (m.armour == null ? '—' : m.armour) + '</td><td class="num hide-sm">' + (m.walk == null ? '—' : m.walk) + '</td><td class="num hide-sm">' + (m.nAtk || 0) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function guardianCard(g) {
    return '<article class="item-card hi" data-kind="bosses" data-id="' + BO.attr(g.id) + '" tabindex="0">' +
      '<div class="ic-head"><div class="ic-title"><div class="ic-name r-unique">' + esc(T(g.n)) + '</div><div class="ic-base">守护者 · 生命系数 ' + g.life + '×</div></div></div>' +
      (g.lore ? '<div class="small" style="color:var(--dim);font-style:italic;margin-top:8px;line-height:1.7">' + esc(T(g.lore)) + '</div>' : '') +
      '<div class="ic-tags">' + (g.variants || []).map(function (v) { return '<span class="tag gold">' + esc(T(v.n)) + (v.element ? ' · ' + esc(v.element) : '') + '</span>'; }).join('') + '</div>' +
      ((g.phases || []).length ? '<div class="tiny mute" style="margin-top:8px">' + g.phases.length + ' 个阶段 · 点击查看变体与抗性</div>' : '') +
      '<div class="ic-foot"><span>' + esc(g.ship || '') + '</span><span class="gold">查看守护者 →</span></div></article>';
  }

  function mechCard(t) {
    return '<article class="item-card" data-kind="mech" data-id="' + BO.attr(t.id) + '" tabindex="0">' +
      '<div class="ic-head"><div class="ic-title"><div class="ic-name">' + esc(T(t.n)) + '</div><div class="ic-base">RL ' + t.fromRL + '+ · ' + (t.every ? '每 ' + t.every + ' 级' : '按裂隙等级') + (t.pinnacle ? ' · 巅峰' : '') + '</div></div></div>' +
      (t.text && (t.text[0] || t.text[1]) ? '<div class="small" style="color:var(--fg2);margin-top:8px">' + esc(T(t.text)) + '</div>' : '') +
      '<div class="ic-foot"><span>伤害系数 ' + (t.damage == null ? '—' : t.damage) + '</span><span class="gold">查看详情 →</span></div></article>';
  }

  /* -------------------------------------------------------------- browse */
  function render() {
    BO.setTerms(S.q);
    var def = catOf(S.cat);
    $('tabs').innerHTML = CATS.map(function (c) {
      return '<button class="tab" role="tab" data-k="' + c.k + '" aria-selected="' + (c.k === S.cat) + '">' + esc(T([c.zh, c.en])) + '<i>' + c.arr().length + '</i></button>';
    }).join('');

    var pool = def.arr().filter(function (r) {
      if (S.pin) return true;
      if (!S.q) return true;
      var terms = S.q.toLowerCase().split(/\s+/).filter(Boolean);
      return terms.every(function (t) { return r._s.indexOf(t) >= 0; });
    });
    var groups = (def.facets || []).map(function (f) {
      var counts = new Map();
      pool.forEach(function (r) { f[2](r).forEach(function (v) { counts.set(v, (counts.get(v) || 0) + 1); }); });
      return { id: f[0], label: f[1], values: counts, selected: S.f[f[0]] || new Set() };
    });
    BO.facets($('side'), groups, function (gid, val) {
      if (val === null) delete S.f[gid];
      else {
        var s = S.f[gid] || (S.f[gid] = new Set());
        if (s.has(val)) s.delete(val); else s.add(val);
      }
      S.page = 1; S.pin = '';
      render();
    });

    var arr = filtered(S.cat).slice();
    var lv = function (r) { return r.life || 0; };
    if (S.sort === 'life') arr.sort(function (a, b) { return (b.life || 0) - (a.life || 0); });
    else if (S.sort === 'dmg') arr.sort(function (a, b) { return (b.dmax || 0) - (a.dmax || 0); });
    else if (S.sort === 'xp') arr.sort(function (a, b) { return (b.xp || 0) - (a.xp || 0); });
    else if (S.sort === 'rl') arr.sort(function (a, b) { return (a.fromRL || 0) - (b.fromRL || 0); });
    else arr.sort(function (a, b) { return T(a.n).localeCompare(T(b.n), 'zh'); });

    $('count').innerHTML = '<b>' + arr.length + '</b> 条' + esc(T([def.zh, def.en])) + (S.q ? ' · 匹配 “' + esc(S.q) + '”' : '');
    $('resultCount').textContent = arr.length + ' 条';
    $('hint').textContent = S.cat === 'mobs' ? '点击行查看攻击模式' : '点击卡片查看详情';
    $('pager').innerHTML = '';

    if (!arr.length) {
      $('list').innerHTML = BO.empty('没有匹配的结果', '试试更少的关键词或清空筛选。');
      return;
    }
    if (S.cat === 'mobs') {
      var pages = Math.max(1, Math.ceil(arr.length / S.per));
      if (S.page > pages) S.page = pages;
      $('list').innerHTML = mobTable(arr.slice((S.page - 1) * S.per, S.page * S.per));
      var pager = BO.pager(S.page, pages, function (p) { S.page = p; render(); window.scrollTo({ top: 200, behavior: 'smooth' }); });
      if (pager) $('pager').appendChild(pager);
    } else {
      $('list').innerHTML = '<div class="cards">' + arr.map(S.cat === 'bosses' ? guardianCard : mechCard).join('') + '</div>';
    }

    if (S.pin && arr.length) openItem(S.cat, arr[0].id);
  }

  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (!b) return;
    S.cat = b.dataset.k; S.pin = ''; S.f = {}; S.q = ''; S.page = 1; S.sort = S.cat === 'mech' ? 'rl' : S.cat === 'mobs' ? 'life' : 'name';
    $('q').value = ''; $('sort').value = S.sort;
    history.replaceState(null, '', '#' + S.cat);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('q').addEventListener('input', BO.debounce(function (e) { S.q = e.target.value.trim(); S.page = 1; S.pin = ''; render(); }, 130));
  $('sort').addEventListener('change', function (e) { S.sort = e.target.value; S.page = 1; render(); });
  $('list').addEventListener('click', function (e) {
    var row = e.target.closest('[data-id]');
    if (!row) return;
    if (e.target.closest('a')) { e.preventDefault(); }
    history.replaceState(null, '', '#' + S.cat + '/' + encodeURIComponent(row.dataset.id));
    openItem(S.cat, row.dataset.id);
  });
  $('list').addEventListener('keydown', function (e) {
    var card = e.target.closest('[data-id]');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openItem(S.cat, card.dataset.id); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('q').focus(); }
  });
  window.addEventListener('hashchange', function () { if (readHash()) { S.page = 1; render(); } });

  $('mobVer').textContent = '本地数据 ' + BO.VER_LOCAL;
  BO.mountShell('bestiary.html');
  render();
})();
