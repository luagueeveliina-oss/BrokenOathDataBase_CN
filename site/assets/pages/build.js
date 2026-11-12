/* Full build sheet — gear, affixes, skills, tree, Dragonling and measured data. */
(function () {
  'use strict';
  var BO = window.BO;
  var IT = window.BO_ITEMS || {};
  var AFF = {}, UNI = {}, BASE = {}, RUNE = {};
  (IT.affixes || []).forEach(function (a) { AFF[a.id] = a; AFF[String(a.id).toLowerCase()] = a; });
  (IT.uniques || []).forEach(function (u) { UNI[u.id] = u; UNI[String(u.id).toLowerCase()] = u; });
  (IT.bases || []).forEach(function (b) { BASE[b.id] = b; BASE[String(b.id).toLowerCase()] = b; });
  (IT.runes || []).forEach(function (r) { RUNE[r.id] = r; RUNE[String(r.id).toLowerCase()] = r; });
  (IT.jewels || []).forEach(function (r) { RUNE[r.id] = r; RUNE[String(r.id).toLowerCase()] = r; });

  var SLOT_ORDER = ['MainHand', 'OffHand', 'Helm', 'Chest', 'Gloves', 'Boots', 'Belt', 'Amulet', 'Ring1', 'Ring2', 'DwarvenRune',
    'Idol1', 'Idol2', 'Idol3', 'Idol4', 'Idol5', 'Idol6', 'Idol7', 'Idol8'];
  var RARITY = { Normal: ['普通', 'Normal'], Magic: ['魔法', 'Magic'], Rare: ['稀有', 'Rare'], Unique: ['传奇', 'Unique'] };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return BO.esc(s); }

  function num(v) {
    if (v == null || v === '') return '—';
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    return Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, '');
  }
  function fillLine(line, v1, v2) {
    if (!line) return '';
    var text = BO.T(line);
    var vals = [v1, v2], k = 0;
    return text.replace(/\((-?[\d.]+)\s*[–-]\s*(-?[\d.]+)\)/g, function (m, a, b) {
      var v = vals[k++];
      if (v == null || v === '') return a + '–' + b;
      return num(v);
    });
  }
  function affixInfo(it, a) {
    if (!a || !a.id) return { text: '—', tier: '', unknown: true };
    if (String(a.id).indexOf('unique:') === 0) {
      var idx = Number(String(a.id).split(':')[1]);
      var u = UNI[it.unique] || UNI[String(it.unique || '').toLowerCase()];
      var line = u && u.mods && u.mods[idx];
      return { text: line ? fillLine(line, a.value, a.value2) : BO.pretty(a.id), tier: '', unique: true };
    }
    var key = String(a.id);
    var aff = AFF[key] || AFF[key.toLowerCase()];
    if (!aff && key.indexOf('riven95_') === 0) aff = AFF[key.slice(8)] || AFF[key.slice(8).toLowerCase()];
    if (!aff) return { text: BO.pretty(a.id), tier: 'T' + (Number(a.tier) + 1), unknown: true };
    var tier = aff.tiers && aff.tiers[a.tier];
    return {
      text: tier ? fillLine(tier.line, a.value, a.value2) : BO.T(aff.top || ''),
      tier: tier ? (tier.t || 'T' + (Number(a.tier) + 1)) : '',
      crafted: a.crafted, oath: a.oath
    };
  }
  function rarityKey(r) { return r === 'Unique' ? 'unique' : r === 'Rare' ? 'rare' : r === 'Magic' ? 'magic' : 'normal'; }
  function itemName(it) {
    if (it.unique) {
      var u = BO.namePair('uniques', it.unique);
      return u ? (BO.LANG ? u[1] : u[0]) : BO.pretty(it.unique);
    }
    var b = BO.namePair('bases', it.base);
    return b ? (BO.LANG ? b[1] : b[0]) : BO.pretty(it.base);
  }
  function itemBase(it) {
    var b = BO.namePair('bases', it.base);
    if (!b) return BO.slotZh(it.slot);
    var slot = b[2] || '', cls = b[3] || '';
    if (it.unique) {
      var nm = BO.LANG ? b[1] : b[0];
      return [nm, cls || slot].filter(Boolean).join(' · ');
    }
    return slot + (cls && cls !== slot ? ' · ' + cls : '');
  }
  function runeName(id) {
    var n = BO.namePair('runes', id);
    return n ? (BO.LANG ? n[1] : n[0]) : BO.pretty(id);
  }
  function runeIcon(id) {
    var key = (window.BO_ICONS || {})['r:' + String(id).toLowerCase()] ? 'r:' + String(id).toLowerCase() : (window.BO_ICONS || {})['j:' + String(id).toLowerCase()] ? 'j:' + String(id).toLowerCase() : null;
    if (key) return BO.icon(key, 'rune', '#aa9e82', 18, 20);
    return BO.icon('', 'rune', '#aa9e82', 18, 20);
  }

  function gearCard(it) {
    var rk = rarityKey(it.rarity);
    var name = itemName(it);
    var base = itemBase(it);
    var iconKey = it.unique ? 'u:' + String(it.unique).toLowerCase() : 'b:' + String(it.base).toLowerCase();
    var icon = (window.BO_ICONS || {})[iconKey] ? BO.icon(iconKey, 'sword', '#c8c8c8', 42, 50) : BO.icon('', 'sword', '#c8c8c8', 42, 50);
    var mods = (it.affixes || []).map(function (a) {
      var info = affixInfo(it, a);
      return '<li class="' + (info.unique || it.rarity === 'Unique' ? 'unique' : '') + '">' + esc(info.text) +
        (info.tier ? '<span class="tier">' + esc(info.tier) + '</span>' : '') +
        (a.crafted ? '<span class="flag">工艺</span>' : '') + (a.oath ? '<span class="flag">誓约</span>' : '') + '</li>';
    }).join('');
    var meta = [];
    if (it.item_level) meta.push('ilvl ' + it.item_level);
    if (it.quality) meta.push('Q' + it.quality + '%');
    if (it.sockets) meta.push(it.sockets + ' 孔');
    meta.push(BO.T(RARITY[it.rarity] || [it.rarity, it.rarity]));
    var runes = '';
    if (it.runes_hidden) runes = '<span class="tag violet">符文集被隐藏</span>';
    else if ((it.runes || []).length) {
      runes = it.runes.map(function (id) {
        return '<span class="gi-rune">' + runeIcon(id) + '<span>' + esc(runeName(id)) + '</span></span>';
      }).join('');
    }
    return '<div class="gear-item ' + rk + '">' +
      '<div class="gi-head">' + icon + '<div style="min-width:0"><div class="gi-name ' + (it.unique ? 'r-unique' : it.rarity === 'Rare' ? 'r-rare' : it.rarity === 'Magic' ? 'r-magic' : 'r-normal') + '">' + esc(name) + '</div>' +
      '<div class="gi-base">' + esc(base) + '</div><div class="gi-meta">' + meta.map(esc).join(' · ') + '</div></div></div>' +
      (mods ? '<ul class="gi-mods">' + mods + '</ul>' : '') +
      (runes ? '<div class="gi-runes">' + runes + '</div>' : '') + '</div>';
  }

  function skillDisplayName(id) {
    var key = String(id || '').toLowerCase();
    var p = BO.namePair('skills', key);
    return p ? (BO.LANG ? p[1] : p[0]) : (key === 'hidden' ? '未公开' : BO.pretty(id));
  }
  function supportDisplayName(id) {
    var key = String(id || '').toLowerCase();
    var p = BO.namePair('supports', key);
    return p ? (BO.LANG ? p[1] : p[0]) : BO.pretty(id);
  }
  function skillIcon(id) {
    var key = String(id || '').toLowerCase();
    var src = (window.BO_ICONS || {})['sk:' + key];
    if (src) return BO.icon('sk:' + key, 'spark', '#1ba29b', 36, 40);
    return BO.icon('', 'spark', '#1ba29b', 36, 40);
  }

  function pickMain(b, override) {
    if (override && override !== 'hidden') return override;
    if (b.main_skill && b.main_skill !== 'hidden') return b.main_skill;
    var hot = (b.hotbar || []).filter(function (x) { return x && x !== 'move' && x !== 'hidden'; });
    if (hot.length) return hot[0];
    var best = '', bestV = -1;
    Object.keys(b.skill_damage || {}).forEach(function (k) {
      var v = b.skill_damage[k] || 0;
      if (v < 1e9 && v > bestV) { bestV = v; best = k; }
    });
    if (best) return best;
    return (b.skills && b.skills[0] && b.skills[0].skill) || '';
  }

  function renderGear(b) {
    var items = (b.items || []).filter(function (x) { return x.slot !== 'Idol'; }).slice().sort(function (a, c) {
      return SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(c.slot);
    });
    var groups = {};
    items.forEach(function (it) {
      (groups[it.slot] = groups[it.slot] || []).push(it);
    });
    return Object.keys(groups).map(function (slot) {
      return '<div class="gear-group"><div class="gear-slot-label"><span>' + esc(BO.slotZh(slot)) + '</span><span>' + groups[slot].length + ' 件</span></div>' +
        groups[slot].map(gearCard).join('') + '</div>';
    }).join('');
  }

  function renderIdols(b) {
    var items = (b.items || []).filter(function (x) { return x.slot === 'Idol'; });
    if (!items.length) return '';
    return '<section class="sec"><div class="sec-head"><div class="sec-left"><div class="sec-kicker">Idols</div><h2 class="sec-title">神像</h2></div><span class="sec-link">' + items.length + ' 件 · 每件占 1–4 格</span></div>' +
      '<div class="relic-grid">' + items.map(function (it) {
        var rk = rarityKey(it.rarity);
        var icon = (window.BO_ICONS || {})['b:' + String(it.base).toLowerCase()] ? BO.icon('b:' + String(it.base).toLowerCase(), 'rune', '#cbb27f', 30, 34) : BO.icon('', 'rune', '#cbb27f', 30, 34);
        var mods = (it.affixes || []).map(function (a) { return affixInfo(it, a).text; }).filter(Boolean).join(' · ');
        return '<div class="relic ' + rk + '"><div class="relic-head">' + icon +
          '<div class="relic-title"><b class="' + (it.rarity === 'Unique' ? 'r-unique' : it.rarity === 'Rare' ? 'r-rare' : 'r-magic') + '">' + esc(itemName(it)) + '</b>' +
          '<span>' + esc(itemBase(it)) + ' · ilvl ' + (it.item_level || '—') + ' · ' + esc(BO.T(RARITY[it.rarity] || [it.rarity, it.rarity])) + '</span>' +
          (mods ? '<div class="relic-mods">' + esc(mods) + '</div>' : '') + '</div></div></div>';
      }).join('') + '</div></section>';
  }

  function renderSkills(b, main) {
    var skills = b.skills || [];
    var levels = b.gem_levels || {};
    return skills.map(function (s) {
      var id = String(s.skill || '').toLowerCase();
      var level = levels[s.skill] != null ? levels[s.skill] : levels[id];
      var supports = (s.supports || []).filter(function (x) { return x && x !== 'hidden'; });
      var hidden = (s.supports || []).some(function (x) { return x === 'hidden'; });
      var dps = (b.skill_damage || {})[s.skill] != null ? b.skill_damage[s.skill] : (b.skill_damage || {})[id];
      var supChips = supports.map(function (sid) {
        var key = String(sid).toLowerCase();
        var icon = (window.BO_ICONS || {})['sp:' + key] ? BO.icon('sp:' + key, 'link', '#8fb0e8', 18, 20) : BO.icon('', 'link', '#8fb0e8', 18, 20);
        return '<span class="sup-chip">' + icon + esc(supportDisplayName(key)) + '</span>';
      }).join('');
      if (!supChips && !hidden) supChips = '<span class="sup-chip empty">无辅助</span>';
      return '<div class="sk-card ' + (id === String(main).toLowerCase() ? 'main' : '') + '">' +
        '<div class="sk-top">' + skillIcon(id) + '<div class="sk-title"><b>' + esc(skillDisplayName(id)) + '</b><span>' + (id === String(main).toLowerCase() ? '主技能 · ' : '') + (s.conduit_link ? '导能链接 · ' + esc(supportDisplayName(s.conduit_link)) : '技能宝石') + '</span></div>' +
        '<span class="sk-lv">Lv ' + (level == null ? '—' : level) + '</span></div>' +
        '<div class="sk-sups">' + supChips + (hidden ? '<span class="sup-chip empty">辅助被隐藏</span>' : '') + '</div>' +
        (dps != null ? (dps > 1e9
          ? '<div class="sk-dps"><span>游戏记录的技能伤害</span><b class="muted">—</b><span class="tiny mute">官方字段溢出，已隐藏</span></div>'
          : '<div class="sk-dps"><span>游戏记录的技能伤害</span><b>' + BO.num(dps) + '</b></div>') : '') +
        '</div>';
    }).join('');
  }

  function nodeName(id) {
    var n = BO.namePair('nodes', id) || BO.namePair('dragon', id);
    return n ? (BO.LANG ? n[1] : n[0]) : BO.pretty(id);
  }
  function nodeKind(id) {
    var n = BO.namePair('nodes', id) || BO.namePair('dragon', id);
    return n ? (n[2] || '') : '';
  }

  function renderTree(b) {
    var nodes = (b.passive_nodes || []).filter(Boolean);
    var notable = nodes.filter(function (id) { var k = nodeKind(id); return /显著|基石|抉择|Notable|Keystone|Choice/i.test(k); });
    var dragon = (b.ascendancy && b.ascendancy.nodes) || [];
    var byPath = {};
    dragon.forEach(function (id) {
      var n = BO.namePair('dragon', id);
      var p = n && n[3] ? n[3] : '龙裔';
      (byPath[p] = byPath[p] || []).push(id);
    });
    return '<div class="panel-bd">' +
      '<div class="statgrid" style="grid-template-columns:repeat(3,1fr)">' +
      '<div class="stat"><b>' + nodes.length + '</b><span>天赋节点</span><small>' + notable.length + ' 个显著 / 基石</small></div>' +
      '<div class="stat"><b>' + dragon.length + '</b><span>龙裔节点</span><small>' + esc(BO.aspectZh((b.ascendancy || {}).aspect)) + '</small></div>' +
      '<div class="stat"><b>' + (b.bonus_passive_points || 0) + '</b><span>额外天赋点</span><small>tree v' + ((b.tree_version || '—')) + '</small></div>' +
      '</div>' +
      '<div class="grid-2 mt16">' +
      '<div><div class="ip-label">关键天赋</div><div class="node-list">' +
      (notable.length ? notable.map(function (id) {
        return '<div class="node"><span class="nd">◆</span><div><b>' + esc(nodeName(id)) + '</b><span>' + esc(nodeKind(id)) + '</span></div></div>';
      }).join('') : '<div class="small muted" style="padding:8px 0">没有显著或基石节点。</div>') + '</div></div>' +
      '<div><div class="ip-label">龙相与节点</div><div class="node-list">' +
      (dragon.length ? Object.keys(byPath).map(function (p) {
        return '<div class="node"><span class="nd">◇</span><div><b>' + esc(p) + '</b><span>' + byPath[p].map(function (id) { return esc(nodeName(id)); }).join(' · ') + '</span></div></div>';
      }).join('') : '<div class="small muted" style="padding:8px 0">没有龙裔节点。</div>') + '</div></div>' +
      '</div></div>';
  }

  function measuredCard(m) {
    if (!m) return '<div class="measured"><h3>游戏实测</h3><div class="small muted">这份构筑没有实测数据。</div></div>';
    return '<div class="measured"><h3>游戏实测 · 守护者</h3>' +
      '<div class="row"><span>实测守护者 DPS</span><b class="gold" style="font-size:20px">' + (m.guardian_dps_median ? BO.num(m.guardian_dps_median) : '—') + '</b></div>' +
      '<div class="row"><span>击杀 / 阵亡</span><b>' + (m.guardian_kills == null ? '—' : m.guardian_kills) + ' / ' + (m.guardian_losses == null ? '—' : m.guardian_losses) + '</b></div>' +
      '<div class="row"><span>中位击杀时间</span><b>' + (m.guardian_kill_seconds_median == null ? '—' : m.guardian_kill_seconds_median + ' 秒') + '</b></div>' +
      '<div class="row"><span>统计窗口</span><b>' + (m.window_days || '—') + ' 天</b></div>' +
      '<div class="note">字段 <code>guardian_dps_median</code>：游戏自身在守护者战斗中记录的中位 DPS，不是本站面板计算。由公开 API 提供，更新于 ' + esc(BO.fmtDate(m.at, true)) + '。</div></div>';
  }

  function plannerObject(outer, main) {
    var b = outer.build || outer;
    var picked = [], used = {}, idol = 1;
    (b.items || []).forEach(function (it) {
      var slot = it.slot;
      if (slot === 'Idol') {
        while (used['Idol' + idol]) idol++;
        slot = 'Idol' + idol++;
      }
      if (SLOT_ORDER.indexOf(slot) < 0 || used[slot]) return;
      used[slot] = 1;
      picked.push(Object.assign({}, it, { slot: slot }));
    });
    var gear = picked.map(function (it) {
      return { s: it.slot, b: String(it.base || '').toLowerCase(), r: it.rarity || 'Normal', u: String(it.unique || '').toLowerCase() };
    });
    var x = { v: 2, a: {}, so: {}, ur: {}, q: {}, il: {}, ts: {}, ch: {}, vw: {}, cs: {}, cfg: { boss: 1, shock: 0, roll: 100, rl: outer.rupture_level || 84, target: 'boss', gates: 6, pinnacle: 1 } };
    picked.forEach(function (it) {
      var slot = it.slot;
      if ((it.affixes || []).length && it.rarity !== 'Unique') {
        x.a[slot] = it.affixes.map(function (a) {
          var key = String(a.id || '');
          var aff = AFF[key] || AFF[key.toLowerCase()] || (key.indexOf('riven95_') === 0 ? AFF[key.slice(8)] : null);
          if (!aff) return null;
          var t = aff.tiers && aff.tiers[a.tier];
          var roll = 100;
          if (t && t.hi != null && t.lo != null && t.hi > t.lo) roll = (Number(a.value) - t.lo) / (t.hi - t.lo) * 100;
          return { i: aff.id, t: a.tier, r: BO.clamp(Math.round(roll), 0, 100), cr: a.crafted ? 1 : 0 };
        }).filter(Boolean);
      }
      if ((it.runes || []).length) x.so[slot] = it.runes.map(function (r) { return String(r).toLowerCase(); });
      x.il[slot] = it.item_level || 84;
      x.q[slot] = it.quality || 0;
      if (it.rarity === 'Unique') x.ur[slot] = 50;
    });
    var skills = (b.skills || []).map(function (s) {
      return {
        k: String(s.skill || '').toLowerCase(),
        l: (b.gem_levels || {})[s.skill] || (b.gem_levels || {})[String(s.skill || '').toLowerCase()] || 20,
        u: (s.supports || []).filter(function (v) { return v && v !== 'hidden'; }).map(function (v) { return String(v).toLowerCase(); })
      };
    });
    x.meta = {
      source: 'api',
      mainSkill: String(main || '').toLowerCase(),
      officialDps: (outer.measured && outer.measured.guardian_dps_median) || null,
      officialKills: (outer.measured && outer.measured.guardian_kills) || null,
      officialLosses: (outer.measured && outer.measured.guardian_losses) || null,
      officialKillSeconds: (outer.measured && outer.measured.guardian_kill_seconds_median) || null,
      officialWindow: (outer.measured && outer.measured.window_days) || null,
      ruptureLevel: outer.rupture_level || null,
      hero: outer.hero || ''
    };
    return {
      v: 1, t: 'API · ' + skillDisplayName(main), c: outer.class || b.class || 'Warrior', l: outer.level || b.level || 1,
      p: (b.passive_nodes || []).filter(Boolean),
      h: (b.hotbar || []).filter(function (x2) { return x2 && x2 !== 'move' && x2 !== 'hidden'; }).map(function (x2) { return String(x2).toLowerCase(); }),
      s: skills, g: gear,
      da: (b.ascendancy && b.ascendancy.aspect) || '',
      dn: (b.ascendancy && b.ascendancy.nodes) || [],
      x: x
    };
  }

  function b64url(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  async function encodeBO2(obj) {
    if (typeof CompressionStream === 'undefined') throw new Error('浏览器不支持 CompressionStream');
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    var cs = new CompressionStream('deflate');
    var stream = new Blob([bytes]).stream().pipeThrough(cs);
    var z = new Uint8Array(await new Response(stream).arrayBuffer());
    var out = new Uint8Array(4 + z.length);
    new DataView(out.buffer).setUint32(0, bytes.length, true);
    out.set(z, 4);
    return 'BO2.' + b64url(out);
  }

  // Exposed for the Node round-trip test (tools/build_import_test.js).
  BO.buildToPlanner = plannerObject;
  BO.encodeBO2 = encodeBO2;

  function render(b, league, mainOverride) {
    var main = pickMain(b.build, mainOverride);
    var mainName = skillDisplayName(main);
    document.title = mainName + ' · ' + BO.classZh(b.class) + ' · Broken Oath Data Base';
    var cls = b.class, aspect = b.build.ascendancy && b.build.ascendancy.aspect;
    var html =
      '<header class="pagehead"><div class="crumbs"><a href="index.html">首页</a><span class="sep">/</span><a href="ladder.html?league=' + encodeURIComponent(league) + '">天梯</a><span class="sep">/</span><a href="builds.html?league=' + encodeURIComponent(league) + '">构筑库</a><span class="sep">/</span><span>构筑详情</span></div>' +
      '<div class="ph-kicker">Build sheet · ' + esc(league) + '</div>' +
      '<div class="ph-row"><div><h1 class="ph-title">' + esc(mainName) + '</h1><p class="ph-sub">' + esc(BO.classZh(cls)) + ' · ' + esc(BO.aspectZh(aspect)) + ' · 等级 ' + b.level + ' · 最佳裂隙 ' + (b.rupture_level == null ? '—' : b.rupture_level) + '。装备词缀、技能、天赋与龙相均来自官方公开构筑文件。</p></div>' +
      '<div class="ph-actions"><a class="btn btn-sm" href="builds.html?league=' + encodeURIComponent(league) + '&class=' + encodeURIComponent(cls) + '">返回构筑库</a>' +
      '<button class="btn btn-sm" id="copyRaw">复制 JSON</button>' +
      '<button class="btn btn-sm btn-gold" id="openPlanner" title="把完整装备、词缀、神像、天赋、龙相与技能带入模拟器">在模拟器中打开</button></div></div></header>' +

      '<section class="build-hero">' +
      '<div class="build-id"><div class="bi-top"><div class="bi-skill">' + skillIcon(main) + '<div><div class="bi-name">' + esc(mainName) + '</div><div class="bi-sub">' + esc(BO.classZh(cls)) + ' · ' + esc(BO.aspectZh(aspect)) + ' · 英雄 <span class="mono">' + esc(String(b.hero).slice(0, 10)) + '…</span></div></div></div>' +
      '<span class="tag gold">#' + (b.class_rank || '—') + ' · ' + esc(league) + '</span></div>' +
      '<div class="bi-tags">' + BO.classChip(cls) + BO.aspectChip(aspect) + (b.dead ? '<span class="tag red">已阵亡</span>' : '<span class="tag green">存活</span>') + (b.hardcore ? '<span class="tag">硬核</span>' : '') + '<span class="tag">' + ((b.build.skills || []).length) + ' 个技能</span><span class="tag">' + ((b.build.passive_nodes || []).length) + ' 天赋点</span></div>' +
      '<div class="bi-stats">' +
      '<div class="bi-stat"><b>' + b.level + '</b><span>等级</span></div>' +
      '<div class="bi-stat"><b>' + (b.rupture_level == null ? '—' : b.rupture_level) + '</b><span>最佳裂隙</span></div>' +
      '<div class="bi-stat"><b>' + ((b.build.items || []).length) + '</b><span>装备与神像</span></div>' +
      '<div class="bi-stat gold"><b>' + BO.ago(b.updated_at) + '</b><span>官方更新</span></div>' +
      '</div></div>' +
      measuredCard(b.measured) + '</section>' +

      '<section class="sec"><div class="sec-head"><div class="sec-left"><div class="sec-kicker">Equipment</div><h2 class="sec-title">装备与词缀</h2></div><span class="sec-link">' + ((b.build.items || []).filter(function (x) { return x.slot !== 'Idol'; }).length) + ' 件 · 含矮人符文</span></div>' +
      '<div class="gear-columns">' + renderGear(b.build) + '</div></section>' + renderIdols(b.build) +

      '<section class="sec"><div class="sec-head"><div class="sec-left"><div class="sec-kicker">Skills</div><h2 class="sec-title">技能与辅助</h2></div><span class="sec-link">' + ((b.build.skills || []).length) + ' 组 · 宝石等级来自官方文件</span></div>' +
      '<div class="skill-grid">' + renderSkills(b.build, main) + '</div></section>' +

      '<section class="sec"><div class="sec-head"><div class="sec-left"><div class="sec-kicker">Tree & Dragonling</div><h2 class="sec-title">天赋与龙相</h2></div></div>' +
      '<div class="panel">' + renderTree(b.build) + '</div></section>' +

      '<section class="sec"><details class="rawbox"><summary>原始 JSON · 官方构筑文件</summary><pre>' + esc(JSON.stringify(b, null, 2)) + '</pre></details>' +
      '<p class="tiny mute mt8">Data: Broken Oath public API · 构筑由玩家公开分享，API 已移除玩家身份信息。英雄 id 是不可逆的匿名哈希。</p></section>';

    $('buildBody').innerHTML = html;
    $('copyRaw').addEventListener('click', function () { BO.copy(JSON.stringify(b, null, 2)); });
    $('openPlanner').addEventListener('click', function () {
      try {
        localStorage.setItem('bo_pending_build', JSON.stringify({ api: b, main: main, league: league, at: Date.now() }));
        location.href = 'planner.html#import=api';
      } catch (e) {
        BO.toast('浏览器存储不可用，无法打开模拟器：' + e.message, true);
      }
    });
  }

  function error(msg, retry) {
    $('buildBody').innerHTML = '<header class="pagehead"><div class="crumbs"><a href="index.html">首页</a><span class="sep">/</span><a href="builds.html">构筑库</a></div>' +
      '<div class="ph-kicker">Build</div><h1 class="ph-title">构筑详情</h1></header>' +
      '<div class="empty"><h3>没有找到这份构筑</h3><p>' + esc(msg || '它可能已经离开职业前 50，或玩家取消了公开。') + '</p>' +
      '<p class="mt16"><a class="btn" href="builds.html">返回构筑库</a> ' + (retry ? '<button class="btn" id="retryBuild">从公开 API 重新读取</button>' : '') + '</p></div>';
    if (retry) {
      $('retryBuild').addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        BO.api.live('builds/' + league + '/' + cls + '/' + hero + '.json', true).then(function (data) {
          render(data, league);
        }).catch(function (e) {
          BO.toast('读取失败：' + e.message, true);
          btn.disabled = false;
        });
      });
    }
  }

  var league = '', cls = '', hero = '';

  BO.init('build.html', function () {
    league = BO.qs('league') || '';
    cls = BO.qs('class') || '';
    hero = BO.qs('hero') || '';
    if ((!league || !cls || !hero) && window.BO_API_SEED && BO_API_SEED.details && BO_API_SEED.details.length) {
      var d = BO_API_SEED.details[0];
      league = d.league; cls = d.class; hero = d.hero;
    }
    if (!league || !cls || !hero) {
      error('链接缺少 league、class 或 hero 参数。', false);
      return;
    }
    BO.api.build(league, cls, hero).then(function (b) {
      if (!b || !b.build) throw new Error('构筑文件为空');
      BO.api.ladder(league).then(function (l) {
        var row = (l.heroes || []).find(function (h) { return h.hero === hero; });
        render(b, league, row && row.main_skill);
      }).catch(function () { render(b, league); });
    }).catch(function (e) {
      error(e.message, true);
    });
  });
})();
