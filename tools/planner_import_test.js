// Import/export completeness: every game guide code must restore its full configuration,
// and a BO2 full code must restore affixes/rolls/runes/vows exactly.
'use strict';
const fs = require('fs'), vm = require('vm'), zlib = require('zlib'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const GAME = 'D:/SteamLibrary/steamapps/common/Broken Oath Playtest/BrokenOath/Data';
const sb = { window: {}, console, TextEncoder, TextDecoder, atob, btoa, Response, CompressionStream, DecompressionStream, setTimeout, clearTimeout };
vm.createContext(sb);
for (const f of ['planner_core.js', 'planner_items.js', 'planner_tree.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'site/assets/data', f), 'utf8'), sb, { filename: f });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'site/assets/planner.js'), 'utf8'), sb, { filename: 'planner.js' });
const P = sb.window.BOPLAN;

function decodeGame(code) {
  const b = code.split('.', 2)[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(zlib.inflateSync(Buffer.from(b, 'base64').subarray(4)).toString('utf8'));
}
function subset(a, b) { return [...a].sort().join('|') === [...b].sort().join('|'); }

const guides = JSON.parse(fs.readFileSync(path.join(GAME, 'Gameplay/guides.json'), 'utf8')).Guides;
let fail = 0;
const rows = [];
for (const g of guides) {
  if (!g.Code) continue;
  const obj = decodeGame(g.Code);
  const st = P.stateFromCode({ format: 'BO1', obj });
  const rep = P.importReport({ format: 'BO1', obj }, st);
  const problems = [];
  const pIn = (obj.p || []).filter(id => P.NODE[id]);
  if (!subset(Object.keys(st.tree.alloc), pIn)) problems.push('tree mismatch');
  const barIds = (obj.s || []).map(s => s.k).filter(k => P.SK[k]);
  if (!subset(st.bar.map(b => b.id), barIds)) problems.push('skills mismatch');
  for (const s of obj.s || []) {
    const e = st.bar.find(b => b.id === s.k);
    if (!e) continue;
    const sups = (s.u || []).filter(x => P.SUP[x]);
    if (!subset(e.sup, sups)) problems.push('supports mismatch ' + s.k);
    if (e.lv !== s.l) problems.push('gem level mismatch ' + s.k);
  }
  const gIn = (obj.g || []).filter(x => x.b);
  if (st.gear && Object.keys(st.gear).filter(k => st.gear[k].b).length !== gIn.length) problems.push('gear count ' + Object.keys(st.gear).filter(k => st.gear[k].b).length + '/' + gIn.length);
  for (const it of gIn) {
    const slot = it.s === 'Ring' ? 'Ring1' : it.s;
    const mine = st.gear[slot];
    if (!mine || mine.b !== it.b) problems.push('base mismatch ' + it.s);
    if (it.u && (!mine || mine.u !== it.u)) problems.push('unique mismatch ' + it.s);
  }
  if (st.cls !== obj.c) problems.push('class');
  if (st.level !== obj.l) problems.push('level');
  if (rep.errors.length) problems.push('errors: ' + rep.errors.join('; '));
  if (!(rep.dps > 0)) problems.push('no dps');
  rows.push({ id: g.Id, dps: Math.round(rep.dps), gear: rep.gear.length, tree: rep.lineCount, dragon: rep.dragonCount, problems });
  if (problems.length) fail++;
}

// BO2 round trip with rolled gear
(async () => {
  const st = P.newBuild('Warrior');
  st.title = 'BO2 全量往返';
  st.level = 96;
  st.gear.MainHand = Object.assign(P.newItem('MainHand'), {
    b: 'greatmace_7', r: 'Rare', il: 84, q: 12, ur: 73,
    a: [{ i: P.items.affixes.find(a => a.type === 'Prefix' && P.affixFits(a, P.BASES.greatmace_7)).id, t: 0, r: 64 }],
    so: []
  });
  st.gear.Helm = Object.assign(P.newItem('Helm'), { b: 'plate_helm_7', r: 'Rare', il: 80, q: 20, a: [{ i: P.items.affixes.find(a => a.type === 'Suffix' && P.affixFits(a, P.BASES.plate_helm_7)).id, t: 0, r: 12 }] });
  st.vows[P.core.blessings[0].id] = 1;
  st.curses[P.core.curses[0].id] = 1;
  st.cfg = { boss: 1, shock: 1, roll: 50, rl: 77, target: 'rare', gates: 9, pinnacle: 2 };
  st.tree.socket = {};
  st.dragon.nodes[(P.tree.dragon.classes.Warrior || [])[0].i] = 1;
  const code = await P.encodeFull(st);
  const dec = await P.decode(code);
  const st2 = P.stateFromCode(dec);
  let p2 = [];
  const same =
    st2.title === st.title && st2.level === st.level &&
    st2.gear.MainHand.b === st.gear.MainHand.b &&
    st2.gear.MainHand.r === 'Rare' && st2.gear.MainHand.q === 12 && st2.gear.MainHand.ur === 73 &&
    JSON.stringify(st2.gear.MainHand.a) === JSON.stringify(st.gear.MainHand.a) &&
    JSON.stringify(st2.gear.Helm.a) === JSON.stringify(st.gear.Helm.a) &&
    Object.keys(st2.vows).length === 1 && Object.keys(st2.curses).length === 1 &&
    JSON.stringify(st2.cfg) === JSON.stringify(st.cfg) &&
    Object.keys(st2.dragon.nodes).length === 1;
  if (!same) { p2.push('BO2 round trip mismatch'); fail++; }
  const r1 = P.calc(st), r2 = P.calc(st2);
  if (Math.abs(r1.dps - r2.dps) > 1e-6) { p2.push('DPS differs after round trip'); fail++; }
  rows.push({ id: 'BO2-full', dps: Math.round(r2.dps), gear: 2, tree: 0, dragon: 1, problems: p2 });

  console.log('id'.padEnd(22), 'dps'.padStart(11), 'gear'.padStart(5), 'tree'.padStart(5), 'dragon'.padStart(7), '  status');
  for (const r of rows) {
    console.log(r.id.padEnd(22), String(r.dps).padStart(11), String(r.gear).padStart(5), String(r.tree).padStart(5), String(r.dragon).padStart(7), r.problems.length ? 'FAIL ' + r.problems.join('; ') : 'ok');
  }
  console.log('\nimport: ' + (rows.length - rows.filter(r => r.problems.length).length) + ' ok, ' + rows.filter(r => r.problems.length).length + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
