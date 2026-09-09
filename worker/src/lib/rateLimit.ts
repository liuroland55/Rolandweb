// 登录接口按 IP + 邮箱做速率限制，用 KV 计数即可，不需要额外的限流服务。
import type { Env } from '../env';

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;

export async function checkLoginRateLimit(env: Env, ip: string, email: string): Promise<boolean> {
  const key = `ratelimit:login:${ip}:${email.toLowerCase()}`;
  const current = Number((await env.SESSIONS.get(key)) ?? '0');
  if (current >= MAX_ATTEMPTS) return false;
  await env.SESSIONS.put(key, String(current + 1), { expirationTtl: WINDOW_SECONDS });
  return true;
}
