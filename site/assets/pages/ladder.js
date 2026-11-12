/* Ladder browser — league selector, class tabs, filters and build entry. */
(function () {
  'use strict';
  var BO = window.BO;
  var S = { league: null, cls: 'all', q: '', sort: 'rank', onlyBuild: false, page: 1, per: 50 };
  var ladder = null, leagues = null, version = null;

  function $(id) { return document.getElementById(id); }

  function statusText(l) {
    if (!l) return '';
    var s = BO.leagueStatus(l);
    return s === 'live' ? '进行中' : s === 'upcoming' ? '即将开始' : '已结束';
  }

  function fillLeagues() {
    var sel = $('leagueSel');
    sel.innerHTML = BO.leagueOptions(leagues, S.league);
    var row = (leagues.leagues || []).find(function (l) { return l.id === S.league; });
    if (row) {
      $('leagueRange').textContent = BO.leagueShort(row) + ' · ' + BO.fmtDate(row.starts_at) + ' → ' + BO.fmtDate(row.ends_at);
    }
  }

  function classCounts() {
    var counts = { all: (ladder.heroes || []).length };
    (ladder.heroes || []).forEach(function (h) { counts[h.class] = (counts[h.class] || 0) + 1; });
    return counts;
  }

  function renderClassTabs() {
    var host = $('classTabs');
    var counts = classCounts();
    var items = [['all', '全部', counts.all]].concat(BO.CLASS_LIST.map(function (c) {
      return [c, BO.classZh(c), counts[c] || 0];
    }));
    host.innerHTML = items.map(function (it) {
      return '<button class="class-tab ' + (S.cls === it[0] ? 'on' : '') + '" data-c="' + it[0] + '"' +
        (it[0] !== 'all' ? ' style="--cls:' + BO.classColor(it[0]) + '"' : '') + '>' +
        BO.esc(it[1]) + ' <b>' + it[2] + '</b></button>';
    }).join('');
    host.onclick = function (e) {
      var b = e.target.closest('.class-tab');
      if (!b) return;
      S.cls = b.dataset.c;
      S.page = 1;
      renderClassTabs();
      render();
    };
  }

  function haystack(h) {
    var s = [h.class, BO.classZh(h.class), h.ascendancy, BO.aspectZh(h.ascendancy), h.main_skill, BO.skillNm(h.main_skill)];
    (h.main_supports || []).forEach(function (x) { s.push(x, BO.supNm(x)); });
    return s.join(' ').toLowerCase();
  }

  function filtered() {
    var rows = (ladder.heroes || []).slice();
    if (S.cls !== 'all') rows = rows.filter(function (h) { return h.class === S.cls; });
    if (S.onlyBuild) rows = rows.filter(function (h) { return h.has_build; });
    if (S.q) {
      var terms = S.q.toLowerCase().split(/\s+/).filter(Boolean);
      rows = rows.filter(function (h) {
        var hay = haystack(h);
        return terms.every(function (t) { return hay.indexOf(t) >= 0; });
      });
    }
    if (S.sort === 'level') rows.sort(function (a, b) { return b.level - a.level || a.rank - b.rank; });
    else if (S.sort === 'rl') rows.sort(function (a, b) { return (b.rupture_level || 0) - (a.rupture_level || 0) || a.rank - b.rank; });
    else if (S.sort === 'dps') rows.sort(function (a, b) { return (b.guardian_dps_median || 0) - (a.guardian_dps_median || 0) || a.rank - b.rank; });
    else rows.sort(function (a, b) { return a.rank - b.rank; });
    return rows;
  }

  function rowHtml(h) {
    var skillId = String(h.main_skill || '').toLowerCase();
    var isHidden = !skillId || skillId === 'hidden';
    var skillPair = isHidden ? null : BO.namePair('skills', skillId);
    var skill = skillPair ? (BO.LANG ? skillPair[1] : skillPair[0]) : (isHidden ? '未公开' : BO.pretty(h.main_skill));
    var supports = (h.main_supports || []).filter(function (x) { return x && x !== 'hidden'; }).map(function (id) {
      var key = String(id).toLowerCase();
      var src = (window.BO_ICONS || {})['sp:' + key];
      var icon = src ? '<img src="' + BO.attr(src) + '" alt="">' : '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:none;stroke:#8fb0e8;stroke-width:1.7"><path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1.7 1.7"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1.7-1.7"/></svg>';
      return '<span class="ico ico-img sup-ico" style="--ico:#8fb0e8;width:20px;height:22px" title="' + BO.attr(BO.supNm(key)) + '">' + icon + '</span>';
    }).join('');
    var rankLabel = S.cls === 'all' ? h.rank : (h.class_rank || h.rank);
    var subRank = S.cls === 'all' ? '' : '<div class="sub">总 #' + h.rank + '</div>';
    return '<tr class="' + (h.has_build ? 'clickable' : '') + '"' + (h.has_build ? ' data-href="' + BO.attr(BO.heroUrl(S.league, h.class, h.hero)) + '"' : '') + '>' +
      '<td class="rank ' + (h.rank <= 3 ? 'top' : '') + '">' + rankLabel + subRank + '</td>' +
      '<td class="name">' + BO.classChip(h.class) + (h.dead ? ' <span class="tag red">阵亡</span>' : '') + '</td>' +
      '<td class="hide-sm">' + BO.aspectChip(h.ascendancy) + '</td>' +      '<td class="num">' + h.level + '</td>' +
      '<td class="num">' + (h.rupture_level == null ? '—' : h.rupture_level) + '</td>' +
      '<td class="name">' + (skillPair && BO.hasLocal('skills', skillId) ? '<a href="skills.html#skills/' + encodeURIComponent(skillId) + '">' + BO.esc(skill) + '</a>' : '<span' + (isHidden ? ' class="tag"' : '') + '>' + BO.esc(skill) + '</span>') + '</td>' +
      '<td class="hide-sm"><div class="row" style="gap:2px">' + (supports || '<span class="muted tiny">—</span>') + '</div></td>' +
      '<td class="num"><span class="dps">' + (h.guardian_dps_median ? BO.big(h.guardian_dps_median) : '—') + '</span></td>' +
      '<td class="hide-sm">' + (h.dead ? '<span class="tag red">已阵亡</span>' : '<span class="tag green">存活</span>') + '</td>' +
      '<td class="actions">' + (h.has_build ? '<a class="btn btn-sm" href="' + BO.heroUrl(S.league, h.class, h.hero) + '">构筑</a>' : '<span class="tag">无</span>') + '</td>' +
      '</tr>';
  }

  function render() {
    if (!ladder) return;
    var rows = filtered();
    var pages = Math.max(1, Math.ceil(rows.length / S.per));
    if (S.page > pages) S.page = pages;
    var slice = rows.slice((S.page - 1) * S.per, S.page * S.per);
    $('resultCount').innerHTML = '<b style="color:var(--fg)">' + rows.length + '</b> 位英雄 · ' +
      (S.cls === 'all' ? '全部职业' : BO.classZh(S.cls)) + (S.q ? ' · “' + BO.esc(S.q) + '”' : '');

    var rowInfo = (leagues.leagues || []).find(function (l) { return l.id === S.league; });
    var heroCount = (ladder.heroes || []).length;
    if (!heroCount) {
      var st = rowInfo ? BO.leagueStatus(rowInfo) : 'live';
      var msg = st === 'upcoming' ? '联赛还没开始' : st === 'ended' ? '联赛已经结束' : '天梯还没有数据';
      var sub = st === 'upcoming' ? '开始时间 ' + BO.fmtDate(rowInfo.starts_at, true) + '，开赛后几小时内会陆续有人上榜。'
        : st === 'ended' ? '结束时间 ' + BO.fmtDate(rowInfo.ends_at, true) + '，历史榜单仍保留在公开 API 中。'
          : '新联赛开启后需要几小时才会有人上榜。';
      $('ladderBody').innerHTML = BO.empty(msg, sub);
      $('ladderPager').innerHTML = '';
      return;
    }
    if (!slice.length) {
      $('ladderBody').innerHTML = BO.empty('没有匹配的英雄', '换一个职业或关键词，或取消「只看有构筑」。');
      $('ladderPager').innerHTML = '';
      return;
    }
    $('ladderBody').innerHTML = '<div class="tbl-wrap"><table class="tbl"><thead><tr>' +
      '<th>#</th><th>职业</th><th class="hide-sm">龙相</th><th class="num">等级</th><th class="num">裂隙</th><th>主技能</th><th class="hide-sm">辅助</th>' +
      '<th class="num">守护者 DPS</th><th class="hide-sm">状态</th><th></th></tr></thead><tbody>' +
      slice.map(rowHtml).join('') + '</tbody></table></div>' +
      '<p class="note mt8">守护者 DPS 来自公开 API 的 <code>guardian_dps_median</code>：游戏自身在最近统计窗口内记录的守护者战斗中位 DPS，不是本站模拟器计算的面板数字。</p>';

    Array.prototype.forEach.call(document.querySelectorAll('#ladderBody tr[data-href]'), function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('a, button')) return;
        location.href = tr.dataset.href;
      });
    });

    var pager = BO.pager(S.page, pages, function (p) {
      S.page = p;
      render();
      window.scrollTo({ top: 260, behavior: 'smooth' });
    });
    var host = $('ladderPager');
    host.innerHTML = '';
    if (pager) host.appendChild(pager);
  }

  function load(id, opts) {
    opts = opts || {};
    S.league = id;
    S.page = 1;
    if (!opts.keep) $('ladderBody').innerHTML = BO.loading('正在载入 ' + BO.seasonName((leagues.leagues || []).find(function (l) { return l.id === id; }) || { name: id }) + '…');
    $('ladderPager').innerHTML = '';
    BO.api.ladder(id).then(function (data) {
      ladder = data;
      if (!ladder.heroes) ladder.heroes = [];
      var row = (leagues.leagues || []).find(function (l) { return l.id === id; });
      $('leagueUpdated').textContent = 'API ' + BO.ago(ladder.generated_at) + ' · ' + BO.num(ladder.count) + ' 人';
      $('syncTag').textContent = opts.live ? '实时数据' : '同步快照';
      $('syncTag').className = 'tag ' + (opts.live ? 'green' : 'gold');
      renderClassTabs();
      render();
      if (row) fillLeagues();
    }).catch(function (e) {
      $('ladderBody').innerHTML = BO.errorBox('联赛 ' + id + ' 读取失败：' + e.message);
      var retry = $('ladderBody').querySelector('button');
      if (retry) retry.onclick = function () { load(id, opts); };
    });
  }

  BO.init('ladder.html', function () {
    BO.api.manifest().then(function (m) {
      if (m && m.synced_at) $('syncTag').title = '本站快照同步于 ' + BO.fmtDate(m.synced_at, true);
    }).catch(function () {});

    Promise.all([BO.api.version(), BO.api.leagues()]).then(function (res) {
      version = res[0];
      leagues = res[1];
      var wanted = BO.qs('league');
      var valid = (leagues.leagues || []).some(function (l) { return l.id === wanted; });
      S.league = valid ? wanted : ((window.BO_API_SEED && BO_API_SEED.current) || BO.currentLeague(leagues));
      fillLeagues();
      load(S.league);

      $('leagueSel').addEventListener('change', function (e) {
        var id = e.target.value;
        try { history.replaceState(null, '', 'ladder.html?league=' + encodeURIComponent(id)); } catch (x) {}
        load(id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      $('q').addEventListener('input', BO.debounce(function (e) {
        S.q = e.target.value.trim();
        S.page = 1;
        render();
      }, 120));
      $('sortSel').addEventListener('change', function (e) { S.sort = e.target.value; S.page = 1; render(); });
      $('onlyBuild').addEventListener('change', function (e) { S.onlyBuild = e.target.checked; S.page = 1; render(); });

      $('refreshBtn').addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        var old = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> 正在读取公开 API…';
        BO.api.live('version.json', true).then(function (v) {
          version = v;
          return BO.api.live('ladder/' + S.league + '.json', true);
        }).then(function (data) {
          if (!data) { BO.toast('数据已是最新'); return; }
          ladder = data;
          if (!ladder.heroes) ladder.heroes = [];
          $('leagueUpdated').textContent = 'API ' + BO.ago(ladder.generated_at) + ' · ' + BO.num(ladder.count) + ' 人';
          $('syncTag').textContent = '实时数据';
          $('syncTag').className = 'tag green';
          renderClassTabs();
          render();
          BO.toast('已从公开 API 更新到最新天梯');
        }).catch(function (e) {
          BO.toast('读取失败：' + e.message, true);
        }).then(function () {
          btn.disabled = false;
          btn.innerHTML = old;
        });
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
          e.preventDefault();
          $('q').focus();
        }
      });
    }).catch(function (e) {
      $('ladderBody').innerHTML = BO.errorBox(e.message);
    });
  });
})();
