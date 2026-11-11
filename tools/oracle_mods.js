// Compact oracle dump: damage-relevant mods + sheet sections for one guide build.
'use strict';
const fs = require('fs'); const path = require('path'); const vm = require('vm'); const zlib = require('zlib');
const REF = 'C:/Users/HCJ0119/Documents/WorkSpace/broken-oath-builder';
const GAME = 'D:/SteamLibrary/steamapps/common/Broken Oath Playtest/BrokenOath/Data';
const sb = { window: {}, console, TextEncoder, TextDecoder, atob, btoa, setTimeout, clearTimeout, Uint8Array, Uint32Array, ArrayBuffer, DataView, Blob: class {}, performance: { now: () => Date.now() } };
sb.window.window = sb.window; sb.globalThis = sb; vm.createContext(sb);
const src = fs.readFileSync(path.join(REF, 'app.js'), 'utf8');
const cut = src.indexOf('root.BOSim = api;');
const iifeEnd = src.indexOf('})(typeof window', cut);
const endMark = "})(typeof window !== 'undefined' ? window : globalThis);";
vm.runInContext(src.slice(0, iifeEnd + endMark.length), sb, { filename: 'ref-app.js' });
const S = sb.window.BOSim;
const GD = JSON.parse(fs.readFileSync(path.join(REF, 'gamedata.json'), 'utf8'));
const guides = JSON.parse(fs.readFileSync(path.join(GAME, 'Gameplay/guides.json'), 'utf8')).Guides;
const id = process.argv[2] || 'warrior_boss';
const g = guides.find(x => x.Id === id);
const b = g.Code.split('.', 2)[1].replace(/-/g, '+').replace(/_/g, '/');
const j = JSON.parse(zlib.inflateSync(Buffer.from(b, 'base64').subarray(4)).toString('utf8'));
const ch = S.characterFromCode(GD, j);
const r = S.calcSkill(GD, ch, g.Skill, { enemyLevel: 84, enemyRarity: 'boss' });
console.log(id, g.Skill, 'dps', Math.round(r.totalDps), 'panel', Math.round(r.panelDps));
console.log('base', JSON.stringify(r.base));
console.log('scaleInfo', JSON.stringify(r.scaleInfo));
console.log('crit', JSON.stringify(r.crit), 'speed', JSON.stringify(r.speed));
console.log('hits', JSON.stringify(r.hits));
console.log('ailments', JSON.stringify(r.ailments));
const rel = (r.mods || []).filter(m => /Damage|Speed|Crit|Bleed|Ignite|Poison|Shock|SkillLevel|Added|Convert|Extra|More|Phys|Elemental/.test(m.stat));
const by = {};
for (const m of rel) {
  const k = m.stat + '.' + m.mode + (m.tags && m.tags.length ? '[' + m.tags.join(',') + ']' : '');
  by[k] = by[k] || { v: 0, src: [] };
  by[k].v += m.v || 0;
  if (by[k].src.length < 4) by[k].src.push(m.src);
}
for (const k of Object.keys(by).sort()) console.log(String(Math.round(by[k].v * 100) / 100).padStart(10), k, '|', by[k].src.join(' ; '));
console.log('notes', JSON.stringify((r.notes || []).slice(0, 10), null, 1));
