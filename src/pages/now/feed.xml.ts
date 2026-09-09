import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getSortedNowEntries } from '../../lib/now';

export async function GET(context: APIContext) {
  const entries = await getSortedNowEntries();
  return rss({
    title: '石予 · 此刻 Now',
    description: '随手记的句子、诗行草稿、正在听的专辑、随拍与代码片段。',
    site: context.site ?? 'https://shiyu.me',
    items: entries.map((e) => ({
      title: `${e.data.kind} · ${e.data.title}`,
      pubDate: e.data.date,
      link: `/now`,
      description: e.data.body,
    })),
  });
}
