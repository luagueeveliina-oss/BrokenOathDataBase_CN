# 破誓 · 中文资料库 (Broken Oath Database)

《破誓 / Broken Oath》Playtest 版本的**非官方中文资料库**，纯静态站点：传奇/底材/词缀/符文之语/技能宝石/天赋树/怪物图鉴，全部数值由游戏数据文件直接生成。界面配色与排版参考 [poedb.tw（流亡编年史）](https://poedb.tw/cn/)。

## 目录

```
site/                 ← 发布目录（整个目录就是网站）
  index.html          ← 首页，GitHub Pages 的入口文件
  items.html  skills.html  tree.html  bestiary.html  about.html
  assets/site.css  site.js  data/*.js   ← 由构建脚本生成的静态数据
build/                ← 数据构建脚本（读取游戏 JSON → site/assets/data/*.js）
i18n/                 ← 中文译名与长文本
tools/                ← 分析/校验脚本（非站点运行时依赖）
deploy/               ← 发布配置（DEPLOY.md、nginx.conf、github-pages.yml）
```

## 本地预览

```powershell
cd site
python -m http.server 8080
# 打开 http://localhost:8080
```

也可以直接双击 `site/index.html`（站点完全自包含，无外链）。

## 重新生成数据

游戏更新后：

```powershell
python build\build_site_data.py
```

脚本只读游戏目录 `…\Broken Oath Playtest\BrokenOath\Data\`，不会修改它。

## 发布

见 [deploy/DEPLOY.md](deploy/DEPLOY.md)。GitHub Pages 最简单的做法：

1. 仓库里保留 `site/` 这个结构（不要改动）
2. 使用 `.github/workflows/pages.yml`（已就位），Settings → Pages → Source 选 **GitHub Actions**
3. push 到 `main` 即自动发布

## 免责声明

非官方粉丝作品，与开发团队无关联、未获背书。游戏名称、美术与数据归其各自所有者。数据来自 Playtest 版本，随版本变动。本站仅在本机读取游戏文件并整理为站点，不重分发游戏本体资源。
