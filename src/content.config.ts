// 内容模型：每个 collection 对应 src/content/<name>/ 下的 Markdown / MDX 文件。
// 通用字段见 commonFields；各栏目专属字段见对应 schema。加新栏目时照抄这个模式，
// 见 CLAUDE.md「如何加一个新栏目」。
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const marginaliaNote = z.object({
  text: z.string(),
  date: z.string().optional(),
});

const commonFields = {
  title: z.string(),
  title_en: z.string().optional(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  draft: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  lang: z.enum(['zh', 'en']).optional(),
  notes: z.array(marginaliaNote).optional(),
};

function collectionOf(name: string) {
  return glob({ pattern: '**/*.{md,mdx}', base: `./src/content/${name}` });
}

const appleMusicRef = z.object({
  kind: z.enum(['song', 'album', 'playlist']),
  id: z.string(),
  i: z.string().optional(),
  slug: z.string().optional(),
  storefront: z.string().optional(),
  title: z.string(),
  artist: z.string().optional(),
  year: z.number().optional(),
});

const essays = defineCollection({
  loader: collectionOf('essays'),
  schema: z.object({
    ...commonFields,
    summary: z.string().optional(),
    hero: z.enum(['inverted', 'plain']).optional(),
  }),
});

const poems = defineCollection({
  loader: collectionOf('poems'),
  schema: z
    .object({
      ...commonFields,
      version: z.string().optional(),
      previous: z.string().optional(),
    })
    .omit({ tags: true }), // 诗不给标签
});

const notes = defineCollection({
  loader: collectionOf('notes'),
  schema: z.object({
    ...commonFields,
    promote_to: z.string().optional(),
  }),
});

const music = defineCollection({
  loader: collectionOf('music'),
  schema: z.object({
    ...commonFields,
    items: z
      .array(
        z.object({
          album: z.string(),
          artist: z.string(),
          year: z.number(),
          rating: z.number().min(0).max(5),
          comment: z.string().optional(),
        }),
      )
      .optional(),
    own_recording: z
      .object({
        title: z.string(),
        file: z.string(),
        duration: z.string(),
        note: z.string().optional(),
      })
      .optional(),
    apple_music: appleMusicRef.optional(),
  }),
});

const films = defineCollection({
  loader: collectionOf('films'),
  schema: z.object({
    ...commonFields,
    items: z.array(
      z.object({
        title: z.string(),
        year: z.number(),
        director: z.string().optional(),
        rating: z.number().min(0).max(5),
        comment: z.string().optional(),
      }),
    ),
  }),
});

const photos = defineCollection({
  loader: collectionOf('photos'),
  schema: z.object({
    ...commonFields,
    roll: z.string(),
    film_stock: z.string().optional(),
    shot_at: z.coerce.date(),
    count: z.number(),
    cover: z.string().optional(),
    visibility: z.enum(['public', 'group', 'private']),
    groups: z.array(z.string()).optional(),
    download: z.object({ size: z.string() }).optional(),
    friend_note: z.string().optional(),
  }),
});

const now = defineCollection({
  loader: collectionOf('now'),
  schema: z.object({
    ...commonFields,
    kind: z.enum(['句子', '诗行', '听到', '拍到', '代码', '书摘']),
    body: z.string(),
    ref: z.string().optional(),
    media: z.string().optional(),
    apple_music: appleMusicRef.optional(),
    visibility: z.enum(['public', 'group', 'private']).optional(),
  }),
});

// 独立长文页面（如 /about），不进侧栏计数，也不参与归档。
const pages = defineCollection({
  loader: collectionOf('pages'),
  schema: z.object({
    title: z.string(),
    title_en: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const collections = { essays, poems, notes, music, films, photos, now, pages };
