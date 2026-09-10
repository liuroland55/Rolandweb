// 把一个文件提交进 GitHub 仓库（Contents API）。创作者界面 /write 用它把新内容写进
// src/content/<collection>/，push 会触发 GitHub Actions 重新构建部署。
// 没配 GITHUB_TOKEN 时退回 console 实现：把将要写入的文件打印在 wrangler dev 终端里，
// 本地开发不用真的动仓库也能把整个表单流程跑通（和 mail.ts 的兜底思路一致）。
import type { Env } from '../env';

export interface CommitResult {
  ok: boolean;
  path: string;
  commitUrl?: string;
  error?: string;
}

function toBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export async function commitFile(env: Env, path: string, content: string, message: string): Promise<CommitResult> {
  if (!env.GITHUB_TOKEN) {
    console.log(`[github:console] would commit ${path}\n--- message: ${message}\n${content}\n---`);
    return { ok: true, path, commitUrl: undefined };
  }

  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || 'main';
  const url = `https://api.github.com/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  const headers = {
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'shiyu-worker',
    'Content-Type': 'application/json',
  };

  // 先看这个路径是否已存在：存在就拒绝，避免静默覆盖一篇旧文。
  const probe = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
  if (probe.status === 200) {
    return { ok: false, path, error: '这个路径已经有文件了，换一个 slug。' };
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ message, content: toBase64Utf8(content), branch }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[github] commit failed status=${res.status} body=${text}`);
    return { ok: false, path, error: `GitHub 返回 ${res.status}，看 Worker 日志。` };
  }
  const data = (await res.json()) as { commit?: { html_url?: string } };
  return { ok: true, path, commitUrl: data.commit?.html_url };
}
