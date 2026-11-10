# 破誓 · 中文资料库 (Broken Oath Database)

《破誓 / Broken Oath》Playtest 版本的非官方中文资料库。**纯静态站点**，无需安装、无需联网（除了可选的 Google Fonts），双击 `index.html` 即可浏览。

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
| `index.html` | 总览：数据规模、分类入口、官方构建指南、代表性传奇 |
| `items.html` | 物品库：传奇 182 / 底材 465 / 词缀 288 / 符文 34 / 珠宝 48 / 符文之语 69 / 药剂 / 魔方配方 41 / 锻造 59 / 神话词条 12 |
| `skills.html` | 技能宝石 58 / 辅助宝石 93 / 誓约与先驱 33 / 灾祸与判决 14，含逐级成长表 |
| `tree.html` | 1242 节点天赋树：滚轮缩放、拖拽平移、搜索、点击查看词条 |
| `bestiary.html` | 382 种怪物 + 28 位守护者 + 19 种首领机制 |
| `about.html` | 数据来源、版本、数值机制（缩放曲线/掉落/宝石成长/符文规则）与免责声明 |

功能：中英文关键词搜索（`/` 聚焦）、分面筛选（带计数）、按等级/伤害/防御排序、深链（`items.html#uniques/windwhisper`）、明暗主题、**中/EN 一键切换**。

## 数据来源

只读读取本机游戏目录：

```
D:\SteamLibrary\steamapps\common\Broken Oath Playtest\BrokenOath\Data\
├── Items\        item_bases / uniques / affixes / runes / runewords / stat_text / cube_recipes / mythic_lines
├── Gameplay\     skills（按职业分在 Parts\）/ supports / blessings / curses / potions / forge / passive_tree / monsters / scaling / classes
└── Rifts\        bosses.json（守护者、变体、首领机制）
```

所有词条文本都不是手抄：每条词缀由 `Items\stat_text.json` 的模板 + 真实数值渲染，因此数值与游戏内一致。

## 目录结构

```
site/
├── index.html  items.html  skills.html  tree.html  bestiary.html  about.html
└── assets/
    ├── site.css          设计系统（深色为主 / 浅色主题）
    ├── site.js           共享脚本：语言切换、主题、分面、卡片、高亮
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

本站为非官方粉丝作品，与《破誓》开发团队无任何关联，亦未获其背书。游戏名称、美术与数据归其各自所有者。数据来自 Playtest 版本，数值会随版本变动。本站仅读取本机游戏文件，不修改、不重新分发游戏本体资源。
