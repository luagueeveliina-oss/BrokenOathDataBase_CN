// 校验脚本：用引擎解码游戏内置指南构筑代码并计算 DPS（Node 运行，不进入站点）
// 用法: node tools/planner_test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'site', 'assets', 'data');

function load(file, varName) {
  const src = fs.readFileSync(path.join(DATA, file), 'utf8');
  return src;
}

const sandbox = {
  window: {},
  console,
  TextEncoder, TextDecoder, atob, btoa, Response,
  CompressionStream, DecompressionStream,
  setTimeout, clearTimeout
};
sandbox.window.window = sandbox.window;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
for (const f of ['planner_core.js', 'planner_items.js', 'planner_tree.js']) {
  vm.runInContext(fs.readFileSync(path.join(DATA, f), 'utf8'), sandbox, { filename: f });
}
vm.runInContext(fs.readFileSync(path.join(ROOT, 'site', 'assets', 'planner.js'), 'utf8'), sandbox, { filename: 'planner.js' });
const W = sandbox.window;
const P = W.BOPLAN;

function decodeGame(code) {
  const b = code.split('.', 2)[1].replace(/-/g, '+').replace(/_/g, '/');
  const buf = Buffer.from(b, 'base64');
  const raw = zlib.inflateSync(buf.subarray(4));
  return JSON.parse(raw.toString('utf8'));
}

const guides = JSON.parse(fs.readFileSync('D:/SteamLibrary/steamapps/common/Broken Oath Playtest/BrokenOath/Data/Gameplay/guides.json', 'utf8')).Guides;
const rows = [];
for (const g of guides) {
  if (!g.Code) continue;
  const obj = decodeGame(g.Code);
  // 用引擎自己的状态转换 + 自己的解码器（异步）
  const st = P.stateFromCode({ format: 'BO1', obj });
  st.cfg = { boss: 1, shock: 0, roll: 50 };
  let r;
  try {
    r = P.calc(st);
  } catch (e) {
    console.log('ERR', g.Id, e.stack.split('\n').slice(0, 4).join('\n'));
    continue;
  }
  const main = r.skills[0];
  rows.push({
    id: g.Id, cls: st.cls, skill: main && main.id,
    dps: main ? main.totalDps : 0,
    guideBoss: g.BossDps, guideClear: g.Clear,
    ratio: main ? main.totalDps / g.BossDps : 0,
    hit: main ? main.hit : 0, crit: main ? main.crit.chance : 0,
    cycle: main ? main.rate.cycle : 0, blows: main ? main.blows : 0,
    warns: r.warnings.length, tree: r.tree, dragon: r.dragon,
    minion: main && main.minion ? main.minion.count : null,
    life: r.def.life, dpsList: r.skills.map(s => [s.id, Math.round(s.totalDps)])
  });
}
rows.sort((a, b) => a.ratio - b.ratio);
console.log('id'.padEnd(24), 'skill'.padEnd(22), 'calc'.padStart(12), 'guide'.padStart(12), 'ratio'.padStart(7), 'hit'.padStart(9), 'crit%'.padStart(6), 'cyc', 'blows');
for (const r of rows) {
  console.log(
    r.id.padEnd(24), String(r.skill).padEnd(22),
    String(Math.round(r.dps)).padStart(12), String(r.guideBoss).padStart(12),
    r.ratio.toFixed(3).padStart(7), String(Math.round(r.hit)).padStart(9),
    (r.crit || 0).toFixed(1).padStart(6), (r.cycle || 0).toFixed(2), (r.blows || 0).toFixed(2)
  );
}
console.log('\nwarnings sample:');
for (const r of rows.slice(0, 3)) console.log(r.id, r.warns);
console.log('\npoints', rows[0] && rows[0].tree, 'dragon', rows[0] && rows[0].dragon);
