import type { Env } from '../env';
import { destroySession, clearSessionCookieHeader } from '../lib/session';

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  await destroySession(env, request);
  const headers = new Headers({ Location: `${env.SITE_ORIGIN}/` });
  headers.append('Set-Cookie', clearSessionCookieHeader(new URL(request.url).protocol === 'https:'));
  return new Response(null, { status: 302, headers });
}
