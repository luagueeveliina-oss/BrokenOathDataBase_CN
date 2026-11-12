/* Meta report — class, aspect, skill, support, keystone and unique shares. */
(function () {
  'use strict';
  var BO = window.BO;
  var S = { league: null };
  var leagues = null, token = 0;

  function $(id) { return document.getElementById(id); }

  function donut(classes) {
    if (!classes || !classes.length) return '<div class="small muted">暂无职业数据。</div>';
    var rows = classes.slice().sort(function (a, b) { return b.share - a.share; });
    var colors = { Warrior: '#c46a4a', Mage: '#6f9ed6', Ranger: '#7fbf6a', Samurai: '#d9a441', Paladin: '#e3d3a1', Necromancer: '#a98bd6' };
    var total = rows.reduce(function (s, r) { return s + r.share; }, 0) || 1;
    var acc = 0;
    var stops = rows.map(function (r) {
      var from = acc / total * 100; acc += r.share;
      return colors[r.id] + ' ' + from.toFixed(2) + '% ' + (acc / total * 100).toFixed(2) + '%';
    }).join(', ');
    return '<div class="donut-wrap"><div class="donut" style="background:conic-gradient(' + stops + ')"><div class="donut-c"><b>' + rows.reduce(function (s, r) { return s + r.heroes; }, 0) + '</b><span>英雄</span></div></div>' +
      '<div class="donut-legend">' + rows.map(function (r) {
        return '<div class="dl-row"><span class="dot" style="background:' + colors[r.id] + '"></span>' + BO.esc(BO.classZh(r.id)) + '<b>' + r.share + '%</b></div>';
      }).join('') + '</div></div>';
  }

  function barRows(rows, labelFn, valueFn, colorFn) {
    if (!rows.length) return '<div class="small muted">暂无数据。</div>';
    var max = Math.max.apply(null, rows.map(valueFn)) || 1;
    return '<div class="bars">' + rows.map(function (r) {
      var v = valueFn(r), label = labelFn(r);
      return '<div class="bar-row"><div class="bar-label">' +
        (colorFn ? '<span class="dot" style="background:' + colorFn(r) + '"></span>' : '') +
        '<span title="' + BO.attr(label) + '">' + BO.esc(label) + '</span></div>' +
        '<div class="bar-track"><i class="bar-fill" style="width:' + Math.max(2, v / max * 100) + '%' + (colorFn ? ';background:' + colorFn(r) : '') + '"></i></div>' +
        '<div class="bar-value">' + (v >= 100 ? Math.round(v) : v.toFixed ? v.toFixed(1) : v) + '%</div></div>';
    }).join('') + '</div>';
  }

  function aspectLabel(id) {
    var parts = String(id || '').split('/');
    var cls = parts[0], asp = parts[1] || 'None';
    return BO.classZh(cls) + ' · ' + (asp === 'None' ? '未选龙相' : BO.aspectZh(asp));
  }

  function skillLabel(id) {
    var key = String(id || '').toLowerCase();
    var p = BO.namePair('skills', key);
    return p ? (BO.LANG ? p[1] : p[0]) : (key === 'hidden' ? '未公开' : BO.pretty(id));
  }

  function nodeLabel(id) {
    var p = BO.namePair('nodes', id);
    return p ? (BO.LANG ? p[1] : p[0]) : BO.pretty(id);
  }
  function nodeKind(id) {
    var p = BO.namePair('nodes', id);
    return p ? (p[2] || '') : '';
  }

  function mainSkillTable(rows) {
    if (!rows || !rows.length) return '<div class="small muted">暂无主技能数据。</div>';
    var max = Math.max.apply(null, rows.map(function (r) { return r.share; })) || 1;
    return '<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl">' +
      '<thead><tr><th>主技能</th><th>职业</th><th class="num">使用</th><th>占比</th><th class="num">最佳 RL</th><th class="num">中位 RL</th></tr></thead><tbody>' +
      rows.slice(0, 14).map(function (r) {
        var key = String(r.skill || '').toLowerCase();
        var local = BO.hasLocal('skills', key);
        var icon = (window.BO_ICONS || {})['sk:' + key] ? BO.icon('sk:' + key, 'spark', '#1ba29b', 24, 26) : BO.icon('', 'spark', '#1ba29b', 24, 26);
        return '<tr><td class="name"><div class="row" style="gap:7px">' + icon +
          (local ? '<a href="skills.html#skills/' + encodeURIComponent(key) + '">' + BO.esc(skillLabel(key)) + '</a>' : '<span>' + BO.esc(skillLabel(key)) + '</span>') +
          '</div></td><td>' + BO.classChip(r.class) + '</td><td class="num">' + r.heroes + '</td>' +
          '<td class="bar-cell"><div class="mini-bar"><i style="width:' + Math.max(2, r.share / max * 100) + '%"></i></div><span class="tiny mute">' + r.share + '%</span></td>' +
          '<td class="num">' + (r.best_rupture_level == null ? '—' : r.best_rupture_level) + '</td>' +
          '<td class="num">' + (r.median_rupture_level == null ? '—' : r.median_rupture_level) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function uniqueList(rows) {
    if (!rows || !rows.length) return '<div class="small muted">暂无传奇使用数据。</div>';
    return '<div class="meta-list">' + rows.slice(0, 20).map(function (r) {
      var key = String(r.id || '').toLowerCase();
      var p = BO.namePair('uniques', key);
      var name = p ? (BO.LANG ? p[1] : p[0]) : (key === 'hidden' ? '未公开' : BO.pretty(r.id));
      var icon = (window.BO_ICONS || {})['u:' + key] ? BO.icon('u:' + key, 'sword', '#af6025', 24, 28) : BO.icon('', 'sword', '#af6025', 24, 28);
      return '<div class="meta-item">' + icon + '<div class="mi-txt"><b>' + BO.esc(name) + '</b><span>' + (p && p[2] ? BO.esc(p[2]) : '传奇') + '</span></div><em>' + r.share + '%</em></div>';
    }).join('') + '</div>';
  }

  function nodeList(rows) {
    if (!rows || !rows.length) return '<div class="small muted">暂无数据。</div>';
    return '<div class="meta-list">' + rows.slice(0, 24).map(function (r) {
      return '<div class="meta-item"><div class="mi-txt"><b>' + BO.esc(nodeLabel(r.id)) + '</b><span>' + BO.esc(nodeKind(r.id) || '天赋') + '</span></div><em>' + r.share + '%</em></div>';
    }).join('') + '</div>';
  }

  function histogram(bands) {
    var keys = Object.keys(bands || {}).map(Number).filter(function (n) { return isFinite(n); }).sort(function (a, b) { return a - b; });
    if (!keys.length) return '<div class="small muted">暂无裂隙分布数据。</div>';
    var max = Math.max.apply(null, keys.map(function (k) { return bands[k]; })) || 1;
    var total = keys.reduce(function (s, k) { return s + bands[k]; }, 0);
    return '<div class="hist">' + keys.map(function (k) {
      var v = bands[k];
      return '<div class="hcol" title="' + k + '–' + (k + 24) + ': ' + v + ' 人 (' + (v / total * 100).toFixed(0) + '%)"><div class="hlbl">' + v + '</div>' +
        '<div class="hbar" style="height:' + Math.max(2, v / max * 100) + '%"></div><div class="hlbl">' + k + '</div></div>';
    }).join('') + '</div>';
  }

  function render(m, league) {
    if (!m.heroes) {
      $('metaBody').innerHTML = BO.empty('这个联赛还没有环境数据', '需要至少一位英雄进入天梯并公开构筑，统计才会生成。');
      return;
    }
    var sample = (m.sample && m.sample.heroes) || m.sample_heroes || 0;
    var supportAgg = {};
    (m.supports || []).forEach(function (r) {
      var k = String(r.support || '').toLowerCase();
      supportAgg[k] = (supportAgg[k] || 0) + (r.heroes || 0);
    });
    var supports = Object.keys(supportAgg).map(function (k) { return { id: k, heroes: supportAgg[k] }; });
    supports.sort(function (a, b) { return b.heroes - a.heroes; });
    var supRows = supports.slice(0, 10).map(function (r) {
      var p = BO.namePair('supports', r.id);
      return {
        label: p ? (BO.LANG ? p[1] : p[0]) : BO.pretty(r.id),
        value: sample ? r.heroes / sample * 100 : 0
      };
    });

    var climb = (m.ascendancies || []).slice(0, 10).map(function (r) {
      return { id: r.id, heroes: r.heroes, share: r.share, color: BO.aspectColor(String(r.id).split('/')[1]) };
    });

    var topClasses = (m.classes || []).slice().sort(function (a, b) { return b.share - a.share; });

    $('metaBody').innerHTML =
      '<section class="statgrid" style="grid-template-columns:repeat(4,1fr)">' +
      '<div class="stat"><b>' + BO.num(m.heroes) + '</b><span>活跃英雄</span><small>最近 ' + m.window_days + ' 天</small></div>' +
      '<div class="stat gold"><b>' + BO.num(sample) + '</b><span>分析构筑</span><small>已发布构筑 · 每职业前 50</small></div>' +
      '<div class="stat"><b>' + topClasses.length + '</b><span>职业</span><small>' + ((m.ascendancies || []).length) + ' 种龙相组合</small></div>' +
      '<div class="stat"><b>' + ((m.uniques || []).length) + '</b><span>传奇物品</span><small>7 天环境统计</small></div>' +
      '</section>' +

      '<section class="sec"><div class="meta-grid">' +
      '<div class="panel"><div class="panel-hd"><span class="panel-title">职业占比</span><span class="panel-sub">按活跃英雄</span></div><div class="panel-bd">' + donut(m.classes) + '</div></div>' +
      '<div class="panel"><div class="panel-hd"><span class="panel-title">主技能</span><span class="panel-sub">Top 14 · 占比与裂隙</span></div><div class="panel-bd flush">' + mainSkillTable(m.main_skills) + '</div></div>' +
      '</div></section>' +

      '<section class="sec"><div class="grid-2">' +
      '<div class="panel"><div class="panel-hd"><span class="panel-title">常用辅助</span><span class="panel-sub">按出现次数</span></div><div class="panel-bd">' + barRows(supRows, function (r) { return r.label; }, function (r) { return r.value; }) + '</div></div>' +
      '<div class="panel"><div class="panel-hd"><span class="panel-title">龙相组合</span><span class="panel-sub">职业 / 龙相</span></div><div class="panel-bd">' +
      barRows(climb, function (r) { return aspectLabel(r.id); }, function (r) { return r.share; }, function (r) { return r.color; }) + '</div></div>' +
      '</div></section>' +

      '<section class="sec"><div class="grid-2">' +
      '<div class="panel"><div class="panel-hd"><span class="panel-title">基石天赋</span><span class="panel-sub">Top 24</span></div><div class="panel-bd">' + nodeList(m.keystones) + '</div></div>' +
      '<div class="panel"><div class="panel-hd"><span class="panel-title">显著天赋</span><span class="panel-sub">Top 24</span></div><div class="panel-bd">' + nodeList(m.notables) + '</div></div>' +
      '</div></section>' +

      '<section class="sec"><div class="panel"><div class="panel-hd"><span class="panel-title">传奇物品使用率</span><span class="panel-sub">Top 20 · 构筑占比</span></div><div class="panel-bd">' + uniqueList(m.uniques) + '</div></div></section>' +

      '<section class="sec"><div class="panel"><div class="panel-hd"><span class="panel-title">裂隙等级分布</span><span class="panel-sub">活跃英雄 · 25 级一档</span></div><div class="panel-bd">' + histogram(m.rupture_level_bands) + '</div></div></section>' +

      '<section class="sec"><div class="panel"><div class="panel-bd"><div class="spread"><div><div class="sec-kicker">Sample</div><div class="panel-title">统计口径</div>' +
      '<p class="small muted" style="margin:6px 0 0;max-width:900px">已发布构筑（每职业前 50） · 样本 ' + sample + ' 份构筑、' + m.heroes + ' 位活跃英雄。职业/技能/裂隙统计最近 ' + m.window_days + ' 天的活跃英雄；基石、显著与传奇统计已公开的前 50 份构筑。生成于 ' + BO.esc(BO.fmtDate(m.generated_at, true)) + '。</p></div>' +
      '<a class="btn btn-sm" href="builds.html?league=' + encodeURIComponent(league) + '">看构筑</a></div></div></div></section>';
  }

  function load(id) {
    var t = ++token;
    S.league = id;
    $('metaBody').innerHTML = BO.loading('正在载入环境统计…');
    BO.api.meta(id).then(function (m) {
      if (t !== token) return;
      $('metaWindow').textContent = '窗口 ' + m.window_days + ' 天 · 生成于 ' + BO.fmtDate(m.generated_at, true);
      $('metaSync').textContent = '同步快照';
      render(m, id);
    }).catch(function (e) {
      if (t !== token) return;
      $('metaBody').innerHTML = BO.errorBox(e.message);
    });
  }

  BO.init('meta.html', function () {
    BO.api.manifest().then(function (m) {
      if (m && m.synced_at) $('metaSync').title = '本站快照同步于 ' + BO.fmtDate(m.synced_at, true);
    }).catch(function () {});
    Promise.all([BO.api.version(), BO.api.leagues()]).then(function (res) {
      leagues = res[1];
      var wanted = BO.qs('league');
      var valid = (leagues.leagues || []).some(function (l) { return l.id === wanted; });
      S.league = valid ? wanted : ((window.BO_API_SEED && BO_API_SEED.current) || BO.currentLeague(leagues));
      $('leagueSel').innerHTML = BO.leagueOptions(leagues, S.league);
      load(S.league);
      $('leagueSel').addEventListener('change', function (e) {
        try { history.replaceState(null, '', 'meta.html?league=' + encodeURIComponent(e.target.value)); } catch (x) {}
        load(e.target.value);
      });
    }).catch(function (e) {
      $('metaBody').innerHTML = BO.errorBox(e.message);
    });
  });
})();
