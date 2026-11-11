// 生成一个用于截图/演示的完整构筑代码（BO2）
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

const st = P.newBuild('Warrior');
st.title = '示例 · 重击流血战士';
// 满词缀装备
for (const slot of P.slotList) {
  const it = st.gear[slot];
  const bs = P.slotBase[slot] || slot;
  if (!it.b) {
    const bases = P.items.bases.filter(b => b.slot === bs && b.lvl <= 84);
    if (!bases.length) continue;
    st.gear[slot] = { s: slot, b: bases[bases.length - 1].id, r: 'Rare', a: [], u: '', so: [], il: 84, q: 0, f: 0 };
  }
}
for (const slot of P.slotList) {
  const it = st.gear[slot];
  if (!it.b) continue;
  if (it.r !== 'Unique') it.r = 'Rare';
  it.il = 84; it.a = []; it.so = [];
  if (it.r === 'Rare') {
    const base = P.BASES[it.b];
    let pre = 0, suf = 0; const used = {};
    const pool = P.items.affixes.filter(a => P.affixFits(a, base) && a.tiers[0].i <= 84).sort((a, b) => b.w - a.w);
    for (const a of pool) {
      if (used[a.grp]) continue;
      if (a.type === 'Prefix' && pre >= 3) continue;
      if (a.type === 'Suffix' && suf >= 3) continue;
      used[a.grp] = 1; it.a.push({ i: a.id, t: 0, r: 92 });
      if (a.type === 'Prefix') pre++; else suf++;
      if (pre >= 3 && suf >= 3) break;
    }
    const runes = P.items.runes.slice().sort((x, y) => (y.tier || 0) - (x.tier || 0));
    for (let i = 0; i < (base.sock || 0); i++) if (runes[i]) it.so.push(runes[i].id);
  }
}
// 天赋：推荐加点
const sug = (P.tree.suggested || {})['Warrior'] || [];
function pathTo(id) {
  const start = [], conn = P.connectedAlloc(st);
  for (const n of P.tree.nodes) if (n.cs === 'Warrior' || (st.tree.alloc[n.i] && conn[n.i])) start.push(n.i);
  const prev = {}, q = [...start], seen = {};
  start.forEach(s => seen[s] = 1);
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    if (cur === id) break;
    const node = P.NODE[cur]; if (!node) continue;
    for (const nx of node.l) { if (seen[nx] || !P.NODE[nx]) continue; seen[nx] = 1; prev[nx] = cur; q.push(nx); }
  }
  const out = []; let cur = id, guard = 0;
  while (cur && guard++ < 400) { out.unshift(cur); if (start.indexOf(cur) >= 0) break; cur = prev[cur]; }
  return out;
}
for (const id of sug) for (const x of pathTo(id)) st.tree.alloc[x] = 1;
// 技能 + 辅助
st.bar = [{ id: 'leap_slam', lv: 20, sup: [] }];
const legal = P.core.supports.filter(s => P.checkSupport('leap_slam', s.id).ok)
  .sort((a, b) => (b.drop || 0) - (a.drop || 0)).slice(0, 5).map(s => s.id);
st.bar[0].sup = legal;
st.bar.push({ id: 'earthshatter', lv: 20, sup: legal.slice(0, 3) });
// 龙裔
st.dragon.aspect = 'Fire';
const dn = P.tree.dragon.classes.Warrior || [];
st.dragon.nodes[dn[0].i] = 1; st.dragon.nodes[dn[1].i] = 1;
// 誓约
st.vows[P.core.blessings[0].id] = 1;

const r = P.calc(st);
console.log('demo dps', Math.round(r.dps), 'supports', legal.join(','), 'tree', r.tree, 'warns', r.warnings);

P.encodeFull(st).then(code => {
  fs.writeFileSync(path.join(ROOT, 'tools', '_demo_code.txt'), code, 'utf8');
  console.log('code len', code.length);
  console.log(code);
});
