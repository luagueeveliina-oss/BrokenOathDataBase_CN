/* Build library — browse published builds by league and class. */
(function () {
  'use strict';
  var BO = window.BO;
  var S = { league: null, cls: 'all', q: '', sort: 'rank', page: 1, per: 24 };
  var leagues = null, rows = [], loadingToken = 0;

  function $(id) { return document.getElementById(id); }

  function fillLeagues() {
    $('leagueSel').innerHTML = BO.leagueOptions(leagues, S.league);
  }

  function tabs() {
    var host = $('classTabs');
    var counts = { all: rows.length };
    rows.forEach(function (r) { counts[r.class] = (counts[r.class] || 0) + 1; });
    var list = [['all', '全部', counts.all]].concat(BO.CLASS_LIST.map(function (c) { return [c, BO.classZh(c), counts[c] || 0]; }));
    host.innerHTML = list.map(function (x) {
      return '<button class="class-tab ' + (S.cls === x[0] ? 'on' : '') + '" data-c="' + x[0] + '"' +
        (x[0] !== 'all' ? ' style="--cls:' + BO.classColor(x[0]) + '"' : '') + '>' + BO.esc(x[1]) + ' <b>' + x[2] + '</b></button>';
    }).join('');
    host.onclick = function (e) {
      var b = e.target.closest('.class-tab');
      if (!b) return;
      S.cls = b.dataset.c;
      S.page = 1;
      try { history.replaceState(null, '', 'builds.html?league=' + encodeURIComponent(S.league) + (S.cls === 'all' ? '' : '&class=' + encodeURIComponent(S.cls))); } catch (x) {}
      tabs();
      render();
    };
  }

  function hay(r) {
    var s = [r.class, BO.classZh(r.class), r.ascendancy, BO.aspectZh(r.ascendancy), r.main_skill, BO.skillNm(r.main_skill)];
    (r.main_supports || []).forEach(function (x) { s.push(x, BO.supNm(x)); });
    return s.join(' ').toLowerCase();
  }

  function filtered() {
    var list = rows.slice();
    if (S.cls !== 'all') list = list.filter(function (r) { return r.class === S.cls; });
    if (S.q) {
      var terms = S.q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(function (r) {
        var h = hay(r);
        return terms.every(function (t) { return h.indexOf(t) >= 0; });
      });
    }
    if (S.sort === 'dps') list.sort(function (a, b) { return (b.guardian_dps_median || 0) - (a.guardian_dps_median || 0); });
    else if (S.sort === 'level') list.sort(function (a, b) { return b.level - a.level || (a.rank || 0) - (b.rank || 0); });
    else if (S.sort === 'rl') list.sort(function (a, b) { return (b.rupture_level || 0) - (a.rupture_level || 0); });
    else list.sort(function (a, b) { return (a.rank || 0) - (b.rank || 0); });
    return list;
  }

  function render() {
    var list = filtered();
    var pages = Math.max(1, Math.ceil(list.length / S.per));
    if (S.page > pages) S.page = pages;
    var slice = list.slice((S.page - 1) * S.per, S.page * S.per);
    $('resultCount').innerHTML = '<b style="color:var(--fg)">' + list.length + '</b> 份构筑' + (S.q ? ' · “' + BO.esc(S.q) + '”' : '');
    $('buildCount').textContent = (S.cls === 'all' ? '全部职业' : BO.classZh(S.cls)) + ' · ' + list.length + ' 份';

    if (!rows.length) {
      $('buildsBody').innerHTML = BO.empty('这个联赛还没有公开构筑', '构筑每小时发布一次；刚开赛的联赛需要等玩家上榜并公开构筑。');
      $('buildsPager').innerHTML = '';
      return;
    }
    if (!slice.length) {
      $('buildsBody').innerHTML = BO.empty('没有匹配的构筑', '换一个关键词或职业试试。');
      $('buildsPager').innerHTML = '';
      return;
    }
    $('buildsBody').innerHTML = '<div class="build-grid three">' +
      slice.map(function (r) { return BO.buildCard(r, S.league, { cls: r.class }); }).join('') + '</div>';
    var pager = BO.pager(S.page, pages, function (p) {
      S.page = p;
      render();
      window.scrollTo({ top: 260, behavior: 'smooth' });
    });
    var host = $('buildsPager');
    host.innerHTML = '';
    if (pager) host.appendChild(pager);
  }

  function load() {
    var token = ++loadingToken;
    S.page = 1;
    $('buildsBody').innerHTML = '<div class="loading"><span class="spinner"></span>正在载入构筑…</div>';
    $('buildsPager').innerHTML = '';
    if (!S.league) return;
    var classes = BO.CLASS_LIST;
    Promise.all(classes.map(function (c) {
      return BO.api.list(S.league, c).then(function (l) {
        return (l && l.heroes ? l.heroes : []).map(function (h) {
          var row = Object.assign({}, h);
          row.class = row.class || c;
          return row;
        });
      }).catch(function () { return []; });
    })).then(function (groups) {
      if (token !== loadingToken) return;
      rows = [];
      groups.forEach(function (g) { rows = rows.concat(g); });
      $('buildSync').textContent = '同步快照';
      $('buildSync').className = 'tag gold';
      tabs();
      render();
    }).catch(function (e) {
      if (token !== loadingToken) return;
      $('buildsBody').innerHTML = BO.errorBox(e.message);
    });
  }

  BO.init('builds.html', function () {
    BO.api.manifest().then(function (m) {
      if (m && m.synced_at) $('buildSync').title = '本站快照同步于 ' + BO.fmtDate(m.synced_at, true) + '；点击构筑可读取完整数据';
    }).catch(function () {});

    Promise.all([BO.api.version(), BO.api.leagues()]).then(function (res) {
      leagues = res[1];
      var wanted = BO.qs('league');
      var valid = (leagues.leagues || []).some(function (l) { return l.id === wanted; });
      S.league = valid ? wanted : ((window.BO_API_SEED && BO_API_SEED.current) || BO.currentLeague(leagues));
      var cls = BO.qs('class');
      if (cls && (cls === 'all' || BO.CLASS_LIST.indexOf(cls) >= 0)) S.cls = cls;
      fillLeagues();
      load();

      $('leagueSel').addEventListener('change', function (e) {
        S.league = e.target.value;
        S.cls = 'all';
        try { history.replaceState(null, '', 'builds.html?league=' + encodeURIComponent(S.league)); } catch (x) {}
        fillLeagues();
        load();
      });
      $('q').addEventListener('input', BO.debounce(function (e) {
        S.q = e.target.value.trim(); S.page = 1; render();
      }, 120));
      $('sortSel').addEventListener('change', function (e) { S.sort = e.target.value; S.page = 1; render(); });
      document.addEventListener('keydown', function (e) {
        if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('q').focus(); }
      });
    }).catch(function (e) {
      $('buildsBody').innerHTML = BO.errorBox(e.message);
    });
  });
})();
