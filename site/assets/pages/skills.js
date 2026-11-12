/* Skills, supports, vows, woes and starter guides. */
(function () {
  'use strict';
  var BO = window.BO;
  var D = window.BO_SKILLS || { skills: [], supports: [], blessings: [], curses: [], guides: [] };
  var S = { cat: 'skills', q: '', sort: 'name', f: {}, pin: '' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return BO.esc(s); }
  function T(p) { return BO.T(p); }
  function tags(list) {
    return (list || []).map(function (t) {
      var label = Array.isArray(t) ? T(t) : t;
      return '<span class="tag">' + esc(label) + '</span>';
    }).join('');
  }
  function skillIcon(id, size) {
    var key = 'sk:' + String(id || '').toLowerCase();
    if ((window.BO_ICONS || {})[key]) return BO.icon(key, 'spark', '#1ba29b', size && size[0], size && size[1]);
    return BO.icon('', 'spark', '#1ba29b', size && size[0], size && size[1]);
  }
  function supportIcon(id, size) {
    var key = 'sp:' + String(id || '').toLowerCase();
    if ((window.BO_ICONS || {})[key]) return BO.icon(key, 'link', '#8fb0e8', size && size[0], size && size[1]);
    return BO.icon('', 'link', '#8fb0e8', size && size[0], size && size[1]);
  }

  function cleanDesc(s, text) {
    var out = T(text || '');
    out = out.replace(/\{Projectiles\}/g, s && s.proj ? String(s.proj) : '多枚');
    out = out.replace(/\{([A-Za-z]+)\}/g, '—');
    return out;
  }

  function canSupport(sup, sk) {
    var raw = sk.rawTags || (sk.tags || []).map(function (t) { return t[1]; });
    var req = (sup.req || []).map(function (t) { return Array.isArray(t) ? t[1] : t; });
    var excl = (sup.excl || []).map(function (t) { return Array.isArray(t) ? t[1] : t; });
    if (excl.some(function (t) { return raw.indexOf(t) >= 0; })) return false;
    if (!req.length) return true;
    return req.some(function (t) { return raw.indexOf(t) >= 0; });
  }

  var CATS = [
    { k: 'skills', zh: '技能宝石', en: 'Skill gems', arr: function () { return D.skills || []; }, card: skillCard, kind: 'skill', facets: [['cls', '职业', function (s) { return [T([s.clsZh, s.cls])]; }], ['tag', '标签', function (s) { return (s.tags || []).map(function (t) { return T(t); }); }], ['attr', '属性', function (s) { return [T([s.attrZh, s.attr])]; }]], sorts: ['name', 'cls'] },
    { k: 'supports', zh: '辅助宝石', en: 'Supports', arr: function () { return D.supports || []; }, card: supportCard, kind: 'support', facets: [['attr', '属性', function (s) { return [T([s.attrZh, s.attr])]; }], ['req', '需要标签', function (s) { return (s.req || []).map(function (t) { return T(t); }); }]], sorts: ['name', 'lvl'] },
    { k: 'blessings', zh: '誓约', en: 'Vows', arr: function () { return D.blessings || []; }, card: blessCard, kind: 'blessing', facets: [['kind', '类型', function (b) { return [T([b.kindZh, b.kind])]; }]], sorts: ['name'] },
    { k: 'curses', zh: '灾祸', en: 'Woes', arr: function () { return D.curses || []; }, card: curseCard, kind: 'curse', facets: [['kind', '类型', function (c) { return [T([c.kindZh, c.kind])]; }], ['elem', '元素', function (c) { return Object.keys(c.elem || {}); }]], sorts: ['name'] },
    { k: 'guides', zh: '开荒指南', en: 'Starter guides', arr: function () { return D.guides || []; }, card: guideCard, kind: 'guide', facets: [['cls', '职业', function (g) { return [T([g.clsZh, g.cls])]; }], ['role', '定位', function (g) { return [g.role || '—']; }]], sorts: ['name', 'cls'] }
  ];

  function catOf(k) { return CATS.find(function (c) { return c.k === k; }) || CATS[0]; }
  function arrOf(k) { return catOf(k).arr(); }
  CATS.forEach(function (c) {
    c.arr().forEach(function (r) { if (!r._s) r._s = JSON.stringify(r).toLowerCase(); });
  });

  function skillCard(s) {
    return '<article class="skill-card" data-kind="skill" data-id="' + BO.attr(s.id) + '" tabindex="0">' + skillIcon(s.id, [44, 50]) +
      '<div class="sc-body"><div class="sc-name"><span>' + esc(T(s.n)) + '</span><span class="tag">' + esc(T([s.kindZh, s.kind])) + '</span></div>' +
      '<div class="sc-sub">' + esc(T([s.clsZh, s.cls])) + ' · ' + esc(T([s.attrZh, s.attr])) + (s.dmgTypeZh ? ' · ' + esc(T([s.dmgTypeZh, s.dmgType])) : '') + '</div>' +
      '<div class="sc-tags">' + tags(s.tags) + '</div>' +
      (s.desc && (s.desc[0] || s.desc[1]) ? '<div class="sc-desc">' + esc(cleanDesc(s, s.desc)) + '</div>' : '') +
      '</div></article>';
  }

  function supportCard(s) {
    return '<article class="skill-card" data-kind="support" data-id="' + BO.attr(s.id) + '" tabindex="0">' + supportIcon(s.id, [44, 50]) +
      '<div class="sc-body"><div class="sc-name"><span>' + esc(T(s.n)) + '</span><span class="tag">辅助</span></div>' +
      '<div class="sc-sub">' + esc(T([s.attrZh, s.attr])) + ' · 等级 ' + (s.lvl || 1) + ' · 魔力倍率 ' + (s.mana == null ? '—' : s.mana) + '</div>' +
      '<div class="sc-tags">' + (s.req || []).map(function (t) { return '<span class="tag blue">' + esc(T(t)) + '</span>'; }).join('') + '</div>' +
      '<div class="sc-desc">' + esc(T((s.mods || [])[0] || s.desc)) + '</div></div></article>';
  }

  function blessCard(b) {
    return '<article class="item-card" data-kind="blessing" data-id="' + BO.attr(b.id) + '" tabindex="0">' +
      '<div class="ic-head">' + skillIcon(b.skill || b.id, [40, 46]) + '<div class="ic-title"><div class="ic-name">' + esc(T(b.n)) + '</div>' +
      '<div class="ic-base">' + esc(T([b.kindZh, b.kind])) + ' · 保留 ' + (b.resFlat == null ? '—' : b.resFlat) + '</div></div></div>' +
      '<div class="small" style="color:var(--fg2);margin-top:8px">' + esc(T(b.text)) + '</div>' +
      (b.vb && b.vb.text ? '<div class="ic-flav">' + esc(T(b.vb.text)) + '</div>' : '') + '</article>';
  }

  function curseCard(c) {
    return '<article class="item-card" data-kind="curse" data-id="' + BO.attr(c.id) + '" tabindex="0">' +
      '<div class="ic-head">' + skillIcon(c.id, [40, 46]) + '<div class="ic-title"><div class="ic-name">' + esc(T(c.n)) + '</div>' +
      '<div class="ic-base">' + esc(T([c.kindZh, c.kind])) + ' · 持续 ' + (c.dur == null ? '—' : c.dur + ' 秒') + '</div></div></div>' +
      '<div class="small" style="color:var(--fg2);margin-top:8px">' + esc(T(c.text)) + '</div>' +
      '<div class="ic-tags">' + (c.slow ? '<span class="tag">减速 ' + Math.round(c.slow * 100) + '%</span>' : '') + Object.keys(c.elem || {}).map(function (k) { return '<span class="tag violet">' + esc(k) + ' +' + c.elem[k] + '%</span>'; }).join('') + '</div></article>';
  }

  function guideCard(g) {
    return '<article class="item-card hi" data-kind="guide" data-id="' + BO.attr(g.id) + '" tabindex="0">' +
      '<div class="ic-head">' + skillIcon(g.skill, [44, 50]) + '<div class="ic-title"><div class="ic-name">' + esc(T(g.title)) + '</div>' +
      '<div class="ic-base">' + esc(T([g.clsZh, g.cls])) + ' · ' + esc(g.role || '') + '</div></div></div>' +
      '<div class="sc-tags">' + (g.wish || []).slice(0, 6).map(function (w) { return '<span class="tag">' + esc(w) + '</span>'; }).join('') + '</div>' +
      '<div class="small" style="color:var(--fg2);margin-top:8px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">' + esc(T(g.why)) + '</div>' +
      '<div class="ic-foot"><span>' + esc(T(g.title)) + '</span><span class="gold">打开指南 →</span></div></article>';
  }

  /* ------------------------------------------------------------- popups */
  function statsGrid(rows) {
    return '<div class="ip-sec"><div class="ip-label">属性</div><div class="ip-stats">' + rows.filter(function (r) { return r[1] != null && r[1] !== ''; }).map(function (r) {
      return '<div class="ip-stat"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>';
    }).join('') + '</div></div>';
  }
  function levelTable(s) {
    if (!s.rows || !s.rows.length) return '';
    return '<div class="ip-sec"><div class="ip-label">等级成长</div><div class="tbl-wrap" style="border:0"><table class="tbl compact"><thead><tr><th>等级</th><th class="num">最小</th><th class="num">最大</th></tr></thead><tbody>' +
      s.rows.map(function (r) { return '<tr><td class="mono">' + r[0] + '</td><td class="num">' + r[1] + '</td><td class="num">' + r[2] + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }
  function compatList(s) {
    var list = [];
    if (s.kind === 'Gem' || s.kind === 'Skill') {
      list = (D.supports || []).filter(function (x) { return canSupport(x, s); });
      return '<div class="ip-sec"><div class="ip-label">可链接的辅助（' + list.length + '）</div><div class="chips">' +
        list.slice(0, 16).map(function (x) { return '<span class="chip">' + esc(T(x.n)) + '</span>'; }).join('') + (list.length > 16 ? '<span class="chip">…</span>' : '') + '</div></div>';
    }
    if (s.req && s.req.length) {
      list = (D.skills || []).filter(function (x) { return canSupport(s, x); });
      return '<div class="ip-sec"><div class="ip-label">可辅助的技能（' + list.length + '）</div><div class="chips">' +
        list.slice(0, 16).map(function (x) { return '<span class="chip">' + esc(T(x.n)) + '</span>'; }).join('') + (list.length > 16 ? '<span class="chip">…</span>' : '') + '</div></div>';
    }
    return '';
  }
  function popupSkill(s) {
    BO.popup('<div class="ip-head"><div class="ip-art">' + skillIcon(s.id, [72, 84]) + '</div><div class="ip-name normal">' + esc(T(s.n)) + '</div>' +
      '<div class="ip-base">' + esc(T([s.clsZh, s.cls])) + ' · ' + esc(T([s.kindZh, s.kind])) + ' · ' + esc(T([s.attrZh, s.attr])) + '</div>' +
      '<div class="ip-meta">' + tags(s.tags) + '</div></div><div class="ip-body">' +
      (s.desc && (s.desc[0] || s.desc[1]) ? '<div class="ip-sec"><div class="ip-label">说明</div><div class="small" style="color:var(--fg2);line-height:1.75">' + esc(cleanDesc(s, s.desc)) + '</div></div>' : '') +
      statsGrid([['魔力消耗', s.mana], ['施放时间', s.cast], ['冷却', s.cd], ['范围', s.rng], ['半径', s.radius], ['伤害类型', T([s.dmgTypeZh, s.dmgType])], ['投放方式', T([s.deliveryZh, s.delivery])], ['效率', s.eff]]) +
      levelTable(s) + compatList(s) + '</div>');
  }
  function popupSupport(s) {
    BO.popup('<div class="ip-head"><div class="ip-art">' + supportIcon(s.id, [72, 84]) + '</div><div class="ip-name magic">' + esc(T(s.n)) + '</div>' +
      '<div class="ip-base">辅助宝石 · ' + esc(T([s.attrZh, s.attr])) + ' · 等级 ' + (s.lvl || 1) + '</div>' +
      '<div class="ip-meta">' + (s.req || []).map(function (t) { return '<span class="tag blue">' + esc(T(t)) + '</span>'; }).join('') + (s.excl || []).map(function (t) { return '<span class="tag red">不可用于 ' + esc(T(t)) + '</span>'; }).join('') + '</div></div><div class="ip-body">' +
      (s.desc && (s.desc[0] || s.desc[1]) ? '<div class="ip-sec"><div class="ip-label">说明</div><div class="small" style="color:var(--fg2);line-height:1.75">' + esc(cleanDesc(s, s.desc)) + '</div></div>' : '') +
      '<div class="ip-sec"><div class="ip-label">词缀</div><ul class="ip-mods">' + (s.mods || []).map(function (m) { return '<li>' + esc(T(m)) + '</li>'; }).join('') + '</ul></div>' +
      statsGrid([['魔力倍率', s.mana], ['等级', s.lvl], ['掉落权重', s.weight]]) + compatList(s) + '</div>');
  }
  function popupBless(b) {
    BO.popup('<div class="ip-head"><div class="ip-art">' + skillIcon(b.skill || b.id, [72, 84]) + '</div><div class="ip-name normal">' + esc(T(b.n)) + '</div>' +
      '<div class="ip-base">' + esc(T([b.kindZh, b.kind])) + '</div></div><div class="ip-body">' +
      '<div class="ip-sec"><div class="ip-label">效果</div><div class="small" style="color:var(--fg2)">' + esc(T(b.text)) + '</div></div>' +
      (b.vb && b.vb.text ? '<div class="ip-sec"><div class="ip-label">额外效果</div><div class="small" style="color:var(--fg2)">' + esc(T(b.vb.text)) + '</div></div>' : '') +
      statsGrid([['保留（固定）', b.resFlat], ['保留（每级）', b.resFlatPer], ['保留（百分比）', b.resPct]]) + '</div>');
  }
  function popupCurse(c) {
    BO.popup('<div class="ip-head"><div class="ip-art">' + skillIcon(c.id, [72, 84]) + '</div><div class="ip-name magic">' + esc(T(c.n)) + '</div>' +
      '<div class="ip-base">' + esc(T([c.kindZh, c.kind])) + '</div></div><div class="ip-body">' +
      '<div class="ip-sec"><div class="ip-label">效果</div><div class="small" style="color:var(--fg2)">' + esc(T(c.text)) + '</div></div>' +
      statsGrid([['持续', c.dur == null ? null : c.dur + ' 秒'], ['受到更多伤害', c.taken == null ? null : c.taken + '%'], ['减速', c.slow == null ? null : Math.round(c.slow * 100) + '%'], ['Boss 效果', c.boss == null ? null : c.boss]]) +
      (c.elem ? '<div class="ip-sec"><div class="ip-label">元素加成</div><div class="chips">' + Object.keys(c.elem).map(function (k) { return '<span class="chip">' + esc(k) + ' +' + c.elem[k] + '%</span>'; }).join('') + '</div></div>' : '') +
      '</div>');
  }
  function popupGuide(g) {
    var href = 'planner.html#code=' + encodeURIComponent(g.code || '');
    BO.popup('<div class="ip-head"><div class="ip-name normal">' + esc(T(g.title)) + '</div><div class="ip-base">' + esc(T([g.clsZh, g.cls])) + ' · ' + esc(g.role || '') + '</div></div><div class="ip-body">' +
      '<div class="ip-sec"><div class="ip-label">思路</div><div class="small" style="color:var(--fg2);line-height:1.8">' + esc(T(g.why)) + '</div></div>' +
      '<div class="ip-sec"><div class="ip-label">目标装备与技能</div><div class="chips">' + (g.wish || []).map(function (w) { return '<span class="chip">' + esc(w) + '</span>'; }).join('') + '</div></div>' +
      '<div class="ip-sec"><div class="ip-label">基石</div><div class="chips">' + (g.keys || []).map(function (k) { return '<span class="chip">' + esc(k) + '</span>'; }).join('') + '</div></div>' +
      '<div class="ip-sec"><div class="row"><a class="btn btn-gold" href="' + href + '">在模拟器中打开</a><button class="btn" id="copyGuide">复制构筑代码</button></div></div>' +
      '</div>');
    var b = document.getElementById('copyGuide');
    if (b) b.addEventListener('click', function () { BO.copy(g.code || ''); });
  }

  function openItem(kind, id) {
    var rec;
    if (kind === 'skill') rec = (D.skills || []).find(function (x) { return x.id === id; });
    else if (kind === 'support') rec = (D.supports || []).find(function (x) { return x.id === id; });
    else if (kind === 'blessing') rec = (D.blessings || []).find(function (x) { return x.id === id; });
    else if (kind === 'curse') rec = (D.curses || []).find(function (x) { return x.id === id; });
    else if (kind === 'guide') rec = (D.guides || []).find(function (x) { return x.id === id; });
    if (!rec) return;
    if (kind === 'skill') popupSkill(rec);
    else if (kind === 'support') popupSupport(rec);
    else if (kind === 'blessing') popupBless(rec);
    else if (kind === 'curse') popupCurse(rec);
    else popupGuide(rec);
  }

  /* ------------------------------------------------------------- browse */
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
    S.q = ''; S.f = {};
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
      S.pin = '';
      render();
    });

    var arr = filtered(S.cat).slice();
    if (S.sort === 'cls') arr.sort(function (a, b) { return String(a.cls || '').localeCompare(String(b.cls || '')) || T(a.n || a.title).localeCompare(T(b.n || b.title), 'zh'); });
    else if (S.sort === 'lvl') arr.sort(function (a, b) { return (a.lvl || 0) - (b.lvl || 0) || T(a.n).localeCompare(T(b.n), 'zh'); });
    else arr.sort(function (a, b) { return T(a.n || a.title).localeCompare(T(b.n || b.title), 'zh'); });

    $('count').innerHTML = '<b>' + arr.length + '</b> 条' + esc(T([def.zh, def.en])) + (S.q ? ' · 匹配 “' + esc(S.q) + '”' : '');
    $('resultCount').textContent = arr.length + ' 条';
    if (!arr.length) $('list').innerHTML = BO.empty('没有匹配的结果', '试试更少的关键词，或清空筛选。');
    else $('list').innerHTML = '<div class="cards">' + arr.map(def.card).join('') + '</div>';

    if (S.pin && arr.length) openItem(def.kind, arr[0].id);
  }

  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (!b) return;
    S.cat = b.dataset.k; S.pin = ''; S.f = {}; S.q = ''; S.sort = 'name'; $('q').value = '';
    history.replaceState(null, '', '#' + S.cat);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('q').addEventListener('input', BO.debounce(function (e) { S.q = e.target.value.trim(); S.pin = ''; render(); }, 130));
  $('sort').addEventListener('change', function (e) { S.sort = e.target.value; render(); });
  $('list').addEventListener('click', function (e) {
    var card = e.target.closest('[data-kind]');
    if (!card) return;
    var kind = card.dataset.kind, id = card.dataset.id;
    if (e.target.closest('a')) { e.preventDefault(); openItem(kind, id); return; }
    history.replaceState(null, '', '#' + S.cat + '/' + encodeURIComponent(id));
    openItem(kind, id);
  });
  $('list').addEventListener('keydown', function (e) {
    var card = e.target.closest('[data-kind]');
    if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openItem(card.dataset.kind, card.dataset.id); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('q').focus(); }
  });
  window.addEventListener('hashchange', function () { if (readHash()) render(); });

  $('skillVer').textContent = '本地数据 ' + BO.VER_LOCAL;
  BO.mountShell('skills.html');
  render();
})();
