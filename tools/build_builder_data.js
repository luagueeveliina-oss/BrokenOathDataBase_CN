const fs = require('fs'), path = require('path'), vm = require('vm');
const REF = 'C:/Users/HCJ0119/Documents/WorkSpace/broken-oath-builder';
const GAME = 'D:/SteamLibrary/steamapps/common/Broken Oath Playtest/BrokenOath/Data';
const OUT = 'C:/Users/HCJ0119/Documents/WorkSpace/BrokenOathDataBase_CN/site/assets/data/builder_gamedata.js';

const app = fs.readFileSync(path.join(REF, 'app.js'), 'utf8');
const start = app.indexOf('(function (root) {');
const endMark = '})(typeof window !== \'undefined\' ? window : globalThis);';
const end = app.indexOf(endMark, start);
if (start < 0 || end < 0) throw new Error('cannot find BOGameData IIFE');
let code = app.slice(start, end + endMark.length);
const ctx = { window: {}, module: { exports: {} }, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx, { filename: 'BOGameData.js' });
const BG = ctx.window.BOGameData;
if (!BG) throw new Error('BOGameData missing');

const read = rel => JSON.parse(fs.readFileSync(path.join(GAME, rel), 'utf8'));
const J = rel => read(rel);
const partRoot = path.join(GAME, 'Gameplay', 'Parts');
const parts = name => {
  const out = [];
  for (const cls of fs.readdirSync(partRoot)) {
    const f = path.join(partRoot, cls, name);
    if (fs.existsSync(f)) out.push(JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  return out.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
};
const used = [...BG.NEEDED, ...BG.PART_FILES.flatMap(n => fs.readdirSync(partRoot).map(c => 'Gameplay/Parts/' + c + '/' + n).filter(rel => fs.existsSync(path.join(GAME, rel))))];
let newest = 0;
for (const rel of used) newest = Math.max(newest, fs.statSync(path.join(GAME, rel)).mtimeMs);
const gd = BG.buildGameData(J, parts, {
  dataDir: 'local game folder',
  source: 'local',
  filesAt: new Date(newest).toISOString(),
});
gd.steamBuild = '';
const json = JSON.stringify(gd);
fs.writeFileSync(OUT, '/* Generated from the local Broken Oath playtest files. */\nwindow.BO_GD = ' + json + ';\n');
console.log(JSON.stringify({
  out: OUT, bytes: json.length, nodes: Object.keys(gd.nodes).length, skills: Object.keys(gd.skills).length,
  supports: Object.keys(gd.supports).length, treeVersion: gd.treeVersion, filesAt: gd.filesAt,
  dragonClasses: Object.keys(gd.dragon.classes), aspects: Object.keys(gd.dragon.aspects), bases: Object.keys(gd.bases).length,
}));
