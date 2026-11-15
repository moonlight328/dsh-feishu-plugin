// /save 端到端：整篇覆盖保存一篇真文档，验证删块 + 重建 + 备份。
import { apply } from 'feishu-plugin';
import fs from 'node:fs';
import YAML from 'yaml';

const doc = YAML.parse(fs.readFileSync('C:/Users/19941/.dsh/profiles/desktop/cordis.patch.yml', 'utf8'));
const cfg = (doc.find((e) => e && e.id === 'feishu') || {}).config || {};
const handle = apply({ effect: (fn) => fn(), tools: { register: () => () => {} }, get: () => null }, cfg);
await new Promise((r) => setTimeout(r, 800));
const base = `http://127.0.0.1:${handle.port}/feishu-panel`;
console.log('port', handle.port);

const call = async (path, init) => {
  const response = await fetch(base + path, { ...init, headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(40000) });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

const id = process.argv[2];
if (!id) {
  console.log('pass a documentId as argv[2]');
  process.exit(2);
}

const before = await call(`/doc?id=${id}`);
console.log('before   :', JSON.stringify(before.body?.content).slice(0, 160));

const saved = await call('/save', {
  method: 'POST',
  body: JSON.stringify({
    id,
    markdown: '# 面板编辑测试\n\n这是从侧栏编辑框保存回来的内容。\n\n- 改一行\n- 再加一行\n',
  }),
});
console.log('save     :', saved.status, JSON.stringify(saved.body).slice(0, 300));
console.log('backup   :', saved.body?.backupFile, fs.existsSync(saved.body?.backupFile || '') ? '(存在)' : '(不存在)');
process.exit(0);
