// R2 原图不走 AWS SigV4 那套预签名（不想额外申请 R2 的 S3 兼容 API 密钥），
// 改成 Worker 自己用 HMAC-SHA256 签一个短时效的 URL：
//   /api/image/{roll}/{file}?exp={unix毫秒}&sig={hmac(roll/file:exp)}
// Worker 收到请求时按同样的方式重算一遍签名，核对过期时间与签名是否匹配，
// 匹配才从 R2 读文件流回去。全程不需要真实网络上存在"这个链接"以外的任何凭证。
async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function bufToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signPath(secret: string, path: string, expiresAt: number): Promise<string> {
  const key = await hmacKey(secret);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${path}:${expiresAt}`));
  return bufToHex(sigBuf);
}

export async function buildSignedUrl(
  origin: string,
  secret: string,
  path: string,
  ttlMs: number,
): Promise<{ url: string; expiresAt: number }> {
  const expiresAt = Date.now() + ttlMs;
  const sig = await signPath(secret, path, expiresAt);
  const url = `${origin}${path}?exp=${expiresAt}&sig=${sig}`;
  return { url, expiresAt };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifySignedRequest(secret: string, path: string, url: URL): Promise<boolean> {
  const exp = Number(url.searchParams.get('exp'));
  const sig = url.searchParams.get('sig');
  if (!exp || !sig) return false;
  if (Date.now() > exp) return false;
  const expected = await signPath(secret, path, exp);
  return timingSafeEqualHex(expected, sig);
}
