// Read-only oracle: runs the public broken-oath-builder engine (verified against the game) on
// the game's own guide build codes, so our planner can be compared against it.
// Usage: node tools/oracle_ref.js [guideId...]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const REF = 'C:/Users/HCJ0119/Documents/WorkSpace/broken-oath-builder';
const GAME = 'D:/SteamLibrary/steamapps/common/Broken Oath Playtest/BrokenOath/Data';

const sb = {
  window: {}, console, TextEncoder, TextDecoder, atob, btoa, setTimeout, clearTimeout,
  Uint8Array, Uint32Array, ArrayBuffer, DataView, Blob: class {}, performance: { now: () => Date.now() },
  document: undefined, location: undefined, navigator: undefined,
};
sb.window.window = sb.window;
sb.globalThis = sb;
vm.createContext(sb);
const src = fs.readFileSync(path.join(REF, 'app.js'), 'utf8');
// The file ends with the DamageSim page logic; only the sim module is needed (and the page needs a DOM).
const cut = src.indexOf('root.BOSim = api;');
if (cut < 0) throw new Error('BOSim export not found');
const iifeEnd = src.indexOf('})(typeof window', cut);
vm.runInContext(src.slice(0, iifeEnd + '})(typeof window !== \'undefined\' ? window : globalThis);'.length), sb, { filename: 'ref-app.js' });
const S = sb.window.BOSim;
if (!S) throw new Error('BOSim not exported');

const GD = JSON.parse(fs.readFileSync(path.join(REF, 'gamedata.json'), 'utf8'));
const guides = JSON.parse(fs.readFileSync(path.join(GAME, 'Gameplay/guides.json'), 'utf8')).Guides;

function decodeGame(code) {
  const b = code.split('.', 2)[1].replace(/-/g, '+').replace(/_/g, '/');
  const raw = zlib.inflateSync(Buffer.from(b, 'base64').subarray(4));
  return JSON.parse(raw.toString('utf8'));
}

const want = process.argv.slice(2);
const rows = [];
for (const g of guides) {
  if (want.length && !want.includes(g.Id)) continue;
  if (!g.Code) continue;
  const j = decodeGame(g.Code);
  const ch = S.characterFromCode(GD, j);
  let r;
  try {
    r = S.calcSkill(GD, ch, g.Skill, { enemyLevel: 84, enemyRarity: 'boss' });
  } catch (e) {
    console.log('ERR', g.Id, e.message);
    continue;
  }
  rows.push({
    id: g.Id, cls: ch.classId, level: ch.level, skill: g.Skill,
    hit: r.hit && r.hit.avg, dps: r.totalDps, panel: r.panelDps,
    crit: r.crit && r.crit.chance, uses: r.speed && r.speed.usesPerSec,
    guide: g.BossDps, ratio: r.totalDps / g.BossDps,
    sockets: (ch.sockets || []).map(x => [x.skill, x.supports.length]),
    notes: (r.notes || []).length,
  });
}
rows.sort((a, b) => a.ratio - b.ratio);
console.log('id'.padEnd(22), 'skill'.padEnd(20), 'hit'.padStart(12), 'dps'.padStart(14), 'panel'.padStart(14), 'guide'.padStart(12), 'ratio'.padStart(7), 'crit%'.padStart(6), 'uses');
for (const r of rows) {
  console.log(
    r.id.padEnd(22), String(r.skill).padEnd(20),
    String(Math.round(r.hit || 0)).padStart(12), String(Math.round(r.dps || 0)).padStart(14),
    String(Math.round(r.panel || 0)).padStart(14), String(r.guide).padStart(12),
    (r.ratio || 0).toFixed(2).padStart(7), (r.crit || 0).toFixed(1).padStart(6), (r.uses || 0).toFixed(2)
  );
}

// Detail for one build (--detail <id>)
const di = process.argv.indexOf('--detail');
if (di > 0) {
  const id = process.argv[di + 1];
  const g = guides.find(x => x.Id === id);
  const ch = S.characterFromCode(GD, decodeGame(g.Code));
  const r = S.calcSkill(GD, ch, g.Skill, { enemyLevel: 84, enemyRarity: 'boss' });
  const pick = ['base', 'baseParts', 'convertedParts', 'scaled', 'scaleInfo', 'crit', 'speed', 'gem', 'notes', 'blows', 'hits', 'totalDps', 'panelDps', 'ailments'];
  for (const k of pick) if (r[k] !== undefined) console.log(k, JSON.stringify(r[k], null, 1));
  console.log('mods', JSON.stringify(r.mods, null, 1).slice(0, 6000));
}
