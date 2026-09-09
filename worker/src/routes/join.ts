// /join/:token 是邀请落地页，服务端渲染（不是 Astro 页面）——道理和 /admin 一样：
// 需要按 token 查 D1 才知道该显示什么，静态站做不到，见 CLAUDE.md 架构备忘。
import type { Env } from '../env';
import { randomId } from '../lib/crypto';
import { createSession, sessionCookieHeader } from '../lib/session';
import { getUserByEmail, getUserById, touchLastLogin } from '../lib/db';
import { renderPage, escapeHtml } from '../lib/html';
import { readBody } from '../lib/http';

interface InviteRow {
  token: string;
  group_id: string;
  expires_at: string;
  max_uses: number;
  used_count: number;
  revoked_at: string | null;
}

async function getValidInvite(env: Env, token: string): Promise<InviteRow | null> {
  const invite = await env.DB.prepare('SELECT * FROM invites WHERE token = ?').bind(token).first<InviteRow>();
  if (!invite) return null;
  if (invite.revoked_at) return null;
  if (new Date(invite.expires_at).getTime() < Date.now()) return null;
  if (invite.used_count >= invite.max_uses) return null;
  return invite;
}

export async function handleJoinPage(request: Request, env: Env, token: string): Promise<Response> {
  const invite = await getValidInvite(env, token);
  if (!invite) {
    return renderPage(
      '邀请链接无效',
      `<div class="masthead"><h1>邀请链接无效</h1></div>
       <p>这条链接已经过期、被吊销，或者已经用完了次数。如果你觉得这不对，联系邀请你的人再要一条新的。</p>`,
    );
  }
  const group = await env.DB.prepare('SELECT name FROM groups WHERE id = ?')
    .bind(invite.group_id)
    .first<{ name: string }>();

  return renderPage(
    '接受邀请',
    `<div class="masthead"><h1>接受邀请</h1></div>
     <div class="panel">
       <p>邀请你加入分组「${escapeHtml(group?.name ?? '')}」。</p>
       <p>有效期至 ${escapeHtml(invite.expires_at)} · 已用 ${invite.used_count}/${invite.max_uses}</p>
     </div>
     <form method="post" action="/api/join/${encodeURIComponent(token)}">
       <label>邮箱<input type="email" name="email" required /></label>
       <label>昵称（可选）<input type="text" name="nickname" /></label>
       <button type="submit">加入 →</button>
     </form>`,
  );
}

export async function handleJoinSubmit(request: Request, env: Env, token: string): Promise<Response> {
  const invite = await getValidInvite(env, token);
  if (!invite) return new Response('Not Found', { status: 404 });

  const body = await readBody(request);
  const email = (body.email ?? '').trim().toLowerCase();
  if (!email || !email.includes('@')) return new Response('Bad Request', { status: 400 });
  const nickname = (body.nickname ?? '').trim() || email.split('@')[0];

  let user = await getUserByEmail(env, email);
  if (!user) {
    const id = randomId();
    await env.DB.prepare('INSERT INTO users (id, email, nickname, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, email, nickname, 'member', new Date().toISOString())
      .run();
    user = await getUserById(env, id);
  }
  if (!user) return new Response('Internal Error', { status: 500 });

  await env.DB.prepare('INSERT OR IGNORE INTO user_groups (user_id, group_id) VALUES (?, ?)')
    .bind(user.id, invite.group_id)
    .run();
  await env.DB.prepare('UPDATE invites SET used_count = used_count + 1 WHERE token = ?').bind(token).run();
  await touchLastLogin(env, user.id);

  const sessionToken = await createSession(env, user.id);
  const headers = new Headers({ Location: `${env.SITE_ORIGIN}/` });
  headers.append('Set-Cookie', sessionCookieHeader(sessionToken, new URL(request.url).protocol === 'https:'));
  return new Response(null, { status: 302, headers });
}
