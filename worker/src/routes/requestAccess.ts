import type { Env } from '../env';
import { json, readBody } from '../lib/http';
import { randomId } from '../lib/crypto';
import { getAlbum } from '../lib/db';

export async function handleRequestAccess(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request);
  const roll = (body.roll ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const message = (body.message ?? '').trim();
  const wantsJson = request.headers.get('Accept')?.includes('application/json') ?? false;

  if (!roll || !email || !email.includes('@')) {
    return wantsJson ? json({ ok: false }, { status: 400 }) : new Response('Bad Request', { status: 400 });
  }

  const album = await getAlbum(env, roll);
  if (!album || album.visibility === 'private') return new Response('Not Found', { status: 404 });

  await env.DB.prepare(
    'INSERT INTO requests (id, roll, email, message, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(randomId(), roll, email, message || null, 'pending', new Date().toISOString())
    .run();

  if (wantsJson) return json({ ok: true });
  return Response.redirect(`${env.SITE_ORIGIN}/photos/${roll}?requested=1#request-access`, 303);
}
