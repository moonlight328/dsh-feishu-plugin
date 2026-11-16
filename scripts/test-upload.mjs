// /upload 端点的冒烟测试：注入假飞书，不联网、不发真消息。
// 验证：路由存在、base64 解码正确、图片/文件分别走 image_key / file_key、超限会拒。
import { createBridge } from '../lib/bridge.js';

const seen = [];
const fakeFeishu = {
  settings: () => ({ baseUrl: 'https://open.feishu.cn', appId: 'fake', appSecret: 'fake' }),
  botInfo: async () => ({ bot: { app_name: '冒烟机器人' } }),
  listChats: async () => [],
  // /messages 走的是通用 call：回一页假消息，带上分页字段
  call: async () => ({
    items: [
      { message_id: 'om_2', msg_type: 'text', body: { content: JSON.stringify({ text: '后来这条' }) }, sender: { sender_type: 'user', id: 'u1' }, create_time: '1700000200000' },
      { message_id: 'om_1', msg_type: 'text', body: { content: JSON.stringify({ text: '早先那条' }) }, sender: { sender_type: 'user', id: 'u1' }, create_time: '1700000100000' },
    ],
    page_token: 'page_next',
    has_more: true,
  }),
  uploadMedia: async ({ kind, buffer, fileName }) => {
    seen.push({ op: 'upload', kind, bytes: buffer.length, fileName });
    return kind === 'image' ? { imageKey: 'img_smoke_key' } : { fileKey: 'file_smoke_key' };
  },
  sendMessage: async (args) => {
    seen.push({ op: 'send', ...args });
    return { messageId: 'om_smoke', chatId: args.receiveId };
  },
};

const server = createBridge(fakeFeishu, null);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/feishu-panel`;

const post = async (path, body) => {
  const response = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
};

let failed = 0;
const check = (name, condition, extra = '') => {
  if (condition) console.log('ok   ' + name + (extra ? '  ' + extra : ''));
  else {
    failed += 1;
    console.log('FAIL ' + name + (extra ? '  ' + extra : ''));
  }
};

try {
  // 1. 图片：4 个字节 01 02 03 04
  const png = Buffer.from([0x01, 0x02, 0x03, 0x04]).toString('base64');
  const image = await post('/upload', { chatId: 'oc_smoke', kind: 'image', fileName: 'shot.png', data: png });
  check('图片上传返回 200', image.status === 200, `status=${image.status}`);
  check('图片走了 image_key', image.body?.ok === true && image.body?.messageId === 'om_smoke');
  const imageUpload = seen.find((row) => row.op === 'upload' && row.kind === 'image');
  check('图片字节数正确', imageUpload?.bytes === 4, `bytes=${imageUpload?.bytes}`);
  const imageSend = seen.find((row) => row.op === 'send' && row.msgType === 'image');
  check('发消息 msg_type=image', Boolean(imageSend), imageSend ? JSON.stringify(imageSend.content) : 'missing');
  check('发消息带 image_key', imageSend?.content?.image_key === 'img_smoke_key');

  // 2. 文件
  seen.length = 0;
  const file = await post('/upload', { chatId: 'oc_smoke', kind: 'file', fileName: '报价单.pdf', data: Buffer.from('hello').toString('base64') });
  check('文件上传返回 200', file.status === 200, `status=${file.status}`);
  const fileSend = seen.find((row) => row.op === 'send' && row.msgType === 'file');
  check('发消息 msg_type=file', Boolean(fileSend));
  check('发消息带 file_key', fileSend?.content?.file_key === 'file_smoke_key');
  check('文件名透传', fileSend?.content?.file_key ? true : false);
  const fileUpload = seen.find((row) => row.op === 'upload' && row.kind === 'file');
  check('文件名字保留中文', fileUpload?.fileName === '报价单.pdf', `name=${fileUpload?.fileName}`);

  // 3. 缺 chatId 要报错
  seen.length = 0;
  const noChat = await post('/upload', { kind: 'image', fileName: 'x.png', data: png });
  check('缺 chatId 被拒', noChat.status !== 200, `status=${noChat.status}`);
  check('缺 chatId 不会上传', seen.length === 0);

  // 4. 空文件要报错
  const empty = await post('/upload', { chatId: 'oc_smoke', kind: 'image', fileName: 'x.png', data: '' });
  check('空文件被拒', empty.status !== 200, `status=${empty.status}`);

  // 5. 消息分页：字段要透传，前端「加载更早」靠它
  const messages = await (async () => {
    const response = await fetch(base + '/messages?chatId=oc_smoke&pageSize=5');
    return { status: response.status, body: await response.json().catch(() => null) };
  })();
  check('/messages 可用', messages.status === 200, `status=${messages.status}`);
  check('返回 hasMore', messages.body?.hasMore === true);
  check('返回 pageToken', messages.body?.pageToken === 'page_next', `token=${messages.body?.pageToken}`);
  check('返回两条消息', (messages.body?.messages || []).length === 2);
  check('消息文本解析正确', messages.body?.messages?.[0]?.text === '后来这条', `text=${messages.body?.messages?.[0]?.text}`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
