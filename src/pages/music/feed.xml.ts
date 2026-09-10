import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { withBase } from '../../lib/site';

export async function GET(context: APIContext) {
  const music = await getCollection('music', (e) => e.data.draft !== true);
  return rss({
    title: '石予 · 乐',
    description: '听录、评分与偶尔的吉他改编。',
    site: context.site ?? 'https://liuroland55.github.io/Rolandweb',
    items: music
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((e) => ({
        title: e.data.title,
        pubDate: e.data.date,
        link: withBase('/music'),
        description: e.body ?? '',
      })),
  });
}
