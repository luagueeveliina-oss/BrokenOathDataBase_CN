// 构筑代码往返测试 + 数值规模自检
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'assets', 'data');
const sb = { window: {}, console, TextEncoder, TextDecoder, atob, btoa, Response, CompressionStream, DecompressionStream, setTimeout, clearTimeout, Uint8Array };
vm.createContext(sb);
for (const f of ['planner_core.js', 'planner_items.js', 'planner_tree.js']) vm.runInContext(fs.readFileSync(path.join(DATA, f), 'utf8'), sb, { filename: f });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'site', 'assets', 'planner.js'), 'utf8'), sb, { filename: 'planner.js' });
const P = sb.window.BOPLAN;

function summarize(st) {
  const r = P.calc(st);
  return {
    dps: Math.round(r.dps), eff: Math.round(r.skills[0] ? r.skills[0].dpsEff : 0),
    life: Math.round(r.def.life), armour: Math.round(r.def.armour), res: r.def.res,
    tree: r.tree, dragon: r.dragon, warns: r.warnings.length,
    skills: r.skills.map(s => [s.id, Math.round(s.totalDps)])
  };
}

// ---- 1. 新建构筑
for (const cls of ['Warrior', 'Mage', 'Ranger', 'Samurai', 'Paladin', 'Necromancer']) {
  const st = P.newBuild(cls);
  const s = summarize(st);
  console.log('newBuild', cls.padEnd(12), 'dps', String(s.dps).padStart(9), 'life', s.life, 'weapon', st.gear.MainHand.b, 'skill', st.bar[0].id, 'warns', s.warns);
}

// ---- 2. 给稀有装备加满 T1 词缀后的规模
function gearUp(st, ilvl) {
  ilvl = ilvl || 84;
  for (const slot of P.slotList) {
    let it = st.gear[slot];
    const bs = P.slotBase[slot] || slot;
    if (!it.b) {
      const bases = P.items.bases.filter(b => b.slot === bs && b.lvl <= ilvl);
      if (!bases.length) continue;
      const b = bases[bases.length - 1];
      it = { s: slot, b: b.id, r: 'Rare', a: [], u: '', so: [], il: ilvl, q: 0, f: 0 };
      st.gear[slot] = it;
    }
    if (it.r !== 'Unique') it.r = 'Rare';
    it.il = ilvl;
    it.a = [];
    if (it.r !== 'Rare') continue;
    const base = P.BASES[it.b];
    let pre = 0, suf = 0;
    const used = {};
    const pool = P.items.affixes
      .filter(a => P.affixFits(a, base) && a.tiers[0].i <= ilvl)
      .sort((a, b) => b.w - a.w);
    for (const a of pool) {
      if (used[a.grp]) continue;
      if (a.type === 'Prefix' && pre >= 3) continue;
      if (a.type === 'Suffix' && suf >= 3) continue;
      used[a.grp] = 1;
      it.a.push({ i: a.id, t: 0, r: 100 });
      if (a.type === 'Prefix') pre++; else suf++;
      if (pre >= 3 && suf >= 3) break;
    }
    const sock = base.sock || 0;
    const runes = P.items.runes.slice().sort((x, y) => (y.tier || 0) - (x.tier || 0));
    it.so = [];
    for (let i = 0; i < sock; i++) if (runes[i]) it.so.push(runes[i].id);
  }
  return st;
}
for (const cls of ['Warrior', 'Mage', 'Ranger']) {
  const st = P.newBuild(cls);
  gearUp(st, 84);
  const s = summarize(st);
  console.log('geared  ', cls.padEnd(12), 'dps', String(s.dps).padStart(9), 'life', s.life, 'armour', s.armour, 'res', JSON.stringify(s.res), 'warns', s.warns);
}

// ---- 3. 代码往返
(async () => {
  const st = gearUp(P.newBuild('Warrior'), 84);
  st.title = 'Round Trip 测试';
  st.tree.alloc['life_entry'] = 1;
  st.dragon.nodes[Object.keys(P.tree.dragon.classes.Warrior).length ? P.tree.dragon.classes.Warrior[0].i : 0] = 1;
  st.vows[P.core.blessings[0].id] = 1;
  const before = summarize(st);

  const game = await P.encodeGame(st);
  const full = await P.encodeFull(st);
  console.log('\nBO1', game.slice(0, 40) + '… len', game.length);
  console.log('BO2', full.slice(0, 40) + '… len', full.length);

  const dec1 = await P.decode(game);
  const st1 = P.stateFromCode(dec1);
  const s1 = summarize(st1);
  console.log('BO1 往返: dps', s1.dps, '(原', before.dps, ') 词缀数', Object.keys(st1.gear).reduce((a, k) => a + st1.gear[k].a.length, 0),
    '天赋', s1.tree.used, '龙裔', s1.dragon.used, '技能', s1.skills.length);

  const dec2 = await P.decode(full);
  const st2 = P.stateFromCode(dec2);
  const s2 = summarize(st2);
  console.log('BO2 往返: dps', s2.dps, '(原', before.dps, ') 词缀数', Object.keys(st2.gear).reduce((a, k) => a + st2.gear[k].a.length, 0),
    '天赋', s2.tree.used, '龙裔', s2.dragon.used, '誓约', Object.keys(st2.vows || {}).length);

  // 与游戏自带代码比对
  const guides = JSON.parse(fs.readFileSync('D:/SteamLibrary/steamapps/common/Broken Oath Playtest/BrokenOath/Data/Gameplay/guides.json', 'utf8')).Guides;
  const g = guides.find(x => x.Id === 'warrior_boss');
  const dec3 = await P.decode(g.Code);
  const st3 = P.stateFromCode(dec3);
  const s3 = summarize(st3);
  console.log('\n游戏代码导入:', g.Id, '职业', st3.cls, '等级', st3.level, '天赋', s3.tree.used, '龙裔', s3.dragon.used,
    '技能', s3.skills, '装备', Object.values(st3.gear).filter(x => x.b).length, 'dps', s3.dps);
  const reenc = await P.encodeGame(st3);
  const dec4 = await P.decode(reenc);
  // 语义一致即可：装备顺序、节点顺序不参与比较
  const keyG = o => (o.g || []).map(x => [x.s, x.b, x.r, x.u || ''].join(':')).sort().join('|');
  const keyP = o => (o.p || []).slice().sort().join('|');
  const keyS = o => JSON.stringify((o.s || []).slice().sort((a, b) => a.k.localeCompare(b.k)));
  const keyD = o => (o.dn || []).slice().sort().join('|');
  const same = dec4.obj.c === dec3.obj.c && dec4.obj.l === dec3.obj.l &&
    keyG(dec4.obj) === keyG(dec3.obj) && keyP(dec4.obj) === keyP(dec3.obj) &&
    keyS(dec4.obj) === keyS(dec3.obj) && keyD(dec4.obj) === keyD(dec3.obj) &&
    (dec4.obj.da || '') === (dec3.obj.da || '');
  console.log('重新编码语义一致:', same, '| 装备件数', (dec4.obj.g || []).length, '节点', (dec4.obj.p || []).length, '技能', (dec4.obj.s || []).length);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
