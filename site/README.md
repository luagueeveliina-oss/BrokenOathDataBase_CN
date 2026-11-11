# 破誓 · 中文资料库 (Broken Oath Database)

《破誓 / Broken Oath》Playtest 版本的非官方中文资料库。**纯静态站点**，无需安装、无需联网，双击 `index.html` 即可浏览。

界面参考 [poedb.tw（流亡编年史）](https://poedb.tw/cn/) 的暗色配色与排版：近黑底色、金色标题（`#e7b478`）、细边框扁平面板，以及《流亡之路》的物品稀有度与词缀配色（传奇 `#af6025`、词缀 `#8888ff`、宝石 `#1ba29b`…）。

## 打开方式

```
双击 site/index.html
```

或者用任意静态服务器（推荐，避免个别浏览器对 `file://` 的限制）：

```powershell
cd site
python -m http.server 8080
# 打开 http://localhost:8080
```

## 页面

| 文件 | 内容 |
|---|---|
| `index.html` | 总览：PlayTest 0.56.5 版本卡、分类目录（物品 / 技能 / 图鉴 / 词缀）、代表性传奇 |
| `items.html` | 物品库：传奇 182 / 底材 465 / 神像 21（8 底材 + 13 传奇；3 条神像工艺归入魔方配方）/ 词缀 288 / 符文 34 / 珠宝 48 / 符文之语 69 / 药剂 8 / 传奇药剂 6 / 药剂词缀 42 / 魔方配方 41 / 锻造 59 / 神话词条 12 |
| `skills.html` | 技能宝石 58 / 辅助宝石 93 / 誓约与先驱 33 / 灾祸与判决 14，含逐级成长表 |
| `bestiary.html` | 382 种怪物 + 28 位守护者 + 19 种首领机制 |
| `planner.html` | 模拟构筑器：装备词缀/roll/品质、技能与辅助、天赋/龙裔、誓约与诅咒、异常状态、召唤物与图腾/球环/印记/雨/天降，实时 DPS、导入/导出 `BO1.`/`BO2.` 构筑代码、合法性校验 |
| `about.html` | 数据来源、版本、数值机制（缩放曲线/掉落/宝石成长/符文规则）与免责声明 |

功能：顶栏全局搜索（`items.html?q=…`）、中英文关键词搜索（`/` 聚焦）、分面筛选（带计数）、按稀有度（默认）/等级/伤害/防御排序、深链、明暗主题、**中/EN 一键切换**。

深链同时支持「分类」和「分面筛选」，首页目录里的每个词条都指向已筛好的列表：

```
items.html#bases?cls=单手剑          items.html#affixes?on=头盔
items.html#uniques?q=风语           items.html#potions?role=生命
items.html#uniques/windwhisper       items.html#runewords?q=漩涡
skills.html#skills?cls=Warrior       skills.html#supports?attr=力量
bestiary.html#mobs?role=bruiser      bestiary.html#mobs?type=守护者
```

## 数据来源

只读读取本机游戏目录：

```
D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data\
├── Items\        item_bases / uniques / affixes / runes / runewords / stat_text / cube_recipes / mythic_lines
├── Gameplay\     skills（按职业分在 Parts\）/ supports / blessings / curses / potions / forge / passive_tree / monsters / scaling / classes
└── Rifts\        bosses.json（守护者、变体、首领机制）
```

所有词条文本都不是手抄：每条词缀由 `Items\stat_text.json` 的模板 + 真实数值渲染，因此数值与游戏内一致。

文本遵循「与官方一致」的原则：有官方中文就用官方中文，没有就保留游戏里的英文原文，等官方中文到位后再补。

魔方配方在游戏数据里没有风味文本，只有 9 条官方 `Hint`（且游戏数据本身是英文）。这 9 条按原样显示英文；等官方中文可用后，在 `i18n/parts/cube_hints.json` 写入 `{"ch:<配方 id>": "官方中文"}` 再重建即可自动切换成中文。

## 图标

```
assets/icons/
├── manifest.js          图标清单（id -> 图片路径），卡片按 id 取图
├── uniques/ bases/ runes/ jewels/ skills/ supports/
│                        <id>.webp，共 955 张
```

- 传奇、底材、符文、珠宝、技能宝石、辅助宝石的卡片都会显示图标
- 有图片时用图片，缺图（如尚未收录的 3 件传奇、1 颗辅助宝石）自动回退成站内矢量图标
- 重新抓取：`python tools\fetch_icons.py`（已存在的文件会跳过）
- 替换或新增图片后重建清单：`python tools\make_icon_manifest.py`
- 图标为游戏美术资源，版权归开发者所有，本站仅用于非商业的资料展示

## 已移除：构筑模拟器 / 天赋树

- 构筑页（build.html）已整体删除；要点留作参考：BO1 解析（base64url → 长度 + zlib → JSON，字段 `v/t/c/l/p/h/s/g/da/dn`）、攻击 DPS 公式（效用 × 每级 8% × 1.01^5 级后、宝石附加 ×1.19/级、暴击上限 95%）、词缀规则（前后缀 0/1/3、誓约递减、物等限制、本地/全局分离）、木桩抗性/穿透与点燃/流血/中毒常量
- 天赋树页面（tree.html）也已删除；`assets/data/tree.js` 中的主天赋树与龙裔树数据保留，供以后重建
- 导航恢复为：总览 / 物品 / 技能 / 图鉴 / 关于

## 目录结构

```
site/
├── index.html  items.html  skills.html  bestiary.html  about.html
└── assets/
    ├── site.css          设计系统（参考 poedb.tw：近黑底 + 金色标题 + PoE 稀有度配色，含浅色主题）
    ├── site.js           共享脚本：语言切换、主题、分面、卡片、图标、悬浮信息、高亮
    ├── icons/            物品/技能图标与 manifest.js
    └── data/             由构建脚本生成的静态数据（window.BO_*）
        ├── items.js      ~830 KB
        ├── skills.js     ~250 KB
        ├── tree.js       ~520 KB
        ├── bestiary.js   ~180 KB
        └── mechanics.js  ~10 KB
```

## 重新生成数据

数据构建脚本在工作区根目录（不在 `site/` 内）：

```powershell
python build\build_site_data.py     # 读取游戏 JSON -> site\assets\data\*.js
```

- `build/render.py`：把 `{Stat, Mode, Tags, Value}` 形式的修饰符渲染成中英文文本（`stat_text.json` 模板 + 中文模板）。
- `build/stat_zh.py`：291 条词缀模板的中文翻译（唯一事实来源，改这里即可全局生效）。
- `build/terms_zh.py`：标签/槽位/职业/伤害类型术语表。
- `build/text_zh.py`：誓约、灾祸、药剂的短文本。
- `i18n/parts/*.json`：译名与长文本（物品名、怪物名、天赋节点、技能描述等）。

游戏版本更新后，游戏数据文件会变；重新运行构建脚本即可刷新站点（无需改动前端代码）。

## 免责声明

本站为非官方粉丝作品，与《破誓》开发团队无任何关联，亦未获其背书。游戏名称、美术与数据归其各自所有者。数据来自 Playtest 版本，数值会随版本变动。本站仅读取本机游戏文件生成数据，不重新分发游戏本体资源；站点里的物品/技能图标为游戏美术资源，仅用于非商业的资料展示。
