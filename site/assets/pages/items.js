/* Item database — categories, facets, search, deep links and PoEDB-style popups. */
(function () {
  'use strict';
  var BO = window.BO;
  var IT = window.BO_ITEMS || { bases: [], uniques: [], affixes: [], runes: [], jewels: [], runewords: [], potions: {}, cube: [], forge: [], mythic: [], materials: [] };
  var T = BO.T, esc = BO.esc, num = BO.num, hl = BO.hl;

  var SLOT_ZH = {
    MainHand: ['主手', 'Main hand'], OffHand: ['副手', 'Off hand'], Helm: ['头盔', 'Helm'], Chest: ['胸甲', 'Chest'],
    Gloves: ['手套', 'Gloves'], Boots: ['靴子', 'Boots'], Belt: ['腰带', 'Belt'], Amulet: ['项链', 'Amulet'],
    Ring: ['戒指', 'Ring'], Idol: ['神像', 'Idol'], DwarvenRune: ['矮人符文', 'Dwarven rune']
  };
  function slotZh(s) { return T(SLOT_ZH[s] || [s, s]); }
  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  var BASE_MAP = new Map((IT.bases || []).map(function (b) { return [b.id, b]; }));
  var RUNE_MAP = new Map((IT.runes || []).concat(IT.jewels || []).map(function (r) { return [r.id, r]; }));
  var MAT_MAP = new Map((IT.materials || []).map(function (m) { return [m.id, m]; }));

  function matName(id) { var m = MAT_MAP.get(id); return m ? T(m.n) : (id || ''); }
  function modList(arr, cls) {
    if (!arr || !arr.length) return '';
    return '<ul class="ic-mods ' + (cls || '') + '">' + arr.map(function (m) { return '<li>' + hl(T(m)) + '</li>'; }).join('') + '</ul>';
  }
  function tag(text, cls) { return '<span class="tag ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function iconFor(kind, id, tint, glyph) {
    var prefix = kind === 'unique' ? 'u:' : kind === 'rune' ? 'r:' : kind === 'jewel' ? 'j:' : 'b:';
    return BO.icon(prefix + id, glyph || (kind === 'unique' ? 'sword' : 'shield'), tint || '#c8c8c8');
  }
  function dpsTag(dps, def) {
    return (dps ? '<span class="tag gold">DPS ' + num(dps, 1) + '</span>' : '') + (def ? '<span class="tag">防御 ' + num(def) + '</span>' : '');
  }

  /* ---------------------------------------------------------- category data */
  var IDOL_BASES = (IT.bases || []).filter(function (b) { return b.slot === 'Idol'; });
  var IDOL_UNIQUES = (IT.uniques || []).filter(function (u) { return u.slot === 'Idol' || String((u.base || [])[1] || '').toLowerCase().indexOf('idol') >= 0; });
  var IDOL_RECIPES = (IT.cube || []).filter(function (c) { return String(c.id).indexOf('idol') === 0; });
  var IDOL_TAGS = { Idol1: '一阶', Idol2: '二阶', Idol3: '三阶', Idol4: '四阶', IdolGrand: '先祖' };
  var P = IT.potions || {};

  function idolRules() {
    var aff = (IT.affixes || []).filter(function (a) { return (a.on || []).some(function (t) { return String(t).indexOf('Idol') === 0; }); });
    var rows = IDOL_BASES.map(function (b) {
      var tier = (b.tags || []).map(function (t) { return t[1]; }).find(function (t) { return String(t).indexOf('Idol') === 0 && t !== 'Idol'; }) || '';
      return '<tr><td>' + esc(T(b.n)) + '</td><td class="mono">' + esc(String(b.size || '1x1').replace('x', '×')) + '</td><td>' + esc(IDOL_TAGS[tier] || tier) + '</td><td class="mono">' + (b.drop == null ? '—' : b.drop) + '</td></tr>';
    }).join('');
    return '<div class="extra"><h4>神像规则</h4>' +
      '<details open><summary>尺寸与词缀池（' + IDOL_BASES.length + ' 种）</summary><div class="tbl-wrap" style="border:0"><table class="tbl compact"><thead><tr><th>神像</th><th>尺寸</th><th>词缀池</th><th>权重</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>' +
      '<p class="tiny muted">神像占 1–4 格，词缀按尺寸分池；共有 ' + aff.length + ' 条神像词缀。三条神像工艺配方留在「魔方配方」分类中。</p></div>';
  }

  function pct(v) { return v == null ? '—' : Math.round(v * 100) + '%'; }
  var POT_COST = { Equip: '装备', Steep: '浸泡', Distil: '蒸馏', ResteepMagic: '重浸泡（魔法）', ResteepRare: '重浸泡（稀有）', Tincture: '酊剂', Seal: '封印', Oath: '誓约', Core: '核心', Pour: '浇灌', QualityPer2: '每 2% 品质', QualityMax: '品质上限' };
  function potName(id) { var t = (P.types || []).find(function (x) { return x.id === id; }); return t ? T(t.n) : id; }
  function potModName(id) { var m = (P.mods || []).find(function (x) { return x.id === id; }); return m ? T(m.n) : id; }
  function potionRules() {
    var slots = (P.slots || []).map(function (s) {
      return '<tr><td class="mono">' + (s.slot + 1) + '</td><td>' + esc(T([s.roleZh, s.role])) + '</td><td class="mono">RL ' + s.open + '+</td><td>' + esc(s.key || '—') + '</td></tr>';
    }).join('');
    var charges = (P.charges || []).map(function (c) {
      return '<tr><td>' + esc(T([c.roleZh, c.role])) + '</td><td class="mono">' + c.max + '</td><td class="mono">' + c.use + '</td><td class="mono">' + (Array.isArray(c.kill) ? c.kill.join(' / ') : c.kill) + '</td><td class="mono">' + (c.dur ? c.dur + 's' : '—') + '</td></tr>';
    }).join('');
    var costs = (P.costs || []).map(function (c) {
      var label = esc(POT_COST[c.id] || c.id);
      if (typeof c.items === 'number') return '<tr><td>' + label + '</td><td>' + c.items + '%</td></tr>';
      var items = Object.keys(c.items || {}).map(function (k) { return c.items[k] + ' ' + esc(matName(k)); }).join('、');
      return '<tr><td>' + label + '</td><td>' + (items || '免费') + '</td></tr>';
    }).join('');
    var vessels = (P.vessels || []).map(function (v) {
      return '<tr><td>' + esc(T(v.n)) + '</td><td class="mono">RL ' + v.minrl + '+</td><td class="mono">' + v.pre + ' / ' + v.suf + '</td><td>' + (v.oath ? '誓约 ' : '') + (v.core ? '核心' : '') + (!v.oath && !v.core ? '—' : '') + '</td></tr>';
    }).join('');
    var d = P.drops || {}, u = P.unlock || {};
    var dropText = '掉落自 RL ' + (d.MinRL || '—') + '+；魔法 ' + pct((d.Chance || {}).Magic) + ' · 稀有 ' + pct((d.Chance || {}).Rare) + ' · 守护者 ' + pct((d.Chance || {}).Guardian) + ' · 首领 ' + pct((d.Chance || {}).Boss) + '。';
    var unlockText = '首次出现 RL ' + (u.Tease || '—') + ' · 开放 RL ' + (u.Open || '—') + ' · 第四槽 RL ' + (u.Slot4 || '—') + '；赠礼：' + esc(potName(u.GiftType)) + '（' + (u.GiftRarity || '') + '）。';
    return '<div class="extra"><h4>药剂规则</h4>' +
      '<details><summary>槽位</summary><table class="tbl compact"><thead><tr><th>槽</th><th>类型</th><th>解锁</th><th>按键</th></tr></thead><tbody>' + slots + '</tbody></table></details>' +
      '<details><summary>充能</summary><table class="tbl compact"><thead><tr><th>类型</th><th>上限</th><th>每次</th><th>击杀</th><th>持续</th></tr></thead><tbody>' + charges + '</tbody></table></details>' +
      '<details><summary>词缀位</summary><table class="tbl compact"><tbody>' + vessels + '</tbody></table></details>' +
      '<details><summary>浇灌条件</summary><div class="chips">' + (P.pour || []).map(function (x) { return '<span class="chip">' + esc(T(x.n)) + '</span>'; }).join('') + '</div></details>' +
      '<details><summary>制作成本</summary><table class="tbl compact"><tbody>' + costs + '</tbody></table></details>' +
      '<details><summary>掉落与解锁</summary><p class="tiny muted">' + dropText + '<br>' + unlockText + '</p></details></div>';
  }

  /* --------------------------------------------------------------- cards */
  function uniqueCard(u, cat) {
    var forged = (u.forged || []).map(function (v, i) { return v > 1 ? i : -1; }).filter(function (i) { return i >= 0; });
    var mods = (u.mods || []).slice(0, 5);
    return '<article class="item-card hi" data-kind="unique" data-id="' + BO.attr(u.id) + '" tabindex="0">' +
      '<div class="ic-head">' + iconFor('unique', u.id, '#af6025', 'sword') +
      '<div class="ic-title"><div class="ic-name r-unique"><a href="#' + (cat || 'uniques') + '/' + encodeURIComponent(u.id) + '">' + hl(T(u.n)) + '</a><span class="ic-lvl">Lv ' + u.lvl + '</span></div>' +
      '<div class="ic-base">' + hl(T(u.base)) + ' · ' + esc(T([u.clsZh, u.cls])) + '</div></div></div>' +
      '<div class="ic-tags">' + tag('红色阶级 ' + (ROMAN[u.tier - 1] || u.tier), 'gold') + (u.slot === 'Idol' ? tag('神像') : '') + dpsTag(u.dps, (u.cls !== 'Ring' && u.cls !== 'Amulet' && u.cls !== 'Belt') ? u.def : 0) +
      (forged.length ? tag('可烬铸 ' + forged.map(function (i) { return '第 ' + (i + 1) + ' 条'; }).join('、'), 'violet') : '') + '</div>' +
      modList(mods, 'uniq') + (u.flav && (u.flav[0] || u.flav[1]) ? '<div class="ic-flav">' + hl(T(u.flav)) + '</div>' : '') +
      '<div class="ic-foot"><span>' + esc(T([u.slotZh, u.slot])) + '</span><span>' + (u.drop ? '权重 ' + u.drop : '') + '</span><span class="gold">查看全文 →</span></div></article>';
  }

  function baseCard(b) {
    var req = [];
    ['str', 'dex', 'int'].forEach(function (k) { if (b.req && b.req[k]) req.push({ str: '力量', dex: '敏捷', int: '智力' }[k] + ' ' + b.req[k]); });
    var stats = [];
    if (b.dmg) stats.push(b.dmg[0] + '–' + b.dmg[1] + ' 物理');
    if (b.aps) stats.push(b.aps + ' 攻速');
    if (b.crit) stats.push(b.crit + '% 暴击');
    if (b.ar) stats.push(b.ar + ' 护甲');
    if (b.ev) stats.push(b.ev + ' 闪避');
    if (b.es) stats.push(b.es + ' 护盾');
    if (b.block) stats.push(b.block + '% 格挡');
    return '<article class="item-card" data-kind="base" data-id="' + BO.attr(b.id) + '" tabindex="0">' +
      '<div class="ic-head">' + iconFor('base', b.id, b.slot === 'MainHand' || b.slot === 'OffHand' ? '#c3cdda' : '#aeb7c4', b.cls === 'Bow' ? 'bow' : b.cls === 'Quiver' ? 'quiver' : b.cls === 'Tome' ? 'tome' : b.cls === 'Shield' ? 'shield' : 'sword') +
      '<div class="ic-title"><div class="ic-name"><a href="#bases/' + encodeURIComponent(b.id) + '">' + hl(T(b.n)) + '</a><span class="ic-lvl">Lv ' + b.lvl + '</span></div>' +
      '<div class="ic-base">' + esc(T([b.clsZh, b.cls])) + ' · ' + esc(T([b.slotZh, b.slot])) + (b.twoh ? ' · 双手' : '') + '</div></div></div>' +
      '<div class="ic-tags">' + dpsTag(b.dps, b.def) + (b.block ? tag(b.block + '% 格挡') : '') + (b.nw ? tag('可开孔') : '') + tag('尺寸 ' + String(b.size || '1x1').replace('x', '×')) + '</div>' +
      (stats.length ? '<div class="ic-mods"><li class="dim">' + stats.map(esc).join(' · ') + '</li></div>' : '') +
      (b.impl && b.impl.length ? modList(b.impl, 'imp') : '') +
      '<div class="ic-foot"><span>' + (req.length ? '需求 ' + req.join(' · ') : '无属性需求') + '</span><span class="gold">查看全文 →</span></div></article>';
  }

  function runeCard(r, kind) {
    var isJewel = kind === 'jewel' || r.kind === 'jewel';
    var next = r.next ? RUNE_MAP.get(r.next) : null;
    return '<article class="item-card" data-kind="' + (isJewel ? 'jewel' : 'rune') + '" data-id="' + BO.attr(r.id) + '" tabindex="0">' +
      '<div class="ic-head">' + iconFor(isJewel ? 'jewel' : 'rune', r.id, r.color || '#aa9e82', 'rune') +
      '<div class="ic-title"><div class="ic-name"><a href="#' + (isJewel ? 'jewels' : 'runes') + '/' + encodeURIComponent(r.id) + '">' + hl(T(r.n)) + '</a><span class="ic-lvl">Lv ' + r.lvl + '</span></div>' +
      '<div class="ic-base">' + (isJewel ? '珠宝' : '符文') + ' · 阶级 ' + r.tier + (r.lore && r.lore[0] ? ' · ' + esc(T(r.lore)) : '') + '</div></div></div>' +
      '<div class="ic-tags">' + tag(isJewel ? '珠宝' : '符文', 'gold') + tag('阶梯 ' + r.tier) + '</div>' +
      '<div class="ic-mods"><li class="dim">嵌入武器</li>' + (r.w || []).map(function (m) { return '<li>' + hl(T(m)) + '</li>'; }).join('') + '<li class="dim" style="margin-top:4px">嵌入护甲</li>' + (r.a || []).map(function (m) { return '<li>' + hl(T(m)) + '</li>'; }).join('') + '</div>' +
      '<div class="ic-foot"><span>' + (next ? '可升级为 ' + esc(T(next.n)) : (isJewel ? '珠宝' : '阶梯顶端')) + '</span><span class="gold">查看全文 →</span></div></article>';
  }

  function runewordCard(w) {
    return '<article class="item-card" data-kind="runeword" data-id="' + BO.attr(w.id) + '" tabindex="0">' +
      '<div class="ic-head"><div class="ic-title"><div class="ic-name r-magic"><a href="#runewords/' + encodeURIComponent(w.id) + '">' + hl(T(w.n)) + '</a><span class="ic-lvl">Lv ' + w.lvl + '</span></div>' +
      '<div class="ic-base">' + esc(T([w.clsZh, w.cls])) + (w.build ? ' · ' + hl(T([w.buildZh, w.build])) : '') + '</div></div></div>' +
      '<div class="ic-tags">' + tag(w.sockets + ' 孔', 'gold') + (w.bases || []).map(function (b) { return tag(T(b)); }).join('') + '</div>' +
      '<div style="font-family:var(--font-disp);color:var(--currency);font-size:15px;letter-spacing:.05em;margin-top:7px">' + (w.runes || []).map(function (r) { return esc(T(r)); }).join(' · ') + '</div>' +
      modList(w.mods) +
      ((w.power || []).length ? '<div class="tiny gold" style="margin-top:6px">注入奖励</div>' + modList(w.power, 'uniq') : '') +
      '<div class="ic-foot"><span>' + esc(T([w.clsZh, w.cls])) + '</span><span class="gold">查看全文 →</span></div></article>';
  }

  function potionCard(p) {
    return '<article class="item-card" data-kind="potion" data-id="' + BO.attr(p.id) + '" tabindex="0">' +
      '<div class="ic-head"><div class="ic-title"><div class="ic-name">' + hl(T(p.n)) + '</div><div class="ic-base">' + esc(T([p.roleZh, p.role])) + ' · 权重 ' + (p.weight == null ? '—' : p.weight) + '</div></div></div>' +
      '<div class="ic-tags">' + tag(p.rec != null ? '回复 ' + p.rec + '%' : '功能药剂') + (p.sec ? tag(p.sec + ' 秒') : '') + '</div>' +
      (p.text && p.text[1] ? '<div class="small" style="color:var(--fg2);margin-top:8px">' + hl(T(p.text)) + '</div>' : '') +
      modList(p.mods) + '<div class="ic-foot"><span>药剂</span><span class="gold">查看全文 →</span></div></article>';
  }

  function potionUniqueCard(u) {
    return '<article class="item-card hi" data-kind="potion" data-id="' + BO.attr(u.id) + '" tabindex="0">' +
      '<div class="ic-head"><div class="ic-title"><div class="ic-name r-unique">' + hl(T(u.n)) + '</div><div class="ic-base">' + esc(u.typeN ? T(u.typeN) : '传奇药剂') + '</div></div></div>' +
      '<div class="ic-tags">' + tag('传奇', 'gold') + (u.sourceZh ? tag('来源 ' + u.sourceZh) : '') + (u.later ? tag('后续版本') : '') + '</div>' +
      '<div class="small" style="color:var(--fg2);margin-top:8px">' + esc(T(u.text)) + '</div><div class="ic-foot"><span>' + esc(u.sourceZh || u.source || '—') + '</span><span class="gold">查看全文 →</span></div></article>';
  }

  function potionModCard(m) {
    return '<article class="item-card" data-kind="potion" data-id="' + BO.attr(m.id) + '" tabindex="0">' +
      '<div class="ic-head"><div class="ic-title"><div class="ic-name">' + hl(T(m.n)) + '</div><div class="ic-base">' + esc(T([m.kindZh, m.kind])) + ' · ' + (m.rolesZh || []).join(' / ') + '</div></div></div>' +
      '<table class="tbl compact" style="margin-top:8px"><thead><tr><th>阶</th><th>RL</th><th>效果</th></tr></thead><tbody>' +
      (m.tiers || []).map(function (t) { return '<tr><td class="mono">T' + t.tier + '</td><td class="mono">' + t.minrl + '</td><td>' + esc(t.line) + '</td></tr>'; }).join('') +
      '</tbody></table><div class="ic-foot"><span>药剂词缀</span></div></article>';
  }

  function idolCard(x) {
    if (x.t === 'uniq') {
      var u = x.u;
      return '<article class="item-card hi" data-kind="unique" data-id="' + BO.attr(u.id) + '" tabindex="0">' +
        '<div class="ic-head">' + iconFor('unique', u.id, '#af6025', 'rune') +
        '<div class="ic-title"><div class="ic-name r-unique"><a href="#idols/' + encodeURIComponent(u.id) + '">' + hl(T(u.n)) + '</a><span class="ic-lvl">Lv ' + u.lvl + '</span></div>' +
        '<div class="ic-base">' + hl(T(u.base)) + ' · 神像</div></div></div>' +
        '<div class="ic-tags">' + tag('传奇神像', 'gold') + tag('红色阶级 ' + (ROMAN[u.tier - 1] || u.tier)) + '</div>' +
        modList((u.mods || []).slice(0, 5), 'uniq') +
        (u.flav && (u.flav[0] || u.flav[1]) ? '<div class="ic-flav">' + hl(T(u.flav)) + '</div>' : '') +
        '<div class="ic-foot"><span>神像</span><span class="gold">查看全文 →</span></div></article>';
    }
    var b = x.b, size = String(b.size || '1x1').replace('x', '×');
    var tier = (b.tags || []).map(function (t) { return t[1]; }).find(function (t) { return String(t).indexOf('Idol') === 0 && t !== 'Idol'; }) || '';
    return '<article class="item-card" data-kind="base" data-id="' + BO.attr(b.id) + '" tabindex="0">' +
      '<div class="ic-head">' + iconFor('base', b.id, '#cbb27f', 'rune') +
      '<div class="ic-title"><div class="ic-name"><a href="#idols/' + encodeURIComponent(b.id) + '">' + hl(T(b.n)) + '</a><span class="ic-lvl">Lv ' + b.lvl + '</span></div>' +
      '<div class="ic-base">神像 · 尺寸 ' + esc(size) + ' · 词缀池 ' + esc(IDOL_TAGS[tier] || tier) + '</div></div></div>' +
      '<div class="ic-tags">' + tag('神像', 'gold') + tag('占 ' + size) + tag('掉落权重 ' + (b.drop == null ? '—' : b.drop)) + '</div>' +
      '<div class="ic-foot"><span>占格 ' + esc(size) + '</span><span class="gold">查看全文 →</span></div></article>';
  }

  function cubeCard(c) {
    return '<article class="item-card" data-kind="cube" data-id="' + BO.attr(c.id) + '">' +
      '<div class="ic-head"><div class="ic-title"><div class="ic-name">' + hl(T(c.n)) + '</div><div class="ic-base">' + esc(c.family || '配方') + ' · ' + esc(T(c.recipe)) + '</div></div></div>' +
      modList([c.result, c.uses, c.keeps].filter(function (x) { return x && (x[0] || x[1]); })) +
      (c.hint && (c.hint[0] || c.hint[1]) ? '<div class="ic-flav">' + esc(T(c.hint)) + '</div>' : '') + '</article>';
  }

  function forgeCard(f) {
    return '<article class="item-card" data-kind="forge" data-id="' + BO.attr(f.id) + '">' +
      '<div class="ic-head"><div class="ic-title"><div class="ic-name">' + hl(T(f.n)) + '</div><div class="ic-base">' + esc(T([f.kindZh, f.kind])) + (f.mat ? ' · ' + esc(matName(f.mat)) + ' ×' + f.cost : '') + '</div></div></div>' +
      '<div class="small" style="color:var(--fg2);margin-top:6px">' + hl(T(f.text)) + '</div>' +
      (f.line && f.line[1] ? '<div class="ic-flav">' + esc(T(f.line)) + '</div>' : '') +
      '<div class="ic-foot"><span>' + esc(T(f.found || '')) + '</span><span>' + ((f.landNames || []).map(function (l) { return esc(T(l)); }).join(' / ')) + '</span></div></article>';
  }

  function mythicCard(m) {
    return '<article class="item-card" data-kind="mythic" data-id="' + BO.attr(m.id) + '">' +
      '<div class="ic-head"><div class="ic-title"><div class="ic-name r-rare">' + hl(T(m.n || [m.groupZh, m.group])) + '</div><div class="ic-base">' + esc(T([m.typeZh, m.type])) + ' · ' + esc(m.groupZh || m.group || '') + '</div></div></div>' +
      modList((m.tiers || []).filter(function (t) { return t.line; }).map(function (t) { return t.line; })) +
      '<div class="ic-foot"><span>仅神话物品</span><span>物品等级 ' + ((m.tiers && m.tiers[0] && m.tiers[0].ilvl) || '—') + '</span></div></article>';
  }

  function affixRow(a) {
    return '<details class="arow"><summary>' +
      '<span class="ptype ' + (a.type === 'Prefix' ? 'pre' : 'suf') + '">' + esc(T([a.typeZh, a.type])) + '</span>' +
      '<span class="arow-main"><b>' + hl(T(a.top)) + '</b><span class="tiny muted">' + esc(a.groupZh) + ' · ' + (a.onZh || []).map(esc).join('、') + (a.notOn && a.notOn.length ? ' · 不含 ' + (a.notOnZh || a.notOn).map(esc).join('、') : '') + '</span></span>' +
      '<span class="arow-meta">' + (a.tiers || []).length + ' 阶 · iLvl ' + a.minIlvl + '+</span></summary>' +
      '<div class="arow-body"><table class="tbl compact"><thead><tr><th>阶</th><th>名号</th><th>物品等级</th><th>数值</th><th>权重</th></tr></thead><tbody>' +
      (a.tiers || []).map(function (t, i) {
        return '<tr' + (i === 0 ? ' style="color:var(--gold)"' : '') + '><td class="mono">' + t.t + '</td><td>' + hl(T(t.name)) + '</td><td class="mono">' + t.ilvl + '</td><td>' + hl(T(t.line || a.top)) + '</td><td class="mono">' + (t.w == null ? '' : t.w) + '</td></tr>';
      }).join('') + '</tbody></table></div></details>';
  }

  /* ------------------------------------------------------------- categories */
  var CATS = [
    { k: 'uniques', zh: '传奇', en: 'Uniques', arr: function () { return IT.uniques; }, card: function (u) { return uniqueCard(u); }, kind: 'unique', facets: [['slot', '槽位', function (u) { return [slotZh(u.slot)]; }], ['cls', '类型', function (u) { return [T([u.clsZh, u.cls])]; }], ['tier', '红色阶级', function (u) { return ['阶级 ' + u.tier]; }]], sorts: ['lvl', 'name', 'dps', 'def'] },
    { k: 'bases', zh: '底材', en: 'Bases', arr: function () { return IT.bases; }, card: baseCard, kind: 'base', facets: [['slot', '槽位', function (b) { return [slotZh(b.slot)]; }], ['cls', '类型', function (b) { return [T([b.clsZh, b.cls])]; }], ['twoh', '双手', function (b) { return [b.twoh ? '双手' : '单手']; }]], sorts: ['lvl', 'name', 'dps', 'def'] },
    { k: 'idols', zh: '神像', en: 'Idols', arr: function () { return IDOL_BASES.map(function (b, i) { return { id: b.id, t: 'base', b: b, n: b.n, lvl: b.lvl, o: i, _s: '' }; }).concat(IDOL_UNIQUES.map(function (u, i) { return { id: u.id, t: 'uniq', u: u, n: u.n, lvl: u.lvl, o: 100 + i, _s: '' }; })); }, card: idolCard, kind: 'base', facets: [['t', '类型', function (x) { return [x.t === 'base' ? '底材' : '传奇']; }]], sorts: ['order'], extra: idolRules },
    { k: 'affixes', zh: '词缀', en: 'Affixes', arr: function () { return IT.affixes; }, card: affixRow, kind: 'affix', facets: [['type', '类型', function (a) { return [T([a.typeZh, a.type])]; }], ['group', '分组', function (a) { return [a.groupZh]; }], ['on', '可出现在', function (a) { return (a.onZh || []).map(function (s) { return T([slotZh(s), s]); }); }]], sorts: ['lvl', 'name'] },
    { k: 'runes', zh: '符文', en: 'Runes', arr: function () { return IT.runes; }, card: function (r) { return runeCard(r, 'rune'); }, kind: 'rune', facets: [['tier', '阶级', function (r) { return ['阶级 ' + r.tier]; }], ['next', '阶梯', function (r) { return [r.next ? '有后继' : '顶端']; }]], sorts: ['lvl', 'idx', 'name'] },
    { k: 'jewels', zh: '珠宝', en: 'Jewels', arr: function () { return IT.jewels; }, card: function (r) { return runeCard(r, 'jewel'); }, kind: 'jewel', facets: [['tier', '阶级', function (r) { return ['阶级 ' + r.tier]; }]], sorts: ['lvl', 'idx', 'name'] },
    { k: 'runewords', zh: '符文之语', en: 'Runewords', arr: function () { return IT.runewords; }, card: runewordCard, kind: 'runeword', facets: [['cls', '职业', function (w) { return [T([w.clsZh, w.cls]) || '通用']; }], ['sockets', '孔数', function (w) { return [w.sockets + ' 孔']; }], ['base', '可嵌入', function (w) { return (w.bases || []).map(function (b) { return T(b); }); }]], sorts: ['lvl', 'name'] },
    { k: 'potions', zh: '药剂', en: 'Potions', arr: function () { return (P.types || []); }, card: potionCard, kind: 'potion', facets: [['role', '类型', function (p) { return [T([p.roleZh, p.role])]; }]], sorts: ['name'], extra: potionRules },
    { k: 'potuniques', zh: '传奇药剂', en: 'Unique potions', arr: function () { return (P.uniques || []); }, card: potionUniqueCard, kind: 'potion', facets: [['type', '类型', function (u) { return [u.typeN ? T(u.typeN) : '—']; }]], sorts: ['name'] },
    { k: 'potmods', zh: '药剂词缀', en: 'Potion mods', arr: function () { return (P.mods || []); }, card: potionModCard, kind: 'potion', facets: [['kind', '类别', function (m) { return [T([m.kindZh, m.kind])]; }]], sorts: ['name'] },
    { k: 'cube', zh: '魔方配方', en: 'Cube recipes', arr: function () { return IT.cube; }, card: cubeCard, kind: 'cube', facets: [['family', '系列', function (c) { return [c.family || '其他']; }]], sorts: ['name'] },
    { k: 'forge', zh: '锻造', en: 'Forge', arr: function () { return IT.forge; }, card: forgeCard, kind: 'forge', facets: [['kind', '类型', function (f) { return [T([f.kindZh, f.kind])]; }], ['group', '分组', function (f) { return [f.group || '其他']; }]], sorts: ['name'] },
    { k: 'mythic', zh: '神话词条', en: 'Mythic lines', arr: function () { return IT.mythic; }, card: mythicCard, kind: 'mythic', facets: [['type', '类型', function (m) { return [T([m.typeZh, m.type])]; }]], sorts: ['name'] }
  ];

  var S = { cat: 'uniques', q: '', sort: 'rar', f: {}, pin: '' };

  function catOf(k) { return CATS.find(function (c) { return c.k === k; }) || CATS[0]; }
  function arrOf(k) { return catOf(k).arr(); }

  CATS.forEach(function (c) {
    c.arr().forEach(function (r) { if (!r._s) r._s = JSON.stringify(r).toLowerCase(); });
  });

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
    S.pin = id && arrOf(cat).some(function (r) { return (r.id || r.Id) === id; }) ? id : '';
    S.q = '';
    S.f = {};
    if (qs) {
      if (qs.has('q')) S.q = (qs.get('q') || '').trim();
      var valid = (def.facets || []).map(function (f) { return f[0]; });
      qs.forEach(function (v, k) {
        if (k !== 'q' && valid.indexOf(k) >= 0 && v) (S.f[k] || (S.f[k] = new Set())).add(v);
      });
    }
    var qel = document.getElementById('q');
    if (qel) qel.value = S.q;
    return true;
  }
  readHash();
  var q0 = new URLSearchParams(location.search).get('q');
  if (q0) S.q = q0;

  function $(id) { return document.getElementById(id); }

  function filtered(k) {
    var def = catOf(k);
    var arr = def.arr();
    if (S.pin && k === S.cat) {
      return arr.filter(function (r) { return (r.id || r.Id) === S.pin; });
    }
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

  function openItem(kind, id) {
    var def = CATS.find(function (c) { return c.k === S.cat; });
    var rec = def.arr().find(function (r) { return (r.id || r.Id) === id; });
    if (!rec) return;
    if (S.cat === 'idols') {
      if (rec.t === 'uniq') BO.itemPopup('unique', rec.u);
      else if (rec.b) BO.itemPopup('base', rec.b);
      return;
    }
    if (kind === 'unique' || kind === 'rune' || kind === 'jewel' || kind === 'runeword' || kind === 'affix' || kind === 'potion' || kind === 'base') {
      BO.itemPopup(kind, rec);
    }
  }

  function render() {
    BO.setTerms(S.q);
    var def = catOf(S.cat);
    var all = def.arr();

    $('tabs').innerHTML = CATS.map(function (c) {
      return '<button class="tab" role="tab" data-k="' + c.k + '" aria-selected="' + (c.k === S.cat) + '">' + esc(T([c.zh, c.en])) + '<i>' + c.arr().length + '</i></button>';
    }).join('');

    // facets
    var pool = all.filter(function (r) {
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
    if (def.extra) $('side').insertAdjacentHTML('beforeend', def.extra());

    // sort
    var sortLabels = {
      lvl: ['等级：低到高', 'Level ↑'], lvlDesc: ['等级：高到低', 'Level ↓'], name: ['名称', 'Name'],
      dps: ['伤害（DPS）', 'Damage'], def: ['防御', 'Defence'], idx: ['阶梯顺序', 'Ladder'], order: ['默认顺序', 'Default'], rar: ['稀有度', 'Rarity']
    };
    var keys = ['rar'].concat((def.sorts || ['lvl']).filter(function (k) { return k !== 'rar'; })).concat(['lvlDesc']);
    if (keys.indexOf(S.sort) < 0) S.sort = 'rar';
    $('sort').innerHTML = keys.map(function (k) { return '<option value="' + k + '"' + (k === S.sort ? ' selected' : '') + '>' + esc(T(sortLabels[k] || [k, k])) + '</option>'; }).join('');

    var arr = filtered(S.cat).slice();
    var lv = function (r) { return r.lvl != null ? r.lvl : (r.minIlvl || 0); };
    var rarityOf = function (r) {
      if (r.t === 'uniq') return 4;
      if (r.t === 'base') return 1;
      if (S.cat === 'uniques' || S.cat === 'potuniques') return 4;
      if (S.cat === 'runewords') return 3;
      if (S.cat === 'runes' || S.cat === 'jewels') return 2;
      if (S.cat === 'bases' || S.cat === 'potions') return 1;
      return 0;
    };
    var tierOf = function (r) { return r.tier || (r.u && r.u.tier) || 0; };
    if (S.sort === 'rar') arr.sort(function (a, b) { return rarityOf(b) - rarityOf(a) || tierOf(b) - tierOf(a) || lv(a) - lv(b); });
    else if (S.sort === 'name') arr.sort(function (a, b) { return T(a.n || [a.groupZh || '', a.group || '']).localeCompare(T(b.n || [b.groupZh || '', b.group || '']), 'zh'); });
    else if (S.sort === 'dps') arr.sort(function (a, b) { return (b.dps || 0) - (a.dps || 0) || lv(a) - lv(b); });
    else if (S.sort === 'def') arr.sort(function (a, b) { return (b.def || 0) - (a.def || 0) || lv(a) - lv(b); });
    else if (S.sort === 'idx') arr.sort(function (a, b) { return (a.idx || 0) - (b.idx || 0); });
    else if (S.sort === 'order') arr.sort(function (a, b) { return (a.o || 0) - (b.o || 0); });
    else if (S.sort === 'lvlDesc') arr.sort(function (a, b) { return lv(b) - lv(a); });
    else arr.sort(function (a, b) { return lv(a) - lv(b); });

    $('count').innerHTML = S.pin && arr.length
      ? '正在查看 <b>' + esc(T(arr[0].n)) + '</b> · <a href="#' + S.cat + '" class="gold">返回列表（' + all.length + ' 条）</a>'
      : '<b>' + arr.length + '</b> 条' + esc(T([def.zh, def.en])) + (S.q ? ' · 匹配 “' + esc(S.q) + '”' : '');
    $('hint').textContent = def.k === 'affixes' ? '展开行查看每一阶' : '点击卡片查看完整面板';

    if (!arr.length) {
      $('list').innerHTML = BO.empty('没有匹配的结果', '试试更少的关键词，或清空筛选条件。');
    } else if (def.k === 'affixes') {
      $('list').innerHTML = arr.map(affixRow).join('');
    } else {
      $('list').innerHTML = '<div class="cards">' + arr.map(def.card).join('') + '</div>';
    }

    // open the deep-linked item once
    if (S.pin && arr.length) {
      var rec = arr[0];
      var kind = def.kind;
      if (def.k === 'idols' && rec.t === 'uniq') kind = 'unique';
      openItem(kind, rec.id || rec.Id);
    }
  }

  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab');
    if (!b) return;
    S.cat = b.dataset.k; S.pin = ''; S.f = {}; S.q = ''; S.sort = 'rar'; $('q').value = '';
    history.replaceState(null, '', '#' + S.cat);
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('q').addEventListener('input', BO.debounce(function (e) {
    S.q = e.target.value.trim(); S.pin = ''; render();
  }, 130));
  $('sort').addEventListener('change', function (e) { S.sort = e.target.value; render(); });

  $('list').addEventListener('click', function (e) {
    var card = e.target.closest('[data-kind]');
    if (!card) return;
    var kind = card.dataset.kind, id = card.dataset.id;
    if (e.target.closest('a')) {
      // let the hash link update, then open the popup ourselves
      e.preventDefault();
      history.replaceState(null, '', '#' + S.cat + '/' + encodeURIComponent(id));
      openItem(kind, id);
      return;
    }
    history.replaceState(null, '', '#' + S.cat + '/' + encodeURIComponent(id));
    openItem(kind, id);
  });
  $('list').addEventListener('keydown', function (e) {
    var card = e.target.closest('[data-kind]');
    if (card && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      openItem(card.dataset.kind, card.dataset.id);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('q').focus(); }
    if (e.key === 'Escape' && document.activeElement === $('q')) { $('q').value = ''; S.q = ''; render(); }
  });
  window.addEventListener('hashchange', function () {
    if (!readHash()) return;
    render();
  });

  $('itemVer').textContent = '本地数据 ' + BO.VER_LOCAL + ' · ' + ((IT.meta && IT.meta.version) || '');
  BO.mountShell('items.html');
  render();
})();
