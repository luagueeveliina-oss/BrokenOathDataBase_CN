/* Home page — live league, ladder, meta and database overview. */
(function () {
  'use strict';
  var BO = window.BO;

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
    var shown = groups.slice(0, 8);
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
    var s = el('heroSearch');
    if (s) s.addEventListener('click', function () {
      var b = document.getElementById('boSearchBtn');
      if (b) b.click();
    });

    BO.api.manifest().then(function (m) {
      if (m && m.synced_at) el('heroSynced').textContent = '同步于 ' + BO.ago(m.synced_at);
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
