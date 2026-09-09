import type { Env } from '../env';
import { json } from '../lib/http';
import { readSession } from '../lib/session';
import { getUserById, getUserGroupNames, getVisibleRolls } from '../lib/db';

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const session = await readSession(env, request);
  if (!session) return json({ status: 'anon' });

  const user = await getUserById(env, session.userId);
  if (!user) return json({ status: 'anon' });

  const [groups, visibleRolls] = await Promise.all([
    getUserGroupNames(env, user.id),
    getVisibleRolls(env, user.id),
  ]);

  return json({ status: 'ok', nickname: user.nickname, groups, visible_rolls: visibleRolls });
}
