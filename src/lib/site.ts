// github.io 子路径部署（base: '/Rolandweb'）下，站内绝对路径不会自动带上这个前缀——
// Astro 只会给它自己生成的资源（JS/CSS 等）加前缀，模板里手写的 href="/xxx" 不会变。
// 所以站内所有指向本站页面的链接都要经过这个函数。指向 Worker 的链接（apiUrl()）
// 是完全不同的源，不用也不能经过这里。
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function withBase(path: string): string {
  return `${BASE}${path}`;
}
