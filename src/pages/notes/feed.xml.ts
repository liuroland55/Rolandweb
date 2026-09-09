import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

export async function GET(context: APIContext) {
  const notes = await getCollection('notes', (e) => e.data.draft !== true);
  return rss({
    title: '石予 · 笔记',
    description: '随手写下的短句。',
    site: context.site ?? 'https://shiyu.me',
    items: notes
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((e) => ({
        title: e.data.title,
        pubDate: e.data.date,
        link: `/notes`,
        description: e.body ?? '',
      })),
  });
}
