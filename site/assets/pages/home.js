/* Home page — live league, ladder, meta and database overview. */
(function () {
  'use strict';
  var BO = window.BO;
  var POE_TIPS = {};

  function el(id) { return document.getElementById(id); }

  function leagueTime(l) {
    var now = Date.now();
    var a = new Date(l.starts_at).getTime(), b = new Date(l.ends_at).getTime();
    if (BO.leagueStatus(l) === 'upcoming') return (isFinite(a) ? BO.dur(a - now) : '—') + ' 后开始';
    if (BO.leagueStatus(l) === 'ended') return '已结束';
    return (isFinite(b) ? '剩余 ' + BO.dur(b - now) : '—');
  }

  function renderLeagues(leagues, current) {
    var host = el('leagueRail');
    var rows = BO.leagueSort(leagues.leagues || []);
    var groups = [], bySeason = {};
    rows.forEach(function (l) {
      var key = l.season || l.season_name || l.id;
      if (!bySeason[key]) {
        bySeason[key] = { key: key, name: BO.seasonName(l), rows: [], best: null };
        groups.push(bySeason[key]);
      }
      bySeason[key].rows.push(l);
      var g = bySeason[key];
      if (!g.best || (l.trade && !l.hardcore && (!g.best.trade || g.best.hardcore)) || (g.best.hardcore && !l.hardcore)) g.best = l;
    });
    // PoEDB-style header: the top row is the live league plus one featured next season.
    var next = groups.find(function (g) { return BO.leagueStatus(g.best || g.rows[0]) === 'upcoming'; }) || groups.filter(function (g) { return BO.leagueStatus(g.best || g.rows[0]) !== 'upcoming'; })[0];
    var shown = next ? [next] : groups.slice(0, 1);
    host.innerHTML = shown.map(function (g) {
      var best = g.best || g.rows[0];
      var status = BO.leagueStatus(best);
      return '<a class="league ' + status + '" href="ladder.html?league=' + encodeURIComponent(best.id) + '">' +
        '<span class="league-nm"><span class="dot ' + status + '"></span><span class="ln">' + BO.esc(g.name) + '</span>' +
        (g.rows.length > 1 ? '<span class="league-tag" style="margin-left:auto">' + g.rows.length + ' 个模式</span>' : '') + '</span>' +
        '<span class="league-meta"><span>' + BO.esc(BO.leagueShort(best)) + '</span><span class="league-tag">' + BO.esc(leagueTime(best)) + '</span></span></a>';
    }).join('');
    if (shown.length < groups.length) {
      host.innerHTML += '<a class="league" href="ladder.html" style="display:flex;align-items:center;justify-content:center;color:var(--gold2);font-size:12px">全部 ' + groups.length + ' 个赛季 →</a>';
    }
  }

  function renderLive(version, leagues, currentRow, ladder, meta) {
    var card = el('liveCard');
    if (!currentRow) { card.innerHTML = BO.empty('没有公开联赛', 'API 暂未返回联赛列表。'); return; }
    el('lcLeague').textContent = BO.seasonName(currentRow);
    el('lcSub').innerHTML = BO.esc(BO.leagueShort(currentRow)) + ' · ' + BO.esc(BO.fmtDate(currentRow.starts_at)) + ' → ' + BO.esc(BO.fmtDate(currentRow.ends_at));
    el('lcHeroes').textContent = ladder ? BO.num(ladder.count) : '—';
    el('lcBuilds').textContent = meta ? BO.num((meta.sample && meta.sample.heroes) || meta.heroes || 0) : '—';
    el('lcPatch').textContent = version.patch || '—';
    var ends = new Date(currentRow.ends_at).getTime();
    el('lcLeft').textContent = isFinite(ends) ? '剩余 ' + BO.dur(ends - Date.now()) : '—';

    el('heroPatch').textContent = 'Patch ' + (version.patch || '—');
    el('heroSynced').textContent = '构筑数据 ' + BO.ago(version.builds_updated_at);
    if (el('poeSyncText')) el('poeSyncText').textContent = '数据同步于 ' + BO.ago(version.builds_updated_at) + ' · Patch ' + (version.patch || '—');
  }

  function renderStats(version, leagues, ladder, meta) {
    var host = el('statGrid');
    var published = meta ? ((meta.sample && meta.sample.heroes) || meta.heroes || 0) : 0;
    host.innerHTML =
      '<div class="stat"><b>' + (leagues.leagues || []).length + '</b><span>公开联赛</span><small>官方赛季 · 含已结束</small></div>' +
      '<div class="stat"><b>' + (ladder ? BO.num(ladder.count) : '—') + '</b><span>天梯英雄</span><small>当前联赛 · 每职业前 200</small></div>' +
      '<div class="stat gold"><b>' + (published ? BO.num(published) : '—') + '</b><span>已发布构筑</span><small>每小时更新</small></div>' +
      '<div class="stat"><b>' + BO.esc(version.patch || '—') + '</b><span>游戏补丁</span><small>game build ' + (version.game_build || '—') + '</small></div>';
  }

  function renderLadder(leagues, current, ladder) {
    var host = el('topLadder');
    var row = leagues.leagues.find(function (l) { return l.id === current; });
    el('topLadderSub').textContent = BO.seasonName(row) + ' · ' + BO.leagueShort(row) + ' · ' + (ladder.count || 0) + ' 人';
    if (!ladder.heroes || !ladder.heroes.length) {
      host.innerHTML = BO.empty('天梯还是空的', '新联赛开启后需要几小时才会有人上榜。稍后再来看看。');
      return;
    }
    var maxDps = Math.max.apply(null, ladder.heroes.map(function (h) { return h.guardian_dps_median || 0; })) || 1;
    var rows = ladder.heroes.slice(0, 10).map(function (h) {
      var build = h.has_build ? '<a class="btn btn-sm" href="' + BO.heroUrl(current, h.class, h.hero) + '">查看</a>' : '<span class="tag">无构筑</span>';
      var skillId = String(h.main_skill || '').toLowerCase();
      var isHidden = !skillId || skillId === 'hidden';
      var skillPair = isHidden ? null : BO.namePair('skills', skillId);
      var skill = skillPair ? (BO.LANG ? skillPair[1] : skillPair[0]) : (isHidden ? '未公开' : BO.pretty(h.main_skill));
      return '<tr class="' + (h.has_build ? 'clickable' : '') + '"' + (h.has_build ? ' data-href="' + BO.attr(BO.heroUrl(current, h.class, h.hero)) + '"' : '') + '>' +
        '<td class="rank ' + (h.rank <= 3 ? 'top' : '') + '">' + h.rank + '</td>' +
        '<td class="name">' + BO.classChip(h.class) + (h.dead ? ' <span class="tag red">已阵亡</span>' : '') + '</td>' +
        '<td>' + BO.aspectChip(h.ascendancy) + '</td>' +
        '<td class="num">' + h.level + '</td>' +
        '<td class="num">' + (h.rupture_level == null ? '—' : h.rupture_level) + '</td>' +
        '<td class="name">' + (skillPair && BO.hasLocal('skills', skillId) ? '<a href="skills.html#skills/' + encodeURIComponent(skillId) + '">' + BO.esc(skill) + '</a>' : '<span' + (isHidden ? ' class="tag"' : '') + '>' + BO.esc(skill) + '</span>') + '</td>' +
        '<td class="num"><span class="dps">' + (h.guardian_dps_median ? BO.big(h.guardian_dps_median) : '—') + '</span><div class="mini-bar"><i style="width:' + Math.max(2, (h.guardian_dps_median || 0) / maxDps * 100) + '%"></i></div></td>' +
        '<td class="actions">' + build + '</td></tr>';
    }).join('');
    host.innerHTML = '<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th>#</th><th>职业</th><th>龙相</th><th class="num">等级</th><th class="num">裂隙</th><th>主技能</th><th class="num">守护者 DPS</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    Array.prototype.forEach.call(host.querySelectorAll('tr[data-href]'), function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        location.href = tr.dataset.href;
      });
    });
  }

  function donut(meta) {
    var host = el('classShare');
    if (!meta || !meta.classes || !meta.classes.length) {
      host.innerHTML = '<div class="small muted">暂无职业分布数据。</div>';
      return;
    }
    var colors = {
      Warrior: '#c46a4a', Mage: '#6f9ed6', Ranger: '#7fbf6a',
      Samurai: '#d9a441', Paladin: '#e3d3a1', Necromancer: '#a98bd6'
    };
    var rows = meta.classes.slice().sort(function (a, b) { return b.share - a.share; });
    var total = rows.reduce(function (s, r) { return s + r.share; }, 0) || 1;
    var acc = 0;
    var stops = rows.map(function (r) {
      var from = acc / total * 100;
      acc += r.share;
      var to = acc / total * 100;
      return colors[r.id] + ' ' + from.toFixed(2) + '% ' + to.toFixed(2) + '%';
    }).join(', ');
    host.innerHTML = '<div class="donut" style="background:conic-gradient(' + stops + ')"><div class="donut-c"><b>' + (meta.heroes || rows.reduce(function (s, r) { return s + r.heroes; }, 0)) + '</b><span>英雄</span></div></div>' +
      '<div class="donut-legend">' + rows.map(function (r) {
        return '<div class="dl-row"><span class="dot" style="background:' + colors[r.id] + '"></span>' + BO.esc(BO.classZh(r.id)) + '<b>' + r.share + '%</b></div>';
      }).join('') + '</div>';
  }

  function skillBars(meta) {
    var host = el('skillShare');
    if (!meta || !meta.main_skills || !meta.main_skills.length) {
      host.innerHTML = '<div class="small muted">暂无技能数据。</div>';
      return;
    }
    var rows = meta.main_skills.slice(0, 6);
    var max = rows[0].share || 1;
    host.innerHTML = rows.map(function (r) {
      var nm = BO.namePair('skills', String(r.skill).toLowerCase());
      var label = nm ? (BO.LANG ? nm[1] : nm[0]) : BO.pretty(r.skill);
      return '<div class="bar-row"><div class="bar-label c-' + BO.attr(r.class) + '"><span class="dot" style="background:' + BO.classColor(r.class) + '"></span><span>' + BO.esc(label) + '</span></div>' +
        '<div class="bar-track"><i class="bar-fill" style="width:' + Math.max(2, r.share / max * 100) + '%"></i></div><div class="bar-value">' + r.share + '%</div></div>';
    }).join('');
  }

  function renderBuilds(current, ladder) {
    var host = el('buildGrid');
    if (!ladder || !ladder.heroes || !ladder.heroes.length) {
      host.innerHTML = BO.empty('暂无构筑', '当前联赛还没有已发布的构筑。');
      return;
    }
    var byClass = {};
    ladder.heroes.forEach(function (h) {
      if (!h.has_build) return;
      if (!byClass[h.class]) byClass[h.class] = h;
    });
    var picks = BO.CLASS_LIST.filter(function (c) { return byClass[c]; }).map(function (c) { return byClass[c]; });
    picks = picks.slice(0, 6);
    if (!picks.length) {
      host.innerHTML = BO.empty('暂无构筑', '天梯英雄还没有公开构筑，稍后再来。');
      return;
    }
    host.innerHTML = picks.map(function (row) { return BO.buildCard(row, current); }).join('');
  }

  function poeLink(page, label) {
    var tip = POE_TIPS[label] || '';
    return '<a href="' + page + '?q=' + encodeURIComponent(label) + '" data-tip="' + BO.attr(tip) + '" title="' + BO.attr(tip) + '">' + BO.esc(label) + '</a>';
  }
  function poeList(items, page, max) {
    var arr = (items || []).filter(Boolean).slice(0, max || 999);
    return arr.map(function (x) { return poeLink(page, x); }).join(' · ');
  }
  function renderPoEIndex() {
    var N = window.BO_NAMES || {};
    var uniques = Object.keys(N.uniques || {}).map(function (k) { return N.uniques[k]; });
    var bases = Object.keys(N.bases || {}).map(function (k) { return N.bases[k]; });
    var skills = Object.keys(N.skills || {}).map(function (k) { return N.skills[k]; });
    var supports = Object.keys(N.supports || {}).map(function (k) { return N.supports[k]; });
    var runes = Object.keys(N.runes || {}).map(function (k) { return N.runes[k]; });
    var runewords = Object.keys(N.runewords || {}).map(function (k) { return N.runewords[k]; });
    var monsters = Object.keys(N.monsters || {}).map(function (k) { return [k, N.monsters[k]]; });
    var nodes = Object.keys(N.nodes || {}).map(function (k) { return [k, N.nodes[k]]; });
    POE_TIPS = {};
    function tip(label, text) { if (label && text) POE_TIPS[label] = label + ' · ' + text; }
    uniques.forEach(function (v) { tip(v[0], (v[1] || '') + ' · ' + (v[3] || '') + ' · 传奇'); });
    bases.forEach(function (v) { tip(v[0], (v[1] || '') + ' · ' + (v[2] || '') + ' · ilvl ' + (v[4] || '—')); });
    skills.forEach(function (v) { tip(v[0], (v[1] || '') + ' · ' + (v[2] || '') + ' · 技能宝石'); });
    supports.forEach(function (v) { tip(v[0], (v[1] || '') + ' · ' + (v[2] || '') + ' · 辅助宝石'); });
    Object.keys(N.runes || {}).forEach(function (k) { var v = N.runes[k]; tip(v[0], (v[1] || '') + ' · 等级 ' + (v[2] || '—') + ' · 符文'); });
    Object.keys(N.runewords || {}).forEach(function (k) { var v = N.runewords[k]; tip(v[0], (v[1] || '') + ' · ' + (v[2] || '') + ' · 符文之语'); });
    Object.keys(N.monsters || {}).forEach(function (k) { var v = N.monsters[k]; tip(v[0], (v[1] || '') + ' · 图鉴'); });
    Object.keys(N.nodes || {}).forEach(function (k) { var v = N.nodes[k]; tip(v[0], (v[1] || '') + ' · ' + (v[2] || '') + ' · 天赋'); });

    var gear = { weapon: [], armour: [], jewel: [], other: [] };
    uniques.forEach(function (v) {
      var slot = String(v[3] || '');
      if (/戒指|项链|护身符|箭袋/.test(slot)) gear.jewel.push(v[0]);
      else if (/剑|弓|斧|锤|矛|杖|匕首|爪|拳/.test(slot)) gear.weapon.push(v[0]);
      else if (/头盔|胸甲|手套|靴子|腰带|盾|斗篷/.test(slot)) gear.armour.push(v[0]);
      else gear.other.push(v[0]);
    });
    var baseGroups = {};
    bases.forEach(function (v) { var k = v[2] || '其他'; (baseGroups[k] = baseGroups[k] || []).push(v[0]); });
    var skillGroups = {};
    skills.forEach(function (v) { var k = v[2] || '其他'; (skillGroups[k] = skillGroups[k] || []).push(v[0]); });
    var guardians = monsters.filter(function (x) { return /^g_/.test(x[0]); }).map(function (x) { return x[1][0]; });
    var notables = nodes.filter(function (x) { return /Notable|Keystone/.test(String(x[1][2] || '')); }).map(function (x) { return x[1][0]; });

    var meta = N.meta || {}, counts = (meta.items && meta.items.counts) || {};
    var patch = (window.BO_API_SEED && BO_API_SEED.version && BO_API_SEED.version.patch) || '0.56.8';
    var covers = '<h2>版本索引</h2>' +
      '<p><b>' + BO.esc(patch) + '</b> · ' + (counts.bases || 465) + ' 底材 · ' + (counts.uniques || 182) + ' 传奇 · ' + (counts.affixes || 288) + ' 词缀 · ' + (counts.runes || 34) + ' 符文 · ' + (counts.runewords || 69) + ' 符文之语</p>' +
      '<p><b>Build ' + (meta.items && meta.items.build || 69) + '</b> · ' + (meta.skills || 78) + ' 技能 · ' + (meta.supports || 93) + ' 辅助 · ' + (meta.nodes || 1242) + ' 天赋节点 · ' + (meta.monsters || 382) + ' 怪物 · ' + (meta.guardians || 28) + ' 守护者</p>' +
      '<p><b>数据索引</b> · <a href="items.html">物品</a> · <a href="skills.html">技能</a> · <a href="bestiary.html">图鉴</a> · <a href="ladder.html">天梯</a> · <a href="meta.html">环境</a> · <a href="planner.html">模拟构筑</a></p>' +
      '<p><b>说明</b> · <a href="about.html#sources">数据来源</a> · <a href="about.html#api">API 文档</a> · <a href="about.html#disclaimer">免责声明</a> · <a href="https://api.playbrokenoath.com/" target="_blank" rel="noopener">Broken Oath public API</a></p>';
    var coversEl = el('poeCovers');
    if (coversEl) coversEl.innerHTML = covers;

    function section(title, rows) {
      return '<section class="poe-index-col poe-name-block"><h2>' + title + '</h2>' + rows.join('') + '</section>';
    }
    var left = section('物品', [
      '<p><b>传奇武器</b> ' + poeList(gear.weapon, 'items.html', 18) + '</p>',
      '<p><b>传奇护甲</b> ' + poeList(gear.armour, 'items.html', 18) + '</p>',
      '<p><b>传奇饰品</b> ' + poeList(gear.jewel, 'items.html', 18) + '</p>',
      '<p><b>底材</b> ' + Object.keys(baseGroups).slice(0, 6).map(function (k) { return '<span class="poe-sub">' + BO.esc(k) + '：</span>' + poeList(baseGroups[k], 'items.html', 7); }).join('<br>') + '</p>',
      '<p><b>神像</b> <a href="items.html#idols">全部神像</a> · <a href="planner.html#idols">模拟器神像页</a></p>',
      '<p class="poe-all"><a href="items.html">全部物品 →</a></p>'
    ]) + section('技能', [
      '<p><b>技能宝石</b> ' + Object.keys(skillGroups).map(function (k) { return '<span class="poe-sub">' + BO.esc(k) + '：</span>' + poeList(skillGroups[k], 'skills.html', 9); }).join('<br>') + '</p>',
      '<p><b>热门技能</b> <a href="skills.html?q=手里剑">手里剑</a> · <a href="skills.html?q=风暴火花">风暴火花</a> · <a href="skills.html?q=审判">审判</a> · <a href="skills.html?q=闪电箭">闪电箭</a> · <a href="skills.html?q=死亡缠绕">死亡缠绕</a> · <a href="skills.html?q=电弧">电弧</a></p>',
      '<p class="poe-all"><a href="skills.html">全部技能 →</a></p>'
    ]) + section('图鉴', [
      '<p><b>守护者</b> ' + poeList(guardians, 'bestiary.html') + '</p>',
      '<p><b>怪物</b> <a href="bestiary.html">全部怪物</a> · <a href="bestiary.html#guardians">守护者</a> · <a href="bestiary.html#mechanics">机制</a></p>',
      '<p class="poe-all"><a href="bestiary.html">全部图鉴 →</a></p>'
    ]);
    var right = section('辅助与符文', [
      '<p><b>辅助宝石</b> ' + poeList(supports, 'skills.html', 24) + '</p>',
      '<p><b>符文</b> ' + poeList(runes, 'items.html', 18) + '</p>',
      '<p><b>符文之语</b> ' + poeList(runewords, 'items.html', 18) + '</p>',
      '<p class="poe-all"><a href="items.html#runes">全部符文 →</a></p>'
    ]) + section('关键词', [
      '<p><a href="planner.html#tree">天赋</a> · <a href="planner.html#dragon">龙裔</a> · <a href="items.html#affixes">词缀</a> · <a href="skills.html#supports">辅助</a> · <a href="items.html#runes">符文</a> · <a href="bestiary.html">守护者</a> · <a href="planner.html#damage">DPS</a> · <a href="planner.html#defence">防御</a></p>',
      '<p><b>天赋节点</b> ' + poeList(notables, 'planner.html#tree', 18) + '</p>'
    ]) + section('机制与工具', [
      '<p><a href="planner.html">模拟构筑器</a> · <a href="meta.html">环境统计</a> · <a href="builds.html">构筑库</a> · <a href="ladder.html">天梯</a> · <a href="about.html">数据说明</a></p>',
      '<p><a href="planner.html#gear">装备</a> · <a href="planner.html#skills">技能</a> · <a href="planner.html#idols">神像</a> · <a href="planner.html#defence">防御</a> · <a href="planner.html#damage">伤害</a></p>'
    ]);
    var host = el('poeDirectory');
    if (host) { host.innerHTML = left + right; bindPoeTips(); }
  }
  function bindPoeTips() {
    var host = el('poeDirectory'); if (!host) return;
    var tip = document.getElementById('poeGlobalTip');
    if (!tip) {
      tip = document.createElement('div'); tip.id = 'poeGlobalTip'; tip.className = 'poe-tip'; document.body.appendChild(tip);
    }
    function show(a, e) {
      tip.textContent = a.getAttribute('data-tip') || '';
      tip.classList.add('on');
      move(e);
    }
    function move(e) {
      var x = (e.clientX || 0) + 14, y = (e.clientY || 0) + 14;
      var w = tip.offsetWidth || 260, h = tip.offsetHeight || 60;
      if (x + w > window.innerWidth - 8) x = (e.clientX || 0) - w - 14;
      if (y + h > window.innerHeight - 8) y = (e.clientY || 0) - h - 14;
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    }
    host.querySelectorAll('a[data-tip]').forEach(function (a) {
      a.addEventListener('mouseenter', function (e) { if (a.getAttribute('data-tip')) show(a, e); });
      a.addEventListener('mousemove', move);
      a.addEventListener('mouseleave', function () { tip.classList.remove('on'); });
    });
  }
  function renderPoEVersions(leagues, version) {
    var host = el('poeVersions'); if (!host) return;
    var N = window.BO_NAMES || {}, meta = N.meta || {}, counts = (meta.items && meta.items.counts) || {};
    var rows = (leagues && leagues.leagues) || [];
    var groups = [], by = {};
    rows.forEach(function (l) {
      var k = l.season || l.season_name || l.id;
      if (!by[k]) { by[k] = { name: BO.seasonName(l), rows: [] }; groups.push(by[k]); }
      by[k].rows.push(l);
    });
    if (!groups.length) groups = [{ name: 'Online Testing', rows: [] }];
    var patch = (version && version.patch) || (window.BO_API_SEED && BO_API_SEED.version && BO_API_SEED.version.patch) || '0.56.8';
    host.innerHTML = groups.map(function (g) {
      var row = g.rows[0] || {}, status = row.id ? BO.leagueStatus(row) : 'live';
      var dates = row.starts_at ? BO.fmtDate(row.starts_at) + ' → ' + BO.fmtDate(row.ends_at) : '—';
      var line = function (label, page, n, extra) {
        return '<p><b>' + label + '</b> ' + (n != null ? n + ' 项 · ' : '') + '<a href="' + page + '">查看全部</a>' + (extra ? ' · ' + extra : '') + '</p>';
      };
      return '<article class="poe-version"><div class="poe-version-head"><b>' + BO.esc(g.name) + ' · Patch ' + BO.esc(patch) + '</b><span>' + (row.trade ? 'SC/交易' : '赛季') + ' · ' + BO.esc(dates) + ' · ' + BO.esc(status === 'live' ? '进行中' : status === 'upcoming' ? '未开始' : '已结束') + '</span></div>' +
        '<div class="poe-version-body">' +
        line('物品', 'items.html', (counts.bases || 0) + (counts.uniques || 0) + (counts.affixes || 0) + (counts.runes || 0) + (counts.runewords || 0), (counts.bases || 0) + ' 底材 · ' + (counts.uniques || 0) + ' 传奇 · ' + (counts.affixes || 0) + ' 词缀 · ' + (counts.runes || 0) + ' 符文 · ' + (counts.runewords || 0) + ' 符文之语') +
        line('技能', 'skills.html', (meta.skills || 0) + (meta.supports || 0), (meta.skills || 0) + ' 技能 · ' + (meta.supports || 0) + ' 辅助 · ' + (meta.nodes || 0) + ' 天赋 · ' + Object.keys(N.dragon || {}).length + ' 龙裔') +
        line('图鉴', 'bestiary.html', (meta.monsters || 0) + (meta.guardians || 0), (meta.monsters || 0) + ' 怪物 · ' + (meta.guardians || 0) + ' 守护者 · 怪物词缀 · 机制') +
        line('模拟', 'planner.html', null, '装备 · 词缀 · 神像 · 天赋 · 龙裔 · DPS · 防御') +
        '</div></article>';
    }).join('');
  }
  function renderDbCounts() {
    var meta = (window.BO_NAMES && window.BO_NAMES.meta) || {};
    var counts = (meta.items && meta.items.counts) || {};
    var cards = document.querySelectorAll('#dbCards .db-card');
    var nums = [
      (counts.uniques || 0) + ' 传奇 · ' + (counts.bases || 0) + ' 底材',
      (meta.skills || 0) + ' 技能 · ' + (meta.supports || 0) + ' 辅助',
      (meta.monsters || 0) + ' 怪物 · ' + (meta.guardians || 0) + ' 守护者',
      'DPS'
    ];
    Array.prototype.forEach.call(cards, function (c, i) { var n = c.querySelector('.db-n'); if (n) n.textContent = nums[i]; });
  }

  BO.init('index.html', function () {
    renderPoEIndex();
    var ps = el('poeIconSearch');
    if (ps) ps.addEventListener('click', function () { var b = document.getElementById('boSearchBtn'); if (b) b.click(); });
    var s = el('heroSearch');
    if (s) s.addEventListener('click', function () {
      var b = document.getElementById('boSearchBtn');
      if (b) b.click();
    });

    BO.api.manifest().then(function (m) {
      if (m && m.synced_at) {
        if (el('heroSynced')) el('heroSynced').textContent = '同步于 ' + BO.ago(m.synced_at);
        if (el('poeSyncText')) el('poeSyncText').textContent = '数据同步于 ' + BO.ago(m.synced_at) + ' · Patch ' + (m.patch || '—');
      }
    }).catch(function () {});

    Promise.all([BO.api.version(), BO.api.leagues()]).then(function (res) {
      var version = res[0] || {};
      var leagues = res[1] || { leagues: [] };
      var current = (window.BO_API_SEED && BO_API_SEED.current) || BO.currentLeague(leagues);
      var currentRow = (leagues.leagues || []).find(function (l) { return l.id === current; }) || null;
      renderLeagues(leagues, current);
      renderDbCounts();

      Promise.all([
        BO.api.ladder(current).catch(function (e) { return { heroes: [], count: 0, error: e }; }),
        BO.api.meta(current).catch(function () { return null; })
      ]).then(function (r) {
        var ladder = r[0], meta = r[1];
        renderLive(version, leagues, currentRow, ladder, meta);
        renderStats(version, leagues, ladder, meta);
        renderLadder(leagues, current, ladder);
        donut(meta);
        skillBars(meta);
        renderBuilds(current, ladder);
        renderPoEVersions(leagues, version);
        var note = el('dataNoteText');
        if (note && leagues) {
          var pub = meta ? ((meta.sample && meta.sample.heroes) || meta.heroes || 0) : 0;
          note.innerHTML = '当前联赛 <b style="color:var(--gold)">' + BO.esc(BO.seasonName(currentRow)) + '</b>：' + (ladder.count || 0) + ' 位天梯英雄、' +
            pub + ' 份官方构筑。天梯每 15 分钟、构筑与统计每小时由本站从 <a href="https://api.playbrokenoath.com/" target="_blank" rel="noopener">Broken Oath public API</a> 同步并缓存；读者直接读取本站副本，不会让每位访客回源。数据声明：<b style="color:var(--gold)">Data: Broken Oath public API</b>。';
        }
      });
    }).catch(function (e) {
      el('liveCard').innerHTML = BO.errorBox(e.message);
      el('leagueRail').innerHTML = BO.empty('无法读取联赛', '请检查网络后刷新；本站已内置一份同步快照。');
      el('topLadder').innerHTML = BO.empty('无法读取天梯', 'API 数据暂不可用。');
    });
  });
})();
