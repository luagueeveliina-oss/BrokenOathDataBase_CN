// Run a site page's scripts under the DOM harness and report errors + rendered size.
'use strict';
const path = require('path');
const fs = require('fs');
const H = require('./domharness.js');

const page = process.argv[2];
const hash = process.argv[3] || '';
if (hash) global.location.hash = hash;
const root = path.resolve(__dirname, '..', 'site');

function runCode(code, label) {
  try {
    new Function(code).call(global);
    return true;
  } catch (e) {
    console.log('  ERR', label, '->', e.message);
    console.log(String(e.stack).split('\n').slice(1, 5).join('\n'));
    return false;
  }
}

runCode(fs.readFileSync(path.join(root, 'assets', 'site.js'), 'utf8'), 'site.js');
for (const f of ['items', 'skills', 'tree', 'bestiary', 'mechanics']) {
  const p = path.join(root, 'assets', 'data', f + '.js');
  try { runCode(fs.readFileSync(p, 'utf8'), 'data/' + f); } catch (e) {}
}
const scripts = H.extractScripts(path.join(root, page));
scripts.forEach((s, i) => runCode(s, page + '#' + i));

// report what got rendered into the main containers
const ids = ['list', 'count', 'tabs', 'side', 'cats', 'stats', 'guides', 'feat', 'lede', 'doc', 'pbody', 'legend'];
for (const id of ids) {
  const el = H.registry.get(id);
  if (el && el._html) console.log('  ' + id + ': ' + el._html.length + ' bytes');
}
const svg = H.registry.get('treeSvg');
if (svg) console.log('  svg: ' + svg._html.length + ' bytes');
const want = process.argv[4];
if (want && H.registry.get(want)) {
  fs.writeFileSync(path.join(__dirname, 'dump_' + want + '.html'), H.registry.get(want)._html, 'utf8');
  console.log('  dumped ' + want);
}
