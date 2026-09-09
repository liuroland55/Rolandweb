-- D1 数据表。日期一律存 ISO 8601 字符串（new Date().toISOString()），
-- 方便直接在 JS 里 new Date(row.created_at) 而不用另外转换。
-- 本地开发：npm run db:migrate:local；部署到真实账号后：npm run db:migrate:remote。

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  created_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_groups (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, group_id)
);

-- roll 是相册的自然键，同时也是 R2 前缀（对应 Astro 内容里 photos collection 的 `roll` 字段）。
CREATE TABLE IF NOT EXISTS albums (
  roll TEXT PRIMARY KEY,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'group', 'private')),
  r2_prefix TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS album_groups (
  roll TEXT NOT NULL REFERENCES albums (roll) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  PRIMARY KEY (roll, group_id)
);

CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  used_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL REFERENCES users (id),
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  roll TEXT NOT NULL REFERENCES albums (roll) ON DELETE CASCADE,
  email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS magic_links (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status);
CREATE INDEX IF NOT EXISTS idx_invites_group ON invites (group_id);
CREATE INDEX IF NOT EXISTS idx_magic_links_email ON magic_links (email);
