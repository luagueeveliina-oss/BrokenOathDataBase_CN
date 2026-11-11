// 构筑器页面冒烟测试：在最小 DOM 环境下跑 planner_ui.js，报告异常与渲染体积
// 用法: node tools/planner_ui_test.js
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./domharness.js');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'site');

global.window.BOPLAN = undefined;
global.CompressionStream = global.CompressionStream || class { };
global.DecompressionStream = global.DecompressionStream || class { };
global.Response = global.Response || class { };

function run(file, label) {
  try {
    new Function(fs.readFileSync(file, 'utf8')).call(global);
    return true;
  } catch (e) {
    console.log('ERR', label, '->', e.message);
    console.log(String(e.stack).split('\n').slice(0, 6).join('\n'));
    return false;
  }
}

run(path.join(SITE, 'assets', 'site.js'), 'site.js');
for (const f of ['planner_core', 'planner_items', 'planner_tree']) {
  run(path.join(SITE, 'assets', 'data', f + '.js'), f);
}
run(path.join(SITE, 'assets', 'planner.js'), 'planner.js');
const ok = run(path.join(SITE, 'assets', 'planner_ui.js'), 'planner_ui.js');

const P = global.window.BOPLAN;
console.log('engine ok:', !!P, 'version', P && P.version);
const ids = ['pl-gear', 'pl-skills', 'pl-stats', 'pl-warn', 'pl-cfg', 'pl-doc', 'pl-vows', 'pl-curses', 'pl-dps', 'pl-tree'];
for (const id of ids) {
  const el = H.registry.get(id);
  console.log(' ', id.padEnd(12), el ? (el._html.length + ' bytes  ' + (el.textContent || '').slice(0, 40)) : 'MISSING');
}
// 状态自检：默认构筑应当能算出 DPS
if (P) {
  const st = P.newState();
  const r = P.calc(st);
  console.log('default build:', st.cls, st.level, 'dps', Math.round(r.dps), 'warnings', r.warnings.length);
  console.log('sockets@20', P.socketsAt(20), 'eff leap_slam@24', P.effectiveness(P.SK.leap_slam, 24).toFixed(3));
  const sups = P.core.supports.filter(s => P.checkSupport('leap_slam', s.id).ok);
  console.log('legal supports for leap_slam:', sups.length);
  const bad = P.checkSupport('leap_slam', 'spell_echo');
  console.log('spell_echo on leap_slam:', bad);
}
console.log(ok ? 'UI SMOKE OK' : 'UI SMOKE FAILED');

// ---- 弹窗与页签（在最小 DOM 下调用，检查是否抛异常 / 是否产出 HTML）
if (global.window.BOPUI) {
  const U = global.window.BOPUI;
  const cases = [
    ['item modal', () => U.openItem('Helm')],
    ['item modal (weapon)', () => U.openItem('MainHand')],
    ['skill picker', () => U.openSkillPicker()],
    ['support picker', () => U.openSupport('leap_slam')],
    ['import modal', () => U.openImport()],
    ['tree tab', () => U.selectTab('tree')],
    ['dragon tab', () => U.selectTab('dragon')],
    ['node list tab', () => U.selectTab('list')],
    ['back to tree', () => U.selectTab('tree')]
  ];
  for (const [name, fn] of cases) {
    try {
      fn();
      const body = H.registry.get('pl-modal-body');
      const title = H.registry.get('pl-modal-title');
      console.log('  ok', name.padEnd(20), 'title=', (title && title.textContent) || '', 'body=', body ? body._html.length : 0, 'alt=', (H.registry.get('pl-alt') || {})._html ? H.registry.get('pl-alt')._html.length : 0);
    } catch (e) {
      console.log('  FAIL', name, '->', e.message);
      console.log(String(e.stack).split('\n').slice(1, 4).join('\n'));
    }
  }
}
