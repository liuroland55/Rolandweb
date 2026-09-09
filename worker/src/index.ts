import type { Env } from './env';
import { corsHeaders } from './lib/cors';
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

    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value as string);
    }
    return response;
  },
};

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const { pathname } = url;
  const { method } = request;

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

  return new Response('Not Found', { status: 404 });
}
