# Broken Oath Data Base · 站点说明

《破誓 / Broken Oath》非官方中文资料库，纯静态站点，无后端、无框架、无追踪。

设计参考 [poedb.tw](https://poedb.tw/cn/)：近黑画布、暖金标题、细边面板、紧凑数据表，以及《流亡之路》的稀有度配色（传奇 `#af6025`、稀有 `#ffff77`、魔法 `#8888ff`、宝石 `#1ba29b`）。

## 打开

```powershell
cd site
python -m http.server 8080
# http://localhost:8080
```

也可以直接双击 `index.html`：页面会使用内置的 API 同步种子（`assets/data/api_seed.js`），当前联赛可离线查看；其他联赛与在线刷新需要 HTTP。

## 页面

| 文件 | 内容 |
|---|---|
| `index.html` | 首页：当前联赛、实时状态、Top 10、职业/技能环境、各职业代表作、数据库入口 |
| `ladder.html` | 天梯：全部公开联赛、职业筛选、主技能/辅助、守护者实测 DPS |
| `builds.html` | 构筑库：按联赛与职业浏览官方公开构筑 |
| `build.html` | 构筑详情：装备/词缀/符文、技能/辅助、天赋、龙相、游戏实测、原始 JSON、送入模拟器 |
| `meta.html` | 环境统计：职业、龙相、主技能、辅助、基石、显著天赋、传奇占比、裂隙分布 |
| `items.html` | 物品：传奇/底材/神像/词缀/符文/珠宝/符文之语/药剂/魔方/锻造/神话 |
| `skills.html` | 技能：技能宝石/辅助/誓约/灾祸/开荒指南 |
| `bestiary.html` | 图鉴：怪物/守护者/裂隙机制 |
| `planner.html` | 构筑模拟器：Broken Oath Builder 伤害模型，`.sav`/JSON/`BO1.`/`BOP1.` 导入，装备/神像/天赋/龙裔/技能编辑，导出代码与 JSON |
| `about.html` | 数据来源、API 端点、缓存策略、隐私与免责声明 |

## 目录

```
site/
├── index.html ladder.html builds.html build.html meta.html
├── items.html skills.html bestiary.html planner.html about.html 404.html
├── assets/
│   ├── app.css          设计系统（暗色 + 浅色）
│   ├── app.js           壳层、全局搜索、API 读取、组件
│   ├── planner_ref.css  模拟器样式
│   ├── builder_sim.js   伤害引擎（参考 Broken Oath Builder）
│   ├── planner_ref.js   模拟器界面
│   ├── data/builder_gamedata.js  从本机游戏文件重建的数据
│   ├── data/builder_names_zh.js  中文名覆盖
│   ├── data/tree_icons.js / tree.webp / dragons.webp  天赋/龙裔图标
│   ├── pages/           各页面的模块
│   ├── icons/           物品/技能图标 + manifest.js
│   └── data/            生成的静态数据（window.BO_*）
└── README.md
```

`assets/api/` 是 `tools/sync_api.py` 生成的公开 API 快照，默认不提交；部署前由 GitHub Action 生成。

## 重新生成

```powershell
python build\build_site_data.py      # 物品/技能/天赋/图鉴
python build\build_planner_data.py   # 旧版模拟器数据（构建中文名覆盖时仍会读取）
python build\build_names.py          # API 页面用的轻量名称索引
python build\build_search_index.py   # 顶栏全局搜索索引
python tools\sync_api.py             # 公开 API 快照 + 离线种子
```

游戏数据只读自 `…\Broken Oath Playtest\BrokenOath\Data\`，不会修改游戏目录。

## 数据与 API

天梯、构筑、环境统计来自 [Broken Oath public API](https://api.playbrokenoath.com/)：无密钥、CORS 开放；天梯 15 分钟、构筑/统计 60 分钟刷新。按 API 文档要求，站点在构建/部署侧缓存快照，读者从本站副本读取，不让每位访客回源。

署名：**Data: Broken Oath public API**。本站不是官方站点，也不代表该 API。英雄 id 是不可逆哈希，页面不会、也无法关联到真实玩家。

## 免责声明

非官方粉丝作品，与开发团队无关联、未获背书。游戏名称、美术与数据归其各自所有者；图标仅用于非商业资料展示。
