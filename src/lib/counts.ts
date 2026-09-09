// 全站计数：供侧栏索引、页脚版权页在构建期使用。
// 用 try/catch 兜底是因为 Phase 2（骨架组件）先于 Phase 3（内容模型）落地：
// 在 src/content/config.ts 尚未注册某个 collection 时，getCollection 会抛错，
// 此时返回空数组即可，不影响骨架页面先跑起来；Phase 3 内容落地后这里无需再改。
import { getCollection } from 'astro:content';

type SectionName = 'essays' | 'poems' | 'notes' | 'music' | 'films' | 'photos' | 'now';

async function safeCollection(name: SectionName): Promise<any[]> {
  try {
    const collection = await (getCollection as any)(name, (entry: any) => entry.data.draft !== true);
    return collection ?? [];
  } catch {
    return [];
  }
}

export interface SectionCounts {
  essays: number;
  poems: number;
  notes: number;
  music: number;
  films: number;
  /** 公开 + 好友组可见的相册卷数（不含 private） */
  photosRolls: number;
  /** 公开 + 好友组可见的照片总张数（不含 private） */
  photosPhotos: number;
  /** group 或 private 的卷数，仅作聚合展示，不带任何链接/卷名 */
  photosRestrictedRolls: number;
  now: number;
  /** 今日发布的 Now 条数，用于侧栏「N 新」徽标 */
  nowNewToday: number;
  /** 文章 + 诗 + 笔记 + 乐 + 影 + 公开相册卷数 之和 */
  total: number;
}

export type ArchiveYearCounts = Record<string, number>;

export async function getSectionCounts(): Promise<SectionCounts> {
  const [essays, poems, notes, music, films, photos, now] = await Promise.all([
    safeCollection('essays'),
    safeCollection('poems'),
    safeCollection('notes'),
    safeCollection('music'),
    safeCollection('films'),
    safeCollection('photos'),
    safeCollection('now'),
  ]);

  const publicPhotos = photos.filter((p) => p.data.visibility !== 'private');
  const restrictedPhotos = photos.filter((p) => p.data.visibility !== 'public');

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  return {
    essays: essays.length,
    poems: poems.length,
    notes: notes.length,
    music: music.length,
    films: films.length,
    photosRolls: publicPhotos.length,
    photosPhotos: publicPhotos.reduce((sum, p) => sum + (p.data.count ?? 0), 0),
    photosRestrictedRolls: restrictedPhotos.length,
    now: now.length,
    nowNewToday: now.filter((n) => isToday(new Date(n.data.date))).length,
    total:
      essays.length + poems.length + notes.length + music.length + films.length + publicPhotos.length,
  };
}

/** 按年份统计文章/诗/笔记/乐/影的条目数，供 /archive 与页脚「归档」使用。 */
export async function getArchiveCounts(): Promise<ArchiveYearCounts> {
  const groups = await Promise.all([
    safeCollection('essays'),
    safeCollection('poems'),
    safeCollection('notes'),
    safeCollection('music'),
    safeCollection('films'),
  ]);

  const counts: ArchiveYearCounts = {};
  for (const entries of groups) {
    for (const entry of entries) {
      const year = String(new Date(entry.data.date).getFullYear());
      counts[year] = (counts[year] ?? 0) + 1;
    }
  }
  return counts;
}
