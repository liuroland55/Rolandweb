import type { Env } from '../env';

// 头像是用户自己选择要公开展示的东西，不算硬约束 5 说的"私密资源"，
// 所以直接公开读，不走 lib/signing.ts 的签名链接那一套（跟 /api/image/ 不一样）。
export async function handleAvatar(env: Env, userId: string): Promise<Response> {
  const object = await env.PHOTOS.get(`avatars/${userId}`);
  if (!object) return new Response('Not Found', { status: 404 });

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
