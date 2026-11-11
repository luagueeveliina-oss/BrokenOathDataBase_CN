// Validation checks: impossible item/build combinations must be reported, never silently accepted.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const sb = { window: {}, console, TextEncoder, TextDecoder, atob, btoa, Response, CompressionStream, DecompressionStream, setTimeout, clearTimeout };
vm.createContext(sb);
for (const f of ['planner_core.js', 'planner_items.js', 'planner_tree.js']) vm.runInContext(fs.readFileSync(path.join(ROOT, 'site/assets/data', f), 'utf8'), sb, { filename: f });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'site/assets/planner.js'), 'utf8'), sb, { filename: 'planner.js' });
const P = sb.window.BOPLAN;

let pass = 0, fail = 0;
function has(list, re, label) {
  const hit = list.some(x => re.test(x));
  if (hit) { pass++; } else { fail++; console.log('  MISS', label, '\n    ', list.slice(0, 8)); }
  return hit;
}
function check(name, fn) {
  console.log('\n[' + name + ']');
  fn();
}

const weaponBase = P.items.bases.filter(b => b.slot === 'MainHand' && b.dmg).sort((a, b) => b.lvl - a.lvl)[0];
const armorBase = P.items.bases.filter(b => b.slot === 'Chest').sort((a, b) => b.lvl - a.lvl)[0];
const prefixes = P.items.affixes.filter(a => a.type === 'Prefix' && P.affixFits(a, weaponBase));
const suffixes = P.items.affixes.filter(a => a.type === 'Suffix' && P.affixFits(a, weaponBase));

check('rare weapon: 4 prefixes / 4 suffixes', () => {
  const it = { s: 'MainHand', b: weaponBase.id, r: 'Rare', il: 84, q: 0, a: [], so: [], u: '', ur: 50 };
  it.a = prefixes.slice(0, 4).map(a => ({ i: a.id, t: 0, r: 100 })).concat(suffixes.slice(0, 4).map(a => ({ i: a.id, t: 0, r: 100 })));
  const w = P.itemWarnings(it);
  has(w, /前缀超限：4 \/ 3/, 'prefix cap');
  has(w, /后缀超限：4 \/ 3/, 'suffix cap');
});

check('same affix group twice', () => {
  const a = prefixes[0];
  const it = { s: 'MainHand', b: weaponBase.id, r: 'Rare', il: 84, q: 0, a: [{ i: a.id, t: 0, r: 100 }, { i: a.id, t: 0, r: 100 }], so: [], u: '', ur: 50 };
  has(P.itemWarnings(it), /词缀组重复/, 'duplicate group');
});

check('tier above item level', () => {
  const a = prefixes.find(x => x.tiers[0].i >= 80) || prefixes[0];
  const it = { s: 'MainHand', b: weaponBase.id, r: 'Rare', il: 1, q: 0, a: [{ i: a.id, t: 0, r: 100 }], so: [], u: '', ur: 50 };
  const w = P.itemWarnings(it);
  has(w, /物品等级|词缀阶需要 ilvl/, 'tier ilvl');
});

check('too many runes / sockets', () => {
  const it = { s: 'MainHand', b: weaponBase.id, r: 'Rare', il: 84, q: 0, a: [], so: [], u: '', ur: 50 };
  it.so = new Array((weaponBase.sock || 0) + 1).fill(P.items.runes[0].id);
  has(P.itemWarnings(it), /孔位超限/, 'socket cap');
});

check('unique on the wrong base', () => {
  const u = P.items.uniques.find(x => x.base !== weaponBase.id && x.slot === 'MainHand');
  const it = { s: 'MainHand', b: weaponBase.id, r: 'Unique', il: 84, q: 0, a: [], so: [], u: u.id, ur: 50 };
  has(P.itemWarnings(it), /该传奇不在/, 'unique base mismatch');
});

check('two-handed weapon + offhand', () => {
  const st = P.newBuild('Warrior');
  const two = P.items.bases.find(b => b.slot === 'MainHand' && b.twoh && (P.CLS.Warrior.weapons || []).includes(b.cls));
  st.gear.MainHand = { s: 'MainHand', b: two.id, r: 'Normal', a: [], so: [], u: '', il: 84, q: 0, ur: 50 };
  st.gear.OffHand = { s: 'OffHand', b: P.items.bases.find(b => b.slot === 'OffHand').id, r: 'Normal', a: [], so: [], u: '', il: 84, q: 0, ur: 50 };
  has(P.validateBuild(st).warnings, /双手武器占用副手/, 'hands');
});

check('illegal support', () => {
  const st = P.newBuild('Warrior');
  st.bar = [{ id: 'ground_slam', lv: 20, sup: ['spell_echo'] }];
  has(P.validateBuild(st).warnings, /需要技能带有|不可用于/, 'support tags');
});

check('too many supports for sockets', () => {
  const st = P.newBuild('Warrior');
  const legal = P.core.supports.filter(s => P.checkSupport('ground_slam', s.id).ok).slice(0, 9).map(s => s.id);
  st.bar = [{ id: 'ground_slam', lv: 1, sup: legal }];
  has(P.validateBuild(st).warnings, /辅助数量超过插槽上限/, 'support sockets');
});

check('tree over budget / dragon over budget', () => {
  const st = P.newBuild('Warrior');
  st.level = 1;
  const ids = P.tree.nodes.filter(n => n.k !== 'Start').slice(0, 30).map(n => n.i);
  ids.forEach(id => st.tree.alloc[id] = 1);
  has(P.validateBuild(st).errors, /天赋点超出/, 'tree budget');
  const dn = (P.tree.dragon.classes.Warrior || []).slice(0, 30);
  dn.forEach(n => st.dragon.nodes[n.i] = 1);
  has(P.validateBuild(st).errors, /龙裔点超出/, 'dragon budget');
});

check('vow reservation above mana', () => {
  const st = P.newBuild('Mage');
  for (const b of P.core.blessings) st.vows[b.id] = 1;
  has(P.validateBuild(st).errors, /誓约保留.*超过魔力/, 'reservation');
});

check('duplicate support on a skill', () => {
  const st = P.newBuild('Warrior');
  st.bar = [{ id: 'ground_slam', lv: 20, sup: ['brutality', 'brutality'] }];
  const r = P.calc(st);
  has(r.warnings, /同一辅助不能重复/, 'duplicate support');
});

console.log('\nvalidation: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
