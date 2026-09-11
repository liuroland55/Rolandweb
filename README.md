# 石予的个人网站

一份个人刊物式的网站：文章、诗、笔记、影、乐、照片、Now。

公开部分是 Astro 静态站，部署在 GitHub Pages；私密相册与友邻权限、创作者后台由一个
独立的 Cloudflare Worker（TypeScript + D1 + R2 + KV）承担。硬约束、设计令牌、架构细节
见 [CLAUDE.md](./CLAUDE.md)；完整搭建计划见 [PLAN.md](./PLAN.md)。

## 本地开发

```sh
# 公开站，默认 http://localhost:4321
npm install
npm run dev
```

```sh
# 权限后端，默认 http://127.0.0.1:8787
cd worker
npm install
npm run dev
```

## 技术栈

- [Astro](https://astro.build)（静态输出）+ MDX
- Cloudflare Worker + D1 + R2 + KV
- 无 UI 框架、无 CSS-in-JS，纯手写 CSS 设计令牌

> GitHub Pages 是纯静态的，任何"前端隐藏"都不是安全措施——私密内容必须经 Worker
> 签发的临时链接才能拿到。
