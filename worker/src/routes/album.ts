import type { Env } from '../env';
import { json } from '../lib/http';
import { readSession } from '../lib/session';
import { getAlbum, getUserById, canAccessAlbum } from '../lib/db';
import { buildSignedUrl } from '../lib/signing';

export async function handleAlbum(request: Request, env: Env, roll: string): Promise<Response> {
  const album = await getAlbum(env, roll);
  const session = await readSession(env, request);
  const user = session ? await getUserById(env, session.userId) : null;

  if (!album) return new Response('Not Found', { status: 404 });

  // private 卷对非 admin 一律 404：不透露它存在，见硬约束 5。
  if (album.visibility === 'private' && user?.role !== 'admin') {
    return new Response('Not Found', { status: 404 });
  }
  if (album.visibility !== 'private') {
    const allowed = await canAccessAlbum(env, album, user?.id ?? null, user?.role ?? null);
    if (!allowed) return new Response('Forbidden', { status: 403 });
  }

  const origin = new URL(request.url).origin;
  const listed = await env.PHOTOS.list({ prefix: `${album.r2_prefix}/` });
  const imageObjects = listed.objects.filter((o) => !o.key.endsWith('/') && !o.key.endsWith('download.zip'));

  const images = await Promise.all(
    imageObjects.map(async (o) => {
      const path = `/api/image/${o.key}`;
      const { url } = await buildSignedUrl(origin, env.SIGNING_SECRET, path, 15 * 60 * 1000);
      return {
        signed_url: url,
        w: Number(o.customMetadata?.width ?? 0),
        h: Number(o.customMetadata?.height ?? 0),
        caption: o.customMetadata?.caption ?? '',
      };
    }),
  );

  const downloadPath = `/api/download/${album.roll}`;
  const { url: downloadUrl, expiresAt } = await buildSignedUrl(
    origin,
    env.SIGNING_SECRET,
    downloadPath,
    30 * 24 * 60 * 60 * 1000,
  );

  return json({
    images,
    download: { signed_url: downloadUrl, expires_at: new Date(expiresAt).toISOString() },
  });
}
