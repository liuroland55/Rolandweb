// 创作者界面 /write：在浏览器里用一个表单发一条内容（文章 / 诗 / 笔记 / Now），
// 提交后由 Worker 把 Markdown 文件写进仓库的 src/content/<collection>/，
// GitHub Actions 随即重新构建部署。和 /admin 一样：仅 admin 可见（否则 404），
// 整页服务端渲染，原生 <form method="post">，零客户端 JS，GitHub token 只在 Worker 里。
// 乐 / 影 / 照片的 frontmatter 是嵌套结构（items / apple_music / roll），仍然走 git 直接写文件。
import type { Env } from '../env';
import { readSession } from '../lib/session';
import { getUserById } from '../lib/db';
import { renderPage, escapeHtml } from '../lib/html';
import { readBody } from '../lib/http';
import { commitFile } from '../lib/github';

const COLLECTIONS = ['essays', 'poems', 'notes', 'now'] as const;
type Collection = (typeof COLLECTIONS)[number];
const KINDS = ['句子', '诗行', '听到', '拍到', '代码', '书摘'] as const;

const LABEL: Record<Collection, string> = { essays: '文章', poems: '诗', notes: '笔记', now: 'Now' };

interface FormValues {
  collection: Collection;
  title: string;
  slug: string;
  date: string;
  tags: string;
  draft: boolean;
  summary: string;
  hero: boolean;
  version: string;
  promote_to: string;
  kind: string;
  ref: string;
  body: string;
}

function nowInShanghai(): string {
  // datetime-local 需要 "YYYY-MM-DDTHH:mm"；按上海时间给默认值。
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
  return s.replace(' ', 'T');
}

function defaults(): FormValues {
  return {
    collection: 'now', title: '', slug: '', date: nowInShanghai(), tags: '', draft: false,
    summary: '', hero: false, version: '', promote_to: '', kind: '句子', ref: '', body: '',
  };
}

function parseValues(body: Record<string, string>): FormValues {
  const d = defaults();
  const collection = COLLECTIONS.includes(body.collection as Collection) ? (body.collection as Collection) : d.collection;
  return {
    collection,
    title: (body.title ?? '').trim(),
    slug: (body.slug ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, ''),
    date: (body.date ?? '').trim() || d.date,
    tags: (body.tags ?? '').trim(),
    draft: body.draft === 'on',
    summary: (body.summary ?? '').trim(),
    hero: body.hero === 'on',
    version: (body.version ?? '').trim(),
    promote_to: (body.promote_to ?? '').trim(),
    kind: (KINDS as readonly string[]).includes(body.kind) ? body.kind : d.kind,
    ref: (body.ref ?? '').trim(),
    body: (body.body ?? '').replace(/\r\n/g, '\n').trim(),
  };
}

// 所有标量都用 JSON.stringify 输出：合法的 JSON 字符串同时是合法的 YAML 双引号字符串，
// 引号、冒号、井号、换行都不用另外操心。
function yamlStr(s: string): string {
  return JSON.stringify(s);
}

function buildFile(v: FormValues): { path: string; content: string } {
  const lines: string[] = ['---', `title: ${yamlStr(v.title)}`, `date: ${v.date}`];
  const tags = v.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean);

  if (v.collection !== 'poems' && tags.length) lines.push(`tags: ${JSON.stringify(tags)}`);
  if (v.draft) lines.push('draft: true');

  if (v.collection === 'essays') {
    if (v.summary) lines.push(`summary: ${yamlStr(v.summary)}`);
    if (v.hero) lines.push('hero: inverted');
  }
  if (v.collection === 'poems' && v.version) lines.push(`version: ${yamlStr(v.version)}`);
  if (v.collection === 'notes' && v.promote_to) lines.push(`promote_to: ${yamlStr(v.promote_to)}`);
  if (v.collection === 'now') {
    lines.push(`kind: ${v.kind}`);
    lines.push(`body: ${yamlStr(v.body)}`);
    if (v.ref) lines.push(`ref: ${yamlStr(v.ref)}`);
  }
  lines.push('---');

  const markdown = v.collection === 'now' ? '' : `\n${v.body}\n`;
  const day = v.date.slice(0, 10);
  const hm = v.date.slice(11, 16).replace(':', '');
  const slug = v.slug || `${day}-${hm}`;
  return { path: `src/content/${v.collection}/${slug}.md`, content: `${lines.join('\n')}\n${markdown}` };
}

function renderForm(v: FormValues, error = ''): Response {
  const opt = (value: string, label: string, current: string) =>
    `<option value="${escapeHtml(value)}" ${value === current ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  return renderPage(
    '写一条',
    `<div class="masthead"><h1>写一条</h1><span><a href="/admin">后台 →</a></span></div>
     ${error ? `<p style="color:#b3261e;font-family:var(--mono);font-size:12px">${escapeHtml(error)}</p>` : ''}
     <form method="post" action="/write" style="max-width:640px">
       <label>栏目
         <select name="collection">${COLLECTIONS.map((c) => opt(c, LABEL[c], v.collection)).join('')}</select>
       </label>
       <label>标题<input type="text" name="title" required value="${escapeHtml(v.title)}" /></label>
       <label>时间<input type="datetime-local" name="date" value="${escapeHtml(v.date)}" /></label>
       <label>slug（可选，只允许 a-z 0-9 -；留空按时间生成）<input type="text" name="slug" value="${escapeHtml(v.slug)}" /></label>
       <label>标签（逗号分隔；诗不给标签）<input type="text" name="tags" value="${escapeHtml(v.tags)}" /></label>

       <label>正文（Now 是那一句话；其余是 Markdown）
         <textarea name="body" rows="14" required>${escapeHtml(v.body)}</textarea>
       </label>

       <fieldset style="border:1px solid var(--rule);padding:12px 14px;display:flex;flex-direction:column;gap:10px">
         <legend style="font-family:var(--mono);font-size:10px;color:var(--ink-meta)">按栏目生效的字段</legend>
         <label>Now · 体裁
           <select name="kind">${KINDS.map((k) => opt(k, k, v.kind)).join('')}</select>
         </label>
         <label>Now · 出处 / 曲目（ref）<input type="text" name="ref" value="${escapeHtml(v.ref)}" /></label>
         <label>文章 · 摘要<input type="text" name="summary" value="${escapeHtml(v.summary)}" /></label>
         <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="hero" ${v.hero ? 'checked' : ''} />文章 · 首页头条整块反色（hero: inverted）</label>
         <label>诗 · 稿次（如「第三稿」）<input type="text" name="version" value="${escapeHtml(v.version)}" /></label>
         <label>笔记 · 已升级为哪篇文章（essay 的 slug）<input type="text" name="promote_to" value="${escapeHtml(v.promote_to)}" /></label>
       </fieldset>

       <label style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="draft" ${v.draft ? 'checked' : ''} />先存为草稿（draft: true，不上站）</label>
       <button type="submit">发布 →</button>
     </form>`,
    { admin: true },
  );
}

export async function handleWrite(request: Request, env: Env): Promise<Response> {
  const session = await readSession(env, request);
  const user = session ? await getUserById(env, session.userId) : null;
  if (!user || user.role !== 'admin') return new Response('Not Found', { status: 404 });

  if (request.method === 'GET') return renderForm(defaults());
  if (request.method !== 'POST') return new Response('Not Found', { status: 404 });

  const v = parseValues(await readBody(request));
  if (!v.title) return renderForm(v, '标题不能为空。');
  if (!v.body) return renderForm(v, '正文不能为空。');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v.date)) return renderForm(v, '时间格式不对。');

  const { path, content } = buildFile(v);
  const result = await commitFile(env, path, content, `content(${v.collection}): ${v.title}`);
  if (!result.ok) return renderForm(v, result.error ?? '提交失败。');

  return renderPage(
    '已发布',
    `<div class="masthead"><h1>已提交</h1><span><a href="/write">再写一条 →</a></span></div>
     <div class="panel">
       <p>${escapeHtml(LABEL[v.collection])} · ${escapeHtml(v.title)}</p>
       <p style="font-family:var(--mono);font-size:11px;word-break:break-all">${escapeHtml(path)}</p>
       ${result.commitUrl ? `<p><a href="${escapeHtml(result.commitUrl)}">查看提交 →</a></p>` : '<p style="font-family:var(--mono);font-size:11px">（未配置 GITHUB_TOKEN：文件内容已打印在 Worker 日志里，没有真的写入仓库）</p>'}
     </div>
     <p>GitHub Actions 会在一两分钟内重新构建并部署，之后在 <a href="${escapeHtml(env.SITE_ORIGIN)}/${v.collection}">${escapeHtml(env.SITE_ORIGIN)}/${v.collection}</a> 能看到。</p>`,
    { admin: true },
  );
}
