// 魔术链接 / 邀请 / 会话 token 的随机数来源。全部用 crypto.getRandomValues，
// 默认 32 字节（256bit），远超硬约束里"≥128bit"的下限。
export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomId(): string {
  return crypto.randomUUID();
}
