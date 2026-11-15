#!/usr/bin/env node
// 发布：自检 → bump 版本 → 写 CHANGELOG → 同步安装目录 → commit → tag → push
// 用法：node scripts/release.mjs "本次改动说明" [major|minor|patch]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { cwd: root, stdio: 'pipe', ...opts }).toString().trim();
const say = (msg) => console.log(msg);

const note = process.argv[2];
const bumpKind = process.argv[3] || 'minor';
if (!note) {
  console.error('用法: node scripts/release.mjs "本次改动说明" [major|minor|patch]');
  process.exit(1);
}

// 1. 自检
say('· 语法自检');
execFileSync(process.execPath, [path.join(root, 'scripts', 'lint.mjs')], { cwd: root, stdio: 'inherit' });

// 2. bump 版本
const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
const prev = String(pkg.version);
const parts = prev.split('.').map(Number);
const [major, minor, patch] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
const next =
  bumpKind === 'major'
    ? `${major + 1}.0.0`
    : bumpKind === 'patch'
      ? `${major}.${minor}.${patch + 1}`
      : `${major}.${minor + 1}.0`;
pkg.version = next;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
say(`· 版本 ${prev} → ${next}`);

// 3. 写 CHANGELOG
const changeFile = path.join(root, 'CHANGELOG.md');
const today = new Date().toISOString().slice(0, 10);
const oldLog = fs.existsSync(changeFile) ? fs.readFileSync(changeFile, 'utf8') : '# 更新日志\n';
const marker = '## ';
const head = oldLog.indexOf(marker);
const entry = `## ${next}（${today}）\n\n- ${note}\n\n`;
fs.writeFileSync(changeFile, head >= 0 ? oldLog.slice(0, head) + entry + oldLog.slice(head) : oldLog + '\n' + entry, 'utf8');
say('· CHANGELOG 已更新');

// 4. 同步到安装目录（仓库是唯一源）
say('· 同步到安装目录');
try {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'sync.mjs')], { cwd: root, stdio: 'inherit' });
} catch {
  say('· 同步失败（不影响提交）');
}

// 5. 提交 + 标签 + 推送
run('git', ['add', '-A']);
const status = run('git', ['status', '--porcelain']);
if (!status) {
  say('· 没有改动，跳过提交');
} else {
  run('git', ['commit', '-m', `${note} (v${next})`]);
  say('· 已提交');
  try {
    run('git', ['tag', '-a', `v${next}`, '-m', `v${next}: ${note}`]);
    say('· 已打标签 v' + next);
  } catch {
    say('· 标签已存在，跳过');
  }
}

try {
  run('git', ['push', 'origin', 'HEAD', '--follow-tags']);
  say('· 已推送');
} catch (error) {
  console.error('· 推送失败：' + String(error.stderr || error.message).split('\n')[0]);
  process.exit(1);
}
say(`\n完成：v${next}`);
