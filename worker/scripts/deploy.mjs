#!/usr/bin/env node
// 一键部署 Worker：类型检查 → 补基础 schema（幂等）→ 自动跳过已经跑过的编号迁移 →
// wrangler deploy。要解决的问题是这次开发里真实发生过的：加了新迁移文件却忘记手动
// 对着远程 D1 跑一遍，上线后功能直接因为字段不存在而报错。
//
// 用法：
//   node scripts/deploy.mjs            部署到远程（生产）：迁移 + wrangler deploy
//   node scripts/deploy.mjs --local    只对本地 D1 补迁移，不部署（调本地环境用）
//   node scripts/deploy.mjs --skip-typecheck   跳过类型检查这一步
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const workerDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const remote = !args.includes('--local');
const skipTypecheck = args.includes('--skip-typecheck');
const flag = remote ? '--remote' : '--local';

function run(command, opts = {}) {
  console.log(`\n$ ${command}`);
  return execSync(command, { cwd: workerDir, stdio: opts.capture ? 'pipe' : 'inherit', encoding: 'utf8' });
}

function d1Command(sql) {
  const yes = remote ? ' --yes' : '';
  return run(`npx wrangler d1 execute shiyu-db ${flag} --command "${sql}"${yes}`, { capture: true });
}

function d1File(relativeSqlPath) {
  const yes = remote ? ' --yes' : '';
  run(`npx wrangler d1 execute shiyu-db ${flag} --file="${relativeSqlPath}"${yes}`);
}

function d1Query(sql) {
  const yes = remote ? ' --yes' : '';
  const raw = run(`npx wrangler d1 execute shiyu-db ${flag} --command "${sql}"${yes} --json`, { capture: true });
  return JSON.parse(raw);
}

console.log(`==> 部署目标：${remote ? '远程（生产）' : '本地'} D1`);

if (!skipTypecheck) {
  console.log('\n==> 类型检查（tsc --noEmit）');
  run('npx tsc --noEmit');
} else {
  console.log('\n==> 跳过类型检查');
}

console.log('\n==> 应用基础 schema（CREATE TABLE IF NOT EXISTS，重复跑无害）');
d1File('./src/db/schema.sql');

console.log('\n==> 确保迁移记录表存在');
d1Command('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');

const migrationsDir = path.join(workerDir, 'src/db/migrations');
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let applied = new Set();
try {
  const parsed = d1Query('SELECT name FROM _migrations');
  applied = new Set((parsed[0]?.results ?? []).map((r) => r.name));
} catch (err) {
  console.warn('无法读取已应用的迁移列表，按"一个都没跑过"处理。');
  console.warn('如果这几个迁移其实已经手动跑过，重复跑 ALTER TABLE 会直接报错——');
  console.warn('报错的话去 D1 里查一下 _migrations 表，把已经跑过的手动 INSERT 进去再重试。');
}

if (files.length === 0) {
  console.log('\n（还没有编号迁移文件，跳过这一步）');
}

for (const file of files) {
  if (applied.has(file)) {
    console.log(`跳过（已应用）：${file}`);
    continue;
  }
  console.log(`\n==> 应用迁移：${file}`);
  d1File(`./src/db/migrations/${file}`);
  d1Command(`INSERT INTO _migrations (name, applied_at) VALUES ('${file}', '${new Date().toISOString()}')`);
}

if (remote) {
  console.log('\n==> wrangler deploy');
  run('npx wrangler deploy');
  console.log('\n完成。Astro 静态站不归这个脚本管——push 到 main 会由 GitHub Actions 自动重新部署。');
} else {
  console.log('\n本地模式：只补了迁移，没有 deploy（本地起服务用 npm run dev）。');
}
