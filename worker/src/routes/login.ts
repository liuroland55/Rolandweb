import type { Env } from '../env';
import { json, readBody } from '../lib/http';
import { randomToken } from '../lib/crypto';
import { createMailer, magicLinkEmail } from '../lib/mail';
import { checkLoginRateLimit, checkPasswordLoginRateLimit } from '../lib/rateLimit';
import { workerOrigin } from '../lib/cors';
import { createSession, sessionCookieHeader } from '../lib/session';
import { getUserByEmail, touchLastLogin } from '../lib/db';
import { verifyPassword } from '../lib/password';

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  const email = (body.email ?? '').trim().toLowerCase();
  const wantsJson = request.headers.get('Accept')?.includes('application/json') ?? false;

  if (email && email.includes('@')) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const allowed = await checkLoginRateLimit(env, ip, email);
    if (allowed) {
      const token = randomToken();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await env.DB.prepare('INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, ?)')
        .bind(token, email, expiresAt)
        .run();
      // /api/callback 只存在于 Worker 自己的源上，不是站点的域名——用错会拼出死链接。
      const loginUrl = `${workerOrigin(request)}/api/callback?token=${token}`;
      const mailer = createMailer(env);
      const { subject, html } = magicLinkEmail(loginUrl);
      await mailer.send(email, subject, html);
    }
    // allowed 为 false（触发限流）时也走到这里、什么都不做——
    // 响应必须和成功时一模一样，见硬约束"无论邮箱是否存在都返回同样的成功响应"。
  }

  if (wantsJson) return json({ ok: true });
  return Response.redirect(`${env.SITE_ORIGIN}/login?sent=1`, 303);
}

// 密码登录只是给"已经存在的账号"（邀请/魔法链接建的）追加的一种登录方式——
// 不存在就凭邮箱+密码开新账号这回事，注册仍然只能走邀请链接，见 CLAUDE.md 架构备忘。
// 跟魔法链接那条路径不同，这里失败就直说"邮箱或密码不对"：密码登录本来就没有
// "无论账号是否存在都长得一样"这个隐私要求（对方已经在尝试一个具体的密码了）。
export async function handleLoginPassword(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const wantsJson = request.headers.get('Accept')?.includes('application/json') ?? false;
  const secure = new URL(request.url).protocol === 'https:';

  const fail = (): Response =>
    wantsJson ? json({ ok: false, error: 'invalid' }, { status: 401 }) : Response.redirect(`${env.SITE_ORIGIN}/login?invalid=1`, 303);

  if (!email || !email.includes('@') || !password) return fail();

  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const allowed = await checkPasswordLoginRateLimit(env, ip, email);
  if (!allowed) return fail();

  const user = await getUserByEmail(env, email);
  if (!user || !user.password_hash) return fail();

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return fail();

  await touchLastLogin(env, user.id);
  const sessionToken = await createSession(env, user.id);
  const cookie = sessionCookieHeader(sessionToken, secure);

  if (wantsJson) {
    const res = json({ ok: true });
    res.headers.append('Set-Cookie', cookie);
    return res;
  }
  const headers = new Headers({ Location: `${env.SITE_ORIGIN}/` });
  headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}
