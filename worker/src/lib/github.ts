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

// 分块转 base64：逐字节 += 拼字符串对几 MB 的曲谱文件太慢，String.fromCharCode(...bytes)
// 整个展开又会在字节数大时撞 JS 引擎的参数个数上限，0x8000 一段是两者都安全的折中。
function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function toBase64Utf8(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text));
}

async function putFile(env: Env, path: string, base64Content: string, message: string, logPreview: string): Promise<CommitResult> {
  if (!env.GITHUB_TOKEN) {
    // 分隔符不能用 "---"：内容本身就是带 YAML frontmatter 的 Markdown，也用 "---" 收尾，
    // 用同一个字符串当外层包装的分隔符会跟内容自己的分隔符撞在一起，日志里分不清哪个是哪个。
    console.log(
      `[github:console] would commit ${path}\n===COMMIT MESSAGE===\n${message}\n===FILE CONTENT===\n${logPreview}\n===END===`,
    );
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

  // 先看这个路径是否已存在：存在就拒绝，避免静默覆盖一篇旧文/旧文件。
  const probe = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
  if (probe.status === 200) {
    return { ok: false, path, error: '这个路径已经有文件了，换一个 slug。' };
  }

  const res = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ message, content: base64Content, branch }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[github] commit failed status=${res.status} body=${text}`);
    return { ok: false, path, error: `GitHub 返回 ${res.status}，看 Worker 日志。` };
  }
  const data = (await res.json()) as { commit?: { html_url?: string } };
  return { ok: true, path, commitUrl: data.commit?.html_url };
}

export async function commitFile(env: Env, path: string, content: string, message: string): Promise<CommitResult> {
  return putFile(env, path, toBase64Utf8(content), message, content);
}

/** 跟 commitFile 一样，但给曲谱 PDF/图片这类二进制文件用——不经过 UTF-8 文本编码这一步。 */
export async function commitBinaryFile(env: Env, path: string, bytes: ArrayBuffer, message: string): Promise<CommitResult> {
  return putFile(env, path, bytesToBase64(new Uint8Array(bytes)), message, `<binary, ${bytes.byteLength} bytes>`);
}
