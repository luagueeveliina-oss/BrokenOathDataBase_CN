# 发布指南 · 破誓中文资料库

站点是**纯静态**的：`site/` 目录里没有任何后端、没有外部 CDN、没有构建步骤（数据已预生成为 `assets/data/*.js`）。
所以"发布"= 把这个目录放到任何能提供 HTTP 静态文件的地方。

---

## 0. 先决定：公开，还是只给朋友看？

这一步比技术选型重要，因为数据来自 **Playtest（测试服）**：

| 情况 | 建议 |
|---|---|
| Playtest 的保密协议（NDA）禁止公开测试数据 | **先别公开**。用"只给朋友"方案，或等正式版上线后再发布 |
| 协议没禁止，但开发商可能不喜欢数据站 | 可以发布，但：不收费、不挂广告、页脚保留免责声明、收到请求就配合下架 |
| 想公开但还没想清楚 | 先发"未列出"链接（`robots.txt` 禁爬 + 不在社区宣传），随时可以撤 |

另外重申本站的一个好习惯：**只发布整理后的数值与文本，不打包、不重分发游戏本体资源**（图标我们本来就没放）。这是粉丝站最安全的形态。

---

## 1. 方案 A：Cloudflare Pages（最快，免费，推荐先跑通）

### 拖拽版（1 分钟，无需装任何东西）

1. 打开 <https://dash.cloudflare.com/> → **Workers & Pages** → **Create** → **Pages** → **Upload assets**
2. 项目名随便填（如 `brokenoath-db`），把 `site` 文件夹**整个拖进去**
3. Deploy → 得到 `https://brokenoath-db.pages.dev`

### 命令行版（可重复部署）

```powershell
cd C:\Users\HCJ0119\Documents\WorkSpace\BrokenOathDataBase
npx wrangler pages deploy site --project-name brokenoath-db
```

### 接 Git（推荐，之后每次 push 自动发布）

1. 把仓库推到 GitHub（见方案 B 的 git 命令）
2. Cloudflare Pages → **Connect to Git** → 选仓库
3. Build command 留空，**Build output directory 填 `site`**
4. 之后 `git push` 即自动部署

> 仓库根目录已有 `site/_headers`，Cloudflare / Netlify 会自动读取（缓存与安全头）。
> 中国大陆访问 `*.pages.dev` 时常不稳定，正式对外建议配自定义域名 + 国内 CDN 回源，或直接用方案 C。

---

## 2. 方案 B：GitHub Pages（免费，天然带版本管理）

```powershell
cd C:\Users\HCJ0119\Documents\WorkSpace\BrokenOathDataBase
git init
git add site build i18n tools deploy
git commit -m "Broken Oath 中文资料库"
git branch -M main
git remote add origin https://github.com/<你的账号>/brokenoath-db.git
git push -u origin main
```

打开仓库 → **Settings → Pages** → Source 选 **GitHub Actions**（推荐，可以只发布 `site/` 子目录）：

把 `deploy/github-pages.yml` 复制成仓库里的 `.github/workflows/pages.yml`，push 后自动发布，
得到 `https://<账号>.github.io/<仓库名>/`。

> 分支直发模式（Deploy from a branch）只支持根目录 `/` 或 `/docs`，**不能选 `site/`**。
> 如果你不想用 Actions：把 `site` 里的内容复制到一个叫 `docs` 的目录再提交，源目录选 `/docs`。
>
> 站点内所有链接都是**相对路径**，所以放在子目录（`/brokenoath-db/`）下也能正常工作。
> 绑自定义域名：Settings → Pages → Custom domain，DNS 加 CNAME 指向 `<账号>.github.io`。
> 国内访问 `github.io` 速度一般，适合分享给愿意开代理的玩家。

---

## 3. 方案 C：国内托管（大陆访问最稳）

前提：**自定义域名必须完成 ICP 备案**（否则只能走境外线路，速度回到方案 A/B 的水平）。

### C1. 阿里云 OSS 静态网站

1. 创建 Bucket（地域选离你近的，读写权限"公共读"）
2. **基础设置 → 静态页面**：默认首页 `index.html`，默认 404 页 `index.html`
3. 上传 `site/` 全部内容（OSS 控制台可直接拖文件夹）
4. 绑定已备案的自定义域名 + 开 CDN，开启 **Gzip/Brotli** 与 `text/html; charset=utf-8`

> ⚠️ 直接用 OSS 默认域名访问 HTML 会被强制下载（`Content-Disposition: attachment`），必须绑自定义域名。

### C2. 腾讯云 COS 静态网站

同上，开启"静态网站"功能并绑定已备案域名。

### C3. 自己的 VPS（最灵活，月成本约 ¥20–40）

```powershell
# 本地打包（排除无关目录）
Compress-Archive -Path site\* -DestinationPath brokenoath-db.zip

# 上传并解压
scp brokenoath-db.zip root@<服务器IP>:/tmp/
ssh root@<服务器IP>
  mkdir -p /var/www/brokenoath-db
  cd /var/www/brokenoath-db && unzip -o /tmp/brokenoath-db.zip
  chown -R www-data:www-data /var/www/brokenoath-db
```

把 `deploy/nginx.conf` 里的域名改成自己的，复制到 `/etc/nginx/conf.d/`，然后：

```bash
nginx -t && systemctl reload nginx
certbot --nginx -d db.yourdomain.com   # 一键 HTTPS
```

更省事的替代：整站丢进一个 Caddy（自动 HTTPS）：

```
db.yourdomain.com {
    root * /var/www/brokenoath-db
    encode gzip zstd
    file_server
}
```

---

## 4. 方案 D：只给朋友 / 不公开

| 方式 | 做法 |
|---|---|
| 直接发压缩包 | `Compress-Archive -Path site\* -DestinationPath brokenoath-db.zip`，对方解压双击 `index.html` 即可（站点完全自包含，离线可用） |
| 局域网共享 | 你在自己电脑上跑 `cd site; python -m http.server 8080`，朋友访问 `http://<你的内网IP>:8080` |
| 私有仓库 + 邀请 | GitHub 私有仓库，Pages 允许私有仓库发布（Pro 账号） |
| 网盘 | 可以，但网盘里的 HTML 不会渲染，必须下载解压 |

---

## 5. 上线前 5 分钟检查清单

- [ ] **能离线打开**：双击 `site/index.html`，六个页面都能切换、搜索能出结果（已自包含，无外链依赖）
- [ ] **压缩生效**：`curl -H "Accept-Encoding: gzip" -sI https://你的域名/assets/data/items.js | findstr Content-Encoding` 应看到 `gzip`
- [ ] **缓存头**：`.html` 用 `no-cache`，`/assets/` 用 `max-age=3600`（`site/_headers` 已写好，Nginx 见 `deploy/nginx.conf`）
- [ ] **中文不乱码**：`Content-Type: text/html; charset=utf-8`
- [ ] **是否要被搜索**：不想被收录就把 `site/robots.txt` 改成 `Disallow: /`
- [ ] **免责声明在**：页脚 / `about.html` 都有；建议再加一行"数据来自 Playtest 版本，可能已过时"
- [ ] **自定义域名 + HTTPS** 已生效（`http://` 自动跳 `https://`）

---

## 6. 更新流程（游戏出新补丁后）

```powershell
# 1. 游戏更新后重新解析数据（只读游戏目录，不会改动它）
python build\build_site_data.py

# 2. 本地验一眼
cd site; python -m http.server 8080

# 3. 重新发布
npx wrangler pages deploy . --project-name brokenoath-db   # Cloudflare
# 或
git commit -am "data: patch r93" ; git push                 # GitHub Pages 自动
# 或
Compress-Archive -Path site\* -DestinationPath brokenoath-db.zip  # 手动上传 VPS/OSS
```

数据文件名是固定的（`items.js` 等），所以改了内容要**让缓存失效**：把 `site/_headers` 里的 `max-age=3600` 调成 `no-cache`，或在页面里给 `<script src="assets/data/items.js?v=r93">` 加版本号。

---

## 7. 成本与速度对比

| 方案 | 费用 | 备案 | 大陆访问 | 上手时间 |
|---|---|---|---|---|
| Cloudflare Pages | 免费 | 不需要 | 一般/偶发不通 | 1 分钟 |
| GitHub Pages | 免费 | 不需要 | 一般 | 5 分钟 |
| 阿里云 OSS + CDN | 几元/月起（流量计费） | **需要** | 很快 | 30 分钟 |
| 腾讯云 COS | 同上 | **需要** | 很快 | 30 分钟 |
| 自有 VPS | ¥20–40/月 | 域名需备案 | 取决于线路 | 1 小时 |

**建议路径**：先 Cloudflare Pages 拖拽上线拿到链接 → 发给几个朋友试 → 确认数据没争议、排版没问题 → 再买域名 + 国内对象存储正式对外。

---

## 8. 如果开发商找上门

1. 立即配合：改 `robots.txt` 为 `Disallow: /`，或直接下线（静态站删除文件即彻底消失）
2. 保留"非官方、无收益、数据来自公开测试版本"的说明
3. 后续可改为只发布**英文原文 + 官方链接**，或只保留计算器类工具（工具页的争议通常小于"完整数据库"）

先问一句往往比先上线更省事：给开发者发个邮件说明这是粉丝工具、不收费、可按要求撤下，多数独立团队是欢迎的。
