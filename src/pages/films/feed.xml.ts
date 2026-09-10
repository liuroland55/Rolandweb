import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { withBase } from '../../lib/site';

export async function GET(context: APIContext) {
  const films = await getCollection('films', (e) => e.data.draft !== true);
  return rss({
    title: '石予 · 影',
    description: '观影记录与短评。',
    site: context.site ?? 'https://liuroland55.github.io/Rolandweb',
    items: films
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((e) => ({
        title: e.data.title,
        pubDate: e.data.date,
        link: withBase('/films'),
        description: e.body ?? '',
      })),
  });
}
