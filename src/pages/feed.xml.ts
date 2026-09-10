// 全站合流 RSS：文章 / 诗 / 笔记 / 乐 / 影，按日期倒序。
// 私密内容（相册、group/private 的 now）不进这里——见 CLAUDE.md 硬约束 5。
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { withBase } from '../lib/site';

export async function GET(context: APIContext) {
  const [essays, poems, notes, music, films] = await Promise.all([
    getCollection('essays', (e) => e.data.draft !== true),
    getCollection('poems', (e) => e.data.draft !== true),
    getCollection('notes', (e) => e.data.draft !== true),
    getCollection('music', (e) => e.data.draft !== true),
    getCollection('films', (e) => e.data.draft !== true),
  ]);

  const items = [
    ...essays.map((e) => ({
      title: `文章 · ${e.data.title}`,
      pubDate: e.data.date,
      link: withBase(`/essays/${e.id}`),
      description: e.data.summary ?? '',
    })),
    ...poems.map((e) => ({
      title: `诗 · ${e.data.title}`,
      pubDate: e.data.date,
      link: withBase(`/poems/${e.id}`),
      description: e.data.version ?? '',
    })),
    ...notes.map((e) => ({
      title: `笔记 · ${e.data.title}`,
      pubDate: e.data.date,
      link: withBase('/notes'),
      description: e.body ?? '',
    })),
    ...music.map((e) => ({
      title: `乐 · ${e.data.title}`,
      pubDate: e.data.date,
      link: withBase('/music'),
      description: e.body ?? '',
    })),
    ...films.map((e) => ({
      title: `影 · ${e.data.title}`,
      pubDate: e.data.date,
      link: withBase('/films'),
      description: e.body ?? '',
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: '石予 · 全站 RSS',
    description: '随笔、诗、笔记、音乐与影评的合流订阅。',
    site: context.site ?? 'https://liuroland55.github.io/Rolandweb',
    items,
  });
}
