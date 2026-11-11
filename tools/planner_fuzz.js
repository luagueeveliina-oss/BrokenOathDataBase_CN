// 引擎压力测试：所有技能 × 随机辅助 × 随机装备/天赋，确保不抛异常、不出 NaN
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'assets', 'data');
const sb = { window: {}, console, TextEncoder, TextDecoder, atob, btoa, Response, CompressionStream, DecompressionStream, setTimeout, clearTimeout };
vm.createContext(sb);
for (const f of ['planner_core.js', 'planner_items.js', 'planner_tree.js']) vm.runInContext(fs.readFileSync(path.join(DATA, f), 'utf8'), sb, { filename: f });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'site', 'assets', 'planner.js'), 'utf8'), sb, { filename: 'planner.js' });
const P = sb.window.BOPLAN;

let seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }
function bad(v, where, ctx) {
  if (typeof v !== 'number' || !isFinite(v) || v < 0) {
    console.log('BAD', where, v, ctx);
    return true;
  }
  return false;
}

let errors = 0, checks = 0;
function safeCalc(st, label) {
  checks++;
  try {
    const r = P.calc(st);
    if (bad(r.dps, 'dps', label)) errors++;
    if (bad(r.def.life, 'life', label)) errors++;
    for (const s of r.skills) {
      if (bad(s.totalDps, s.id + '.total', label)) errors++;
      if (bad(s.rate.cycle, s.id + '.cycle', label) || s.rate.cycle <= 0) { console.log('CYCLE', label, s.id, s.rate.cycle); errors++; }
      if (bad(s.hit, s.id + '.hit', label)) errors++;
    }
    return r;
  } catch (e) {
    console.log('THROW', label, e.message, '\n', String(e.stack).split('\n').slice(1, 4).join('\n'));
    errors++;
    return null;
  }
}

// ---- 1. 每个技能 + 随机合法辅助
for (const cls of P.core.classes.map(c => c.id)) {
  for (const sk of P.core.skills) {
    const st = P.newBuild(cls);
    const legal = P.core.supports.filter(s => P.checkSupport(sk.id, s.id).ok);
    const n = Math.floor(rnd() * 6);
    const sups = [];
    for (let i = 0; i < n && legal.length; i++) {
      const s = pick(legal);
      if (sups.indexOf(s.id) < 0) sups.push(s.id);
    }
    st.bar = [{ id: sk.id, lv: 1 + Math.floor(rnd() * 30), sup: sups }];
    safeCalc(st, cls + '/' + sk.id + '[' + sups.join(',') + ']');
  }
}

// ---- 2. 随机装备（含传奇/词缀/符文）
function randomGear(st, ilvl) {
  for (const slot of P.slotList) {
    const bs = P.slotBase[slot] || slot;
    const bases = P.items.bases.filter(b => b.slot === bs && b.lvl <= ilvl);
    if (!bases.length) continue;
    const base = pick(bases);
    const uniques = P.items.uniques.filter(u => u.base === base.id);
    if (uniques.length && rnd() < 0.25) {
      st.gear[slot] = { s: slot, b: base.id, r: 'Unique', u: pick(uniques).id, a: [], so: [], il: ilvl, q: 0, f: 0 };
    } else {
      const it = { s: slot, b: base.id, r: rnd() < 0.5 ? 'Rare' : 'Magic', a: [], u: '', so: [], il: ilvl, q: 0, f: 0 };
      const caps = P.core.consts.affixCap[it.r];
      const pool = P.items.affixes.filter(a => P.affixFits(a, base) && a.tiers[0].i <= ilvl);
      let pre = 0, suf = 0; const used = {};
      for (let k = 0; k < 20; k++) {
        const a = pick(pool);
        if (!a || used[a.grp]) continue;
        if (a.type === 'Prefix' && pre >= caps[0]) continue;
        if (a.type === 'Suffix' && suf >= caps[1]) continue;
        used[a.grp] = 1;
        it.a.push({ i: a.id, t: Math.floor(rnd() * a.tiers.length), r: Math.floor(rnd() * 101) });
        if (a.type === 'Prefix') pre++; else suf++;
      }
      for (let k = 0; k < base.sock; k++) if (rnd() < 0.6) it.so.push(pick(P.items.runes).id);
      st.gear[slot] = it;
    }
  }
  return st;
}
for (let i = 0; i < 40; i++) {
  const st = randomGear(P.newBuild(pick(P.core.classes).id), 1 + Math.floor(rnd() * 90));
  // 随机天赋
  for (const n of P.tree.nodes) if (rnd() < 0.08) st.tree.alloc[n.i] = 1;
  const dn = (P.tree.dragon.classes[st.cls] || []);
  for (const n of dn) if (rnd() < 0.3) st.dragon.nodes[n.i] = 1;
  st.dragon.aspect = pick((P.tree.dragon.aspects || []).map(a => a.id));
  for (const b of P.core.blessings) if (rnd() < 0.1) st.vows[b.id] = 1;
  const sk = pick(P.core.skills);
  const legal = P.core.supports.filter(s => P.checkSupport(sk.id, s.id).ok);
  st.bar = [{ id: sk.id, lv: 1 + Math.floor(rnd() * 25), sup: legal.slice(0, 6).map(s => s.id) }];
  safeCalc(st, 'random#' + i + '/' + st.cls + '/' + sk.id);
}

// ---- 3. 每条词缀都能在某个底材上结算
for (const a of P.items.affixes) {
  const bases = P.items.bases.filter(b => P.affixFits(a, b) && a.tiers[0].i >= 1);
  if (!bases.length) { console.log('NO BASE for affix', a.id); continue; }
  const base = bases[0];
  const st = P.newBuild('Warrior');
  const slot = base.slot === 'Ring' ? 'Ring1' : base.slot;
  st.gear[slot] = { s: slot, b: base.id, r: 'Rare', a: [{ i: a.id, t: 0, r: 100 }], u: '', so: [], il: 84, q: 0, f: 0 };
  safeCalc(st, 'affix/' + a.id);
  const line = P.modText({ s: a.s, m: a.m, t: a.t, l: a.l, lo: a.tiers[0].lo, hi: a.tiers[0].hi, lo2: a.tiers[0].lo2, hi2: a.tiers[0].hi2 });
  if (!line[0] && !line[1]) console.log('NO TEXT for affix', a.id, a.s, a.m, a.t);
}

// ---- 4. 所有天赋节点 / 龙裔节点 / 辅助宝石都能出文案
function hasText(m) {
  const t = P.modText(m);
  if (!t[0] && !t[1]) {
    // 基石 / 授予辅助 / 触发：本身是标记，界面用节点文本展示，算正常
    if (m.m === 'Flag' || m.m === 'Trigger' || m.s === 'Keystone' || m.s === 'GrantSupport' || m.s === 'Phys70') return true;
    return false;
  }
  const last = t[0].split(' ').pop();
  if (t[0] === m.s + ' ' + (m.m || '') + ' ' + last) return false;
  return true;
}
let noText = 0;
for (const n of P.tree.nodes) {
  for (const m of n.m) if (!hasText(m)) { noText++; if (noText < 25) console.log('NO TEXT node', n.i, m.s, m.m, JSON.stringify(m.t)); }
}
for (const s of P.core.supports) for (const m of s.mods) if (!hasText(m)) { noText++; if (noText < 40) console.log('NO TEXT support', s.id, m.s, m.m, JSON.stringify(m.t)); }
for (const b of P.core.blessings) for (const m of b.mods) if (!hasText(m)) { noText++; if (noText < 55) console.log('NO TEXT blessing', b.id, m.s, m.m, JSON.stringify(m.t)); }
for (const a of P.items.affixes) {
  const m = { s: a.s, m: a.m, t: a.t, l: a.l, lo: a.tiers[0].lo, hi: a.tiers[0].hi, lo2: a.tiers[0].lo2, hi2: a.tiers[0].hi2 };
  if (!hasText(m)) { noText++; if (noText < 70) console.log('NO TEXT affix', a.id, a.s, a.m, JSON.stringify(a.t)); }
}
for (const u of P.items.uniques) for (const m of u.mods) if (!hasText(m)) { noText++; if (noText < 85) console.log('NO TEXT unique', u.id, m.s, m.m, JSON.stringify(m.t)); }
console.log('missing texts:', noText);

console.log('\nchecks', checks, 'errors', errors);
process.exit(errors ? 1 : 0);
