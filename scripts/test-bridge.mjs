// 面板桥的端到端自检：起桥 → 真打飞书。
// 用法：在 profile 目录下跑（能解析 feishu-plugin）。
import { apply } from 'feishu-plugin';
import fs from 'node:fs';
import YAML from 'yaml';

const doc = YAML.parse(fs.readFileSync('C:/Users/19941/.dsh/profiles/desktop/cordis.patch.yml', 'utf8'));
const cfg = (doc.find((entry) => entry && entry.id === 'feishu') || {}).config || {};

const handle = apply({ effect: (fn) => fn(), tools: { register: () => () => {} }, get: () => null }, cfg);
await new Promise((resolve) => setTimeout(resolve, 800));
const port = handle.port;
console.log('bridge port =', port);
if (!port) process.exit(1);

const base = `http://127.0.0.1:${port}/feishu-panel`;
const call = async (path, init) => {
  const response = await fetch(base + path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { status: response.status, body };
};
const step = async (label, fn) => {
  try {
    const result = await fn();
    console.log(`[${result.status}] ${label}:`, JSON.stringify(result.body).slice(0, 260));
    return result.body;
  } catch (error) {
    console.log(`[ERR] ${label}:`, error.message);
    return null;
  }
};

await step('GET /status', () => call('/status'));
await step('GET /chats', () => call('/chats'));
await step('GET /docs', () => call('/docs'));
const created = await step('POST /doc', () =>
  call('/doc', { method: 'POST', body: JSON.stringify({ title: 'DSH 面板自检', markdown: '# DSH 面板自检\n\n这是从 DSH 侧栏写进来的。' }) })
);
if (created?.documentId) await step('GET /doc', () => call(`/doc?id=${created.documentId}`));
await step('未知路由', () => call('/nope'));
process.exit(0);
