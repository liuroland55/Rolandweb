# CLAUDE.md

本文件是本仓库的硬约束与操作手册。任何改动都不能违反下面「硬约束」一节；
拿不准时，先满足硬约束，再考虑功能需求。

## 硬约束（不可协商）

1. **隐喻是"一份只有一位主编的刊物"**：报头、细线、栏宽、日期倒序。
2. **没有卡片阴影、没有圆角、没有渐变背景色**。`border-radius` 全站为 0（Apple Music iframe 自带圆角除外）。现代感来自**大块反色**与克制的等宽字，不是装饰。
3. **侧边索引栏 + 全站页脚版权页**，每一页都有，不只首页。
4. **一色一栏目**：栏目只覆盖 CSS 变量，报头/栏宽/字号/页边宽度**永不改动**。
5. **私密资源只走 Worker 签名链接**：不进 git、不进构建产物、不进 RSS、不进 sitemap。前端隐藏不算安全措施。
6. **小字对比度**：9–13px 的等宽元信息与页边批注，对比度 ≥ 4.5:1（浅底 ink 不透明度 ≥ .62；反色底 ≥ .62）。正文 ≥ 7:1。
7. **默认零客户端 JS**。允许的 island：
   - 侧栏收起（`rail:collapsed`）
   - Now 无限加载（IntersectionObserver，无 JS 时退化为 `/now/2` 分页链接）
   - Apple Music facade 点击加载
   - 登录 / 申请访问表单（progressive enhancement：原生 `<form method="post">` 可用，JS 只是让体验不刷新页面）
   - 相册页运行时拉取签名 URL（`/photos/[roll]`：页面本身是静态的，只知道卷名/张数/可见范围；真实图片地址必须在运行时向 Worker 请求，因为这是防止签名链接被打进构建产物的唯一方式——参见约束 5。这是登录 island 的自然延伸，不是新增自由度）
   - `/admin`、`/write`、`/join/:token` **不算 island**：它们整体由 Worker 服务端渲染（在自己的 `*.workers.dev` 源上，见「架构备忘」），零客户端 JS，写操作用原生表单 POST。
8. **第三方 iframe 默认不加载**（facade 模式），点击后才注入。

## 设计令牌（`src/styles/global.css`）

`src/styles/global.css` 是唯一的真相来源，组件不写魔法数字、不写 scoped `<style>`，只消费下面这些变量。

```css
:root{
  --paper:#F9F7F1; --paper-panel:#FDFCFA; --paper-cool:#F8F8F6;
  --ink:#14170E; --ink-meta:rgba(20,23,14,.70); --ink-quiet:rgba(20,23,14,.62);
  --accent:oklch(.36 .075 152); --accent-ink:oklch(.34 .07 152);
  --accent-deep:oklch(.21 .05 158); --accent-footer:oklch(.145 .03 158);
  --accent-bright:oklch(.80 .11 152); --accent-wash:oklch(.965 .014 152);
  --rule:oklch(.36 .075 152 / .22);
  --on-deep:#F0F4EB; --on-deep-meta:rgba(240,244,235,.68);
  --serif-latin:'Spectral',Georgia,serif; --serif-cjk:'Noto Serif SC',var(--serif-latin);
  --mono:'IBM Plex Mono',ui-monospace,monospace;
  --rail-w:212px; --rail-w-collapsed:48px; --main-max:1000px; --pad-x:40px; --measure:62ch;
}
```

栏目主题只覆盖颜色类变量（`--paper*`/`--accent*`/`--ink*`），永远不碰 `--rail-w`/`--main-max`/
`--pad-x`/`--measure` 或字号——这是「一色一栏目」硬约束的具体执行方式。

字体：西文随 `global.css` 同步加载；中文 Noto Serif SC 在 `src/styles/fonts-cjk.css`，由 BaseLayout
挂在 `<body>` 末尾异步生效（原因与性能数据见 README §8）。只引入真正用到的字重（300/400 + Mono 600）；
所有文字元素保持数值 `line-height`，不要写 `line-height: normal`，否则字体换入会产生 CLS。五套现成主题：
`poems`（冷白纸+深蓝）、`music`/`admin`（金属黑+条纹+sheen 动效）、`films`（暖褐）、
`photos`（近乎无色）、`essays`/`notes`/`now`（默认绿，不覆盖）。

## 如何加一个新栏目

以新增一个假想栏目 `dreams`（梦记）为例，改动应控制在：

1. `src/content.config.ts`：新增一个 collection 定义（复用通用字段 + 该栏目专属字段），并加入 `export const collections`。
2. `src/styles/global.css`：新增一组 `[data-section="dreams"]{ ... }` 变量覆盖（只覆盖颜色类变量，不动栏宽/字号/页边）。
3. `src/components/layout/Sidebar.astro`：索引列表里加一行链接（名称 + `lib/counts.ts` 里对应的计数字段）。
4. `src/pages/dreams/index.astro`（列表页）+ 如需详情页 `src/pages/dreams/[slug].astro`，复用 `SectionLayout` / `EntryLayout`。
   页面内任何指向本站其他页面的 `href` 都要用 `withBase()`（`src/lib/site.ts`），不要手写 `/xxx`。
5. `src/lib/counts.ts`：加一个计数字段，供侧栏与页脚使用。

不要新增依赖、不要引入 Tailwind/UI 组件库/CSS-in-JS/状态管理库/jQuery。

## 架构备忘

**当前部署形态：github.io 子路径 + 独立 Worker（真正跨源），不是同域名方案。**

- 公开站是 Astro 静态输出，部署在 GitHub Pages 的仓库子路径：`https://liuroland55.github.io/Rolandweb/`
  （仓库因此必须是 Public——免费版 Pages 不支持 Private 仓库）。`astro.config.mjs` 里 `base: '/Rolandweb'`；
  站内任何指向本站页面的链接都必须经过 `src/lib/site.ts` 的 `withBase()`，手写 `href="/xxx"` 不会自动
  加上这个前缀，会在生产环境里变成死链接。RSS/sitemap 的绝对链接也要走 `withBase()` 再拼 `site`。
- 私密相册与友邻权限、创作者界面是 Cloudflare Worker（TypeScript + D1 + R2 + KV），部署在自己的
  `*.workers.dev` 地址上——因为没有自定义域名可以绑定，没法用「Cloudflare Route 分流同一顶级域名」
  那套更省心的方案（那是换了自定义域名之后的升级路径，见 README §7.1）。
  这意味着 Astro 站和 Worker **是两个不同的源**，连带三处必须正确处理的地方：
  1. **`PUBLIC_API_BASE`**：构建时环境变量，值是 Worker 的完整 URL；`src/lib/auth.ts` 的 `apiUrl()`
     所有跨源请求都靠它拼出完整地址。留空 = 同源相对路径，只有换回自定义域名方案时才该留空。
  2. **会话 cookie 用 `SameSite=None; Secure`**（`worker/src/lib/session.ts`）：`SameSite=Lax` 的 cookie
     不会带在跨源 `fetch(..., {credentials:'include'})` 上，友邻登录后在主站会看起来"没登录"。
     本地开发是 http，`None+Secure` 组合不成立，退化成 `Lax`——所以这个跨源会话流程没法在本地
     用真实浏览器测出来，只能上线后测，或者用不强制 Secure 语义的工具（curl/fetch）验证。
  3. **CSRF**：`SameSite=None` 削弱了浏览器默认的 CSRF 防护，靠 `worker/src/lib/csrf.ts` 补上——
     所有 POST 请求都要求 `Origin`（或 `Referer`）等于站点自己的源或 Worker 自己的源，
     在 `worker/src/index.ts` 的路由入口统一拦截，不需要每个路由自己判断。
- `/admin`、`/write`、`/join/:token` 都在 Worker 自己的域名上，服务端渲染，零客户端 JS，写操作走原生
  `<form method="post">`。`/write`（创作者界面，admin 专用）把表单内容经 GitHub Contents API 提交进
  `src/content/`，GitHub token 只存在 Worker Secret 里，永远不进浏览器；提交后 Actions 自动重新部署。
- 本地开发时 Astro 站与 Worker 是两个独立进程（各自的 `npm run dev` / `wrangler dev`）。
- 私密数据永远不进入 Astro 的构建产物：`/photos/[roll]` 页面只包含「卷名/张数/可见范围」等公开元数据，
  真实图片地址（R2 签名 URL）只能在浏览器运行时向 Worker 请求。
