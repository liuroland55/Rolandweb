# 石予的个人网站

公开部分是 Astro 静态站（部署到 GitHub Pages），私密相册与友邻权限由 Cloudflare Worker
（TypeScript + D1 + R2 + KV）承担。硬约束与架构备忘见 [CLAUDE.md](./CLAUDE.md)，
完整搭建计划见 [PLAN.md](./PLAN.md)。

> **GitHub Pages 是纯静态的，任何"前端隐藏"都不是安全措施。**
> 私密内容（相册原图、下载链接）必须经 Worker 签发的临时链接才能拿到，
> 而不是靠 CSS/JS 把东西藏起来——藏起来的东西，浏览器开发者工具照样能看见。

---

## 1. 本地开发

两个独立进程，分别对应公开站与权限后端：

```sh
# 公开站（Astro），默认 http://localhost:4321
npm install
npm run dev
```

```sh
# 权限后端（Cloudflare Worker），默认 http://127.0.0.1:8787
cd worker
npm install
cp .dev.vars.example .dev.vars   # 按需填 RESEND_API_KEY / SIGNING_SECRET
npm run db:migrate:local          # 首次运行，本地建表
npm run dev
```

两边默认跑在不同端口，`src/lib/auth.ts` 里的 `PUBLIC_API_BASE` 环境变量决定前端去哪问会话：
本地开发在仓库根建一个 `.env` 写 `PUBLIC_API_BASE=http://127.0.0.1:8787`；
生产环境留空即可（见下面「同一顶级域名」的说明）。

---

## 2. 发一篇内容（≤ 3 步）

1. 在对应栏目目录下新建一个 `.md`（或 `.mdx`）文件。
2. 写 frontmatter + 正文。
3. `git push`，GitHub Actions 自动构建部署。

各栏目最小 frontmatter 示例：

```yaml
# src/content/essays/xxx.md
---
title: 标题
date: 2026-09-09
---
正文……
```

```yaml
# src/content/poems/xxx.md（不支持 tags）
---
title: 标题
date: 2026-09-09
version: 第一稿
---
诗行……
```

```yaml
# src/content/notes/xxx.md
---
title: 一句话摘要
date: 2026-09-09
---
真正的内容。
```

```yaml
# src/content/music/xxx.md
---
title: 本周听录
date: 2026-09-09
items:
  - { album: 专辑名, artist: 艺人, year: 2024, rating: 4.5, comment: 短评 }
---
```

```yaml
# src/content/films/xxx.md
---
title: 本月观影
date: 2026-09-09
items:
  - { title: 片名, year: 2024, director: 导演, rating: 4.5, comment: 短评 }
---
```

```yaml
# src/content/photos/xxx.md
---
title: 卷名
date: 2026-09-09
roll: some-roll-slug          # 同时是 Worker D1 里 albums.roll 的值
shot_at: 2026-09-01
count: 24
visibility: public            # public | group | private
---
```

```yaml
# src/content/now/xxx.md
---
title: 简短标题
date: 2026-09-09T20:00:00
kind: 句子                     # 句子 | 诗行 | 听到 | 拍到 | 代码 | 书摘
body: 正文这一句话
---
```

---

## 3. 加一个新栏目（以假想的 `dreams` 栏目为例）

改动量应该控制在这几处（真实 diff 示例）：

**① `src/content.config.ts`** 加一段 schema：

```diff
+const dreams = defineCollection({
+  loader: collectionOf('dreams'),
+  schema: z.object({
+    ...commonFields,
+    lucidity: z.number().min(0).max(5).optional(),
+  }),
+});

-export const collections = { essays, poems, notes, music, films, photos, now, pages };
+export const collections = { essays, poems, notes, music, films, photos, now, pages, dreams };
```

**② `src/styles/global.css`** 加一组变量覆盖：

```css
body[data-section="dreams"] {
  --accent-deep: oklch(.28 .09 300);
  --accent-ink: oklch(.40 .08 300);
}
```

**③ `src/components/layout/Sidebar.astro`** 的 `navItems` 里加一行：

```diff
   { key: 'photos', name: '照片', href: '/photos', count: counts.photosRolls },
+  { key: 'dreams', name: '梦', href: '/dreams', count: counts.dreams },
```

（`lib/counts.ts` 的 `SectionCounts` 类型与 `getSectionCounts()` 里也加一个 `dreams` 字段。）

**④ 一个列表页 `src/pages/dreams/index.astro`**，照抄 `src/pages/films/index.astro` 的结构即可。

不要新增依赖、不要 Tailwind/UI 组件库/CSS-in-JS/状态管理库/jQuery。

---

## 4. 换一个栏目的配色

只改 `src/styles/global.css` 里对应 `[data-section="xxx"]` 的那组变量，
不要动报头大小、栏宽（`--rail-w`/`--main-max`/`--pad-x`/`--measure`）、字号。
例：把 `films` 从暖褐换成冷灰——

```diff
 body[data-section="films"] {
-  --accent-deep: oklch(.30 .06 60);
-  --accent-ink: oklch(.38 .07 60);
+  --accent-deep: oklch(.32 .01 240);
+  --accent-ink: oklch(.40 .01 240);
 }
```

---

## 5. 加一个朋友

1. 登录 `/admin`（需要你的账号 `role=admin`）。
2. 「生成邀请链接」卡片：选分组、填有效期与可用次数，提交。
3. 复制生成的 `https://shiyu.me/join/<token>` 链接，发给对方；对方打开、填邮箱昵称即可入组并自动登录。
4. 「相册可见性」表格里，把要给这个朋友看的相册可见范围设成对应分组（或在相册申请通过时自动加组，见下）。

如果朋友是自己在某个相册页点了「申请查看」：`/admin` 的用户表里会出现一行高亮的待处理申请，
点「允许」——会自动创建/复用这个邮箱对应的账号，并把它加进这一卷所需要的所有分组。

---

## 6. 加一张 Apple Music 嵌入

1. 在 Apple Music App / 网页版找到对应歌曲/专辑/歌单，点「分享」拿到链接，形如：

   ```
   https://music.apple.com/us/album/unknown-pleasures/1234567890?i=1234567891
   ```

2. 从链接里取：`kind`（album/song/playlist，看路径第二段）、`id`（路径最后的数字）、
   `i`（`?i=` 后面的数字，只有单曲需要）、`storefront`（路径第一段，如 `us`/`cn`）。
3. 在 MDX 里用：

   ```mdx
   import AppleMusic from '../../components/content/AppleMusic.astro';

   <AppleMusic kind="song" id="1234567890" i="1234567891" storefront="us"
     title="Disorder" artist="Joy Division" year={1979} />
   ```

   或者在 `music`/`now` 的 frontmatter 里直接写 `apple_music: { kind, id, i, storefront, title, artist, year }`，
   页面会自动用 facade 卡渲染（默认不加载 iframe，点击播放按钮才注入，见 `src/components/content/AppleMusic.astro`）。

---

## 7. 自定义域名、Cloudflare 绑定与环境变量清单

### 7.1 域名与部署架构

生产环境里，Astro 静态站与 Worker 共用同一个顶级域名：域名 DNS 走 Cloudflare 代理（橙色云朵），
Cloudflare **Worker Route** 把 `/api/*`、`/admin*`、`/join/*` 分流给 Worker，其余路径回落到
GitHub Pages 的静态源。步骤大致是：

1. GitHub 仓库 → Settings → Pages，Source 选 `GitHub Actions`（工作流已经在
   `.github/workflows/deploy.yml` 里写好了，push 到 `main` 会自动跑）。
2. 把 `public/CNAME` 里的 `shiyu.me` 换成你实际拥有的域名；同时改 `astro.config.mjs` 的 `site`。
3. 域名 DNS 接入 Cloudflare（把 NS 记录指过去，或者用 Cloudflare Registrar），确保代理开启。
4. `cd worker && npx wrangler deploy` 部署 Worker；然后在 Cloudflare Dashboard →
   该域名 → Workers Routes，加一条：`shiyu.me/api/*`、`shiyu.me/admin*`、`shiyu.me/join/*`
   都指向这个 Worker（三条 route，或者写成一条更宽的模式，按你的 Cloudflare 套餐能力来）。
5. 首次部署前，把 `worker/wrangler.toml` 里的占位 id 换成真实资源（本地开发不需要这步）：

   ```sh
   cd worker
   npx wrangler d1 create shiyu-db          # 把输出的 database_id 填回 wrangler.toml
   npx wrangler kv namespace create SESSIONS # 把输出的 id 填回 wrangler.toml
   npx wrangler r2 bucket create shiyu-photos
   npx wrangler d1 execute shiyu-db --remote --file=./src/db/schema.sql
   ```

若你不打算绑定自定义域名（只用 `<user>.github.io/<repo>` 这种子路径），需要把
`astro.config.mjs` 的 `base` 改成 `'/<repo-name>/'`，并注意所有站内绝对路径链接
（本仓库里都是以 `/` 开头的绝对路径，改 `base` 后需要统一加前缀，或者改用
`import.meta.env.BASE_URL` 拼接）。这种部署下 Worker 没法和站点共享一级路径，
`/admin`、`/join` 等需要单独一个 Worker 自己的域名/子域名，`PUBLIC_API_BASE` 也要相应指过去。

### 7.2 环境变量清单

| 用途 | Astro 站（`.env`，`PUBLIC_` 前缀会打进构建产物） | Worker（`.dev.vars` 本地 / Cloudflare Secrets 生产） |
|---|---|---|
| 前端访问 Worker 的地址 | `PUBLIC_API_BASE`（生产留空，同源；本地填 `http://127.0.0.1:8787`） | — |
| 邮件发送 | — | `RESEND_API_KEY`（不设置则退回 console 打印，本地开发够用） |
| 邮件发件人 | — | `MAIL_FROM`（`wrangler.toml` 的 `[vars]` 里，非敏感） |
| 签名链接密钥 | — | `SIGNING_SECRET`（必须设置，生产环境用 `wrangler secret put SIGNING_SECRET`） |
| 站点源（构造登录链接用） | — | `SITE_ORIGIN`（`wrangler.toml` 的 `[vars]` 里） |

生产环境的 `RESEND_API_KEY` / `SIGNING_SECRET` 用 `wrangler secret put <NAME>` 设置
（不要写进 `wrangler.toml`，那是明文提交进 git 的）；GitHub Actions 这边的部署工作流
只负责构建 Astro 站，不涉及 Worker 的密钥。

---

## 8. 全局验收清单（对照 PLAN.md §5，全部已用无头浏览器实测）

- 三断点（1440/1024/375）× 18 个页面无横向滚动；侧栏窄屏变 `<details>` 抽屉后索引仍可达；页脚每页出现；每页恰好一个 `<h1>`。
- 正文对比度 ≥ 7:1，小字元信息 ≥ 4.5:1（脚本核对令牌数值 + Lighthouse 无障碍 100）。
- 侧栏收起刷新后保持；`/now` 默认收起。
- 关掉 JS：Now 的体裁筛选（纯 CSS radio）可用、抽屉可开合、登录/申请表单是可提交的原生 `<form method="post">`。
- 未点击时 Apple Music facade 对 `apple.com` 零请求；点击后注入带 sandbox/allow 属性的 iframe。
- Lighthouse（移动端模拟）：首页 99 / `/now` 98 / 文章页 99 / 诗页 100；`/music` 95、`/photos` 97
  （这两页在真实节流下测，模拟模式在 localhost 上会把恰好在首绘前下载完的字体误算进 FCP）。
  无障碍全部 100，SEO 100，best-practices 96（唯一扣分是预览环境下 `/api/me` 404，部署 Worker 后消失）。
- 未登录访问私密 API 与签名 URL 均 403/404；签名过期即失效；`private` 卷与 `/admin`
  对外一律 404（已用 `wrangler dev` 实测，见下）。

### 字体加载为什么这样安排

- 西文（Spectral / IBM Plex Mono）很小，随 `global.css` 同步加载，报头与元信息用的两个 woff2 在 `<head>` 里 `preload`。
- 中文衬线 Noto Serif SC 的两个字重各有 101 段 unicode-range 的 `@font-face`（合计 ~100KB CSS），
  单独放在 `src/styles/fonts-cjk.css`，由 `BaseLayout` 以 `<link rel="stylesheet" fetchpriority="low">` 挂在 `<body>` 末尾：
  正文先用回退字体首绘，Noto 到了再 swap，零 JS。把它挪回 `<head>` 会让移动端 FCP 从 1.4s 变成 3.5s。
- `body` 用数值 `line-height`（而不是 `normal`），字体换入时行盒高度不变，否则 CLS 会到 0.1 以上。
- Vite 的 `assetsInlineLimit` 设为 0：否则 <4KB 的字体分段会被 base64 内联进 CSS，让所有分段不管用不用都随 CSS 下载。
- 新增一个 Noto 字重 = 多 ~50KB CSS + 多一批字体文件，加之前先想清楚是否真的需要。

Worker 端的安全行为已经在本地用 `wrangler dev` + 本地 D1 完整跑过一遍：
魔术链接登录 → 拿到会话 → group 卷从 403 变 200 → 签名图片 URL 缺签名/签名错误都 403 →
private 卷对 admin 之外的任何人（含已登录成员）恒 404 → 申请访问 → 后台批准 → 立即拿到
签名 URL → 邀请链接注册入组 → 登出后旧 cookie 失效。
