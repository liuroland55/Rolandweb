// 日期、相对时间、字数等纯函数格式化工具。不依赖运行环境，构建期与浏览器均可用。

const UNITS: [number, string][] = [
  [60, '秒'],
  [60, '分钟'],
  [24, '小时'],
  [30, '天'],
  [12, '月'],
  [Number.POSITIVE_INFINITY, '年'],
];

/** 把日期格式化为「N 分钟前 / N 小时前 / N 天前」，超过约 30 天回退为绝对日期。 */
export function relativeTime(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  let diff = Math.max(0, (now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return '刚刚';
  if (diff >= 60 * 60 * 24 * 30) return formatDate(d);

  let unitName = '秒';
  for (const [size, name] of UNITS) {
    if (diff < size) {
      unitName = name;
      break;
    }
    diff = Math.floor(diff / size);
    unitName = name;
  }
  return `${Math.floor(diff)} ${unitName}前`;
}

/** 绝对日期，默认 `2026.09.08` 形式，用于 <time> 的可读文案。 */
export function formatDate(date: Date | string, opts: { withYear?: boolean } = {}): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return opts.withYear === false ? `${m}.${day}` : `${y}.${m}.${day}`;
}

/** ISO 字符串，供 <time datetime> 使用。 */
export function toISODate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString();
}

/** 中英混排字数估算：中日韩字符按 1 计，其余按空白分词计。 */
export function wordCount(text: string): number {
  const cjk = text.match(/[一-鿿぀-ヿ가-힯]/g) ?? [];
  const rest = text
    .replace(/[一-鿿぀-ヿ가-힯]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return cjk.length + rest.length;
}

/** 按中文阅读速度（约 400 字/分钟）估算阅读时间，向上取整，最少 1 分钟。 */
export function readingTime(text: string): number {
  return Math.max(1, Math.ceil(wordCount(text) / 400));
}
