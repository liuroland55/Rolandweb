import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { withBase } from '../../lib/site';

export async function GET(context: APIContext) {
  const band = await getCollection('band', (e) => e.data.draft !== true);
  return rss({
    title: '石予 · 乐队',
    description: '乐队曲目：曲谱与相关链接。',
    site: context.site ?? 'https://liuroland55.github.io/Rolandweb',
    items: band
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((e) => ({
        title: `${e.data.instrument} · ${e.data.title}`,
        pubDate: e.data.date,
        link: withBase('/band'),
        description: e.body ?? '',
      })),
  });
}
