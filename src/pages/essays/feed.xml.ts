import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

export async function GET(context: APIContext) {
  const essays = await getCollection('essays', (e) => e.data.draft !== true);
  return rss({
    title: '石予 · 文章',
    description: '随笔与长文。',
    site: context.site ?? 'https://shiyu.me',
    items: essays
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((e) => ({
        title: e.data.title,
        pubDate: e.data.date,
        link: `/essays/${e.id}`,
        description: e.data.summary ?? '',
      })),
  });
}
