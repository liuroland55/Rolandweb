import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { withBase } from '../../lib/site';

export async function GET(context: APIContext) {
  const essays = await getCollection('essays', (e) => e.data.draft !== true);
  return rss({
    title: '石予 · 文章',
    description: '随笔与长文。',
    site: context.site ?? 'https://liuroland55.github.io/Rolandweb',
    items: essays
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((e) => ({
        title: e.data.title,
        pubDate: e.data.date,
        link: withBase(`/essays/${e.id}`),
        description: e.data.summary ?? '',
      })),
  });
}
