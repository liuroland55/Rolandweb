// 会话与分组判断的共享类型 + 客户端 helper。
//
// 重要：这个站是纯静态输出（GitHub Pages），构建期不存在"当前访问者"这回事，
// 所以"读会话"不可能发生在服务端渲染阶段，只能是浏览器运行时向 Worker 的
// `GET /api/me` 发起一次 fetch。这里导出的函数只在浏览器里跑，被侧栏登录区
// 与 /photos 权限 island 两处引用（同一份"登录状态"逻辑，不重复实现）。
//
// API_BASE 由构建时的 PUBLIC_API_BASE 环境变量决定。当前部署在 github.io 子路径、
// 没有自定义域名，站点和 Worker 是两个不同的源（github.io vs *.workers.dev），
// 所以这里必须是 Worker 的完整 URL，不能留空——GitHub Actions 的构建步骤从仓库的
// PUBLIC_API_BASE 变量读这个值（见 .github/workflows/deploy.yml），本地开发在
// 仓库根建一个 .env 写 PUBLIC_API_BASE=http://127.0.0.1:8787。
// 留空时（还没部署 Worker、还没配这个变量）请求会打到站点自己的源上 404，
// fetchSession() 会静默按未登录处理，不会报错或崩页面。
// 若未来换成自定义域名 + 同顶级域名的 Cloudflare Route 分流，这里才可以留空同源。
const API_BASE = import.meta.env.PUBLIC_API_BASE ?? '';

export interface Session {
  nickname: string;
  groups: string[];
  visible_rolls: string[];
}

export type SessionResult = { status: 'anon' } | { status: 'ok'; session: Session };

/** 向 Worker 请求当前会话。网络失败或未登录一律按匿名处理，绝不抛出异常打断渲染。 */
export async function fetchSession(): Promise<SessionResult> {
  try {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
    if (!res.ok) return { status: 'anon' };
    const data = await res.json();
    if (!data || data.status === 'anon') return { status: 'anon' };
    return { status: 'ok', session: data as Session };
  } catch {
    return { status: 'anon' };
  }
}

export function isInGroup(session: Session | null, groupName: string): boolean {
  return !!session?.groups?.includes(groupName);
}

export function canSeeRoll(session: Session | null, roll: string): boolean {
  return !!session?.visible_rolls?.includes(roll);
}

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
