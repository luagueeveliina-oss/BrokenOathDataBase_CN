// 调试：打印单个构筑的技能伤害构成
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'assets', 'data');
const sandbox = { window: {}, console, TextEncoder, TextDecoder, atob, btoa, Response, CompressionStream, DecompressionStream, setTimeout, clearTimeout };
vm.createContext(sandbox);
for (const f of ['planner_core.js', 'planner_items.js', 'planner_tree.js']) vm.runInContext(fs.readFileSync(path.join(DATA, f), 'utf8'), sandbox, { filename: f });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'site', 'assets', 'planner.js'), 'utf8'), sandbox, { filename: 'planner.js' });
const P = sandbox.window.BOPLAN;

const guides = JSON.parse(fs.readFileSync('D:/SteamLibrary/steamapps/common/Broken Oath Playtest/BrokenOath/Data/Gameplay/guides.json', 'utf8')).Guides;
const which = process.argv[2] || 'warrior_starter';
const g = guides.find(x => x.Id === which);
const obj = JSON.parse(zlib.inflateSync(Buffer.from(g.Code.split('.', 2)[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').subarray(4)).toString('utf8'));
const st = P.stateFromCode({ format: 'BO1', obj });
st.cfg = { boss: 1, shock: 0, roll: 50 };
const r = P.calc(st);
console.log('class', st.cls, 'level', st.level);
console.log('attrs', r.attrs, 'def', { life: Math.round(r.def.life), armour: Math.round(r.def.armour), res: r.def.res });
console.log('gear:');
for (const slot of P.slotList) {
  const it = st.gear[slot];
  if (!it || !it.b) continue;
  const ri = P.resolveItem(it);
  console.log(' ', slot, ri.base && ri.base.n[0], it.r, 'weapon', ri.weapon, 'sock', it.so, 'unique', it.u || '');
}
const main = r.skills[0];
console.log('\nskill', main.id, 'lv', main.lv, 'eff', main.eff.toFixed(3));
for (const k in main.perElem) {
  if (k === '__total') continue;
  const b = main.perElem[k];
  if (!b || b.min === 0) continue;
  console.log('  elem', k, 'min', b.min.toFixed(1), 'max', b.max.toFixed(1), 'inc', b.inc, 'more', b.more.toFixed(3));
}
console.log('hit', main.hit.toFixed(1), 'range', main.hitMin.toFixed(1), main.hitMax.toFixed(1));
console.log('crit', main.crit);
console.log('rate', main.rate, 'blows', main.blows);
console.log('dpsHit', Math.round(main.dpsHit), 'dot', Math.round(main.dotDps), 'total', Math.round(main.totalDps));
console.log('ail', JSON.stringify(main.ailments, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v));
console.log('warnings', r.warnings);
