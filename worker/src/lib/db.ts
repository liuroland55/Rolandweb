// 常用查询集中在这里，路由文件只管"这个请求该不该被允许"，不重复写 SQL。
import type { Env } from '../env';

export interface UserRow {
  id: string;
  email: string;
  nickname: string;
  role: 'admin' | 'member';
  created_at: string;
  last_login_at: string | null;
}

export interface AlbumRow {
  roll: string;
  visibility: 'public' | 'group' | 'private';
  r2_prefix: string;
  count: number;
}

export async function getUserByEmail(env: Env, email: string): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).first<UserRow>();
}

export async function getUserById(env: Env, id: string): Promise<UserRow | null> {
  return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
}

export async function touchLastLogin(env: Env, userId: string): Promise<void> {
  await env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), userId)
    .run();
}

export async function getUserGroupNames(env: Env, userId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT g.name AS name FROM groups g
     JOIN user_groups ug ON ug.group_id = g.id
     WHERE ug.user_id = ?`,
  )
    .bind(userId)
    .all<{ name: string }>();
  return results.map((r) => r.name);
}

export async function getVisibleRolls(env: Env, userId: string): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT a.roll AS roll FROM albums a
     JOIN album_groups ag ON ag.roll = a.roll
     JOIN user_groups ug ON ug.group_id = ag.group_id
     WHERE ug.user_id = ? AND a.visibility = 'group'`,
  )
    .bind(userId)
    .all<{ roll: string }>();
  return results.map((r) => r.roll);
}

export async function getAlbum(env: Env, roll: string): Promise<AlbumRow | null> {
  return env.DB.prepare('SELECT * FROM albums WHERE roll = ?').bind(roll).first<AlbumRow>();
}

/**
 * private 卷除了 admin 谁都不该知道它存在——调用方拿到 false 时应该回 404，不是 403，
 * 这样"资源不存在"和"没权限"从外面看是一回事（见硬约束 5 与 Phase 7 安全细节）。
 */
export async function canAccessAlbum(env: Env, album: AlbumRow, userId: string | null, role: 'admin' | 'member' | null): Promise<boolean> {
  if (role === 'admin') return true;
  if (album.visibility === 'public') return true;
  if (album.visibility === 'private') return false;
  if (!userId) return false;
  const visibleRolls = await getVisibleRolls(env, userId);
  return visibleRolls.includes(album.roll);
}
