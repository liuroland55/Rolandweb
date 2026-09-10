// 站点部署在 github.io 子路径（没有自定义域名可绑），Worker 只能在 *.workers.dev 上，
// 两者是真正跨源的关系，这里的 CORS 不是可选项。
// SITE_ORIGIN 这个环境变量本身带路径（"https://liuroland55.github.io/Rolandweb"，
// 构造重定向 URL 时要用完整形式），但浏览器发来的 Origin 请求头永远只有 scheme+host+port、
// 不带路径——直接用 === 比较必然失败，所以要先用 new URL().origin 把路径去掉。
import type { Env } from '../env';

const DEV_ORIGINS = ['http://localhost:4321', 'http://127.0.0.1:4321'];

export function siteOrigin(env: Env): string {
  return new URL(env.SITE_ORIGIN).origin;
}

export function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin');
  if (!origin) return {};
  const allowed = origin === siteOrigin(env) || DEV_ORIGINS.includes(origin);
  if (!allowed) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}
