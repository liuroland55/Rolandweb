import type { Env } from '../env';
import { verifySignedRequest } from '../lib/signing';
import { getAlbum } from '../lib/db';

export async function handleImage(request: Request, env: Env, url: URL): Promise<Response> {
  const key = decodeURIComponent(url.pathname.replace('/api/image/', ''));

  // 签名本身就是"曾经被 /api/album/:roll 允许过"的凭证，15 分钟内有效；
  // 这里不重新查会话——短时效已经把泄露窗口压得很小，见 README 安全细节。
  const validSignature = await verifySignedRequest(env.SIGNING_SECRET, url.pathname, url);
  if (!validSignature) return new Response('Forbidden', { status: 403 });

  const roll = key.split('/')[0];
  const album = await getAlbum(env, roll);
  if (!album) return new Response('Not Found', { status: 404 });

  const object = await env.PHOTOS.get(key);
  if (!object) return new Response('Not Found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'private, max-age=900',
    },
  });
}
