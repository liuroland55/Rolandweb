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
    // 卷所属的分组只在 Worker 的 D1（album_groups 表）里判权限，不进 Astro 内容集合、
    // 不进 git：分组名字属于站点管理信息，即使不渲染出来，写进公开仓库的文件里
    // 也算泄露（见跟站主的讨论）。这里只留最粗粒度的可见范围三态。
    visibility: z.enum(['public', 'group', 'private']),
    download: z.object({ size: z.string() }).optional(),
    friend_note: z.string().optional(),
  }),
});

// 乐队：站主自己乐队的曲目，每个文件一首。按乐器区分（吉他/贝斯/鼓/主唱……），
// 自由文本，不是预设的枚举——列表页按这个字段分组，出现哪些乐器完全由写文件的人决定。
const band = defineCollection({
  loader: collectionOf('band'),
  schema: z.object({
    ...commonFields,
    instrument: z.string(),
    composer: z.string().optional(),
    // url 是站内相对路径（曲谱文件提交进 public/scores/ 之后的地址），渲染时要走 withBase()，
    // 跟站内其他手写链接一个道理，见 CLAUDE.md 架构备忘。曲谱只收 PDF。
    score: z
      .object({
        url: z.string(),
        filename: z.string().optional(),
      })
      .optional(),
    links: z
      .array(
        z.object({
          label: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
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

export const collections = { essays, poems, notes, music, films, photos, now, pages, band };
