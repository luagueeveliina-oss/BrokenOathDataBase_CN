/* ============================================================================
   Planner UI for the Broken Oath Builder damage engine.
   The engine and data are ported/adapted from the reference builder so DPS,
   passive tree and Dragonling rules match it; this file is the planner UI.
   ========================================================================== */
(function () {
  'use strict';
  const BO = window.BO, GD = window.BO_GD, SIM = window.BOSim, TI = window.TREE_ICONS, ZH = window.BO_ZH || {};
  const SKILL_ZH = { punch: '空手', slash: '斩击', strike: '劈砍', arcane_bolt: '奥术弹', zap: '电击', ground_slam: '震地', leap_slam: '跃击', ember_bolt: '余烬弹', frost_nova: '冰霜新星', arc: '电弧', move: '移动', wayward_orb: '游荡法球', thousand_sparks: '千火花' };
  if (!BO || !GD || !SIM) return;

  const lc = s => String(s == null ? '' : s).toLowerCase();
  const $ = id => document.getElementById(id);
  const esc = s => BO.esc(s);
  const num = (v, d) => BO.num ? BO.num(v, d) : (v == null ? '—' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d }));
  const big = v => (v > 0 ? Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0');
  const pct = v => (v == null || !isFinite(v) ? '—' : (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const n = v => Number(v) || 0;

  const NODE = GD.nodes, NODES = Object.values(NODE), BASE = GD.bases, UNI = GD.uniques, AFF = GD.affixes;
  const SK = GD.skills, SUP = GD.supports, CLASS = GD.classes, H = GD.scaling.Hero || {};
  const RULES = GD.dragon.tree || {};
  const MILESTONES = RULES.milestones || [40, 45, 50, 55, 60, 70, 80, 90];
  const ITEM_SLOTS = ['MainHand', 'OffHand', 'Helm', 'Chest', 'Gloves', 'Boots', 'Belt', 'Amulet', 'Ring1', 'Ring2'];
  // Body layout: head, neck, torso, arms, hands, waist and feet.
  const BODY_SLOTS = [
    { slot: 'Helm', area: 'head' }, { slot: 'Amulet', area: 'neck' },
    { slot: 'MainHand', area: 'arm-l' }, { slot: 'OffHand', area: 'arm-r' },
    { slot: 'Chest', area: 'torso' }, { slot: 'Gloves', area: 'hand-l' },
    { slot: 'Belt', area: 'waist' }, { slot: 'Ring1', area: 'ring-l' },
    { slot: 'Ring2', area: 'ring-r' }, { slot: 'Boots', area: 'feet' },
  ];
  const SLOT_LABEL = { MainHand: '主手', OffHand: '副手', Helm: '头盔', Chest: '胸甲', Gloves: '手套', Boots: '靴子', Belt: '腰带', Amulet: '项链', Ring1: '戒指 1', Ring2: '戒指 2', DwarvenRune: '矮人符文', Idol: '神像' };
  const PREFIX = 'bo_planner_ref';
  let S = null, R = null, DEF = null, RANK = [], GEAR_SEL = 'MainHand', PANE = 'overview', UNDO = [], TREE = null, DRAGON = null, MODAL = null;

  const zh = (m, id, fallback) => (m && m[lc(id)]) || fallback || id;
  const skillName = id => SKILL_ZH[lc(id)] || zh(ZH.skill, id, SK[lc(id)] ? SK[lc(id)].Name : id);
  const supportName = id => zh(ZH.support, id, SUP[lc(id)] ? SUP[lc(id)].Name : id);
  const baseName = id => zh(ZH.base, id, BASE[lc(id)] ? BASE[lc(id)].Name : id);
  const uniqueName = id => zh(ZH.unique, id, UNI[lc(id)] ? UNI[lc(id)].Name : id);
  const nodeName = nd => nd ? zh(ZH.node, nd.Id, nd.Name) : '';
  const dragonName = nd => nd ? zh(ZH.dragon, nd.Id, nd.Name) : '';
  const TYPE_ZH = { Physical: '物理', Fire: '火焰', Cold: '冰霜', Lightning: '闪电', Poison: '毒素' };
  const PATH_ZH = { Earthbreaker: '裂地者', Stormblade: '风暴之刃', Warlord: '战争领主', Stormcaller: '唤雷者', Pyromancer: '炎术士', Arcanist: '秘法学者', Stormwing: '风暴之翼', Skyhunter: '天猎者', Windrider: '御风者', Bladestorm: '刃暴', 'Iaido Master': '居合大师', Shadow: '暗影', Hammerbearer: '持锤者', Judge: '审判者', Oathguard: '誓卫', Legion: '军团', Plague: '瘟疫', Soulreaver: '噬魂者' };
  const pathName = p => PATH_ZH[p] || p || '';
  const ASPECT_ZH = { Fire: '火焰', Lightning: '雷电', Cold: '冰霜', Arcane: '奥术', Poison: '毒素', Physical: '钢铁' };
  const aspectName = id => ASPECT_ZH[id] || zh(ZH.aspect, id, id);
  function modText(m, v, v2) {
    if (!m) return '';
    const stat = m.Stat || m.s, mode = m.Mode || m.m, tags = m.Tags || m.t || [];
    const val = v != null ? v : (m.Value != null ? m.Value : (m.v || 0));
    const val2 = v2 != null ? v2 : (m.Value2 != null ? m.Value2 : (m.v2 || 0));
    const z = window.BO_MOD_ZH && window.BO_MOD_ZH.texts;
    if (z) {
      const shown = tags.filter(t => !/^[a-z]/.test(String(t)) && String(t).indexOf('=') < 0);
      const cands = [];
      for (const t of shown) cands.push(stat + '.' + mode + '+' + t);
      if (shown.length) cands.push(stat + '.' + mode + '+');
      cands.push(stat + '.' + mode);
      let tpl = null;
      for (const k of cands) if (z[k] && (z[k][0] || z[k][1])) { tpl = z[k]; break; }
      if (tpl) {
        const neg = Number(val) < 0;
        let out = (neg && tpl[1] ? tpl[1] : tpl[0]) || '';
        const fmt = x => Number.isInteger(+x) ? String(+x) : String(Math.round(+x * 100) / 100);
        const tagCn = shown.map(t => (window.BO_MOD_ZH.tags && window.BO_MOD_ZH.tags[t]) || t).join('、');
        out = out.replace(/\{(\w+)\}/g, (_, k) => {
          if (k === 'v') return fmt(val);
          if (k === 'abs') return fmt(Math.abs(val));
          if (k === 'v2') return fmt(val2);
          if (k === 'tags') return tagCn;
          if (k === 'tag0') return shown[0] ? (window.BO_MOD_ZH.tags && window.BO_MOD_ZH.tags[shown[0]]) || shown[0] : '';
          if (k === 'tag1') return shown[1] ? (window.BO_MOD_ZH.tags && window.BO_MOD_ZH.tags[shown[1]]) || shown[1] : '';
          if (k === 'skills') return tagCn;
          return '';
        }).replace(/\s{2,}/g, ' ').trim();
        if (out) return out;
      }
    }
    return SIM.modText(GD, { stat, mode, tags, v: val, v2: val2 });
  }
  const itemName = it => {
    if (!it) return '';
    if (it.rarity === 'Unique' && UNI[lc(it.unique)]) return uniqueName(it.unique);
    return it.name || baseName(it.base);
  };
  const classLabel = id => zh(ZH.class, id, CLASS[lc(id)] ? CLASS[lc(id)].Id : id);
  const isIdol = it => it && it.slot === 'Idol';
  function toast(msg, bad) {
    const el = $('rpToast'); if (!el) return;
    el.textContent = msg; el.className = 'toast on' + (bad ? ' bad' : '');
    clearTimeout(toast.t); toast.t = setTimeout(() => { el.className = 'toast' + (bad ? ' bad' : ''); }, 2600);
  }
  function attr(s) { return BO.attr ? BO.attr(s) : String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

  /* ------------------------------------------------------------------ state */
  function blankState(clazz, level) {
    return {
      id: 'plan:' + Date.now().toString(36), name: (classLabel(clazz || 'warrior')) + ' 计划', classId: lc(clazz || 'warrior'), level: clamp(n(level) || 100, 1, 100),
      league: '', lastZone: '', items: [], passives: [], bonusPoints: 0,
      gems: [], gemLevels: {}, sockets: [], hotbar: [], weaponId: '',
      dragonNodes: [], dragonAspect: '', dragonExtra: 0, mainSkill: '',
      enemy: { level: clamp(n(level) || 100, 1, 100), rarity: 'rare', element: '' },
      official: null, plan: true,
    };
  }
  function realNode(id) { return NODE[id] ? id : (GD.moved && GD.moved[id]) || id; }
  const MAX_PASSIVE_POINTS = 112, MAX_BONUS_POINTS = 13, MAX_DRAGON_POINTS = 13;
  const IDOL_W = 5, IDOL_H = 5;
  function idolSize(it) {
    const b = it && BASE[it.base];
    return { w: Math.max(1, Math.min(IDOL_W, n(b && b.Width) || 1)), h: Math.max(1, Math.min(IDOL_H, n(b && b.Height) || 1)) };
  }
  function idolBlocked(x, y) {
    if (x < 0 || y < 0 || x >= IDOL_W || y >= IDOL_H) return true;
    return (x === 0 || x === IDOL_W - 1) && (y === 0 || y === IDOL_H - 1);
  }
  function layoutIdols(items) {
    const idols = (items || []).filter(it => it && it.slot === 'Idol');
    let validMask = 0;
    for (let y = 0; y < IDOL_H; y++) for (let x = 0; x < IDOL_W; x++) if (!idolBlocked(x, y)) validMask |= 1 << (y * IDOL_W + x);
    function maskFor(x, y, w, h) {
      if (x < 0 || y < 0 || x + w > IDOL_W || y + h > IDOL_H) return 0;
      let m = 0;
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        const xx = x + dx, yy = y + dy;
        if (idolBlocked(xx, yy)) return 0;
        m |= 1 << (yy * IDOL_W + xx);
      }
      return (m & ~validMask) ? 0 : m;
    }
    let occ = 0;
    for (const it of idols) { const { w, h } = idolSize(it); it.gw = w; it.gh = h; it.gx = -1; it.gy = -1; }
    // Exact 5x5 packing (four corners unusable). Largest pieces first, with
    // backtracking so two 4x1 idols and a 2x2 can all fit in the 21 cells.
    const pending = idols.filter(it => it.gx < 0).sort((a, b) => {
      const A = idolSize(a), B = idolSize(b);
      return (B.w * B.h) - (A.w * A.h) || Math.max(B.w, B.h) - Math.max(A.w, A.h);
    });
    const seen = new Set();
    function solve(k, used) {
      if (k >= pending.length) return true;
      const key = k + ':' + used;
      if (seen.has(key)) return false;
      const it = pending[k], { w, h } = idolSize(it);
      for (let y = 0; y < IDOL_H; y++) for (let x = 0; x < IDOL_W; x++) {
        const m = maskFor(x, y, w, h);
        if (!m || (used & m)) continue;
        it.gx = x; it.gy = y;
        if (solve(k + 1, used | m)) return true;
      }
      it.gx = -1; it.gy = -1;
      seen.add(key);
      return false;
    }
    if (solve(0, occ)) return idols;
    // Saved positions can make the remaining set impossible even when the
    // whole collection fits. Re-pack everything from scratch (imports have no
    // meaningful positions anyway), then fall back to greedy if still needed.
    for (const it of idols) { it.gx = -1; it.gy = -1; }
    occ = 0;
    seen.clear();
    const all = idols.slice().sort((a, b) => {
      const A = idolSize(a), B = idolSize(b);
      return (B.w * B.h) - (A.w * A.h) || Math.max(B.w, B.h) - Math.max(A.w, A.h);
    });
    if (solve(0, 0)) return idols;
    for (const it of all) {
      const { w, h } = idolSize(it);
      let done = false;
      for (let y = 0; y < IDOL_H && !done; y++) for (let x = 0; x < IDOL_W && !done; x++) {
        const m = maskFor(x, y, w, h);
        if (m && !(occ & m)) { it.gx = x; it.gy = y; occ |= m; done = true; }
      }
      if (!done) { it.gx = -1; it.gy = -1; }
    }
    return idols;
  }

  function normAffix(a) {
    if (!a) return null;
    const id = lc(a.id || a.i || '');
    if (!id) return null;
    const af = AFF[id];
    if (!af) return { id, tier: clamp(n(a.tier != null ? a.tier : a.t), 0, 99), v: n(a.v != null ? a.v : a.value), v2: n(a.v2 != null ? a.v2 : a.value2), oath: !!(a.oath || a.bOath83), crafted: !!(a.crafted || a.bCrafted), unknown: true };
    let tier = clamp(n(a.tier != null ? a.tier : a.t), 0, (af.Tiers || []).length - 1);
    let v = a.v != null ? n(a.v) : null, v2 = a.v2 != null ? n(a.v2) : null;
    if (v == null) {
      const t = af.Tiers[tier] || {};
      let rr = a.r != null ? n(a.r) : 100;
      v = n(t.Min) + (n(t.Max) - n(t.Min)) * rr / 100;
      if (t.Min2 != null) v2 = n(t.Min2) + (n(t.Max2) - n(t.Min2)) * rr / 100;
    }
    return { id, tier, v: Math.round(v * 100) / 100, v2: v2 == null ? 0 : Math.round(v2 * 100) / 100, oath: !!(a.oath || a.bOath83), crafted: !!(a.crafted || a.bCrafted) };
  }
  function isTwoHandBase(baseId) {
    const b = BASE[lc(baseId)];
    return !!(b && (b.bTwoHanded || (b.Tags || []).includes('TwoHand') || b.Class === 'DualBlades'));
  }
  function mainIsTwoHand() { const m = (S.items || []).find(it => it.slot === 'MainHand'); return !!m && isTwoHandBase(m.base); }
  function normItem(raw) {
    if (!raw) return null;
    let slot = raw.slot || raw.s || '';
    if (slot === 'Ring') slot = 'Ring1';
    if (slot === 'Idol1' || slot === 'Idol2' || slot === 'Idol3' || slot === 'Idol4' || slot === 'Idol5' || slot === 'Idol6' || slot === 'Idol7' || slot === 'Idol8') slot = 'Idol';
    const it = {
      slot, base: lc(raw.base || raw.b || ''), rarity: raw.rarity || raw.r || 'Normal',
      unique: lc(raw.unique || raw.u || 'None'), name: raw.name || '', level: clamp(n(raw.level || raw.il) || 84, 1, 100),
      quality: clamp(n(raw.quality || raw.q) || 0, 0, 30), affixes: [], runes: (raw.runes || raw.so || []).map(lc).filter(r => GD.runes[r]),
      sockets: raw.sockets != null ? clamp(n(raw.sockets), 0, 6) : (raw.Sockets != null ? clamp(n(raw.Sockets), 0, 6) : undefined),
      gx: raw.gx != null ? n(raw.gx) : (raw.gridX != null ? n(raw.gridX) : (raw.GridX != null ? n(raw.GridX) : undefined)),
      gy: raw.gy != null ? n(raw.gy) : (raw.gridY != null ? n(raw.gridY) : (raw.GridY != null ? n(raw.GridY) : undefined)),
    };
    if (!BASE[it.base] && it.unique && UNI[it.unique] && UNI[it.unique].BaseId) it.base = lc(UNI[it.unique].BaseId);
    if (it.unique && it.unique !== 'none' && UNI[it.unique]) it.rarity = 'Unique';
    else it.unique = 'None';
    it.affixes = (raw.affixes || raw.a || []).map(normAffix).filter(Boolean);
    if (it.rarity === 'Unique' && UNI[it.unique]) ensureUniqueLines(it);
    return it;
  }
  function normalizeState(raw) {
    const st = blankState(raw && (raw.classId || raw.cls), raw && (raw.level || raw.l));
    if (!raw) return st;
    st.id = raw.id || st.id;
    st.name = raw.name || raw.title || raw.t || st.name;
    st.classId = CLASS[lc(raw.classId || raw.cls)] ? lc(raw.classId || raw.cls) : 'warrior';
    st.level = clamp(n(raw.level || raw.l) || 1, 1, 100);
    st.bonusPoints = Math.min(MAX_BONUS_POINTS, Math.max(0, n(raw.bonusPoints != null ? raw.bonusPoints : raw.bonus)));
    st.items = (raw.items || []).map(normItem).filter(Boolean);
    const seen = {};
    st.items = st.items.filter(it => {
      if (!it) return false;
      if (it.slot === 'Idol' || it.slot === 'DwarvenRune') return true;
      if (seen[it.slot]) return false;
      seen[it.slot] = 1; return true;
    }).slice(0, 60);
    if ((st.items || []).some(it => it.slot === 'MainHand' && isTwoHandBase(it.base)) && (st.items || []).some(it => it.slot === 'OffHand')) {
      st.items = st.items.filter(it => it.slot !== 'OffHand');
      st._importWarnings = (st._importWarnings || []).slice();
      st._importWarnings.push('主手是双手武器，副手装备已忽略。');
    }
    layoutIdols(st.items);
    st.passives = (raw.passives || raw.p || []).map(realNode).filter((id, i, a) => NODE[id] && a.indexOf(id) === i);
    normalizePassives(st);
    st.gems = (raw.gems || []).map(lc).filter(id => SK[id]);
    st.gemLevels = {};
    for (const [k, v] of Object.entries(raw.gemLevels || raw.gl || {})) if (SK[lc(k)]) st.gemLevels[lc(k)] = clamp(n(v) || 1, 1, 40);
    st.sockets = (raw.sockets || []).filter(x => x && SK[lc(x.skill)]).map(x => ({
      skill: lc(x.skill), supports: (x.supports || []).map(lc).filter(id => SUP[id]), conduit: lc(x.conduit || ''),
    }));
    st.hotbar = (raw.hotbar || raw.h || []).map(lc).filter(id => id && (SK[id] || id === 'move'));
    st.weaponId = raw.weaponId || '';
    st.dragonNodes = (raw.dragonNodes || raw.dn || []).map(String).filter(id => (GD.dragon.classes[st.classId] || {})[id]);
    st.dragonAspect = raw.dragonAspect || raw.da || '';
    st.dragonExtra = raw.dragonExtra != null ? clamp(n(raw.dragonExtra), 0, MAX_DRAGON_POINTS) : 0;
    const dbaseNow = MILESTONES.filter(l => st.level >= l).length + (RULES.hatch || 0);
    const maxDragonExtra = Math.max(0, MAX_DRAGON_POINTS - dbaseNow);
    if ((st.dragonNodes || []).length > dbaseNow + st.dragonExtra) st.dragonExtra = Math.min(maxDragonExtra, (st.dragonNodes || []).length - dbaseNow);
    st.dragonExtra = Math.min(maxDragonExtra, Math.max(0, st.dragonExtra));
    if ((st.dragonNodes || []).length > MAX_DRAGON_POINTS) {
      st._importWarnings = (st._importWarnings || []).slice();
      st._importWarnings.push('龙裔点超过上限 ' + MAX_DRAGON_POINTS + '，多余的 ' + ((st.dragonNodes || []).length - MAX_DRAGON_POINTS) + ' 点已忽略');
      st.dragonNodes = st.dragonNodes.slice(0, MAX_DRAGON_POINTS);
    }
    st.mainSkill = lc(raw.mainSkill || '');
    if (!SK[st.mainSkill]) {
      const first = st.sockets[0] ? st.sockets[0].skill : (st.hotbar.find(x => SK[x]) || '');
      st.mainSkill = SK[first] ? first : '';
    }
    st.enemy = Object.assign({ level: st.level, rarity: 'rare', element: '' }, raw.enemy || {});
    st.enemy.level = clamp(n(st.enemy.level) || st.level, 1, 100);
    st.official = raw.official || null;
    st.plan = true;
    return st;
  }
  function uniqueAffixes(u, roll) {
    roll = roll == null ? 0.5 : clamp(roll, 0, 1);
    const at = (lo, hi) => lo == null ? 0 : Math.round((lo + (hi - lo) * roll) * 100) / 100;
    return (u.Mods || []).map((m, i) => m.Mod ? { id: 'unique:' + i, tier: 0, v: at(m.Min, m.Max), v2: at(m.Min2, m.Max2) } : null).filter(Boolean);
  }
  function ensureUniqueLines(it) {
    const u = UNI[it.unique]; if (!u) return;
    const vows = (it.affixes || []).filter(a => !String(a.id).startsWith('unique:'));
    const have = (it.affixes || []).some(a => String(a.id).startsWith('unique:'));
    if (!have) it.affixes = uniqueAffixes(u, it.roll == null ? 0.5 : it.roll).concat(vows);
  }
  function setDragonExtraForImport(st) {
    const base = MILESTONES.filter(l => st.level >= l).length + (RULES.hatch || 0);
    st.dragonExtra = Math.min(Math.max(0, MAX_DRAGON_POINTS - base), Math.max(0, (st.dragonNodes || []).length - base));
  }

  /* --------------------------------------------------------------- adapters */
  function decodeBytes(b64, prefix) {
    let s = String(b64 || '').trim().replace(/\s+/g, '');
    if (prefix && s.startsWith(prefix)) s = s.slice(prefix.length);
    s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    const bin = atob(s), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function inflate(bytes) {
    if (typeof DecompressionStream === 'undefined') throw new Error('浏览器不支持解压构筑代码');
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'))).text();
  }
  async function deflate(text) {
    if (typeof CompressionStream === 'undefined') throw new Error('浏览器不支持压缩构筑代码');
    const z = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    let bin = ''; for (let i = 0; i < z.length; i++) bin += String.fromCharCode(z[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function decodeBO1(text) {
    const b = decodeBytes(text, 'BO1.');
    if (b.length < 8) throw new Error('构筑代码太短');
    return JSON.parse(await inflate(b.slice(4)));
  }
  async function decodePlan(text) {
    const b = decodeBytes(text, 'BOP1.');
    return JSON.parse(await inflate(b));
  }

  // Public API build -> reference character.
  function fromApi(payload, main) {
    const api = payload.api || payload;
    const b = api.build || api;
    const st = blankState(api.class || b.class || 'warrior', api.level || b.level || 1);
    st.name = (api.class ? classLabel(api.class) : '公开构筑') + ' · Lv ' + st.level;
    st.classId = CLASS[lc(api.class || b.class)] ? lc(api.class || b.class) : 'warrior';
    st.level = clamp(n(api.level || b.level) || 1, 1, 100);
    st.items = [];
    for (const it of b.items || []) {
      let slot = it.slot;
      if (slot === 'Idol') slot = 'Idol';
      let base = lc(it.base);
      if (!BASE[base] && it.unique && UNI[lc(it.unique)] && UNI[lc(it.unique)].BaseId) base = lc(UNI[lc(it.unique)].BaseId);
      const ni = { slot, base, rarity: it.rarity || 'Normal', unique: lc(it.unique || 'None'), name: '', level: clamp(n(it.item_level) || 84, 1, 100), quality: clamp(n(it.quality) || 0, 0, 30), sockets: it.sockets != null ? clamp(n(it.sockets), 0, 6) : undefined, affixes: [], runes: (it.runes || []).map(lc).filter(r => GD.runes[r]) };
      if (!BASE[ni.base]) continue;
      if (ni.unique && UNI[ni.unique]) { ni.rarity = 'Unique'; }
      const ulines = (it.affixes || []).filter(a => a && /^unique:\d+$/.test(String(a.id))).map(a => ({ id: String(a.id), tier: 0, v: n(a.value), v2: n(a.value2) }));
      ni.affixes = (it.affixes || []).filter(a => a && a.id && !String(a.id).startsWith('unique:')).map(a => {
        const id = lc(a.id).replace(/^riven95_/, '');
        const af = AFF[id]; if (!af) return null;
        let tier = 0, bd = 1e18;
        af.Tiers.forEach((t, i) => { const d = n(a.value) < t.Min ? t.Min - n(a.value) : n(a.value) > t.Max ? n(a.value) - t.Max : 0; if (d < bd) { bd = d; tier = i; } });
        return { id, tier, v: n(a.value), v2: n(a.value2), oath: !!a.oath, crafted: !!a.crafted };
      }).filter(Boolean);
      if (ni.unique && UNI[ni.unique]) ni.affixes = (ulines.length ? ulines : uniqueAffixes(UNI[ni.unique], 0.5)).concat(ni.affixes.filter(a => !String(a.id).startsWith('unique:')));
      st.items.push(ni);
    }
    st.passives = (b.passive_nodes || []).map(realNode).filter((id, i, a) => NODE[id] && a.indexOf(id) === i);
    st.bonusPoints = Math.max(0, n(b.bonus_passive_points));
    st.gemLevels = {}; for (const [k, v] of Object.entries(b.gem_levels || {})) if (SK[lc(k)]) st.gemLevels[lc(k)] = clamp(n(v) || 1, 1, 40);
    st.sockets = []; st.hotbar = (b.hotbar || []).map(lc).filter(id => id && (SK[id] || id === 'move'));
    for (const s of b.skills || []) {
      const id = lc(s.skill); if (!SK[id]) continue;
      st.sockets.push({ skill: id, supports: (s.supports || []).filter(x => x && x !== 'hidden').map(lc).filter(x => SUP[x]), conduit: '' });
      if (!st.gems.includes(id)) st.gems.push(id);
      if (!st.hotbar.includes(id)) st.hotbar.push(id);
    }
    st.dragonAspect = (b.ascendancy && b.ascendancy.aspect) || '';
    st.dragonNodes = ((b.ascendancy && b.ascendancy.nodes) || []).filter(id => (GD.dragon.classes[st.classId] || {})[id]);
    setDragonExtraForImport(st);
    st.mainSkill = lc(main || b.main_skill || (st.sockets[0] && st.sockets[0].skill) || '');
    st.enemy.level = st.level;
    st.enemy.rarity = 'boss';
    st.official = { dps: api.measured && api.measured.guardian_dps_median, window: api.measured && api.measured.window_days, source: 'api', hero: api.hero || '' };
    st.name = (st.official.dps ? 'API · ' : '') + (classLabel(st.classId)) + ' Lv ' + st.level;
    return normalizeState(st);
  }

  // Reference character from a save (uses the same extraction as the builder).
  function fromSaveProps(props) {
    const ch = SIM.extractCharacter({ props });
    const st = normalizeState(Object.assign({}, ch, { enemy: { level: ch.level, rarity: 'rare', element: '' } }));
    setDragonExtraForImport(st);
    return st;
  }

  // Minimal GVAS reader (same format as the game's BO_Char_*.sav).
  function readGVAS(buf) {
    class Rd {
      constructor(b) { this.v = new DataView(b); this.u = new Uint8Array(b); this.p = 0; }
      i32() { const x = this.v.getInt32(this.p, true); this.p += 4; return x; }
      u32() { const x = this.v.getUint32(this.p, true); this.p += 4; return x; }
      i64() { const x = this.v.getBigInt64(this.p, true); this.p += 8; return Number(x); }
      f32() { const x = this.v.getFloat32(this.p, true); this.p += 4; return x; }
      f64() { const x = this.v.getFloat64(this.p, true); this.p += 8; return x; }
      u8() { return this.u[this.p++]; }
      raw(n) { const x = this.u.subarray(this.p, this.p + n); this.p += n; return x; }
      fstr() { const n = this.i32(); if (n === 0) return ''; if (n < 0) { const b = this.raw(-n * 2); return new TextDecoder('utf-16le').decode(b.subarray(0, b.length - 2)); } const b = this.raw(n); let s = ''; for (let i = 0; i < b.length - 1; i++) s += String.fromCharCode(b[i]); return s; }
    }
    function rtype(r) { const name = r.fstr(), n = r.i32(), kids = []; for (let i = 0; i < n; i++) kids.push(rtype(r)); return [name, kids]; }
    const CORE = { DateTime: r => r.i64(), Timespan: r => r.i64(), Guid: r => Array.from(r.raw(16), b => b.toString(16).padStart(2, '0')).join(''), Vector: r => [r.f64(), r.f64(), r.f64()], Rotator: r => [r.f64(), r.f64(), r.f64()], LinearColor: r => [r.f32(), r.f32(), r.f32(), r.f32()], Color: r => Array.from(r.raw(4)), IntPoint: r => [r.i32(), r.i32()], Vector2D: r => [r.f64(), r.f64()], Quat: r => [r.f64(), r.f64(), r.f64(), r.f64()] };
    function structVal(r, s) { return CORE[s] ? CORE[s](r) : props(r); }
    function elem(r, t) {
      const n = t[0];
      if (n === 'IntProperty') return r.i32(); if (n === 'UInt32Property') return r.u32(); if (n === 'Int64Property') return r.i64();
      if (n === 'FloatProperty') return r.f32(); if (n === 'DoubleProperty') return r.f64();
      if (['NameProperty', 'StrProperty', 'EnumProperty', 'ObjectProperty', 'SoftObjectProperty'].includes(n)) { const v = r.fstr(); if (n === 'SoftObjectProperty') r.fstr(); return v; }
      if (n === 'BoolProperty') return !!r.u8();
      if (n === 'ByteProperty') return (t[1].length && t[1][0][0] !== 'None') ? r.fstr() : r.u8();
      if (n === 'StructProperty') return structVal(r, t[1].length ? t[1][0][0] : '');
      throw new Error('不支持的属性类型 ' + n);
    }
    function value(r, t, flags) {
      const n = t[0];
      if (n === 'BoolProperty') return !!(flags & 0x10);
      if (n === 'StructProperty') return structVal(r, t[1][0][0]);
      if (n === 'ArrayProperty') { const c = r.i32(), a = []; for (let i = 0; i < c; i++) a.push(elem(r, t[1][0])); return a; }
      if (n === 'SetProperty') { r.i32(); const c = r.i32(), a = []; for (let i = 0; i < c; i++) a.push(elem(r, t[1][0])); return a; }
      if (n === 'MapProperty') { r.i32(); const c = r.i32(), o = {}; for (let i = 0; i < c; i++) { const k = elem(r, t[1][0]), v = elem(r, t[1][1]); o[typeof k === 'object' ? JSON.stringify(k) : k] = v; } return o; }
      if (n === 'TextProperty') return null;
      return elem(r, t);
    }
    function props(r) {
      const out = {};
      for (;;) {
        const name = r.fstr(); if (name === 'None' || name === '') return out;
        const t = rtype(r), size = r.i32(), flags = r.u8();
        if (flags & 1) r.i32(); if (flags & 2) r.raw(16); if (flags & 4) { const ef = r.u8(); if (ef & 2) { r.u8(); r.raw(16); } }
        const start = r.p; let v = null;
        try { v = value(r, t, flags); } catch (e) { v = null; }
        r.p = t[0] === 'BoolProperty' ? start : start + size;
        if (name in out) { let k = 2; while ((name + '#' + k) in out) k++; name += '#' + k; }
        out[name] = v;
      }
    }
    const u = new Uint8Array(buf), sig = [14, 0, 0, 0].concat(Array.from('SchemaVersion', c => c.charCodeAt(0)));
    let at = -1;
    outer: for (let i = 0; i < u.length - sig.length; i++) {
      for (let j = 0; j < sig.length; j++) if (u[i + j] !== sig[j]) continue outer;
      at = i; break;
    }
    if (at < 0) throw new Error('不是《破誓》角色存档（找不到 SchemaVersion）');
    const r = new Rd(buf); r.p = at; const o = props(r);
    if (!o.Record || !o.Record.Summary) throw new Error('存档里没有角色记录；请选择 BO_Char_….sav');
    return o;
  }

  /* -------------------------------------------------------------- computing */
  function activeCurses() {
    const out = {};
    for (const c of Object.values(GD.curses || {})) out[c.Id] = { on: (S.hotbar || []).includes(c.Skill), dread: 0 };
    return out;
  }
  function opts(extra) {
    return Object.assign({
      enemyLevel: clamp(n(S.enemy && S.enemy.level) || S.level, 1, 100),
      enemyRarity: (S.enemy && S.enemy.rarity) || 'rare',
      guardianElement: (S.enemy && S.enemy.element) || undefined,
      curses: activeCurses(),
      enemyHallowedGround: (S.hotbar || []).includes('consecrated_ground'),
      charges: { insight: (S.hotbar || []).includes('death_sentence') ? 3 : 0 },
    }, extra || {});
  }
  function mainSkill() {
    if (SK[S.mainSkill]) return S.mainSkill;
    const first = (S.sockets[0] && S.sockets[0].skill) || (S.hotbar || []).find(id => SK[id]) || '';
    S.mainSkill = SK[first] ? first : '';
    return S.mainSkill;
  }
  function recalc() {
    try {
      const id = mainSkill();
      R = id ? SIM.calcSkill(GD, S, id, opts()) : null;
    } catch (e) {
      console.error(e); R = { error: e.message, notes: [], totalDps: 0, panelDps: 0 };
    }
    DEF = R && !R.error ? computeDefence(R) : null;
    rankSkills();
  }
  function rankSkills() {
    const seen = new Set(), out = [];
    const ids = skillRows().map(x => x.skill).concat(S.gems || []);
    for (const id of ids) {
      if (!id || seen.has(id) || !SK[id]) continue;
      seen.add(id);
      const rr = calcFor(S, id);
      if (rr && !rr.error && !rr.unsupported && isFinite(rr.totalDps) && rr.totalDps > 0) out.push({ id, rr });
    }
    out.sort((a, b) => b.rr.totalDps - a.rr.totalDps);
    RANK = out;
  }
  function bestSkill() { return RANK.length ? RANK[0] : null; }

  function computeDefence(R) {
    const mods = R.mods || [], attr = R.attr || {};
    const get = st => { try { return SIM.defenceTotal(GD, S, mods, attr, st); } catch (e) { return 0; } };
    const armour = get('Armour'), evasion = get('Evasion'), es = get('EnergyShield'), block = get('Block');
    const life = R.heroLife || SIM.heroMaxLife(GD, S, mods, attr);
    const mana = R.mana || {};
    const baseCap = n(H.ResistCap) || 75, hardCap = n(H.ResistHardCap) || 85;
    const res = { Fire: 0, Cold: 0, Lightning: 0, Poison: 0 }, maxRes = { Fire: baseCap, Cold: baseCap, Lightning: baseCap, Poison: baseCap };
    const addRes = (tags, v) => {
      const t = (tags || []).map(lc);
      if (t.includes('fire')) res.Fire += v;
      if (t.includes('cold')) res.Cold += v;
      if (t.includes('lightning')) res.Lightning += v;
      if (t.includes('poison')) res.Poison += v;
      if (t.includes('elemental')) { res.Fire += v; res.Cold += v; res.Lightning += v; }
    };
    const addMax = (tags, v) => {
      const t = (tags || []).map(lc);
      if (t.includes('fire')) maxRes.Fire += v;
      if (t.includes('cold')) maxRes.Cold += v;
      if (t.includes('lightning')) maxRes.Lightning += v;
      if (t.includes('poison')) maxRes.Poison += v;
      if (t.includes('elemental')) { maxRes.Fire += v; maxRes.Cold += v; maxRes.Lightning += v; }
    };
    let lifeRegenFlat = 0, lifeRegenPct = 0;
    for (const m of mods) {
      if (m.stat === 'Resist' && m.mode === 'Flat') addRes(m.tags, n(m.v) || 0);
      if (m.stat === 'MaxResist' && m.mode === 'Flat') addMax(m.tags, n(m.v) || 0);
      if (m.stat === 'LifeRegen') lifeRegenFlat += n(m.v) || 0;
      if (m.stat === 'LifeRegenPct') lifeRegenPct += n(m.v) || 0;
    }
    for (const k of Object.keys(maxRes)) maxRes[k] = Math.max(0, maxRes[k]);
    const af = n(H.ArmourFactor75) || n(H.ArmourFactor) || 5;
    const physRed = Math.max(0, Math.min(n(H.ArmourMaxReduction) || 80, 100 * armour / (armour + af * 1000)));
    const penalty = n(H.ResistPenaltyMax) || 50;
    return { armour, evasion, es, block, life, mana, res, maxRes, baseCap, hardCap, penalty, physRed,
      lifeRegen: lifeRegenFlat + life * lifeRegenPct / 100, lifeRegenFlat, lifeRegenPct,
      manaRegen: mana.regen || 0, esRecharge: n(H.EsRechargePct) || 0, esDelay: n(H.EsRechargeDelay) || 0 };
  }
  function renderDefence() {
    const d = DEF;
    if (!d) {
      ['defVitals', 'defResists', 'defMitigation', 'defRecovery'].forEach(id => { if ($(id)) $(id).innerHTML = '<div class="rp-hint">选择主技能后显示防御。</div>'; });
      return;
    }
    if ($('defVitals')) $('defVitals').innerHTML =
      statRow('生命', num(Math.round(d.life))) +
      statRow('魔力', d.mana && !d.mana.skip ? num(Math.round(d.mana.max)) + (d.mana.spend ? ' · 耗魔 ' + num(d.mana.spend, 1) + '/秒' : '') : '—') +
      statRow('能量护盾', num(Math.round(d.es))) +
      statRow('护甲', num(Math.round(d.armour))) +
      statRow('闪避', num(Math.round(d.evasion))) +
      statRow('格挡率', (d.block || 0).toFixed(1) + '%');
    if ($('defResists')) $('defResists').innerHTML = ['Fire', 'Cold', 'Lightning', 'Poison'].map((k, i) => {
      const name = ['火焰抗性', '冰霜抗性', '闪电抗性', '毒素抗性'][i];
      const eff = Math.min(d.res[k], d.maxRes[k], d.hardCap);
      const over = d.res[k] - d.maxRes[k];
      const late = Math.min(d.res[k] - d.penalty, d.maxRes[k], d.hardCap);
      return statRow(name, (d.res[k] > 0 ? '+' : '') + d.res[k].toFixed(0) + '% / 上限 ' + d.maxRes[k].toFixed(0) + '%' + (over > 0 ? ' · 溢出 ' + over.toFixed(0) + '%' : '') + ' · 当前有效 ' + eff.toFixed(0) + '% · 终局 -' + d.penalty + '% 后 ' + Math.max(0, late).toFixed(0) + '%');
    }).join('');
    if ($('defMitigation')) $('defMitigation').innerHTML =
      statRow('护甲', num(Math.round(d.armour))) +
      statRow('闪避', num(Math.round(d.evasion))) +
      statRow('能量护盾', num(Math.round(d.es))) +
      statRow('格挡', (d.block || 0).toFixed(1) + '%') +
      statRow('物理减伤（对 1,000 命中）', '~' + Math.max(0, d.physRed).toFixed(1) + '%') +
      statRow('物理减伤上限', (n(H.ArmourMaxReduction) || 80) + '%');
    if ($('defRecovery')) $('defRecovery').innerHTML =
      statRow('生命回复/秒', num(d.lifeRegen, 1) + (d.lifeRegenPct ? '（' + d.lifeRegenPct.toFixed(0) + '%/秒）' : '')) +
      statRow('魔力回复/秒', num(d.manaRegen, 1)) +
      statRow('护盾回复', d.esRecharge ? d.esRecharge + '%/秒 · ' + d.esDelay + ' 秒后' : '—') +
      statRow('生命', num(Math.round(d.life)));
  }
  function calcFor(ch, skillId) {
    try { return SIM.calcSkill(GD, ch, skillId, opts()); } catch (e) { return null; }
  }
  function pointsBudget() {
    const per = n(H.PassivePointsPerLevel) || 1;
    return Math.min(MAX_PASSIVE_POINTS, Math.max(0, Math.round((S.level - 1) * per + (S.bonusPoints || 0))));
  }
  function pointsUsed() { return (S.passives || []).filter(id => NODE[id] && NODE[id].Kind !== 'Start').length; }

  /* ------------------------------------------------------------------ shell */
  function setPane(p) {
    PANE = p;
    document.querySelectorAll('#rpNav [data-pane]').forEach(b => b.classList.toggle('on', b.dataset.pane === p));
    document.querySelectorAll('.rp-pane').forEach(el => el.classList.toggle('on', el.id === 'pane-' + p));
    if (p === 'idols' || p === 'gear') renderGear();
    if (p === 'defence') renderDefence();
    if (p === 'tree') { buildTreeIfNeeded(); paintTree(); }
    if (p === 'dragon') renderDragon();
  }
  function modal(html, onOpen) {
    const root = $('rpModalRoot');
    root.innerHTML = '<div class="rp-modal-layer"><div class="rp-modal" role="dialog" aria-modal="true">' + html + '</div></div>';
    MODAL = root.querySelector('.rp-modal');
    root.querySelector('.rp-modal-layer').addEventListener('click', e => { if (e.target.classList.contains('rp-modal-layer')) closeModal(); });
    root.querySelectorAll('[data-close]').forEach(b => b.onclick = closeModal);
    if (onOpen) onOpen(MODAL);
    return MODAL;
  }
  function modalHead(title) { return '<div class="rp-modal-head"><h3>' + esc(title) + '</h3><button class="rp-x" type="button" data-close>×</button></div>'; }
  function closeModal() { const r = $('rpModalRoot'); if (r) r.innerHTML = ''; MODAL = null; }
  function setPaneFromHash() {}

  /* ----------------------------------------------------------------- status */
  function renderStatus() {
    const name = S.name || (classLabel(S.classId) + ' 计划');
    $('stName').textContent = name;
    $('stWho').textContent = classLabel(S.classId) + ' · ' + S.level;
    const best = bestSkill();
    $('stDps').textContent = best ? big(best.rr.totalDps) : (R && !R.error && isFinite(R.totalDps) ? big(R.totalDps) : '—');
    $('stPanel').textContent = best && isFinite(best.rr.panelDps) ? big(best.rr.panelDps) : (R && isFinite(R.panelDps) ? big(R.panelDps) : '—');
    if ($('stBestIcon')) $('stBestIcon').innerHTML = best ? skillIcon(best.id, true) : '';
    if ($('stBestSkill')) $('stBestSkill').textContent = best ? skillName(best.id) : '没有可用伤害技能';
    let life = '—', mana = '—';
    try { life = big(SIM.heroMaxLife(GD, S, R ? R.mods : [], R ? R.attr : {})); } catch (e) {}
    if (R && R.mana && !R.mana.skip) mana = big(R.mana.max);
    $('stLife').textContent = life;
    $('stEs').textContent = '魔力 ' + mana + (R && R.mana && !R.mana.skip && R.mana.spend ? ' · 耗魔 ' + num(R.mana.spend, 1) + '/秒' : '');
    if (R && R.attr) $('stAttr').textContent = [R.attr.Str, R.attr.Dex, R.attr.Int].join(' / ');
    $('rpName').value = S.name || '';
    $('rpClass').value = S.classId;
    $('rpLevel').value = S.level;
    if ($('rpTarget')) $('rpTarget').value = (S.enemy && S.enemy.rarity) || 'boss';
    $('rpPoints').textContent = '天赋点 ' + pointsUsed() + ' / ' + pointsBudget() + ' · 龙裔 ' + (S.dragonNodes || []).length + ' / ' + dragonPoints();
    $('rpData').innerHTML = '伤害模型：Broken Oath Builder<br>游戏数据：<b>' + esc(GD.filesAt ? String(GD.filesAt).slice(0, 10) : '本地') + '</b> · 被动树 v' + esc(GD.treeVersion) + '<br>' + Object.keys(SK).length + ' 技能 · ' + NODES.length + ' 天赋节点';
  }

  /* ---------------------------------------------------------------- overview */
  function slotItem(slot) { return (S.items || []).find(it => it.slot === slot) || null; }
  function runeMaxForBase(b) {
    if (!b) return 0;
    const R = GD.runeSockets || {}, tags = (b.Tags || []).map(lc);
    const keys = Object.keys(R).filter(k => tags.includes(lc(k)) || lc(b.Slot) === lc(k));
    return keys.length ? Math.max(...keys.map(k => n(R[k]) || 0)) : 0;
  }
  function affixKind(a, it) {
    if (!a) return { label: '词缀', cls: '' };
    if (String(a.id).startsWith('unique:')) return { label: '传奇', cls: 'unique' };
    if (it && it.rarity === 'Unique') return { label: '誓语', cls: 'vow' };
    if (a.oath) return { label: '誓语', cls: 'oath' };
    if (a.crafted) return { label: '工艺', cls: 'crafted' };
    const af = AFF[a.id];
    if (af && af.Type === 'Prefix') return { label: '前缀', cls: 'prefix' };
    if (af && af.Type === 'Suffix') return { label: '后缀', cls: 'suffix' };
    return { label: '词缀', cls: '' };
  }
  function oathwordForItem(it) {
    if (!it || !(it.runes || []).length) return null;
    const b = BASE[it.base]; if (!b) return null;
    const runes = (it.runes || []).map(lc), tags = (b.Tags || []).map(lc);
    return (GD.runewords || []).find(w => (w.Runes || []).map(lc).join(',') === runes.join(',') &&
      (w.Bases || []).some(x => lc(x) === lc(b.Id) || lc(x) === lc(b.Class) || tags.includes(lc(x)))) || null;
  }
  function itemModLines(it, max) {
    if (!it) return [];
    const out = [];
    const b = BASE[it.base];
    if (b) for (const m of b.Implicits || []) if (out.length < (max || 3)) out.push('固有 · ' + modText(m));
    for (const a of it.affixes || []) {
      if (out.length >= (max || 4)) break;
      if (String(a.id).startsWith('unique:')) {
        const u = UNI[it.unique], um = u && u.Mods[+a.id.slice(7)];
        if (um) out.push('传奇 · ' + SIM.modText(GD, { stat: um.Mod.Stat, mode: um.Mod.Mode, tags: um.Mod.Tags || [], v: a.v, v2: a.v2 }));
      } else {
        const af = AFF[a.id];
        const k = affixKind(a, it);
        if (af) out.push(k.label + ' · ' + SIM.modText(GD, { stat: af.Mod.Stat, mode: af.Mod.Mode, tags: af.Mod.Tags || [], v: a.v, v2: a.v2 }));
        else out.push(k.label + ' · 未收录 ' + a.id + (a.v != null ? '：' + num(a.v) : ''));
      }
    }
    return out.filter(Boolean);
  }
  function itemIcon(it, big) {
    if (!it || !window.BO_ICONS) return '';
    const key = it.rarity === 'Unique' && it.unique && it.unique !== 'None' ? 'u:' + it.unique : 'b:' + it.base;
    const src = window.BO_ICONS[key] || window.BO_ICONS['b:' + it.base];
    if (!src) return '';
    const w = big ? 72 : 24, h = big ? 84 : 28;
    return '<span class="ico ico-img" style="--ico:#d8c9a8;width:' + w + 'px;height:' + h + 'px"><img src="' + attr(src) + '" alt=""></span>';
  }
  function slotHtml(it, slot, compact) {
    const label = SLOT_LABEL[slot] || slot;
    if (!it) return '<button type="button" class="rp-slot empty" data-edit-slot="' + esc(slot) + '"><span class="rp-slot-label">' + esc(label) + '</span><b>空</b><small>点击选择</small></button>';
    const nm = itemName(it), base = BASE[it.base];
    const lines = itemModLines(it, compact ? 1 : 99);
    const ic = itemIcon(it);
    return '<button type="button" class="rp-slot ' + (compact ? 'compact ' : 'full ') + (ic ? 'icon-slot ' : '') + (it.rarity === 'Unique' ? 'unique' : it.rarity === 'Rare' ? 'rare' : '') + '" data-edit-slot="' + esc(slot) + '">' + ic +
      '<span class="rp-slot-label">' + esc(label) + '</span><b>' + esc(nm) + '</b><small>' + esc(base ? base.Name : it.base) + (it.level ? ' · ilvl ' + it.level : '') + (it.sockets != null ? ' · ' + it.sockets + ' 孔' : '') + '</small>' +
      (lines.length ? '<span class="rp-slot-mods">' + lines.slice(0, compact ? 1 : 99).map(esc).join('<br>') + '</span>' : '') + '</button>';
  }
  function renderOverview() {
    const best = bestSkill();
    if ($('ovBest')) {
      $('ovBest').innerHTML = best ? '<div class="rp-hero-skill">' + skillIcon(best.id, true) + '<div><span class="rp-kicker">TOP SKILL</span><b>' + esc(skillName(best.id)) + '</b><small>' + esc((SK[best.id] || {}).Kind || '') + ' · Lv ' + (S.gemLevels[best.id] || 20) + ' · ' + ((S.sockets.find(x => x.skill === best.id) || {}).supports || []).length + ' 辅助</small></div></div>' +
        '<div class="rp-hero-dps"><span>最高技能 DPS</span><b>' + big(best.rr.totalDps) + '</b><small>Boss 模型</small></div>' +
        '<div class="rp-hero-actions"><button class="rp-btn small" data-use-best>设为当前主技能</button><span class="rp-link" data-go="skills">技能详情 →</span></div>' :
        '<div class="rp-hint">还没有可计算的伤害技能。</div>';
    }
    if ($('ovSkillRank')) {
      const rankRows = RANK.slice(0, 6).map((x, i) => '<button type="button" class="rp-rank-row' + (S.mainSkill === x.id ? ' on' : '') + '" data-rank-main="' + attr(x.id) + '"><span class="rp-rank-n">' + (i + 1) + '</span>' + skillIcon(x.id) + '<span class="rp-rank-name"><b>' + esc(skillName(x.id)) + '</b><small>' + esc((SK[x.id] || {}).Kind || '') + '</small></span><span class="rp-rank-dps">' + big(x.rr.totalDps) + '<small>' + (x.rr.panelDps ? '面板 ' + big(x.rr.panelDps) : '') + '</small></span></button>').join('');
      $('ovSkillRank').innerHTML = rankRows || '<div class="rp-hint">没有可比较的技能。</div>';
    }

    const off = S.official && S.official.dps;
    const offEl = $('ovOfficial');
    if (offEl) {
      offEl.hidden = !off;
      offEl.innerHTML = off ? '<span>公开 API · 游戏实测中位 DPS（守护者）</span><b>' + big(off) + '</b><span>来自守护者实战，不是本页 Boss DPS；两种口径不同。</span>' : '';
    }
    $('ovGear').innerHTML = ITEM_SLOTS.map(sl => slotHtml(slotItem(sl), sl, true)).join('');
    $('ovIdols').innerHTML = S.items.some(it => it.slot === 'Idol') ? idolBoardHtml(true) : '<div class="rp-hint">还没有神像。</div>';
    if ($('ovDefence')) $('ovDefence').innerHTML = DEF ? statRow('生命', num(Math.round(DEF.life))) + statRow('护甲', num(Math.round(DEF.armour))) + statRow('闪避', num(Math.round(DEF.evasion))) + statRow('火焰 / 冰霜 / 闪电 / 毒素抗性', [DEF.res.Fire, DEF.res.Cold, DEF.res.Lightning, DEF.res.Poison].map(x => (x > 0 ? '+' : '') + Math.round(x) + '%').join(' / ')) + statRow('格挡', (DEF.block || 0).toFixed(1) + '%') : '<div class="rp-hint">选择主技能后显示防御。</div>';
    const rows = skillRows();
    $('ovSkills').innerHTML = rows.length ? rows.map(x => {
      const sk = SK[x.skill], rr = calcFor(S, x.skill);
      return '<div class="rp-ov-skill"><b>' + esc(skillName(x.skill)) + '</b><span>' + (x.supports.length ? x.supports.length + ' 辅助' : '无辅助') + '</span><em>' + (rr && !rr.error ? big(rr.totalDps) : '—') + '</em></div>';
    }).join('') : '<div class="rp-hint">还没有技能。去技能页添加。</div>';
    const notables = S.passives.map(id => NODE[id]).filter(nd => nd && ['Notable', 'Keystone', 'Choice', 'Capstone'].includes(nd.Kind));
    $('ovTreeN').textContent = pointsUsed() + ' 点 · ' + notables.length + ' 个显著/基石';
    $('ovTree').innerHTML = notables.length ? notables.slice(0, 12).map(nd => '<div class="rp-node-line"><b>' + esc(nodeName(nd)) + '</b><span>' + esc(nd.Kind) + '</span></div>').join('') : '<div class="rp-hint">还没有点天赋。</div>';
    const dcls = GD.dragon.classes[S.classId] || {};
    $('ovDragonN').textContent = (S.dragonNodes || []).length + ' 点 · ' + (S.dragonAspect || '无形态');
    $('ovDragon').innerHTML = (S.dragonNodes || []).length ? S.dragonNodes.map(id => dcls[id]).filter(Boolean).slice(0, 10).map(nd => '<div class="rp-node-line"><b>' + esc(dragonName(nd)) + '</b><span>' + esc(pathName(nd.Path) || nd.Kind) + '</span></div>').join('') : '<div class="rp-hint">还没有点龙裔。</div>';
    const warns = [];
    if (R && R.error) warns.push('计算：' + R.error);
    if (R && R.unsupported) warns.push('计算：' + R.unsupported);
    if (R && R.notes) warns.push(...R.notes.filter(x => /Unknown|not in current|over|no damage|missing/i.test(x)).slice(0, 4));
    if (pointsUsed() > pointsBudget()) warns.push('天赋点超出：用了 ' + pointsUsed() + '，可用 ' + pointsBudget());
    if ((S.dragonNodes || []).length > dragonPoints()) warns.push('龙裔点超出：用了 ' + (S.dragonNodes || []).length + '，可用 ' + dragonPoints());
    if (R && R.mana && !R.mana.skip && !R.mana.ok) warns.push('魔力无法持续：约 ' + (isFinite(R.mana.lasts) ? R.mana.lasts.toFixed(0) + ' 秒' : '不足'));
    if (S.official && S.official.dps) warns.push('游戏实测中位 DPS：' + big(S.official.dps) + '（与面板/对敌模型不是同一口径）');
    $('ovWarnN').textContent = warns.length ? warns.length + ' 条' : '';
    $('ovWarn').innerHTML = warns.length ? warns.map(w => '<p>' + esc(w) + '</p>').join('') : '<p class="ok">没有发现明显冲突。</p>';
  }

  /* ---------------------------------------------------------------- skills */
  function skillRows() {
    const out = [];
    for (const s of S.sockets || []) if (s.skill && !out.some(x => x.skill === s.skill)) out.push({ skill: s.skill, supports: s.supports || [], socket: s });
    for (const id of S.hotbar || []) if (id && id !== 'move' && SK[id] && !out.some(x => x.skill === id)) out.push({ skill: id, supports: [], socket: null });
    return out;
  }
  function skillIcon(id, big) {
    const key = 'sk:' + lc(id), w = big ? 58 : 28, h = big ? 66 : 32;
    if (window.BO_ICONS && window.BO_ICONS[key]) return '<span class="ico ico-img" style="--ico:#1ba29b;width:' + w + 'px;height:' + h + 'px"><img src="' + attr(window.BO_ICONS[key]) + '" alt=""></span>';
    return '<span class="ico" style="--ico:#1ba29b;width:' + w + 'px;height:' + h + 'px"><svg viewBox="0 0 24 24"><path d="M12 2 4 13h7l-1 9 9-12h-7z"/></svg></span>';
  }
  function renderSkills() {
    const rows = skillRows();
    $('rpSkills').innerHTML = rows.length ? rows.map((x, i) => {
      const sk = SK[x.skill], rr = calcFor(S, x.skill);
      const sups = (x.supports || []).map(id => '<button type="button" class="rp-sup on" data-rem-sup="' + i + ':' + esc(id) + '">' + esc(supportName(id)) + '</button>').join('');
      const max = socketsFor(x.skill);
      return '<div class="rp-skill ' + (S.mainSkill === x.skill ? 'main' : '') + '">' +
        '<div class="rp-skill-head">' + skillIcon(x.skill) +
        '<div class="rp-skill-name"><b>' + esc(skillName(x.skill)) + '</b><small>' + esc(sk && sk.Kind || '') + ' · ' + (x.supports || []).length + '/' + max + ' 辅助</small></div>' +
        '<div class="rp-skill-dps">' + (rr && !rr.error && !rr.unsupported ? big(rr.totalDps) : '—') + '<small>' + (rr && rr.mana && !rr.mana.skip ? num(rr.mana.spend, 1) + ' 魔/秒' : '') + '</small></div>' +
        '<label class="rp-mini">Lv <input class="rp-input" type="number" min="1" max="40" value="' + (S.gemLevels[x.skill] || 20) + '" data-gem="' + i + '"></label>' +
        '<button type="button" class="rp-skill-x" data-main="' + i + '" title="设为主技能">★</button>' +
        '<button type="button" class="rp-skill-x" data-rem-skill="' + i + '">×</button></div>' +
        '<div class="rp-sups">' + sups + '<button type="button" class="rp-sup add" data-add-sup="' + i + '">+ 辅助</button><button type="button" class="rp-sup ' + ((S.hotbar || []).includes(x.skill) ? 'on' : '') + '" data-hotbar="' + i + '">快捷栏</button></div>' +
        '<div class="rp-skill-foot"><span>' + (rr && rr.speed ? num(rr.speed.usesPerSec, 2) + ' 次/秒 · 命中 ' + num(rr.hitAvg) : '') + '</span><span>' + (rr && rr.panelDps ? '面板 ' + big(rr.panelDps) : '') + '</span></div></div>';
    }).join('') : '<div class="rp-hint">还没有技能。点右上角添加。</div>';
  }
  function socketsFor(id) {
    try { return SIM.socketsFor(GD, S, id, S.gemLevels[id] || 20); } catch (e) { return 3; }
  }
  function addSkill(id) {
    id = lc(id); if (!SK[id]) return;
    if (!S.gems.includes(id)) S.gems.push(id);
    if (!S.sockets.some(x => x.skill === id)) S.sockets.push({ skill: id, supports: [], conduit: '' });
    if (!S.hotbar.includes(id)) S.hotbar.push(id);
    if (!S.gemLevels[id]) S.gemLevels[id] = Math.min(20, Math.max(1, S.level));
    if (!S.mainSkill) S.mainSkill = id;
    done();
  }
  function openSkillPicker() {
    let q = '';
    const draw = () => {
      const list = Object.values(SK).filter(sk => sk.Kind === 'Gem' || (sk.Tags || []).includes('Attack')).filter(sk => !q || lc(sk.Name).includes(q) || lc(sk.Id).includes(q)).sort((a, b) => a.Name.localeCompare(b.Name)).slice(0, 300);
      modal(modalHead('添加技能') + '<div class="rp-modal-body"><input class="rp-input" id="rpSkillQ" style="width:100%;margin-bottom:8px" placeholder="搜索技能…" value="' + attr(q) + '"><div class="rp-list">' +
        list.map(sk => '<button type="button" class="rp-option" data-pick-skill="' + attr(sk.Id) + '"><b>' + esc(sk.Name) + '</b><small>' + esc((sk.Tags || []).join(' · ')) + '</small></button>').join('') + '</div></div><div class="rp-modal-foot"><button class="rp-btn" type="button" data-close>取消</button></div>', r => {
        r.querySelector('#rpSkillQ').oninput = e => { q = lc(e.target.value); draw(); };
        r.querySelectorAll('[data-pick-skill]').forEach(b => b.onclick = () => { addSkill(b.dataset.pickSkill); closeModal(); });
      });
    };
    draw();
  }
  function openSupportPicker(idx) {
    const x = skillRows()[idx]; if (!x) return;
    const max = socketsFor(x.skill);
    let q = '';
    const draw = () => {
      const choices = SIM.supportChoices(GD, S, x.skill, { conduit: x.socket && x.socket.conduit }) || [];
      const list = choices.filter(c => !q || lc(c.name).includes(q)).sort((a, b) => a.name.localeCompare(b.name));
      modal(modalHead('辅助 · ' + skillName(x.skill)) + '<div class="rp-modal-body"><div class="rp-hint">' + (x.supports || []).length + ' / ' + max + ' 个辅助插槽</div><input class="rp-input" id="rpSupQ" style="width:100%;margin:7px 0" placeholder="搜索辅助…" value="' + attr(q) + '"><div class="rp-list">' +
        list.map(c => { const on = x.supports.includes(c.id); return '<button type="button" class="rp-option ' + (on ? 'on' : '') + '" data-toggle-sup="' + attr(c.id) + '"><b>' + esc(c.name) + '</b><small>' + (on ? '已装' : c.packOnly ? '群体' : '') + '</small></button>'; }).join('') + '</div></div><div class="rp-modal-foot"><button class="rp-btn" type="button" data-close>完成</button></div>', r => {
        r.querySelector('#rpSupQ').oninput = e => { q = lc(e.target.value); draw(); };
        r.querySelectorAll('[data-toggle-sup]').forEach(b => b.onclick = () => {
          const id = b.dataset.toggleSup, i = x.supports.indexOf(id);
          if (i >= 0) x.supports.splice(i, 1);
          else if (x.supports.length < max) x.supports.push(id);
          else return toast('辅助插槽已满：' + max, true);
          done();
          draw();
        });
      });
    };
    draw();
  }

  /* ---------------------------------------------------------------- gear UI */
  function slotsForBase(base) {
    const out = new Set([base.Slot]);
    for (const t of base.Tags || []) out.add(t);
    out.add(base.Class);
    return out;
  }
  function affixFits(af, base) {
    if (!af || !base) return false;
    const tags = new Set([...(base.Tags || []), base.Slot, base.Class].map(lc));
    const on = (af.BaseTags || []).map(lc);
    const no = (af.ExcludeTags || []).map(lc);
    if (no.some(t => tags.has(t))) return false;
    return !on.length || on.some(t => tags.has(t));
  }
  function baseChoices(slot) {
    const want = slot === 'Ring1' || slot === 'Ring2' ? 'Ring' : slot === 'Idol' ? 'Idol' : slot;
    return Object.values(BASE).filter(b => b.Slot === want);
  }
  function uniqueChoices(slot) {
    return Object.values(UNI).filter(u => { const b = BASE[lc(u.BaseId)]; return b && (b.Slot === (slot === 'Ring1' || slot === 'Ring2' ? 'Ring' : slot)); });
  }
  function currentItemIndex(slot, idx) {
    if (idx != null) return +idx;
    return S.items.findIndex(it => it.slot === slot);
  }
  function renderGear() {
    $('rpDoll').innerHTML = BODY_SLOTS.map(x => {
      if (x.slot === 'OffHand' && mainIsTwoHand()) return '<div class="rp-body-cell ' + x.area + '"><div class="rp-slot empty locked"><span class="rp-slot-label">副手</span><b>双手武器</b><small>已占用</small></div></div>';
      return '<div class="rp-body-cell ' + x.area + '">' + slotHtml(slotItem(x.slot), x.slot, true) + '</div>';
    }).join('');
    renderGearDetail();
    const runes = S.items.map((it, i) => ({ it, i })).filter(x => x.it.slot === 'DwarvenRune');
    if ($('rpRunes')) $('rpRunes').innerHTML = runes.length ? runes.map(x => slotHtml(x.it, 'DwarvenRune', false).replace('data-edit-slot="DwarvenRune"', 'data-edit-rune="' + x.i + '"')).join('') : '<div class="rp-hint">还没有矮人符文。矮人符文只放在天赋树的矮人符文孔中。</div>';
    if ($('rpRuneInfo')) {
      const sockets = (S.passives || []).filter(id => NODE[id] && NODE[id].Kind === 'Socket').length;
      $('rpRuneInfo').textContent = '天赋树矮人符文孔 ' + sockets + ' / 9 · 已镶嵌 ' + runes.length + ' 个' + (runes.length > sockets ? ' · 超出孔洞，未生效' : '');
    }
    $('rpIdols').innerHTML = idolBoardHtml(false);
    const idolN = S.items.filter(it => it.slot === 'Idol').length;
    if ($('rpIdolCount')) $('rpIdolCount').textContent = idolN || '';
    if ($('rpGearIdolN')) $('rpGearIdolN').textContent = idolN;
    if ($('rpIdolAffixes')) $('rpIdolAffixes').innerHTML = idolAffixesHtml();
    if ($('rpIdolEmpty')) $('rpIdolEmpty').hidden = !!idolN;
  }
  function renderGearDetail() {
    if (!$('rpGearDetail')) return;
    const it = slotItem(GEAR_SEL), label = SLOT_LABEL[GEAR_SEL] || GEAR_SEL;
    if (GEAR_SEL === 'OffHand' && mainIsTwoHand()) {
      $('rpGearDetail').innerHTML = '<div class="rp-gear-detail-head"><span class="rp-kicker">OFF HAND</span><h2>副手</h2><small>双手武器占用</small></div><div class="rp-hint">主手是双手武器时不能装备副手。换一把单手武器后即可选择副手。</div>';
      return;
    }
    if (!it) {
      $('rpGearDetail').innerHTML = '<div class="rp-gear-detail-head"><span class="rp-kicker">EQUIPMENT</span><h2>' + esc(label) + '</h2><small>空槽位</small></div><div class="rp-hint">这个槽位还没有装备。</div><button type="button" class="rp-btn main" data-edit-detail>选择' + esc(label) + '</button>';
      return;
    }
    const b = BASE[it.base], lines = itemModLines(it, 99);
    const runes = (it.runes || []).map(r => (GD.runes[r] || {}).Name || r).filter(Boolean);
    $('rpGearDetail').innerHTML = '<div class="rp-gear-detail-head">' + itemIcon(it, true) + '<div><span class="rp-kicker">' + esc(label) + '</span><h2>' + esc(itemName(it)) + '</h2><small>' + esc(b ? b.Name : it.base) + ' · ilvl ' + it.level + ' · ' + esc(it.rarity) + (it.sockets != null ? ' · ' + it.sockets + ' 孔' : '') + '</small></div></div>' +
      '<div class="rp-gear-detail-mods">' + (lines.length ? lines.map(x => '<div>' + esc(x) + '</div>').join('') : '<div class="rp-hint">没有词缀。</div>') + '</div>' +
      (runes.length ? '<div class="rp-hint">符文：' + esc(runes.join(' / ')) + '</div>' : '') +
      '<div class="rp-gear-detail-actions"><button type="button" class="rp-btn main" data-edit-detail>编辑此槽位</button></div>';
  }
  function idolBoardHtml(compact) {
    layoutIdols(S.items);
    const idols = S.items.map((it, i) => ({ it, i })).filter(x => x.it.slot === 'Idol');
    const occ = new Set();
    for (const x of idols) if (x.it.gx >= 0) for (let dy = 0; dy < (x.it.gh || 1); dy++) for (let dx = 0; dx < (x.it.gw || 1); dx++) occ.add((x.it.gx + dx) + ',' + (x.it.gy + dy));
    const pos = (x, y, w, h) => 'left:calc(' + (x * 20) + '% + 2px);top:calc(' + (y * 20) + '% + 2px);width:calc(' + (w * 20) + '% - 4px);height:calc(' + (h * 20) + '% - 4px)';
    let cells = '';
    for (let y = 0; y < IDOL_H; y++) for (let x = 0; x < IDOL_W; x++) {
      if (idolBlocked(x, y)) continue;
      if (occ.has(x + ',' + y)) continue;
      cells += '<button type="button" class="rp-idol-cell" style="' + pos(x, y, 1, 1) + '" data-idol-cell="' + x + ',' + y + '" title="在这里放神像">+</button>';
    }
    const items = idols.filter(x => x.it.gx >= 0).map(x => {
      const it = x.it, b = BASE[it.base], w = it.gw || 1, h = it.gh || 1;
      const lines = itemModLines(it, compact ? 0 : 2);
      return '<button type="button" class="rp-idol-item w' + w + ' h' + h + (compact ? ' compact' : '') + '" data-edit-idol="' + x.i + '" style="' + pos(it.gx, it.gy, w, h) + '" title="' + attr(itemName(it) + ' · ' + w + '×' + h + (b ? ' · ' + b.Name : '')) + '">' +
        itemIcon(it, true) + '<b>' + esc(itemName(it)) + '</b><small>' + w + '×' + h + (b ? ' · ' + esc(b.Name) : '') + '</small>' + (lines.length ? '<span>' + esc(lines[0]) + '</span>' : '') + '<em class="rp-idol-size">' + w + '×' + h + '</em></button>';
    }).join('');
    const lost = idols.filter(x => x.it.gx < 0);
    return '<div class="rp-idol-board' + (compact ? ' compact' : '') + '">' + cells + items + '</div>' +
      (lost.length ? '<div class="rp-hint">未放下：' + lost.map(x => esc(itemName(x.it))).join('、') + '（格子不够，移除其他神像或换小底材）</div>' : '');
  }
  function idolAffixesHtml() {
    const idols = S.items.map((it, i) => ({ it, i })).filter(x => x.it.slot === 'Idol');
    if (!idols.length) return '<div class="rp-hint">还没有神像。</div>';
    return idols.map(x => {
      const it = x.it, b = BASE[it.base], lines = itemModLines(it, 99);
      return '<div class="rp-idol-affix"><b>' + esc(itemName(it)) + ' <small>' + (it.gw || 1) + '×' + (it.gh || 1) + (b ? ' · ' + esc(b.Name) : '') + '</small></b>' +
        (lines.length ? '<ul>' + lines.map(line => '<li>' + esc(line) + '</li>').join('') + '</ul>' : '<div class="rp-hint">没有词缀。</div>') + '</div>';
    }).join('');
  }
  function addIdol(cell) {
    openItemEditor('Idol', null, cell);
  }
  function itemAffixLine(a) {
    const af = AFF[a.id];
    if (!af) return '未收录词缀 ' + a.id + (a.v != null ? '：' + num(a.v) : '');
    return SIM.modText(GD, { stat: af.Mod.Stat, mode: af.Mod.Mode, tags: af.Mod.Tags || [], v: a.v, v2: a.v2 });
  }
  function itemPreview(it) {
    if (!it) return '<div class="rp-hint">还没有选择底材。</div>';
    const b = BASE[it.base], u = UNI[it.unique];
    const lines = [];
    if (b) for (const m of b.Implicits || []) lines.push('<li class="imp">' + esc(modText(m)) + '</li>');
    for (const a of it.affixes || []) {
      const k = affixKind(a, it);
      if (String(a.id).startsWith('unique:')) {
        const um = u && u.Mods[+a.id.slice(7)];
        if (um) lines.push('<li><span class="rp-atag ' + k.cls + '">' + k.label + '</span>' + esc(SIM.modText(GD, { stat: um.Mod.Stat, mode: um.Mod.Mode, tags: um.Mod.Tags || [], v: a.v, v2: a.v2 })) + '</li>');
      } else { const line = itemAffixLine(a); if (line) lines.push('<li' + (AFF[a.id] ? '' : ' class="unknown"') + '><span class="rp-atag ' + k.cls + '">' + k.label + '</span>' + esc(line) + '</li>'); }
    }
    const runeNames = (it.runes || []).map(r => (GD.runes[r] || {}).Name || r).filter(Boolean);
    if (runeNames.length) lines.push('<li><span class="rp-atag rune">符文</span>' + esc(runeNames.join(' / ')) + '</li>');
    const word = oathwordForItem(it);
    if (word) lines.push('<li><span class="rp-atag vow">符文之语</span>' + esc(word.Name) + '</li>');
    const socketText = it.sockets != null ? ' · ' + it.sockets + ' 孔' : '';
    return '<div class="rp-preview"><div class="name">' + esc(itemName(it)) + '</div><div class="base">' + esc(b ? b.Name : it.base) + ' · ilvl ' + it.level + ' · ' + esc(it.rarity) + socketText + '</div><ul>' + (lines.join('') || '<li>没有词缀</li>') + '</ul></div>';
  }
  let EDIT = null;
  function openItemEditor(slot, idx, cell) {
    if (slot === 'OffHand' && mainIsTwoHand()) { toast('主手是双手武器，不能再装备副手', true); return; }
    idx = idx == null ? -1 : +idx;
    const existing = idx >= 0 ? S.items[idx] : null;
    EDIT = { slot, idx, cell: cell || null, item: existing ? JSON.parse(JSON.stringify(existing)) : { slot, base: '', rarity: 'Normal', unique: 'None', name: '', level: 84, quality: 0, affixes: [], runes: [] }, tab: 'base', q: '' };
    renderItemEditor();
  }
  function renderItemEditor() {
    const it = EDIT.item, slot = EDIT.slot, b = BASE[it.base];
    let body = '';
    if (EDIT.tab === 'base') {
      const q = lc(EDIT.q);
      const bases = baseChoices(slot).filter(x => !q || lc(x.Name).includes(q) || lc(x.Id).includes(q)).slice(0, 250);
      const uniques = uniqueChoices(slot).filter(u => !q || lc(u.Name).includes(q) || lc(u.BaseId).includes(q)).slice(0, 100);
      body = '<div class="rp-form2"><label>搜索底材/传奇<input class="rp-input" id="rpEditQ" value="' + attr(EDIT.q) + '" placeholder="名称…"></label><label>物品等级<input class="rp-input" type="number" min="1" max="100" data-field="level" value="' + it.level + '"></label><label>品质<input class="rp-input" type="number" min="0" max="30" data-field="quality" value="' + it.quality + '"></label><label>稀有度<select class="sel" data-field="rarity">' + ['Normal', 'Magic', 'Rare', 'Unique'].map(r => '<option value="' + r + '"' + (it.rarity === r ? ' selected' : '') + '>' + ({ Normal: '普通', Magic: '魔法', Rare: '稀有', Unique: '传奇' }[r]) + '</option>').join('') + '</select></label></div>' +
        '<div style="margin:8px 0"><button class="rp-btn small" type="button" data-clear-item>清空槽位</button></div>' +
        '<div class="rp-hint">底材 / 传奇</div><div class="rp-list">' + uniques.map(u => '<button type="button" class="rp-option ' + (it.unique === lc(u.Id) ? 'on' : '') + '" data-pick="' + attr(u.BaseId) + '" data-unique="' + attr(u.Id) + '"><span><b>' + esc(u.Name) + '</b><small style="display:block">' + esc(u.BaseId) + ' · 传奇</small></span><small>' + esc(BASE[lc(u.BaseId)] ? BASE[lc(u.BaseId)].Slot : '') + (BASE[lc(u.BaseId)] && BASE[lc(u.BaseId)].Width > 1 ? ' · ' + BASE[lc(u.BaseId)].Width + '×' + BASE[lc(u.BaseId)].Height : '') + '</small></button>').join('') +
        bases.map(x => '<button type="button" class="rp-option ' + (it.base === lc(x.Id) && it.unique === 'None' ? 'on' : '') + '" data-pick="' + attr(x.Id) + '"><span><b>' + esc(x.Name) + '</b><small style="display:block">' + esc(x.Class) + ' · ' + esc(x.Slot) + (x.Width > 1 || x.Height > 1 ? ' · ' + x.Width + '×' + x.Height : '') + '</small></span><small>Lv ' + x.Level + '</small></button>').join('') + '</div>' +
        '<div style="margin-top:9px">' + itemPreview(it) + '</div>';
    } else if (EDIT.tab === 'affix') {
      if (it.rarity === 'Unique') {
        const u = UNI[it.unique];
        const VOW_MAX = 6;
        const vows = (it.affixes || []).map((a, i) => ({ a, i })).filter(x => !String(x.a.id).startsWith('unique:'));
        const vowRows = vows.map((x, vi) => {
          const a = x.a, af = AFF[a.id], k = affixKind(a, it);
          const share = (GD.vowShares || [])[Math.min(vi, (GD.vowShares || []).length - 1)] || 1;
          if (!af) return '<div class="rp-affix-row"><span class="rp-atag ' + k.cls + '">' + k.label + '</span><span class="txt">' + esc(itemAffixLine(a)) + '</span><button class="rm" type="button" data-arem="' + x.i + '">×</button></div>';
          const tier = af.Tiers[a.tier] || {};
          return '<div class="rp-affix-row"><span class="rp-atag ' + k.cls + '">' + k.label + ' ' + (vi + 1) + (share < 1 ? ' · ' + Math.round(share * 100) + '%' : '') + '</span><select class="sel" data-atier="' + x.i + '">' + af.Tiers.map((t, ti) => '<option value="' + ti + '"' + (ti === a.tier ? ' selected' : '') + '>T' + (ti + 1) + ' ilvl ' + t.ILvl + '</option>').join('') + '</select><span class="txt">' + esc(itemAffixLine(a)) + '</span><input type="range" min="0" max="100" value="' + Math.round((a.v - (tier.Min || 0)) / Math.max(1, (tier.Max || 0) - (tier.Min || 0)) * 100) + '" data-aroll="' + x.i + '"><span class="rp-note">' + Math.round(a.v) + '</span><button class="rm" type="button" data-arem="' + x.i + '">×</button></div>';
        }).join('');
        const vowPool = Object.values(AFF).filter(af => affixFits(af, BASE[it.base])).filter(af => !(it.affixes || []).some(x => AFF[x.id] && AFF[x.id].Group === af.Group));
        body = '<div class="rp-hint">传奇固定词缀不可编辑，只能改 roll；下方誓语（Vow）来自稀有装备，可按品阶和 roll 编辑，每条誓语按顺序递减。</div>' + (u ? '<div style="margin-top:8px"><label class="rp-mini">传奇 roll <b style="color:var(--rp-accent2)">' + Math.round((it.roll == null ? 0.5 : it.roll) * 100) + '%</b><input type="range" min="0" max="100" value="' + Math.round((it.roll == null ? 0.5 : it.roll) * 100) + '" data-urange style="width:100%;accent-color:var(--rp-accent)"></label></div>' : '') +
          '<div class="rp-hint" style="margin-top:8px">誓语 ' + vows.length + '/' + VOW_MAX + '</div>' + (vowRows || '<div class="rp-hint">还没有誓语。</div>') +
          (vows.length < VOW_MAX ? '<div class="rp-hint" style="margin-top:6px">添加誓语</div><div class="rp-list">' + vowPool.slice(0, 120).map(af => {
            const t = af.Tiers[0] || {};
            return '<button type="button" class="rp-option" data-vowadd="' + attr(af.Id) + '"><span><b>' + esc((ZH.affixGroup && ZH.affixGroup[lc(af.Group)]) || af.Group || af.Id) + ' · ' + esc(af.Type) + '</b><small style="display:block">' + esc(SIM.modText(GD, { stat: af.Mod.Stat, mode: af.Mod.Mode, tags: af.Mod.Tags || [], v: t.Max || 0, v2: t.Max2 || 0 })) + '</small></span><small>' + af.Tiers.length + ' 阶</small></button>';
          }).join('') + '</div>' : '') +
          '<div style="margin-top:9px">' + itemPreview(it) + '</div>';
      } else {
        const editRarity = it.rarity === 'Normal' ? 'Rare' : it.rarity;
        const cap = editRarity === 'Rare' ? [3, 3] : editRarity === 'Magic' ? [1, 1] : [0, 0];
        const pre = (it.affixes || []).filter(a => AFF[a.id] && AFF[a.id].Type === 'Prefix' && !a.oath && !a.crafted).length;
        const suf = (it.affixes || []).filter(a => AFF[a.id] && AFF[a.id].Type === 'Suffix' && !a.oath && !a.crafted).length;
        const oathN = (it.affixes || []).filter(a => a.oath).length;
        const craftN = (it.affixes || []).filter(a => a.crafted && !a.oath).length;
        const rows = (it.affixes || []).map((a, i) => {
          const af = AFF[a.id], k = affixKind(a, it);
          if (!af) return '<div class="rp-affix-row"><span class="rp-atag ' + k.cls + '">' + k.label + '</span><span class="txt">' + esc(itemAffixLine(a)) + '</span><button class="rm" type="button" data-arem="' + i + '">×</button></div>';
          const tier = af.Tiers[a.tier] || {};
          return '<div class="rp-affix-row"><span class="rp-atag ' + k.cls + '">' + k.label + '</span><select class="sel" data-atier="' + i + '">' + af.Tiers.map((t, ti) => '<option value="' + ti + '"' + (ti === a.tier ? ' selected' : '') + '>T' + (ti + 1) + ' ilvl ' + t.ILvl + '</option>').join('') + '</select><span class="txt">' + esc(itemAffixLine(a)) + '</span><input type="range" min="0" max="100" value="' + Math.round((a.v - (tier.Min || 0)) / Math.max(1, (tier.Max || 0) - (tier.Min || 0)) * 100) + '" data-aroll="' + i + '"><span class="rp-note">' + Math.round(a.v) + '</span><button class="rm" type="button" data-arem="' + i + '">×</button></div>';
        }).join('');
        const pool = Object.values(AFF).filter(af => affixFits(af, b)).filter(af => !(it.affixes || []).some(x => AFF[x.id] && AFF[x.id].Group === af.Group)).filter(af => af.Type === 'Prefix' ? pre < cap[0] : suf < cap[1]);
        body = '<div class="rp-hint">' + (it.rarity === 'Normal' ? '普通底材：添加第一条词缀时会自动转为稀有（3 前缀 / 3 后缀）。' : '') + '</div>' +
          '<div class="rp-hint">前缀 ' + pre + '/' + cap[0] + ' · 后缀 ' + suf + '/' + cap[1] + (oathN ? ' · 誓语 ' + oathN : '') + (craftN ? ' · 工艺 ' + craftN : '') + '</div>' +
          '<div class="rp-hint" style="margin-top:6px">当前词缀</div>' + (rows || '<div class="rp-hint">还没有词缀。</div>') +
          '<div class="rp-hint" style="margin-top:6px">可添加</div><div class="rp-list">' + pool.slice(0, 160).map(af => {
            const t = af.Tiers[0] || {};
            return '<button type="button" class="rp-option" data-aadd="' + attr(af.Id) + '"><span><b>' + esc((ZH.affixGroup && ZH.affixGroup[lc(af.Group)]) || af.Group || af.Id) + ' · ' + esc(af.Type) + '</b><small style="display:block">' + esc(SIM.modText(GD, { stat: af.Mod.Stat, mode: af.Mod.Mode, tags: af.Mod.Tags || [], v: t.Max || 0, v2: t.Max2 || 0 })) + '</small></span><small>' + af.Tiers.length + ' 阶</small></button>';
          }).join('') + '</div><div style="margin-top:9px">' + itemPreview(it) + '</div>';
      }
    } else {
      const b0 = BASE[it.base];
      const baseMax = runeMaxForBase(b0);
      const sock = it.sockets != null ? clamp(n(it.sockets), 0, 6) : baseMax;
      const max = Math.max(sock, (it.runes || []).length);
      const runes = Object.values(GD.runes).filter(r => r.Kind === 'rune');
      const opts = runes.map(r => '<option value="' + attr(r.Id) + '">' + esc(r.Name) + '</option>').join('');
      body = '<div class="rp-affix-row"><span class="rp-note">孔洞数</span><input class="rp-input" type="number" min="0" max="' + Math.max(6, baseMax) + '" value="' + sock + '" data-sockets style="max-width:90px"><span class="rp-hint" style="margin:0">底材最多 ' + baseMax + ' 孔；导入时按装备实际孔数保留。</span></div>' +
        '<div class="rp-hint">符文之语按顺序检测；导入的符文会保留。</div>';
      for (let i = 0; i < max; i++) {
        const cur = (it.runes || [])[i] || '';
        body += '<div class="rp-affix-row"><span class="rp-note">孔 ' + (i + 1) + '</span><select class="sel" data-rune="' + i + '"><option value="">空</option>' + runes.map(r => '<option value="' + attr(r.Id) + '"' + (lc(cur) === lc(r.Id) ? ' selected' : '') + '>' + esc(r.Name) + '</option>').join('') + '</select></div>';
      }
      if (!max) body += '<div class="rp-hint">这个底材没有符文孔。</div>';
      body += '<div style="margin-top:9px">' + itemPreview(it) + '</div>';
    }
    modal(modalHead('编辑 · ' + (SLOT_LABEL[slot] || slot)) + '<div class="rp-modal-body"><div class="rp-edit-tabs">' +
      '<button data-etab="base" class="' + (EDIT.tab === 'base' ? 'on' : '') + '">底材 / 稀有度</button><button data-etab="affix" class="' + (EDIT.tab === 'affix' ? 'on' : '') + '">' + (it.rarity === 'Unique' ? '传奇 roll' : '词缀') + '</button><button data-etab="runes" class="' + (EDIT.tab === 'runes' ? 'on' : '') + '">符文</button></div>' + body + '</div>' +
      '<div class="rp-modal-foot"><button class="rp-btn" type="button" data-close>取消</button><button class="rp-btn main" type="button" id="rpEditSave">保存</button></div>', bindItemEditor);
  }
  function bindItemEditor(root) {
    const it = EDIT.item;
    root.querySelectorAll('[data-etab]').forEach(x => x.onclick = () => { EDIT.tab = x.dataset.etab; renderItemEditor(); });
    const q = root.querySelector('#rpEditQ');
    if (q) q.oninput = e => { EDIT.q = e.target.value; renderItemEditor(); setTimeout(() => { const x = document.querySelector('#rpEditQ'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 0); };
    root.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
      const base = BASE[lc(b.dataset.pick)]; if (!base) return;
      const uniq = b.dataset.unique ? UNI[lc(b.dataset.unique)] : null;
      EDIT.item.base = lc(base.Id); EDIT.item.rarity = uniq ? 'Unique' : 'Normal'; EDIT.item.unique = uniq ? lc(uniq.Id) : 'None';
      EDIT.item.affixes = []; EDIT.item.runes = []; EDIT.item.level = Math.max(EDIT.item.level || 1, base.Level || 1);
      if (uniq) { EDIT.item.roll = 0.5; ensureUniqueLines(EDIT.item); }
      renderItemEditor();
    });
    root.querySelectorAll('[data-field]').forEach(el => el.onchange = () => {
      const k = el.dataset.field;
      if (k === 'rarity') { EDIT.item.rarity = el.value; if (el.value !== 'Unique') EDIT.item.unique = 'None'; }
      else if (k === 'level') EDIT.item.level = clamp(n(el.value) || 1, 1, 100);
      else EDIT.item.quality = clamp(n(el.value) || 0, 0, 30);
      renderItemEditor();
    });
    const clr = root.querySelector('[data-clear-item]'); if (clr) clr.onclick = () => { EDIT.item = { slot: EDIT.slot, base: '', rarity: 'Normal', unique: 'None', name: '', level: 84, quality: 0, affixes: [], runes: [] }; renderItemEditor(); };
    root.querySelectorAll('[data-vowadd]').forEach(b => b.onclick = () => {
      const af = AFF[b.dataset.vowadd]; if (!af) return;
      const t0 = af.Tiers[0] || {};
      EDIT.item.affixes.push({ id: af.Id, tier: 0, v: t0.Min || 0, v2: t0.Min2 || 0, oath: false, crafted: false });
      renderItemEditor();
    });
    root.querySelectorAll('[data-aadd]').forEach(b => b.onclick = () => {
      const af = AFF[b.dataset.aadd]; if (!af) return;
      const tier0 = af.Tiers[0] || {};
      EDIT.item.affixes.push({ id: af.Id, tier: 0, v: tier0.Min || 0, v2: tier0.Min2 || 0 });
      if (EDIT.item.rarity === 'Normal') EDIT.item.rarity = 'Rare';
      renderItemEditor();
    });
    root.querySelectorAll('[data-arem]').forEach(b => b.onclick = () => { EDIT.item.affixes.splice(+b.dataset.arem, 1); renderItemEditor(); });
    root.querySelectorAll('[data-atier]').forEach(sel => sel.onchange = () => {
      const a = EDIT.item.affixes[+sel.dataset.atier], af = AFF[a.id], t = af.Tiers[+sel.value];
      a.tier = +sel.value; a.v = t.Min || 0; a.v2 = t.Min2 || 0; renderItemEditor();
    });
    root.querySelectorAll('[data-aroll]').forEach(r => r.oninput = () => {
      const a = EDIT.item.affixes[+r.dataset.aroll], af = AFF[a.id], t = af.Tiers[a.tier] || {};
      const f = +r.value / 100; a.v = Math.round((n(t.Min) + (n(t.Max) - n(t.Min)) * f) * 100) / 100;
      if (t.Min2 != null) a.v2 = Math.round((n(t.Min2) + (n(t.Max2) - n(t.Min2)) * f) * 100) / 100;
      renderItemEditor();
    });
    const ur = root.querySelector('[data-urange]'); if (ur) ur.oninput = () => { EDIT.item.roll = +ur.value / 100; const vows = EDIT.item.affixes.filter(a => !String(a.id).startsWith('unique:')); EDIT.item.affixes = uniqueAffixes(UNI[EDIT.item.unique], EDIT.item.roll).concat(vows); renderItemEditor(); };
    const socks = root.querySelector('[data-sockets]'); if (socks) socks.onchange = () => {
      const b = BASE[EDIT.item.base], bm = runeMaxForBase(b);
      EDIT.item.sockets = clamp(n(socks.value), 0, Math.max(6, bm));
      EDIT.item.runes = (EDIT.item.runes || []).slice(0, EDIT.item.sockets);
      renderItemEditor();
    };
    root.querySelectorAll('[data-rune]').forEach(sel => sel.onchange = () => {
      const i = +sel.dataset.rune, arr = (EDIT.item.runes || []).slice(); while (arr.length < i + 1) arr.push(''); arr[i] = sel.value; EDIT.item.runes = arr.filter(Boolean); renderItemEditor();
    });
    const save = root.querySelector('#rpEditSave');
    if (save) save.onclick = () => {
      if (!EDIT.item.base) return toast('先选择底材', true);
      if (EDIT.slot === 'OffHand' && mainIsTwoHand()) return toast('主手是双手武器，不能再装备副手', true);
      if (EDIT.slot === 'MainHand' && isTwoHandBase(EDIT.item.base)) S.items = S.items.filter(it => it.slot !== 'OffHand');
      if (EDIT.slot === 'Idol' && EDIT.cell) {
        const b = BASE[EDIT.item.base], w = Math.max(1, n(b && b.Width) || 1), h = Math.max(1, n(b && b.Height) || 1);
        const test = S.items.filter(it => it !== EDIT.item && it.slot === 'Idol');
        // Build a temporary occupancy from the other idols so the chosen cell wins.
        const own = new Set(test.filter(x => x.gx >= 0).flatMap(x => Array.from({ length: x.gh || 1 }, (_, dy) => Array.from({ length: x.gw || 1 }, (_, dx) => (x.gx + dx) + ',' + (x.gy + dy)))).flat());
        let ok = true;
        for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (idolBlocked(EDIT.cell.x + dx, EDIT.cell.y + dy) || own.has((EDIT.cell.x + dx) + ',' + (EDIT.cell.y + dy))) ok = false;
        if (ok) { EDIT.item.gx = EDIT.cell.x; EDIT.item.gy = EDIT.cell.y; }
        else { EDIT.item.gx = -1; EDIT.item.gy = -1; }
      }
      if (EDIT.idx >= 0) S.items[EDIT.idx] = EDIT.item;
      else S.items.push(EDIT.item);
      layoutIdols(S.items);
      closeModal(); done();
    };
  }

  /* --------------------------------------------------------------- damage UI */
  function statRow(label, value, gold) { return '<div class="rp-stat"><span>' + esc(label) + '</span><b' + (gold ? ' class="gold"' : '') + '>' + value + '</b></div>'; }
  function renderDamage() {
    const id = mainSkill();
    const sk = SK[id];
    $('rpDmgTitle').textContent = sk ? skillName(id) : '伤害';
    $('rpDmgSub').textContent = sk ? (sk.Kind + ' · ' + (sk.Tags || []).join(' / ')) : '选择主技能后显示逐项计算。';
    $('rpDmgDps').textContent = R && !R.error && isFinite(R.totalDps) ? big(R.totalDps) : '—';
    $('rpDmgPanel').textContent = R && isFinite(R.panelDps) ? '面板 ' + big(R.panelDps) : '面板 —';
    const offD = S.official && S.official.dps;
    $('rpDmgOfficial').textContent = offD ? '公开 API 游戏实测中位 DPS：' + big(offD) + '（守护者实战；与上方模型 DPS 口径不同）' : '';
    $('rpEnemyLevel').value = S.enemy.level;
    $('rpEnemyRarity').value = S.enemy.rarity;
    $('rpGuardianElement').value = S.enemy.element || '';
    if (!R || R.error || R.unsupported) {
      $('rpEnemyStats').innerHTML = '';
      $('rpHitStats').innerHTML = '';
      $('rpTypeStats').innerHTML = '';
      $('rpManaStats').innerHTML = '';
      $('rpNotes').innerHTML = '<p>' + esc(R && (R.error || R.unsupported) || '选择一个会造成伤害的技能。') + '</p>';
      return;
    }
    const en = R.enemy || {};
    $('rpEnemyStats').innerHTML =
      statRow('等级', en.level || S.enemy.level) + statRow('稀有度', en.rarity || S.enemy.rarity) +
      statRow('物理抗性', (en.resist ? en.resist.Physical : 0) + '%') +
      statRow('火焰抗性', (en.resist ? en.resist.Fire : 0) + '%') + statRow('冰霜抗性', (en.resist ? en.resist.Cold : 0) + '%') +
      statRow('闪电抗性', (en.resist ? en.resist.Lightning : 0) + '%') + statRow('毒素抗性', (en.resist ? en.resist.Poison : 0) + '%') +
      statRow('护甲', num(en.armour)) + (R.mitig ? statRow('物理减免', (R.mitig.armourReduction || 0).toFixed(1) + '%') : '') +
      ((en.activeCurses || []).length ? statRow('生效诅咒', en.activeCurses.map(id => zh(ZH.curse, id, (GD.curses[id] || {}).Name || id)).join(' · ')) : '');
    $('rpHitStats').innerHTML =
      statRow('命中均值', num(R.hitAvg)) + statRow('暴击命中均值', num(R.hitAvgCrit)) +
      statRow('暴击率', (R.crit ? R.crit.chance : 0).toFixed(1) + '%') + statRow('暴击倍率', (R.crit ? R.crit.multi : 100) + '%') +
      statRow('每秒使用', (R.speed ? R.speed.usesPerSec : 0).toFixed(2)) + statRow('每次命中', R.hits ? R.hits.hitsPerUse : 1) +
      statRow('每秒命中', R.hits ? R.hits.hitsPerSec.toFixed(2) : '—', true);
    const types = R.hitDpsByType || {};
    $('rpTypeStats').innerHTML = Object.keys(types).map(k => statRow(TYPE_ZH[k] || k, big(types[k]), true)).join('') +
      (R.poisonDps ? statRow('中毒 DPS', big(R.poisonDps)) : '') + (R.igniteDps ? statRow('点燃 DPS', big(R.igniteDps)) : '') + (R.bleedDps ? statRow('流血 DPS', big(R.bleedDps)) : '') +
      statRow('总 DPS', big(R.totalDps), true);
    const m = R.mana;
    $('rpManaStats').innerHTML = !m ? '' : m.skip ? statRow('魔力', esc(m.skip)) :
      statRow('魔力上限', num(m.max)) + statRow('保留', num(m.reserved)) + statRow('可用', num(m.pool)) +
      statRow('每次消耗', num(m.cost, 2)) + statRow('每秒消耗', num(m.spend, 1), true) +
      statRow('每秒回复', num(m.gain, 1)) + statRow('可维持', m.sustained ? '持续' : (isFinite(m.lasts) ? Math.round(m.lasts) + ' 秒' : '—'));
    const notes = (R.notes || []).slice(0, 30);
    $('rpNotes').innerHTML = notes.length ? notes.map(x => '<p>' + esc(x) + '</p>').join('') : '<p>没有额外说明。</p>';
  }

  /* ------------------------------------------------------------------ boot */
  function renderAll() {
    recalc();
    renderStatus(); renderOverview(); renderSkills(); renderDamage(); renderGear(); renderDefence();
    if (PANE === 'tree') { buildTreeIfNeeded(); paintTree(); }
    if (PANE === 'dragon') renderDragon();
  }
  function done() {
    renderAll(); saveLocal();
    if (PANE === 'tree' && TREE) paintTree();
  }
  function saveLocal() { try { localStorage.setItem(PREFIX, JSON.stringify(S)); } catch (e) {} }
  function loadLocal() { try { const raw = JSON.parse(localStorage.getItem(PREFIX) || 'null'); return raw ? normalizeState(raw) : null; } catch (e) { return null; } }
  function bind() {
    $('rpNav').onclick = e => { const b = e.target.closest('[data-pane]'); if (b) setPane(b.dataset.pane); };
    document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => setPane(b.dataset.go));
    $('rpName').oninput = () => { S.name = $('rpName').value; saveLocal(); renderStatus(); };
    $('rpClass').onchange = () => {
      S.classId = $('rpClass').value; S.passives = []; S.dragonNodes = []; S.dragonAspect = ''; S.mainSkill = ''; TREE = null; DRAGON = null; done();
    };
    $('rpLevel').onchange = () => { S.level = clamp(n($('rpLevel').value) || 1, 1, 100); S.enemy.level = S.level; normalizePassives(S); clampDragonPoints(); done(); };
  if ($('rpTarget')) $('rpTarget').onchange = () => { S.enemy.rarity = $('rpTarget').value; done(); };
    $('rpImport').onclick = openImport;
    $('rpExport').onclick = openExport;
    $('rpSave').onclick = () => { saveLocal(); toast('已保存到浏览器'); };
    $('rpNew').onclick = () => {
      closeModal();
      TREE = null; DRAGON = null; GEAR_SEL = 'MainHand';
      S = normalizeState(blankState($('rpClass').value || 'warrior', 100));
      recalc(); renderAll(); setPane('overview');
      toast('已新建空白构筑');
    };
    $('rpLoad').onclick = () => {
      const st = loadLocal();
      if (!st) return toast('浏览器里还没有保存的构筑', true);
      closeModal();
      TREE = null; DRAGON = null; GEAR_SEL = 'MainHand';
      S = normalizeState(st);
      recalc(); renderAll(); setPane('overview');
      toast('已读取上次保存的构筑');
    };
    $('rpDoll').onclick = e => { const b = e.target.closest('[data-edit-slot]'); if (b) { GEAR_SEL = b.dataset.editSlot; renderGearDetail(); } };
    if ($('rpGearDetail')) $('rpGearDetail').onclick = e => { if (e.target.closest('[data-edit-detail]')) openItemEditor(GEAR_SEL, S.items.findIndex(x => x.slot === GEAR_SEL)); };
    $('ovGear').onclick = e => { const b = e.target.closest('[data-edit-slot]'); if (b) openItemEditor(b.dataset.editSlot, S.items.findIndex(x => x.slot === b.dataset.editSlot)); };
    const idolClick = e => {
      const c = e.target.closest('[data-idol-cell]');
      if (c) { const [x, y] = c.dataset.idolCell.split(',').map(Number); return addIdol({ x, y }); }
      const b = e.target.closest('[data-edit-idol]'); if (b) openItemEditor('Idol', +b.dataset.editIdol);
    };
    $('rpIdols').onclick = idolClick;
    $('ovIdols').onclick = idolClick;
    if ($('rpRunes')) $('rpRunes').onclick = e => { const b = e.target.closest('[data-edit-rune]'); if (b) openItemEditor('DwarvenRune', +b.dataset.editRune); };
    if ($('rpAddRune')) $('rpAddRune').onclick = () => openItemEditor('DwarvenRune', null);
    $('rpAddIdol').onclick = () => addIdol();
  if ($('ovBest')) $('ovBest').onclick = e => { const g = e.target.closest('[data-go]'); if (g) return setPane(g.dataset.go); if (e.target.closest('[data-use-best]') && RANK[0]) { S.mainSkill = RANK[0].id; done(); toast('已把最高技能设为主技能：' + skillName(RANK[0].id)); } };
  if ($('ovSkillRank')) $('ovSkillRank').onclick = e => { const b = e.target.closest('[data-rank-main]'); if (b) { S.mainSkill = b.dataset.rankMain; done(); } };
  if ($('rpRelayoutIdols')) $('rpRelayoutIdols').onclick = () => { layoutIdols(S.items); done(); toast('神像已重新自动排列'); };
    $('rpSkills').onclick = e => {
      let b = e.target.closest('[data-main]'); if (b) { const x = skillRows()[+b.dataset.main]; if (x) { S.mainSkill = x.skill; done(); } return; }
      b = e.target.closest('[data-rem-skill]'); if (b) { const x = skillRows()[+b.dataset.remSkill]; if (x) { S.sockets = S.sockets.filter(s => s.skill !== x.skill); S.hotbar = S.hotbar.filter(h => h !== x.skill); if (S.mainSkill === x.skill) S.mainSkill = ''; done(); } return; }
      b = e.target.closest('[data-hotbar]'); if (b) { const x = skillRows()[+b.dataset.hotbar]; if (x) { S.hotbar = S.hotbar || []; const at = S.hotbar.indexOf(x.skill); if (at >= 0) S.hotbar.splice(at, 1); else S.hotbar.push(x.skill); done(); } return; }
      b = e.target.closest('[data-add-sup]'); if (b) { openSupportPicker(+b.dataset.addSup); return; }
      b = e.target.closest('[data-rem-sup]'); if (b) { const [i, id] = b.dataset.remSup.split(':'); const x = skillRows()[+i]; if (x && x.socket) { x.socket.supports = x.socket.supports.filter(s => s !== id); done(); } }
    };
    $('rpSkills').onchange = e => { const g = e.target.closest('[data-gem]'); if (g) { const x = skillRows()[+g.dataset.gem]; if (x) { S.gemLevels[x.skill] = clamp(n(g.value) || 1, 1, 40); done(); } } };
    $('rpAddSkill').onclick = openSkillPicker;
    $('rpEnemyLevel').onchange = () => { S.enemy.level = clamp(n($('rpEnemyLevel').value) || S.level, 1, 100); done(); };
    $('rpEnemyRarity').onchange = () => { S.enemy.rarity = $('rpEnemyRarity').value; done(); };
    $('rpGuardianElement').onchange = () => { S.enemy.element = $('rpGuardianElement').value; done(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') { e.preventDefault(); openImport(); } });
  }
  BO.init('planner.html', () => {
    const cls = $('rpClass');
    cls.innerHTML = Object.keys(CLASS).map(id => '<option value="' + attr(id) + '">' + esc(classLabel(id)) + '</option>').join('');
    let pending = null;
    try { pending = JSON.parse(localStorage.getItem('bo_pending_build') || 'null'); } catch (e) {}
    if (!pending) { try { pending = JSON.parse(sessionStorage.getItem('bo_pending_build') || 'null'); } catch (e) {} }
    if (!pending) {
      try {
        if (String(window.name || '').indexOf('bo_pending_build:') === 0) { pending = JSON.parse(String(window.name).slice('bo_pending_build:'.length)); window.name = ''; }
      } catch (e) {}
    }
    if (location.hash === '#import=api' && pending && pending.api) {
      S = fromApi(pending.api, pending.main);
      try { localStorage.removeItem('bo_pending_build'); } catch (e) {}
      try { sessionStorage.removeItem('bo_pending_build'); } catch (e) {}
      try { window.name = ''; } catch (e) {}
      recalc(); bind(); renderAll(); setPane('overview'); saveLocal();
      let quiet = false, pane = '';
      try { const qp = new URLSearchParams(location.search); quiet = qp.get('noreport') === '1'; pane = qp.get('pane') || ''; } catch (e) {}
      if (pane) setPane(pane);
      if (!quiet) modal(modalHead('已导入公开构筑') + '<div class="rp-modal-body">' + importReport(S, '公开 API') + '</div><div class="rp-modal-foot"><button class="rp-btn main" type="button" data-close>开始编辑</button></div>');
      return;
    }
    // Always start a new session from a completely empty plan. A previously saved
    // plan is still available through the explicit "读取保存" button.
    S = normalizeState(blankState('warrior', 100));
    recalc(); bind(); renderAll(); setPane('overview');
    if (location.hash === '#tree') setPane('tree');
    if (location.hash === '#dragon') setPane('dragon');
    if (location.hash === '#gear') setPane('gear');
    if (location.hash === '#idols') setPane('idols');
    if (location.hash === '#defence') setPane('defence');
    if (location.hash === '#skills') setPane('skills');
    if (location.hash === '#damage') setPane('damage');
    const h = decodeURIComponent(location.hash || '');
    if (/^#code=/.test(h)) importCode(h.slice(6));
    try {
      const qp = new URLSearchParams(location.search);
      if (qp.get('pane')) setPane(qp.get('pane'));
      const ep = qp.get('edit'); if (ep) { openItemEditor(ep, S.items.findIndex(x => x.slot === ep)); const et = qp.get('tab'); if (et && EDIT) { EDIT.tab = et; renderItemEditor(); } }
    } catch (e) {}
  });



  /* ------------------------------------------------------------------- tree */
  function treeAdj() {
    if (TREE && TREE.adj) return TREE.adj;
    const adj = {};
    for (const nd of NODES) for (const l of nd.Links || []) {
      if (!NODE[l]) continue;
      (adj[nd.Id] = adj[nd.Id] || new Set()).add(l);
      (adj[l] = adj[l] || new Set()).add(nd.Id);
    }
    return adj;
  }
  function treeStart() { return 'start_' + lc(S.classId); }
  function treeBlocked(id) { const nd = NODE[id]; return !nd || (nd.Kind === 'Start' && id !== treeStart()); }
  function allocSet() { return new Set((S.passives || []).map(realNode).filter(id => NODE[id] && NODE[id].Kind !== 'Start')); }
  function altarOf(id) { return (NODE[id] || {}).Choice || null; }
  function altarTaken(have, id) { const a = altarOf(id); if (!a) return null; for (const x of have) if (x !== id && altarOf(x) === a) return x; return null; }
  function treeConnected(set) {
    const adj = treeAdj(), keep = new Set(), q = [treeStart()];
    for (let i = 0; i < q.length; i++) for (const v of adj[q[i]] || []) if (set.has(v) && !keep.has(v)) { keep.add(v); q.push(v); }
    return keep;
  }
  function pathTo(have, target) {
    const adj = treeAdj(), s0 = treeStart();
    if (have.has(target)) return [];
    const prev = {}, seen = new Set([s0, ...have]), q = [s0, ...have];
    for (let i = 0; i < q.length; i++) {
      const u = q[i]; if (u === target) break;
      for (const v of adj[u] || []) if (!seen.has(v) && !treeBlocked(v) && !(v !== target && altarTaken(have, v))) { seen.add(v); prev[v] = u; q.push(v); }
    }
    if (!seen.has(target)) return null;
    const path = []; let x = target; while (!have.has(x) && x !== s0) { path.unshift(x); x = prev[x]; }
    return path;
  }
  function planTake(have, id) {
    let base = have, swapped = null;
    const other = altarTaken(have, id);
    if (other) {
      swapped = other;
      const s = new Set(have); s.delete(other); s.add(id); const keep = treeConnected(s);
      if (keep.has(id)) { const list = [...keep]; return { list, cost: list.length - have.size, swapped }; }
      const keep2 = treeConnected(new Set([...have].filter(x => x !== other)));
      const removed = [...have].filter(x => x !== other && !keep2.has(x));
      base = new Set([...have].filter(x => x !== other && !removed.includes(x)));
    }
    const p = pathTo(base, id); if (!p) return null;
    const list = [...base, ...p];
    return { list, cost: list.length - have.size, swapped };
  }
  function refundList(have, id) {
    const s = new Set(have); s.delete(id);
    const keep = treeConnected(s);
    return [...have].filter(x => !keep.has(x));
  }
  function treeIconKey(nd) {
    if (!TI || !nd || nd.Kind === 'Attribute') return null;
    let k = null;
    if (nd.Kind === 'Start') k = 'portrait_' + String(nd.Id).replace(/^start_/, '').replace(/^./, c => c.toUpperCase());
    else if (nd.Kind === 'Keystone') k = 'ks_' + nd.Id;
    else if (nd.Group) k = nd.Group + (['Notable', 'Choice', 'Socket'].includes(nd.Kind) ? '_N' : '_S');
    return k && TI.idx[k] != null ? k : null;
  }
  function iconBox(key) { const i = TI.idx[key]; return (i % TI.cols) * TI.T + ' ' + Math.floor(i / TI.cols) * TI.T + ' ' + TI.T + ' ' + TI.T; }
  function dimKey(key) { return TI.idx[key + '_D'] != null ? key + '_D' : key; }
  function buildTreeIfNeeded() {
    const svg = $('rpTreeSvg');
    if (TREE && TREE.built && TREE.cls === S.classId) return;
    svg.innerHTML = '';
    const nodes = NODES.filter(nd => isFinite(nd.X) && isFinite(nd.Y));
    const xs = nodes.map(nd => nd.X), ys = nodes.map(nd => nd.Y);
    const pad = 300;
    const full = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
    const NS = 'http://www.w3.org/2000/svg';
    const gL = document.createElementNS(NS, 'g'), gN = document.createElementNS(NS, 'g'), gT = document.createElementNS(NS, 'g');
    const done = new Set();
    for (const nd of nodes) for (const l of nd.Links || []) {
      const m = NODE[l]; if (!m || !isFinite(m.X)) continue;
      const key = [nd.Id, l].sort().join('|'); if (done.has(key)) continue; done.add(key);
      const ln = document.createElementNS(NS, 'line');
      ln.setAttribute('x1', nd.X); ln.setAttribute('y1', nd.Y); ln.setAttribute('x2', m.X); ln.setAttribute('y2', m.Y);
      ln.setAttribute('class', 'tl' + (/^waygate/.test(nd.Id) && /^waygate/.test(l) ? ' way' : ''));
      ln.dataset.a = nd.Id; ln.dataset.b = l; gL.appendChild(ln);
    }
    const radii = { Start: 62, Keystone: 50, Notable: 38, Choice: 32, Socket: 30, Small: 22, Attribute: 15 };
    TREE = { built: true, cls: S.classId, full, vb: null, adj: treeAdj(), icons: new Map(), nodes, svg, sel: null, undo: [], drag: null };
    for (const nd of nodes) {
      const r = radii[nd.Kind] || 20, key = treeIconKey(nd);
      if (key) {
        const s = document.createElementNS(NS, 'svg');
        s.setAttribute('x', nd.X - r); s.setAttribute('y', nd.Y - r); s.setAttribute('width', 2 * r); s.setAttribute('height', 2 * r);
        s.setAttribute('viewBox', iconBox(dimKey(key))); s.setAttribute('class', 'ti');
        const im = document.createElementNS(NS, 'image');
        im.setAttribute('href', TI.src); im.setAttribute('width', TI.cols * TI.T); im.setAttribute('height', TI.rows * TI.T);
        s.appendChild(im); gN.appendChild(s);
        TREE.icons.set(nd.Id, { el: s, key, cur: dimKey(key) });
      }
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', nd.X); c.setAttribute('cy', nd.Y); c.setAttribute('r', r);
      c.setAttribute('class', 'tn k-' + nd.Kind + (key ? ' ic' : '')); c.dataset.id = nd.Id;
      gN.appendChild(c);
      if (nd.Kind === 'Notable' || nd.Kind === 'Keystone' || nd.Kind === 'Start') {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', nd.X); t.setAttribute('y', nd.Y - r - 14); t.setAttribute('class', 'tlabel'); t.dataset.id = nd.Id;
        t.textContent = nd.Kind === 'Start' ? classLabel(S.classId) : nodeName(nd);
        gT.appendChild(t);
      }
    }
    svg.append(gL, gN, gT);
    // Zoom controls
    const stage = $('rpTreeStage');
    let z = stage.querySelector('.rp-zoom');
    if (!z) {
      z = document.createElement('div'); z.className = 'rp-zoom';
      z.innerHTML = '<button type="button" data-zoom="in">+</button><button type="button" data-zoom="out">−</button><button type="button" data-zoom="fit">⌂</button>';
      stage.appendChild(z);
    }
    z.onclick = e => {
      const b = e.target.closest('[data-zoom]'); if (!b) return;
      if (b.dataset.zoom === 'fit') return fitTree(false);
      const v = TREE.vb, f = b.dataset.zoom === 'in' ? 1 / 1.35 : 1.35;
      zoomTreeAt(f, v[0] + v[2] / 2, v[1] + v[3] / 2);
    };
    bindTreePointer();
    fitTree(false);
  }
  function setTreeVB(vb) {
    if (!TREE) return;
    TREE.vb = vb; $('rpTreeSvg').setAttribute('viewBox', vb.join(' '));
  }
  function fitTree(all) {
    if (!TREE) return;
    const have = [...allocSet(), treeStart()].map(id => NODE[id]).filter(nd => nd && isFinite(nd.X));
    const box = $('rpTreeStage').getBoundingClientRect();
    const aspect = box.width && box.height ? box.width / box.height : TREE.full[2] / TREE.full[3];
    let x0, y0, x1, y1;
    if (!all) {
      const start = NODE[treeStart()];
      if (start) {
        const near = NODES.filter(nd => isFinite(nd.X) && Math.hypot(nd.X - start.X, nd.Y - start.Y) < 1350);
        x0 = Math.min(...near.map(nd => nd.X)) - 250; x1 = Math.max(...near.map(nd => nd.X)) + 250;
        y0 = Math.min(...near.map(nd => nd.Y)) - 250; y1 = Math.max(...near.map(nd => nd.Y)) + 250;
      } else { [x0, y0] = TREE.full; x1 = x0 + TREE.full[2]; y1 = y0 + TREE.full[3]; }
    } else { [x0, y0] = TREE.full; x1 = x0 + TREE.full[2]; y1 = y0 + TREE.full[3]; }
    let w = x1 - x0, h = y1 - y0;
    if (w / h < aspect) { const nw = h * aspect; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / aspect; y0 -= (nh - h) / 2; h = nh; }
    setTreeVB([x0, y0, w, h]);
  }
  function zoomTreeAt(f, cx, cy) {
    if (!TREE || !TREE.vb) return;
    const [x, y, w, h] = TREE.vb;
    const nw = Math.min(TREE.full[2] * 1.5, Math.max(700, w * f)), k = nw / w;
    setTreeVB([cx - (cx - x) * k, cy - (cy - y) * k, nw, h * k]);
  }
  function treePoint(ev) {
    const r = $('rpTreeStage').getBoundingClientRect(), [x, y, w, h] = TREE.vb;
    return [x + (ev.clientX - r.left) / r.width * w, y + (ev.clientY - r.top) / r.height * h];
  }
  function bindTreePointer() {
    const stage = $('rpTreeStage'), svg = $('rpTreeSvg');
    if (stage.dataset.bound) return;
    stage.dataset.bound = '1';
    svg.addEventListener('wheel', e => { e.preventDefault(); const [cx, cy] = treePoint(e); zoomTreeAt(e.deltaY > 0 ? 1.12 : .89, cx, cy); }, { passive: false });
    let drag = null;
    svg.addEventListener('pointerdown', e => {
      if (e.target.closest('.tn')) return;
      drag = { x: e.clientX, y: e.clientY, vb: TREE.vb.slice() };
      svg.setPointerCapture(e.pointerId); svg.classList.add('dragging');
    });
    svg.addEventListener('pointermove', e => {
      if (!drag) return;
      const r = stage.getBoundingClientRect();
      setTreeVB([drag.vb[0] - (e.clientX - drag.x) / r.width * drag.vb[2], drag.vb[1] - (e.clientY - drag.y) / r.height * drag.vb[3], drag.vb[2], drag.vb[3]]);
    });
    const end = () => { drag = null; svg.classList.remove('dragging'); };
    svg.addEventListener('pointerup', end); svg.addEventListener('pointerleave', end);
    svg.addEventListener('pointermove', e => {
      const g = e.target.closest('.tn'); if (g && !drag) showTreeDetail(g.dataset.id);
    });
    svg.addEventListener('click', e => {
      const g = e.target.closest('.tn'); if (g) clickNode(g.dataset.id);
    });
  }
  function paintTree() {
    if (!TREE || !TREE.built) return;
    const have = allocSet(), s0 = treeStart(), adj = treeAdj();
    const next = new Set();
    for (const id of [s0, ...have]) for (const v of adj[id] || []) if (!have.has(v) && !treeBlocked(v)) next.add(v);
    const q = lc(($('rpTreeSearch').value || '').trim());
    for (const c of $('rpTreeSvg').querySelectorAll('circle.tn')) {
      const id = c.dataset.id, nd = NODE[id], on = have.has(id) || id === s0;
      c.classList.toggle('alloc', on); c.classList.toggle('next', !on && next.has(id)); c.classList.toggle('sel', id === TREE.sel);
      c.style.opacity = on ? '1' : (next.has(id) ? '.85' : '.3');
      const ic = TREE.icons.get(id);
      if (ic) { const want = on ? ic.key : dimKey(ic.key); if (ic.cur !== want) { ic.el.setAttribute('viewBox', iconBox(want)); ic.cur = want; }
        ic.el.style.opacity = on ? '1' : (next.has(id) ? '.72' : '.22'); }
      let found = false;
      if (q) found = lc(nd.Name + ' ' + (nd.Text || '') + ' ' + (nd.Mods || []).map(m => modText(m)).join(' ')).includes(q);
      c.classList.toggle('found', found);
    }
    for (const ln of $('rpTreeSvg').querySelectorAll('line.tl')) {
      const a = NODE[ln.dataset.a], b = NODE[ln.dataset.b];
      const near = a && b && !/waygate|seam/i.test(ln.dataset.a + ln.dataset.b) && (Math.hypot(a.X - b.X, a.Y - b.Y) < 600 || ln.dataset.a === s0 || ln.dataset.b === s0);
      ln.classList.toggle('alloc', near && (have.has(ln.dataset.a) || ln.dataset.a === s0) && (have.has(ln.dataset.b) || ln.dataset.b === s0));
    }
    for (const t of $('rpTreeSvg').querySelectorAll('text.tlabel')) t.classList.toggle('alloc', have.has(t.dataset.id));
    $('rpTreeStatus').textContent = pointsUsed() + ' / ' + pointsBudget() + ' 点 · 点击节点加点或退款；悬停查看伤害变化。';
    $('rpTreeUndo').disabled = !TREE.undo.length;
    if (TREE.sel) showTreeDetail(TREE.sel);
  }
  function nodeGain(id) {
    if (!TREE || !R || !R.totalDps) return null;
    const have = allocSet();
    let list, cost;
    if (have.has(id)) { const rem = refundList(have, id); const rs = new Set(rem); list = [...have].filter(x => !rs.has(x)); cost = -rem.length; }
    else {
      if (!treeCanAdd(id)) return null;
      list = [...have, id];
      const nd = NODE[id];
      if (nd && nd.Choice) list = list.filter(x => x === id || !NODE[x] || NODE[x].Choice !== nd.Choice);
      cost = 1;
    }
    const ch = Object.assign({}, S, { passives: [treeStart(), ...list] });
    const rr = calcFor(ch, S.mainSkill);
    if (!rr || rr.error || !isFinite(rr.totalDps)) return null;
    return { gain: rr.totalDps / R.totalDps - 1, cost, base: rr.totalDps };
  }
  function showTreeDetail(id) {
    const nd = NODE[id]; if (!nd || !TREE) return;
    TREE.sel = id;
    const on = allocSet().has(id);
    const lines = (nd.Mods || []).filter(m => !['Keystone', 'Trigger', 'Dragonling'].includes(m.Mode)).map(m => modText(m)).filter(Boolean);
    const g = nodeGain(id);
    let h = '<div class="kind">' + esc(nd.Kind) + (nd.Region ? ' · ' + esc(nd.Region) : '') + '</div><h3>' + esc(nodeName(nd)) + '</h3>';
    h += '<ul>' + (lines.length ? lines.map(x => '<li>' + esc(x) + '</li>').join('') : '<li>没有数值词条。</li>') + '</ul>';
    if (nd.Text && (nd.Kind === 'Keystone' || nd.Kind === 'Notable' || nd.Kind === 'Socket') && nd.Text !== lines.join(' ')) h += '<p>' + esc(nd.Text) + '</p>';
    if (g) h += '<div class="rp-gain ' + (g.gain > .0005 ? 'up' : g.gain < -.0005 ? 'down' : '') + '">' + (on ? '退款' : '加点') + '：' + pct(g.gain) + ' ' + esc(skillName(S.mainSkill)) + ' DPS' + (on ? '' : ' · 1 点') + '</div>';
    else if (!on && !treeCanAdd(id)) h += '<div class="rp-gain">需要先点亮相邻节点，不能凭空加点。</div>';
    else h += '<div class="rp-gain">选择一个伤害技能后显示 DPS 变化。</div>';
    h += '<div class="actions"><button type="button" class="rp-btn small ' + (on ? '' : 'main') + '" id="rpNodeTake">' + (on ? '取消此点' : '加一点') + '</button></div>';
    $('rpTreeDetail').innerHTML = h;
    const b = $('rpNodeTake'); if (b) b.onclick = () => clickNode(id);
    paintTreeClassesOnly();
  }
  function paintTreeClassesOnly() {
    if (!TREE) return;
    const have = allocSet(), s0 = treeStart();
    for (const c of $('rpTreeSvg').querySelectorAll('circle.tn')) c.classList.toggle('sel', c.dataset.id === TREE.sel);
  }
  function normalizePassives(st) {
    const start = 'start_' + lc(st.classId || 'warrior');
    const raw = (st.passives || []).map(realNode).filter(id => NODE[id] && id !== start);
    const given = new Set(raw);
    if (!NODE[start] || !given.size) { st.passives = raw.filter((id, i, a) => a.indexOf(id) === i); return st; }
    // Keep only the component actually connected to this class's start.
    const seen = new Set([start]), q = [start];
    while (q.length) {
      const id = q.shift();
      for (const v of NODE[id].Links || []) if (given.has(v) && !seen.has(v)) { seen.add(v); q.push(v); }
    }
    const dropped = raw.filter(id => !seen.has(id));
    // Choice altars keep only one option.
    const chosen = new Map();
    const kept = new Set();
    for (const id of [...seen].filter(id => id !== start)) {
      const ch = NODE[id] && NODE[id].Choice;
      if (ch) { if (chosen.has(ch)) continue; chosen.set(ch, id); }
      kept.add(id);
    }
    // DFS from the start: a valid, connected allocation order.
    const out = [], visited = new Set([start]);
    (function walk(id) {
      for (const v of NODE[id].Links || []) {
        if (!kept.has(v) || visited.has(v)) continue;
        visited.add(v); out.push(v); walk(v);
      }
    })(start);
    let passives = out.filter((id, i, a) => a.indexOf(id) === i);
    const maxPassive = Math.min(MAX_PASSIVE_POINTS, (st.level - 1) * (n(H.PassivePointsPerLevel) || 1) + (st.bonusPoints || 0));
    if (passives.length > maxPassive) {
      st._importWarnings = (st._importWarnings || []).slice();
      st._importWarnings.push('天赋点超过上限 ' + Math.round(maxPassive) + '，多余的 ' + (passives.length - maxPassive) + ' 点已忽略');
      passives = passives.slice(0, Math.round(maxPassive));
    }
    st.passives = passives;
    if (dropped.length) {
      st._importWarnings = (st._importWarnings || []).slice();
      st._importWarnings.push('导入了 ' + dropped.length + ' 个与职业起点不相连的天赋点，已忽略：' + dropped.slice(0, 8).join('、') + (dropped.length > 8 ? '…' : ''));
    }
    return st;
  }

  function treeCanAdd(id) {
    const nd = NODE[id];
    if (!nd || treeBlocked(id) || nd.Kind === 'Start' || allocSet().has(id)) return false;
    const links = nd.Links || [];
    return links.some(v => allocSet().has(v) || v === treeStart());
  }
  function clickNode(id) {
    const nd = NODE[id]; if (!nd || treeBlocked(id) || nd.Kind === 'Start') return;
    if (!TREE.undo) TREE.undo = [];
    TREE.undo.push((S.passives || []).slice()); if (TREE.undo.length > 40) TREE.undo.shift();
    const have = allocSet();
    if (have.has(id)) {
      const rem = refundList(have, id);
      S.passives = (S.passives || []).filter(x => !rem.includes(realNode(x)));
      showTreeDetail(id); done(); return;
    }
    if (!treeCanAdd(id)) return toast('只能点亮已经与已点节点相连的节点；先点它的相邻节点', true);
    const free = pointsBudget() - pointsUsed();
    if (free < 1) return toast('天赋点不够', true);
    // Choice altars keep only one option.
    const altar = nd.Choice;
    if (altar) S.passives = (S.passives || []).filter(x => !(NODE[realNode(x)] && NODE[realNode(x)].Choice === altar));
    S.passives = (S.passives || []).filter(x => realNode(x) !== id);
    S.passives.push(id);
    showTreeDetail(id); done();
  }
  function treeUndo() {
    if (!TREE || !TREE.undo.length) return;
    S.passives = TREE.undo.pop(); done();
  }

  function showBestTree() {
    if (!TREE || !R) return;
    const have = allocSet(), free = pointsBudget() - pointsUsed(), adj = treeAdj();
    const cands = [];
    for (const nd of NODES) {
      if (have.has(nd.Id) || treeBlocked(nd.Id) || nd.Kind === 'Start') continue;
      if (![...adj[nd.Id] || []].some(v => have.has(v) || v === treeStart())) continue;
      if (!treeCanAdd(nd.Id) || free < 1) continue;
      const g = nodeGain(nd.Id); if (!g || !(g.gain > 0.0005)) continue;
      cands.push({ id: nd.Id, g: g.gain, cost: 1, name: nodeName(nd), kind: nd.Kind });
    }
    cands.sort((a, b) => b.g - a.g);
    const top = cands.slice(0, 12);
    $('rpTreeDetail').innerHTML = '<div class="kind">BEST NEXT</div><h3>最佳下一点</h3><p>按每点 DPS 收益排序，已包含路径成本。</p>' +
      (top.length ? '<div class="rp-best">' + top.map(x => '<button type="button" class="rp-best-row" data-best="' + attr(x.id) + '"><span><b>' + esc(x.name) + '</b><small>' + esc(x.kind) + ' · ' + x.cost + ' 点</small></span><em>' + pct(x.g) + '</em></button>').join('') + '</div>' : '<p>当前没有能提高该技能 DPS 的相邻节点。</p>');
    $('rpTreeDetail').querySelectorAll('[data-best]').forEach(b => b.onclick = () => clickNode(b.dataset.best));
  }

  /* ----------------------------------------------------------------- dragon */
  function dragonTree() { return GD.dragon.classes[lc(S.classId)] || {}; }
  function dragonPoints() {
    const base = MILESTONES.filter(l => S.level >= l).length + (RULES.hatch || 0);
    return Math.min(MAX_DRAGON_POINTS, base + clamp(n(S.dragonExtra), 0, Math.max(0, MAX_DRAGON_POINTS - base)));
  }
  function clampDragonPoints() {
    const max = dragonPoints();
    if ((S.dragonNodes || []).length > max) {
      S.dragonNodes = S.dragonNodes.slice(0, max);
      toast('龙裔点上限为 ' + max + '，多余节点已移除', true);
    }
  }
  function dragonTaken() { return new Set((S.dragonNodes || []).filter(id => dragonTree()[id])); }
  function dragonAdj() {
    const T = dragonTree(), adj = {};
    for (const id in T) adj[id] = adj[id] || new Set();
    for (const nd of Object.values(T)) for (const l of nd.Links || []) if (T[l]) { adj[nd.Id].add(l); adj[l] = adj[l] || new Set(); adj[l].add(nd.Id); }
    return adj;
  }
  function dragonCore() { return Object.values(dragonTree()).find(nd => nd.Kind === 'Core'); }
  function dragonCrown(nd) { return (RULES.crownKinds || ['Keystone', 'Capstone']).includes(nd.Kind); }
  function dragonConnected(set, drop) {
    const T = dragonTree(), core = dragonCore(); if (!core) return true;
    const adj = dragonAdj(), seen = new Set([core.Id]), q = [core.Id];
    for (let i = 0; i < q.length; i++) for (const v of adj[q[i]] || []) if (set.has(v) && v !== drop && !seen.has(v)) { seen.add(v); q.push(v); }
    return [...set].every(id => id === drop || seen.has(id));
  }
  function dragonState(id) {
    const T = dragonTree(), nd = T[id], taken = dragonTaken();
    if (!nd) return { s: 'none' };
    if (nd.Kind === 'Core') return { s: 'core' };
    if (taken.has(id)) return dragonConnected(taken, id) ? { s: 'taken' } : { s: 'taken', why: '其他节点挂在它下面，先退那些' };
    if (dragonCrown(nd) && [...taken].some(t => T[t] && dragonCrown(T[t]))) return { s: 'blocked', why: '一次只能有一个 Keystone / Capstone' };
    const adj = dragonAdj(), core = dragonCore();
    if (![...adj[id] || []].some(v => taken.has(v) || (core && v === core.Id))) return { s: 'locked', why: '还没有连到已点节点' };
    return { s: 'open' };
  }
  function dragonToggle(id) {
    const st = dragonState(id), nd = dragonTree()[id];
    if (!nd) return { msg: '未知龙裔节点' };
    if (st.s === 'open') return { nodes: [...(S.dragonNodes || []), id] };
    if (st.s === 'taken' && !st.why) return { nodes: S.dragonNodes.filter(x => x !== id) };
    return { msg: nd.Name + '：' + (st.why || '还不能点') };
  }
  function dragonIcon(nd, on) {
    if (!TI) return '';
    const keys = [nd.Icon];
    if (GD.dragon.ascend && GD.dragon.ascend.enabled && GD.dragon.ascend.classes.includes(lc(S.classId)) && nd.Ascend && nd.Ascend.Icon) keys.unshift(nd.Ascend.Icon);
    const key = keys.find(k => k && TI.idx[k] != null);
    if (!key) return '';
    const k = on || TI.idx[key + '_D'] == null ? key : key + '_D';
    const i = TI.idx[k], r = ({ Core: 30, Small: 13, Shared: 13, Notable: 18, Keystone: 22, Capstone: 23 })[nd.Kind] || 14;
    return '<svg class="ti" x="' + (nd.X - r) + '" y="' + (nd.Y - r) + '" width="' + 2 * r + '" height="' + 2 * r + '" viewBox="' + ((i % TI.cols) * TI.T) + ' ' + (Math.floor(i / TI.cols) * TI.T) + ' ' + TI.T + ' ' + TI.T + '"><image href="' + attr(TI.src) + '" width="' + (TI.cols * TI.T) + '" height="' + (TI.rows * TI.T) + '"/></svg>';
  }
  function renderDragon() {
    const T = dragonTree(), nodes = Object.values(T);
    const svg = $('rpDragonSvg');
    if (!nodes.length) { svg.innerHTML = ''; $('rpDragonDetail').innerHTML = '<div class="rp-empty">这个职业没有龙裔树。</div>'; return; }
    const taken = dragonTaken();
    $('rpAspects').innerHTML = Object.keys(GD.dragon.aspects || {}).map(a => '<button type="button" class="rp-aspect ' + (S.dragonAspect === a ? 'on' : '') + '" data-aspect="' + attr(a) + '">' + esc(aspectName(a)) + '</button>').join('');
    $('rpDragonExtra').value = S.dragonExtra;
    const adj = dragonAdj();
    let lines = '';
    for (const nd of nodes) for (const l of adj[nd.Id] || []) if (nd.Id < l) {
      const m = T[l], on = (taken.has(nd.Id) || nd.Kind === 'Core') && (taken.has(l) || m.Kind === 'Core');
      lines += '<line class="dl' + (on ? ' on' : '') + '" x1="' + nd.X + '" y1="' + nd.Y + '" x2="' + m.X + '" y2="' + m.Y + '"/>';
    }
    let dots = '';
    for (const nd of nodes) {
      const st = dragonState(nd.Id), on = st.s === 'taken' || st.s === 'core';
      const icon = dragonIcon(nd, on);
      const cls = 'dn ' + st.s + (icon ? ' ic' : '') + (dragonCrown(nd) ? ' crown' : '') + (TREE && TREE.dragonSel === nd.Id ? ' sel' : '');
      const label = (nd.Kind === 'Core' || nd.Kind === 'Keystone' || nd.Kind === 'Capstone' || nd.Kind === 'Notable') ? '<text x="' + (nd.X + 17) + '" y="' + (nd.Y + 3) + '">' + esc(dragonName(nd)) + '</text>' : '';
      dots += '<g class="' + cls + '" data-dragon="' + attr(nd.Id) + '">' + icon + '<circle cx="' + nd.X + '" cy="' + nd.Y + '" r="' + (({ Core: 30, Small: 12, Shared: 12, Notable: 17, Keystone: 21, Capstone: 22 })[nd.Kind] || 12) + '"/>' + label + '</g>';
    }
    svg.setAttribute('viewBox', '-560 -640 1120 1100');
    svg.innerHTML = lines + dots;
    $('rpDragonStatus').textContent = (S.dragonNodes || []).length + ' / ' + dragonPoints() + ' 点 · ' + (S.dragonAspect ? aspectName(S.dragonAspect) : '未选形态') + ' · 点击节点加点；一次一个王冠节点。';
    if (!svg.dataset.bound) {
      svg.dataset.bound = '1';
      svg.addEventListener('click', e => {
        const g = e.target.closest('[data-dragon]'); if (!g) return;
        const id = g.dataset.dragon, r = dragonToggle(id);
        if (!r.nodes) { $('rpDragonStatus').textContent = r.msg; return; }
        S.dragonNodes = r.nodes; done(); showDragonDetail(id);
      });
      svg.addEventListener('pointermove', e => { const g = e.target.closest('[data-dragon]'); if (g) showDragonDetail(g.dataset.dragon); });
    }
    if (TREE && TREE.dragonSel) showDragonDetail(TREE.dragonSel);
  }
  function showDragonDetail(id) {
    const nd = dragonTree()[id]; if (!nd) return;
    if (TREE) TREE.dragonSel = id;
    const asc = GD.dragon.ascend && GD.dragon.ascend.enabled && GD.dragon.ascend.classes.includes(lc(S.classId)) && nd.Ascend;
    const name = asc ? asc.Name + '（升华 ' + dragonName(nd) + '）' : dragonName(nd);
    const mods = asc ? asc.Mods : nd.Mods;
    const lines = (mods || []).filter(m => m.Mode !== 'Flag' && m.Mode !== 'Trigger').map(m => SIM.modText(GD, { stat: m.Stat, mode: m.Mode, tags: m.Tags || [], v: m.Value || 0, v2: m.Value2 || 0 })).filter(Boolean);
    const st = dragonState(id);
    const text = asc ? asc.Text : (nd.AspectText && S.dragonAspect && typeof nd.AspectText === 'object' ? nd.AspectText[S.dragonAspect] : nd.Text);
    let h = '<div class="kind">' + esc(nd.Kind) + (nd.Path ? ' · ' + esc(pathName(nd.Path)) : '') + '</div><h3>' + esc(name) + '</h3>';
    h += '<ul>' + (lines.length ? lines.map(x => '<li>' + esc(x) + '</li>').join('') : '<li>没有数值词条。</li>') + '</ul>';
    if (text) h += '<p>' + esc(text) + '</p>';
    if (st.why) h += '<p>' + esc(st.why) + '</p>';
    if (nd.Kind !== 'Core') h += '<div class="actions"><button class="rp-btn small ' + (st.s === 'taken' ? '' : 'main') + '" id="rpDragonTake">' + (st.s === 'taken' ? '取消此点' : '加一点') + '</button></div>';
    $('rpDragonDetail').innerHTML = h;
    const b = $('rpDragonTake'); if (b) b.onclick = () => { const r = dragonToggle(id); if (!r.nodes) return toast(r.msg, true); S.dragonNodes = r.nodes; done(); showDragonDetail(id); };
  }

  /* --------------------------------------------------------------- import/export */
  function openImport() {
    let tab = 'code';
    function draw() {
      const body = tab === 'code' ? '<textarea class="rp-textarea" id="rpImportCode" placeholder="BO1.…（游戏天赋树代码）或 BOP1.…（本站完整计划）"></textarea><div class="rp-hint">BO1 不含装备滚动值；BOP1 含装备、词缀、神像、天赋、龙裔和技能。</div>'
        : tab === 'save' ? '<label class="rp-drop" for="rpSaveFile">点击选择 <b>BO_Char_….sav</b> 存档或 JSON 存档（只在浏览器内读取，不上传）</label><input id="rpSaveFile" type="file" accept=".sav,.json,.txt" hidden><textarea class="rp-textarea" id="rpImportJson" style="margin-top:9px" placeholder="或粘贴 BOP1 / JSON…"></textarea>'
          : '<textarea class="rp-textarea" id="rpImportApi" placeholder="粘贴公开 API 的完整构筑 JSON"></textarea><div class="rp-hint">会保留 build.items、skills、passive_nodes、ascendancy 和 measured.guardian_dps_median。</div>';
      modal(modalHead('导入构筑') + '<div class="rp-modal-body"><div class="rp-edit-tabs">' +
        '<button data-itab="code" class="' + (tab === 'code' ? 'on' : '') + '">代码</button>' +
        '<button data-itab="save" class="' + (tab === 'save' ? 'on' : '') + '">存档 / JSON</button>' +
        '<button data-itab="api" class="' + (tab === 'api' ? 'on' : '') + '">公开 API</button></div>' + body + '</div>' +
        '<div class="rp-modal-foot"><button class="rp-btn" type="button" data-close>取消</button><button class="rp-btn main" type="button" id="rpImportGo">导入</button></div>', root => {
          root.querySelectorAll('[data-itab]').forEach(b => b.onclick = () => { tab = b.dataset.itab; draw(); });
          const file = root.querySelector('#rpSaveFile');
          if (file) file.onchange = () => {
            const f = file.files && file.files[0]; if (!f) return;
            const rd = new FileReader();
            rd.onload = () => {
              try {
                if (/\.sav$/i.test(f.name)) applyImported(fromSaveProps(readGVAS(rd.result)), '存档');
                else importJson(new TextDecoder().decode(rd.result));
              } catch (e) { reportError(e); }
            };
            rd.readAsArrayBuffer(f);
          };
          root.querySelector('#rpImportGo').onclick = () => {
            try {
              if (tab === 'code') importCode(root.querySelector('#rpImportCode').value);
              else if (tab === 'api') importJson(root.querySelector('#rpImportApi').value, true);
              else importJson(root.querySelector('#rpImportJson').value);
            } catch (e) { reportError(e); }
          };
        });
    }
    draw();
  }
  function reportError(e) { if (MODAL) { const b = MODAL.querySelector('.rp-modal-body'); if (b) b.insertAdjacentHTML('beforeend', '<div class="rp-report" style="border-color:#7a3030;color:#f0b5a8">' + esc(e.message || e) + '</div>'); } else toast(e.message || String(e), true); }
  function importReport(st, how) {
    const gear = (st.items || []).filter(x => x.slot !== 'Idol').length, idols = (st.items || []).filter(x => x.slot === 'Idol').length;
    const warns = (st._importWarnings || []).slice();
    const lostIdols = (st.items || []).filter(x => x.slot === 'Idol' && x.gx < 0);
    if (lostIdols.length) warns.push('有 ' + lostIdols.length + ' 个神像因格子不足没有自动放下：' + lostIdols.map(x => itemName(x)).join('、'));
    if (st.official && st.official.dps) warns.push('游戏实测中位 DPS：' + big(st.official.dps) + '（公开 API，不是本站计算）');
    if (pointsUsed && (st.passives || []).length > ((st.level - 1) * (n(H.PassivePointsPerLevel) || 1) + (st.bonusPoints || 0))) warns.push('天赋点超过等级预算，已按导入值保留');
    if ((st.dragonNodes || []).length > MILESTONES.filter(l => st.level >= l).length + (RULES.hatch || 0) + n(st.dragonExtra)) warns.push('龙裔点超过预算，已按导入值保留');
    return '<div class="rp-report"><b>导入完成（' + esc(how) + '）</b>：' + esc(classLabel(st.classId)) + ' Lv ' + st.level + ' · ' + gear + ' 件装备 + ' + idols + ' 个神像 · ' + Object.keys(st.gemLevels || {}).length + ' 个宝石等级 · 天赋 ' + (st.passives || []).length + ' · 龙裔 ' + (st.dragonNodes || []).length + (warns.length ? '<ul>' + warns.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>' : '') + '</div>';
  }
  function applyImported(st, how) {
    S = normalizeState(st);
    const base = MILESTONES.filter(l => S.level >= l).length + (RULES.hatch || 0);
    if ((S.dragonNodes || []).length > base + (S.dragonExtra || 0)) S.dragonExtra = Math.min(Math.max(0, MAX_DRAGON_POINTS - base), Math.max(0, (S.dragonNodes || []).length - base));
    TREE = null; DRAGON = null; closeModal(); done(); saveLocal();
    const idolN = (S.items || []).filter(it => it.slot === 'Idol').length;
    if (idolN) { setPane('overview'); toast('已导入 ' + idolN + ' 个神像，已自动摆放；可在左侧「神像」页查看或调整。'); }
    setPane('overview');
    modal(modalHead('导入报告') + '<div class="rp-modal-body">' + importReport(S, how) + '</div><div class="rp-modal-foot"><button class="rp-btn main" type="button" data-close>开始编辑</button></div>');
  }
  async function importCode(text) {
    text = String(text || '').trim(); if (!text) throw new Error('没有代码');
    if (/^BOP1\./.test(text)) { applyImported(await decodePlan(text), 'BOP1 计划'); return; }
    if (/^BO1\./.test(text)) {
      const j = await decodeBO1(text);
      const ch = SIM.characterFromCode(GD, j);
      const st = normalizeState(ch); setDragonExtraForImport(st);
      st._importWarnings = ['BO1 代码只含装备底材/传奇，不含装备的随机词缀与 roll；要完整词缀请用 .sav 或 BOP1。'];
      applyImported(st, 'BO1 代码'); return;
    }
    if (/^BO2\./.test(text)) throw new Error('旧版 BO2 代码请先用上一版导出 JSON；当前导入 BO1 / BOP1 / JSON / .sav');
    throw new Error('无法识别的代码格式（BO1 / BOP1）');
  }
  function importJson(text, forceApi) {
    text = String(text || '').trim(); if (!text) throw new Error('没有内容');
    const obj = JSON.parse(text);
    if (forceApi || obj.build || obj.api) { applyImported(fromApi(obj.api || obj, obj.main || ''), '公开 API'); return; }
    if (obj.Record) { applyImported(fromSaveProps(obj), '存档 JSON'); return; }
    applyImported(obj, 'JSON');
  }
  async function encodePlan() {
    const p = Object.assign({}, S); delete p.id; delete p.plan;
    p.classId = (CLASS[S.classId] && CLASS[S.classId].Id) || S.classId;
    return 'BOP1.' + await deflate(JSON.stringify(p));
  }
  async function encodeTreeCode() {
    const p = [treeStart(), ...(S.passives || []).filter(id => NODE[id] && NODE[id].Kind !== 'Start')];
    const json = new TextEncoder().encode(JSON.stringify({ v: 1, t: S.name, c: (CLASS[S.classId] && CLASS[S.classId].Id) || S.classId, l: S.level, p }));
    const z = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    const all = new Uint8Array(4 + z.length); new DataView(all.buffer).setUint32(0, json.length, true); all.set(z, 4);
    let bin = ''; for (let i = 0; i < all.length; i++) bin += String.fromCharCode(all[i]);
    return 'BO1.' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function openExport() {
    modal(modalHead('导出构筑') + '<div class="rp-modal-body"><div class="rp-edit-tabs"><button data-xtab="plan" class="on">BOP1 完整计划</button><button data-xtab="tree">BO1 天赋代码</button><button data-xtab="json">JSON 存档</button></div><div id="rpExportBody" class="rp-hint">正在生成…</div></div><div class="rp-modal-foot"><button class="rp-btn" type="button" data-close>关闭</button></div>', root => {
      const show = async kind => {
        root.querySelectorAll('[data-xtab]').forEach(b => b.classList.toggle('on', b.dataset.xtab === kind));
        const body = root.querySelector('#rpExportBody');
        if (kind === 'json') {
          const text = JSON.stringify(S, null, 2);
          body.innerHTML = '<textarea class="rp-textarea rp-code" readonly>' + esc(text) + '</textarea><div style="margin-top:7px;display:flex;gap:5px"><button class="rp-btn small" id="rpCopyJson">复制</button><button class="rp-btn small" id="rpDownloadJson">下载 .json</button></div>';
          root.querySelector('#rpCopyJson').onclick = () => BO.copy(text);
          root.querySelector('#rpDownloadJson').onclick = () => download('broken-oath-plan.json', text);
          return;
        }
        try {
          const code = kind === 'plan' ? await encodePlan() : await encodeTreeCode();
          body.innerHTML = '<textarea class="rp-textarea rp-code" readonly>' + esc(code) + '</textarea><div style="margin-top:7px;display:flex;gap:5px;flex-wrap:wrap"><button class="rp-btn small" id="rpCopyCode">复制代码</button><button class="rp-btn small" id="rpCopyLink">复制分享链接</button></div>';
          root.querySelector('#rpCopyCode').onclick = () => BO.copy(code);
          root.querySelector('#rpCopyLink').onclick = () => BO.copy(location.origin + location.pathname + '#code=' + encodeURIComponent(code));
        } catch (e) { body.innerHTML = '<div class="rp-report">' + esc(e.message) + '</div>'; }
      };
      root.querySelectorAll('[data-xtab]').forEach(b => b.onclick = () => show(b.dataset.xtab));
      show('plan');
    });
  }
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' })); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  /* --------------------------------------------------------------- bindings */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-edit-idol]'); if (b) return openItemEditor('Idol', +b.dataset.editIdol);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-aspect]'); if (!b) return;
    S.dragonAspect = b.dataset.aspect; done();
  });
  $('rpDragonExtra').onchange = () => { const base = MILESTONES.filter(l => S.level >= l).length + (RULES.hatch || 0); S.dragonExtra = clamp(n($('rpDragonExtra').value), 0, Math.max(0, MAX_DRAGON_POINTS - base)); clampDragonPoints(); done(); };
  $('rpDragonClear').onclick = () => { S.dragonNodes = []; done(); };
  $('rpTreeBest').onclick = showBestTree;
  $('rpTreeFit').onclick = () => fitTree(false);
  $('rpTreeAll').onclick = () => fitTree(true);
  $('rpTreeClear').onclick = () => { S.passives = []; done(); };
  $('rpTreeUndo').onclick = treeUndo;
  $('rpTreeSearch').oninput = paintTree;
  document.querySelectorAll('[data-tree-tab]').forEach(b => b.onclick = () => setPane(b.dataset.treeTab === 'dragon' ? 'dragon' : 'tree'));

})();
