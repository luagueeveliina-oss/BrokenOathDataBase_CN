// End-to-end import through the UI layer: paste a game code -> report -> apply -> state/DPS.
'use strict';
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const H = require('./domharness.js');
const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');
const GAME = 'D:/SteamLibrary/steamapps/common/Broken Oath Playtest/BrokenOath/Data';

global.CompressionStream = class { };
global.DecompressionStream = class { };
global.Response = class { };

function run(file) { new Function(fs.readFileSync(file, 'utf8')).call(global); }
run(path.join(SITE, 'assets', 'site.js'));
for (const f of ['planner_core', 'planner_items', 'planner_tree']) run(path.join(SITE, 'assets', 'data', f + '.js'));
run(path.join(SITE, 'assets', 'planner.js'));
run(path.join(SITE, 'assets', 'planner_ui.js'));
const P = global.window.BOPLAN;
const U = global.window.BOPUI;

function decodeGame(code) {
  const b = code.split('.', 2)[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(zlib.inflateSync(Buffer.from(b, 'base64').subarray(4)).toString('utf8'));
}

(async () => {
  const guides = JSON.parse(fs.readFileSync(path.join(GAME, 'Gameplay/guides.json'), 'utf8')).Guides;
  let fail = 0;
  for (const g of guides) {
    if (!g.Code) continue;
    const obj = decodeGame(g.Code);
    // The browser decoder is async + CompressionStream; inject the already-decoded object instead.
    P.decode = () => Promise.resolve({ format: 'BO1', obj });
    U.openImport();
    H.registry.get('im-code').value = g.Code;
    H.registry.get('im-do').onclick();
    await new Promise(r => setTimeout(r, 5));
    const body = H.registry.get('pl-modal-body')._html;
    const report = (H.registry.get('im-report') || {})._html || '';
    if (!/imp-report/.test(report)) { console.log('FAIL report', g.Id, report.slice(0, 80)); fail++; continue; }
    const apply = H.registry.get('im-apply');
    if (!apply || !apply.onclick) { console.log('FAIL apply button', g.Id); fail++; continue; }
    apply.onclick();
    const st = U.state(), r = U.result();
    const gear = Object.keys(st.gear).filter(k => st.gear[k].b).length;
    const ok = st.cls === obj.c && st.level === obj.l && st.bar.length > 0 && gear === (obj.g || []).length && r && r.dps > 0;
    if (!ok) { console.log('FAIL applied', g.Id, st.cls, st.level, st.bar.length, gear, r && r.dps); fail++; }
    else console.log('ok', g.Id.padEnd(22), 'dps', Math.round(r.dps), 'gear', gear, 'skills', st.bar.length);
  }
  console.log(fail ? ('IMPORT UI: ' + fail + ' failed') : 'IMPORT UI: all ok');
  process.exit(fail ? 1 : 0);
})();
