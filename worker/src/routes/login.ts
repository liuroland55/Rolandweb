import type { Env } from '../env';
import { json, readBody } from '../lib/http';
import { randomToken } from '../lib/crypto';
import { createMailer, magicLinkEmail } from '../lib/mail';
import { checkLoginRateLimit } from '../lib/rateLimit';

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
      const loginUrl = `${env.SITE_ORIGIN}/api/callback?token=${token}`;
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
