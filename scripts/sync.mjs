#!/usr/bin/env node
// 把仓库里的 lib/*.js 同步到 DSH 安装目录（.dsh/plugins/feishu-plugin）。
// 仓库是唯一源，安装目录只是产物。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installed = path.join(os.homedir(), '.dsh', 'plugins', 'feishu-plugin');

if (!fs.existsSync(installed)) {
  console.log('安装目录不存在，跳过同步：' + installed);
  process.exit(0);
}

const srcDir = path.join(root, 'lib');
const dstDir = path.join(installed, 'lib');
fs.mkdirSync(dstDir, { recursive: true });

let count = 0;
for (const entry of fs.readdirSync(srcDir)) {
  if (!entry.endsWith('.js')) continue;
  const from = path.join(srcDir, entry);
  const to = path.join(dstDir, entry);
  const src = fs.readFileSync(from);
  const same = fs.existsSync(to) && fs.readFileSync(to).equals(src);
  fs.writeFileSync(to, src);
  console.log((same ? '  = ' : '  → ') + entry);
  if (!same) count += 1;
}

// package.json / patch 也带上（安装目录不改名，包名保持 feishu-plugin）
for (const name of ['package.json', 'cordis.patch.yml']) {
  const from = path.join(root, name);
  const to = path.join(installed, name);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, to);
    console.log('  → ' + name);
  }
}

console.log(count ? `\n已同步 ${count} 个文件到 ${installed}` : `\n已是最新（${installed}）`);
