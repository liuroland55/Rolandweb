import type { Env } from '../env';
import { json } from '../lib/http';
import { readSession } from '../lib/session';
import { getUserById, getUserGroupNames, getVisibleRolls } from '../lib/db';
import { workerOrigin } from '../lib/cors';

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await readSession(env, request);
  if (!session) return json({ status: 'anon' });

  const user = await getUserById(env, session.userId);
  if (!user) return json({ status: 'anon' });

  const [groups, visibleRolls] = await Promise.all([
    getUserGroupNames(env, user.id),
    getVisibleRolls(env, user.id),
  ]);

  return json({
    status: 'ok',
    nickname: user.nickname,
    groups,
    visible_rolls: visibleRolls,
    title_prefix: user.title_prefix,
    // /avatars/:id 只在 Worker 自己的源上，站点侧栏渲染 <img> 时要用完整地址。
    avatar_url: user.avatar_key ? `${workerOrigin(request)}/avatars/${user.id}` : null,
  });
}
