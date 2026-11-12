/* About page — data status strip. */
(function () {
  'use strict';
  var BO = window.BO;

  function chip(label, value, cls) {
    return '<span class="tag ' + (cls || '') + '" style="padding:4px 9px">' + BO.esc(label) + ' <b style="color:var(--gold);font-family:var(--font-mono);font-weight:500;margin-left:4px">' + BO.esc(value) + '</b></span>';
  }

  BO.init('about.html', function () {
    Promise.all([
      BO.api.manifest(), BO.api.version(), BO.api.leagues(),
      BO.api.load('game-data/index.json').catch(function () { return null; })
    ]).then(function (res) {
      var m = res[0] || {}, v = res[1] || {}, l = res[2] || { leagues: [] }, gd = res[3] || {};
      var host = document.getElementById('apiStatus');
      var items = [
        chip('补丁', v.patch || m.patch || '—', 'gold'),
        chip('游戏 build', v.game_build || m.game_build || '—'),
        chip('公开联赛', (l.leagues || []).length),
        chip('天梯数据', BO.ago(v.ladder_updated_at), 'green'),
        chip('构筑数据', BO.ago(v.builds_updated_at), 'blue'),
        chip('游戏数据', ((gd.files || []).length) + ' 文件'),
        chip('本站同步', m.synced_at ? BO.ago(m.synced_at) : '内置种子')
      ];
      host.innerHTML = items.join('');
      document.getElementById('statusTime').textContent = '同步于 ' + (m.synced_at ? BO.fmtDate(m.synced_at, true) : '—') + ' · 来源 ' + (m.source || 'Broken Oath public API');
      if (m.seed) {
        host.insertAdjacentHTML('beforeend', '<span class="tag">当前使用内置种子；部署时会运行完整同步</span>');
      }
      var panel = document.getElementById('apiStatusPanel');
      panel.insertAdjacentHTML('beforeend', '<div class="panel-foot">公开 API 当前补丁 <b class="gold">' + BO.esc(v.patch || '—') + '</b>，本地资料库 <b>0.56.5</b>。两者不一致时，物品/技能页仍显示本地版本，天梯与构筑显示 API 版本。</div>');
    }).catch(function (e) {
      document.getElementById('apiStatus').innerHTML = BO.errorBox(e.message);
    });
  });
})();
