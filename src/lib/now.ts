// /now 瀑布流的排序与分页共享逻辑，index.astro（第 1 页）与 [page].astro（第 2 页起）都用它，
// 保证两边排序规则完全一致。
import { getCollection, type CollectionEntry } from 'astro:content';

export const NOW_PAGE_SIZE = 30;

export async function getSortedNowEntries(): Promise<CollectionEntry<'now'>[]> {
  const entries = await getCollection('now', (e) => e.data.draft !== true);
  return entries.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function isToday(date: Date, now: Date = new Date()): boolean {
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
