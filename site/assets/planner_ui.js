/* ============================================================================
   Broken Oath 构筑模拟器 — 界面层
   ========================================================================== */
(function () {
  'use strict';
  var P = window.BOPLAN;
  var BO = window.BO;
  var esc = BO.esc, T = BO.T;
  var LS = 'bo_planner_state_v1';
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, html) { var d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function pct(v, d) { return (v >= 0 ? '+' : '') + (d ? v.toFixed(d) : Math.round(v)) + '%'; }

  // ---------------------------------------------------------------- 状态
  var S = null, R = null, TAB = 'tree';

  function loadSaved() {
    try {
      var raw = localStorage.getItem(LS);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.cls) return null;
      return normalize(o);
    } catch (e) { return null; }
  }
  function normalize(o) {
    var st = P.newState();
    // 只接受已知字段，避免旧存档污染
    st.title = o.title || st.title;
    st.cls = P.CLS[o.cls] ? o.cls : 'Warrior';
    st.level = Math.max(1, Math.min(100, o.level || 100));
    st.tree = { alloc: {}, choice: {}, socket: {} };
    for (var k in (o.tree && o.tree.alloc) || {}) if (P.NODE[k] && o.tree.alloc[k]) st.tree.alloc[k] = 1;
    st.tree.socket = (o.tree && o.tree.socket) || {};
    st.tree.choice = (o.tree && o.tree.choice) || {};
    st.dragon = { aspect: (o.dragon && o.dragon.aspect) || '', nodes: {} };
    for (var d in (o.dragon && o.dragon.nodes) || {}) st.dragon.nodes[d] = 1;
    st.gear = P.emptyGear();
    for (var i = 0; i < P.slotList.length; i++) {
      var slot = P.slotList[i], it = (o.gear || {})[slot];
      if (!it || !P.BASES[it.b]) continue;
      st.gear[slot] = {
        s: slot, b: it.b, r: it.r || 'Normal', u: it.u || '', il: it.il || 84,
        a: (it.a || []).filter(function (x) { return P.AFF[x.i]; }),
        so: (it.so || []).filter(function (x) { return P.RUNE[x]; }),
        q: it.q || 0, f: it.f || 0, ur: it.ur === undefined ? 50 : it.ur
      };
    }
    st.bar = ((o.bar || []).filter(function (x) { return x && P.SK[x.id]; }).map(function (x) {
      return { id: x.id, lv: Math.max(1, Math.min(40, x.lv || 20)), sup: (x.sup || []).filter(function (y) { return P.SUP[y]; }) };
    }));
    if (!st.bar.length) st.bar = [{ id: 'ground_slam', lv: 20, sup: [] }];
    st.vows = o.vows || {};
    st.curses = o.curses || {};
    st.cfg = Object.assign({ boss: 1, shock: 0, roll: 100, rl: 84, target: 'boss', gates: 6, pinnacle: 1 }, o.cfg || {});
    st._codeFormat = o._codeFormat;
    st._importWarnings = o._importWarnings || [];
    return st;
  }
  function save() {
    try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) { }
  }
  function recalc() { R = P.calc(S); }

  // ---------------------------------------------------------------- 图标
  function icon(key, glyph, tint) { return BO.icon(key, glyph, tint); }
  function skillIcon(sk) { return icon('sk:' + sk.id, 'gem', sk.attr === 'Str' ? '#d07c6f' : sk.attr === 'Dex' ? '#7fce9b' : '#8fb0e8'); }

  // ---------------------------------------------------------------- 弹窗
  var modalOpen = null;
  function toast(msg, kind) {
    var host = document.getElementById('pl-toast');
    if (!host) {
      host = el('div', 'plan-toast');
      host.id = 'pl-toast';
      document.body.appendChild(host);
    }
    host.textContent = msg;
    host.className = 'plan-toast on' + (kind ? ' ' + kind : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { host.className = 'plan-toast'; }, 7000);
  }
  function openModal(title, bodyHtml, footHtml, onMount) {
    $('pl-modal-title').textContent = title;
    $('pl-modal-body').innerHTML = bodyHtml;
    $('pl-modal-foot').innerHTML = footHtml || '';
    $('pl-modal').classList.add('on');
    $('pl-modal').setAttribute('aria-hidden', 'false');
    modalOpen = onMount || null;
    if (modalOpen) modalOpen($('pl-modal-body'), $('pl-modal-foot'));
  }
  function closeModal() {
    $('pl-modal').classList.remove('on');
    $('pl-modal').setAttribute('aria-hidden', 'true');
    modalOpen = null;
  }

  // ================================================================ 顶部
  function renderTop() {
    var sel = $('pl-class');
    if (!sel.options || !sel.options.length) {
      sel.innerHTML = P.core.classes.map(function (c) {
        return '<option value="' + c.id + '">' + esc(P.T(c.n)) + '</option>';
      }).join('');
    }
    sel.value = S.cls;
    $('pl-title').value = S.title;
    $('pl-level').value = S.level;
    var best = R.skills[0];
    $('pl-dps').textContent = best ? P.fmt(best.totalDps, 0) : '0';
    $('pl-dpseff').textContent = best ? P.fmt(best.dpsEff, 0) : '0';
    var mdl = 0;
    var rl = Math.round(S.cfg.rl || 80);
    (P.core.ref.modelDps || []).forEach(function (x) { if (x[0] === rl) mdl = x[1]; });
    $('pl-model').textContent = P.fmt(mdl, 0);
    $('pl-points').textContent = '天赋 ' + R.tree.used + '/' + R.tree.budget + ' · 龙裔 ' + R.dragon.used + '/' + R.dragon.budget;
    $('pl-tree-pts').textContent = TAB === 'dragon'
      ? '龙裔 ' + R.dragon.used + ' / ' + R.dragon.budget + ' 点'
      : '天赋 ' + R.tree.used + ' / ' + R.tree.budget + ' 点';
  }

  // ================================================================ 装备
  function itemTitle(ri) {
    if (!ri || !ri.base) return '空';
    if (ri.unique) return P.T(ri.unique.n);
    return P.T(ri.base.n);
  }
  function renderGear() {
    var host = $('pl-gear');
    var html = '';
    for (var i = 0; i < P.slotList.length; i++) {
      var slot = P.slotList[i], it = S.gear[slot], ri = R.all.items[slot];
      var base = it && it.b ? P.BASES[it.b] : null;
      var warn = base ? P.itemWarnings(it) : [];
      var color = base ? P.rarityColor[it.r] || 'var(--base)' : 'var(--dim)';
      var meta = '';
      if (ri && ri.weapon) meta = (Math.round((ri.weapon.phys[0] + ri.weapon.phys[1]) / 2 * 10) / 10) + ' 伤害 · ' + ri.weapon.aps.toFixed(2) + ' 攻速';
      else if (ri && base && base.ar) meta = '护甲 ' + Math.round(ri.def.ar);
      else if (ri && base && base.es) meta = '护盾 ' + Math.round(ri.def.es);
      else if (ri && base && base.ev) meta = '闪避 ' + Math.round(ri.def.ev);
      if (base) {
        var bits = [];
        if (it.r === 'Unique') bits.push('roll ' + Math.round(it.ur === undefined ? 50 : it.ur) + '%');
        if (it.q) bits.push('品质 ' + it.q);
        if (it.a && it.a.length) bits.push(it.a.length + ' 词缀');
        if (ri && ri.runeword) bits.push('符文之语 ' + P.T(ri.runeword.n));
        if (ri && ri.sock && ri.sock.length && !(ri.runeword)) bits.push(ri.sock.length + ' 符文');
        if (bits.length) meta = (meta ? meta + ' · ' : '') + bits.join(' · ');
      }
      html += '<div class="gear-slot' + (warn.length ? ' bad' : '') + '" data-slot="' + slot + '">' +
        '<span class="gear-ico">' + (base ? icon((base.cls === 'Bow' ? 'bow' : base.cls === 'Shield' ? 'shield' : base.slot === 'MainHand' ? 'weapon' : P.slotGlyph[slot]), P.slotGlyph[slot]) : '<span class="gear-empty">+</span>') + '</span>' +
        '<span class="gear-txt"><b style="color:' + color + '">' + esc(base ? itemTitle(ri) : P.slotZh[slot]) + '</b>' +
        '<i>' + esc(base ? (P.T(base.n) + ' · ' + (P.rarityZh[it.r] || it.r) + (it.il ? ' · ilvl ' + it.il : '')) : '点击装备') + '</i>' +
        (base ? '<em>' + esc(meta) + '</em>' : '') +
        (warn.length ? '<span class="gear-warn">' + esc(warn.join(' / ')) + '</span>' : '') +
        '</span></div>';
    }
    host.innerHTML = html;
    var ng = 0;
    for (var s2 = 0; s2 < P.slotList.length; s2++) if (S.gear[P.slotList[s2]].b) ng++;
    $('pl-gear-hint').textContent = ng + ' / ' + P.slotList.length + ' 件';
  }

  function renderVows() {
    var host = $('pl-vows');
    var list = P.core.blessings.slice().sort(function (a, b) { return (a.kind || '').localeCompare(b.kind || ''); });
    host.innerHTML = list.map(function (b) {
      var on = !!(S.vows && S.vows[b.id]);
      return '<button class="vow-chip' + (on ? ' on' : '') + '" data-vow="' + esc(b.id) + '" title="' + esc(P.T(b.text)) + '">' +
        '<b>' + esc(P.T(b.n)) + '</b><i>' + esc(P.T(b.kindZh || b.kind)) + (b.resFlat ? ' · 保留 ' + b.resFlat : '') + (b.resPct ? ' · ' + b.resPct + '%' : '') + '</i></button>';
    }).join('');
    var host2 = $('pl-curses');
    host2.innerHTML = P.core.curses.map(function (c) {
      var on = !!(S.curses && S.curses[c.id]);
      return '<button class="vow-chip' + (on ? ' on' : '') + '" data-curse="' + esc(c.id) + '" title="' + esc(P.T(c.text)) + '">' +
        '<b>' + esc(P.T(c.n)) + '</b><i>' + esc(P.T(c.kindZh || c.kind)) + (c.dur ? ' · ' + c.dur + 's' : '') + '</i></button>';
    }).join('');
  }

  // ================================================================ 技能
  function entryById(id) {
    for (var i = 0; i < S.bar.length; i++) if (S.bar[i].id === id) return S.bar[i];
    return null;
  }
  function renderSkills() {
    var host = $('pl-skills');
    var bh = $('pl-bar-hint');
    if (bh) bh.textContent = (S.bar || []).length + ' / 6';
    if (!R.skills.length) { host.innerHTML = '<div class="empty">还没有技能。点击右上角「+ 添加技能」。</div>'; return; }
    var html = '';
    R.skills.forEach(function (row) {
      var sk = row.sk;
      var sockMax = P.socketsAt(row.lv);
      var sups = row.supports.map(function (s, idx) {
        var over = !s.granted && idx >= sockMax;
        return '<span class="sup-chip' + (over ? ' over' : '') + (s.granted ? ' granted' : '') + '" data-skill="' + esc(sk.id) + '" data-sid="' + esc(s.id) + '" title="' + esc(P.T(s.n)) + (s.granted ? '（装备授予）' : '') + '">' +
          esc(P.T(s.n)) + (s.granted ? '<i>授予</i>' : '<i>魔耗×' + (s.mana || 1) + '</i>') + (s.granted ? '' : '<b data-sup-del="1" title="移除">✕</b>') + '</span>';
      }).join('');
      var lines = '';
      // 每元素
      var elems = ['Physical', 'Fire', 'Cold', 'Lightning', 'Poison', 'Holy', 'Chaos'];
      var perEl = elems.filter(function (e) { return row.perElem[e] && (row.perElem[e].min + row.perElem[e].max) > 0.5; });
      var tot = 0; perEl.forEach(function (e) { tot += (row.perElem[e].min + row.perElem[e].max) / 2; });
      var elHtml = perEl.map(function (e) {
        var b = row.perElem[e];
        var avg = (b.min + b.max) / 2;
        return '<span class="el-pill" title="' + esc(e) + '"><i class="dot" style="background:' + elemColor(e) + '"></i>' + esc(P.core.tags[e] || e) +
          ' ' + P.fmt(avg, 0) + '<em>' + Math.round(avg / (tot || 1) * 100) + '%</em></span>';
      }).join('');
      var ail = row.ailments || {};
      var ailBits = [];
      if (ail.ignite && ail.ignite.chance > 0) ailBits.push('点燃 ' + Math.round(ail.ignite.chance) + '% · ' + P.fmt(ail.ignite.dps) + '/s（' + ail.ignite.stacks + ' 层）');
      if (ail.poison && ail.poison.chance > 0 && ail.poison.per > 0) ailBits.push('中毒 ' + Math.round(ail.poison.chance) + '% · ' + P.fmt(ail.poison.per) + '/层 · ' + ail.poison.stacks.toFixed(1) + ' 层');
      if (ail.bleed && ail.bleed.chance > 0) ailBits.push('流血 ' + Math.round(ail.bleed.chance) + '% · ' + P.fmt(ail.bleed.dps) + '/s');
      if (ail.shock && ail.shock.chance > 0) ailBits.push('感电 ' + Math.round(ail.shock.chance) + '% · 目标受到 +' + ail.shock.effect.toFixed(1) + '% 伤害' + (S.cfg.shock ? '（已计入 DPS）' : '（未计入）'));
      if (row.mark) ailBits.push('猎人印记 ' + row.mark.stacks.toFixed(1) + ' 层 · 目标受到 +' + row.mark.taken.toFixed(1) + '% 伤害（已计入）');
      html += '<article class="skill-card' + (row === R.skills[0] ? ' best' : '') + '" data-skill="' + esc(sk.id) + '">' +
        '<div class="sk-head">' + skillIcon(sk) +
        '<div class="sk-name"><b>' + esc(P.T(sk.n)) + (row === R.skills[0] ? ' <em class="best-badge">最高</em>' : '') + '</b>' +
        '<i>' + esc(P.core.tags[sk.deliv] || sk.deliv) + ' · ' + esc(P.core.tags[sk.dmg] || sk.dmg) + ' · ' +
        (sk.tags || []).filter(function (t) { return t !== sk.deliv && !(sk.dmg && t === sk.dmg); })
          .slice(0, 5).map(function (t) { return esc(P.core.tags[t] || t); }).join(' ') + '</i></div>' +
        '<div class="sk-lv">宝石 <button class="step" data-lv="-1" data-skill="' + esc(sk.id) + '">−</button><b>' + row.lv + '</b><button class="step" data-lv="1" data-skill="' + esc(sk.id) + '">+</button></div>' +
        '<div class="sk-dps"><b>' + P.fmt(row.totalDps, 0) + '</b><span>DPS</span></div>' +
        '<button class="sk-x" data-sk-del="' + esc(sk.id) + '" title="移除">×</button>' +
        '</div>' +
        '<div class="sk-sups">' + sups + '<button class="sup-add" data-sup-add="' + esc(sk.id) + '">+ 辅助</button>' +
        (row.supports.filter(function (s) { return !s.granted; }).length > sockMax ? '<span class="sup-warn">插槽 ' + sockMax + ' 个，已装 ' + row.supports.filter(function (s) { return !s.granted; }).length + ' 个</span>' : '') + '</div>' +
        '<div class="sk-facts">' +
        '<span>命中 ' + P.fmt(row.hit, 0) + '</span>' +
        '<span>暴击 ' + row.crit.chance.toFixed(1) + '% ×' + row.crit.multi.toFixed(2) + '</span>' +
        '<span>每击 ' + row.rate.cycle.toFixed(2) + 's（' + (1 / row.rate.cycle).toFixed(2) + '/s）</span>' +
        (row.blows !== 1 ? '<span>打击 ×' + row.blows.toFixed(2) + '</span>' : '') +
        (row.minion ? '<span>召唤 ' + row.minion.count + ' / 上限 ' + row.minion.cap + ' · 每次 ' + row.minion.every.toFixed(2) + 's</span>' : '') +
        '<span class="dim">消耗 ' + P.fmt(row.mana, 1) + ' 魔力</span>' +
        '</div>' +
        '<div class="sk-elems">' + elHtml + '</div>' +
        (ailBits.length ? '<ul class="mods imp sk-ail">' + ailBits.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        '<details class="sk-more"><summary>伤害拆解</summary>' + breakdown(row) + '</details>' +
        (row.warnings.length ? '<ul class="sk-warn">' + row.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>' : '') +
        '</article>';
    });
    host.innerHTML = html;
  }
  function elemColor(e) {
    return { Physical: '#c8c8c8', Fire: '#d05a3a', Cold: '#6f9fd0', Lightning: '#e0c24a', Poison: '#6aa84f', Holy: '#e0c98a', Chaos: '#b06fc0', Elemental: '#a0a0a0' }[e] || '#999';
  }
  function breakdown(row) {
    var b = row.buckets || null;
    var rows = [];
    var elems = Object.keys(row.perElem).filter(function (k) { return k !== '__total' && (row.perElem[k].min + row.perElem[k].max) > 0.5; });
    if (!elems.length) return '<div class="note">没有伤害数据（可能是辅助技能，或武器未装备）。</div>';
    rows.push(['<b>伤害构成</b>（已含增加/更多与武器效率）', '']);
    elems.forEach(function (e) {
      var x = row.perElem[e], res = row.elemRes[e] || { res: 0, mul: 1 };
      rows.push([esc(P.core.tags[e] || e) + '：' + P.fmt(x.min, 0) + ' – ' + P.fmt(x.max, 0),
        '增加 ' + Math.round(x.inc) + '% · 更多 ×' + x.more.toFixed(2) + ' · 抗性 ' + Math.round(res.res) + '%']);
    });
    rows.push(['期望命中（含暴击）', P.fmt(row.hit * row.crit.ap, 0) + ' · 暴击 ' + row.crit.chance.toFixed(1) + '% ×' + row.crit.multi.toFixed(2)]);
    rows.push(['每秒使用', (1 / row.rate.cycle).toFixed(3) + ' 次 · 每次使用 ' + row.rate.cycle.toFixed(3) + 's' + (row.rate.cd > row.rate.use + 1e-6 ? '（受冷却限制）' : '')]);
    rows.push(['每次使用打击', row.blows.toFixed(2) + ' ×']);
    rows.push(['<b>命中 DPS</b>', P.fmt(row.dpsHit, 0)]);
    if (row.dotDps > 0.5) rows.push(['持续伤害 DPS', P.fmt(row.dotDps, 0)]);
    rows.push(['<b>总计 DPS</b>', P.fmt(row.totalDps, 0)]);
    if (row.dpsEff && Math.abs(row.dpsEff - row.totalDps) > 1) rows.push(['对 RL ' + S.cfg.rl + ' 有效 DPS', P.fmt(row.dpsEff, 0)]);
    return '<div class="bk-grid">' + rows.map(function (r) {
      return '<div class="bk-l">' + r[0] + '</div><div class="bk-r">' + r[1] + '</div>';
    }).join('') + '</div>';
  }

  // ================================================================ 属性/防御
  function renderStats() {
    var a = R.attrs, d = R.def;
    var rows = [
      ['力量', Math.round(a.str)], ['敏捷', Math.round(a.dex)], ['智力', Math.round(a.int)],
      ['生命', P.num(Math.round(d.life))], ['能量护盾', P.num(Math.round(d.es))],
      ['魔力', P.num(Math.round(d.mana))],
      ['护甲', P.num(Math.round(d.armour))], ['闪避', P.num(Math.round(d.evasion))],
      ['格挡', d.block.toFixed(0) + '%'],
      ['火焰抗性', resTxt('Fire')], ['冰霜抗性', resTxt('Cold')], ['闪电抗性', resTxt('Lightning')], ['混沌抗性', resTxt('Chaos')],
      ['移动速度', (d.move * 100).toFixed(0) + '%'],
      ['生命回复', d.lifeRegen.toFixed(1) + '/s'],
      ['魔力回复', d.manaRegen.toFixed(1) + '/s'],
      ['总保留', P.num(Math.round(R.reserve))],
      ['技能魔力消耗', P.fmt(R.manaCost, 1)]
    ];
    $('pl-stats').innerHTML = rows.map(function (r) {
      return '<div class="st-row"><span>' + esc(r[0]) + '</span><b>' + esc(String(r[1])) + '</b></div>';
    }).join('');
    function resTxt(el) {
      var v = d.res[el] || 0, m = d.maxRes[el] || 75;
      var over = Math.max(0, v - m);
      return Math.round(Math.min(v, m)) + '%' + (over > 0.5 ? ' (+' + Math.round(over) + ')' : '') + ' / ' + Math.round(m);
    }
  }
  function renderWarnings() {
    var w = R.warnings || [];
    var v = { errors: [], warnings: [] };
    try { v = P.validateBuild(S); } catch (e) { v.errors = ['校验时出错：' + (e && e.message ? e.message : e)]; }
    var errs = v.errors || [];
    $('pl-warn-n').textContent = errs.length ? (errs.length + ' 个错误 · ') : '';
    $('pl-warn-n').textContent += w.length ? w.length + ' 条提示' : (errs.length ? '' : '无冲突');
    var html = '';
    if (errs.length) html += '<ul class="warn-list bad">' + errs.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (w.length) html += '<ul class="warn-list">' + w.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    $('pl-warn').innerHTML = html || '<div class="note ok">当前配置没有发现冲突。</div>';
  }
  function renderCfg() {
    var c = S.cfg;
    $('pl-cfg').innerHTML =
      '<label class="cfg-row"><span>目标</span><select class="sel" data-cfg="target">' +
      ['boss|守卫 / 首领', 'rare|稀有怪', 'normal|普通怪'].map(function (x) {
        var p = x.split('|');
        return '<option value="' + p[0] + '"' + (c.target === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
      }).join('') + '</select></label>' +
      '<label class="cfg-row"><span>裂隙等级</span><input class="plan-input" type="number" min="1" max="100" data-cfg="rl" value="' + Math.round(c.rl) + '"></label>' +
      '<label class="cfg-row"><span>感电计入伤害</span><input type="checkbox" data-cfg="shock"' + (c.shock ? ' checked' : '') + '></label>' +
      '<label class="cfg-row"><span>新词缀 roll</span><select class="sel" data-cfg="roll">' +
      [['100', '最高'], ['75', '高'], ['50', '平均'], ['25', '低']].map(function (x) {
        return '<option value="' + x[0] + '"' + (String(c.roll) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>';
      }).join('') + '</select></label>' +
      '<label class="cfg-row"><span>已过关门</span><input class="plan-input" type="number" min="0" max="60" data-cfg="gates" value="' + Math.round(c.gates) + '"></label>';
  }

  // ================================================================ 天赋树
  var TS = { x: 0, y: 0, k: 1, drag: null, built: false, nodeEls: {}, linkEls: [], bbox: null, lastK: 0 };

  function nodeRadius(kind) {
    return kind === 'Keystone' ? 15 : kind === 'Notable' ? 11 : kind === 'Start' ? 16 : kind === 'Choice' ? 12 : kind === 'Socket' ? 12 : 7;
  }
  function nodeColor(kind) {
    if (kind === 'Keystone') return '#8fb0e8';
    if (kind === 'Notable') return '#b4b4ff';
    if (kind === 'Start') return '#e7b478';
    if (kind === 'Choice') return '#d0a0d0';
    if (kind === 'Socket') return '#aa9e82';
    if (kind === 'Attribute') return '#9d9d9d';
    return '#7f7f86';
  }
  function buildTree() {
    var nodes = P.tree.nodes;
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    var svg = $('pl-svg');
    var parts = ['<g id="pl-tree-g">'];
    // 连线
    var seen = {};
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.x < minx) minx = n.x; if (n.x > maxx) maxx = n.x;
      if (n.y < miny) miny = n.y; if (n.y > maxy) maxy = n.y;
      for (var j = 0; j < n.l.length; j++) {
        var o = n.l[j], key = n.i < o ? n.i + '|' + o : o + '|' + n.i;
        if (seen[key]) continue;
        seen[key] = 1;
        var on = P.NODE[o];
        if (!on) continue;
        parts.push('<line class="tlink" data-a="' + n.i + '" data-b="' + o + '" x1="' + n.x + '" y1="' + n.y + '" x2="' + on.x + '" y2="' + on.y + '"></line>');
      }
    }
    // 节点
    for (var k = 0; k < nodes.length; k++) {
      var nd = nodes[k];
      var r = nodeRadius(nd.k);
      parts.push('<g class="tnode" data-id="' + nd.i + '" transform="translate(' + nd.x + ',' + nd.y + ')">' +
        '<circle r="' + (r + 9) + '" fill="transparent"></circle>' +
        '<circle class="core" r="' + r + '" fill="' + nodeColor(nd.k) + '" stroke="rgba(0,0,0,.6)" stroke-width="2"></circle>' +
        (nd.k === 'Keystone' || nd.k === 'Choice' ? '<circle class="ring" r="' + (r + 4) + '" fill="none" stroke="' + nodeColor(nd.k) + '" stroke-width="1.5" opacity=".5"></circle>' : '') +
        '</g>');
    }
    parts.push('</g>');
    svg.innerHTML = parts.join('');
    TS.bbox = { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
    TS.nodeEls = {};
    var g = svg.querySelectorAll('.tnode');
    for (var q = 0; q < g.length; q++) TS.nodeEls[g[q].getAttribute('data-id')] = g[q];
    TS.linkEls = svg.querySelectorAll('.tlink');
    TS.built = true;
    TS.lastK = 0;
    fitTree();
    bindTreeEvents();
  }
  function fitTree(mode) {
    var b = TS.bbox;
    var wrap = $('pl-tree');
    var w = wrap.clientWidth || 900, h = wrap.clientHeight || 600;
    if (mode === 'all' || !w || !h) {
      var pad = 70;
      TS.k = Math.min((w - pad * 2) / b.w, (h - pad * 2) / b.h);
      TS.x = w / 2 - (b.x + b.w / 2) * TS.k;
      TS.y = h / 2 - (b.y + b.h / 2) * TS.k;
    } else {
      // 默认：以本职业起点为中心，放大到能看清节点
      var start = null;
      for (var i = 0; i < P.tree.nodes.length; i++) {
        if (P.tree.nodes[i].cs === S.cls) { start = P.tree.nodes[i]; break; }
      }
      if (!start) { start = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }
      TS.k = Math.max(0.3, Math.min(0.85, Math.min(w, h) / 1500));
      TS.x = w / 2 - start.x * TS.k;
      TS.y = h / 2 - start.y * TS.k;
    }
    applyTransform();
  }
  function applyTransform() {
    var g = $('pl-svg').querySelector('#pl-tree-g');
    if (g) g.setAttribute('transform', 'translate(' + TS.x + ',' + TS.y + ') scale(' + TS.k + ')');
    // 节点半径随缩放反向补偿，只在 k 变化时更新（拖动时省掉 1200 次 setAttribute）
    if (Math.abs(TS.lastK - TS.k) > 1e-6) {
      TS.lastK = TS.k;
      var s = Math.max(0.4, Math.min(2.2, 1 / TS.k));
      for (var id in TS.nodeEls) TS.nodeEls[id].setAttribute('transform',
        'translate(' + P.NODE[id].x + ',' + P.NODE[id].y + ') scale(' + s + ')');
    }
  }
  function bindTreeEvents() {
    var svg = $('pl-svg');
    if (svg._bound) { refreshTree(); return; }
    svg._bound = true;
    svg.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.tnode')) return;
      TS.drag = { x: e.clientX, y: e.clientY, ox: TS.x, oy: TS.y };
      svg.classList.add('drag');
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', function (e) {
      if (!TS.drag) return;
      TS.x = TS.drag.ox + (e.clientX - TS.drag.x);
      TS.y = TS.drag.oy + (e.clientY - TS.drag.y);
      applyTransform();
    });
    svg.addEventListener('pointerup', function (e) {
      TS.drag = null; svg.classList.remove('drag');
      try { svg.releasePointerCapture(e.pointerId); } catch (x) { }
    });
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = svg.getBoundingClientRect();
      var mx = e.clientX - r.left, my = e.clientY - r.top;
      var f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      var k2 = Math.max(0.08, Math.min(3, TS.k * f));
      TS.x = mx - (mx - TS.x) * (k2 / TS.k);
      TS.y = my - (my - TS.y) * (k2 / TS.k);
      TS.k = k2;
      applyTransform();
    }, { passive: false });
    svg.addEventListener('click', function (e) {
      var g = e.target.closest('.tnode');
      if (!g) return;
      toggleNode(g.getAttribute('data-id'), e.ctrlKey || e.metaKey);
    });
    svg.addEventListener('contextmenu', function (e) {
      var g = e.target.closest('.tnode');
      if (!g) return;
      e.preventDefault();
      deallocNode(g.getAttribute('data-id'));
    });
    svg.addEventListener('mouseover', function (e) {
      var g = e.target.closest('.tnode');
      if (!g) return;
      showNodeTip(g.getAttribute('data-id'));
    });
    svg.addEventListener('mouseout', function (e) {
      var g = e.target.closest('.tnode');
      if (!g) return;
      $('pl-tip').classList.remove('on');
    });
  }
  function showNodeTip(id) {
    var nd = P.NODE[id];
    if (!nd) return;
    var alloc = !!S.tree.alloc[id];
    var tp = $('pl-tip');
    tp.innerHTML = '<button class="bo-btn plan-mini close" id="pl-tip-x">×</button>' +
      '<h3>' + esc(P.T(nd.n)) + '</h3>' +
      '<div class="k">' + esc(P.core.treeKinds[nd.k] || nd.k) + (nd.r ? ' · ' + esc(P.core.tags[nd.r] || nd.r) : '') + (alloc ? ' · 已点' : '') + '</div>' +
      (nd.m.length ? '<ul class="mods">' + nd.m.map(function (m) { return '<li>' + esc(P.modText(m)[0]) + '</li>'; }).join('') + '</ul>' : '<div class="note">没有属性词条</div>') +
      (nd.pr ? '<div class="t-pr">代价：' + esc(nd.pr) + '</div>' : '') +
      (nd.tx ? '<div class="t-tx">' + esc(nd.tx) + '</div>' : '') +
      (nd.so ? '<div class="t-tx">插槽：' + (nd.so === 'Rune' ? '可镶嵌一枚矮人符文' : nd.so) + '</div>' : '');
    tp.classList.add('on');
    $('pl-tip-x').onclick = function () { tp.classList.remove('on'); };
  }
  function refreshTree() {
    if (!TS.built) return;
    var alloc = S.tree.alloc, reach = P.treeReach(S.cls);
    // 已连通：从职业起点出发，沿已点节点扩散
    var conn = P.connectedAlloc(S);
    var avail = {};
    // 可点 = 与任一已点节点（或起点）相邻
    var startNodes = [];
    for (var i = 0; i < P.tree.nodes.length; i++) if (P.tree.nodes[i].cs === S.cls) startNodes.push(P.tree.nodes[i].i);
    function markAvail(from) {
      var nd = P.NODE[from];
      if (!nd) return;
      for (var j = 0; j < nd.l.length; j++) {
        var o = nd.l[j];
        if (alloc[o] || !P.NODE[o]) continue;
        avail[o] = 1;
      }
    }
    startNodes.forEach(markAvail);
    for (var id in alloc) if (alloc[id] && conn[id]) markAvail(id);

    for (var nid in TS.nodeEls) {
      var g = TS.nodeEls[nid], nd2 = P.NODE[nid];
      var on = !!alloc[nid];
      var av = !!avail[nid];
      var cls = 'tnode' + (on ? ' on' : av ? ' av' : ' off');
      if (g.getAttribute('class') !== cls) g.setAttribute('class', cls);
      var core = g.querySelector('.core');
      core.setAttribute('fill', on ? '#e7b478' : nodeColor(nd2.k));
      core.setAttribute('opacity', on ? 1 : av ? 0.95 : 0.42);
    }
    for (var l = 0; l < TS.linkEls.length; l++) {
      var ln = TS.linkEls[l];
      var a = ln.getAttribute('data-a'), b = ln.getAttribute('data-b');
      var on2 = alloc[a] && alloc[b] && (conn[a] || conn[b]);
      ln.setAttribute('class', 'tlink' + (on2 ? ' on' : ''));
    }
  }
  function toggleNode(id, fillPath) {
    if (!P.NODE[id]) return;
    if (S.tree.alloc[id]) { deallocNode(id); return; }
    if (fillPath) {
      var path = pathTo(id);
      for (var i = 0; i < path.length; i++) S.tree.alloc[path[i]] = 1;
    } else {
      S.tree.alloc[id] = 1;
    }
    afterTreeChange();
  }
  function deallocNode(id) {
    delete S.tree.alloc[id];
    // 移除因此断开的节点
    var conn = P.connectedAlloc(S);
    for (var k in S.tree.alloc) if (!conn[k]) delete S.tree.alloc[k];
    afterTreeChange();
  }
  /** 从最近的可达节点到目标的最短路径 */
  function pathTo(target) {
    var start = [];
    var conn = P.connectedAlloc(S);
    for (var i = 0; i < P.tree.nodes.length; i++) {
      var nd = P.tree.nodes[i];
      if (nd.cs === S.cls || (S.tree.alloc[nd.i] && conn[nd.i])) start.push(nd.i);
    }
    var prev = {}, q = [], seen = {};
    for (var s = 0; s < start.length; s++) { seen[start[s]] = 1; q.push(start[s]); }
    var head = 0;
    while (head < q.length) {
      var cur = q[head++];
      if (cur === target) break;
      var node = P.NODE[cur];
      if (!node) continue;
      for (var j = 0; j < node.l.length; j++) {
        var nx = node.l[j];
        if (seen[nx] || !P.NODE[nx]) continue;
        seen[nx] = 1; prev[nx] = cur; q.push(nx);
      }
    }
    var out = [], cur2 = target, guard = 0;
    while (cur2 && guard++ < 400) {
      out.unshift(cur2);
      if (seen[cur2] && start.indexOf(cur2) >= 0) break;
      cur2 = prev[cur2];
    }
    return out;
  }
  function afterTreeChange() {
    save(); recalc(); renderTop(); renderStats(); renderWarnings(); renderSkills(); refreshTree(); save();
  }

  // ================================================================ 龙裔 / 列表
  function renderDragon() {
    var host = $('pl-alt');
    var cls = S.cls;
    var dn = (P.tree.dragon.classes || {})[cls] || [];
    var aspects = P.tree.dragon.aspects || [];
    var html = '<div class="dragon-wrap">';
    html += '<div class="dragon-aspects"><h3>龙裔形态</h3><div class="aspect-row">' +
      aspects.map(function (a) {
        var on = S.dragon.aspect === a.id;
        return '<button class="vow-chip' + (on ? ' on' : '') + '" data-aspect="' + esc(a.id) + '"><b>' + esc(P.T(a.n)) + '</b><i>' +
          esc(a.mods.map(function (m) { return P.modText(m)[0]; }).join(' · ')) + '</i></button>';
      }).join('') + '</div></div>';
    // 分组：按 Path / Kind
    var groups = {};
    dn.forEach(function (n) {
      var g = n.p || (n.k === 'Shared' ? '共通' : n.k === 'Keystone' ? '基石' : n.k);
      (groups[g] = groups[g] || []).push(n);
    });
    html += '<div class="dragon-paths">';
    for (var g in groups) {
      html += '<div class="dragon-path"><h4>' + esc(g) + '</h4>' + groups[g].map(function (n) {
        var on = !!S.dragon.nodes[n.i];
        return '<button class="dragon-node' + (on ? ' on' : '') + (n.k === 'Keystone' || n.k === 'Capstone' ? ' crown' : '') + '" data-dn="' + esc(n.i) + '">' +
          '<b>' + esc(P.T(n.n)) + '</b><i>' + esc(P.core.treeKinds[n.k] || n.k) + '</i>' +
          '<span>' + n.m.map(function (m) { return esc(P.modText(m)[0]); }).join('<br>') + '</span></button>';
      }).join('') + '</div>';
    }
    html += '</div></div>';
    host.innerHTML = html;
  }
  function renderNodeList() {
    var host = $('pl-alt');
    var q = ($('pl-tree-q').value || '').toLowerCase();
    var arr = P.tree.nodes.filter(function (n) {
      if (!q) return n.k === 'Keystone' || n.k === 'Notable';
      var s = (P.T(n.n) + ' ' + n.i + ' ' + n.r + ' ' + n.m.map(function (m) { return P.modText(m)[0] + P.modText(m)[1]; }).join(' ')).toLowerCase();
      return s.indexOf(q) >= 0;
    });
    arr = arr.slice(0, 400);
    host.innerHTML = '<div class="node-list">' + arr.map(function (n) {
      var on = !!S.tree.alloc[n.i];
      return '<div class="node-row' + (on ? ' on' : '') + '"><div><b>' + esc(P.T(n.n)) + '</b> <i>' + esc(P.core.treeKinds[n.k] || n.k) + ' · ' + esc(P.core.tags[n.r] || n.r || '') + '</i></div>' +
        '<div class="node-mods">' + n.m.map(function (m) { return esc(P.modText(m)[0]); }).join('；') + '</div>' +
        '<button class="bo-btn plan-mini" data-node="' + esc(n.i) + '">' + (on ? '取消' : '加点') + '</button></div>';
    }).join('') + '</div>';
  }

  function renderTreeArea() {
    var tabs = document.querySelectorAll('.plan-tabs .tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].setAttribute('aria-selected', tabs[i].getAttribute('data-tab') === TAB);
    var svg = $('pl-svg'), legend = $('pl-legend'), alt = $('pl-alt'), q = $('pl-tree-q');
    var isTree = TAB === 'tree';
    if (svg) svg.style.display = isTree ? '' : 'none';
    if (legend) legend.style.display = isTree ? '' : 'none';
    if (alt) {
      if (isTree) alt.classList.remove('on'); else alt.classList.add('on');
      if (isTree) alt.innerHTML = '';
    }
    if (q) q.style.display = TAB === 'list' ? '' : (isTree ? '' : 'none');
    if (isTree) {
      if (!TS.built) buildTree();
      refreshTree();
    } else if (TAB === 'dragon') {
      TS.built = false;
      renderDragon();
    } else {
      TS.built = false;
      renderNodeList();
    }
  }

  // ================================================================ 物品弹窗
  function openItemModal(slot) {
    var it = S.gear[slot];
    var bs = P.slotBase[slot] || slot;
    var bases = P.items.bases.filter(function (b) {
      return P.baseFitsSlot ? P.baseFitsSlot(b, slot) : (b.slot === bs);
    });
    var state = { q: '', base: it.b };
    function body() {
      var cur = P.BASES[state.base];
      var uniques = cur ? P.items.uniques.filter(function (u) { return u.base === cur.id; }) : [];
      var a = it.a || [];
      var caps = P.core.consts.affixCap[it.r] || [0, 0];
      var pre = a.filter(function (x) { return P.AFF[x.i] && P.AFF[x.i].type === 'Prefix'; }).length;
      var suf = a.filter(function (x) { return P.AFF[x.i] && P.AFF[x.i].type === 'Suffix'; }).length;
      var h = '';
      h += '<div class="im-grid">';
      // 底材
      h += '<div class="im-col"><h4>底材</h4><input class="plan-input" id="im-q" placeholder="搜索底材…" value="' + esc(state.q) + '">' +
        '<div class="im-bases" id="im-bases">' + bases.filter(function (b) {
          if (!state.q) return true;
          var s = (P.T(b.n) + ' ' + b.id + ' ' + b.cls).toLowerCase();
          return s.indexOf(state.q.toLowerCase()) >= 0;
        }).map(function (b) {
          var d = b.dmg ? (' · ' + Math.round(((b.dmg[0] + b.dmg[1]) / 2) * b.aps) + ' DPS') : (b.ar ? ' · 护甲 ' + b.ar : b.es ? ' · 护盾 ' + b.es : b.ev ? ' · 闪避 ' + b.ev : '');
          return '<button class="im-base' + (state.base === b.id ? ' on' : '') + '" data-base="' + esc(b.id) + '">' +
            '<b>' + esc(P.T(b.n)) + '</b><i>' + esc(b.clsZh || b.cls) + ' · Lv' + b.lvl + d + '</i></button>';
        }).join('') + '</div></div>';
      // 右：稀有度/词缀
      h += '<div class="im-col im-main">';
      h += '<div class="im-row"><h4>稀有度</h4><div class="im-rar">' +
        ['Normal', 'Magic', 'Rare', 'Unique'].map(function (r) {
          return '<button class="chip' + (it.r === r ? ' aria-pressed="true"' : '') + '" data-rar="' + r + '">' + P.rarityZh[r] + '</button>';
        }).join('') + '</div>' +
        '<label class="im-il">物品等级 <input class="plan-input" type="number" min="1" max="100" id="im-il" value="' + (it.il || 84) + '"></label>' +
        '<label class="im-il">品质 <input class="plan-input" type="number" min="0" max="' + (P.k.qualityMax || 20) + '" id="im-quality" value="' + (it.q || 0) + '"></label></div>';
      if (it.r === 'Unique') {
        h += '<h4>传奇</h4><select class="sel" id="im-unique"><option value="">— 选择传奇 —</option>' +
          uniques.map(function (u) { return '<option value="' + esc(u.id) + '"' + (it.u === u.id ? ' selected' : '') + '>' + esc(P.T(u.n)) + ' (Lv' + u.lvl + ')</option>'; }).join('') + '</select>';
        h += '<div class="im-roll"><label>传奇 roll <b id="im-ur-val">' + Math.round(it.ur === undefined ? 50 : it.ur) + '%</b>' +
          '<input type="range" min="0" max="100" value="' + (it.ur === undefined ? 50 : it.ur) + '" data-unique-roll="1"></label>' +
          '<span class="dim">下限 → 上限；构筑代码不携带传奇 roll，默认取区间中点。</span></div>';
      } else if (it.r !== 'Normal') {
        h += '<div class="im-affhead"><h4>前缀 ' + pre + ' / ' + caps[0] + '</h4><h4>后缀 ' + suf + ' / ' + caps[1] + '</h4></div>';
        h += '<div class="im-affs">';
        ['Prefix', 'Suffix'].forEach(function (type) {
          h += '<div class="im-affcol">';
          a.forEach(function (x, idx) {
            var aff = P.AFF[x.i];
            if (!aff || aff.type !== type) return;
            var tiers = P.tiersFor(aff, it.il || 84);
            var t = aff.tiers[x.t] || tiers[0];
            var line = affLine(aff, t, x.r, it.il);
            h += '<div class="im-aff" data-idx="' + idx + '"><div class="im-aff-t"><b>' + esc(aff.grpZh || aff.grp) + '</b>' +
              '<button class="x" data-aff-del="' + idx + '">×</button></div>' +
              '<div class="im-aff-line">' + esc(line) + '</div>' +
              '<div class="im-aff-c"><select class="sel" data-aff-tier="' + idx + '">' +
              tiers.map(function (tt) {
                var realIdx = aff.tiers.indexOf(tt);
                return '<option value="' + realIdx + '"' + (realIdx === x.t ? ' selected' : '') + '>T' + (aff.tiers.length - realIdx) + ' · ilvl ' + tt.i + '</option>';
              }).join('') + '</select>' +
              '<input type="range" min="0" max="100" value="' + (x.r === undefined ? 100 : x.r) + '" data-aff-roll="' + idx + '">' +
              '</div></div>';
          });
          var can = (type === 'Prefix' ? pre : suf) < (type === 'Prefix' ? caps[0] : caps[1]);
          if ((caps[0] || caps[1]) && it.r !== 'Unique')
            h += '<button class="im-add' + (can ? '' : ' dim') + '" data-aff-add="' + type + '"' + (can ? '' : ' disabled') + '>+ ' + (type === 'Prefix' ? '前缀' : '后缀') + '</button>';
          h += '</div>';
        });
        h += '</div>';
      }
      // 孔
      var sock = (P.BASES[state.base] || {}).sock || 0;
      h += '<div class="im-row" style="margin-top:10px"><h4>符文孔 ' + (it.so || []).length + ' / ' + sock + '</h4>';
      h += '<div class="im-socks">';
      (it.so || []).forEach(function (rid, i2) {
        h += '<select class="sel" data-sock="' + i2 + '"><option value="">— 空 —</option>' +
          P.items.runes.filter(function (r) { return r.cat === 'rune'; }).map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === rid ? ' selected' : '') + '>' + esc(P.T(r.n)) + ' T' + r.tier + '</option>'; }).join('') + '</select>';
      });
      if ((it.so || []).length < sock) h += '<button class="im-add" data-sock-add="1">+ 开孔</button>';
      h += '</div></div>';
      h += '</div></div>';
      return h;
    }
    function mount() {
      var bodyEl = $('pl-modal-body');
      bodyEl.innerHTML = body();
      var foot = $('pl-modal-foot');
      if (foot && !foot.querySelector('#im-rand')) {
        foot.innerHTML = '<button class="bo-btn" id="im-rand">随机词缀</button><button class="bo-btn" id="im-remove">移除物品</button><button class="bo-btn" id="im-done">完成</button>';
        foot.querySelector('#im-rand').onclick = function () { randomAffixes(it); commit(true); };
        foot.querySelector('#im-remove').onclick = function () { S.gear[slot] = P.newItem(slot); save(); recalc(); closeModal(); renderAll(); };
        foot.querySelector('#im-done').onclick = closeModal;
      }
      function refreshLine(idx) {
        var box = bodyEl.querySelector('.im-aff[data-idx="' + idx + '"] .im-aff-line');
        var x = it.a[idx];
        if (!box || !x) return;
        var aff = P.AFF[x.i];
        box.textContent = affLine(aff, aff.tiers[x.t], x.r, it.il);
      }
      bodyEl.addEventListener('input', function (e) {
        if (e.target.id === 'im-q') { state.q = e.target.value; bodyEl.innerHTML = body(); bodyEl.querySelector('#im-q').focus(); return; }
        if (e.target.id === 'im-quality') {
          it.q = Math.max(0, Math.min(P.k.qualityMax || 20, +e.target.value || 0));
          commit(); return;
        }
        if (e.target.hasAttribute('data-unique-roll')) {
          it.ur = Math.max(0, Math.min(100, +e.target.value || 0));
          var lab = document.getElementById('im-ur-val');
          if (lab) lab.textContent = Math.round(it.ur) + '%';
          commit(); return;
        }
        if (e.target.id === 'im-il') {
          it.il = Math.max(1, Math.min(100, +e.target.value || 84));
          // 词缀阶可能超出新物品等级，重置到可用最高阶
          (it.a || []).forEach(function (x) { var aff = P.AFF[x.i]; if (aff && (aff.tiers[x.t] || {}).i > it.il) x.t = 0; });
          commit(true); return;
        }
        if (e.target.hasAttribute('data-aff-roll')) {
          var idx = +e.target.getAttribute('data-aff-roll');
          it.a[idx].r = +e.target.value;
          refreshLine(idx);
          commit(); return;
        }
      });
      bodyEl.addEventListener('change', function (e) {
        if (e.target.id === 'im-unique') { it.u = e.target.value; it.r = 'Unique'; it.a = []; commit(true); return; }
        if (e.target.hasAttribute('data-aff-tier')) {
          var idx = +e.target.getAttribute('data-aff-tier');
          it.a[idx].t = +e.target.value; commit(); return;
        }
        if (e.target.hasAttribute('data-sock')) {
          var i2 = +e.target.getAttribute('data-sock');
          it.so[i2] = e.target.value;
          it.so = it.so.filter(function (x) { return x; });
          commit(true); return;
        }
      });
      bodyEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-base]');
        if (b) {
          state.base = b.getAttribute('data-base'); it.b = state.base;
          it.a = []; it.u = ''; it.so = [];
          if (it.r === 'Unique') it.r = 'Rare';
          enforceHands(slot, it);
          commit(true); return;
        }
        var rar = e.target.closest('[data-rar]');
        if (rar) {
          it.r = rar.getAttribute('data-rar');
          if (it.r !== 'Unique') it.u = '';
          if (it.r === 'Unique') it.a = [];
          capAffixes(it);
          if (it.r === 'Unique' && !it.u) {
            var us = P.items.uniques.filter(function (x) { return x.base === it.b; });
            if (us.length) it.u = us[0].id;
            else { it.r = 'Rare'; toast('该底材没有传奇版本，已保持稀有', 'bad'); }
          }
          if (it.r === 'Normal') it.a = [];
          commit(true); return;
        }
        var del = e.target.closest('[data-aff-del]');
        if (del) { it.a.splice(+del.getAttribute('data-aff-del'), 1); commit(true); return; }
        var add = e.target.closest('[data-aff-add]');
        if (add) { openAffixPicker(slot, add.getAttribute('data-aff-add')); return; }
        var sa = e.target.closest('[data-sock-add]');
        if (sa) {
          var maxSock = (P.BASES[state.base] || {}).sock || 0;
          if ((it.so || []).length >= maxSock) { toast('该底材最多 ' + maxSock + ' 孔', 'bad'); return; }
          it.so = it.so || []; it.so.push(''); commit(true); return;
        }
      });
      function commit(rebuild) {
        S.gear[slot] = it;
        save(); recalc();
        renderGear(); renderTop(); renderStats(); renderWarnings(); renderSkills();
        if (rebuild) bodyEl.innerHTML = body();
      }
    }
    openModal('装备 · ' + P.slotZh[slot], '', '', mount);
  }

  /** 双手武器与副手互斥：弓可以和箭袋一起用 */
  function enforceHands(slot, it) {
    var base = it && it.b ? P.BASES[it.b] : null;
    if (!base) return;
    var curOh = S.gear.OffHand && S.gear.OffHand.b ? P.BASES[S.gear.OffHand.b] : null;
    if (slot === 'MainHand' && base.twoh) {
      if (!(base.cls === 'Bow' && curOh && curOh.cls === 'Quiver')) S.gear.OffHand = P.newItem('OffHand');
    } else if (slot === 'OffHand' && S.gear.MainHand && S.gear.MainHand.b) {
      var mh = P.BASES[S.gear.MainHand.b];
      if (mh && mh.twoh && !(mh.cls === 'Bow' && base.cls === 'Quiver')) { S.gear.MainHand = P.newItem('MainHand'); }
    }
  }

  /** 稀有度/上限变化后，裁掉超出前缀/后缀上限的词缀（避免不可能的组合留在物品上） */
  function capAffixes(it) {
    var caps = (P.k.affixCap && P.k.affixCap[it.r]) || [0, 0];
    var pre = 0, suf = 0, out = [];
    (it.a || []).forEach(function (x) {
      var a = P.AFF[x.i];
      if (!a) return;
      if (a.type === 'Prefix') { if (pre < caps[0]) { pre++; out.push(x); } }
      else { if (suf < caps[1]) { suf++; out.push(x); } }
    });
    it.a = out;
  }

  /** 随机生成一件合法的稀有装备（按词缀权重与上限，与游戏的掉落规则同构） */
  function randomAffixes(it) {
    var base = P.BASES[it.b];
    if (!base) return;
    if (it.r === 'Normal' || it.r === 'Unique') { it.r = 'Rare'; it.u = ''; }
    it.a = [];
    var caps = P.core.consts.affixCap[it.r] || [3, 3];
    var pool = P.items.affixes.filter(function (a) {
      return P.affixFits(a, base) && a.tiers[0].i <= (it.il || 84);
    });
    var used = {};
    ['Prefix', 'Suffix'].forEach(function (type) {
      var want = type === 'Prefix' ? caps[0] : caps[1];
      var cands = pool.filter(function (a) { return a.type === type && !used[a.grp]; });
      // 按权重抽取，最多 want 条
      for (var i = 0; i < want && cands.length; i++) {
        var total = 0, k;
        for (k = 0; k < cands.length; k++) total += (cands[k].w || 1);
        var r = Math.random() * total, pick = cands[cands.length - 1];
        for (k = 0; k < cands.length; k++) { r -= (cands[k].w || 1); if (r <= 0) { pick = cands[k]; break; } }
        used[pick.grp] = 1;
        var tiers = P.tiersFor(pick, it.il || 84);
        // 权重抽阶
        var tw = 0, j;
        for (j = 0; j < tiers.length; j++) tw += (tiers[j].w || 1);
        var rr = Math.random() * tw, tier = tiers[tiers.length - 1];
        for (j = 0; j < tiers.length; j++) { rr -= (tiers[j].w || 1); if (rr <= 0) { tier = tiers[j]; break; } }
        it.a.push({ i: pick.id, t: pick.tiers.indexOf(tier), r: Math.round(60 + Math.random() * 40) });
        cands = cands.filter(function (a) { return a.grp !== pick.grp; });
      }
    });
  }

  function affLine(aff, tier, roll, ilvl) {
    if (!tier) return P.T(aff.grpZh || aff.grp);
    var rr = (roll === undefined ? 100 : roll) / 100;
    var lo = tier.lo + (tier.hi - tier.lo) * rr;
    var lo2 = tier.lo2 !== undefined && tier.lo2 !== null ? tier.lo2 + (tier.hi2 - tier.lo2) * rr : undefined;
    var mod = { s: aff.s, m: aff.m, t: aff.t, l: aff.l, lo: Math.round(lo * 10) / 10, hi: Math.round(lo * 10) / 10, lo2: lo2, hi2: lo2 };
    if (lo2 !== undefined) mod.v2 = Math.round(lo2 * 10) / 10;
    return P.modText(mod)[0];
  }

  var affPickerState = null;
  function openAffixPicker(slot, type) {
    var it = S.gear[slot];
    var base = P.BASES[it.b];
    if (!base) { alert('请先选择底材'); return; }
    affPickerState = { slot: slot, type: type, q: '' };
    function body() {
      var st = affPickerState;
      var used = {};
      (it.a || []).forEach(function (x) { used[P.AFF[x.i] && P.AFF[x.i].grp] = 1; });
      var list = P.items.affixes.filter(function (a) {
        if (a.type !== st.type) return false;
        if (!P.affixFits(a, base)) return false;
        if (a.tiers[0].i > (it.il || 84)) return false;
        if (used[a.grp]) return false;
        if (st.q) {
          var s = (a.grpZh + ' ' + a.grp + ' ' + a.id + ' ' + affLine(a, a.tiers[0], 100)).toLowerCase();
          if (s.indexOf(st.q.toLowerCase()) < 0) return false;
        }
        return true;
      });
      var h = '<input class="plan-input" id="ap-q" placeholder="搜索词缀（按效果或名称）…" value="' + esc(st.q) + '" style="width:100%;margin-bottom:8px">';
      h += '<div class="ap-list">' + list.map(function (a) {
        var tier = P.tiersFor(a, it.il || 84)[0];
        return '<button class="ap-row" data-ap="' + esc(a.id) + '"><b>' + esc(affLine(a, tier, 100)) + '</b>' +
          '<i>' + esc((a.grpZh || a.grp) + ' · T' + (a.tiers.length - a.tiers.indexOf(tier)) + ' · ilvl ' + tier.i) + '</i></button>';
      }).join('') + (list.length ? '' : '<div class="empty">没有可用词缀（可能已达上限、物品等级不足，或该底材不支持）</div>') + '</div>';
      return h;
    }
    openModal((type === 'Prefix' ? '添加前缀' : '添加后缀') + ' · ' + P.T(base.n), '', '', function (bodyEl) {
      bodyEl.innerHTML = body();
      bodyEl.addEventListener('input', function (e) {
        if (e.target.id === 'ap-q') { affPickerState.q = e.target.value; bodyEl.innerHTML = body(); bodyEl.querySelector('#ap-q').focus(); }
      });
      bodyEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-ap]');
        if (!b) return;
        var a = P.AFF[b.getAttribute('data-ap')];
        var tiers = P.tiersFor(a, it.il || 84);
        var caps = P.k.affixCap[it.r] || [0, 0];
        var have = (it.a || []).filter(function (x) { var aa = P.AFF[x.i]; return aa && aa.type === a.type; }).length;
        var lim = a.type === 'Prefix' ? caps[0] : caps[1];
        if (have >= lim) { toast('该稀有度最多 ' + lim + ' 条' + (a.type === 'Prefix' ? '前缀' : '后缀'), 'bad'); return; }
        it.a = it.a || [];
        it.a.push({ i: a.id, t: a.tiers.indexOf(tiers[0]), r: (S.cfg && S.cfg.roll !== undefined) ? S.cfg.roll : 100 });
        save(); recalc(); closeModal();
        renderGear(); renderTop(); renderStats(); renderWarnings(); renderSkills();
        openItemModal(slot);
      });
    });
  }

  // ================================================================ 技能弹窗
  function openSkillPicker() {
    var st = { q: '' };
    function body() {
      var used = {};
      S.bar.forEach(function (x) { used[x.id] = 1; });
      var list = P.core.skills.filter(function (s) {
        if (s.kind === 'Basic' && !used[s.id]) return true;
        if (st.q) {
          var t = (P.T(s.n) + ' ' + s.id + ' ' + (s.tags || []).join(' ') + ' ' + (s.desc ? P.T(s.desc) : '')).toLowerCase();
          if (t.indexOf(st.q.toLowerCase()) < 0) return false;
        }
        return true;
      });
      var groups = {};
      list.forEach(function (s) {
        var g = s.cls || '通用';
        (groups[g] = groups[g] || []).push(s);
      });
      var h = '<input class="plan-input" id="sk-q" placeholder="搜索技能…" value="' + esc(st.q) + '" style="width:100%;margin-bottom:8px">';
      for (var g in groups) {
        h += '<h4 class="sp-head">' + esc(P.T((P.CLS[g] || {}).n || g) || g) + '</h4><div class="sp-list">';
        h += groups[g].map(function (s) {
          return '<button class="sp-row' + (used[s.id] ? ' used' : '') + '" data-sk="' + esc(s.id) + '">' +
            '<b>' + esc(P.T(s.n)) + '</b><i>' + esc(P.T(s.delivZh || s.deliv)) + ' · ' + esc((s.tags || []).slice(0, 4).map(function (t) { return P.core.tags[t] || t; }).join(' ')) + '</i></button>';
        }).join('') + '</div>';
      }
      return h;
    }
    openModal('添加技能', '', '', function (bodyEl) {
      bodyEl.innerHTML = body();
      bodyEl.addEventListener('input', function (e) {
        if (e.target.id === 'sk-q') { st.q = e.target.value; bodyEl.innerHTML = body(); bodyEl.querySelector('#sk-q').focus(); }
      });
      bodyEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-sk]');
        if (!b) return;
        var id = b.getAttribute('data-sk');
        if (S.bar.length >= 6) { toast('技能栏最多 6 个技能', 'bad'); return; }
        if (S.bar.some(function (x) { return x.id === id; })) { toast('这个技能已经在技能栏里了', 'bad'); return; }
        S.bar.push({ id: id, lv: 20, sup: [] });
        save(); recalc(); closeModal(); renderAll();
      });
    });
  }

  function openSupportPicker(skillId) {
    var entry = entryById(skillId);
    if (!entry) return;
    var st = { q: '', only: true };
    function body() {
      var list = P.core.supports.filter(function (s) {
        if (entry.sup.indexOf(s.id) >= 0) return false;
        var chk = P.checkSupport(skillId, s.id);
        if (st.only && !chk.ok) return false;
        if (st.q) {
          var t = (P.T(s.n) + ' ' + s.id + ' ' + (s.desc ? P.T(s.desc) : '')).toLowerCase();
          if (t.indexOf(st.q.toLowerCase()) < 0) return false;
        }
        s._chk = chk;
        return true;
      });
      var h = '<div class="sp-tools"><input class="plan-input" id="sp-q" placeholder="搜索辅助宝石…" value="' + esc(st.q) + '">' +
        '<label class="cfg-row"><input type="checkbox" id="sp-only"' + (st.only ? ' checked' : '') + '> 只显示可用</label></div>';
      h += '<div class="sp-list">' + list.map(function (s) {
        return '<button class="sp-row ' + (s._chk.ok ? 'ok' : 'bad') + '" data-sup="' + esc(s.id) + '">' +
          '<b>' + esc(P.T(s.n)) + ' <em>魔力 ×' + (s.mana || 1) + '</em></b>' +
          '<i>' + (s.req && s.req.length ? '需要：' + s.req.map(function (t) { return P.core.tags[t] || t; }).join('/') : '任意技能') + (s._chk.ok ? '' : ' — ' + s._chk.why) + '</i>' +
          '<span>' + (s.mods || []).map(function (m) { return esc(P.modText(m)[0]); }).join('，') + '</span></button>';
      }).join('') + '</div>';
      return h;
    }
    openModal('添加辅助 · ' + P.T(P.SK[skillId].n), '', '', function (bodyEl) {
      bodyEl.innerHTML = body();
      bodyEl.addEventListener('input', function (e) {
        if (e.target.id === 'sp-q') { st.q = e.target.value; bodyEl.innerHTML = body(); bodyEl.querySelector('#sp-q').focus(); }
        if (e.target.id === 'sp-only') { st.only = e.target.checked; bodyEl.innerHTML = body(); }
      });
      bodyEl.addEventListener('click', function (e) {
        var b = e.target.closest('[data-sup]');
        if (!b) return;
        var sid = b.getAttribute('data-sup');
        var cap = P.socketsAt(entry.lv || 1);
        if (entry.sup.length >= cap) {
          toast('宝石等级 ' + entry.lv + ' 只有 ' + cap + ' 个辅助插槽：先提升宝石等级，或移除一个辅助', 'bad');
          return;
        }
        if (!P.checkSupport(skillId, sid).ok) {
          toast('这个辅助不能用于该技能：' + P.checkSupport(skillId, sid).why, 'bad');
          return;
        }
        entry.sup.push(sid);
        save(); recalc(); closeModal(); renderAll();
      });
    });
  }

  /** 示例构筑：满词缀装备 + 推荐天赋 + 一个打满辅助的主技能 */
  function loadDemo(cls) {
    cls = cls || S.cls || 'Warrior';
    var st = P.newBuild(cls);
    st.title = '示例 · ' + P.T((P.CLS[cls] || {}).n || cls);
    // 装备：每个槽位取当前等级可用、且职业能用的最高级底材，并随机出合法稀有词缀
    var clsDef = P.CLS[cls] || {};
    var primaryWeapon = (clsDef.weapons || [])[0] || '';
    for (var i = 0; i < P.slotList.length; i++) {
      var slot = P.slotList[i], bs = P.slotBase[slot] || slot;
      if (slot === 'Idol') continue; // 游戏代码里没有神像槽，示例不放
      // 双手武器占用副手
      if (slot === 'OffHand') {
        var mhIt = st.gear.MainHand;
        if (mhIt && mhIt.b && P.BASES[mhIt.b] && P.BASES[mhIt.b].twoh) continue;
      }
      var cand = P.items.bases.filter(function (b) {
        if (b.slot !== bs || b.lvl > 84) return false;
        if (slot === 'MainHand') {
          // 主手优先用本职业的招牌武器类别
          if (primaryWeapon && b.cls === primaryWeapon) return true;
          return (clsDef.weapons || []).length ? (clsDef.weapons || []).indexOf(b.cls) >= 0 : true;
        }
        return true;
      });
      if (!cand.length) continue;
      var preferred = cand.filter(function (b) { return !primaryWeapon || b.cls === primaryWeapon; });
      var pool = preferred.length ? preferred : cand;
      var base = pool[pool.length - 1];
      var it = { s: slot, b: base.id, r: 'Rare', a: [], u: '', so: [], il: 84, q: 0, f: 0 };
      st.gear[slot] = it;
      randomAffixes(it);
      var runes = P.items.runes.filter(function (r) { return r.cat === 'rune'; }).sort(function (x, y) { return (y.tier || 0) - (x.tier || 0); });
      for (var k = 0; k < (base.sock || 0); k++) if (runes[k]) it.so.push(runes[k].id);
    }
    // 天赋：按职业推荐加点连出路径
    var sug = (P.tree.suggested || {})[cls] || [];
    sug.forEach(function (id) {
      var path = pathToIn(st, id);
      path.forEach(function (x) { st.tree.alloc[x] = 1; });
    });
    // 示例构筑把剩余点数花在附近的伤害/防御节点上（不追求最优，只让示例像一个完整构筑）
    (function fillPoints() {
      var budget = P.pointBudget(st.level || 100);
      var guard = 0;
      function used() { var n = 0; for (var id in st.tree.alloc) if (st.tree.alloc[id] && P.NODE[id] && P.NODE[id].k !== 'Start') n++; return n; }
      function score(nd) {
        var s = 0;
        for (var i = 0; i < nd.m.length; i++) {
          var m = nd.m[i];
          var v = +(m.v || 0);
          if (m.s === 'Damage' || m.s === 'MinionDamage') s += m.m === 'More' ? v * 5 : v;
          else if (m.s === 'AttackSpeed' || m.s === 'CastSpeed' || m.s === 'CritChance' || m.s === 'CritMulti' || m.s === 'SkillLevel' || m.s === 'MinionSpeed') s += m.m === 'More' ? v * 4 : v;
          else if (m.s === 'Life' || m.s === 'EnergyShield' || m.s === 'Armour' || m.s === 'Evasion') s += m.m === 'More' ? v * 2 : v * 0.5;
        }
        return s;
      }
      while (used() < budget && guard++ < 300) {
        var avail = {};
        var starts = P.classStartIds ? P.classStartIds(st.cls) : [];
        for (var s = 0; s < starts.length; s++) {
          var sn = P.NODE[starts[s]];
          if (sn) for (var sj = 0; sj < sn.l.length; sj++) if (!st.tree.alloc[sn.l[sj]]) avail[sn.l[sj]] = 1;
        }
        for (var a in st.tree.alloc) {
          if (!st.tree.alloc[a]) continue;
          var an = P.NODE[a];
          if (!an) continue;
          for (var aj = 0; aj < an.l.length; aj++) if (!st.tree.alloc[an.l[aj]]) avail[an.l[aj]] = 1;
        }
        var choices = [];
        var left = budget - used();
        for (var id in avail) {
          var nd = P.NODE[id];
          if (!nd || nd.k === 'Start') continue;
          if (nd.ch) {
            var clash = false;
            for (var a2 in st.tree.alloc) if (st.tree.alloc[a2] && P.NODE[a2] && P.NODE[a2].ch === nd.ch) { clash = true; break; }
            if (clash) continue;
          }
          var path = pathToIn(st, id);
          if (!path.length || path.length > left) continue;
          choices.push({ id: id, score: score(nd) / Math.max(1, path.length) });
        }
        if (!choices.length) break;
        choices.sort(function (x, y) { return y.score - x.score; });
        var p = pathToIn(st, choices[0].id);
        if (!p.length) break;
        p.forEach(function (x) { st.tree.alloc[x] = 1; });
      }
    })();
    // 技能与辅助
    var main = st.bar[0] && st.bar[0].id;
    if (main) {
      var legal = P.core.supports.filter(function (s) { return P.checkSupport(main, s.id).ok; })
        .sort(function (x, y) { return (y.drop || 0) - (x.drop || 0); });
      st.bar[0].lv = 20;
      st.bar[0].sup = legal.slice(0, Math.min(P.socketsAt(20), 5)).map(function (s) { return s.id; });
    }
    // 龙裔：两个节点 + 职业形态
    var dn = (P.tree.dragon.classes || {})[cls] || [];
    if (dn[0]) st.dragon.nodes[dn[0].i] = 1;
    if (dn[1]) st.dragon.nodes[dn[1].i] = 1;
    // 属性不达标就降级底材，保证示例构筑本身是合法的
    for (var pass = 0; pass < 6; pass++) {
      var attrs = P.calc(st).attrs, changed = false;
      for (var s2 = 0; s2 < P.slotList.length; s2++) {
        var sl = P.slotList[s2], item = st.gear[sl];
        if (!item.b) continue;
        var bse = P.BASES[item.b], req = bse.req || [0, 0, 0];
        if (req[0] <= attrs.str && req[1] <= attrs.dex && req[2] <= attrs.int) continue;
        var lower = P.items.bases.filter(function (b) {
          if (b.slot !== (P.slotBase[sl] || sl) || !b.req) return false;
          if (sl === 'MainHand' && primaryWeapon && b.cls !== primaryWeapon) return false;
          return b.req[0] <= attrs.str && b.req[1] <= attrs.dex && b.req[2] <= attrs.int && b.lvl <= 84;
        });
        if (!lower.length) continue;
        var nb = lower[lower.length - 1];
        item.b = nb.id; item.a = []; item.so = [];
        randomAffixes(item);
        var rn = P.items.runes.filter(function (r) { return r.cat === 'rune'; }).sort(function (x, y) { return (y.tier || 0) - (x.tier || 0); });
        for (var k2 = 0; k2 < (nb.sock || 0); k2++) if (rn[k2]) item.so.push(rn[k2].id);
        changed = true;
      }
      if (!changed) break;
    }
    return st;
  }
  var pathToIn = function (st, target) {
    var start = [], conn = P.connectedAlloc(st);
    for (var i = 0; i < P.tree.nodes.length; i++) {
      var nd = P.tree.nodes[i];
      if (nd.cs === st.cls || (st.tree.alloc[nd.i] && conn[nd.i])) start.push(nd.i);
    }
    var prev = {}, q = start.slice(), seen = {};
    start.forEach(function (x) { seen[x] = 1; });
    var head = 0;
    while (head < q.length) {
      var cur = q[head++];
      if (cur === target) break;
      var node = P.NODE[cur];
      if (!node) continue;
      for (var j = 0; j < node.l.length; j++) {
        var nx = node.l[j];
        if (seen[nx] || !P.NODE[nx]) continue;
        seen[nx] = 1; prev[nx] = cur; q.push(nx);
      }
    }
    var out = [], c2 = target, guard = 0;
    while (c2 && guard++ < 500) {
      out.unshift(c2);
      if (start.indexOf(c2) >= 0) break;
      c2 = prev[c2];
    }
    return out;
  };

  // ================================================================ 代码导入导出
  function openImport() {
    var h = '<p class="note">粘贴游戏内的构筑代码（<code>BO1.</code> 开头）或本站的完整代码（<code>BO2.</code> 开头）。</p>' +
      '<textarea id="im-code" class="plan-code-input" rows="5" placeholder="BO1.xxxxxxxx…"></textarea>' +
      '<div id="im-msg" class="note"></div><div id="im-report"></div>';
    openModal('导入构筑代码', h, '<button class="bo-btn" id="im-do">解析</button>', function () {
      $('im-code').focus();
    });
    $('im-do').onclick = function () {
      var code = $('im-code').value.trim();
      if (!code) return;
      $('im-msg').textContent = '解析中…';
      P.decode(code).then(function (dec) {
        var st = P.stateFromCode(dec);
        var rep = P.importReport(dec, st);
        $('im-msg').textContent = '';
        $('im-report').innerHTML = importReportHtml(rep);
        var foot = $('pl-modal-foot');
        foot.innerHTML = '<button class="bo-btn" id="im-apply">应用此构筑</button><button class="bo-btn" id="im-cancel">取消</button>';
        $('im-cancel').onclick = closeModal;
        $('im-apply').onclick = function () {
          S = normalize(st);
          save(); recalc();
          closeModal(); renderAll();
          toast('已导入：' + rep.cls + ' Lv' + rep.level + ' · ' + Math.round(rep.dps) + ' DPS');
        };
      }).catch(function (err) {
        $('im-msg').textContent = '导入失败：' + err.message;
        toast('导入失败：' + err.message, 'bad');
      });
    };
  }
  function importReportHtml(rep) {
    if (!rep) return '';
    var h = '<div class="imp-report">';
    h += '<div class="imp-head"><b>' + esc(rep.title || '未命名构筑') + '</b><span>' + esc(rep.cls) + ' · Lv' + rep.level +
      ' · ' + esc(rep.format) + '</span></div>';
    h += '<div class="imp-stats"><div><b>' + P.fmt(rep.dps, 0) + '</b><span>最高技能 DPS</span></div>' +
      '<div><b>' + rep.lineCount + '</b><span>天赋点</span></div>' +
      '<div><b>' + rep.dragonCount + '</b><span>龙裔节点</span></div>' +
      '<div><b>' + rep.gear.length + '</b><span>装备</span></div></div>';
    if (rep.skills.length) {
      h += '<h4>技能与辅助</h4><ul class="imp-skills">' + rep.skills.map(function (s) {
        return '<li><b>' + esc(s.name) + '</b> <i>宝石 ' + s.lv + '</i>' + (s.sup.length ? '<span>' + s.sup.map(esc).join(' · ') + '</span>' : '<span class="dim">无辅助</span>') + '</li>';
      }).join('') + '</ul>';
    }
    if (rep.gear.length) {
      h += '<h4>装备</h4><ul class="imp-gear">' + rep.gear.map(function (g) {
        return '<li><span>' + esc(g.slot) + '</span><b>' + esc(g.name) + '</b><i>' + esc(g.rarity) + (g.il ? ' · ilvl ' + g.il : '') + (g.bare ? ' · 仅底材' : '') + '</i></li>';
      }).join('') + '</ul>';
    }
    if (rep.lines.length) h += '<ul class="imp-note">' + rep.lines.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (rep.errors.length) h += '<ul class="warn-list bad">' + rep.errors.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (rep.warnings.length) h += '<ul class="warn-list">' + rep.warnings.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '</div>';
    return h;
  }
  function openExport() {
    P.encodeFull(S).then(function (full) {
      return P.encodeGame(S).then(function (game) { return { full: full, game: game }; });
    }).then(function (r) {
      var h = '<h4>游戏代码（BO1）</h4><p class="note">与游戏内「分享构筑」一致：职业、等级、天赋、龙裔、技能与辅助、装备底材与传奇。不含随机词缀与符文。</p>' +
        '<textarea class="plan-code-input" rows="4" readonly id="ex-game">' + esc(r.game) + '</textarea>' +
        '<div class="im-row"><button class="bo-btn" id="ex-copy1">复制</button><button class="bo-btn" id="ex-link">复制分享链接</button></div>' +
        '<h4 style="margin-top:14px">完整代码（BO2）</h4><p class="note">包含词缀、roll、符文、誓约与计算设置，可在本站完整还原。</p>' +
        '<textarea class="plan-code-input" rows="4" readonly id="ex-full">' + esc(r.full) + '</textarea>' +
        '<div class="im-row"><button class="bo-btn" id="ex-copy2">复制</button></div>';
      openModal('导出构筑代码', h, '<button class="bo-btn" id="ex-done">完成</button>');
      $('ex-done').onclick = closeModal;
      $('ex-copy1').onclick = function () { copy($('ex-game').value); };
      $('ex-copy2').onclick = function () { copy($('ex-full').value); };
      $('ex-link').onclick = function () {
        var url = location.origin + location.pathname + '#code=' + r.full;
        copy(url);
      };
    }).catch(function (e) {
      openModal('导出失败', '<p class="note">浏览器不支持 CompressionStream：' + esc(e.message) + '</p>', '<button class="bo-btn" id="ex-done">完成</button>');
      $('ex-done').onclick = closeModal;
    });
  }
  function copy(txt) {
    if (navigator.clipboard) navigator.clipboard.writeText(txt);
    else { var t = el('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  }

  // ================================================================ 文档
  function renderDoc() {
    var K = P.core.consts;
    var A = K.ail || {};
    var gem = (P.SK.arc && P.SK.arc.growth) ? (1 + P.SK.arc.growth).toFixed(2) : (K.gemGrowth || 1.19);
    $('pl-doc').innerHTML =
      '<p>本页直接读取游戏数据文件（技能宝石、辅助宝石、词缀、传奇、天赋树、龙裔、缩放曲线），按游戏内规则逐条结算。伤害面板与游戏内角色面板口径一致：<b>不计敌人抗性</b>；「有效 DPS」才是计入目标抗性与穿透后的估计值。</p>' +
      '<div class="doc-grid">' +
      '<div><h3>伤害的组成</h3><ul>' +
      '<li><b>攻击技能</b>：武器基础伤害（含武器上的局部百分比与附加伤害、品质）乘技能宝石的<b>伤害效率</b>，再乘宝石等级：自身等级每级 +' + Math.round((K.effPerLvl || 0.08) * 100) + '% 武器伤害占比，装备/天赋的额外等级每级 ×' + (K.bonusLvlMore || 1.06) + '。</li>' +
      '<li><b>法术技能</b>：基础伤害来自宝石等级（全局 ×' + gem + '/级），再乘技能自带的效率曲线（Early / Late 分段）。附加伤害按「随宝石成长（GemScaled）」或技能效率放大。</li>' +
      '<li><b>increase/reduce</b> 同类相加；<b>more/less</b> 每条单独乘算。力量每 10 点给物理近战 +' + (K.strMeleePhys || 2) + '% 增加伤害；智力每 10 点给法术 +' + (K.intSpell || 2) + '% 增加伤害。</li>' +
      '<li><b>伤害引擎（0.56.5）</b>：山岳之裔的力量、护甲/闪避/护盾/生命/格挡换算出的更多伤害先加在一起，再作为一个乘区。</li>' +
      '<li><b>按伤害类型分桶</b>：转化（Convert）后的伤害保留原类型的加成并获得新类型的加成；「获得额外伤害」按来源桶折算，再吃目标类型的加成。</li>' +
      '<li><b>暴击</b>：攻击取武器基础暴击，法术取 ' + K.spellCritBase + '%（法杖取杖的暴击），增加/更多后上限 ' + K.critCap + '%；暴击期望 = 1 + 暴击率 ×(暴击倍率−1)。</li>' +
      '<li><b>速度</b>：攻击 = 武器攻速 ×(1+攻击速度)×技能动作速度×动画片段 Rate；法术 = 1/施法时间 ×施法速度×动画 Rate；冷却按 0.56.2 随速度恢复，取「施法/攻击时间」与「冷却」的较大值。</li>' +
      '<li><b>打击数</b>：重复（Repeat/Spell Echo）、投射物（一次施放同一敌人只被一枚普通投射物击中；雨和环绕例外）、额外落点（天降第二段）、导引（Orbit）、印记（Brand）、图腾、引导每跳与余像都会计入。</li>' +
      '</ul></div>' +
      '<div><h3>异常状态与目标</h3><ul>' +
      '<li><b>流血</b>：物理命中的 ' + Math.round((A.BleedFracPerSec || 0.5) * 100) + '%/秒，持续 4 秒，只保留最强一条；按命中频率算覆盖率。</li>' +
      '<li><b>点燃</b>：火焰命中的 ' + Math.round((A.IgniteFrac || 0.9) * 100) + '% 在 ' + (A.IgniteSeconds || 4) + ' 秒内烧完，基础几率 ' + (A.IgniteChance || 6) + '%；可叠层时按泊松期望算同时燃烧条数。</li>' +
      '<li><b>中毒</b>：每层每秒 = 命中的 ' + Math.round((A.PoisonFracPerSec || 0.2) * 100) + '%，持续 ' + (A.PoisonSeconds || 2) + ' 秒，最多 ' + (A.PoisonMaxStacks || 40) + ' 层；层数 = 命中频率 × 持续时间 × 几率。</li>' +
      '<li><b>感电</b>：按闪电命中/目标生命的比例提升目标受到的伤害（' + (A.ShockMin || 5) + '%–' + (A.ShockMax || 20) + '%，效果词条可提高到 ' + (A.ShockMaxCap || 50) + '%）；可在「计算设置」里选择是否计入。</li>' +
      '<li><b>猎人印记</b>：被链接技能每次击中叠 1 层，每层使目标承受 1.4% 更多伤害，守护者上限翻倍；按命中频率与 3 秒持续时间估算常驻层数。</li>' +
      '<li><b>诅咒</b>：目标受到的伤害提高 / 抗性降低会计入「有效 DPS」，并按智力每 10 点 +' + (K.intCurse || 1) + '% 诅咒效果放大。</li>' +
      '</ul>' +
      '<h3>召唤物</h3><ul>' +
      '<li>召唤物伤害来自召唤技能的 SpellMin/Max × 宝石成长、召唤物伤害倍率、召唤物伤害增加/更多、数量与攻击间隔；<b>近身 60% 更多</b>与力量/智力亲和按游戏面板口径计入。</li>' +
      '<li>数量 = 技能上限 + 每 N 级 + 指定等级 + 召唤物上限词条；只允许一只的召唤物（如墓穴魔像）不吃额外上限。</li>' +
      '</ul>' +
      '<h3>校验规则</h3><ul>' +
      '<li>装备：稀有 3 前缀 + 3 后缀、魔法 1+1、普通 0；同一词缀组只能出现一次；词缀必须符合底材标签与物品等级；孔数受底材上限限制；传奇只能出现在自己的底材上；双手武器占用副手（弓 + 箭袋除外）。</li>' +
      '<li>辅助宝石：必须满足「需要任一标签」且不包含「不可用标签」；同一辅助不能重复；超过宝石插槽数会提示（导入的旧代码可能带旧插槽）。</li>' +
      '<li>天赋：必须与职业起点连通（旧代码里未连通的点只提示、仍计入数值）；同一抉择只能选一个；点数上限 = 等级 + 任务奖励。</li>' +
      '<li>龙裔：王冠节点（基石/顶点）最多 1 个；点数 = 里程碑 + 已过关门 + 尖峰；形态与节点必须属于本职业。</li>' +
      '<li>誓约：保留总量不能超过魔力上限；同一形态的保留按宝石等级成长。</li>' +
      '</ul></div></div>' +
      '<h3>构筑代码</h3><ul>' +
      '<li><code>BO1.</code> 与游戏内「分享构筑」一致：职业/等级/天赋/龙裔/技能与辅助/装备底材与传奇。随机词缀、符文、誓约与 roll 不在这份代码里；稀有装备导入后只有底材，需要手动补词缀。</li>' +
      '<li><code>BO2.</code> 是本站扩展格式：额外保存词缀、roll、品质、传奇 roll、符文、誓约/诅咒、天赋插槽与计算设置，可完整还原。</li>' +
      '<li>导入时会先显示「导入报告」：技能、辅助、装备、天赋/龙裔数量、DPS，以及缺少的词缀/符文和非法组合，再决定是否应用。</li>' +
      '</ul>' +
      '<p class="note">数据版本 ' + esc(P.core.meta.ver) + ' · 生成脚本 <code>build/build_planner_data.py</code> · 计算引擎 <code>site/assets/planner.js</code> · 校验脚本 <code>tools/planner_validate.js</code>。' +
      '敌人护甲、部分传奇/龙裔的特殊触发与动画细节仍以数据能表达的部分为准；数值随游戏版本变化，仅供参考。</p>';
  }

  // ================================================================ 总渲染
  function renderAll() {
    renderTop(); renderGear(); renderVows(); renderSkills(); renderStats(); renderWarnings(); renderCfg();
    renderTreeArea(); renderDoc();
  }

  // ================================================================ 事件
  function bind() {
    $('pl-class').addEventListener('change', function (e) {
      S.cls = e.target.value;
      // 清理不属于该职业的龙裔节点
      var dn = {};
      ((P.tree.dragon.classes || {})[S.cls] || []).forEach(function (n) { dn[n.i] = 1; });
      for (var k in S.dragon.nodes) if (!dn[k]) delete S.dragon.nodes[k];
      S.dragon.aspect = (P.tree.dragon.classAspect || {})[S.cls] || '';
      save(); recalc(); renderAll();
    });
    $('pl-level').addEventListener('change', function (e) {
      S.level = Math.max(1, Math.min(100, +e.target.value || 1));
      save(); recalc(); renderAll();
    });
    $('pl-title').addEventListener('input', function (e) { S.title = e.target.value; save(); });
    $('pl-add-skill').onclick = openSkillPicker;
    $('pl-import-open').onclick = openImport;
    $('pl-export').onclick = openExport;
    $('pl-reset').onclick = function () {
      if (!confirm('清空当前构筑？')) return;
      S = P.newBuild(S.cls);
      save(); recalc(); renderAll();
      toast('已清空，只保留职业起始武器与一个技能');
    };
    $('pl-demo').onclick = function () {
      S = normalize(loadDemo(S.cls));
      save(); recalc(); renderAll();
      toast('已载入示例构筑：满词缀稀有装备 + 推荐天赋 + 主技能满辅助');
    };
    $('pl-modal-x').onclick = closeModal;
    $('pl-modal').addEventListener('click', function (e) { if (e.target.id === 'pl-modal') closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

    // 装备 / 誓约 / 诅咒 / 技能卡片（事件委托）
    document.addEventListener('click', function (e) {
      var g = e.target.closest('.gear-slot');
      if (g && !e.target.closest('.plan-modal')) { openItemModal(g.getAttribute('data-slot')); return; }
      var v = e.target.closest('[data-vow]');
      if (v) { var id = v.getAttribute('data-vow'); S.vows[id] = S.vows[id] ? 0 : 1; if (!S.vows[id]) delete S.vows[id]; save(); recalc(); renderAll(); return; }
      var cu = e.target.closest('[data-curse]');
      if (cu) { var cid = cu.getAttribute('data-curse'); S.curses[cid] = S.curses[cid] ? 0 : 1; if (!S.curses[cid]) delete S.curses[cid]; save(); recalc(); renderAll(); return; }
      var sa = e.target.closest('[data-sup-add]');
      if (sa) { openSupportPicker(sa.getAttribute('data-sup-add')); return; }
      var sd = e.target.closest('[data-sup-del]');
      if (sd) {
        var chip = sd.closest('.sup-chip');
        var sk = chip && chip.getAttribute('data-skill'), sid = chip && chip.getAttribute('data-sid');
        var en = entryById(sk);
        if (en) { var i = en.sup.indexOf(sid); if (i >= 0) en.sup.splice(i, 1); }
        save(); recalc(); renderAll(); return;
      }
      var lv = e.target.closest('[data-lv]');
      if (lv) {
        var en2 = entryById(lv.getAttribute('data-skill'));
        if (en2) { en2.lv = Math.max(1, Math.min(40, en2.lv + (+lv.getAttribute('data-lv')))); }
        save(); recalc(); renderAll(); return;
      }
      var xd = e.target.closest('[data-sk-del]');
      if (xd) {
        var id2 = xd.getAttribute('data-sk-del');
        S.bar = S.bar.filter(function (x) { return x.id !== id2; });
        save(); recalc(); renderAll(); return;
      }
      var tab = e.target.closest('.plan-tabs .tab');
      if (tab) { TAB = tab.getAttribute('data-tab'); renderTreeArea(); renderTop(); return; }
      var asp = e.target.closest('[data-aspect]');
      if (asp) { S.dragon.aspect = S.dragon.aspect === asp.getAttribute('data-aspect') ? '' : asp.getAttribute('data-aspect'); save(); recalc(); renderAll(); return; }
      var dnode = e.target.closest('[data-dn]');
      if (dnode) {
        var did = dnode.getAttribute('data-dn');
        if (S.dragon.nodes[did]) delete S.dragon.nodes[did]; else S.dragon.nodes[did] = 1;
        save(); recalc(); renderAll(); return;
      }
      var nrow = e.target.closest('[data-node]');
      if (nrow) {
        var nid = nrow.getAttribute('data-node');
        if (S.tree.alloc[nid]) deallocNode(nid); else toggleNode(nid, true);
        renderNodeList(); return;
      }
    });

    $('pl-tree-rec').onclick = function () {
      if (TAB !== 'tree') { TAB = 'tree'; renderTreeArea(); }
      var sug = (P.tree.suggested || {})[S.cls] || [];
      sug.forEach(function (id) { var p = pathTo(id); p.forEach(function (x) { S.tree.alloc[x] = 1; }); });
      afterTreeChange();
    };
    $('pl-tree-clear').onclick = function () {
      S.tree.alloc = {}; afterTreeChange();
    };
    $('pl-tree-fit').onclick = function () { if (TAB === 'tree') fitTree(); };
    $('pl-tree-all').onclick = function () { if (TAB === 'tree') fitTree('all'); };
    $('pl-tree-q').addEventListener('input', BO.debounce(function (e) {
      if (TAB === 'list') renderNodeList();
      else if (TAB === 'tree') {
        var q = e.target.value.toLowerCase().trim();
        for (var id in TS.nodeEls) {
          var nd = P.NODE[id];
          var hit = q && ((P.T(nd.n) + ' ' + id).toLowerCase().indexOf(q) >= 0);
          TS.nodeEls[id].style.filter = q ? (hit ? 'brightness(1.8) drop-shadow(0 0 6px #e7b478)' : 'opacity(.25)') : '';
        }
      }
    }, 140));
    $('pl-cfg').addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-cfg');
      if (!k) return;
      S.cfg[k] = e.target.type === 'checkbox' ? (e.target.checked ? 1 : 0) : (isNaN(+e.target.value) ? e.target.value : +e.target.value);
      save(); recalc(); renderAll();
    });
    // 分享链接
    if (location.hash.indexOf('#code=') === 0) {
      var code = decodeURIComponent(location.hash.slice(6));
      P.decode(code).then(function (dec) {
        S = normalize(P.stateFromCode(dec));
        save(); recalc(); renderAll();
        toast('已从链接导入构筑：' + P.T((P.CLS[S.cls] || {}).n || S.cls) + ' Lv' + S.level);
      }).catch(function (err) {
        toast('链接中的构筑代码无法解析：' + err.message, 'bad');
      });
    }
  }

  // ================================================================ 启动
  function boot() {
    window.addEventListener('error', function (e) {
      try { toast('页面脚本错误：' + (e.message || e.error), 'bad'); } catch (x) { }
    });
    window.addEventListener('unhandledrejection', function (e) {
      try { toast('异步错误：' + ((e.reason && e.reason.message) || e.reason), 'bad'); } catch (x) { }
    });
    BO.mountHeader('planner.html'); BO.mountFooter(); BO.setDocumentTitle('模拟构筑', 'Build Planner');
    S = loadSaved() || P.newBuild('Warrior');
    if (!S.dragon.aspect) S.dragon.aspect = (P.tree.dragon.classAspect || {})[S.cls] || '';
    if (!S.cfg) S.cfg = { boss: 1, shock: 0, roll: 100, rl: 80, target: 'boss', gates: 6, pinnacle: 1 };
    recalc();
    renderAll();
    bind();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // 供自动化测试/调试使用（不影响正常使用）
  window.BOPUI = {
    openItem: function (slot) { openItemModal(slot); },
    openSkillPicker: openSkillPicker,
    openSupport: function (id) { openSupportPicker(id); },
    openImport: openImport,
    openExport: openExport,
    demo: function (cls) { S = normalize(loadDemo(cls)); save(); recalc(); renderAll(); },
    state: function () { return S; },
    result: function () { return R; },
    selectTab: function (t) { TAB = t; renderTreeArea(); renderTop(); },
    toast: toast
  };
})();
