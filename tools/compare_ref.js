// Compare our planner engine with the reference oracle on the game's guide codes.
'use strict';
const fs = require('fs'), vm = require('vm'), zlib = require('zlib'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const REF = 'C:/Users/HCJ0119/Documents/WorkSpace/broken-oath-builder';
const GAME = 'D:/SteamLibrary/steamapps/common/Broken Oath Playtest/BrokenOath/Data';

function decodeGame(code) {
  const b = code.split('.', 2)[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(zlib.inflateSync(Buffer.from(b, 'base64').subarray(4)).toString('utf8'));
}

// ---- ours
const osb = { window: {}, console, TextEncoder, TextDecoder, atob, btoa, Response, CompressionStream, DecompressionStream, setTimeout, clearTimeout, Uint8Array, Buffer };
osb.window.window = osb.window; osb.globalThis = osb; vm.createContext(osb);
for (const f of ['planner_core.js', 'planner_items.js', 'planner_tree.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'site/assets/data', f), 'utf8'), osb, { filename: f });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'site/assets/planner.js'), 'utf8'), osb, { filename: 'planner.js' });
const P = osb.window.BOPLAN;

// ---- reference
const rsb = { window: {}, console, TextEncoder, TextDecoder, atob, btoa, setTimeout, clearTimeout, Uint8Array, Uint32Array, ArrayBuffer, DataView, Blob: class {}, performance: { now: () => Date.now() } };
rsb.window.window = rsb.window; rsb.globalThis = rsb; vm.createContext(rsb);
const src = fs.readFileSync(path.join(REF, 'app.js'), 'utf8');
const cut = src.indexOf('root.BOSim = api;');
const endMark = "})(typeof window !== 'undefined' ? window : globalThis);";
vm.runInContext(src.slice(0, src.indexOf('})(typeof window', cut) + endMark.length), rsb, { filename: 'ref-app.js' });
const S = rsb.window.BOSim;
const GD = JSON.parse(fs.readFileSync(path.join(REF, 'gamedata.json'), 'utf8'));

const guides = JSON.parse(fs.readFileSync(path.join(GAME, 'Gameplay/guides.json'), 'utf8')).Guides;
const rows = [];
for (const g of guides) {
  if (!g.Code) continue;
  const j = decodeGame(g.Code);
  const st = P.stateFromCode({ format: 'BO1', obj: j });
  st.cfg = { boss: 1, shock: 0, roll: 100, rl: 84, target: 'boss', gates: 6, pinnacle: 1 };
  const r = P.calc(st);
  const main = r.skills[0] || {};
  const ch = S.characterFromCode(GD, j);
  const rr = S.calcSkill(GD, ch, g.Skill, { enemyLevel: 84, enemyRarity: 'boss' });
  rows.push({
    id: g.Id, skill: g.Skill,
    oDps: main.totalDps || 0, rDps: rr.totalDps || 0,
    oHit: main.hit || 0, rHit: rr.hitAvg || 0,
    oCrit: main.crit ? main.crit.chance : 0, rCrit: rr.crit ? rr.crit.chance : 0,
    oRate: main.rate ? 1 / main.rate.cycle : 0, rRate: rr.speed ? rr.speed.usesPerSec : 0,
    oAil: (main.ailments && main.ailments.dps) || 0,
    rBleed: (rr.ailments && rr.ailments.bleed && rr.ailments.bleed.dps) || 0,
    rIgnite: (rr.ailments && rr.ailments.ignite && rr.ailments.ignite.dps) || 0,
    rPoison: (rr.ailments && rr.ailments.poison && rr.ailments.poison.dps) || 0,
  });
}
rows.sort((a, b) => (a.oDps / a.rDps) - (b.oDps / b.rDps));
console.log('id'.padEnd(22), 'oDps'.padStart(11), 'rDps'.padStart(11), 'ratio'.padStart(6), 'oHit'.padStart(9), 'rHit'.padStart(9), 'oCrit'.padStart(6), 'rCrit'.padStart(6), 'oRate'.padStart(6), 'rRate'.padStart(6), 'rDot'.padStart(11));
for (const r of rows) {
  const dot = r.rBleed + r.rIgnite + r.rPoison;
  console.log(r.id.padEnd(22), String(Math.round(r.oDps)).padStart(11), String(Math.round(r.rDps)).padStart(11),
    (r.oDps / (r.rDps || 1)).toFixed(2).padStart(6), String(Math.round(r.oHit)).padStart(9), String(Math.round(r.rHit)).padStart(9),
    r.oCrit.toFixed(1).padStart(6), r.rCrit.toFixed(1).padStart(6), r.oRate.toFixed(2).padStart(6), r.rRate.toFixed(2).padStart(6),
    String(Math.round(dot)).padStart(11));
}
