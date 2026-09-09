import type { Env } from '../env';
import { readSession } from '../lib/session';
import { getAlbum, getUserById, canAccessAlbum } from '../lib/db';
import { verifySignedRequest } from '../lib/signing';

export async function handleDownload(request: Request, env: Env, roll: string): Promise<Response> {
  const album = await getAlbum(env, roll);
  if (!album || album.visibility === 'private') return new Response('Not Found', { status: 404 });

  const url = new URL(request.url);
  const hasValidSignature = await verifySignedRequest(env.SIGNING_SECRET, url.pathname, url);

  if (!hasValidSignature && album.visibility !== 'public') {
    const session = await readSession(env, request);
    const user = session ? await getUserById(env, session.userId) : null;
    const allowed = await canAccessAlbum(env, album, user?.id ?? null, user?.role ?? null);
    if (!allowed) return new Response('Forbidden', { status: 403 });
  }

  const object = await env.PHOTOS.get(`${album.r2_prefix}/download.zip`);
  if (!object) return new Response('Not Found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${album.roll}.zip"`,
    },
  });
}
