export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...init.headers },
  });
}

/** 读 JSON 或表单 body，两种都支持——表单是给"无 JS 也能提交"的渐进增强用的。 */
export async function readBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as Record<string, string>;
  }
  const form = await request.formData();
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}
