// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// 当前部署在 GitHub Pages 的仓库子路径（没有自定义域名）：base 必须是仓库名，
// 且仓库必须是 Public（免费版 Pages 不支持 Private 仓库）。
// 换回自定义域名时：site 改成真实域名、base 改回 '/'，加回 public/CNAME——
// 站内链接不用动，因为它们都走 src/lib/site.ts 的 withBase()，会自动变回不加前缀。
export default defineConfig({
  site: 'https://liuroland55.github.io/Rolandweb',
  base: '/Rolandweb',
  output: 'static',
  vite: {
    build: {
      // 不要把小字体文件 base64 内联进 CSS：Noto Serif SC 有上百个 unicode-range 分段，
      // 小分段一旦内联，就会让所有分段不管用不用都随 CSS 下载，样式表体积翻倍。
      assetsInlineLimit: 0,
    },
  },
  integrations: [
    mdx(),
    sitemap({
      // /admin 不是 Astro 路由（由 Worker 服务端渲染，见 CLAUDE.md 架构备忘），这里排除是防御性的。
      // 私密相册（visibility: private）本来就没有对应的静态页面（getStaticPaths 里过滤掉了），
      // 不需要在这里再按卷名排除一遍——不存在的页面自然不会出现在 sitemap 里。
      filter: (page) =>
        !page.includes('/admin') &&
        !page.endsWith('/403') &&
        !page.endsWith('/403/') &&
        !page.endsWith('/styleguide') &&
        !page.endsWith('/styleguide/'),
    }),
  ],
});
