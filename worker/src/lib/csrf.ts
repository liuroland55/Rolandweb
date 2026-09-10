// 站点和 Worker 是跨源部署，会话 cookie 因此必须是 SameSite=None（见 session.ts 的注释），
// 这天然弱化了浏览器对 CSRF 的默认防护。补回来的办法：写操作一律检查 Origin
// （老浏览器没有 Origin 时退化看 Referer），必须等于站点自己的源或 Worker 自己的源，
// 两个都是我方地址，第三方页面伪造不出来。
import type { Env } from '../env';
import { siteOrigin } from './cors';

export function isTrustedOrigin(request: Request, env: Env): boolean {
  const workerOrigin = new URL(request.url).origin;
  const trusted = [siteOrigin(env), workerOrigin];

  const origin = request.headers.get('Origin');
  if (origin) return trusted.includes(origin);

  const referer = request.headers.get('Referer');
  if (!referer) return false;
  try {
    return trusted.includes(new URL(referer).origin);
  } catch {
    return false;
  }
}
