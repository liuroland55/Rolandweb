// 账号管理：任何登录用户都能进（不需要 admin），改昵称/签名/头衔前缀/头像/密码。
// 整页服务端渲染，跟 /admin、/write、/join 一样是 Worker 自己的路由，不是 Astro 页面、
// 不算 island，见 CLAUDE.md 架构备忘。
import type { Env } from '../env';
import { readSession } from '../lib/session';
import { getUserById, type UserRow } from '../lib/db';
import { renderPage, escapeHtml } from '../lib/html';
import { hashPassword, verifyPassword } from '../lib/password';
import { workerOrigin } from '../lib/cors';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

async function requireUser(request: Request, env: Env): Promise<UserRow | null> {
  const session = await readSession(env, request);
  if (!session) return null;
  return getUserById(env, session.userId);
}

export async function handleAccount(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireUser(request, env);
  // /account 不在 Astro 站上，未登录时要跳的登录页却是站点的页面——这里用 SITE_ORIGIN，
  // 不是 workerOrigin，因为 /login 是 Astro 页面而不是 Worker 路由。
  if (!user) return Response.redirect(`${env.SITE_ORIGIN}/login`, 302);

  const path = url.pathname;
  const method = request.method;

  if (path === '/account' && method === 'GET') return renderAccountPage(request, env, user, '', '');
  if (path === '/account/profile' && method === 'POST') return updateProfile(request, env, user);
  if (path === '/account/password' && method === 'POST') return updatePassword(request, env, user);
  if (path === '/account/avatar' && method === 'POST') return updateAvatar(request, env, user);

  return new Response('Not Found', { status: 404 });
}

function renderAccountPage(request: Request, env: Env, user: UserRow, profileError: string, passwordError: string): Response {
  const origin = workerOrigin(request);
  const avatarBlock = user.avatar_key
    ? `<img src="${origin}/avatars/${encodeURIComponent(user.id)}" alt="" width="64" height="64" style="width:64px;height:64px;object-fit:cover;border:1px solid var(--rule)" />`
    : `<span style="display:flex;width:64px;height:64px;align-items:center;justify-content:center;border:1px solid var(--rule);font-family:var(--mono);font-size:20px">${escapeHtml(user.nickname.slice(0, 1).toUpperCase())}</span>`;

  return renderPage(
    '账号管理',
    `<div class="masthead"><h1>账号管理</h1><span>${escapeHtml(user.email)}</span></div>
     ${user.role === 'admin' ? `<div class="panel"><a href="${origin}/admin">进入后台 →</a></div>` : ''}

     <h3>头像</h3>
     <div style="display:flex;gap:16px;align-items:center;margin-bottom:6px">
       ${avatarBlock}
       <form method="post" action="${origin}/account/avatar" enctype="multipart/form-data" style="flex-direction:row;align-items:center;gap:8px;max-width:none">
         <input type="file" name="avatar" accept="image/png,image/jpeg,image/webp,image/gif" required />
         <button type="submit">上传</button>
       </form>
     </div>
     <p style="font-family:var(--mono);font-size:10.5px;color:var(--ink-meta)">图片，2MB 以内，JPEG/PNG/WEBP/GIF。</p>

     <h3 style="margin-top:28px">资料</h3>
     ${profileError ? `<p style="color:#e08">${escapeHtml(profileError)}</p>` : ''}
     <form method="post" action="${origin}/account/profile">
       <label>昵称<input type="text" name="nickname" value="${escapeHtml(user.nickname)}" required maxlength="40" /></label>
       <label>头衔前缀（可选，显示在昵称前面）<input type="text" name="title_prefix" value="${escapeHtml(user.title_prefix ?? '')}" maxlength="20" placeholder="比如：老朋友" /></label>
       <label>签名（可选）<textarea name="signature" rows="3" maxlength="200">${escapeHtml(user.signature ?? '')}</textarea></label>
       <button type="submit">保存资料</button>
     </form>

     <h3 style="margin-top:28px">密码</h3>
     ${passwordError ? `<p style="color:#e08">${escapeHtml(passwordError)}</p>` : ''}
     <p style="font-family:var(--mono);font-size:10.5px;color:var(--ink-meta)">${
       user.password_hash
         ? '已设置密码，之后可以在 /login 页直接用邮箱+密码登录，不用等邮件。'
         : '还没设置密码，目前只能用邮箱登录链接登录。设置后就能在 /login 页用密码登录了。'
     }</p>
     <form method="post" action="${origin}/account/password">
       ${user.password_hash ? '<label>当前密码<input type="password" name="current_password" required autocomplete="current-password" /></label>' : ''}
       <label>新密码（至少 8 位）<input type="password" name="new_password" minlength="8" required autocomplete="new-password" /></label>
       <label>确认新密码<input type="password" name="confirm_password" minlength="8" required autocomplete="new-password" /></label>
       <button type="submit">${user.password_hash ? '修改密码' : '设置密码'}</button>
     </form>

     <p style="margin-top:32px"><a href="${escapeHtml(env.SITE_ORIGIN)}/">← 回站点</a></p>`,
  );
}

async function updateProfile(request: Request, env: Env, user: UserRow): Promise<Response> {
  const form = await request.formData();
  const nickname = String(form.get('nickname') ?? '').trim();
  const titlePrefix = String(form.get('title_prefix') ?? '').trim();
  const signature = String(form.get('signature') ?? '').trim();

  if (!nickname) return renderAccountPage(request, env, user, '昵称不能为空。', '');
  if (nickname.length > 40) return renderAccountPage(request, env, user, '昵称太长了。', '');
  if (titlePrefix.length > 20) return renderAccountPage(request, env, user, '头衔前缀太长了。', '');
  if (signature.length > 200) return renderAccountPage(request, env, user, '签名太长了。', '');

  await env.DB.prepare('UPDATE users SET nickname = ?, title_prefix = ?, signature = ? WHERE id = ?')
    .bind(nickname, titlePrefix || null, signature || null, user.id)
    .run();

  return Response.redirect(`${workerOrigin(request)}/account`, 303);
}

async function updatePassword(request: Request, env: Env, user: UserRow): Promise<Response> {
  const form = await request.formData();
  const currentPassword = String(form.get('current_password') ?? '');
  const newPassword = String(form.get('new_password') ?? '');
  const confirmPassword = String(form.get('confirm_password') ?? '');

  if (user.password_hash) {
    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) return renderAccountPage(request, env, user, '', '当前密码不对。');
  }
  if (newPassword.length < 8) return renderAccountPage(request, env, user, '', '新密码至少 8 位。');
  if (newPassword !== confirmPassword) return renderAccountPage(request, env, user, '', '两次输入的新密码不一样。');

  const hash = await hashPassword(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.id).run();

  return Response.redirect(`${workerOrigin(request)}/account`, 303);
}

async function updateAvatar(request: Request, env: Env, user: UserRow): Promise<Response> {
  const form = await request.formData();
  const file = form.get('avatar');
  if (!(file instanceof File)) return renderAccountPage(request, env, user, '没有选择文件。', '');
  if (!ALLOWED_AVATAR_TYPES.has(file.type)) return renderAccountPage(request, env, user, '头像只支持 JPEG/PNG/WEBP/GIF。', '');
  if (file.size > MAX_AVATAR_BYTES) return renderAccountPage(request, env, user, '头像超过 2MB 了。', '');

  const key = `avatars/${user.id}`;
  await env.PHOTOS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  await env.DB.prepare('UPDATE users SET avatar_key = ? WHERE id = ?').bind(key, user.id).run();

  return Response.redirect(`${workerOrigin(request)}/account`, 303);
}
