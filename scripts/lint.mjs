#!/usr/bin/env node
// 语法自检：所有 js 过 node --check，配置文件能解析。
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [];
for (const dir of ['lib', 'scripts']) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) continue;
  for (const entry of fs.readdirSync(full)) {
    if (entry.endsWith('.js') || entry.endsWith('.mjs')) targets.push(path.join(full, entry));
  }
}

let failed = 0;
for (const file of targets) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log('ok   ', path.relative(root, file));
  } catch (error) {
    failed += 1;
    console.log('FAIL ', path.relative(root, file));
    console.log(String(error.stderr || error.message).split('\n').slice(0, 4).join('\n'));
  }
}

// 配置能解析
try {
  JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  console.log('ok    package.json');
} catch (error) {
  failed += 1;
  console.log('FAIL  package.json:', error.message);
}

if (!fs.existsSync(path.join(root, 'cordis.patch.yml'))) {
  failed += 1;
  console.log('FAIL  cordis.patch.yml 不存在');
} else {
  console.log('ok    cordis.patch.yml');
}

console.log(failed ? `\n${failed} 项失败` : `\n全部通过（${targets.length + 2} 项）`);
process.exit(failed ? 1 : 0);
