import type { Env } from './env';
import { corsHeaders } from './lib/cors';
import { isTrustedOrigin } from './lib/csrf';
import { handleLogin } from './routes/login';
import { handleCallback } from './routes/callback';
import { handleLogout } from './routes/logout';
import { handleMe } from './routes/me';
import { handleAlbum } from './routes/album';
import { handleDownload } from './routes/download';
import { handleImage } from './routes/image';
import { handleRequestAccess } from './routes/requestAccess';
import { handleJoinPage, handleJoinSubmit } from './routes/join';
import { handleAdmin } from './routes/admin';
import { handleWrite } from './routes/write';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    let response: Response;
    try {
      response = await route(request, env, url);
    } catch (err) {
      console.error(err);
      response = new Response('Internal Error', { status: 500 });
    }

    // Response.redirect() 和一部分平台内建响应的 headers 是不可变的（"immutable" guard），
    // 直接 .set() 会抛 TypeError——重登录/退出/加入这些路由都会返回重定向，且现在跨源
    // 场景下 cors 基本总是非空，这条路必然会走到。稳妥做法是套一层新 Response，
    // 而不是原地改 headers。
    if (Object.keys(cors).length > 0) {
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(cors)) headers.set(key, value as string);
      response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    return response;
  },
};

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const { pathname } = url;
  const { method } = request;

  // 会话 cookie 是 SameSite=None（两个跨源部署，见 session.ts），CSRF 的默认防护弱了一截，
  // 这里用 Origin/Referer 校验补上——所有写操作都必须来自站点自己或 Worker 自己，见 lib/csrf.ts。
  if (method === 'POST' && !isTrustedOrigin(request, env)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (pathname === '/api/login' && method === 'POST') return handleLogin(request, env);
  if (pathname === '/api/callback' && method === 'GET') return handleCallback(request, env);
  if (pathname === '/api/logout' && method === 'POST') return handleLogout(request, env);
  if (pathname === '/api/me' && method === 'GET') return handleMe(request, env);
  if (pathname === '/api/request-access' && method === 'POST') return handleRequestAccess(request, env);

  if (pathname.startsWith('/api/album/') && method === 'GET') {
    return handleAlbum(request, env, pathname.slice('/api/album/'.length));
  }
  if (pathname.startsWith('/api/download/') && method === 'GET') {
    return handleDownload(request, env, decodeURIComponent(pathname.slice('/api/download/'.length)));
  }
  if (pathname.startsWith('/api/image/') && method === 'GET') {
    return handleImage(request, env, url);
  }

  if (pathname.startsWith('/join/') && method === 'GET') {
    return handleJoinPage(request, env, pathname.slice('/join/'.length));
  }
  if (pathname.startsWith('/api/join/') && method === 'POST') {
    return handleJoinSubmit(request, env, decodeURIComponent(pathname.slice('/api/join/'.length)));
  }

  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/admin/')) {
    return handleAdmin(request, env, url);
  }
  if (pathname === '/write') return handleWrite(request, env);

  return new Response('Not Found', { status: 404 });
}
