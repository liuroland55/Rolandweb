// 会话：cookie 里只放一个随机 key，真正的数据（用户 id）存在 KV 里，
// 这样 cookie 泄露也翻不出用户身份以外的东西，而且随时可以在服务端撤销。
import type { Env } from '../env';
import { randomToken } from './crypto';

const COOKIE_NAME = 'shiyu_session';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 天滚动续期

export interface SessionData {
  userId: string;
}

export async function createSession(env: Env, userId: string): Promise<string> {
  const token = randomToken();
  await env.SESSIONS.put(`session:${token}`, JSON.stringify({ userId } satisfies SessionData), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return token;
}

export async function readSession(env: Env, request: Request): Promise<SessionData | null> {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return null;
  const raw = await env.SESSIONS.get(`session:${token}`);
  if (!raw) return null;
  // 滚动续期：每次访问都把过期时间往后推 30 天。
  await env.SESSIONS.put(`session:${token}`, raw, { expirationTtl: SESSION_TTL_SECONDS });
  return JSON.parse(raw) as SessionData;
}

export async function destroySession(env: Env, request: Request): Promise<void> {
  const token = getCookie(request, COOKIE_NAME);
  if (!token) return;
  await env.SESSIONS.delete(`session:${token}`);
}

export function sessionCookieHeader(token: string, secure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookieHeader(secure: boolean): string {
  const parts = [`${COOKIE_NAME}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}
