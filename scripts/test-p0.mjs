// P0 回归测试（离线，不碰真飞书）：桥安全 + 保存不丢内容。
// 每条对应优化指南里的一条 P0，改坏了这里会红。
import { createBridge } from '../lib/bridge.js';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const state = {
  blocks: [],
  appendCalls: [],
  deleteCalls: [],
  readDocCalls: 0,
  revision: 11,
};

const fakeFeishu = {
  settings: () => ({ baseUrl: 'https://open.feishu.cn', appId: 'cli_fake', appSecret: 'fake', domain: 'feishu' }),
  listChildBlocks: async () => state.blocks.map((b) => ({ ...b })),
  documentRevision: async () => state.revision,
  readDoc: async () => {
    state.readDocCalls += 1;
    return 'doc';
  },
  appendBlocks: async (_id, children) => {
    state.appendCalls.push(children.length);
    return children.length;
  },
  deleteChildren: async (_id, start, end) => {
    state.deleteCalls.push([start, end]);
    return {};
  },
};

// 假的授权对象：exchange 返回一个带 HTML 的名字，用来验证回调页有没有转义
const fakeAuth = {
  status: () => ({ authorized: true, name: 'tester' }),
  exchange: async () => ({ name: '<img src=x onerror=alert(1)>' }),
};

const server = createBridge(fakeFeishu, fakeAuth);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/feishu-panel`;

let failed = 0;
const check = (name, ok, extra = '') => {
  if (ok) console.log('ok   ' + name + (extra ? '  ' + extra : ''));
  else {
    failed += 1;
    console.log('FAIL ' + name + (extra ? '  ' + extra : ''));
  }
};

const post = async (route, body, headers = {}) => {
  const response = await fetch(base + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text.slice(0, 120) };
  }
  return { status: response.status, body: parsed, headers: response.headers };
};

// fetch 不允许伪造 Host 头（会被运行时改掉），所以这一条用裸 http 发。
const rawRequest = ({ path: reqPath, method = 'GET', headers = {}, body = '' }) =>
  new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: reqPath, method, headers }, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => resolve({ status: response.statusCode, body: data }));
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });

const makeBlock = (blockType, text = '段落') => {
  const item = { block_id: 'b' + Math.random().toString(36).slice(2, 8), block_type: blockType, parent_id: 'doc1' };
  if (blockType === 2) item.text = { elements: [{ text_run: { content: text } }] };
  else if (blockType >= 3 && blockType <= 11) item['heading' + (blockType - 2)] = { elements: [{ text_run: { content: text } }] };
  return item;
};

try {
  // ── 桥安全 ────────────────────────────────────────────────────────────────
  const plain = await post('/send', '{"chatId":"oc_1","text":"hi"}', { 'content-type': 'text/plain' });
  check('text/plain 请求被拒（415）', plain.status === 415, `status=${plain.status}`);

  const evilOrigin = await post('/save', { id: 'doc1', blocks: [] }, { origin: 'https://evil.example.com' });
  check('外部 Origin 被拒（403）', evilOrigin.status === 403, `status=${evilOrigin.status}`);

  const evilHost = await rawRequest({
    path: '/feishu-panel/save',
    method: 'POST',
    headers: { host: 'evil.example.com', 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'doc1', blocks: [] }),
  });
  check('伪造 Host 被拒（403）', evilHost.status === 403, `status=${evilHost.status}`);

  const dshApp = await post('/save', { id: '', blocks: [] }, { origin: 'dsh-app://app' });
  check('DSH 自定义协议 Origin 放行（不是 403）', dshApp.status !== 403, `status=${dshApp.status}`);

  const nullOrigin = await post('/save', { id: 'doc1', blocks: [] }, { origin: 'null' });
  check('Origin: null 被拒', nullOrigin.status === 403, `status=${nullOrigin.status}`);

  const oauth = await fetch(`http://127.0.0.1:${port}/oauth/callback?code=ok`);
  const oauthBody = await oauth.text();
  check('OAuth 回调页转义了注入的名字', !oauthBody.includes('<img src=x'), `status=${oauth.status}`);
  check('OAuth 回调页仍然给出成功提示', oauthBody.includes('授权成功'));

  const oauthErr = await fetch(`http://127.0.0.1:${port}/oauth/callback?error=${encodeURIComponent('<script>alert(1)</script>')}`);
  const oauthErrBody = await oauthErr.text();
  check('OAuth 错误参数被转义', !oauthErrBody.includes('<script>alert(1)</script>'));

  // ── 保存：含不支持的块必须整体拦住，一个字都不动 ──────────────────────────
  state.blocks = [makeBlock(2, '第一段'), makeBlock(29), makeBlock(17)];
  state.appendCalls.length = 0;
  state.deleteCalls.length = 0;
  const blocked = await post('/save', { id: 'doc1', blocks: [{ type: 'p', text: '新内容' }], identity: 'user' });
  check('含表格/待办的文档保存被拦（400）', blocked.status === 400, `status=${blocked.status}`);
  check('拦截时给出 UNSAFE_OVERWRITE', blocked.body?.code === 'UNSAFE_OVERWRITE', `code=${blocked.body?.code}`);
  check('拦截时提示里说清有表格', String(blocked.body?.error || '').includes('表格'), blocked.body?.error);
  check('拦截时一个块都没追加', state.appendCalls.length === 0);
  check('拦截时一个块都没删除', state.deleteCalls.length === 0);

  // ── 保存：带行内样式的块也要拦 ────────────────────────────────────────────
  const styled = makeBlock(2, '加粗的一段');
  styled.text.elements[0].text_run.text_element_style = { bold: true };
  state.blocks = [styled];
  state.appendCalls.length = 0;
  state.deleteCalls.length = 0;
  const blockedRich = await post('/save', { id: 'doc1', blocks: [{ type: 'p', text: 'x' }] });
  check('带加粗的文档保存被拦', blockedRich.status === 400 && blockedRich.body?.code === 'UNSAFE_OVERWRITE', `status=${blockedRich.status}`);

  // ── 保存：纯段落文档正常保存，备份是块 JSON ──────────────────────────────
  state.blocks = [makeBlock(2, '第一段'), makeBlock(3, '标题')];
  state.appendCalls.length = 0;
  state.deleteCalls.length = 0;
  const saved = await post('/save', { id: 'doc1', blocks: [{ type: 'p', text: '改过的内容' }], identity: 'user' });
  check('纯段落文档保存成功', saved.status === 200, `status=${saved.status}`);
  check('删掉的块数等于现有块数', saved.body?.removed === 2, `removed=${saved.body?.removed}`);
  check('备份文件是 .json', String(saved.body?.backupFile || '').endsWith('.json'), saved.body?.backupFile);
  check('备份文件真的写盘了', fs.existsSync(saved.body?.backupFile || ''));
  if (saved.body?.backupFile && fs.existsSync(saved.body.backupFile)) {
    const backup = JSON.parse(fs.readFileSync(saved.body.backupFile, 'utf8'));
    check('备份里存的是块结构而不是纯文本', Array.isArray(backup.blocks) && backup.blocks.length === 2, `blocks=${backup.blocks?.length}`);
    check('备份保留了飞书原始字段', Boolean(backup.blocks?.[0]?.block_type), `block_type=${backup.blocks?.[0]?.block_type}`);
    fs.unlinkSync(saved.body.backupFile);
  }

  // ── 保存：块数超过一页也要按真实数量删（翻页取全的护栏）──────────────────
  state.blocks = Array.from({ length: 640 }, (_, i) => makeBlock(2, 'p' + i));
  state.appendCalls.length = 0;
  state.deleteCalls.length = 0;
  const big = await post('/save', { id: 'doc1', blocks: [{ type: 'p', text: '只剩一段' }] });
  check('640 块的文档保存成功', big.status === 200, `status=${big.status}`);
  check('删除范围覆盖全部 640 块', big.body?.removed === 640, `removed=${big.body?.removed}`);
  check('删除调用带的是 0..640', JSON.stringify(state.deleteCalls[0]) === '[0,640]', JSON.stringify(state.deleteCalls[0]));

  // ── revision 冲突：别人改过就别默默覆盖 ──────────────────────────────────
  state.blocks = [makeBlock(2, '第一段')];
  state.revision = 11;
  const info2 = await fetch(base + '/docblocks?id=doc1&identity=user');
  const info2Body = await info2.json();
  check('/docblocks 带出 revision', info2Body.revision === 11, `revision=${info2Body.revision}`);

  state.appendCalls.length = 0;
  state.deleteCalls.length = 0;
  state.revision = 12; // 打开之后别人在飞书里改了
  const conflict = await post('/save', { id: 'doc1', blocks: [{ type: 'p', text: '我的修改' }], identity: 'user', revision: 11 });
  check('revision 对不上时返回 409', conflict.status === 409, `status=${conflict.status}`);
  check('冲突带 REVISION_CONFLICT', conflict.body?.code === 'REVISION_CONFLICT', `code=${conflict.body?.code}`);
  check('冲突给出新旧版本号', conflict.body?.revision?.expected === 11 && conflict.body?.revision?.current === 12, JSON.stringify(conflict.body?.revision));
  check('冲突时零改动（不追加）', state.appendCalls.length === 0);
  check('冲突时零改动（不删除）', state.deleteCalls.length === 0);

  // 用户确认覆盖 → 带新 revision 重发应当成功
  state.appendCalls.length = 0;
  state.deleteCalls.length = 0;
  const forced = await post('/save', { id: 'doc1', blocks: [{ type: 'p', text: '我的修改' }], identity: 'user', revision: 12 });
  check('确认后用新 revision 重发成功', forced.status === 200, `status=${forced.status}`);
  check('重发后确实写了块', state.appendCalls.length === 1, `append=${state.appendCalls.length}`);

  // 不带 revision 时保持旧行为（不拦）
  state.blocks = [makeBlock(2, '第一段')];
  state.appendCalls.length = 0;
  const noRev = await post('/save', { id: 'doc1', blocks: [{ type: 'p', text: 'x' }], identity: 'user' });
  check('不带 revision 时不检查冲突', noRev.status === 200, `status=${noRev.status}`);

  // ── /docblocks 要标出不支持块和带样式块 ──────────────────────────────────
  state.blocks = [makeBlock(2, '普通段'), makeBlock(29), makeBlock(2, '加粗')];
  state.blocks[2].text.elements[0].text_run.text_element_style = { bold: true };
  const info = await fetch(base + '/docblocks?id=doc1&identity=user');
  const infoBody = await info.json();
  check('/docblocks 统计了不支持块', infoBody.unsupported === 1, `unsupported=${infoBody.unsupported}`);
  check('/docblocks 统计了带样式块', infoBody.styled === 1, `styled=${infoBody.styled}`);
  check('/docblocks 给出块类型名', String(infoBody.blocks?.[1]?.kind || '').includes('表格'), `kind=${infoBody.blocks?.[1]?.kind}`);
  check('不支持的块标了 supported=false', infoBody.blocks?.[1]?.supported === false);
  check('普通块标了 supported=true', infoBody.blocks?.[0]?.supported === true);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

const backupDir = path.join(os.homedir(), '.dsh', 'feishu-docx-backups');
if (fs.existsSync(backupDir)) {
  for (const f of fs.readdirSync(backupDir).filter((n) => n.endsWith('.json')).slice(-5)) {
    // 只清掉本次测试产生的（文件名含 doc1）
    if (f.startsWith('doc1-')) fs.unlinkSync(path.join(backupDir, f));
  }
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
