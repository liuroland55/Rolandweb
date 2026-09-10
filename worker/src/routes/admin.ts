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
import { commitFile } from '../lib/github';
import { yamlStr } from '../lib/yaml';

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

  if (path === '/admin/groups' && method === 'POST') return createGroup(request, env);

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

  if (path === '/admin/albums' && method === 'POST') return createAlbum(request, env);
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

async function createGroup(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (!admin) return new Response('Not Found', { status: 404 });

  const body = await readBody(request);
  const name = (body.name ?? '').trim();
  if (!name) return renderDashboard(request, env, '分组名字不能为空。');

  const existing = await env.DB.prepare('SELECT id FROM groups WHERE name = ?').bind(name).first();
  if (existing) return renderDashboard(request, env, `分组「${name}」已经存在了。`);

  await env.DB.prepare('INSERT INTO groups (id, name, created_at) VALUES (?, ?, ?)')
    .bind(randomId(), name, new Date().toISOString())
    .run();

  return Response.redirect(`${workerOrigin(request)}/admin`, 303);
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

// 建一卷相册要同时动两个地方：D1 的 albums 表（Worker 判权限、签名下载用）+
// Astro 内容集合里的一个 .md 文件（公开站渲染卡片用）。private 卷不写 git——
// 不进 Astro 内容集合，就不会出现在任何公开列表/sitemap/RSS 里，见硬约束 5。
// 照片本身和打包 zip 不在这里传：建完卷之后，把结果页给的 wrangler r2 命令
// 拿去手动上传实际文件（roll 就是 R2 前缀）。
async function createAlbum(request: Request, env: Env): Promise<Response> {
  const admin = await requireAdmin(request, env);
  if (!admin) return new Response('Not Found', { status: 404 });

  const body = await readBody(request);
  const roll = (body.roll ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const title = (body.title ?? '').trim();
  const count = Number(body.count || '0');
  const shotAt = (body.shot_at ?? '').trim();
  const visibility = body.visibility;
  const groupId = body.group_id;
  const filmStock = (body.film_stock ?? '').trim();
  const downloadSize = (body.download_size ?? '').trim();
  const friendNote = (body.friend_note ?? '').trim();

  if (!roll) return renderDashboard(request, env, '相册 slug 不能为空（只允许 a-z 0-9 -）。');
  if (!title) return renderDashboard(request, env, '相册标题不能为空。');
  if (!count || count <= 0) return renderDashboard(request, env, '张数得是正整数。');
  if (!/^\d{4}-\d{2}-\d{2}/.test(shotAt)) return renderDashboard(request, env, '拍摄日期格式不对。');
  if (visibility !== 'public' && visibility !== 'group' && visibility !== 'private') {
    return renderDashboard(request, env, '可见范围不对。');
  }
  if (visibility === 'group' && !groupId) return renderDashboard(request, env, '好友组可见需要选一个分组。');

  const existingAlbum = await env.DB.prepare('SELECT roll FROM albums WHERE roll = ?').bind(roll).first();
  if (existingAlbum) return renderDashboard(request, env, `卷「${roll}」已经存在了。`);

  await env.DB.prepare('INSERT INTO albums (roll, visibility, r2_prefix, count) VALUES (?, ?, ?, ?)')
    .bind(roll, visibility, roll, count)
    .run();

  let groupName = '';
  if (visibility === 'group' && groupId) {
    await env.DB.prepare('INSERT INTO album_groups (roll, group_id) VALUES (?, ?)').bind(roll, groupId).run();
    const g = await env.DB.prepare('SELECT name FROM groups WHERE id = ?').bind(groupId).first<{ name: string }>();
    groupName = g?.name ?? '';
  }

  let commitResult: { ok: boolean; error?: string; commitUrl?: string; path?: string } | null = null;
  if (visibility !== 'private') {
    const lines = [
      '---',
      `title: ${yamlStr(title)}`,
      `date: ${new Date().toISOString().slice(0, 10)}`,
      `roll: ${roll}`,
      `shot_at: ${shotAt}`,
      `count: ${count}`,
      `visibility: ${visibility}`,
    ];
    if (filmStock) lines.push(`film_stock: ${yamlStr(filmStock)}`);
    // 分组名字不写进这个文件——那是要提交进公开仓库的，分组归属只在 D1 的
    // album_groups 表里判权限，写进 git 就是白白让分组名字被翻出来（见硬约束 5 的精神）。
    if (downloadSize) lines.push(`download:\n  size: ${yamlStr(downloadSize)}`);
    if (friendNote) lines.push(`friend_note: ${yamlStr(friendNote)}`);
    lines.push('---', '');

    const path = `src/content/photos/${roll}.md`;
    const result = await commitFile(env, path, lines.join('\n'), `content(photos): ${title}`);
    commitResult = { ...result, path };
  }

  const origin = workerOrigin(request);
  const uploadCmds = [
    `# 把这一卷的照片和打包 zip 传进 R2（在本地存了原图的机器上跑，仓库根的 worker/ 目录里）：`,
    `npx.cmd wrangler r2 object put shiyu-photos/${roll}/0001.jpg --file=./0001.jpg --content-type=image/jpeg --remote`,
    `# ...每张照片重复一遍，文件名随意，Worker 只是把 ${roll}/ 前缀下除了 download.zip 之外的都当图片列出来`,
    `npx.cmd wrangler r2 object put shiyu-photos/${roll}/download.zip --file=./${roll}.zip --content-type=application/zip --remote`,
  ];

  return renderPage(
    '已新建相册卷',
    `<div class="masthead"><h1>已新建相册卷</h1><span><a href="${origin}/admin">回后台 →</a></span></div>
     <div class="panel">
       <p>${escapeHtml(title)}（${escapeHtml(roll)}） · ${count} 张 · ${escapeHtml(visibility)}${groupName ? ` · ${escapeHtml(groupName)}` : ''}</p>
       ${
         visibility === 'private'
           ? '<p style="font-family:var(--mono);font-size:11px">private 卷不会写进仓库，只在数据库里，公开站看不到它存在。</p>'
           : commitResult?.ok
             ? `<p style="font-family:var(--mono);font-size:11px;word-break:break-all">${escapeHtml(commitResult.path ?? '')}</p>
                ${commitResult.commitUrl ? `<p><a href="${escapeHtml(commitResult.commitUrl)}">查看提交 →</a></p>` : '<p style="font-family:var(--mono);font-size:11px">（未配置 GITHUB_TOKEN：文件内容已打印在 Worker 日志里，没有真的写入仓库）</p>'}`
             : `<p style="color:#e08">写内容文件失败：${escapeHtml(commitResult?.error ?? '未知错误')}（D1 记录已经建好了，相册可见性那张表里能看到，重新提交一次内容文件就行，不用重建整条记录）</p>`
       }
     </div>
     <p>照片本身和打包 zip 还没传——D1 只知道"这一卷存在、有几张"，实际文件要你自己传进 R2：</p>
     <pre style="background:var(--paper-panel);color:var(--ink);padding:14px;overflow-x:auto;font-family:var(--mono);font-size:11px;white-space:pre-wrap">${escapeHtml(uploadCmds.join('\n'))}</pre>`,
    { admin: true },
  );
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

     <h3 style="margin-top:32px">新建分组</h3>
     <form method="post" action="/admin/groups">
       <label>分组名字<input type="text" name="name" required placeholder="比如：好友组 / 南方组" /></label>
       <button type="submit">＋ 新建分组</button>
     </form>

     <h3 style="margin-top:32px">生成邀请链接</h3>
     ${groups.length === 0 ? '<p style="font-family:var(--mono);font-size:11px;opacity:.7">还没有分组，先新建一个。</p>' : `
     <form method="post" action="/admin/invites">
       <label>分组
         <select name="group_id">${groupOptions}</select>
       </label>
       <label>有效期（天）<input type="number" name="days" value="30" /></label>
       <label>可用次数<input type="number" name="max_uses" value="1" /></label>
       <button type="submit">＋ 生成邀请链接</button>
     </form>
     <div style="margin-top:16px">${inviteCards}</div>
     `}

     <h3 style="margin-top:32px">相册可见性</h3>
     <div style="overflow-x:auto">
       <table>
         <thead><tr><th>卷</th><th>张数</th><th>可见范围</th></tr></thead>
         <tbody>${albumRows}</tbody>
       </table>
     </div>

     <h3 style="margin-top:32px">新建相册卷</h3>
     <p style="font-family:var(--mono);font-size:10.5px;color:var(--ink-meta);max-width:480px">
       这里只建"元数据"（D1 记录 + 公开站要渲染的内容文件）。照片本身和打包 zip 不在这个表单里传，
       提交后会给你几条 wrangler 命令，自己拿去把实际文件传进 R2。
     </p>
     <form method="post" action="/admin/albums">
       <label>slug（roll，只允许 a-z 0-9 -，同时是 R2 前缀）<input type="text" name="roll" required placeholder="比如 birthday-2026-06" /></label>
       <label>标题<input type="text" name="title" required placeholder="比如 生日 · 2026.06" /></label>
       <label>张数<input type="number" name="count" required min="1" /></label>
       <label>拍摄日期<input type="date" name="shot_at" required /></label>
       <label>可见范围
         <select name="visibility">
           <option value="public">公开</option>
           <option value="group">好友组（用下面选的分组）</option>
           <option value="private">仅我（不进仓库，站点上不出现）</option>
         </select>
       </label>
       <label>分组（可见范围选"好友组"时用）
         <select name="group_id">${groupOptions}</select>
       </label>
       <label>胶片型号（可选）<input type="text" name="film_stock" /></label>
       <label>打包下载大小标注（可选，如 218MB）<input type="text" name="download_size" /></label>
       <label>给朋友的一句话（可选，右页边批注）<input type="text" name="friend_note" /></label>
       <button type="submit">＋ 新建相册卷</button>
     </form>`,
    { admin: true },
  );
}
