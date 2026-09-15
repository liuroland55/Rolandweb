-- schema.sql 用 CREATE TABLE IF NOT EXISTS，已经建过表的库不会自动补上新列，
-- 这个文件只给已经部署过的 D1（本地或远程）手动跑一次，新建的库不需要——
-- schema.sql 里 users 表的定义已经直接包含这几列了。
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN avatar_key TEXT;
ALTER TABLE users ADD COLUMN signature TEXT;
ALTER TABLE users ADD COLUMN title_prefix TEXT;
