// 登录接口按 IP + 邮箱做速率限制，用 KV 计数即可，不需要额外的限流服务。
import type { Env } from '../env';

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;

async function checkRateLimit(env: Env, bucket: string, ip: string, email: string): Promise<boolean> {
  const key = `ratelimit:${bucket}:${ip}:${email.toLowerCase()}`;
  const current = Number((await env.SESSIONS.get(key)) ?? '0');
  if (current >= MAX_ATTEMPTS) return false;
  await env.SESSIONS.put(key, String(current + 1), { expirationTtl: WINDOW_SECONDS });
  return true;
}

export function checkLoginRateLimit(env: Env, ip: string, email: string): Promise<boolean> {
  return checkRateLimit(env, 'login', ip, email);
}

// 单独的 bucket：密码登录允许被猜的次数不该跟魔法链接共享同一个计数器，
// 否则一次密码暴力尝试会连带把这个邮箱的魔法链接登录也限流掉。
export function checkPasswordLoginRateLimit(env: Env, ip: string, email: string): Promise<boolean> {
  return checkRateLimit(env, 'pwlogin', ip, email);
}
