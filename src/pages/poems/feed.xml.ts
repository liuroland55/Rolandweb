import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { withBase } from '../../lib/site';

export async function GET(context: APIContext) {
  const poems = await getCollection('poems', (e) => e.data.draft !== true);
  return rss({
    title: '石予 · 诗',
    description: '诗与稿次。',
    site: context.site ?? 'https://liuroland55.github.io/Rolandweb',
    items: poems
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((e) => ({
        title: e.data.title,
        pubDate: e.data.date,
        link: withBase(`/poems/${e.id}`),
        description: e.data.version ?? '',
      })),
  });
}
