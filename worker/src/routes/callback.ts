import type { Env } from '../env';
import { randomId } from '../lib/crypto';
import { createSession, sessionCookieHeader } from '../lib/session';
import { getUserByEmail, getUserById, touchLastLogin } from '../lib/db';

interface MagicLinkRow {
  token: string;
  email: string;
  expires_at: string;
  used_at: string | null;
}

export async function handleCallback(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return new Response('Not Found', { status: 404 });

  const link = await env.DB.prepare('SELECT * FROM magic_links WHERE token = ?')
    .bind(token)
    .first<MagicLinkRow>();

  if (!link || link.used_at || new Date(link.expires_at).getTime() < Date.now()) {
    return Response.redirect(`${env.SITE_ORIGIN}/login?invalid=1`, 303);
  }
  await env.DB.prepare('UPDATE magic_links SET used_at = ? WHERE token = ?')
    .bind(new Date().toISOString(), token)
    .run();

  let user = await getUserByEmail(env, link.email);
  if (!user) {
    const id = randomId();
    await env.DB.prepare('INSERT INTO users (id, email, nickname, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, link.email, link.email.split('@')[0], 'member', new Date().toISOString())
      .run();
    user = await getUserById(env, id);
  }
  if (!user) return new Response('Internal Error', { status: 500 });

  await touchLastLogin(env, user.id);
  const sessionToken = await createSession(env, user.id);

  const headers = new Headers({ Location: `${env.SITE_ORIGIN}/` });
  headers.append('Set-Cookie', sessionCookieHeader(sessionToken, url.protocol === 'https:'));
  return new Response(null, { status: 302, headers });
}
