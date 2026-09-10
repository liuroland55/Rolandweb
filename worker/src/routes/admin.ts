// 管理后台：整页服务端渲染，role != admin 一律 404（不是 403——不透露"这里有个后台"）。
// 所有写操作走原生 <form method="post">，失败就整页重新渲染并带一行错误提示，
// 没有乐观 UI，也没有任何 JS。
import type { Env } from '../env';
import { readSession } from '../lib/session';
import { getUserById, type UserRow } from '../lib/db';
import { renderPage, escapeHtml } from '../lib/html';
import { readBody } from '../lib/http';
import { randomId, randomToken } from '../lib/crypto';
import { workerOrigin } from '../lib/cors';

async function requireAdmin(request: Request, env: Env): Promise<UserRow | null> {
  const session = await readSession(env, request);
  if (!session) return null;
  const user = await getUserById(env, session.userId);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function handleAdmin(request: Request, env: Env, url: URL): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (!admin) return new Response('Not Found', { status: 404 });

  const path = url.pathname;
  const method = request.method;

  if (path === '/admin' && method === 'GET') return renderDashboard(request, env, '');

  if (path === '/admin/invites' && method === 'POST') return createInvite(request, env);
  if (path.startsWith('/admin/invites/') && path.endsWith('/revoke') && method === 'POST') {
    const token = path.slice('/admin/invites/'.length, -'/revoke'.length);
    await env.DB.prepare('UPDATE invites SET revoked_at = ? WHERE token = ?')
      .bind(new Date().toISOString(), token)
      .run();
    return Response.redirect(`${workerOrigin(request)}/admin`, 303);
  }

  if (path.startsWith('/admin/requests/') && path.endsWith('/approve') && method === 'POST') {
    const id = path.slice('/admin/requests/'.length, -'/approve'.length);
    return approveRequest(request, env, id);
  }
  if (path.startsWith('/admin/requests/') && path.endsWith('/reject') && method === 'POST') {
    const id = path.slice('/admin/requests/'.length, -'/reject'.length);
    await env.DB.prepare("UPDATE requests SET status = 'rejected' WHERE id = ?").bind(id).run();
    return Response.redirect(`${workerOrigin(request)}/admin`, 303);
  }

  if (path.startsWith('/admin/albums/') && path.endsWith('/visibility') && method === 'POST') {
    const roll = decodeURIComponent(path.slice('/admin/albums/'.length, -'/visibility'.length));
    return updateAlbumVisibility(request, env, roll);
  }

  if (path === '/admin/export' && method === 'GET') return exportUsersCsv(env);

  return new Response('Not Found', { status: 404 });
}

async function approveRequest(request: Request, env: Env, id: string): Promise<Response> {
  const backToAdmin = `${workerOrigin(request)}/admin`;
  const reqRow = await env.DB.prepare('SELECT * FROM requests WHERE id = ?').bind(id).first<{
    id: string;
    roll: string;
    email: string;
  }>();
  if (!reqRow) return Response.redirect(backToAdmin, 303);

  let user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(reqRow.email).first<UserRow>();
  if (!user) {
    const id2 = randomId();
    await env.DB.prepare('INSERT INTO users (id, email, nickname, role, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id2, reqRow.email, reqRow.email.split('@')[0], 'member', new Date().toISOString())
      .run();
    user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id2).first<UserRow>();
  }
  if (!user) return Response.redirect(backToAdmin, 303);

  const { results: groupRows } = await env.DB.prepare('SELECT group_id FROM album_groups WHERE roll = ?')
    .bind(reqRow.roll)
    .all<{ group_id: string }>();
  for (const { group_id } of groupRows) {
    await env.DB.prepare('INSERT OR IGNORE INTO user_groups (user_id, group_id) VALUES (?, ?)')
      .bind(user.id, group_id)
      .run();
  }
  await env.DB.prepare("UPDATE requests SET status = 'approved' WHERE id = ?").bind(id).run();

  return Response.redirect(backToAdmin, 303);
}

async function createInvite(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (!admin) return new Response('Not Found', { status: 404 });

  const body = await readBody(request);
  const groupId = body.group_id;
  const days = Number(body.days || '30');
  const maxUses = Number(body.max_uses || '1');
  if (!groupId) return renderDashboard(request, env, '生成邀请链接需要选一个分组。');

  const token = randomToken(16);
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare(
    'INSERT INTO invites (token, group_id, expires_at, max_uses, used_count, created_by) VALUES (?, ?, ?, ?, 0, ?)',
  )
    .bind(token, groupId, expiresAt, maxUses, admin.id)
    .run();

  return Response.redirect(`${workerOrigin(request)}/admin`, 303);
}

async function updateAlbumVisibility(request: Request, env: Env, roll: string): Promise<Response> {
  const body = await readBody(request);
  const visibility = body.visibility;
  if (visibility !== 'public' && visibility !== 'group' && visibility !== 'private') {
    return renderDashboard(request, env, '无效的可见范围。');
  }
  await env.DB.prepare('UPDATE albums SET visibility = ? WHERE roll = ?').bind(visibility, roll).run();

  if (visibility === 'group' && body.group_id) {
    await env.DB.prepare('DELETE FROM album_groups WHERE roll = ?').bind(roll).run();
    await env.DB.prepare('INSERT INTO album_groups (roll, group_id) VALUES (?, ?)').bind(roll, body.group_id).run();
  }
  return Response.redirect(`${workerOrigin(request)}/admin`, 303);
}

async function exportUsersCsv(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare('SELECT email, nickname, role, created_at, last_login_at FROM users').all<UserRow>();
  const header = 'email,nickname,role,created_at,last_login_at';
  const lines = results.map((u) => [u.email, u.nickname, u.role, u.created_at, u.last_login_at ?? ''].join(','));
  return new Response([header, ...lines].join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="users.csv"',
    },
  });
}

async function renderDashboard(request: Request, env: Env, error: string): Promise<Response> {
  const [{ results: groups }, { results: users }, { results: pendingRequests }, { results: invites }, { results: albums }] =
    await Promise.all([
      env.DB.prepare('SELECT * FROM groups ORDER BY name').all<{ id: string; name: string }>(),
      env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all<UserRow>(),
      env.DB.prepare("SELECT * FROM requests WHERE status = 'pending' ORDER BY created_at DESC").all<{
        id: string;
        roll: string;
        email: string;
        message: string | null;
        created_at: string;
      }>(),
      env.DB.prepare('SELECT * FROM invites WHERE revoked_at IS NULL ORDER BY expires_at DESC').all<{
        token: string;
        group_id: string;
        expires_at: string;
        max_uses: number;
        used_count: number;
      }>(),
      env.DB.prepare('SELECT * FROM albums ORDER BY roll').all<{
        roll: string;
        visibility: string;
        r2_prefix: string;
        count: number;
      }>(),
    ]);

  const groupNameById = new Map(groups.map((g) => [g.id, g.name]));
  const userGroupsRows = (
    await env.DB.prepare(
      `SELECT ug.user_id AS user_id, g.name AS name FROM user_groups ug JOIN groups g ON g.id = ug.group_id`,
    ).all<{ user_id: string; name: string }>()
  ).results;
  const groupsByUser = new Map<string, string[]>();
  for (const row of userGroupsRows) {
    groupsByUser.set(row.user_id, [...(groupsByUser.get(row.user_id) ?? []), row.name]);
  }

  const groupUserCount = new Map<string, number>();
  for (const g of groups) {
    groupUserCount.set(g.name, userGroupsRows.filter((r) => r.name === g.name).length);
  }

  const statCards = groups
    .map((g) => `<div class="stat"><b>${groupUserCount.get(g.name) ?? 0}</b><span>${escapeHtml(g.name)}</span></div>`)
    .join('');

  const pendingByEmail = new Set(pendingRequests.map((r) => r.email));

  const requestRows = pendingRequests
    .map(
      (r) => `<tr style="background:rgba(236,238,232,.045)">
        <td>${escapeHtml(r.email)}${r.message ? `<br><span style="opacity:.7">${escapeHtml(r.message)}</span>` : ''}</td>
        <td colspan="2"><span class="badge">申请：${escapeHtml(r.roll)}</span></td>
        <td>${escapeHtml(r.created_at.slice(0, 10))}</td>
        <td>
          <form method="post" action="/admin/requests/${encodeURIComponent(r.id)}/approve" style="display:inline">
            <button type="submit">允许</button>
          </form>
          <form method="post" action="/admin/requests/${encodeURIComponent(r.id)}/reject" style="display:inline">
            <button type="submit" style="background:transparent;border:1px solid var(--rule);color:inherit">拒绝</button>
          </form>
        </td>
      </tr>`,
    )
    .join('');

  const userRows = users
    .filter((u) => !pendingByEmail.has(u.email))
    .map((u) => {
      const userGroups = groupsByUser.get(u.id) ?? [];
      return `<tr>
        <td>${escapeHtml(u.nickname)}<br><span style="opacity:.7">${escapeHtml(u.email)}</span></td>
        <td>${userGroups.map((g) => `<span class="badge">${escapeHtml(g)}</span>`).join(' ') || '—'}</td>
        <td>${u.role}</td>
        <td>${u.last_login_at ? escapeHtml(u.last_login_at.slice(0, 10)) : '从未'}</td>
        <td>—</td>
      </tr>`;
    })
    .join('');

  const inviteCards = invites
    .map((inv) => {
      // /join/:token 是 Worker 自己的路由，不在站点域名上。
      const joinUrl = `${workerOrigin(request)}/join/${inv.token}`;
      return `<div class="panel" style="background:var(--paper-panel);color:var(--ink);border:1px solid var(--rule)">
        <div style="word-break:break-all;font-family:var(--mono);font-size:11px">${escapeHtml(joinUrl)}</div>
        <div style="margin-top:6px;font-family:var(--mono);font-size:10.5px;opacity:.7">
          → ${escapeHtml(groupNameById.get(inv.group_id) ?? '')} · ${escapeHtml(inv.expires_at.slice(0, 10))} 后失效 · 已用 ${inv.used_count}/${inv.max_uses}
        </div>
        <form method="post" action="/admin/invites/${inv.token}/revoke" style="margin-top:8px">
          <button type="submit" style="background:transparent;border:1px solid var(--rule);color:inherit">吊销</button>
        </form>
      </div>`;
    })
    .join('');

  const albumRows = albums
    .map(
      (a) => `<tr>
        <td>${escapeHtml(a.roll)}</td>
        <td>${a.count} 张</td>
        <td>
          <form method="post" action="/admin/albums/${encodeURIComponent(a.roll)}/visibility" style="flex-direction:row;gap:8px;max-width:none">
            <select name="visibility" style="font-family:var(--mono);font-size:11px">
              <option value="public" ${a.visibility === 'public' ? 'selected' : ''}>公开</option>
              <option value="group" ${a.visibility === 'group' ? 'selected' : ''}>好友组</option>
              <option value="private" ${a.visibility === 'private' ? 'selected' : ''}>仅我</option>
            </select>
            <select name="group_id" style="font-family:var(--mono);font-size:11px">
              ${groups.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}
            </select>
            <button type="submit">保存</button>
          </form>
        </td>
      </tr>`,
    )
    .join('');

  const groupOptions = groups.map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');

  return renderPage(
    '后台 · 友邻',
    `<div class="masthead">
       <h1>后台 · 友邻 / Admin</h1>
       <span>${users.length} 人 · ${groups.length} 组</span>
     </div>
     ${error ? `<p style="color:#e08">${escapeHtml(error)}</p>` : ''}
     <div style="display:flex;gap:10px;margin-bottom:20px">
       <a href="/write"><button type="button">写一条 →</button></a>
       <a href="/admin/export"><button type="button" style="background:transparent;border:1px solid var(--rule);color:inherit">导出名单</button></a>
     </div>
     <div class="stat-row">
       ${statCards}
       <div class="stat" style="background:var(--accent-bright);color:var(--accent-deep)"><b>${pendingRequests.length}</b><span>待处理申请</span></div>
     </div>

     <h3>用户</h3>
     <div style="overflow-x:auto">
       <table>
         <thead><tr><th>昵称 / 邮箱</th><th>分组</th><th>角色</th><th>最近登录</th><th>操作</th></tr></thead>
         <tbody>${requestRows}${userRows}</tbody>
       </table>
     </div>

     <h3 style="margin-top:32px">生成邀请链接</h3>
     <form method="post" action="/admin/invites">
       <label>分组
         <select name="group_id">${groupOptions}</select>
       </label>
       <label>有效期（天）<input type="number" name="days" value="30" /></label>
       <label>可用次数<input type="number" name="max_uses" value="1" /></label>
       <button type="submit">＋ 生成邀请链接</button>
     </form>
     <div style="margin-top:16px">${inviteCards}</div>

     <h3 style="margin-top:32px">相册可见性</h3>
     <div style="overflow-x:auto">
       <table>
         <thead><tr><th>卷</th><th>张数</th><th>可见范围</th></tr></thead>
         <tbody>${albumRows}</tbody>
       </table>
     </div>`,
    { admin: true },
  );
}
