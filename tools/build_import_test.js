/* Round-trip: decode a BO2 produced by build.html with the planner engine.
 *
 * Generate the fixture first (the page's DOM harness):
 *   node tools/pagecheck.js build.html x "const d=BO_API_SEED.details[0]; const obj=BO.buildToPlanner(d,'storm_brand'); const code=await BO.encodeBO2(obj); return 'LEN='+code.length+' '+code;" > tools/_scratch/bocode.txt
 * Then:
 *   node tools/build_import_test.js
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const CODE_FILE = path.join(ROOT, 'tools/_scratch/bocode.txt');
if (!fs.existsSync(CODE_FILE)) {
  console.log('missing fixture', CODE_FILE);
  console.log('see the comment at the top of this file for the command to generate it');
  process.exit(0);
}
const codeLine = fs.readFileSync(CODE_FILE, 'utf8').split('\n').find(l => l.startsWith('EVAL '));
if (!codeLine) {
  console.log('no EVAL line in', CODE_FILE);
  process.exit(1);
}
const code = codeLine.slice(5).trim().split(' ').pop();
const ctx = {
  window: { BO: { LANG: 0, T: p => (Array.isArray(p) ? (p[0] || p[1] || '') : p || '') } },
  console,
  TextEncoder, TextDecoder, CompressionStream, DecompressionStream, Blob, Response, ReadableStream,
  atob: s => Buffer.from(s, 'base64').toString('binary'),
  btoa: s => Buffer.from(s, 'binary').toString('base64'),
  setTimeout, clearTimeout
};
ctx.globalThis = ctx;
vm.createContext(ctx);
const files = [
  'site/assets/data/planner_core.js',
  'site/assets/data/planner_items.js',
  'site/assets/data/planner_tree.js',
  'site/assets/planner.js'
];
for (const f of files) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
}
const P = ctx.window.BOPLAN;
(async () => {
  const dec = await P.decode(code);
  const st = P.stateFromCode(dec);
  const report = P.importReport(dec, st);
  console.log('format', dec.format, 'class', st.cls, 'level', st.level, 'skills', st.bar.length);
  console.log('gear', Object.keys(st.gear).filter(k => st.gear[k].b).map(k => k + ':' + st.gear[k].b).join(', '));
  console.log('tree', Object.keys(st.tree.alloc || {}).length, 'dragon', Object.keys(st.dragon.nodes || {}).length, 'aspect', st.dragon.aspect);
  console.log('warnings', (report.warnings || []).slice(0, 10));
  console.log('errors', (report.errors || []).slice(0, 10));
})();
