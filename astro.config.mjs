// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// 部署到自定义域名时：把 site 换成实际域名（如 https://example.com）。
// 若部署到 GitHub Pages 的仓库子路径（即未绑定自定义域名），需同时把 base 改为 '/<repo-name>/'，
// 并保证站内所有内部链接都使用 Astro 提供的 base-aware 方式（相对路径或 import.meta.env.BASE_URL）。
export default defineConfig({
  site: 'https://shiyu.me',
  base: '/',
  output: 'static',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/admin') &&
        !page.includes('/photos/') &&
        !page.endsWith('/403') &&
        !page.endsWith('/403/'),
    }),
  ],
});
