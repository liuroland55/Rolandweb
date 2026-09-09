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
   - `/admin` **不算 island**：它整体由 Worker 服务端渲染（同一顶级域名下 Cloudflare 路由把 `/admin*` 与 `/api/*` 分流给 Worker，其余走 GitHub Pages 静态源），零客户端 JS，写操作用原生表单 POST。
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
`--pad-x`/`--measure` 或字号——这是「一色一栏目」硬约束的具体执行方式。五套现成主题：
`poems`（冷白纸+深蓝）、`music`/`admin`（金属黑+条纹+sheen 动效）、`films`（暖褐）、
`photos`（近乎无色）、`essays`/`notes`/`now`（默认绿，不覆盖）。

## 如何加一个新栏目

以新增一个假想栏目 `dreams`（梦记）为例，改动应控制在：

1. `src/content.config.ts`：新增一个 collection 定义（复用通用字段 + 该栏目专属字段），并加入 `export const collections`。
2. `src/styles/global.css`：新增一组 `[data-section="dreams"]{ ... }` 变量覆盖（只覆盖颜色类变量，不动栏宽/字号/页边）。
3. `src/components/layout/Sidebar.astro`：索引列表里加一行链接（名称 + `lib/counts.ts` 里对应的计数字段）。
4. `src/pages/dreams/index.astro`（列表页）+ 如需详情页 `src/pages/dreams/[slug].astro`，复用 `SectionLayout` / `EntryLayout`。
5. `src/lib/counts.ts`：加一个计数字段，供侧栏与页脚使用。

不要新增依赖、不要引入 Tailwind/UI 组件库/CSS-in-JS/状态管理库/jQuery。

## 架构备忘

- 公开站是 Astro 静态输出，部署到 GitHub Pages。
- 私密相册与友邻权限是 Cloudflare Worker（TypeScript + D1 + R2 + KV），与 Astro 静态站共用同一顶级域名：
  域名 DNS 经 Cloudflare 代理，Worker Route 拦截 `/api/*`、`/admin*`、`/login`、`/join/*`（回调/表单提交所需的服务端逻辑），
  其余路径回落到 GitHub Pages 静态源。本地开发时 Astro 站与 Worker 是两个独立进程（各自的 `npm run dev` / `wrangler dev`）。
- 私密数据永远不进入 Astro 的构建产物：`/photos/[roll]` 页面只包含「卷名/张数/可见范围」等公开元数据，
  真实图片地址（R2 签名 URL）只能在浏览器运行时向 Worker 请求。
