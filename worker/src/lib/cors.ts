// 生产环境里 Astro 站和 Worker 走同一个顶级域名（Cloudflare Route 分流，见 CLAUDE.md），
// 本来不需要 CORS。这里只是为了本地开发方便：Astro dev server 和 wrangler dev 是两个端口，
// 严格匹配允许的来源，不做成通配符。
import type { Env } from '../env';

const DEV_ORIGINS = ['http://localhost:4321', 'http://127.0.0.1:4321'];

export function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin');
  if (!origin) return {};
  const allowed = origin === env.SITE_ORIGIN || DEV_ORIGINS.includes(origin);
  if (!allowed) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}
