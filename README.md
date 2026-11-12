# 破誓 · 中文资料库 (Broken Oath Data Base)

《破誓 / Broken Oath》Playtest 的非官方中文资料库。**纯静态站点**：天梯、官方公开构筑、环境统计、物品、技能、图鉴与模拟构筑器。

界面重做为 PoEDB 风格：近黑画布、暖金衬线标题、细边面板、紧凑数据表、PoE 稀有度配色，并带浅色主题。

## 目录

```
site/                        发布目录
  index.html                 首页（当前联赛 / Top 10 / 环境 / 代表作）
  ladder.html                天梯（公开联赛 + 职业筛选）
  builds.html build.html     构筑库 / 构筑详情
  meta.html                  环境统计
  items.html skills.html     物品 / 技能
  bestiary.html              图鉴
  planner.html               模拟构筑器
  about.html                 数据来源与免责声明
  assets/app.css app.js      设计系统与共享壳层
  assets/pages/*.js          页面模块
  assets/data/*.js           构建脚本生成的数据 + API 种子
  assets/api/                API 同步快照（部署时生成，默认不提交）
build/                       数据构建脚本
  build_site_data.py         物品/技能/天赋/图鉴
  build_planner_data.py      模拟器数据
  build_names.py             API 页面用的轻量名称索引
  build_search_index.py      全局搜索索引
tools/
  sync_api.py                公开 API 快照 + 离线种子
  pagecheck.js               无浏览器 DOM 冒烟测试
i18n/                        中文译名与长文本
deploy/                      部署说明
```

## 本地预览

```powershell
cd site
python -m http.server 8080
# http://localhost:8080
```

也可以直接双击 `site/index.html`：会使用内置 API 种子（当前联赛可用），其余联赛与主动刷新需要 HTTP。

## 数据

### 本地游戏数据

只读 `…\Broken Oath Playtest\BrokenOath\Data\`，当前本地版本 **0.56.5 / r92**。游戏更新后重新运行：

```powershell
python build\build_site_data.py
python build\build_planner_data.py
python build\build_names.py
python build\build_search_index.py
```

### 公开 API

[Broken Oath public API](https://api.playbrokenoath.com/) 提供天梯、构筑、环境统计与游戏数据。站点按文档要求**在部署侧缓存**，不让每位访客回源：

```powershell
python tools\sync_api.py            # 写入 site/assets/api + assets/data/api_seed.js
python tools\sync_api.py --quick    # 只同步当前联赛
python tools\sync_api.py --force    # 忽略“没有变化”
```

`tools/sync_api.py` 会读取 `version.json` 的 `ladder_updated_at` / `builds_updated_at`，只在天梯或构筑真正变化时重新下载；快照带 `generated_at` 与本站 `synced_at`，页面会如实显示。

`about.html` 列出了用到的每个端点、刷新频率、缓存策略和隐私规则。署名：**Data: Broken Oath public API**。

## 页面功能

- **首页**：根据 `version.json` 与 `leagues.json` 自动选择当前联赛（Online Testing），显示天梯人数、构筑数、补丁、剩余时间、Top 10、职业/技能环境与各职业代表作。
- **天梯**：全部公开联赛、职业筛选、搜索、只看有构筑、按排名/等级/裂隙/DPS 排序、分页；点英雄进入构筑详情。
- **构筑库/详情**：按联赛与职业浏览前 50 份构筑；详情展示装备词缀（按真实 roll 还原）、符文、技能与辅助、天赋、龙相、公开 API 的游戏实测、原始 JSON；可一键送入模拟器，保留全部 8 个神像、矮人符文、词缀与天赋/龙裔。
- **环境统计**：职业环图、主技能占比与裂隙、辅助、龙相组合、基石/显著天赋、传奇使用率、裂隙等级分布。
- **物品/技能/图鉴**：分面筛选、深链接、PoEDB 风格物品卡弹窗；技能页含 18 份开荒指南。
- **模拟构筑器**：DPS / 面板 / 命中 / 异常 / 魔力 参考自 Broken Oath Builder 实现；数据从本机游戏文件重建；支持从零构筑或导入 `.sav` / JSON / `BO1.` 天赋代码 / `BOP1.` 完整计划；装备与固定词缀、可编辑词缀、8 个神像、矮人符文、完整天赋树（节点 DPS 收益 / 最佳下一点）、龙裔树、技能与辅助、誓约/灾祸；显示模型 Boss DPS、面板 DPS 与公开 API 的游戏实测中位 DPS（两者口径分开），以及每秒魔力消耗、保留和防御。
- **全局搜索**：顶栏 `/` 或 `Ctrl+K`，索引 1700 条物品/技能/词缀/怪物；图标与中文名齐全。

## 发布

`.github/workflows/pages.yml` 在每次发布前运行 `tools/sync_api.py`，然后上传 `site/` 为 Pages artifact；也支持每 15 分钟的计划任务刷新快照。若 API 暂时不可达，继续发布上一次提交的种子。

GitHub Pages 设置：Settings → Pages → Source 选 **GitHub Actions**。

## 测试

```powershell
node tools\pagecheck.js index.html     # 无浏览器脚本冒烟
node tools\pagecheck.js build.html
node tools\build_import_test.js        # 旧 BO2 测试样例 -> 旧引擎往返（历史工具）
```

## 免责声明

非官方粉丝作品，与开发团队无关联、未获背书。游戏名称、美术与数据归其各自所有者。天梯/构筑数据来自 Broken Oath public API，由本站缓存；英雄 id 是不可逆匿名哈希，本站不会也无法将其对应到真实玩家。图标为游戏美术资源，仅用于非商业资料展示。
