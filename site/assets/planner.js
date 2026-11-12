/* ============================================================================
   Broken Oath 构筑模拟器 — 计算引擎（无 DOM 依赖）
   ----------------------------------------------------------------------------
   设计原则：所有数值都来自游戏数据文件（BO_PCORE / BO_PITEMS / BO_PTREE），
   这里只负责把它们按游戏规则聚合：

     · 同类 "increased/reduced" 加算成一个加成，每条 "more/less" 各自乘算
       （游戏内规则文本 Mech.IncMore：「All increased and reduced lines of a kind
       add up into one bonus; each more or less line multiplies on its own.」）
     · 攻击技能的伤害来自武器，法术技能的伤害来自宝石等级
     · 伤害按元素分别结算：转化 / 额外伤害 / 元素穿透 / 元素加成互不混淆
     · 暴击：攻击取武器基础暴击，法术取宝石基础暴击，暴击伤害 = 命中 × 暴击倍率，
       上限 95%（游戏内 Mech.Crit 规则）
     · 异常状态（点燃/感电/中毒/流血/冰缓/冰冻）按 scaling.json 的 Ailments 计算
   ========================================================================== */
(function () {
  'use strict';

  var P = window.BOPLAN = window.BOPLAN || {};
  var CORE = window.BO_PCORE || { consts: {}, skills: [], supports: [] };
  var IT = window.BO_PITEMS || { bases: [], affixes: [], uniques: [], runes: [], runewords: [], mythic: [] };
  var TR = window.BO_PTREE || { nodes: [], dragon: {} };
  var K = CORE.consts || {};

  P.core = CORE; P.items = IT; P.tree = TR; P.k = K;

  // ---------------------------------------------------------------- indices
  function idx(arr, key) {
    var m = {};
    for (var i = 0; i < (arr || []).length; i++) m[arr[i][key]] = arr[i];
    return m;
  }
  var SK = P.SK = idx(CORE.skills, 'id');
  var SUP = P.SUP = idx(CORE.supports, 'id');
  var BL = P.BL = idx(CORE.blessings, 'id');
  var CU = P.CU = idx(CORE.curses, 'id');
  var BASES = P.BASES = idx(IT.bases, 'id');
  var AFF = P.AFF = idx(IT.affixes, 'id');
  var UNI = P.UNI = idx(IT.uniques, 'id');
  var RUNE = P.RUNE = idx(IT.runes, 'id');
  var RW = P.RW = idx(IT.runewords, 'id');
  var MYTH = P.MYTH = idx(IT.mythic, 'id');
  var NODE = P.NODE = idx(TR.nodes, 'i');
  var CLS = P.CLS = idx(CORE.classes, 'id');

  P.IDOL_SLOTS = [];
  for (var _si = 1; _si <= 8; _si++) P.IDOL_SLOTS.push('Idol' + _si);
  P.slotList = ['MainHand', 'OffHand', 'Helm', 'Chest', 'Gloves', 'Boots', 'Belt', 'Amulet', 'Ring1', 'Ring2', 'DwarvenRune'].concat(P.IDOL_SLOTS);
  P.slotBase = { Ring1: 'Ring', Ring2: 'Ring', DwarvenRune: 'DwarvenRune' };
  P.slotZh = {
    MainHand: '主手', OffHand: '副手', Helm: '头盔', Chest: '胸甲', Gloves: '手套', Boots: '靴子',
    Belt: '腰带', Amulet: '项链', Ring1: '戒指 1', Ring2: '戒指 2', DwarvenRune: '矮人符文',
    Idol1: '神像 1', Idol2: '神像 2', Idol3: '神像 3', Idol4: '神像 4',
    Idol5: '神像 5', Idol6: '神像 6', Idol7: '神像 7', Idol8: '神像 8'
  };
  P.slotGlyph = {
    MainHand: 'weapon', OffHand: 'shield', Helm: 'helm', Chest: 'chest', Gloves: 'gloves', Boots: 'boots',
    Belt: 'belt', Amulet: 'amulet', Ring1: 'ring', Ring2: 'ring', DwarvenRune: 'rune',
    Idol1: 'idol', Idol2: 'idol', Idol3: 'idol', Idol4: 'idol', Idol5: 'idol', Idol6: 'idol', Idol7: 'idol', Idol8: 'idol'
  };
  for (var _sj = 0; _sj < P.IDOL_SLOTS.length; _sj++) P.slotBase[P.IDOL_SLOTS[_sj]] = 'Idol';
  function gameSlot(slot) {
    if (/^Idol\d+$/.test(slot)) return 'Idol';
    if (slot === 'Ring1') return 'Ring';
    return slot;
  }
  P.rarityZh = { Normal: '普通', Magic: '魔法', Rare: '稀有', Unique: '传奇' };
  P.rarityColor = { Normal: 'var(--base)', Magic: 'var(--magic)', Rare: 'var(--rare)', Unique: 'var(--uniq)' };

  P.T = function (p) { // [zh,en] / string
    if (!p) return '';
    if (typeof p === 'string') return p;
    var en = typeof BO !== 'undefined' && BO.LANG === 1;
    return (en ? (p[1] || p[0]) : (p[0] || p[1])) || '';
  };
  P.lang = function () { return (typeof BO !== 'undefined' && BO.LANG === 1) ? 1 : 0; };

  // ---------------------------------------------------------------- numbers
  function n(v) { return (typeof v === 'number' && isFinite(v)) ? v : 0; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  P.n = n;
  P.fmt = function (v, d) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    if (d === undefined) d = 0;
    var s = Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + 'B'
      : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M'
        : Math.abs(v) >= 1e4 ? (v / 1e3).toFixed(1) + 'k'
          : v.toFixed(d);
    return s.replace(/\.00([kMB])/, '$1').replace(/\.0([kMB])/, '$1');
  };
  P.num = function (v, d) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    return (d ? v.toFixed(d) : String(Math.round(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  // ================================================================ 文本渲染
  // 移植 build/render.py：Stat/Mode/Tags -> "38% increased Physical Damage"
  var TEXTS = CORE.texts || {}, TEXTSZH = CORE.textsZh || {};
  var ELEMS = { Physical: 1, Fire: 1, Cold: 1, Lightning: 1, Poison: 1, Holy: 1, Elemental: 1, Chaos: 1 };

  function isParam(t) { return t.indexOf('=') >= 0 || t === t.toLowerCase(); }
  function fnum(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return '';
    if (typeof v === 'number') {
      if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
      return String(Math.round(v * 100) / 100);
    }
    return String(v);
  }
  function pair(lo, hi) {
    if (lo === null || lo === undefined) return '';
    if (hi === null || hi === undefined || lo === hi) return fnum(lo);
    return '(' + fnum(lo) + '-' + fnum(hi) + ')';
  }
  function absPair(lo, hi) {
    if (lo === null || lo === undefined) return '';
    if (hi === null || hi === undefined || lo === hi) return fnum(Math.abs(lo));
    var a = Math.abs(lo), b = Math.abs(hi);
    if (a > b) { var t = a; a = b; b = t; }
    if (a === b) return fnum(a);
    return '(' + fnum(a) + '-' + fnum(b) + ')';
  }
  function displayTags(tags) {
    var out = [];
    for (var i = 0; i < (tags || []).length; i++) {
      var t = tags[i];
      if (isParam(t)) continue;
      out.push(t);
    }
    return out;
  }
  function tagZh(t) { return (CORE.tags && CORE.tags[t]) || t; }
  function pickKey(stat, mode, tags) {
    var dt = displayTags(tags), cands = [], i;
    for (i = 0; i < dt.length; i++) cands.push(stat + '.' + mode + '+' + dt[i]);
    if (dt.length) cands.push(stat + '.' + mode + '+');
    cands.push(stat + '.' + mode);
    for (i = 0; i < cands.length; i++) {
      var c = cands[i];
      var e = TEXTS[c], z = TEXTSZH[c];
      if ((e && (e[0] || e[1])) || (z && (z[0] || z[1]))) return c;
    }
    return null;
  }
  function fillTpl(tpl, vals) {
    var s = String(tpl).replace(/\{(\w+)\}/g, function (m, k) { return vals[k] !== undefined ? vals[k] : ''; });
    s = s.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:）)])/g, '$1').replace(/（\s+/g, '（');
    return s.trim();
  }
  /**
   * Render one mod into [zh, en].
   * mod: {s,m,t,v,v2,lo,hi,lo2,hi2}
   * opts.elemJoin: '、' for zh
   */
  var SPECIAL_STATS = { Keystone: 1, GrantSupport: 1, Trigger: 1, Dragonling: 1, SigilDrop: 1, Woebringer: 1 };
  var KEYSTONE_NAME = {};
  (function () {
    for (var i = 0; i < (TR.nodes || []).length; i++) {
      var nd = TR.nodes[i];
      for (var j = 0; j < (nd.m || []).length; j++) {
        var m = nd.m[j];
        if (m.s === 'Keystone') {
          for (var k = 0; k < (m.t || []).length; k++) KEYSTONE_NAME[m.t[k]] = nd;
        }
      }
    }
  })();
  function paramOf(tags, key) {
    for (var i = 0; i < (tags || []).length; i++) {
      if (tags[i].indexOf(key + '=') === 0) return tags[i].slice(key.length + 1);
    }
    return null;
  }
  /** 触发 / 授予辅助 / 基石等特殊词条的可读文案 */
  function specialText(mod) {
    if (mod.x) return [mod.x, mod.x];
    var tags = mod.t || [];
    if (mod.s === 'Keystone') {
      var nd = KEYSTONE_NAME[tags[0]];
      return nd ? ['基石：' + P.T(nd.n), ''] : ['', ''];
    }
    if (mod.s === 'GrantSupport') {
      var s = SUP[tags[0]];
      var scope = tags.slice(1).map(function (t) { return tagZh(t); }).join(' / ');
      return s ? ['由〈' + P.T(s.n) + '〉辅助' + (scope ? '（' + scope + '）' : ''), ''] : ['', ''];
    }
    if (mod.s === 'Trigger') {
      var pct = paramOf(tags, 'Pct'), rad = paramOf(tags, 'Radius');
      var nth = paramOf(tags, 'Nth'), cnt = paramOf(tags, 'Count');
      var ev = tags.filter(function (t) { return !isParam(t); });
      return ['触发：' + (ev.length ? ev.map(tagZh).join('/') : '事件') +
        (nth ? ' 每 ' + nth + ' 次' : '') + (cnt ? ' ' + cnt + ' 次' : '') +
        (pct ? '，' + pct + '% 伤害' : '') + (rad ? '，半径 ' + rad : ''), ''];
    }
    if (mod.s === 'Dragonling') {
      var ev2 = tags.filter(function (t) { return !isParam(t); });
      return ['龙裔效果：' + ev2.map(tagZh).join(' / '), ''];
    }
    return ['', ''];
  }

  // 少量没有 stat_text 模板的词条（来自誓约 / 辅助 / 基石的特殊行）
  var EXTRA_TEXT = {
    'ManaRegen.Flat': ['+{v} 魔力回复', '-{abs} 魔力回复', '+{v} Mana Regeneration', '-{abs} Mana Regeneration'],
    'Armour.More': ['{v}% 更多护甲', '{v}% 更少护甲', '{v}% more Armour', '{v}% less Armour'],
    'Evasion.More': ['{v}% 更多闪避', '{v}% 更少闪避', '{v}% more Evasion', '{v}% less Evasion'],
    'EnergyShield.More': ['{v}% 更多能量护盾', '{v}% 更少能量护盾', '{v}% more Energy Shield', '{v}% less Energy Shield'],
    'Woebringer.Flat': ['灾祸使者', '灾祸使者', 'Woebringer', 'Woebringer'],
    'flag:NoElemental': ['无法造成元素伤害', '无法造成元素伤害', 'Deals no Elemental Damage', 'Deals no Elemental Damage'],
    'flag:BloodMagic': ['以生命代替魔力施放', '以生命代替魔力施放', 'Skills cost Life instead of Mana', 'Skills cost Life instead of Mana']
  };
  function extraLine(ex, mod) {
    var lv0 = mod.lo !== undefined ? mod.lo : mod.v;
    var hv0 = mod.hi !== undefined ? mod.hi : (mod.v2 !== undefined ? mod.v2 : lv0);
    var neg0 = n(hv0) < 0;
    var vv = { v: fnum(lv0), abs: fnum(Math.abs(lv0)), v2: fnum(hv0) };
    var zh0 = fillTpl(neg0 ? ex[1] : ex[0], vv);
    var en0 = fillTpl(neg0 ? ex[3] : ex[2], vv);
    return [zh0 || en0, en0 || zh0];
  }

  P.modText = function (mod, opts) {
    if (!mod || !mod.s) return ['', ''];
    if (SPECIAL_STATS[mod.s] || mod.m === 'Flag' || mod.m === 'Trigger') {
      var sp = specialText(mod);
      if (sp && (sp[0] || sp[1])) return sp;
    }
    opts = opts || {};
    var key = pickKey(mod.s, mod.m, mod.t);
    if (!key) {
      if (mod.x) return [mod.x, mod.x];
      var tags0 = mod.t || [];
      var ex = EXTRA_TEXT[mod.s + '.' + mod.m] || (mod.m === 'Flag' && tags0.length ? EXTRA_TEXT['flag:' + tags0[0]] : null);
      if (ex) return extraLine(ex, mod);
      return ['', ''];
    }
    var e = TEXTS[key] || ['', ''], z = TEXTSZH[key];
    var lo = mod.lo !== undefined ? mod.lo : mod.v;
    var hi = mod.hi !== undefined ? mod.hi : (mod.v2 !== undefined ? mod.v2 : lo);
    var twoPart = !!(mod.lo2 !== undefined || mod.hi2 !== undefined);
    var neg = n(hi !== undefined ? hi : lo) < 0;
    var consumed = key.indexOf('+') >= 0 ? key.split('+')[1] : null;
    var rest = displayTags(mod.t).filter(function (t) { return t !== consumed; });
    var el = rest.filter(function (t) { return ELEMS[t]; });
    var sk = rest.filter(function (t) { return !ELEMS[t]; });

    var enTwo = String(e[0] || '').indexOf('{v2}') >= 0;
    var vMain, v2;
    if (enTwo) {
      if (twoPart) { vMain = pair(lo, hi); v2 = pair(mod.lo2 !== undefined ? mod.lo2 : lo, mod.hi2 !== undefined ? mod.hi2 : hi); }
      else { vMain = fnum(opts.roll ? opts.roll : lo); v2 = fnum(mod.v2 !== undefined ? mod.v2 : hi); }
    } else { vMain = pair(lo, hi); v2 = ''; }
    if (opts.range2 && twoPart) { vMain = pair(lo, hi); v2 = pair(mod.lo2, mod.hi2); }

    function mk(lang) {
      var tpl = lang ? (e[neg && e[1] ? 1 : 0] || '') : null;
      if (!lang) tpl = neg && (z && z[1]) ? z[1] : (z && z[0]) || '';
      if (!lang && (!z || !z[0])) tpl = '';
      if (!tpl && lang) tpl = (neg && e[1]) ? e[1] : (e[0] || '');
      if (!tpl) tpl = (neg && e[1]) ? e[1] : (e[0] || '');
      var joiner = lang ? ' and ' : '、';
      var vals = {
        v: vMain, v2: v2, abs: absPair(lo, hi),
        tags: el.map(function (t) { return lang ? t : tagZh(t); }).join(joiner),
        tag0: el[0] ? (lang ? el[0] : tagZh(el[0])) : '',
        tag1: el[1] ? (lang ? el[1] : tagZh(el[1])) : '',
        skills: sk.map(function (t) { return lang ? t : tagZh(t); }).join(joiner)
      };
      return fillTpl(tpl, vals);
    }
    var zh = mk(0), en = mk(1);
    if (zh === en) zh = '';
    return [zh || en, en || zh];
  };

  /** Render a list of mods -> [[zh,en],...] (deduped) */
  P.modsText = function (mods) {
    var out = [], seen = {};
    for (var i = 0; i < (mods || []).length; i++) {
      var r = P.modText(mods[i]);
      if (!r[1]) continue;
      if (seen[r[1]]) continue;
      seen[r[1]] = 1;
      out.push(r);
    }
    return out;
  };

  // ================================================================ 词条匹配
  // 一个 mod 的 Tags 是「附加条件」：元素标签作用于对应伤害，机制标签必须与技能/武器标签相符。
  // 规则来自游戏数据（stat_text.json）与游戏内机制文本；参考实现见 README 的「计算规则」。
  var ELEM_LIST = ['Physical', 'Fire', 'Cold', 'Lightning', 'Poison', 'Holy', 'Chaos'];
  var ALWAYS_TAGS = {
    Hit: 1, Kill: 1, SkillUse: 1, Crit: 1, Roll: 1, Block: 1, WhenHit: 1, OnHit: 1,
    FirstTarget: 1, VsBoss: 1, EnemyLowLife: 1, LowLife: 1, FullLife: 1, Moving: 1, Stationary: 1
  };
  var WEAPON_TAGS = {
    Weapon: 1, TwoHand: 1, OneHand: 1, Ranged: 1, Bow: 1, Melee: 1, Martial: 1,
    Unarmed: 1, DualWielding: 1, HoldingShield: 1,
    Greatsword: 1, OneHandSword: 1, OneHandAxe: 1, OneHandMace: 1, TwoHandSword: 1,
    TwoHandAxe: 1, TwoHandMace: 1, Staff: 1, Wand: 1, Scythe: 1, Dagger: 1, Claw: 1,
    Fist: 1, DualBlades: 1, MaceShield: 1, Quiver: 1, Tome: 1
  };
  P.MECH_TAGS = {
    Attack: 1, Spell: 1, Melee: 1, Projectile: 1, Area: 1, Slam: 1, Nova: 1, Chain: 1,
    Channelling: 1, Channel: 1, Movement: 1, Minion: 1, Totem: 1, Trap: 1, Brand: 1,
    Orbit: 1, Rain: 1, Skyfall: 1, Duration: 1, Curse: 1, Warcry: 1, Cry: 1, Banner: 1,
    Strike: 1, Beam: 1, Whirl: 1, Spark: 1, Eruption: 1, DawnPillar: 1, SkySwords: 1,
    Firewall: 1, StormWolf: 1, Tether: 1, Conduit: 1, Pulse: 1, Corpse: 1, Raise: 1
  };

  function tagOk(tag, ctx) {
    if (ELEMS[tag]) {
      if (tag === 'Elemental') return ctx.elems.has('Fire') || ctx.elems.has('Cold') || ctx.elems.has('Lightning');
      if (tag === 'Chaos') return ctx.elems.has('Chaos') || ctx.elems.has('Poison') || ctx.tags.has('Chaos');
      if (tag === 'Holy') return ctx.elems.has('Holy') || ctx.tags.has('Holy');
      return ctx.elems.has(tag);
    }
    if (tag === 'FirstTarget') return ctx.firstTarget !== false;
    if (tag === 'VsBoss') return !!ctx.boss;
    if (tag === 'HoldingShield') return !!ctx.shield;
    if (tag === 'DualWielding') return !!ctx.dual;
    if (tag === 'BothHands' || tag === 'BothHands2') return !!ctx.both;
    if (tag === 'Unarmed') return !!ctx.unarmed;
    if (ALWAYS_TAGS[tag]) return true;
    if (ctx.tags.has(tag)) return true;
    // 武器类 tag：所持武器/副手提供的 tag
    if (ctx.weaponTags && ctx.weaponTags.has(tag)) return true;
    return false;
  }
  /** mod 是否作用于这个上下文；elem 不为空时只按该元素的标签判断 */
  P.modApplies = function (mod, ctx) {
    var tags = mod.t || [];
    for (var i = 0; i < tags.length; i++) {
      if (isParam(tags[i])) continue;
      if (!tagOk(tags[i], ctx)) return false;
    }
    return true;
  };

  // ================================================================ 聚合器
  function Agg() { this.mods = []; }
  Agg.prototype.add = function (list, src) {
    for (var i = 0; i < (list || []).length; i++) {
      var m = list[i];
      if (!m || !m.s) continue;
      var c = { s: m.s, m: m.m, t: m.t, v: n(m.v), v2: m.v2, lo: m.lo, hi: m.hi, lo2: m.lo2, hi2: m.hi2, g: m.g, x: m.x, src: src, l: m.l };
      this.mods.push(c);
    }
    return this;
  };
  Agg.prototype.sum = function (stat, mode, ctx) {
    var s = 0;
    for (var i = 0; i < this.mods.length; i++) {
      var m = this.mods[i];
      if (m.s !== stat || (mode && m.m !== mode)) continue;
      if (ctx && !P.modApplies(m, ctx)) continue;
      s += n(m.v);
    }
    return s;
  };
  Agg.prototype.inc = function (stat, ctx) { return this.sum(stat, 'Inc', ctx); };
  Agg.prototype.flat = function (stat, ctx) { return this.sum(stat, 'Flat', ctx); };
  Agg.prototype.more = function (stat, ctx) {
    var mul = 1;
    for (var i = 0; i < this.mods.length; i++) {
      var m = this.mods[i];
      if (m.s !== stat || m.m !== 'More') continue;
      if (ctx && !P.modApplies(m, ctx)) continue;
      mul *= 1 + n(m.v) / 100;
    }
    return mul;
  };
  Agg.prototype.has = function (stat, ctx) {
    for (var i = 0; i < this.mods.length; i++) {
      if (this.mods[i].s === stat && (!ctx || P.modApplies(this.mods[i], ctx))) return true;
    }
    return false;
  };
  Agg.prototype.list = function (stat, mode, ctx) {
    var out = [];
    for (var i = 0; i < this.mods.length; i++) {
      var m = this.mods[i];
      if (m.s !== stat || (mode && m.m !== mode)) continue;
      if (ctx && !P.modApplies(m, ctx)) continue;
      out.push(m);
    }
    return out;
  };
  P.Agg = Agg;

  // ================================================================ 宝石等级
  /** 技能宝石的 Effectiveness（含 Early / Late 分段），按宝石总等级读取 */
  function effAt(sk, L) {
    var e = sk.eff !== undefined && sk.eff !== null ? n(sk.eff) : 1;
    if (sk.effLate !== undefined && sk.effLate !== null && sk.lateAt) {
      var f = n(sk.lateFrom) || 1, a = n(sk.lateAt);
      e = e + (n(sk.effLate) - e) * clamp((L - f) / Math.max(1, a - f), 0, 1);
    }
    if (sk.effEarly !== undefined && sk.effEarly !== null) {
      var h = n(sk.eHold) || 1, fu = n(sk.eFull) || h + 1;
      e *= n(sk.effEarly) + (1 - n(sk.effEarly)) * clamp((L - h) / Math.max(1, fu - h), 0, 1);
    }
    return e;
  }
  P.effAt = effAt;
  /** 攻击宝石：自身等级每级 +0.08 的武器伤害占比；装备/天赋的额外等级每级 ×1.06 */
  function attackLevelFactor(own, bonus) {
    var per = n(K.effPerLvl) || 0.08;
    var more = n(K.bonusLvlMore) || 1.06;
    return (1 + per * (own - 1)) * (bonus > 0 ? Math.pow(more, bonus) : 1);
  }
  /** 法术宝石：每级 ×1.19 */
  function spellGrowth(L) { return Math.pow(n(K.gemGrowth) || 1.19, Math.max(0, L - 1)); }
  P.effectiveness = function (sk, lv) { return effAt(sk, lv || 1); };
  P.attackLevelFactor = attackLevelFactor;
  P.spellGrowth = spellGrowth;

  P.gemReqLevel = function (lv) {
    var tbl = K.charLvlForGem || [];
    return tbl[clamp(lv - 1, 0, tbl.length - 1)] || 1;
  };
  /** 角色等级能使用的宝石等级 */
  P.gemAt = function (charLevel) {
    var t = K.charLvlForGem || [], lv = 1;
    for (var i = 0; i < t.length; i++) if ((charLevel || 1) >= t[i]) lv = i + 1;
    return lv;
  };
  P.socketsAt = function (lv) {
    var t = K.socketsAtLevel || [1, 2, 5, 9, 15, 20], c = 0;
    for (var i = 0; i < t.length; i++) if (lv >= t[i]) c = i + 1;
    return Math.max(1, c);
  };
  P.manaAt = function (lv) {
    var t = K.manaAtLevel || [];
    return t[clamp(lv - 1, 0, Math.max(0, t.length - 1))] || 1;
  };

  // ================================================================ 物品
  P.IDOL_SLOTS = [];
  for (var _si = 1; _si <= 8; _si++) P.IDOL_SLOTS.push('Idol' + _si);
  P.slotList = ['MainHand', 'OffHand', 'Helm', 'Chest', 'Gloves', 'Boots', 'Belt', 'Amulet', 'Ring1', 'Ring2', 'DwarvenRune'].concat(P.IDOL_SLOTS);
  P.slotBase = { Ring1: 'Ring', Ring2: 'Ring', DwarvenRune: 'DwarvenRune' };
  P.slotZh = {
    MainHand: '主手', OffHand: '副手', Helm: '头盔', Chest: '胸甲', Gloves: '手套', Boots: '靴子',
    Belt: '腰带', Amulet: '项链', Ring1: '戒指 1', Ring2: '戒指 2', DwarvenRune: '矮人符文',
    Idol1: '神像 1', Idol2: '神像 2', Idol3: '神像 3', Idol4: '神像 4',
    Idol5: '神像 5', Idol6: '神像 6', Idol7: '神像 7', Idol8: '神像 8'
  };
  P.slotGlyph = {
    MainHand: 'weapon', OffHand: 'shield', Helm: 'helm', Chest: 'chest', Gloves: 'gloves', Boots: 'boots',
    Belt: 'belt', Amulet: 'amulet', Ring1: 'ring', Ring2: 'ring', DwarvenRune: 'rune',
    Idol1: 'idol', Idol2: 'idol', Idol3: 'idol', Idol4: 'idol', Idol5: 'idol', Idol6: 'idol', Idol7: 'idol', Idol8: 'idol'
  };
  for (var _sj = 0; _sj < P.IDOL_SLOTS.length; _sj++) P.slotBase[P.IDOL_SLOTS[_sj]] = 'Idol';
  function gameSlot(slot) {
    if (/^Idol\d+$/.test(slot)) return 'Idol';
    if (slot === 'Ring1') return 'Ring';
    return slot;
  }
  P.rarityZh = { Normal: '普通', Magic: '魔法', Rare: '稀有', Unique: '传奇' };
  P.rarityColor = { Normal: 'var(--base)', Magic: 'var(--magic)', Rare: 'var(--rare)', Unique: 'var(--uniq)' };

  P.newItem = function (slot) {
    return { s: slot, b: '', r: 'Normal', a: [], u: '', so: [], il: 84, q: 0, f: 0, ur: 50 };
  };
  P.emptyGear = function () {
    var g = {};
    for (var i = 0; i < P.slotList.length; i++) g[P.slotList[i]] = P.newItem(P.slotList[i]);
    return g;
  };
  function baseSlotOf(slot) { return P.slotBase[slot] || slot; }
  /** 底材是否可放入该槽位：副手可以放盾/箭袋/法术书，也可以放单手武器（双持） */
  function baseFitsSlot(base, slot) {
    if (!base || !slot) return false;
    var want = baseSlotOf(slot);
    if (base.slot === want) return true;
    if (want === 'OffHand' && base.slot === 'MainHand' && !base.twoh) return true;
    return false;
  }
  P.baseFitsSlot = baseFitsSlot;
  P.itemBase = function (it) { return it && it.b ? BASES[it.b] : null; };

  function tiersFor(aff, ilvl) {
    var out = [];
    for (var i = 0; i < aff.tiers.length; i++) {
      var t = aff.tiers[i];
      if ((t.i || 1) <= ilvl) out.push(t);
    }
    return out;
  }
  P.tiersFor = tiersFor;

  /** 该词缀可否出现在此底材上 */
  P.affixFits = function (aff, base) {
    if (!base) return false;
    var tags = base.tags || [];
    var on = aff.on || [];
    if (on.length) {
      var hit = false;
      for (var i = 0; i < on.length; i++) {
        if (tags.indexOf(on[i]) >= 0) { hit = true; break; }
        if (base.slot === on[i]) { hit = true; break; }
      }
      if (!hit) return false;
    }
    var not = aff.not || [];
    for (var j = 0; j < not.length; j++) if (tags.indexOf(not[j]) >= 0) return false;
    return true;
  };

  P.affixPool = function (slot, rarity, ilvl, type) {
    var bs = baseSlotOf(slot), out = [];
    for (var i = 0; i < IT.affixes.length; i++) {
      var a = IT.affixes[i];
      if (type && a.type !== type) continue;
      if (!a.tiers.length) continue;
      if ((a.tiers[0].i || 1) > ilvl) continue;
      out.push(a);
    }
    return out;
  };

  function lerp(a, b, t) { return a + (b - a) * t; }
  /** 传奇/词缀的 roll：0..100（100 = 最高） */
  function rollMod(m, rr) {
    var o = { s: m.s, m: m.m, t: m.t, x: m.x, g: m.g, l: m.l };
    if (m.lo !== undefined && m.hi !== undefined) {
      o.v = lerp(n(m.lo), n(m.hi), rr);
      o.lo = n(m.lo); o.hi = n(m.hi);
    } else o.v = n(m.v);
    if (m.lo2 !== undefined && m.hi2 !== undefined) {
      o.v2 = lerp(n(m.lo2), n(m.hi2), rr);
      o.lo2 = n(m.lo2); o.hi2 = n(m.hi2);
    } else if (m.v2 !== undefined) o.v2 = n(m.v2);
    return o;
  }

  /**
   * 解析一件物品 -> {base, mods(全局), local, lines, warn, weapon, def, sock, runeword, unique, affixes}
   * 局部词缀（bLocal）先在物品上结算；没有 bLocal 的词缀进入全局池。
   */
  P.resolveItem = function (it) {
    var base = P.itemBase(it);
    var res = {
      it: it, base: base, name: '', rarity: it && it.r, mods: [], local: [], lines: [], warn: [],
      weapon: null, def: { ar: 0, ev: 0, es: 0, block: 0 }, sock: [], runeword: null,
      unique: null, affixes: [], inc: {}
    };
    if (!base) { res.name = '空'; return res; }
    var il = clamp(n(it.il) || 84, 1, 100);
    var q = clamp(n(it.q) || 0, 0, n(K.qualityMax) || 20);
    var loc = {
      physInc: 0, elemInc: {}, addPhys: [0, 0], addElem: {}, apsInc: 0, critInc: 0, critFlat: 0,
      defInc: 0, arFlat: 0, arInc: 0, evFlat: 0, evInc: 0, esFlat: 0, esInc: 0, blockFlat: 0, blockInc: 0
    };
    var lines = [], seenGrp = {}, self = res;

    function addGlobal(m) { res.mods.push(m); lines.push(m); }
    function addLine(m) { lines.push(m); }

    function applyLocal(m) {
      var stat = m.s, mode = m.m, v = n(m.v);
      var tags = m.t || [];
      if (stat === 'Damage' && mode === 'Inc') {
        var el = null;
        for (var i = 0; i < tags.length; i++) if (ELEMS[tags[i]] && tags[i] !== 'Elemental') el = tags[i];
        if (!el || el === 'Physical') loc.physInc += v;
        else loc.elemInc[el] = (loc.elemInc[el] || 0) + v;
        return;
      }
      if (stat === 'AddedDamage' && mode === 'Flat') {
        var e = tags[0] || 'Physical';
        var lo = n(m.v), hi = n(m.v2 !== undefined ? m.v2 : m.v);
        if (lo > hi) { var t = lo; lo = hi; hi = t; }
        if (e === 'Physical') { loc.addPhys[0] += lo; loc.addPhys[1] += hi; }
        else { loc.addElem[e] = loc.addElem[e] || [0, 0]; loc.addElem[e][0] += lo; loc.addElem[e][1] += hi; }
        return;
      }
      if (stat === 'AttackSpeed' && mode === 'Inc') { loc.apsInc += v; return; }
      if (stat === 'CritChance') { if (mode === 'Inc') loc.critInc += v; else loc.critFlat += v; return; }
      if (stat === 'Defences' && mode === 'Inc') { loc.defInc += v; return; }
      if (stat === 'Armour') { if (mode === 'Inc') loc.arInc += v; else if (mode === 'Flat') loc.arFlat += v; return; }
      if (stat === 'Evasion') { if (mode === 'Inc') loc.evInc += v; else if (mode === 'Flat') loc.evFlat += v; return; }
      if (stat === 'EnergyShield') { if (mode === 'Inc') loc.esInc += v; else if (mode === 'Flat') loc.esFlat += v; return; }
      if (stat === 'Block') { if (mode === 'Inc') loc.blockInc += v; else loc.blockFlat += v; return; }
      // 其它 bLocal 行（例如武器上的 SkillLevel）仍进全局池
      addGlobal(m);
    }
    function eat(m) {
      addLine(m);
      if (m.l) applyLocal(m); else addGlobal(m);
    }

    // ---- 底材固有词条
    for (var i = 0; i < (base.imp || []).length; i++) eat(base.imp[i]);

    // ---- 传奇 / 稀有 / 魔法词缀
    if (it.r === 'Unique' && it.u && UNI[it.u]) {
      var u = UNI[it.u];
      res.unique = u;
      if (u.base && u.base !== it.b) res.warn.push('传奇 ' + P.T(u.n) + ' 只能出现在 ' + (P.BASES[u.base] ? P.T(P.BASES[u.base].n) : u.base) + ' 上');
      var rr = clamp(it.ur === undefined ? 50 : n(it.ur), 0, 100) / 100;
      for (var j = 0; j < u.mods.length; j++) eat(rollMod(u.mods[j], rr));
      res.name = P.T(u.n);
    } else {
      var caps = K.affixCap[it.r] || [0, 0];
      var pre = 0, suf = 0;
      for (var k = 0; k < (it.a || []).length; k++) {
        var slotA = it.a[k];
        var aff = AFF[slotA.i];
        if (!aff) { res.warn.push('未知词缀：' + slotA.i); continue; }
        if (aff.type === 'Prefix') pre++; else suf++;
        if (seenGrp[aff.grp]) { res.warn.push('词缀组重复：' + (aff.grpZh || aff.grp) + ' 只能出现一次'); continue; }
        seenGrp[aff.grp] = 1;
        if (!P.affixFits(aff, base)) { res.warn.push((aff.grpZh || aff.grp) + '：底材不支持该词缀'); continue; }
        var tf = tiersFor(aff, il);
        var tier = null, tIdx = -1;
        if (slotA.t !== undefined && aff.tiers[slotA.t] && (aff.tiers[slotA.t].i || 1) <= il) { tier = aff.tiers[slotA.t]; tIdx = slotA.t; }
        else if (tf.length) { tier = tf[0]; tIdx = aff.tiers.indexOf(tier); }
        if (!tier) { res.warn.push('物品等级不足：' + (aff.grpZh || aff.grp) + '（需要 ilvl ' + (aff.tiers[aff.tiers.length - 1] ? aff.tiers[aff.tiers.length - 1].i : 1) + '）'); continue; }
        if (it.r === 'Normal') { res.warn.push('普通物品没有随机词缀'); continue; }
        var rr2 = clamp(slotA.r === undefined ? 100 : n(slotA.r), 0, 100) / 100;
        var lo = lerp(n(tier.lo), n(tier.hi), rr2);
        var hi = lo;
        var mod = { s: aff.s, m: aff.m, t: aff.t, l: aff.l, lo: lo, hi: hi };
        mod.v = lo;
        if (tier.lo2 !== undefined && tier.lo2 !== null) {
          var lo2 = lerp(n(tier.lo2), n(tier.hi2), rr2);
          mod.lo2 = lo2; mod.hi2 = lo2; mod.v2 = lo2;
        } else if (aff.v2 !== undefined && aff.v2 !== null) {
          mod.v2 = n(aff.v2);
        }
        res.affixes.push({ aff: aff, tier: tier, mod: mod, roll: rr2, t: tIdx });
        eat(mod);
      }
      if (it.r !== 'Normal') {
        if (pre > caps[0]) res.warn.push('前缀超限：' + pre + ' / ' + caps[0]);
        if (suf > caps[1]) res.warn.push('后缀超限：' + suf + ' / ' + caps[1]);
      }
      res.name = res.affixes.length ? P.T(base.n) : P.T(base.n);
    }

    // ---- 数值化（武器 / 防御）
    if (base.dmg) {
      var qk = 1 + q / 100;
      var physMin = (n(base.dmg[0]) + loc.addPhys[0]) * (1 + (loc.physInc + q) / 100);
      var physMax = (n(base.dmg[1]) + loc.addPhys[1]) * (1 + (loc.physInc + q) / 100);
      var elem = {};
      for (var e2 in loc.addElem) {
        var ei = 1 + (loc.elemInc[e2] || 0) / 100;
        elem[e2] = [loc.addElem[e2][0] * ei, loc.addElem[e2][1] * ei];
      }
      res.weapon = {
        phys: [physMin, physMax], elem: elem,
        aps: (n(base.aps) || 1.2) * (1 + loc.apsInc / 100),
        crit: (n(base.crit) + loc.critFlat) * (1 + loc.critInc / 100),
        q: q, physInc: loc.physInc
      };
    }
    var dq = 1 + q / 100;
    res.def = {
      ar: (n(base.ar) + loc.arFlat) * (1 + (loc.defInc + loc.arInc) / 100) * dq,
      ev: (n(base.ev) + loc.evFlat) * (1 + (loc.defInc + loc.evInc) / 100) * dq,
      es: (n(base.es) + loc.esFlat) * (1 + (loc.defInc + loc.esInc) / 100) * dq,
      block: (n(base.block) + loc.blockFlat) * (1 + loc.blockInc / 100)
    };

    // ---- 符文孔
    var sockMax = n(base.sock);
    var sockets = (it.so || []).filter(function (x) { return !!x; });
    if (sockets.length > sockMax) res.warn.push('孔位超限：' + P.T(base.n) + ' 最多 ' + sockMax + ' 孔');
    for (var s = 0; s < sockets.length; s++) {
      var ru = RUNE[sockets[s]];
      if (!ru) continue;
      if (s >= sockMax) continue;
      var modsUse = base.dmg ? ru.w : ru.a;
      for (var q2 = 0; q2 < modsUse.length; q2++) eat(modsUse[q2]);
      res.sock.push(ru);
    }
    // ---- 符文之语
    if (sockets.length && sockets.length === sockMax && sockMax > 0) {
      for (var w = 0; w < IT.runewords.length; w++) {
        var rw = IT.runewords[w];
        if (rw.runes.length !== sockets.length) continue;
        var okBase = true;
        if (rw.bases && rw.bases.length) {
          okBase = false;
          for (var bi = 0; bi < rw.bases.length; bi++) if ((base.tags || []).indexOf(rw.bases[bi]) >= 0) { okBase = true; break; }
        }
        if (!okBase) continue;
        var ok = true;
        for (var ri = 0; ri < rw.runes.length; ri++) if (rw.runes[ri] !== sockets[ri]) { ok = false; break; }
        if (ok) {
          res.runeword = rw;
          for (var mi = 0; mi < rw.mods.length; mi++) eat(rw.mods[mi]);
          break;
        }
      }
    }
    // 全空孔也提示（便于玩家理解）
    if (sockets.length < sockMax && sockMax > 0) {
      // 不作为警告：留孔是合法的
    }

    res.lines = lines;
    return res;
  };

  // ================================================================ 天赋树
  P.treeState = function (st) { return st.tree || (st.tree = { alloc: {}, choice: {}, socket: {} }); };
  P.nodeAlloc = function (st, id) { return !!(st.tree && st.tree.alloc && st.tree.alloc[id]); };

  function classStartIds(cls) {
    var out = [];
    for (var i = 0; i < TR.nodes.length; i++) {
      var nd = TR.nodes[i];
      if (nd.cs === cls) out.push(nd.i);
    }
    return out;
  }
  P.classStartIds = classStartIds;

  /** 与该职业起始点连通的节点集合（用于合法性校验；起点本身不需要已分配） */
  P.treeReach = function (cls) {
    var starts = classStartIds(cls);
    var seen = {}, q = [], i;
    for (i = 0; i < starts.length; i++) { seen[starts[i]] = 1; q.push(starts[i]); }
    if (!starts.length) {
      for (i = 0; i < TR.nodes.length; i++) if (TR.nodes[i].k === 'Start') { seen[TR.nodes[i].i] = 1; q.push(TR.nodes[i].i); break; }
    }
    while (q.length) {
      var cur = NODE[q.pop()];
      if (!cur) continue;
      for (var j = 0; j < cur.l.length; j++) {
        var nx = cur.l[j];
        if (seen[nx] || !NODE[nx]) continue;
        seen[nx] = 1; q.push(nx);
      }
    }
    return seen;
  };

  /** 已分配节点中与起始点连通的部分（起点免费，不要求已分配） */
  P.connectedAlloc = function (st) {
    var starts = classStartIds(st.cls);
    var seen = {}, q = [], i;
    for (i = 0; i < starts.length; i++) { seen[starts[i]] = 1; q.push(starts[i]); }
    while (q.length) {
      var cur = NODE[q.pop()];
      if (!cur) continue;
      for (var j = 0; j < cur.l.length; j++) {
        var nx = cur.l[j];
        if (!st.tree.alloc[nx] || seen[nx] || !NODE[nx]) continue;
        seen[nx] = 1; q.push(nx);
      }
    }
    return seen;
  };

  P.pointBudget = function (level) {
    return Math.max(0, Math.round((level - 1) * n(K.passivePerLevel)) + 15);
  };
  P.dragonBudget = function (level, st) {
    var ms = (TR.dragon && TR.dragon.milestones) || [], c = 0;
    for (var i = 0; i < ms.length; i++) if (level >= ms[i]) c++;
    var cfg = (st && st.cfg) || {};
    c += clamp(n(cfg.gates !== undefined ? cfg.gates : 6), 0, 60);
    c += clamp(n(cfg.pinnacle !== undefined ? cfg.pinnacle : 1), 0, 5);
    return c;
  };

  // ================================================================ 构筑汇总
  function collectGear(st, out) {
    var slots = P.slotList;
    var mh = st.gear.MainHand && st.gear.MainHand.b ? BASES[st.gear.MainHand.b] : null;
    for (var i = 0; i < slots.length; i++) {
      var slot = slots[i];
      var it = st.gear[slot];
      if (!it || !it.b) continue;
      var base = BASES[it.b];
      if (!base) { out.warn.push(P.slotZh[slot] + '：未知底材 ' + it.b); continue; }
      var bs = baseSlotOf(slot);
      if (!baseFitsSlot(base, slot)) { out.warn.push(P.slotZh[slot] + '：' + P.T(base.n) + ' 不能装备在此槽位'); continue; }
      if (slot === 'OffHand' && mh && mh.twoh) {
        // 弓是双手武器，但可以和箭袋一起装备
        var offBase = BASES[it.b];
        var quiverOk = offBase && offBase.cls === 'Quiver' && mh.cls === 'Bow';
        if (!quiverOk) { out.warn.push('双手武器占用副手：' + P.T(base.n) + ' 不生效'); continue; }
      }
      if (slot === 'MainHand' && CLS[st.cls]) {
        var wk = CLS[st.cls].weapons || [];
        if (wk.length && wk.indexOf(base.cls) < 0) out.warn.push(P.T(base.n) + ' 不是 ' + P.T(CLS[st.cls].n) + ' 可用的武器类别');
      }
      if (slot === 'MainHand' && it.r === 'Unique' && it.u && UNI[it.u] && UNI[it.u].base !== it.b) {
        out.warn.push(P.T(UNI[it.u].n) + ' 不在 ' + P.T(base.n) + ' 上');
      }
      var r = P.resolveItem(it);
      for (var w = 0; w < r.warn.length; w++) out.warn.push(P.slotZh[slot] + '：' + r.warn[w]);
      out.items[slot] = r;
      var req = base.req || [0, 0, 0];
      out.itemReq.push({ slot: slot, name: P.T(base.n), str: req[0] || 0, dex: req[1] || 0, int: req[2] || 0 });
      out.agg.add(r.mods, '装备·' + P.slotZh[slot]);
    }
  }

  function skillCtx(st, sk, elems, extra) {
    var tags = new Set(sk.tags || []);
    var weaponTags = new Set();
    var sh = st.gear.MainHand && st.gear.MainHand.b ? BASES[st.gear.MainHand.b] : null;
    if (sh) {
      (sh.tags || []).forEach(function (t) { weaponTags.add(t); tags.add(t); });
      if (sh.wk) { weaponTags.add(sh.wk); tags.add(sh.wk); }
    }
    var oh = st.gear.OffHand && st.gear.OffHand.b ? BASES[st.gear.OffHand.b] : null;
    if (oh) {
      weaponTags.add(oh.cls);
      (oh.tags || []).forEach(function (t) { weaponTags.add(t); tags.add(t); });
      if (oh.cls === 'Shield') { weaponTags.add('HoldingShield'); tags.add('HoldingShield'); }
    }
    if (sk.deliv) tags.add(sk.deliv);
    if ((sk.tags || []).indexOf('Minion') >= 0) tags.add('Minion');
    var e = new Set(elems || []);
    return {
      tags: tags, elems: e, weaponTags: weaponTags,
      minion: (sk.tags || []).indexOf('Minion') >= 0,
      firstTarget: !(extra && extra.firstTarget === false),
      boss: !!(extra && extra.boss),
      shield: !!(oh && oh.cls === 'Shield'),
      dual: !!(sh && oh && !sh.twoh && oh.dmg),
      both: !!((sk.both) || (sh && sh.twoh && (sk.tags || []).indexOf('Attack') >= 0)),
      unarmed: !sh
    };
  }

  /** 已分配天赋 + 龙裔 + 装备 + 誓约 的全局池 */
  function collectAll(st) {
    var out = {
      agg: new Agg(), items: {}, warn: [], req: { str: 0, dex: 0, int: 0 }, itemReq: [],
      keystones: {}, treePoints: 0, dragonPoints: 0, curseList: [], vowList: [], reserve: 0
    };
    collectGear(st, out);

    // 天赋树：全部已分配节点都计入伤害（导入的旧代码可能存在不连通节点，只提示不吞掉数值）
    var alloc = st.tree.alloc || {};
    var conn = P.connectedAlloc(st);
    for (var i = 0; i < TR.nodes.length; i++) {
      var nd = TR.nodes[i];
      if (!alloc[nd.i]) continue;
      if (nd.k !== 'Start') out.treePoints++;
      if (!conn[nd.i] && nd.k !== 'Start') { out.warn.push('天赋点未连接：' + P.T(nd.n)); }
      for (var m = 0; m < nd.m.length; m++) out.agg.add([nd.m[m]], '天赋·' + P.T(nd.n));
      for (var f = 0; f < nd.m.length; f++) {
        var mm = nd.m[f];
        if (mm.s === 'Keystone') {
          var tags = mm.t || [];
          for (var t = 0; t < tags.length; t++) out.keystones[tags[t]] = nd;
        }
      }
      if (nd.so) {
        var rid = (st.tree.socket || {})[nd.i];
        if (rid && RUNE[rid]) {
          var ru = RUNE[rid];
          if (ru.a.length) out.agg.add(ru.a, '天赋符文');
          if (ru.w.length) out.agg.add(ru.w, '天赋符文');
        }
      }
    }
    // 抉择互斥
    var byChoice = {};
    for (var i2 = 0; i2 < TR.nodes.length; i2++) {
      var n2 = TR.nodes[i2];
      if (!alloc[n2.i] || !n2.ch) continue;
      (byChoice[n2.ch] = byChoice[n2.ch] || []).push(n2);
    }
    for (var g in byChoice) if (byChoice[g].length > 1) out.warn.push('同一抉择只能选一个：' + byChoice[g].map(function (x) { return P.T(x.n); }).join(' / '));

    // 龙裔
    var dr = st.dragon || { nodes: {}, aspect: '' };
    var dnodes = ((TR.dragon.classes || {})[st.cls] || []);
    var dnIndex = {};
    for (var d = 0; d < dnodes.length; d++) dnIndex[dnodes[d].i] = dnodes[d];
    var crowns = 0;
    for (var key in (dr.nodes || {})) {
      if (!dr.nodes[key]) continue;
      var node = dnIndex[key];
      if (!node) { out.warn.push('龙裔节点不属于本职业：' + key); continue; }
      out.dragonPoints++;
      if (node.k === 'Keystone' || node.k === 'Capstone') crowns++;
      for (var dm = 0; dm < node.m.length; dm++) {
        var dmod = node.m[dm];
        out.agg.add([dmod], '龙裔·' + P.T(node.n));
        // 部分龙裔节点用 Dragonling 旗帜编码行为，换算成实际词条
        if (dmod.s === 'Dragonling' && dmod.t) {
          for (var dtf = 0; dtf < dmod.t.length; dtf++) {
            if (dmod.t[dtf] === 'Asc71_MarkOfSiege') {
              out.agg.add([{ s: 'Damage', m: 'More', v: 30, t: ['Totem'] }], '龙裔·攻城印记');
            }
          }
        }
      }
      for (var df = 0; df < node.m.length; df++) {
        if (node.m[df].s === 'Keystone') {
          var tg = node.m[df].t || [];
          for (var tf = 0; tf < tg.length; tf++) out.keystones[tg[tf]] = node;
        }
      }
    }
    if (crowns > n(TR.dragon.maxKeystones || 1)) out.warn.push('龙裔：王冠节点（基石/顶点）最多 ' + (TR.dragon.maxKeystones || 1) + ' 个');
    if (dr.aspect) {
      var asp = null;
      for (var ai = 0; ai < (TR.dragon.aspects || []).length; ai++) if (TR.dragon.aspects[ai].id === dr.aspect) asp = TR.dragon.aspects[ai];
      if (asp) out.agg.add(asp.mods, '龙裔形态');
    }

    // 誓约 / 先驱 / 灾祸：词条带 PerLevel 的按宝石等级成长
    var vows = st.vows || {};
    var vowLv = P.gemAt(st.level || 1);
    for (var vid in vows) {
      if (!vows[vid]) continue;
      var b = BL[vid];
      if (!b) continue;
      out.vowList.push(b);
      var effMods = [];
      for (var bm = 0; bm < b.mods.length; bm++) {
        var src = b.mods[bm];
        var c = { s: src.s, m: src.m, t: src.t, v: n(src.v), v2: src.v2, x: src.x };
        if (src.pl) c.v = n(src.v) + n(src.pl) * (vowLv - 1);
        effMods.push(c);
      }
      out.agg.add(effMods, '誓约·' + P.T(b.n));
      if (b.resFlat) out.reserve += n(b.resFlat) + n(b.resFlatPer) * (vowLv - 1);
      if (b.resPct) out.reserve += n(b.resPct) / 100;
    }

    // 诅咒（作用于目标）
    for (var cid in (st.curses || {})) {
      if (!st.curses[cid]) continue;
      var c = CU[cid];
      if (c) out.curseList.push(c);
    }
    return out;
  }
  P.collectAll = collectAll;

  /** 属性 */
  function calcAttributes(st, all) {
    var c = CLS[st.cls] || CLS.Warrior || { str: 20, dex: 12, int: 8, sL: 0, dL: 0, iL: 0 };
    var lv = st.level || 1;
    var ctx = { tags: new Set(), elems: new Set(), weaponTags: new Set() };
    var str = n(c.str) + n(c.sL) * (lv - 1) + all.agg.flat('Str', ctx) + all.agg.flat('Attributes', ctx);
    var dex = n(c.dex) + n(c.dL) * (lv - 1) + all.agg.flat('Dex', ctx) + all.agg.flat('Attributes', ctx);
    var int = n(c.int) + n(c.iL) * (lv - 1) + all.agg.flat('Int', ctx) + all.agg.flat('Attributes', ctx);
    str *= all.agg.more('Str', ctx); dex *= all.agg.more('Dex', ctx); int *= all.agg.more('Int', ctx);
    str *= 1 + all.agg.inc('Str', ctx) / 100; dex *= 1 + all.agg.inc('Dex', ctx) / 100; int *= 1 + all.agg.inc('Int', ctx) / 100;
    return { str: str, dex: dex, int: int };
  }

  function calcDefence(st, all, attrs) {
    var lv = st.level || 1;
    var ctx = { tags: new Set(), elems: new Set(), weaponTags: new Set() };
    var lifeFlat = n(K.lifeBase) + n(K.lifePerLevel) * (lv - 1) + n(K.lifePerStr) * attrs.str;
    lifeFlat += all.agg.flat('Life', ctx);
    var life = lifeFlat * (1 + all.agg.inc('Life', ctx) / 100) * all.agg.more('Life', ctx);

    var manaFlat = n(K.manaBase) + n(K.manaPerLevel) * (lv - 1) + n(K.manaPerInt) * attrs.int + all.agg.flat('Mana', ctx);
    var mana = manaFlat * (1 + all.agg.inc('Mana', ctx) / 100) * all.agg.more('Mana', ctx);

    var esFlat = n(K.esPerInt) * attrs.int + all.agg.flat('EnergyShield', ctx);
    var es = esFlat * (1 + all.agg.inc('EnergyShield', ctx) / 100) * all.agg.more('EnergyShield', ctx);
    // 护甲/闪避：先汇总装备，再吃全局加成与属性
    var ar = 0, ev = 0, block = 0, esItem = 0;
    for (var i = 0; i < P.slotList.length; i++) {
      var r = all.items[P.slotList[i]];
      if (!r || !r.def) continue;
      ar += r.def.ar; ev += r.def.ev; block += r.def.block; esItem += r.def.es;
    }
    es += esItem * (1 + (all.agg.inc('EnergyShield', ctx) + n(K.intEs) * Math.floor(attrs.int / 10)) / 100) * all.agg.more('EnergyShield', ctx);
    ar *= (1 + (all.agg.inc('Armour', ctx) + n(K.strArmour) * Math.floor(attrs.str / 10)) / 100) * all.agg.more('Armour', ctx);
    ev *= (1 + (all.agg.inc('Evasion', ctx) + n(K.dexEvasion) * Math.floor(attrs.dex / 10)) / 100) * all.agg.more('Evasion', ctx);
    block = block + all.agg.flat('Block', ctx);
    block *= 1 + all.agg.inc('Block', ctx) / 100;
    block = Math.min(n(K.blockMax), block);

    function resOf(el) {
      var ectx = { tags: new Set(), elems: new Set([el]), weaponTags: new Set() };
      var v = all.agg.flat('Resist', ectx);
      return v;
    }
    var res = { Fire: resOf('Fire'), Cold: resOf('Cold'), Lightning: resOf('Lightning'), Chaos: resOf('Chaos') };
    // 全元素抗性：Resist 的 tags 为空或 Elemental 的行会同时命中
    var maxRes = {};
    ['Fire', 'Cold', 'Lightning', 'Chaos'].forEach(function (el) {
      var mv = n(K.resCap);
      for (var m2 = 0; m2 < all.agg.mods.length; m2++) {
        var x = all.agg.mods[m2];
        if (x.s !== 'MaxResist' || x.m !== 'Flat') continue;
        var t2 = x.t || [];
        if (t2.indexOf(el) >= 0 || (t2.indexOf('Elemental') >= 0 && el !== 'Chaos')) mv += n(x.v);
      }
      maxRes[el] = Math.min(n(K.resHardCap), mv);
    });
    var move = 1 + all.agg.inc('MoveSpeed', ctx) / 100;
    var lifeRegen = (n(K.lifeRegenPct) + all.agg.flat('LifeRegenPct', ctx)) / 100 * life;
    var manaRegen = (n(K.manaRegenPct) + all.agg.flat('ManaRegen', ctx)) / 100 * mana;

    return {
      life: life, mana: mana, es: es, armour: ar, evasion: ev, block: block,
      res: res, maxRes: maxRes, move: move, lifeRegen: lifeRegen, manaRegen: manaRegen,
      pool: life + es
    };
  }

  // ================================================================ 伤害计算
  var DT = ['Physical', 'Fire', 'Cold', 'Lightning', 'Poison', 'Holy', 'Chaos'];
  function baseElement(sk) { return sk.dmg && DT.indexOf(sk.dmg) >= 0 ? sk.dmg : 'Physical'; }

  /** 每个伤害 piece：{type, scales:Set, min, max, moreScales?} */
  function basePieces(st, sk, own, bonus, L, all, agg, ctx0) {
    var parts = {};
    for (var d = 0; d < DT.length; d++) parts[DT[d]] = [0, 0];
    var isAtk = (sk.tags || []).indexOf('Attack') >= 0;
    var mh = all.items.MainHand;
    var w = mh && mh.weapon;
    var eff = effAt(sk, L);
    var info = { isAtk: isAtk, eff: eff, weapon: w, attackMult: 0, levelFactor: 1, growth: 1 };

    if (isAtk) {
      var lf = attackLevelFactor(own, bonus);
      var mult = eff * lf;
      info.attackMult = mult;
      info.levelFactor = lf;
      if (w) {
        parts.Physical[0] += w.phys[0] * mult; parts.Physical[1] += w.phys[1] * mult;
        for (var el in w.elem) {
          if (!ELEMS[el] || el === 'Elemental') continue;
          parts[el] = parts[el] || [0, 0];
          parts[el][0] += w.elem[el][0] * mult;
          parts[el][1] += w.elem[el][1] * mult;
        }
      } else {
        parts.Physical[0] += 2 * mult; parts.Physical[1] += 5 * mult;
      }
      info.aps = w ? w.aps : 1.2;
      info.crit = w ? w.crit : n(K.critBase);
    } else {
      var g = spellGrowth(L);
      info.growth = g;
      var smin = sk.smin !== null && sk.smin !== undefined ? n(sk.smin) : 0;
      var smax = sk.smax !== null && sk.smax !== undefined ? n(sk.smax) : 0;
      var el2 = baseElement(sk);
      parts[el2] = [smin * g * eff, smax * g * eff];
      info.crit = n(K.spellCritBase);
    }
    // 附加伤害
    for (var i = 0; i < agg.mods.length; i++) {
      var m = agg.mods[i];
      if (m.s !== 'AddedDamage' || m.m !== 'Flat') continue;
      if (!P.modApplies(m, ctx0)) continue;
      var t = (m.t || [])[0] || 'Physical';
      if (!ELEMS[t] || t === 'Elemental') continue;
      var lo = n(m.v), hi = n(m.v2 !== undefined ? m.v2 : m.v);
      if (lo > hi) { var tmp = lo; lo = hi; hi = tmp; }
      var k;
      if (isAtk) k = info.attackMult * (m.g ? spellGrowth(L) : 1);
      else k = m.g ? spellGrowth(L) : eff;
      parts[t] = parts[t] || [0, 0];
      parts[t][0] += lo * k; parts[t][1] += hi * k;
    }
    info.parts = parts;
    // 环绕战锤：蓄能后每柄锤造成 EmpowerMore% 更多伤害（游戏数据 Orbit.EmpowerMore）
    if (sk.orbit && n(sk.orbit.EmpowerMore)) {
      var em = 1 + n(sk.orbit.EmpowerMore) / 100;
      for (var pd in parts) { parts[pd][0] *= em; parts[pd][1] *= em; }
    }
    return info;
  }

  /** 转化 + 额外伤害，规则见游戏 tooltip：转化后的伤害保留原类型的加成，并获得新类型的加成 */
  function convertPieces(st, sk, info, agg, ctx0) {
    var parts = info.parts;
    var pieces = [];
    for (var d = 0; d < DT.length; d++) if (parts[DT[d]][1] > 0) pieces.push({ type: DT[d], scales: new Set([DT[d]]), min: parts[DT[d]][0], max: parts[DT[d]][1] });
    var isAtk = info.isAtk;
    // 攻击技能自带的元素转化（Lightning Arrow 的 50%）
    if (isAtk && sk.dmg && sk.dmg !== 'Physical' && DT.indexOf(sk.dmg) >= 0) {
      var share = sk.convert !== undefined && sk.convert !== null ? (sk.convert > 1 ? sk.convert / 100 : sk.convert) : 1;
      var ph = null;
      for (var i = 0; i < pieces.length; i++) if (pieces[i].type === 'Physical') ph = pieces[i];
      if (ph && share > 0) {
        pieces.push({ type: sk.dmg, scales: new Set(['Physical', sk.dmg]), min: ph.min * share, max: ph.max * share });
        ph.min *= 1 - share; ph.max *= 1 - share;
        if (ph.max <= 0) pieces = pieces.filter(function (p) { return p !== ph; });
      }
    }
    // Convert 词条：目标元素写在 tags 里；带条件 tag 时表示「所有其它伤害」，否则默认物理
    var rules = [];
    for (var j = 0; j < agg.mods.length; j++) {
      var m = agg.mods[j];
      if (m.s !== 'Convert' || m.m !== 'Flat') continue;
      var tags = m.t || [];
      var to = null, conds = [];
      for (var t = 0; t < tags.length; t++) {
        if (isParam(tags[t])) continue;
        if (ELEMS[tags[t]] && tags[t] !== 'Elemental') { if (!to) to = tags[t]; }
        else conds.push(tags[t]);
      }
      if (!to) continue;
      for (var c = 0; c < conds.length; c++) if (!tagOk(conds[c], ctx0)) { to = null; break; }
      if (!to) continue;
      rules.push({ to: to, pct: n(m.v) / 100, all: conds.length > 0 });
    }
    if (rules.length) {
      var out = [];
      for (var p = 0; p < pieces.length; p++) {
        var pc = pieces[p];
        var shares = [], tot = 0;
        for (var r = 0; r < rules.length; r++) {
          var rule = rules[r];
          if (rule.to === pc.type) { shares.push(0); continue; }
          var f = rule.all ? 1 : (pc.type === 'Physical' ? 1 : 0);
          if (pc.type === 'Poison') f = Math.min(f, 0.5);
          var s = rule.pct * f;
          shares.push(s); tot += s;
        }
        var scale = tot > 1 ? 1 / tot : 1;
        var kept = 1 - Math.min(1, tot);
        if (kept > 0.0001) out.push({ type: pc.type, scales: new Set(pc.scales), min: pc.min * kept, max: pc.max * kept });
        for (var r2 = 0; r2 < rules.length; r2++) {
          if (shares[r2] <= 0) continue;
          var ns = new Set(pc.scales); ns.add(rules[r2].to);
          out.push({ type: rules[r2].to, scales: ns, moreScales: new Set(pc.scales), min: pc.min * shares[r2] * scale, max: pc.max * shares[r2] * scale });
        }
      }
      pieces = out;
    }
    // DamageAsExtra
    var extras = [], extraRules = [];
    for (var k = 0; k < agg.mods.length; k++) {
      var em = agg.mods[k];
      if (em.s !== 'DamageAsExtra' || em.m !== 'Flat') continue;
      if (!P.modApplies(em, ctx0)) continue;
      var et = em.t || [];
      if (!et.length) continue;
      var to2 = et[et.length - 1], from = et.length >= 2 ? et[0] : null;
      if (!ELEMS[to2] || to2 === 'Elemental') continue;
      extraRules.push({ to: to2, from: from, pct: n(em.v) / 100 });
    }
    function addExtras(rules2, sources) {
      for (var q = 0; q < rules2.length; q++) {
        var rr = rules2[q];
        for (var s2 = 0; s2 < sources.length; s2++) {
          var src = sources[s2];
          if (rr.from && src.type !== rr.from && !(src.scales.has(rr.from) && rr.from !== rr.to)) continue;
          extras.push({ type: rr.to, scales: new Set([rr.to]), min: src.min * rr.pct, max: src.max * rr.pct, from: src.type });
        }
      }
    }
    addExtras(extraRules.filter(function (r) { return r.to !== 'Fire'; }), pieces);
    addExtras(extraRules.filter(function (r) { return r.to === 'Fire'; }), pieces.concat(extras.slice()));
    pieces = pieces.concat(extras);
    info.pieces = pieces;
    return pieces;
  }

  /** 每个 piece 的 inc/more；返回按元素汇总 */
  function scalePieces(st, sk, info, agg, ctx0) {
    var pieces = info.pieces, by = {}, total = 0, count = 0;
    var attrs = st.attrs || { str: 0, dex: 0, int: 0 };
    var per10 = function (v) { return v / 10; };
    var strMelee = 0;
    if ((sk.tags || []).indexOf('Melee') >= 0) strMelee = per10(attrs.str) * n(K.strMeleePhys);
    var intSpell = (sk.tags || []).indexOf('Spell') >= 0 ? per10(attrs.int) * n(K.intSpell) : 0;
    for (var i = 0; i < pieces.length; i++) {
      var p = pieces[i];
      var els = new Set(p.scales);
      var ctx = {
        tags: ctx0.tags, elems: els, weaponTags: ctx0.weaponTags, minion: ctx0.minion,
        firstTarget: ctx0.firstTarget, boss: ctx0.boss, shield: ctx0.shield, dual: ctx0.dual,
        both: ctx0.both, unarmed: ctx0.unarmed
      };
      var inc = 0, more = 1;
      for (var j = 0; j < agg.mods.length; j++) {
        var m = agg.mods[j];
        if (m.s !== 'Damage') continue;
        if (m.m === 'Inc') { if (elementModApplies(m, ctx, p)) inc += n(m.v); }
        else if (m.m === 'More') { if (elementModApplies(m, ctx, p)) more *= Math.max(0, 1 + n(m.v) / 100); }
      }
      if (p.scales.has('Physical') && strMelee) inc += strMelee;
      if (intSpell) inc += intSpell;
      // 0.56.5 的「伤害引擎」：力量/护甲/闪避/护盾/生命/格挡换算出的更多伤害加在一起，再作为一个乘区
      var eng = engineMore(st, agg, p, ctx);
      if (eng) more *= Math.max(0, 1 + eng / 100);
      var k = Math.max(0, 1 + inc / 100) * more;
      var avg = (p.min + p.max) / 2 * k;
      if (!by[p.type]) by[p.type] = { min: 0, max: 0, inc: inc, more: more, avg: 0 };
      by[p.type].min += p.min * k; by[p.type].max += p.max * k; by[p.type].avg += avg;
      total += avg; count++;
    }
    info.by = by; info.hitAvg = total;
    return by;
  }
  /** 元素标签要同时满足 piece 的 scales；条件标签照常判断 */
  function elementModApplies(m, ctx, piece) {
    var tags = m.t || [];
    for (var i = 0; i < tags.length; i++) {
      var t = tags[i];
      if (isParam(t)) continue;
      if (ELEMS[t]) {
        if (t === 'Elemental') { if (!(piece.scales.has('Fire') || piece.scales.has('Cold') || piece.scales.has('Lightning'))) return false; }
        else if (t === 'Chaos') { if (!(piece.scales.has('Chaos') || piece.scales.has('Poison')) && !ctx.tags.has('Chaos')) return false; }
        else if (t === 'Holy') { if (!piece.scales.has('Holy') && !ctx.tags.has('Holy')) return false; }
        else if (!piece.scales.has(t)) return false;
      } else if (!tagOk(t, ctx)) return false;
    }
    return true;
  }

  /**
   * 0.56.5 的「伤害引擎」：StrMeleeMore / ArmourMore / EvasionMore / EnergyShieldMore / LifeMore
   * 换算出的更多伤害加在一起（不是逐条相乘）。换算规则来自天赋/传奇文本：
   * 每 1000 点护甲/闪避/护盾/生命，超过阈值（12000/12000/6000/5000）后按四分之一计算；
   * 力量对物理近战：每 10 点 1.75%，300 点后每 10 点 0.5%。
   */
  function engineMore(st, agg, piece, ctx) {
    var e = 0;
    var attrs = st.attrs || {};
    if (piece.scales.has('Physical') && ctx.tags.has('Melee')) {
      var str = n(attrs.str);
      for (var i = 0; i < agg.mods.length; i++) {
        var m = agg.mods[i];
        if (m.s !== 'StrMeleeMore' || m.m !== 'Flat') continue;
        if (!P.modApplies(m, ctx)) continue;
        var v = n(m.v);
        e += Math.min(str, 300) / 10 * v + Math.max(0, str - 300) / 10 * (v / 3.5);
      }
    }
    var def = st._def || {};
    var rule = [
      ['ArmourMore', 'armour', 12000, 0.25],
      ['EvasionMore', 'evasion', 12000, 0.25],
      ['EnergyShieldMore', 'es', 6000, 0.25],
      ['LifeMore', 'life', 5000, 0.25]
    ];
    for (var r = 0; r < rule.length; r++) {
      var stat = rule[r][0], key = rule[r][1], cap = rule[r][2], frac = rule[r][3];
      var val = n(def[key]);
      if (val <= 0) continue;
      for (var j = 0; j < agg.mods.length; j++) {
        var mm = agg.mods[j];
        if (mm.s !== stat || mm.m !== 'Flat') continue;
        if (!P.modApplies(mm, ctx)) continue;
        var vv = n(mm.v);
        e += vv * Math.min(val, cap) / 1000 + vv * frac * Math.max(0, val - cap) / 1000;
      }
    }
    // 格挡：每 1% 格挡给 BlockMore% 更多伤害（Swift Ward / Stalwart / Steadfast Vigil）
    if (n(def.block) > 0) {
      for (var b = 0; b < agg.mods.length; b++) {
        var bm = agg.mods[b];
        if (bm.s !== 'BlockMore' || bm.m !== 'Flat') continue;
        if (!P.modApplies(bm, ctx)) continue;
        e += n(bm.v) * n(def.block);
      }
    }
    return e;
  }

  /** 暴击 */
  function critInfo(st, sk, info, agg, ctx0) {
    var isAtk = info.isAtk;
    var base = isAtk ? n(info.crit) : n(K.spellCritBase);
    // 法术拿法杖时用杖的暴击（游戏 tooltip）
    if (!isAtk && st.gear.MainHand && st.gear.MainHand.b) {
      var mb = BASES[st.gear.MainHand.b];
      if (mb && mb.cls === 'Staff' && info.weapon) base = info.weapon.crit;
    }
    var ctx = {
      tags: ctx0.tags, elems: new Set(Object.keys(info.by || {})), weaponTags: ctx0.weaponTags,
      minion: false, firstTarget: ctx0.firstTarget, boss: ctx0.boss, shield: ctx0.shield
    };
    var flat = 0, inc = 0, more = 1;
    for (var i = 0; i < agg.mods.length; i++) {
      var m = agg.mods[i];
      if (m.s !== 'CritChance') continue;
      if (!P.modApplies(m, ctx)) continue;
      if (m.m === 'Flat') flat += n(m.v);
      else if (m.m === 'Inc') inc += n(m.v);
      else if (m.m === 'More') more *= 1 + n(m.v) / 100;
    }
    var chance = clamp((base + flat) * (1 + inc / 100) * more, 0, n(K.critCap) || 95);
    var multi = n(K.critMultiBase) + flatMulti(agg, ctx);
    multi = Math.max(100, multi);
    if (agg.flat('CritMulti', ctx) !== undefined) { /* noop */ }
    var ap = 1 + chance / 100 * (multi / 100 - 1);
    return { chance: chance, multi: multi / 100, multiPct: multi, ap: ap, base: base, inc: inc, flat: flat };
  }
  function flatMulti(agg, ctx) {
    var v = 0;
    for (var i = 0; i < agg.mods.length; i++) {
      var m = agg.mods[i];
      if (m.s === 'CritMulti' && m.m !== 'More' && P.modApplies(m, ctx)) v += n(m.v);
    }
    return v;
  }

  /** 速度 -> 每次使用时间 / 周期 */
  function rateInfo(st, sk, info, agg, ctx, L) {
    var attrs = st.attrs || { dex: 0 };
    var isAtk = info.isAtk;
    var use, speed = 1;
    var ctx2 = {
      tags: ctx.tags, elems: new Set(Object.keys(info.by || {})), weaponTags: ctx.weaponTags,
      minion: false, firstTarget: ctx.firstTarget, boss: ctx.boss, shield: ctx.shield
    };
    if (sk.channel && sk.channel.Tick) {
      var chStat = isAtk ? 'AttackSpeed' : 'CastSpeed';
      speed = (1 + agg.inc(chStat, ctx2) / 100) * agg.more(chStat, ctx2);
      if (isAtk) speed = (1 + (agg.inc(chStat, ctx2) + (attrs.dex || 0) / 10 * n(K.dexAtkSpeed)) / 100) * agg.more(chStat, ctx2);
      use = n(sk.channel.Tick) / Math.max(0.05, speed);
    } else if (isAtk) {
      var aps = n(info.aps) || 1;
      var inc = agg.inc('AttackSpeed', ctx2) + (attrs.dex || 0) / 10 * n(K.dexAtkSpeed);
      var more = agg.more('AttackSpeed', ctx2);
      speed = (1 + inc / 100) * more;
      aps = aps * speed * (n(sk.act) || 1);
      aps = clamp(aps, 0.05, n(K.actionMax) || 4);
      use = 1 / aps;
    } else {
      var ct = n(sk.cast) || 0.5;
      var cs = (1 + agg.inc('CastSpeed', ctx2) / 100) * agg.more('CastSpeed', ctx2);
      speed = cs;
      use = ct / Math.max(0.05, cs);
    }
    var cd = n(sk.cd) || 0;
    // 动画速度：技能片段本身的 Rate（<1 更慢），与 ActionSpeed 叠乘；引导的每跳不额外吃动画
    var animTab = (CORE.animRate || {})[String(st.cls || '').toLowerCase()] || {};
    var anim = n(animTab[sk.id]) || 1;
    if (anim > 0 && anim !== 1 && !(sk.channel && sk.channel.Tick)) use = use / anim;
    if (sk.cdLate !== undefined && sk.cdLate !== null && sk.cdLateAt && L >= sk.cdLateAt) cd = n(sk.cdLate);
    if (cd > 0) {
      cd *= Math.max(0.1, 1 + agg.inc('Cooldown', ctx2) / 100);
      // 0.56.2：冷却随攻速/施法速度恢复
      cd = Math.max(0.05, cd / Math.max(0.1, speed));
    }
    var cycle = Math.max(use, cd);
    return { use: use, cycle: cycle, cd: cd, speed: 1 / cycle, actionSpeed: speed };
  }

  /** 异常状态（scaling.json Ailments；与游戏面板一致，按命中与暴击期望结算） */
  function ailmentInfo(st, sk, agg, ctx, by, hitAvg, critFactor, hitsPerSec) {
    var A = K.ail || {};
    var res = { ignite: null, poison: null, bleed: null, shock: null, chill: null, freeze: null, dps: 0 };
    var ctxE = function (el) {
      return {
        tags: ctx.tags, elems: new Set([el]), weaponTags: ctx.weaponTags, minion: ctx.minion,
        firstTarget: ctx.firstTarget, boss: ctx.boss, shield: ctx.shield, dual: ctx.dual, both: ctx.both, unarmed: ctx.unarmed
      };
    };
    var dotMulti = 1 + agg.flat('DotMulti', ctx) / 100;
    var durInc = 1 + agg.inc('AilmentDuration', ctx) / 100;
    var ailDur = 1 + (agg.inc('AilmentDuration', ctx) + n(K.intAilment) * Math.floor(((st.attrs || {}).int || 0) / 10)) / 100;
    var dmgTypes = Object.keys(by);
    function chOf(stat, base) { return clamp((base || 0) + agg.flat(stat, ctx), 0, 100); }
    function takenOf(type) { return st._enemy ? st._enemy.takenFor(type) : 1; }

    // 流血：物理命中的 50%/s，4 秒，最强一条
    var bch = chOf('BleedChance', 0);
    if (bch > 0 && by.Physical) {
      var bInc = agg.inc('BleedDamage', ctx), bMore = agg.more('BleedDamage', ctx);
      var bDur = 4 * ailDur;
      var dps1 = by.Physical.avg * critFactor * n(A.BleedFracPerSec || 0.5) * Math.max(0, 1 + bInc / 100) * bMore * dotMulti;
      var up = 1 - Math.exp(-hitsPerSec * bch / 100 * bDur);
      res.bleed = { chance: bch, dps1: dps1, uptime: up, duration: bDur, dps: dps1 * up * takenOf('Physical'), inc: bInc, more: bMore };
    }
    // 点燃：火焰命中 90% 在 4 秒内烧完
    var ich = chOf('IgniteChance', n(A.IgniteChance));
    if (ich > 0 && by.Fire) {
      var iInc = agg.inc('IgniteDamage', ctx), iMore = agg.more('IgniteDamage', ctx);
      var iDur = n(A.IgniteSeconds || 4) * ailDur;
      var idps = by.Fire.avg * critFactor * n(A.IgniteFrac || 0.9) / Math.max(0.5, iDur) * Math.max(0, 1 + iInc / 100) * iMore * dotMulti;
      var iup = 1 - Math.exp(-hitsPerSec * ich / 100 * iDur);
      var stacks = 1;
      for (var si = 0; si < agg.mods.length; si++) {
        var sm = agg.mods[si];
        if (sm.s === 'IgniteStacks' && sm.m === 'Flat' && P.modApplies(sm, ctx)) stacks += n(sm.v);
      }
      stacks = Math.max(1, Math.round(stacks));
      var burning = iup;
      if (stacks > 1) {
        var mu = hitsPerSec * ich / 100 * iDur;
        burning = 0; var p = Math.exp(-mu), cum = 0;
        for (var k = 0; k < stacks; k++) { cum += p; burning += 1 - cum; p *= mu / (k + 1); }
      }
      res.ignite = { chance: ich, dps1: idps, uptime: iup, duration: iDur, dps: idps * burning * takenOf('Fire'), stacks: stacks, burning: burning };
    }
    // 中毒：每层每秒 = 命中的 20%，持续 2 秒，最多 40 层
    var pch = chOf('PoisonChance', 0);
    var hasP = !!(by.Poison || (pch > 0 && by.Physical));
    if (pch > 0 && hasP) {
      var eligible = (by.Poison ? by.Poison.avg : 0) + (pch > 0 && by.Physical ? by.Physical.avg : 0);
      var pInc = agg.inc('PoisonDamage', ctx), pMore = agg.more('PoisonDamage', ctx);
      var pDur = n(A.PoisonSeconds || 2) * ailDur;
      var per = eligible * critFactor * n(A.PoisonFracPerSec || 0.2) * Math.max(0, 1 + pInc / 100) * pMore * dotMulti;
      var rate = hitsPerSec * pch / 100;
      var stackCap = n(A.PoisonMaxStacks) || 40;
      var pstacks = Math.min(rate * pDur, stackCap);
      res.poison = { chance: pch, eligible: eligible, duration: pDur, per: per, perStack: per, stacks: pstacks, dps: per * pstacks * takenOf('Poison') };
    }
    // 感电：按闪电命中 / 目标生命提高目标受到的伤害
    if (by.Lightning && by.Lightning.avg > 0 && (n(A.ShockChance) + agg.flat('ShockChance', ctx)) > 0) {
      var lch = chOf('ShockChance', n(A.ShockChance));
      var life = st._refLife || 100000;
      var raw = n(A.ShockCoef || 50) * Math.pow(Math.max(0, by.Lightning.avg / Math.max(1, life)), n(A.ShockPow || 0.4));
      var effK = 1 + agg.inc('ShockEffect', ctx) / 100;
      var cap = Math.min(n(A.ShockMaxCap || 50), n(A.ShockMax || 20) * Math.max(1, effK));
      var size = clamp(raw * effK, n(A.ShockMin || 5), cap);
      var sDur = n(A.ShockSeconds || 2) * ailDur;
      var pApply = 1 - Math.exp(-hitsPerSec * lch / 100 * sDur);
      var allCap = n(A.ShockStackCap || 75);
      var pct = Math.min(allCap, size * pApply);
      res.shock = { chance: lch, effect: size, pct: pct, uptime: pApply, duration: sDur, life: life, raw: raw };
    }
    // 冰缓/冰冻只作为信息
    if (by.Cold) {
      var cchRaw = by.Cold.avg / Math.max(1, st._refLife || 100000);
      var chill = clamp(n(A.ChillMinPct || 10), n(A.ChillMinPct || 10), n(A.ChillMaxPct || 30) * clamp(cchRaw / (n(A.ChillFullAtPct || 10) / 100), 0, 1));
      res.chill = { pct: chill, chance: 100 };
    }
    res.dps = (res.ignite ? res.ignite.dps : 0) + (res.poison ? res.poison.dps : 0) + (res.bleed ? res.bleed.dps : 0);
    return res;
  }

  // ================================================================ 单个技能 DPS
  P.calcSkill = function (st, entry, all, opts) {
    opts = opts || {};
    var sk = SK[entry.id];
    if (!sk) return null;
    var warnings = [];

    // ---- 辅助合法性 + 本技能词条池
    var supAgg = new Agg();
    var supList = [], supIds = entry.sup || [];
    var sockMax = P.socketsAt(entry.lv || 1);
    var seenSup = {};
    for (var i = 0; i < supIds.length; i++) {
      var sid = typeof supIds[i] === 'string' ? supIds[i] : supIds[i].id;
      var s = SUP[sid];
      if (!s) { warnings.push('未知辅助：' + sid); continue; }
      if (seenSup[sid]) { warnings.push('同一辅助不能重复：' + P.T(s.n)); continue; }
      seenSup[sid] = 1;
      supList.push(s);
      if (i >= sockMax) warnings.push('插槽上限：宝石等级 ' + entry.lv + ' 只有 ' + sockMax + ' 个辅助插槽');
      var chk = P.checkSupport(entry.id, sid);
      if (!chk.ok) warnings.push(chk.why);
      supAgg.add(s.mods, '技能·' + P.T(s.n));
    }
    if (entry.lv > (n(K.gemMax) || 20) + 20) warnings.push('宝石等级超过上限');

    // 传奇/装备授予的辅助（GrantSupport）：满足作用标签时按辅助宝石处理
    var gctx = skillCtx(st, sk, [], opts);
    for (var gi = 0; gi < all.agg.mods.length; gi++) {
      var gm = all.agg.mods[gi];
      if (gm.s !== 'GrantSupport') continue;
      var gt = gm.t || [];
      var gsup = gt[0] ? SUP[gt[0]] : null;
      if (!gsup) continue;
      if (supIds.indexOf(gsup.id) >= 0) continue;
      var already = false;
      for (var gs = 0; gs < supList.length; gs++) if (supList[gs].id === gsup.id) { already = true; break; }
      if (already) continue;
      var gok = true;
      for (var gj = 1; gj < gt.length; gj++) {
        if (isParam(gt[gj])) continue;
        if (!tagOk(gt[gj], gctx)) { gok = false; break; }
      }
      if (!gok) continue;
      var g2 = {};
      for (var gk in gsup) g2[gk] = gsup[gk];
      g2.granted = 1;
      supList.push(g2);
      supAgg.add(gsup.mods, '授予辅助·' + P.T(gsup.n));
    }

    var mainBase0 = st.gear.MainHand && st.gear.MainHand.b ? BASES[st.gear.MainHand.b] : null;
    var isAtk0 = (sk.tags || []).indexOf('Attack') >= 0;
    if (isAtk0 && (!mainBase0 || !mainBase0.dmg)) warnings.push('攻击技能需要主手武器，现在是空手（只有 2–5 基础伤害）');
    if (isAtk0 && mainBase0 && sk.wk && sk.wk.length && sk.wk.indexOf(mainBase0.wk) < 0) {
      warnings.push('此技能需要武器类别：' + sk.wk.join(' / ') + '，当前主手是 ' + P.T(mainBase0.n));
    }

    // ---- 合并池
    var merged = new Agg();
    merged.mods = all.agg.mods.concat(supAgg.mods);

    // ---- 技能上下文（基础元素）
    var elems = new Set([baseElement(sk)]);
    if (isAtk0) elems.add('Physical');
    for (var q = 0; q < merged.mods.length; q++) {
      var qm = merged.mods[q];
      if (qm.s === 'AddedDamage' || qm.s === 'DamageAsExtra' || qm.s === 'Convert') {
        var qt = qm.t || [];
        for (var qt2 = 0; qt2 < qt.length; qt2++) if (ELEMS[qt[qt2]] && qt[qt2] !== 'Elemental') elems.add(qt[qt2]);
      }
    }
    var ctx0 = skillCtx(st, sk, elems, opts);

    // ---- 宝石等级：自身等级 + SkillLevel
    var own = clamp(n(entry.lv) || 1, 1, 40);
    var bonusRaw = 0;
    for (var b = 0; b < merged.mods.length; b++) {
      var bm = merged.mods[b];
      if (bm.s !== 'SkillLevel' || bm.m !== 'Flat') continue;
      if (!P.modApplies(bm, ctx0)) continue;
      bonusRaw += n(bm.v);
    }
    var bonus = Math.floor(bonusRaw);
    var L = clamp(own + bonus, 1, 40);
    var reqLv = P.gemReqLevel(L);
    if (reqLv > (st.level || 1)) warnings.push('宝石等级 ' + L + ' 需要角色等级 ' + reqLv + '（当前 ' + (st.level || 1) + '）');

    // ---- 基础伤害 + 转化 + 额外
    var info = basePieces(st, sk, own, bonus, L, all, merged, ctx0);
    convertPieces(st, sk, info, merged, ctx0);
    // 无元素伤害（Brutality）
    var noElem = all.keystones.NoElemental || merged.has('NoElemental', ctx0);
    if (noElem) {
      info.pieces = info.pieces.filter(function (p) { return !(ELEMS[p.type] && p.type !== 'Physical' && p.type !== 'Poison' && p.type !== 'Chaos'); });
    }
    var by = scalePieces(st, sk, info, merged, ctx0);
    var hitAvg = info.hitAvg;

    // ---- 暴击
    var crit = critInfo(st, sk, info, merged, ctx0);
    if (all.keystones.ElementalOverload) crit.multi = 1;
    if (isAtk0 && all.keystones.NoAttackCrit) { crit.chance = 0; crit.ap = 1; }
    if (!isAtk0 && all.keystones.NoSpellCrit) { crit.chance = 0; crit.ap = 1; }

    // ---- 速度
    var rate = rateInfo(st, sk, info, merged, ctx0, L);

    // ---- 打击数：技能形态 / 重复 / 投射物 / 雨 / 天降
    var strikes = 1;
    if (typeof sk.strikes === 'number') strikes = Math.max(1, sk.strikes);
    else if (sk.strikes && sk.strikes.Count) strikes = Math.max(1, n(sk.strikes.Count));
    var repeats = Math.max(0, merged.flat('Repeats', ctx0));
    var after = 0;
    var cap = n((K.meta59 || {}).AfterimageCap) || 3;
    var ap = n((K.meta59 || {}).AfterimageDamagePct) || 40;
    if (merged.has('Afterimages', ctx0)) after = Math.min(cap, merged.flat('Afterimages', ctx0));

    // 技能形态：同一时间只取第一个形态辅助（游戏规则）
    var SHAPES = ['orbit', 'skyfall', 'rain_support', 'trap_support', 'totem_support'];
    var shape = null;
    for (var shi = 0; shi < supList.length; shi++) {
      if (SHAPES.indexOf(supList[shi].id) >= 0) { shape = supList[shi].id; break; }
    }
    // 投射物数量：技能基础 + 每 10/20 级 + 辅助/天赋的 +投射物
    var projectiles = 0;
    if (ctx0.tags.has('Projectile')) {
      projectiles = (n(sk.proj) || 1);
      if (sk.projLv) for (var pj = 0; pj < sk.projLv.length; pj++) if (L >= sk.projLv[pj]) projectiles++;
      for (var pi = 0; pi < merged.mods.length; pi++) {
        var pm = merged.mods[pi];
        if (pm.s === 'Projectiles' && pm.m === 'Flat' && P.modApplies(pm, ctx0)) projectiles += n(pm.v);
      }
    }
    var projOnTarget = 1, projWeight = 1;
    if (projectiles && shape === 'rain_support') {
      projOnTarget = projectiles >= 4 ? 3 : 2;
      projWeight = projOnTarget;
    } else if (projectiles && shape === 'skyfall') {
      projOnTarget = 1;
    } else if (projectiles && shape === 'orbit') {
      // Orbit 辅助：所有投射物环绕同一目标，后续每一枚造成 60% 更少（攻击 90% 更少）
      var orbMax = 8;
      projOnTarget = Math.max(1, Math.min(projectiles, orbMax));
      var orbLess = ((sk.tags || []).indexOf('Attack') >= 0 ? 90 : 60) / 100;
      projWeight = 1 + (projOnTarget - 1) * (1 - orbLess);
    } else if (projectiles) {
      // 普通投射物：一次施放每个敌人只被一个投射物击中（游戏 tooltip）
      projOnTarget = 1;
    }
    // 天降的第二段（只对 Skyfall 技能；火花等不适用）
    var skyRep = 0;
    if (sk.deliv === 'Skyfall' || shape === 'skyfall') {
      for (var sr = 0; sr < merged.mods.length; sr++) {
        if (merged.mods[sr].s === 'SkyfallRepeat' && merged.mods[sr].m === 'Flat' && P.modApplies(merged.mods[sr], ctx0)) skyRep += n(merged.mods[sr].v);
      }
      skyRep = Math.min(100, skyRep) / 100;
    }
    var falls = skyRep > 0 ? 2 : 1;
    var perHitFactor = projWeight / projOnTarget * (1 + skyRep) / falls;

    // 雨技能（Delivery=Rain）自带波数
    var rainWaves = (sk.deliv === 'Rain' && sk.rain && n(sk.rain.Waves) > 0) ? n(sk.rain.Waves) : 0;
    if (rainWaves) strikes = rainWaves;

    var orbit = null, brand = null, totem = null, special = false;
    var hitsPerUse = (1 + repeats) * projOnTarget * strikes * falls;
    if (sk.orbit && sk.deliv === 'Orbit') {
      var oc = n(sk.orbit.Count) + (sk.orbit.CountPerLevels || []).filter(function (lv) { return own >= lv; }).length;
      for (var oi = 0; oi < merged.mods.length; oi++) {
        var om = merged.mods[oi];
        if (om.s === 'OrbitCount' && om.m === 'Flat' && P.modApplies(om, ctx0)) oc += n(om.v);
      }
      var turns = n(sk.orbit.AngularSpeed) / 360 * (1 + merged.inc('OrbitRate', ctx0) / 100);
      rate.use = 1 / Math.max(0.1, oc * turns);
      rate.cycle = rate.use;
      hitsPerUse = 1; special = true;
      orbit = { count: oc, turns: turns };
    } else if (sk.brand && sk.deliv === 'Brand') {
      var capBrand = n(sk.brand.Max) || 3;
      var interval = n(sk.brand.Interval) || 0.8;
      var dur = n(sk.brand.Duration) || 5;
      var casts = 1 / Math.max(0.1, rate.cycle);
      var sparks = Math.min(capBrand, Math.max(1, dur * casts));
      var hps = sparks / Math.max(0.05, interval);
      rate.use = 1 / hps; rate.cycle = rate.use;
      hitsPerUse = 1; special = true;
      brand = { sparks: sparks, interval: interval, cap: capBrand };
    } else if (sk.totem && n(sk.totem.Interval) > 0 && sk.deliv === 'Totem') {
      var tc = Math.max(1, n(sk.totem.Max) || 1);
      for (var tci = 0; tci < merged.mods.length; tci++) {
        var tcm = merged.mods[tci];
        if (tcm.s === 'TotemCount' && tcm.m === 'Flat' && P.modApplies(tcm, ctx0)) tc += n(tcm.v);
      }
      var tspeed = 1 + merged.inc('TotemSpeed', ctx0) / 100;
      var ti = n(sk.totem.Interval) / Math.max(0.1, tspeed);
      // 0.56.2：弩炮最多 6 座、图腾 10 座；0.56.5：第 2 座起每座 80% 伤害，第 7 座起 20%
      var capTot = sk.totem.Kind === 'Ballista' ? 6 : 10;
      tc = Math.min(tc, capTot);
      var countFactor = tc > 1 ? (1 + (Math.min(tc, 6) - 1) * 0.8 + Math.max(0, tc - 6) * 0.2) / tc : 1;
      rate.use = ti; rate.cycle = ti;
      hitsPerUse = tc * projOnTarget;
      special = true;
      totem = { count: tc, every: ti, countFactor: countFactor };
    }
    if (after > 0) hitsPerUse += after * ap / 100;
    var blows = hitsPerUse;
    var hitsPerSec = (1 / rate.cycle) * hitsPerUse;
    if (totem) { rate.use = 1 / hitsPerSec; rate.cycle = 1 / hitsPerSec; }

    // ---- 猎人印记：被链接技能的每次击中叠 1 层，每层使目标受到更多伤害（守护者上限翻倍）
    var markTaken = 0, markStacks = 0;
    if (merged.has('MarkOnHit', ctx0) && CU.hunters_mark) {
      var markDur = n(CU.hunters_mark.dur) || 3;
      var markCap = ctx0.boss ? 20 : 10;
      markStacks = Math.min(markCap, hitsPerSec * markDur);
      markTaken = n(CU.hunters_mark.taken) * markStacks * (sk.minion ? 0.5 : 1);
    }

    // ---- 命中 DPS（perHitFactor：天降第二段/球环权重；图腾按 0.56.5 的伤害分摊）
    var hitDps = hitAvg * crit.ap * hitsPerSec * perHitFactor * (totem ? totem.countFactor : 1);
    if (markTaken) hitDps *= 1 + markTaken / 100;

    // ---- 树/装备触发器（暴击后追加一击、每 N 次命中爆发等）
    var trigDps = 0, trigList = [];
    for (var ti2 = 0; ti2 < merged.mods.length; ti2++) {
      var tm = merged.mods[ti2];
      if (tm.s !== 'Trigger') continue;
      var tags = tm.t || [];
      var when = null, elem = null, pct = 0, nth = 1, count = 1;
      for (var tj = 0; tj < tags.length; tj++) {
        var tg = tags[tj];
        if (tg.indexOf('Pct=') === 0) pct = n(tg.slice(4));
        else if (tg.indexOf('Nth=') === 0) nth = Math.max(1, n(tg.slice(4)));
        else if (tg.indexOf('Count=') === 0) count = Math.max(1, n(tg.slice(6)));
        else if (tg.indexOf('Element=') === 0) elem = tg.slice(8);
        else if (tg === 'Hit' || tg === 'Crit' || tg === 'SkillUse') when = tg;
      }
      if (!when || !pct) continue;
      var ev;
      if (when === 'Crit') ev = hitsPerSec * crit.chance / 100 / nth;
      else if (when === 'SkillUse') ev = (1 / rate.cycle) / nth;
      else ev = hitsPerSec / nth;
      var cdT = n(tm.v2) || 0;
      if (cdT > 0) ev = Math.min(ev, 1 / cdT);
      var size = hitAvg * pct / 100 * count;
      if (when === 'Crit') size = hitAvg / Math.max(1e-9, crit.ap) * crit.multi * pct / 100 * count;
      var td = size * ev;
      if (elem) {
        var eb = by[elem] ? by[elem].avg : 0;
        if (eb <= 0) td = 0;
      }
      if (td > 0) { trigDps += td; trigList.push({ when: when, pct: pct, dps: td, element: elem }); }
    }
    hitDps += trigDps;

    // ---- 异常状态（按命中/秒）
    var ail = ailmentInfo(st, sk, merged, ctx0, by, hitAvg, crit.ap, hitsPerSec);
    var shockF = 1;
    if (ail.shock && st.cfg && st.cfg.shock) shockF = 1 + ail.shock.pct / 100;
    hitDps *= shockF;
    var dotDps = ail.dps * shockF;
    if (markTaken) dotDps *= 1 + markTaken / 100;

    // ---- 召唤物单独结算（游戏面板口径：每只召唤物不间断攻击，近身加成计入）
    var minion = null;
    if (sk.minion && sk.minion.MonsterId) {
      var mi = sk.minion;
      var growth = spellGrowth(L);
      var d0 = baseElement(sk);
      var baseMin = (n(sk.smin) || 0) * growth, baseMax = (n(sk.smax) || 0) * growth;
      var mctx = {
        tags: ctx0.tags, elems: new Set([d0]), weaponTags: ctx0.weaponTags, minion: true,
        firstTarget: true, boss: ctx0.boss, shield: ctx0.shield
      };
      var mInc = 0;
      for (var mi1 = 0; mi1 < merged.mods.length; mi1++) {
        var mm1 = merged.mods[mi1];
        if (mm1.s !== 'MinionDamage' || mm1.m !== 'Inc') continue;
        if (!P.modApplies(mm1, mctx)) continue;
        mInc += n(mm1.v);
      }
      mInc += ((st.attrs || {}).int || 0) / 10 * n(K.intMinion);
      var mMore = 1;
      for (var mi2 = 0; mi2 < merged.mods.length; mi2++) {
        var mm2 = merged.mods[mi2];
        if (mm2.s !== 'MinionDamage' || mm2.m !== 'More') continue;
        if (!P.modApplies(mm2, mctx)) continue;
        mMore *= 1 + n(mm2.v) / 100;
      }
      // 辅助宝石的「更多伤害」按标签决定是否作用于召唤物
      for (var si = 0; si < supList.length; si++) {
        var sup = supList[si];
        for (var sm = 0; sm < sup.mods.length; sm++) {
          var smm = sup.mods[sm];
          if (smm.s !== 'Damage' || smm.m !== 'More') continue;
          if (!P.modApplies(smm, mctx)) continue;
          mMore *= 1 + n(smm.v) / 100;
        }
      }
      var count = n(mi.Cap) || n(mi.Count) || 1;
      if (mi.CountEvery) count += Math.floor((L - 1) / n(mi.CountEvery));
      if (mi.PerLevels) for (var pl = 0; pl < mi.PerLevels.length; pl++) if (L >= mi.PerLevels[pl]) count++;
      if (!mi.GolemAuras) {
        for (var mc = 0; mc < merged.mods.length; mc++) {
          var mcm = merged.mods[mc];
          if (mcm.s !== 'MinionCap' || mcm.m !== 'Flat') continue;
          if (!minionTagFits(mcm, sk, d0)) continue;
          count += n(mcm.v);
        }
      }
      var pace = (n(mi.AttackEvery) || 1) * (n(K.minionPace) || 0.72);
      var spInc = 0;
      for (var mi3 = 0; mi3 < merged.mods.length; mi3++) {
        if (merged.mods[mi3].s === 'MinionSpeed' && merged.mods[mi3].m === 'Inc' && P.modApplies(merged.mods[mi3], mctx)) spInc += n(merged.mods[mi3].v);
      }
      var spMore = 1;
      for (var mi4 = 0; mi4 < merged.mods.length; mi4++) {
        var mm4 = merged.mods[mi4];
        if ((mm4.s === 'MinionSpeed' && mm4.m === 'More') || (mm4.s === 'AttackSpeed' && mm4.m === 'More' && mm4.src && mm4.src.indexOf('技能') === 0)) {
          if (!P.modApplies(mm4, mctx)) continue;
          spMore *= 1 + n(mm4.v) / 100;
        }
      }
      pace = pace / Math.max(0.05, (1 + spInc / 100) * spMore);
      var mStrikes = 1;
      for (var mi5 = 0; mi5 < merged.mods.length; mi5++) {
        if (merged.mods[mi5].s === 'MinionStrikes' && merged.mods[mi5].m === 'Flat' && P.modApplies(merged.mods[mi5], mctx)) mStrikes += n(merged.mods[mi5].v);
      }
      var kinds = 0;
      for (var kb = 0; kb < (st.bar || []).length; kb++) {
        var ksk = SK[st.bar[kb].id];
        if (ksk && ksk.minion && ksk.minion.MonsterId) kinds++;
      }
      kinds = Math.max(1, Math.min(4, kinds));
      var kindK = 1;
      for (var mi6 = 0; mi6 < merged.mods.length; mi6++) {
        var mm6 = merged.mods[mi6];
        if (mm6.s === 'MinionKindMore' && mm6.m === 'Flat' && P.modApplies(mm6, mctx)) kindK *= 1 + n(mm6.v) / 100 * kinds;
      }
      var near = 1 + (n(K.minionNear) || 60) / 100;
      var affK = 1;
      if (mi.Affinity) {
        var attrKey = String(mi.Affinity).toLowerCase();
        var attrVal = n((st.attrs || {})[attrKey]);
        affK = 1 + Math.min(n(mi.AffinityCap) || 50, attrVal * (n(mi.AffinityDamage) || 0)) / 100;
      }
      var zoneLevel = clamp(n((st.cfg || {}).rl) || st.level || 84, 1, 100);
      var lvlK = mi.LevelDamage ? 1 + n(mi.LevelDamage) * 0.04 * Math.pow(zoneLevel, 1.05) : 1;
      var mHit = (baseMin + baseMax) / 2 * (n(mi.DamageMult) || 1) * affK * near * Math.max(0, 1 + mInc / 100) * mMore * kindK * lvlK;
      var critF = 1 + n(K.spellCritBase) / 100 * (n(K.critMultiBase) / 100 - 1);
      var mdps = mHit * critF * count * mStrikes / Math.max(0.05, pace);
      if (markTaken) mdps *= 1 + markTaken / 100;
      minion = { count: count, cap: n(mi.Cap) || 1, hit: mHit, every: pace, dps: mdps, mode: 'minion', monster: mi.MonsterId, kinds: kinds };
      by = {}; by[d0] = { min: mHit, max: mHit, inc: mInc, more: mMore, avg: mHit };
      hitAvg = mHit;
      hitDps = mdps;
      dotDps = 0; ail = { ignite: null, poison: null, bleed: null, shock: null, dps: 0 };
      hitsPerSec = count * mStrikes / Math.max(0.05, pace);
      crit = { chance: n(K.spellCritBase), multi: n(K.critMultiBase) / 100, multiPct: n(K.critMultiBase), ap: critF, base: n(K.spellCritBase), inc: 0, flat: 0 };
      rate = { use: pace, cycle: 1 / Math.max(0.05, hitsPerSec), cd: 0, speed: hitsPerSec, actionSpeed: (1 + spInc / 100) * spMore };
    }

    // ---- 有效 DPS（计入目标抗性、穿透与诅咒）
    var penCtx = {
      tags: ctx0.tags, elems: new Set(), weaponTags: ctx0.weaponTags, minion: ctx0.minion,
      firstTarget: ctx0.firstTarget, boss: ctx0.boss, shield: ctx0.shield
    };
    var dpsEff = 0, elemRes = {}, effW = 0, effMulSum = 0;
    for (var e3 = 0; e3 < DT.length; e3++) {
      var et = DT[e3];
      if (!by[et] || by[et].avg <= 0) continue;
      var pctx = {
        tags: ctx0.tags, elems: new Set([et]), weaponTags: ctx0.weaponTags, minion: ctx0.minion,
        firstTarget: ctx0.firstTarget, boss: ctx0.boss, shield: ctx0.shield
      };
      var pen = aggSum(merged, 'Penetration', 'Flat', pctx);
      var baseRes = (et === 'Physical' || et === 'Chaos') ? 0 : (st._resBase || 0);
      if (st._enemy && st._enemy.rdown && st._enemy.rdown[et]) baseRes -= st._enemy.rdown[et];
      var res = clamp(baseRes - pen, -100, 100);
      var mul = 1 - res / 100;
      var w = by[et].avg * crit.ap * hitsPerSec;
      var taken = st._enemy ? st._enemy.takenFor(et) : 1;
      dpsEff += w * mul * taken;
      effW += w; effMulSum += mul * w;
      elemRes[et] = { res: res, pen: pen, mul: mul, avg: by[et].avg };
    }
    // 持续伤害的有效值
    var dotEff = 0;
    if (dotDps > 0 && st._enemy) {
      var dotW = 0;
      if (ail.bleed) dotW += ail.bleed.dps * (1 - clamp(((st._resBase || 0) - 0), -100, 100) / 100);
      if (ail.ignite) dotW += ail.ignite.dps * (1 - clamp(((st._resBase || 0)), -100, 100) / 100);
      if (ail.poison) dotW += ail.poison.dps * (1 - clamp(((st._resBase || 0)), -100, 100) / 100);
      dotEff = dotW;
    }
    if (!st._enemy) { dpsEff = hitDps + dotDps; }
    else { dpsEff += dotEff; if (!(dpsEff > 0)) dpsEff = hitDps + dotDps; }
    if (markTaken) dpsEff *= 1 + markTaken / 100;
    var effMul = effW > 0 ? effMulSum / effW : 1;

    var totalDps = hitDps + dotDps;
    var hitMin = 0, hitMax = 0;
    for (var hk in by) { if (!by[hk] || hk.charAt(0) === '_') continue; hitMin += by[hk].min; hitMax += by[hk].max; }
    return {
      id: sk.id, sk: sk, lv: L, own: own, bonus: bonus, entry: entry, supports: supList, warnings: warnings,
      eff: info.eff, attackMult: info.attackMult, levelFactor: info.levelFactor,
      perElem: by, hit: hitAvg, hitMin: hitMin, hitMax: hitMax,
      elemRes: elemRes, effMul: effMul,
      crit: crit, rate: rate, blows: blows, strikes: strikes, repeats: repeats, after: after,
      dpsHit: hitDps, dotDps: dotDps, totalDps: totalDps, dpsEff: dpsEff,
      ailments: ail, minion: minion, shockMore: (shockF - 1) * 100,
      mark: markTaken ? { stacks: markStacks, taken: markTaken } : null,
      triggers: trigList, orbit: orbit, brand: brand, totem: totem,
      mana: (n(sk.mana) || 0) * P.manaAt(L) * (supList.reduce(function (a, s) { return a * (n(s.mana) || 1); }, 1))
    };
  };

  function aggSum(agg, stat, mode, ctx) {
    var s = 0;
    for (var i = 0; i < agg.mods.length; i++) {
      var m = agg.mods[i];
      if (m.s !== stat || (mode && m.m !== mode)) continue;
      if (ctx && !P.modApplies(m, ctx)) continue;
      s += n(m.v);
    }
    return s;
  }
  function aggProduct(agg, stat, mode, ctx) {
    var p = 1;
    for (var i = 0; i < agg.mods.length; i++) {
      var m = agg.mods[i];
      if (m.s !== stat || (mode && m.m !== mode)) continue;
      if (ctx && !P.modApplies(m, ctx)) continue;
      p *= 1 + n(m.v) / 100;
    }
    return p;
  }
  /** 召唤物词条的标签：元素标签选伤害类型，怪物 Id 标签只作用于对应召唤物 */
  function minionTagFits(m, sk, d0) {
    var tags = m.t || [], mid = sk.minion && sk.minion.MonsterId;
    for (var i = 0; i < tags.length; i++) {
      var t = tags[i];
      if (isParam(t)) continue;
      if (ELEMS[t]) {
        if (t === 'Elemental') { if (!(d0 === 'Fire' || d0 === 'Cold' || d0 === 'Lightning')) return false; }
        else if (t !== d0) return false;
      } else if (t === mid || t === 'Minion') {
        continue;
      } else if ((sk.tags || []).indexOf(t) < 0) return false;
    }
    return true;
  }

  // ================================================================ 总计
  P.calc = function (st) {
    if (!st.tree) P.treeState(st);
    var all = collectAll(st);
    st.attrs = calcAttributes(st, all);
    var def = calcDefence(st, all, st.attrs);
    st._def = def;
    var warnings = all.warn.slice();

    // 属性需求（逐件）
    (all.itemReq || []).forEach(function (q) {
      var lack = [];
      if (q.str > st.attrs.str) lack.push('力量 ' + Math.round(q.str) + '/' + Math.round(st.attrs.str));
      if (q.dex > st.attrs.dex) lack.push('敏捷 ' + Math.round(q.dex) + '/' + Math.round(st.attrs.dex));
      if (q.int > st.attrs.int) lack.push('智力 ' + Math.round(q.int) + '/' + Math.round(st.attrs.int));
      if (lack.length) warnings.push(q.name + ' 属性不足：' + lack.join('、'));
    });

    // 天赋点
    var budget = P.pointBudget(st.level || 1);
    var used = all.treePoints;
    if (used > budget) warnings.push('天赋点超出：已用 ' + used + ' / ' + budget);

    // 龙裔
    var dBudget = P.dragonBudget(st.level || 1, st);
    if (all.dragonPoints > dBudget) warnings.push('龙裔点超出：已用 ' + all.dragonPoints + ' / ' + dBudget);

    // 参考目标（决定感电强度与抗性）
    var cfg = st.cfg || (st.cfg = {});
    var rl = clamp(n(cfg.rl || 84), 1, 100);
    var ref = CORE.ref || {};
    var target = cfg.target || 'boss';
    var table = ref.life || [];
    var refBase = 100;
    for (var mi = 0; mi < table.length; mi++) if (table[mi][0] === rl) refBase = table[mi][1];
    var mult = target === 'boss' ? 20 : target === 'rare' ? 4 : 1;
    st._refLife = refBase * mult;
    st._rl = rl;
    st._resBase = Math.min(n(ref.resistMax), n(ref.resistPerLevel) * rl);
    // 诅咒：目标受到的伤害、抗性降低（受智力加成）
    var curseEff = 1 + ((st.attrs || {}).int || 0) / 10 * n(K.intCurse) / 100;
    var enemy = { taken: 0, elem: {}, rdown: {}, curseEff: curseEff, takenFor: function (type) { return 1 + (this.taken + (this.elem[type] || 0)) / 100; } };
    for (var ci = 0; ci < (all.curseList || []).length; ci++) {
      var c = all.curseList[ci];
      enemy.taken += n(c.taken) * curseEff;
      for (var ce in (c.elem || {})) enemy.elem[ce] = (enemy.elem[ce] || 0) + n(c.elem[ce]) * curseEff;
      for (var cr in (c.rdown || {})) enemy.rdown[cr] = (enemy.rdown[cr] || 0) + n(c.rdown[cr]) * curseEff;
    }
    st._enemy = enemy;

    // 技能
    var rows = [];
    var bar = st.bar || [];
    for (var i = 0; i < bar.length; i++) {
      var e = bar[i];
      if (!e || !e.id) continue;
      var r = P.calcSkill(st, e, all, { boss: target === 'boss', firstTarget: true });
      if (!r) continue;
      r.slot = i;
      rows.push(r);
      for (var w = 0; w < r.warnings.length; w++) warnings.push(P.T(SK[r.id].n) + '：' + r.warnings[w]);
    }
    if (rows.length > 13) warnings.push('技能栏最多 13 个技能（现在 ' + rows.length + ' 个）');
    rows.sort(function (a, b) { return b.totalDps - a.totalDps; });
    // 去掉重复提示
    var seenW = {}, uniq = [];
    for (var wi = 0; wi < warnings.length; wi++) {
      if (seenW[warnings[wi]]) continue;
      seenW[warnings[wi]] = 1; uniq.push(warnings[wi]);
    }
    warnings = uniq;

    // 保留 / 魔法消耗
    var reserve = 0;
    for (var v = 0; v < (all.vowList || []).length; v++) {
      var b = all.vowList[v];
      if (b.resFlat) reserve += n(b.resFlat) + n(b.resFlatPer) * (P.gemAt(st.level || 1) - 1);
      if (b.resPct) reserve += def.mana * n(b.resPct) / 100;
    }
    if (reserve > def.mana && def.mana > 0) warnings.push('誓约保留超过魔力上限：' + Math.round(reserve) + ' / ' + Math.round(def.mana));
    var manaCost = 0;
    for (var m2 = 0; m2 < rows.length; m2++) {
      if (rows[m2].mana > manaCost) manaCost = rows[m2].mana;
    }

    return {
      st: st, all: all, attrs: st.attrs, def: def, skills: rows, warnings: warnings,
      tree: { used: used, budget: budget }, dragon: { used: all.dragonPoints, budget: dBudget },
      reserve: reserve, manaCost: manaCost,
      dps: rows.length ? rows[0].totalDps : 0,
      dpsEff: rows.length ? rows[0].dpsEff : 0,
      curseList: all.curseList
    };
  };

  // ================================================================ 构筑代码
  // 游戏格式：BO1. + base64url( uint32LE(解压长度) + zlib(JSON) )
  //   JSON: {v,t,c,l,p[节点],h[技能],s[{k,l,u[]}],g[{s,b,r,u?}],da,dn[]}
  // 本站格式：BO2. 同压缩，另存词缀/roll/符文/传奇 roll/誓约/配置，可完整还原
  function b64u(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    if (typeof btoa !== 'undefined') return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str) {
    var s = str.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin;
    if (typeof atob !== 'undefined') bin = atob(s);
    else bin = Buffer.from(s, 'base64').toString('binary');
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function zlibAsync(bytes, mode) {
    if (typeof CompressionStream === 'undefined' && mode === 'c') return Promise.reject(new Error('浏览器不支持 CompressionStream'));
    if (typeof DecompressionStream === 'undefined' && mode === 'd') return Promise.reject(new Error('浏览器不支持 DecompressionStream'));
    var stream = mode === 'c' ? new CompressionStream('deflate') : new DecompressionStream('deflate');
    var writer = stream.writable.getWriter();
    writer.write(bytes); writer.close();
    return new Response(stream.readable).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  function utf8(str) { return new TextEncoder().encode(str); }
  function fromUtf8(b) { return new TextDecoder().decode(b); }

  function stateToGame(st) {
    var obj = { v: 1, t: st.title || 'Build', c: st.cls, l: st.level || 1 };
    var p = [], id;
    // 职业起点是免费节点，游戏的构筑代码会带上它
    var starts = classStartIds(st.cls);
    for (var si = 0; si < starts.length; si++) p.push(starts[si]);
    for (id in (st.tree.alloc || {})) if (st.tree.alloc[id] && NODE[id] && p.indexOf(id) < 0) p.push(id);
    obj.p = p;
    var bar = (st.bar || []).filter(function (x) { return x && x.id; });
    obj.h = bar.map(function (x) { return x.id; });
    obj.s = bar.map(function (x) {
      return { k: x.id, l: x.lv || 1, u: (x.sup || []).map(function (y) { return typeof y === 'string' ? y : y.id; }) };
    });
    obj.g = [];
    for (var i = 0; i < P.slotList.length; i++) {
      var slot = P.slotList[i], it = st.gear[slot];
      if (!it || !it.b) continue;
      var g = { s: gameSlot(slot), b: it.b, r: it.r || 'Normal' };
      if (it.r === 'Unique' && it.u) g.u = it.u;
      obj.g.push(g);
    }
    obj.da = st.dragon && st.dragon.aspect ? st.dragon.aspect : '';
    var dn = [];
    for (id in ((st.dragon || {}).nodes || {})) if (st.dragon.nodes[id]) dn.push(id);
    obj.dn = dn;
    return obj;
  }

  function stateToFull(st) {
    var o = stateToGame(st);
    o.x = {
      v: 2, a: {}, so: {}, ur: {}, q: {}, il: {}, ts: st.tree.socket || {}, ch: st.tree.choice || {},
      vw: st.vows || {}, cs: st.curses || {}, cfg: st.cfg || {}
    };
    for (var i = 0; i < P.slotList.length; i++) {
      var slot = P.slotList[i], it = st.gear[slot];
      if (!it || !it.b) continue;
      if (it.a && it.a.length) o.x.a[slot] = it.a;
      if (it.so && it.so.length) o.x.so[slot] = it.so;
      o.x.il[slot] = n(it.il) || 84;
      o.x.q[slot] = n(it.q) || 0;
      o.x.ur[slot] = it.ur === undefined ? 50 : n(it.ur);
    }
    return o;
  }

  function gameToState(obj) {
    var st = P.newState();
    st.title = obj.t || '构筑';
    st.cls = CLS[obj.c] ? obj.c : 'Warrior';
    st.level = clamp(n(obj.l) || 1, 1, 100);
    st._importWarnings = [];
    if (!CLS[obj.c]) st._importWarnings.push('未知职业，已回退为战士：' + obj.c);
    st.tree.alloc = {};
    (obj.p || []).forEach(function (id) {
      if (NODE[id]) st.tree.alloc[id] = 1;
      else st._importWarnings.push('未知天赋节点已跳过：' + id);
    });
    var skills = obj.s || [];
    var hot = (obj.h || []).filter(function (x) { return x && x !== 'move'; });
    var byId = {};
    skills.forEach(function (s) { if (s && s.k) byId[s.k] = s; });
    // 技能栏顺序：优先 h，再补 s 里未列出的
    var order = [];
    hot.forEach(function (k) {
      if (SK[k] && order.indexOf(k) < 0) order.push(k);
      else if (!SK[k]) st._importWarnings.push('未知技能已跳过：' + k);
    });
    skills.forEach(function (s) { if (s && SK[s.k] && order.indexOf(s.k) < 0) order.push(s.k); });
    st.vows = {}; st.curses = {};
    st.bar = [];
    order.forEach(function (k) {
      if (BL[k] && /^vow_/.test(k)) { st.vows[k] = 1; return; }
      if (CU[k]) { st.curses[k] = 1; return; }
      var s = byId[k] || { l: P.gemAt(st.level) };
      var sups = (s.u || []).filter(function (x) { return SUP[x]; });
      if ((s.u || []).length !== sups.length) st._importWarnings.push(P.T(SK[k].n) + '：有未知辅助被跳过');
      var sock = P.socketsAt(n(s.l) || 1);
      if (sups.length > sock) st._importWarnings.push(P.T(SK[k].n) + '：辅助数 ' + sups.length + ' 超过插槽 ' + sock);
      st.bar.push({ id: k, lv: clamp(n(s.l) || P.gemAt(st.level), 1, 40), sup: sups });
    });
    if (!st.bar.length) st.bar = [];
    var gear = P.emptyGear();
    (obj.g || []).forEach(function (g) {
      if (!g || !g.b) return;
      var slot = g.s;
      if (slot === 'Ring') slot = gear.Ring1.b ? 'Ring2' : 'Ring1';
      else if (slot === 'Idol') {
        slot = '';
        for (var iz = 1; iz <= 8; iz++) if (!gear['Idol' + iz].b) { slot = 'Idol' + iz; break; }
        if (!slot) { st._importWarnings.push('神像槽已满，跳过一件神像'); return; }
      }
      if (!gear[slot]) { st._importWarnings.push('未知装备槽位已跳过：' + g.s); return; }
      var it = gear[slot];
      it.b = g.b;
      it.r = g.r || 'Normal';
      if (g.u) { it.u = g.u; it.r = 'Unique'; }
      if (!BASES[it.b]) { st._importWarnings.push('未知底材已跳过：' + it.b); it.b = ''; }
      if (it.u && !UNI[it.u]) { st._importWarnings.push('未知传奇已跳过：' + it.u); it.u = ''; it.r = 'Rare'; }
    });
    st.gear = gear;
    st.dragon = { aspect: obj.da || '', nodes: {} };
    var dnSet = {};
    ((TR.dragon.classes || {})[st.cls] || []).forEach(function (x) { dnSet[x.i] = 1; });
    (obj.dn || []).forEach(function (id) {
      if (dnSet[id]) st.dragon.nodes[id] = 1;
      else st._importWarnings.push('未知龙裔节点已跳过：' + id);
    });
    if (st.dragon.aspect) {
      var okAspect = (TR.dragon.aspects || []).some(function (a) { return a.id === st.dragon.aspect; });
      if (!okAspect) { st._importWarnings.push('未知龙裔形态已清空：' + st.dragon.aspect); st.dragon.aspect = ''; }
    }
    // 本站扩展
    if (obj.x) {
      var x = obj.x;
      function xslot(k) { return k === 'Idol' ? 'Idol1' : k; }
      for (var slot2 in (x.a || {})) if (st.gear[xslot(slot2)]) st.gear[xslot(slot2)].a = (x.a[slot2] || []).filter(function (a) { return a && AFF[a.i]; });
      for (var slot3 in (x.so || {})) if (st.gear[xslot(slot3)]) st.gear[xslot(slot3)].so = (x.so[slot3] || []).filter(function (r) { return RUNE[r]; });
      for (var slot4 in (x.ur || {})) if (st.gear[xslot(slot4)]) st.gear[xslot(slot4)].ur = clamp(n(x.ur[slot4]), 0, 100);
      for (var slot5 in (x.q || {})) if (st.gear[xslot(slot5)]) st.gear[xslot(slot5)].q = clamp(n(x.q[slot5]), 0, n(K.qualityMax) || 20);
      for (var slot6 in (x.il || {})) if (st.gear[xslot(slot6)]) st.gear[xslot(slot6)].il = clamp(n(x.il[slot6]) || 84, 1, 100);
      st.tree.socket = x.ts || {};
      st.tree.choice = x.ch || {};
      st.vows = x.vw || {};
      st.curses = x.cs || {};
      if (x.cfg) st.cfg = Object.assign({}, st.cfg, x.cfg);
    }
    return st;
  }

  P.newState = function () {
    return {
      v: 2, title: '新构筑', cls: 'Warrior', level: 100,
      tree: { alloc: {}, choice: {}, socket: {} },
      dragon: { aspect: '', nodes: {} },
      gear: P.emptyGear(),
      bar: [{ id: 'ground_slam', lv: 20, sup: [] }],
      vows: {}, curses: {},
      cfg: { boss: 1, shock: 0, roll: 100, rl: 84, target: 'boss', gates: 6, pinnacle: 1 }
    };
  };

  P.newBuild = function (cls) {
    var st = P.newState();
    cls = cls || 'Warrior';
    st.cls = CLS[cls] ? cls : 'Warrior';
    var c = CLS[st.cls];
    if (c) {
      var wbase = null;
      if (c.start) {
        for (var i = 0; i < IT.bases.length; i++) {
          var b = IT.bases[i];
          if (b.wpn === c.start || b.id === c.start) { wbase = b; break; }
        }
      }
      if (!wbase) {
        for (var j = 0; j < IT.bases.length; j++) {
          var b2 = IT.bases[j];
          if (b2.slot !== 'MainHand' || !b2.dmg) continue;
          if ((c.weapons || []).length && (c.weapons || []).indexOf(b2.cls) < 0) continue;
          if (!wbase || b2.lvl < wbase.lvl) wbase = b2;
        }
      }
      if (wbase) st.gear.MainHand = { s: 'MainHand', b: wbase.id, r: 'Normal', a: [], u: '', so: [], il: 84, q: 0, f: 0, ur: 50 };
      var gs = (c.gems || []).filter(function (id) { return SK[id]; });
      var pick = null;
      for (var k = 0; k < gs.length; k++) {
        var sk = SK[gs[k]];
        var movement = (sk.tags || []).indexOf('Movement') >= 0;
        if (!movement && ((sk.smin !== null && sk.smin !== undefined) || (sk.tags || []).indexOf('Attack') >= 0)) { pick = sk; break; }
      }
      if (!pick && gs.length) pick = SK[gs[0]];
      if (pick) st.bar = [{ id: pick.id, lv: 20, sup: [] }];
    }
    st.dragon.aspect = (TR.dragon.classAspect || {})[st.cls] || '';
    return st;
  };

  P.encodeGame = function (st) {
    var json = JSON.stringify(stateToGame(st));
    var bytes = utf8(json);
    return zlibAsync(bytes, 'c').then(function (z) {
      var out = new Uint8Array(4 + z.length);
      var len = bytes.length;
      out[0] = len & 255; out[1] = (len >> 8) & 255; out[2] = (len >> 16) & 255; out[3] = (len >>> 24) & 255;
      out.set(z, 4);
      return 'BO1.' + b64u(out);
    });
  };
  P.encodeFull = function (st) {
    var json = JSON.stringify(stateToFull(st));
    var bytes = utf8(json);
    return zlibAsync(bytes, 'c').then(function (z) {
      var out = new Uint8Array(4 + z.length);
      var len = bytes.length;
      out[0] = len & 255; out[1] = (len >> 8) & 255; out[2] = (len >> 16) & 255; out[3] = (len >>> 24) & 255;
      out.set(z, 4);
      return 'BO2.' + b64u(out);
    });
  };

  P.decode = function (code) {
    code = String(code || '').trim().replace(/\s+/g, '');
    var m = code.match(/^(BO[12])\.([A-Za-z0-9_-]+)$/);
    if (!m) return Promise.reject(new Error('不是有效的构筑代码（应以 BO1. 或 BO2. 开头）'));
    var fmt = m[1];
    var body;
    try { body = unb64u(m[2]); } catch (e) { return Promise.reject(new Error('代码的 Base64 部分损坏')); }
    if (body.length < 6) return Promise.reject(new Error('代码太短'));
    var declared = body[0] | (body[1] << 8) | (body[2] << 16) | (body[3] << 24);
    var payload = body.subarray(4);
    if (!(payload[0] === 0x78)) return Promise.reject(new Error('代码的压缩头无效'));
    return zlibAsync(payload, 'd').then(function (raw) {
      var txt = fromUtf8(raw);
      var obj;
      try { obj = JSON.parse(txt); } catch (e) { return Promise.reject(new Error('代码内容不是有效 JSON')); }
      if (!obj || !obj.c) return Promise.reject(new Error('代码缺少职业信息'));
      return { format: fmt, obj: obj, declared: declared, actual: raw.length };
    });
  };

  P.stateFromCode = function (decoded) {
    var st = gameToState(decoded.obj);
    st._codeFormat = decoded.format;
    st._codeObj = decoded.obj;
    return st;
  };

  /** 导入报告：给界面显示「这次导入还原了什么、还缺什么」 */
  P.importReport = function (decoded, st) {
    var out = {
      format: decoded.format, title: st.title || '',
      cls: P.T((CLS[st.cls] || {}).n || st.cls), clsId: st.cls, level: st.level,
      skills: [], gear: [], lines: [], warnings: [], errors: [], dps: 0, bare: 0
    };
    for (var i = 0; i < (st.bar || []).length; i++) {
      var e = st.bar[i], sk = SK[e.id];
      if (!sk) continue;
      out.skills.push({
        name: P.T(sk.n), lv: e.lv,
        sup: (e.sup || []).map(function (x) { return P.T((SUP[x] || {}).n || x); })
      });
    }
    for (var s = 0; s < P.slotList.length; s++) {
      var slot = P.slotList[s], it = st.gear[slot];
      if (!it || !it.b) continue;
      var base = BASES[it.b], u = it.u && UNI[it.u] ? UNI[it.u] : null;
      var name = u ? P.T(u.n) : (base ? P.T(base.n) : it.b);
      var bare = it.r !== 'Normal' && it.r !== 'Unique' && !(it.a && it.a.length);
      if (bare) out.bare++;
      out.gear.push({ slot: P.slotZh[slot], name: name, rarity: P.rarityZh[it.r] || it.r, il: it.il, bare: bare });
    }
    var lineCount = 0;
    for (var lk in (st.tree.alloc || {})) if (st.tree.alloc[lk] && NODE[lk] && NODE[lk].k !== 'Start') lineCount++;
    out.lineCount = lineCount;
    out.dragonCount = Object.keys((st.dragon || {}).nodes || {}).length;
    out.aspect = st.dragon && st.dragon.aspect ? st.dragon.aspect : '';
    if (out.bare > 0) out.lines.push(out.bare + ' 件稀有/魔法装备只还原了底材：构筑代码不携带随机词缀的 roll，导入后需要在「装备」里补词缀（或改用 BO2 完整代码）。');
    if (decoded.format === 'BO1') out.lines.push('游戏代码（BO1）不含随机词缀、符文、誓约与计算设置；传奇的 roll 按区间中点还原。');
    var r;
    try { r = P.calc(st); out.dps = r.dps || 0; } catch (e) { out.errors.push('计算失败：' + e.message); }
    var v = P.validateBuild(st);
    out.errors = out.errors.concat(v.errors || []);
    out.warnings = (st._importWarnings || []).concat(v.warnings || []);
    if (r && r.skills && r.skills.length) {
      out.top = r.skills[0].id;
      out.topName = P.T(r.skills[0].sk.n);
      out.topDps = r.skills[0].totalDps;
    }
    return out;
  };

  // ================================================================ 校验 / 提示
  P.checkSupport = function (skillId, supId) {
    var sk = SK[skillId], s = SUP[supId];
    if (!sk || !s) return { ok: false, why: '未知技能或辅助' };
    if (s.req && s.req.length) {
      var ok = false;
      for (var i = 0; i < s.req.length; i++) if ((sk.tags || []).indexOf(s.req[i]) >= 0) { ok = true; break; }
      if (!ok) return { ok: false, why: '需要技能带有：' + s.req.map(tagZh).join(' / ') };
    }
    if (s.excl && s.excl.length) {
      var bad = s.excl.filter(function (t) { return (sk.tags || []).indexOf(t) >= 0; });
      if (bad.length) return { ok: false, why: '不可用于带 ' + bad.map(tagZh).join(' / ') + ' 的技能' };
    }
    if (sk.accepts && sk.accepts.length && s.id && sk.accepts.indexOf(s.id) >= 0) return { ok: true };
    return { ok: true };
  };

  P.itemWarnings = function (it) {
    var out = [];
    if (!it || !it.b) return out;
    var base = BASES[it.b];
    if (!base) return ['未知底材'];
    var bs = P.slotBase[it.s] || it.s;
    if (it.s && !baseFitsSlot(base, it.s)) out.push(P.T(base.n) + ' 不能装备在 ' + (P.slotZh[it.s] || it.s));
    var il = clamp(n(it.il) || 84, 1, 100);
    if (base.lvl > il) out.push('物品等级 ' + il + ' 低于底材需求 ' + base.lvl);
    var q = n(it.q) || 0;
    if (q < 0 || q > (n(K.qualityMax) || 20)) out.push('品质必须在 0–' + (n(K.qualityMax) || 20) + ' 之间');
    var caps = K.affixCap[it.r] || [0, 0];
    var pre = 0, suf = 0, grp = {};
    for (var i = 0; i < (it.a || []).length; i++) {
      var a = AFF[it.a[i].i];
      if (!a) { out.push('未知词缀：' + it.a[i].i); continue; }
      if (a.type === 'Prefix') pre++; else suf++;
      if (grp[a.grp]) out.push('词缀组重复：' + (a.grpZh || a.grp));
      grp[a.grp] = 1;
      if (!P.affixFits(a, base)) out.push((a.grpZh || a.grp) + '：底材不支持');
      var tier = a.tiers[it.a[i].t !== undefined ? it.a[i].t : 0];
      if (tier && (tier.i || 1) > il) out.push((a.grpZh || a.grp) + '：词缀阶需要 ilvl ' + tier.i);
    }
    if (it.r !== 'Unique') {
      if (pre > caps[0]) out.push('前缀超限：' + pre + ' / ' + caps[0]);
      if (suf > caps[1]) out.push('后缀超限：' + suf + ' / ' + caps[1]);
    } else if ((it.a || []).length) out.push('传奇物品没有随机词缀');
    if (it.r === 'Unique') {
      var u = it.u ? UNI[it.u] : null;
      if (!u) out.push('未选择传奇');
      else if (u.base !== it.b) out.push('该传奇不在 ' + P.T(base.n) + ' 上');
    }
    if ((it.so || []).length > (base.sock || 0)) out.push('孔位超限：最多 ' + (base.sock || 0) + ' 孔');
    for (var r = 0; r < (it.so || []).length; r++) if (it.so[r] && !RUNE[it.so[r]]) out.push('未知符文：' + it.so[r]);
    // 符文之语：孔满且顺序不符时提示可用组合
    if ((it.so || []).filter(Boolean).length === (base.sock || 0) && (base.sock || 0) > 0) {
      var okRw = false;
      for (var w = 0; w < IT.runewords.length; w++) {
        var rw = IT.runewords[w];
        if (rw.runes.length !== (base.sock || 0)) continue;
        if (rw.bases && rw.bases.length && !rw.bases.some(function (b) { return (base.tags || []).indexOf(b) >= 0; })) continue;
        var same = true;
        for (var k = 0; k < rw.runes.length; k++) if (rw.runes[k] !== it.so[k]) { same = false; break; }
        if (same) okRw = true;
      }
      if (!okRw) {
        var match = [];
        for (var w2 = 0; w2 < IT.runewords.length; w2++) {
          var rw2 = IT.runewords[w2];
          if (rw2.runes.length !== (base.sock || 0)) continue;
          if (rw2.bases && rw2.bases.length && !rw2.bases.some(function (b) { return (base.tags || []).indexOf(b) >= 0; })) continue;
          match.push(P.T(rw2.n));
        }
        if (match.length) out.push('孔位没有组成符文之语（可用：' + match.slice(0, 3).join(' / ') + (match.length > 3 ? ' …' : '') + '）');
      }
    }
    return out;
  };

  /** 整体构筑校验：返回 {errors, warnings}；errors 表示不可能/被游戏拒绝的配置 */
  P.validateBuild = function (st) {
    var errors = [], warnings = [];
    var all = collectAll(st);
    warnings = warnings.concat(all.warn);
    // 三件同名传奇？游戏允许同名不同部位；同名戒指也允许
    // 双手 + 副手（弓 + 箭袋是合法组合）
    var mh = st.gear.MainHand && st.gear.MainHand.b ? BASES[st.gear.MainHand.b] : null;
    var oh = st.gear.OffHand && st.gear.OffHand.b ? BASES[st.gear.OffHand.b] : null;
    if (mh && mh.twoh && oh) {
      var quiverOk = oh.cls === 'Quiver' && mh.cls === 'Bow';
      if (!quiverOk) warnings.push('双手武器占用副手：' + P.T(oh.n) + '（导入的旧代码可能带副手，游戏内不会生效）');
    }
    // 装备
    for (var i = 0; i < P.slotList.length; i++) {
      var slot = P.slotList[i];
      var it = st.gear[slot];
      if (!it || !it.b) continue;
      var w = P.itemWarnings(it);
      for (var j = 0; j < w.length; j++) {
        if (/超限|词缀组重复|不支持该词缀|不能装备|未知|传奇物品没有随机词缀|品质必须/.test(w[j])) errors.push(P.slotZh[slot] + '：' + w[j]);
        else warnings.push(P.slotZh[slot] + '：' + w[j]);
      }
    }
    // 天赋点/龙裔
    var budget = P.pointBudget(st.level || 1);
    if (all.treePoints > budget) errors.push('天赋点超出：' + all.treePoints + ' / ' + budget);
    var db = P.dragonBudget(st.level || 1, st);
    if (all.dragonPoints > db) errors.push('龙裔点超出：' + all.dragonPoints + ' / ' + db);
    // 技能/辅助
    var seen = {};
    for (var b = 0; b < (st.bar || []).length; b++) {
      var e = st.bar[b];
      if (!e || !e.id) continue;
      if (!SK[e.id]) { errors.push('未知技能：' + e.id); continue; }
      if (seen[e.id]) warnings.push('技能栏重复：' + P.T(SK[e.id].n));
      seen[e.id] = 1;
      var sock = P.socketsAt(e.lv || 1);
      if ((e.sup || []).length > sock) warnings.push(P.T(SK[e.id].n) + '：辅助数量超过插槽上限（' + (e.sup || []).length + ' / ' + sock + '）——导入的游戏代码可能带有旧版插槽');
      var seenSup = {};
      for (var s = 0; s < (e.sup || []).length; s++) {
        if (seenSup[e.sup[s]]) warnings.push(P.T(SK[e.id].n) + '：同一辅助重复（' + P.T((SUP[e.sup[s]] || {}).n || e.sup[s]) + '）');
        seenSup[e.sup[s]] = 1;
        var chk = P.checkSupport(e.id, e.sup[s]);
        if (!chk.ok) warnings.push(P.T(SK[e.id].n) + '：' + chk.why);
      }
    }
    // 诅咒：同一类（灾祸/判决/异常）只能有一个
    var ck = {};
    for (var ci2 = 0; ci2 < (all.curseList || []).length; ci2++) {
      var cc = all.curseList[ci2];
      var kind = cc.kind || '';
      if (kind === 'Woe' || kind === 'Sentence' || kind === 'Ailment') {
        if (ck[kind]) warnings.push('同一类诅咒只能有一个：' + P.T(cc.n));
        ck[kind] = 1;
      }
    }
    // 誓约保留
    var def = calcDefence(st, all, calcAttributes(st, all));
    var reserve = 0;
    for (var v = 0; v < (all.vowList || []).length; v++) {
      var bb = all.vowList[v];
      if (bb.resFlat) reserve += n(bb.resFlat) + n(bb.resFlatPer) * (P.gemAt(st.level || 1) - 1);
      if (bb.resPct) reserve += def.mana * n(bb.resPct) / 100;
    }
    if (reserve > def.mana) errors.push('誓约保留 ' + Math.round(reserve) + ' 超过魔力 ' + Math.round(def.mana));
    return { errors: errors, warnings: warnings };
  };

  P.version = 'planner-2';
})();
