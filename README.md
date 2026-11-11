# 破誓 · 中文资料库 (Broken Oath Database)

《破誓 / Broken Oath》Playtest 版本的**非官方中文资料库**，纯静态站点：传奇/底材/神像/词缀/符文之语/技能宝石/药剂/怪物图鉴，外加一个**模拟构筑器（Planner）**，全部数值由游戏数据文件直接生成。界面配色与排版参考 [poedb.tw（流亡编年史）](https://poedb.tw/cn/)。

## 目录

```
site/                    ← 发布目录（整个目录就是网站）
  index.html             ← 首页，GitHub Pages 的入口文件
  items.html  skills.html  planner.html  bestiary.html  about.html
  assets/site.css  site.js            ← 站点公共样式与脚本
  assets/planner.css  planner.js      ← 构筑器样式 / 计算引擎（无 DOM 依赖）
  assets/planner_ui.js                ← 构筑器界面层
  assets/data/*.js                    ← 由构建脚本生成的静态数据
build/                   ← 数据构建脚本（读取游戏 JSON → site/assets/data/*.js）
  build_site_data.py     ← 资料库数据（物品/技能/天赋/图鉴/机制）
  build_planner_data.py  ← 构筑器数据（planner_core / planner_items / planner_tree）
i18n/                    ← 中文译名与长文本
tools/                   ← 分析/校验/测试脚本（非站点运行时依赖）
deploy/                  ← 发布配置（DEPLOY.md、nginx.conf、github-pages.yml）
```

## 本地预览

```powershell
cd site
python -m http.server 8080
# 打开 http://localhost:8080
```

也可以直接双击 `site/index.html`（站点完全自包含，无外链）。

> 构筑代码的导入/导出用到浏览器的 `CompressionStream`（压缩流 API）。用 `http://localhost` 或 `file://` 打开都可以；极老的浏览器会提示不支持，其余功能不受影响。

## 重新生成数据

游戏更新后：

```powershell
python build\build_site_data.py      # 资料库页面
python build\build_planner_data.py   # 构筑器数据
```

脚本只读游戏目录 `…\Broken Oath Playtest\BrokenOath\Data\`，不会修改它。`build/anim_rate.json` 是每职业/技能的动作片段 Rate 表（社区按游戏动画校准，缺失时按 1.0 处理），会一起打进 `planner_core.js`。

## 模拟构筑器

`planner.html` 把游戏数据聚合成一个可操作的构筑器：

* **装备 11 槽**：底材、稀有度、前缀/后缀（按物品等级选阶、可拖 roll）、品质、传奇 roll、符文孔与符文之语、传奇；局部词缀（武器百分比/附加伤害、防具防御）先在物品上结算，再进入全局词条池。
* **技能与辅助**：技能宝石等级、辅助宝石按「需要标签 / 不可用标签」校验；每个技能实时给出 DPS、每次使用时间、暴击、每元素伤害占比、异常状态（点燃/中毒/流血/感电/猎人印记）、召唤物与图腾/球环/印记/雨/天降的打击数。
* **天赋树 / 龙裔**：1242 个天赋节点（含基石、抉择、符文插槽）可缩放拖动，支持「推荐加点」、Ctrl+点击自动连路径、右键取消；龙裔树按职业与形态结算。
* **校验**：稀有 3 前缀 + 3 后缀 / 魔法 1+1、同词缀组唯一、词缀必须符合底材标签与物品等级、孔位上限、双手/副手互斥（弓 + 箭袋除外）、辅助标签与重复、天赋连通与点数上限、龙裔王冠节点唯一、誓约保留 —— 不可能的组合会被拦下、标红或给出提示。导入的游戏代码若带旧版超限配置只提示，不吞掉数值。
* **构筑代码**：`BO1.…` 与游戏内「分享构筑」完全一致（职业/等级/天赋/龙裔/技能与辅助/装备底材与传奇），可直接互通；`BO2.…` 是本站扩展格式，额外保存词缀、roll、品质、传奇 roll、符文、誓约与计算设置，可完整还原。导入时会先显示「导入报告」：技能、辅助、装备、天赋/龙裔、DPS 与缺失项，确认后再应用。

计算规则写在 `planner.html` 页脚的「计算规则」一节，引擎在 `site/assets/planner.js`：

* 同类 `increased/reduced` 加算，每条 `more/less` 单独乘算，0.56.5 的「伤害引擎」（力量/护甲/闪避/护盾/生命/格挡）合并成一个乘区；
* 攻击技能的伤害来自武器（局部百分比/附加伤害/品质先结算），乘宝石效率与自身等级 + 额外等级成长；法术技能来自宝石等级 × 效率曲线；
* 伤害按元素分桶后分别结算转化、额外伤害、穿透与抗性；转化伤害保留原类型加成并获得新类型加成；
* 暴击：攻击取武器基础暴击、法术取宝石基础暴击（法杖取杖的暴击，上限 95%），暴击伤害 = 命中 × 暴击倍率；
* 速度 = 武器攻速/施法时间 × 加速词条 × 动作速度 × 动画片段 Rate；冷却随速度恢复；
* 异常状态按 `scaling.json` 的 `Ailments` 常数（点燃/中毒/流血/感电/冰缓/冰冻）与持续时间/覆盖率结算；猎人印记按层数与守护者上限结算；
* 召唤物按数量、攻击间隔、近身 60% 更多、力量/智力亲和与 `LevelDamage` 结算；
* 图腾/球环/印记/雨/天降/引导/余像按游戏数据里的数量、间隔与 0.56.5 的分摊规则结算；
* 面板 DPS 与游戏一致，**不计敌人抗性**；另给出「有效 DPS」（按设定裂隙等级的怪物抗性与穿透）。

构筑器数据的校验/回归脚本（Node）：

```powershell
node tools\planner_test.js        # 用游戏内置指南代码跑一遍引擎
node tools\planner_roundtrip.js   # BO1 / BO2 代码往返 + 数值规模
node tools\planner_import_test.js # 18 个游戏指南代码的完整导入 + BO2 全量往返
node tools\planner_import_ui_test.js # 通过界面导入 18 个指南代码（报告 → 应用 → 状态/DPS）
node tools\planner_validate.js    # 非法词缀/孔位/辅助/点数/保留的校验
node tools\planner_fuzz.js        # 全部技能 × 随机辅助 × 随机装备的压力测试
node tools\planner_ui_test.js     # 页面脚本在最小 DOM 下的冒烟测试
node tools\planner_debug.js warrior_boss   # 打印某个构筑的伤害拆解
node tools\compare_ref.js          # 可选：与本机公开参考构筑器的引擎逐项对比（需该仓库路径）
node tools\planner_make_demo.js   # 生成一份示例构筑代码（写入 tools/_demo_code.txt）
```

动画片段 Rate 与若干机制校准参考了公开的社区构筑器（只读参考，未包含其代码）。数值随 Playtest 版本变化。

## 发布

见 [deploy/DEPLOY.md](deploy/DEPLOY.md)。GitHub Pages 最简单的做法：

1. 仓库里保留 `site/` 这个结构（不要改动）
2. 使用 `.github/workflows/pages.yml`（已就位），Settings → Pages → Source 选 **GitHub Actions**
3. push 到 `main` 即自动发布

## 免责声明

非官方粉丝作品，与开发团队无关联、未获背书。游戏名称、美术与数据归其各自所有者。数据来自 Playtest 版本，随版本变动。本站仅在本机读取游戏文件并整理为站点，不重分发游戏本体；站点内的物品/技能图标为游戏美术资源，仅用于非商业的资料展示。
