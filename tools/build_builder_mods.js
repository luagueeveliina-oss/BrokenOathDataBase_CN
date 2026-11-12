const fs=require('fs'),vm=require('vm');const c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('site/assets/data/planner_core.js','utf8'),c);const P=c.window.BO_PCORE;
const out={texts:P.textsZh||{},tags:P.tags||{}};
fs.writeFileSync('site/assets/data/builder_mods_zh.js','window.BO_MOD_ZH = '+JSON.stringify(out)+';\n');
console.log({texts:Object.keys(out.texts).length,tags:Object.keys(out.tags).length});
