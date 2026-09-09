# 交给 Claude Code 的搭建提示词（分阶段执行版）

> **用法**：在**空目录**里 `git init` 后执行 `claude`，把下面 `═══` 之间的全部内容整段粘贴。
> 它会按 Phase 0 → 8 顺序执行，每个 Phase 结束自检并提交。
> 设计参考（如能读到本仓库外的文件则参考，读不到就完全按本文字描述实现）：`个人网站方案.dc.html` 中的 4a（首页）、4b（Now 瀑布流）、3b（相册权限三态）、3c（后台）、5a/5b（Apple Music 嵌入）。

═══════════════════════════════════════════

你是我的前端与全栈实现者。我们要从零搭建我的个人网站：公开部分是 Astro 静态站部署到 GitHub Pages，私密相册与友邻权限由一个 Cloudflare Worker 承担。

**执行方式（重要）**
- 严格按 Phase 0 → Phase 8 的顺序做，**每个 Phase 做完立刻自检 + `git commit`**，用我给的 commit 信息。
- 每个 Phase 开始前，先用一句话说明你要做什么；结束后列出改动的文件清单与自检结果。
- 遇到本文没写明的细节：**按已有约束自行推导，不要停下来问我**。只有当推导会破坏「§2 硬约束」时才提问。
- 不要引入本文未列出的依赖。不要 Tailwind、不要 UI 组件库、不要 CSS-in-JS、不要状态管理库、不要 jQuery。
- 所有代码注释与 README 用中文；变量名、文件名用英文。

---

## §1 项目背景（决定内容模型，先读完再动手）

我：学生。写哲学随笔与诗；弹电吉他，听后朋、金属、古典；写代码并整理学习笔记；给朋友拍照。

我的更新习惯是**高频短更、随手就发**。所以：
- 发布一条内容必须 ≤ 3 步（新建 md → 写 → push）。
- 站点要能同时容纳「一句话」和「四千字」，不能只为长文设计。
- 网站是中英双语：导航/元信息/页脚双语，正文按写作语言排（多为中文）。

## §2 硬约束（写进 `CLAUDE.md`，之后每次改动都要遵守）

1. **隐喻是"一份只有一位主编的刊物"**：报头、细线、栏宽、日期倒序。
2. **没有卡片阴影、没有圆角、没有渐变背景色**。`border-radius` 全站为 0（Apple Music iframe 自带圆角除外）。现代感来自**大块反色**与克制的等宽字，不是装饰。
3. **侧边索引栏 + 全站页脚版权页**，每一页都有，不只首页。
4. **一色一栏目**：栏目只覆盖 CSS 变量，报头/栏宽/字号/页边宽度**永不改动**。
5. **私密资源只走 Worker 签名链接**：不进 git、不进构建产物、不进 RSS、不进 sitemap。前端隐藏不算安全措施。
6. **小字对比度**：9–13px 的等宽元信息与页边批注，对比度 ≥ 4.5:1（浅底 ink 不透明度 ≥ .62；反色底 ≥ .62）。正文 ≥ 7:1。
7. **默认零客户端 JS**。只有这四处允许 island：侧栏收起、Now 无限加载、Apple Music facade 点击加载、登录/申请表单。能用 `<details>`/CSS 就不写 JS。
8. **第三方 iframe 默认不加载**（facade 模式），点击后才注入。

## §3 技术栈（不要替换）

**公开站（仓库根）**
- Astro 5 + content collections（`src/content/`），MD/MDX。输出 `static`。
- 原生 CSS + 自定义属性，单一 `src/styles/global.css`。
- 字体自托管：`@fontsource/spectral`（西文衬线）、`@fontsource/noto-serif-sc`（中文衬线，按需子集）、`@fontsource/ibm-plex-mono`（元信息/数字）。`font-display: swap`。
- `@astrojs/sitemap`、`@astrojs/rss`、`@astrojs/mdx`。
- 部署：GitHub Actions → GitHub Pages。

**权限后端（`worker/`，同一仓库不同目录）**
- Cloudflare Worker（TypeScript，`wrangler`）+ **D1**（用户/分组/相册权限/申请/邀请）+ **R2**（原图）+ **KV**（会话）。
- 登录：**邮箱魔术链接**（无密码）+ **一次性邀请链接**。不要 OAuth、不要密码、不要第三方登录。
- 邮件发送：抽象成 `sendMail()`，默认实现走 Resend HTTP API，key 从环境变量读；提供 `console` 兜底实现供本地开发。

---

## Phase 0 — 脚手架与目录

1. `npm create astro@latest .`（TypeScript strict、空模板），加 `@astrojs/mdx`、`@astrojs/sitemap`、`@astrojs/rss`、上述 fontsource 包。
2. `astro.config.mjs`：`output: 'static'`，`site: 'https://shiyu.me'`（占位，写进注释说明如何改），`base: '/'`，集成 mdx + sitemap（`filter` 排除 `/admin`、`/photos/` 下私密卷、`/403`）。
3. 建立目录：

```
src/
  components/   layout/(Sidebar SiteFooter Masthead)  content/(EntryMeta Marginalia PhotoGrid AppleMusic NowCard)  ui/(Tag Button InlineNav)
  layouts/      BaseLayout.astro  SectionLayout.astro  EntryLayout.astro
  content/      essays/ poems/ notes/ music/ films/ photos/ pages/
  lib/          format.ts(相对时间/字数/日期)  counts.ts(全站计数)  auth.ts(读会话、判分组)
  styles/       global.css
worker/         src/index.ts  src/routes/*  src/db/schema.sql  wrangler.toml  .dev.vars.example
.github/workflows/deploy.yml
CLAUDE.md  README.md
```

4. 写 `CLAUDE.md`：把 §2 全文抄进去，加一节「如何加一个新栏目」。
5. **自检**：`npm run dev` 起得来，空页面无报错。
6. `git commit -m "chore: astro 脚手架与目录结构"`

---

## Phase 1 — 设计系统（`global.css`）

先把视觉系统落成变量，后面所有页面只消费变量。

### 1.1 令牌

```css
:root{
  /* 纸与墨：暖柔白 */
  --paper:        #F9F7F1;   /* 页面底 */
  --paper-panel:  #FDFCFA;   /* 内页块底 */
  --paper-cool:   #F8F8F6;   /* 诗歌页专用，略偏冷 */
  --ink:          #14170E;
  --ink-meta:     rgba(20,23,14,.70);  /* 等宽元信息，勿更浅 */
  --ink-quiet:    rgba(20,23,14,.62);  /* 页边批注下限 */

  /* 绿：深邃 */
  --accent:        oklch(.36 .075 152);  /* 细线、标签描边、强调字 */
  --accent-ink:    oklch(.34 .07 152);   /* 浅底上的绿色小字 */
  --accent-deep:   oklch(.21 .05 158);   /* 反色底：侧栏、头条块、按钮 */
  --accent-footer: oklch(.145 .03 158);  /* 页脚 */
  --accent-bright: oklch(.80 .11 152);   /* 反色底上的强调/计数 */
  --accent-wash:   oklch(.965 .014 152); /* 短笔记淡底 */
  --rule:          oklch(.36 .075 152 / .22);

  /* 反色底上的字 */
  --on-deep:       #F0F4EB;
  --on-deep-meta:  rgba(240,244,235,.68);

  /* 排版 */
  --serif-latin: 'Spectral', Georgia, serif;
  --serif-cjk:   'Noto Serif SC', var(--serif-latin);
  --mono:        'IBM Plex Mono', ui-monospace, monospace;

  /* 尺寸 */
  --rail-w: 212px;      /* 侧栏展开 */
  --rail-w-collapsed: 48px;
  --main-max: 1000px;
  --pad-x: 40px;        /* 主栏左右内边距 */
  --measure: 62ch;      /* 正文最大宽度 */
}
```

### 1.2 栏目主题

用 `<body data-section="essays|poems|notes|music|films|photos|now|admin">` + 属性选择器覆盖：

| section | 覆盖 | 说明 |
|---|---|---|
| `essays`/`notes`/`now` | 默认绿 | 头条 = 整块 `--accent-deep` 反色；短笔记 = `--accent-wash` 底 + 3px 左竖线。 |
| `poems` | `--paper: var(--paper-cool)`；`--accent-deep: oklch(.24 .07 252)`；`--accent-bright: oklch(.82 .09 250)`；`--accent-ink: oklch(.35 .07 252)` | 诗块可整块深蓝反色；行距 2.05+；**不给标签**，只给稿次。 |
| `music`/`admin` | `--paper: linear-gradient(180deg,#131412,#0e0f0d)`；`--ink: #ECEEE8`；`--ink-meta: rgba(236,238,232,.68)`；`--rule: rgba(236,238,232,.14)`；`--accent-bright: oklch(.72 .1 152)` | 金属感 = 覆盖一层 `repeating-linear-gradient(90deg, rgba(236,238,232,.13) 0 1px, transparent 1px 5px)` 的 `::before`（`pointer-events:none`）；栏目大标题一道 9s 移动高光（`background-clip:text` + `@keyframes sheen`）。绿只用于评分、主按钮、「允许」。 |
| `films` | `--accent-deep: oklch(.30 .06 60)`；`--accent-ink: oklch(.38 .07 60)` | 白纸 + 暖褐。 |
| `photos` | `--accent-ink: oklch(.36 .01 150)` | 近乎无色，让照片出声；权限状态用绿/深绿反色表达。 |

### 1.3 基础样式

- 报头 `.masthead`：刊名 40px `--serif-latin` 300；右侧期号/日期 10px `--mono`；下方 2px `--accent-deep` 实线。
- 页边栅格 `.entry`（内容页共用）：`grid-template-columns: 106px minmax(0,1fr) 164px; gap: 26px`。左页边 = 日期/体裁/字数（10px mono，右对齐）；中 = 正文（`--serif-cjk` 300，15.5px/1.95）；右页边 = 批注（`--serif-latin` italic 13px/1.7，左侧 2px 竖线）。
- `< 900px`：`.entry` 塌为一栏，左页边变正文上方一行元信息；批注**内联**在其锚点段落之后（保留竖线与斜体，缩进 1em），**不要**做成折叠面板。
- 占位图：`repeating-linear-gradient(135deg,#D6D2C6 0 6px,#E4E0D4 6px 12px)`（深色页用 `rgba(236,238,232,.30)/.16`）+ 左下角 9.5px mono 说明文字。
- `a` 与 `a:hover` 必须显式定义：`color: var(--accent-ink)` / hover `color: var(--accent-deep)`；反色底上 `color: var(--accent-bright)`。
- `@media (prefers-reduced-motion: reduce)`：关闭 sheen、caret 闪烁、所有 transition。
- 深色模式 `@media (prefers-color-scheme: dark)`：白纸栏目反相为 `--paper: oklch(.17 .008 60)`，`--ink: #ECEEE8`，绿提亮到 `oklch(.62 .1 152)`；`music`/`admin` 不变。

**自检**：写一个 `/styleguide`（`draft`，不进 sitemap）把令牌、报头、页边栅格、五种栏目主题各渲染一遍；用 devtools 量三处小字对比度 ≥ 4.5:1。
`git commit -m "feat: 设计系统与栏目主题变量"`

---

## Phase 2 — 骨架组件（侧栏 + 页脚 + 布局）

### 2.1 `Sidebar.astro`（212px，`--accent-deep` 反色）

自上而下：
1. 站名「石予」（22px Spectral）+ 右侧 `‹` 收起按钮（22px 描边方块）。下方 1px 分隔线。
2. 小标题 `索引 · INDEX`（9.5px mono，`letter-spacing:.16em`，`--on-deep-meta`）。
3. 索引列表：全部 / 文章 / 诗 / 笔记 / 乐 / 影 / 照片，每项左为 15px `--serif-cjk` 名称、右为 10.5px mono **条目计数**（由 `lib/counts.ts` 在构建时算出）。当前项为**反白实底**（底 `--on-deep`、字 `--accent-deep`）。「诗」名称用 `oklch(.84 .07 250)` 着色，暗示其体温。
4. 分隔线后一项 **Now**：名称后跟 9.5px mono「瀑布流」（`--accent-bright`），右侧是亮绿实底的「N 新」计数徽标（`--accent-bright` 底、`--accent-deep` 字）。整行淡底 `rgba(240,244,235,.07)`。
5. `margin-top:auto` 的登录区：已登录 = 26px 方形首字母头像（亮绿底）+ 昵称 + 10px「好友组 · 可见 N 卷私相册」；未登录 = 「友邻登录 →」。

**收起态**（48px 竖条）：只留 `›`、竖排站名/栏目名（`writing-mode: vertical-rl`，`letter-spacing:.28em`）、竖排总计数、底部头像。状态存 `localStorage` 键 `rail:collapsed`，并用内联脚本在 `<head>` 里提前应用以避免闪烁。**进入 `/now` 时默认收起**（把宽度让给瀑布流）。
`< 900px`：变为顶部抽屉（`<details>` 实现，无 JS）。

### 2.2 `SiteFooter.astro`（`--accent-footer` 反色，每页都有）

- 小标题 `版权页 · COLOPHON & INDEX`（9.5px mono，`--accent-bright`，下方 1px 线）。
- 四栏 `grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 30px`：
  1. 自述一段（13.5px `--serif-cjk`）+ 10px mono「本站用 Astro 生成，托管于 GitHub Pages / 正文 CC BY-NC 4.0 · 照片保留所有权利」。
  2. **全站索引**：文章 38 / 诗 61 / 笔记 246 / 乐 16 · 影 9 / 照片 51（含私相册 7）——全部由 `counts.ts` 实算。
  3. **归档**：按年份计数 + 「全部年份 →」。
  4. **联络与订阅**：邮箱 / github / rateyourmusic / RSS（`--accent-bright`）/ 友邻登录 →。
- `< 700px`：四栏变一栏；索引与归档改为横向 flex-wrap 的小字行。

### 2.3 布局

- `BaseLayout.astro`：`grid-template-columns: var(--rail-w) minmax(0,1fr)`，收起时第一列 48px；主栏 `max-width: var(--main-max)`；页脚跨整宽置于最底。接收 `section` 属性写到 `<body data-section>`。
- `SectionLayout.astro`：报头 + 可选筛选行 + 内容 slot。
- `EntryLayout.astro`：报头 + `.entry` 页边栅格 + 上下篇导航。

**自检**：三个断点（1440 / 1024 / 375）下无横向滚动；每页都有页脚；收起态刷新后保持。
`git commit -m "feat: 侧栏索引、全站页脚版权页与布局"`

---

## Phase 3 — 内容模型与示例内容

`src/content/config.ts` 用 zod 定义。通用字段：`title, title_en?, date, updated?, draft?, tags?, lang?, notes?: {text, date?}[]`（`notes` 即右页边批注；MDX 里也支持 `<Marginalia date="09.08">…</Marginalia>`）。

```ts
essays: 通用 + { summary?, hero?: 'inverted' | 'plain' }        // inverted = 首页头条整块反色
poems:  通用 + { version?: string, previous?: string }           // 稿次 / 上一稿全文；禁用 tags
notes:  通用 + { promote_to?: string }                           // 短笔记 → 指向某篇 essay 的 slug
music:  通用 + {
          items?: { album, artist, year, rating: 0..5, comment? }[],
          own_recording?: { title, file, duration, note? },
          apple_music?: { kind: 'song'|'album'|'playlist', id: string, i?: string,
                          slug?: string, storefront?: string, title, artist?, year? }
        }
films:  通用 + { items: { title, year, director?, rating, comment? }[] }
photos: 通用 + {
          roll: string, film_stock?, shot_at: date, count: number, cover?,
          visibility: 'public' | 'group' | 'private',
          groups?: string[],            // visibility==='group' 时生效
          download?: { size: string },  // 真实链接由 Worker 签发，不写进 md
          friend_note?: string          // 右页边给朋友的一句话
        }
now:    通用 + { kind: '句子'|'诗行'|'听到'|'拍到'|'代码'|'书摘', body, ref?, media?, apple_music?, visibility? }
```

**示例内容（用我的口吻，每类 ≥ 2 条，禁止 Lorem ipsum）**
- essays：《工具、乐器与手：论一件东西如何变成身体的一部分》（`hero: inverted`，带 2 条批注）+ 一篇关于笔记方法的短文。
- poems：《脚手架上的晚祷》（第三稿，`previous` 存第二稿，批注写"第二稿末句是'等它砸下来'，太狠了"）+ 《给失真踏板的十四行》。
- notes：「Rust 的所有权其实是一种语法化的礼貌：谁负责，谁善后。」「失真不是噪音，是把一个音的内部展开给你听。」（后者 `promote_to` 指向那篇 essay）
- music：第 36 周听录（Closer / Blackwater Park / Goldberg Variations 1955 / Spiderland 四条含评分与短评）+ 一条带 `apple_music` 歌单与 `own_recording`（Disorder 吉他改编 02:41）。
- films：任意两部，带一句短评。
- photos：`排练室 · 400TX`（public，36 张）、`生日 · 2026.06`（group，`groups:['好友组']`，24 张）、`南方，某个夏天`（group，`groups:['南方组']`，18 张）、`未整理`（private）。
- now：≥ 9 条，覆盖全部 6 种 kind，时间跨度从「7 分钟前」到「3 天前」。

`lib/counts.ts` 在构建时统计各栏目条数、按年份归档数、照片总数与私相册数，供侧栏与页脚使用。

**自检**：`astro check` 通过；schema 报错信息可读。
`git commit -m "feat: 内容模型与示例内容"`

---

## Phase 4 — 公开页面

### 4.1 首页 `/`（照 4a）
自上而下：报头（刊名「边注 Marginalia」+ 期号/日期）→ **头条整块 `--accent-deep` 反色**（体裁·日期小标签用 `--accent-bright`；31px 标题；摘要；右侧 172px 的 mono 元信息列：字数/阅读时间/标签/「批注 N 条」）→ 两列并排（左：诗块深蓝反色，含稿次与三行诗；右：听录块金属黑 + 1px 条纹覆盖 + 四行专辑评分）→ 照片条（一行细线标题 + 5 格 `1/1.2` 网格，最后一格是 `--accent-deep` 实底的「+32 整卷」）→ 两列短笔记（`--accent-wash` 底 + 3px 左竖线）。

### 4.2 Now `/now`（照 4b）
- 进入即侧栏收起（48px 竖条）。
- 报头「此刻 Now」+ 右侧 mono「12 条新 · 今日 5 / 倒序 · 滚动加载」。
- 其下**固定状态块**：`--accent-deep` 反色，一段近况 + 右侧「固定状态 / 更新于 N 天前」+ 闪烁光标（`@keyframes caret`，1.1s steps(1)）。
- 体裁筛选行：一排 10px mono 小标签，「全部」为实底，其余为描边。
- **瀑布流**：`column-count: 3; column-gap: 14px`，卡片 `break-inside: avoid; margin-bottom: 14px`。`< 1100px` 两列，`< 700px` 一列。卡片按 kind 变体：
  - 句子/书摘：`--paper-panel` 底 + 细描边，kind·相对时间小标签，14.5px 正文；书摘带出处行。
  - 诗行草稿：整块深蓝反色，行距 2.1，底部「→ 可能收进《…》」。
  - 听到：金属黑 + 条纹 + 曲名（15px Spectral）+ 「第 N 遍」+ 26px 条纹波形；若有 `apple_music` 则用 Phase 6 的 facade 卡。
  - 拍到：满宽占位图（`4/5` 或 `1/1`）+ 下方 kind·时间行；私密卷额外标「仅好友」。
  - 代码：`--accent-wash` 底 + 3px 左竖线 + `<pre>` 11.5px mono（`white-space: pre-wrap`）。
  - 短笔记攒够 3 条时显示「↑ 攒到第 3 条，可升级成文章」（`--accent-ink`）。
- 底部「继续加载 · 还有 N 条」：首屏渲染前 30 条，其余按 30 条一页，用最小的 island（IntersectionObserver）追加；**无 JS 时退化为分页链接** `/now/2`。
- 相对时间由 `lib/format.ts` 计算，`<time datetime>` 保留绝对值。

### 4.3 其余栏目
- `/essays` 列表：页边栅格，一条一行（左页边日期/体裁/字数，中标题+摘要，右批注）。`/essays/[slug]` 用 `EntryLayout`。
- `/poems` 与 `/poems/[slug]`：`--paper-cool`，行距 2.25，左页边只给日期与稿次；`previous` 用 `<details>` 展开上一稿（不要弹层）。
- `/notes`：只有流，无详情页；`promote_to` 显示「已升级为《…》」。
- `/music`、`/films`：按年份/周次分组；music 页整页金属黑。
- `/photos`、`/photos/[roll]`：Phase 7 处理权限三态。
- `/now`、`/about`（版权页式自我介绍全页版）、`/archive`（按年份纯文本索引，一屏看完 400+ 条）、`/tags/[tag]`。
- `/feed.xml`（全栏目合流）+ 各栏目 feed；`/sitemap-index.xml`；`/404`；`/403`（「这卷还没对你打开」+ 申请入口）。

**自检**：每页三断点无溢出；关掉 CSS 后每页仍是语义正确、可读的文档（h1 唯一、时间用 `<time>`、图片有 alt）。
`git commit -m "feat: 首页、Now 瀑布流与各栏目页面"`

---

## Phase 5 — 部署（先通链路，再做后端）

1. `.github/workflows/deploy.yml`：`actions/checkout` → `withastro/action`（或手写 node20 + `npm ci && npm run build`）→ `actions/deploy-pages`。触发：push 到 `main` + `workflow_dispatch`。
2. `public/CNAME` 占位 + README 写清自定义域名与 `site`/`base` 的改法（含仓库子路径部署的注意点）。
3. `public/robots.txt`：允许全站，但 `Disallow: /admin`。

**自检**：本地 `npm run build && npx astro preview` 无警告；说明清楚首次启用 Pages 的手动步骤。
`git commit -m "ci: GitHub Actions 部署到 Pages"`

---

## Phase 6 — Apple Music 嵌入（照 5a / 5b）

组件 `AppleMusic.astro`（MDX 可用：`<AppleMusic kind="song" id="1441163490" i="1441163494" title="Disorder" artist="Joy Division" year="1979" />`）。

1. **URL 规则**：`https://embed.music.apple.com/{storefront}/{kind}/{slug}/{id}`，单曲追加 `?i={i}`；深色页面追加 `theme=dark`。`storefront` 默认 `us`，可配 `cn`。
2. **iframe 属性**（照抄）：
   `allow="autoplay *; encrypted-media *;"`、`loading="lazy"`、
   `sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"`、
   `style="width:100%;border:0;overflow:hidden;background:transparent;display:block"`。
   高度：`song` 175px，`album`/`playlist` 420–450px。
3. **facade 模式（硬要求）**：默认**不输出 iframe**。先渲染我自己的静态卡：64px 条纹封面占位 + 曲名（15px Spectral）+ 艺人·专辑·年份（10.5px mono）+ 34px `--accent-deep` 实底 ▶ 按钮 + 8.5px「点击加载」；点击后再注入 iframe（一个极小的 inline island）。未点击前**零请求、不落第三方 cookie**。
4. **外框**：深色页用 1px 明暗条纹外框 + `theme=dark`；白纸页用细描边 + 浅色播放器。外框下一行 9.5px mono 标注来源与「在 Apple Music 打开 →」。**不要试图改播放器内部**（Apple 只给浅/深两套、字体锁定）——把它当"引文"框起来。
5. **降级**：`prefers-reduced-data`、无网络、iframe 被拦时保持占位卡，绝不出现空白 iframe。
6. 预留 `provider: 'apple' | 'spotify' | 'bandcamp'`，后两者只需加一个 URL 模板。

**自检**：首页与 `/music` 的 Network 面板在未点击时对 `apple.com` 零请求；点击后播放器出现；`/music` 页外框与页面缝合无缝。
`git commit -m "feat: Apple Music facade 嵌入组件"`

---

## Phase 7 — 权限系统（Worker + D1 + R2 + KV）

### 7.1 数据表（`worker/src/db/schema.sql`）

```sql
users(id, email UNIQUE, nickname, role TEXT CHECK(role IN ('admin','member')), created_at, last_login_at)
groups(id, name UNIQUE, created_at)
user_groups(user_id, group_id, PRIMARY KEY(user_id, group_id))
albums(roll TEXT PRIMARY KEY, visibility TEXT CHECK(visibility IN ('public','group','private')), r2_prefix, count)
album_groups(roll, group_id, PRIMARY KEY(roll, group_id))
invites(token PRIMARY KEY, group_id, expires_at, max_uses, used_count, created_by, revoked_at)
requests(id, roll, email, message, status TEXT CHECK(status IN ('pending','approved','rejected')), created_at)
magic_links(token PRIMARY KEY, email, expires_at, used_at)
```

### 7.2 接口

```
POST /api/login            { email } → 发魔术链接（10 分钟有效、一次性）；无论邮箱是否存在都返回同样的成功响应
GET  /api/callback?token   → 建会话，写 KV，设 cookie，302 回站点
POST /api/logout
GET  /api/me               → { nickname, groups[], visible_rolls[] }（未登录返回 anon）
GET  /api/album/:roll      → 有权：{ images:[{signed_url, w, h, caption}], download:{signed_url, expires_at} }；无权：403
GET  /api/download/:roll   → 302 到 R2 预签名 zip（30 天）
POST /api/request-access    { roll, email, message } → 写 requests
GET  /join/:token          → 校验邀请（未过期、未吊销、used_count < max_uses）→ 落地页数据
POST /api/join/:token       { email, nickname } → 建用户、入组、used_count+1、直接建会话
—— 以下需 role=admin ——
GET/POST/PATCH /api/admin/users | groups | albums | invites | requests
```

**安全细节**：会话 cookie `HttpOnly; Secure; SameSite=Lax`，30 天滚动续期，值只是 KV 的随机 key。图片预签名 URL 15 分钟、打包 zip 30 天。所有 403 不透露资源是否存在（`private` 卷对非 admin 一律 404）。魔术链接与邀请 token 用 `crypto.getRandomValues` 生成 ≥ 128bit。登录接口按 IP + 邮箱做速率限制（KV 计数）。

### 7.3 前端权限三态（照 3b，`/photos`）

页头右上角显示登录态徽标（20px 亮绿方形首字母 + 「阿May · 好友组」，`--accent-wash` 底）。每卷三态：
1. **public**：正常网格（`repeat(auto-fill, minmax(220px,1fr))`，`aspect-ratio: 3/2`，`loading="lazy"` + `srcset`）+ 「N 张 · 打包下载 218MB」。右上角描边标签「公开」。
2. **group 且有权**：整块 `--accent-deep` 反色；右上角**亮绿实底**标签「已解锁 · 好友组」；底部「24 张 · 链接 30 天后失效」+ 描边按钮「下载原图 ↓」。
3. **group 且无权**：白底细描边的"闭卷"；占位块加 `filter: blur(1.5px)`；描边标签「未开放」；一行「18 张 · 仅「南方组」可见」；右侧 `--accent-deep` 实底按钮「申请查看 →」（可填附言，POST 到 `/api/request-access`）。
`private` 对非 admin 完全不出现在列表、sitemap、RSS 中。

页面本身仍是静态的：只知道「这卷存在、几张、属于哪个组」；缩略图与原图 URL 全部由 Worker 在运行时下发，**无权用户拿到的是条纹占位块（服务端决定，不是 CSS 遮挡）**。

### 7.4 登录与邀请页
- `/login`：一个邮箱输入框 + 「我会给你发一条一次性链接」+ 提交后的空状态说明。零装饰。
- `/join/[token]`：显示将加入的分组与可解锁的卷名、有效期，一键接受（填昵称）。token 无效/过期显示克制的说明与联系入口。

**自检**：`wrangler dev` + 本地 D1 迁移可跑通「发链接 → 登录 → 拿签名 URL → 过期失效」；未登录访问私密 API 全 403；`/admin` 对非 admin 返回 404。
`git commit -m "feat: 友邻权限（Worker + D1 + R2 签名链接）"`

---

## Phase 8 — 管理后台 `/admin`（照 3c，金属黑反色）

仅 `role=admin` 可见（非 admin 一律 404）。同一套等宽字与栅格，纸变黑。

1. 顶部 4px 条纹装饰条 + 报头「后台 · 友邻 / Admin / access control · 14 人 · 4 组」+ 右上两个按钮（描边「导出名单」、亮绿实底「＋ 生成邀请链接」）。
2. **统计四块**：好友组 8 / 南方组 4 / 家人 2 / **待处理申请 3**（最后一块 `--accent-bright` 实底、深色字）。数字用 26px Spectral 300。
3. **用户表**：`grid-template-columns: 1.3fr 1fr 1.5fr .9fr .8fr`，表头 9.5px mono 大写；每行 = 24px 方形首字母头像 + 昵称/邮箱两行、分组标签（描边；好友组用绿色描边）、可见相册（11px mono）、最近登录、操作「编辑」。**申请中的行**用 `rgba(236,238,232,.045)` 淡底高亮，操作变为亮绿实底「允许」+ 描边「拒绝」，邮箱后附申请附言。
4. **邀请链接卡**：URL（`word-break: break-all`）+ 「→ 南方组 · 30 天后失效 · 已用 1/5」+ 「复制 / 吊销」。
5. **相册可见性卡**：每卷一行，右侧当前可见范围（公开 / 组名 / 仅我），可直接改；改动即时写 D1。
6. 所有写操作走 `<form method="post">` + Worker，失败有可读错误；不要乐观 UI。

**自检**：以 admin 与 member 两种身份各跑一遍；member 访问 `/admin` 得 404；批准申请后该用户立即能拿到签名 URL。
`git commit -m "feat: 管理后台（用户/分组/邀请/相册可见性）"`

---

## §4 文档（最后一并写）

`README.md` 必须包含，每节都给可复制的命令或 diff：
1. 本地开发（站点 + Worker 两条命令）。
2. **发一篇内容**：三步以内，含各栏目 frontmatter 最小示例。
3. **加一个新栏目**（要给出真实 diff：`config.ts` 一段 schema + 侧栏一行 + `global.css` 一组 `[data-section]` 变量 + 一个 `pages/x/index.astro`）。
4. **换栏目配色**（只改变量表）。
5. **加一个朋友**：生成邀请链接 → 选分组 → 设相册可见性 → 发给对方。
6. **加一张 Apple Music 嵌入**（含从 Apple Music 复制链接里取 `kind/id/i` 的方法）。
7. 自定义域名与 Cloudflare 绑定；环境变量清单（`.dev.vars.example` 与 GitHub Secrets 一一对应）。
8. 一句醒目的说明：GitHub Pages 是纯静态，任何前端隐藏都不是安全措施——私密内容必须经 Worker。

`CLAUDE.md`：§2 硬约束全文 + Phase 1 的令牌表 + 「加新栏目」清单。

## §5 全局验收（最后统一跑一遍并报告结果）

- 1440 / 1024 / 375px 下所有页面无横向滚动；侧栏在窄屏变抽屉后索引仍可达；页脚在每一页出现。
- 正文对比度 ≥ 7:1；9–13px 元信息与页边批注 ≥ 4.5:1（包含 music、admin、所有反色块）。
- 关掉 CSS 后每页仍是语义正确、可读的文档；关掉 JS 后 Now 可分页浏览、表单可提交、侧栏可用。
- 未点击时对 `apple.com` 零请求。
- 未登录访问私密 API 与签名 URL 均 403；签名过期即失效；`private` 卷与 `/admin` 对外返回 404。
- Lighthouse（首页与 `/now`）性能与可访问性 ≥ 95。
- 最后**实际演示一次**「新增虚构栏目 `/dreams`」的完整 diff（≤ 2 个文件 + 1 组 CSS 变量 + 侧栏一行），确认改动量后**回滚**该提交。

═══════════════════════════════════════════
