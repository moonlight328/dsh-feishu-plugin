// /messages 消息解析 + /messageFile 下载的离线回归测试。
// 注入假飞书对象，不联网、不碰真群：/messages 走 feishu.call 取历史，
// /messageFile 走 feishu.fetchResource 取字节。
//
// 契约（前端依赖，改坏了这里会红）：
//   GET /feishu-panel/messages?chatId=xxx
//     -> { messages: [{ id, type, text, senderType, time, segments: [...], media }] }
//        segments: { kind: 'text'|'link'|'mention'|'emoji'|'code'|'image', text, href?, memberId?, emojiType? }
//        media:    { kind: 'file'|'image', fileKey, fileName, size } 或 null
//   GET /feishu-panel/messageFile?messageId=..&fileKey=..&fileName=..
//     -> 200 + content-disposition(attachment + URI 编码文件名) + content-type
//     -> 缺 messageId / fileKey 时 400 + { error }
import { createBridge } from '../lib/bridge.js';
import http from 'node:http';

const seen = { call: 0, resource: [] };

// 飞书原始消息 item：/messages 解析的就是这些。
const postContent = JSON.stringify({
  title: '标题',
  content: [
    [
      { tag: 'text', text: '你好' },
      { tag: 'a', text: '文档', href: 'https://x' },
      { tag: 'at', user_name: '张三', user_id: 'ou_x' },
    ],
  ],
});

const rawItems = [
  {
    message_id: 'om_post',
    msg_type: 'post',
    create_time: '1700000000000',
    sender: { sender_type: 'user', id: 'ou_1' },
    body: { content: postContent },
  },
  {
    message_id: 'om_file',
    msg_type: 'file',
    create_time: '1700000001000',
    sender: { sender_type: 'user', id: 'ou_1' },
    body: { content: JSON.stringify({ file_key: 'file_x', file_name: '报价单.pdf', file_size: 1024 }) },
  },
  {
    message_id: 'om_image',
    msg_type: 'image',
    create_time: '1700000002000',
    sender: { sender_type: 'user', id: 'ou_1' },
    body: { content: JSON.stringify({ image_key: 'img_x' }) },
  },
  {
    message_id: 'om_text',
    msg_type: 'text',
    create_time: '1700000003000',
    sender: { sender_type: 'user', id: 'ou_1' },
    body: { content: JSON.stringify({ text: '纯文本一条' }) },
  },
];

const fakeResource = { buffer: Buffer.from('PDF'), contentType: 'application/pdf', bytes: 3 };

const fakeFeishu = {
  settings: () => ({ baseUrl: 'https://open.feishu.cn', appId: 'cli_fake', appSecret: 'fake', domain: 'feishu' }),
  // /messages 用通用 call 拉历史（应用身份）
  call: async () => {
    seen.call += 1;
    return { items: rawItems, has_more: false, page_token: '' };
  },
  // /messageFile 取消息里的文件字节
  fetchResource: async (messageId, fileKey, kind) => {
    seen.resource.push({ messageId, fileKey, kind });
    return fakeResource;
  },
  downloadMessageFile: async (messageId, fileKey, kind) => {
    seen.resource.push({ messageId, fileKey, kind });
    return fakeResource;
  },
};

const server = createBridge(fakeFeishu, null);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/feishu-panel`;

let failed = 0;
const check = (name, condition, extra = '') => {
  if (condition) console.log('ok   ' + name + (extra ? '  ' + extra : ''));
  else {
    failed += 1;
    console.log('FAIL ' + name + (extra ? '  ' + extra : ''));
  }
};

const getJson = async (route) => {
  const response = await fetch(base + route);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 120) };
  }
  return { status: response.status, body, headers: response.headers };
};

// fetch 改不了 Host 头（会被运行时改掉），桥安全那条用裸 http 发。
const rawGet = (reqPath, headers) =>
  new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: reqPath, method: 'GET', headers }, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
      response.on('end', () => resolve({ status: response.statusCode, body: data, headers: response.headers }));
    });
    request.on('error', reject);
    request.end();
  });

try {
  // ── /messages 基本可用 ────────────────────────────────────────────────────
  const list = await getJson('/messages?chatId=oc_fake');
  check('/messages 返回 200', list.status === 200, `status=${list.status}`);
  check('/messages 真的问了假飞书（call 被调用）', seen.call > 0, `call=${seen.call}`);
  const messages = Array.isArray(list.body?.messages) ? list.body.messages : [];
  check('/messages 返回 4 条消息', messages.length === 4, `count=${messages.length}`);
  const byId = (id, index) => messages.find((m) => m.id === id) || messages[index] || {};
  const post = byId('om_post', 0);

  // ── post：segments 三种段 + 顺序 ─────────────────────────────────────────
  const segments = Array.isArray(post.segments) ? post.segments : [];
  const kinds = segments.map((s) => s.kind).join(',');
  const iText = segments.findIndex((s) => s.kind === 'text' && String(s.text || '').includes('你好'));
  const iLink = segments.findIndex((s) => s.kind === 'link');
  const iMention = segments.findIndex((s) => s.kind === 'mention');
  check('post segments 里有 text / link / mention', iText >= 0 && iLink >= 0 && iMention >= 0, `kinds=${kinds}`);
  check('post segments 顺序是 text -> link -> mention', iText >= 0 && iLink > iText && iMention > iLink, `kinds=${kinds}`);
  check('post link 段带 href', segments[iLink]?.href === 'https://x', `href=${segments[iLink]?.href}`);
  check('post link 段带文字', String(segments[iLink]?.text || '') === '文档', `text=${segments[iLink]?.text}`);
  check('post mention 段带 memberId', segments[iMention]?.memberId === 'ou_x', `memberId=${segments[iMention]?.memberId}`);
  check('post mention 段文字是 @张三', String(segments[iMention]?.text || '').replace(/^@/, '') === '张三', `text=${segments[iMention]?.text}`);

  // ── post：text 是人类可读摘要，不是 JSON ─────────────────────────────────
  const postText = String(post.text || '');
  check('post text 里有正文内容', postText.includes('你好') && postText.includes('文档'), `text=${postText}`);
  check('post text 不是 JSON 字符串', !/[[{]/.test(postText) && !postText.includes('"tag"'), `text=${postText}`);
  check('post senderType 是 user', post.senderType === 'user', `senderType=${post.senderType}`);
  check('post media 为空', post.media == null, `media=${JSON.stringify(post.media)}`);

  // ── file：media.kind / fileName / size ──────────────────────────────────
  const file = byId('om_file', 1);
  check('file media.kind = file', file.media?.kind === 'file', `media=${JSON.stringify(file.media)}`);
  check('file media.fileKey 正确', file.media?.fileKey === 'file_x', `fileKey=${file.media?.fileKey}`);
  check('file media.fileName 正确', file.media?.fileName === '报价单.pdf', `fileName=${file.media?.fileName}`);
  check('file media.size 是数字', typeof file.media?.size === 'number', `size=${file.media?.size}`);

  // ── image：media.kind = image，旧字段 imageKey 还在 ─────────────────────
  const image = byId('om_image', 2);
  check('image media.kind = image', image.media?.kind === 'image', `media=${JSON.stringify(image.media)}`);
  check('image 消息仍带 imageKey（兼容旧字段）', image.imageKey === 'img_x', `imageKey=${image.imageKey}`);

  // ── text：segments 就一条 text ──────────────────────────────────────────
  const text = byId('om_text', 3);
  check('text segments 只有一条', Array.isArray(text.segments) && text.segments.length === 1, `len=${text.segments?.length}`);
  check('text 那一条是 kind=text', text.segments?.[0]?.kind === 'text', `kind=${text.segments?.[0]?.kind}`);
  check('text 段的文字正确', text.segments?.[0]?.text === '纯文本一条', `text=${text.segments?.[0]?.text}`);
  check('text 消息 text 字段正确', text.text === '纯文本一条', `text=${text.text}`);

  // ── /messageFile 成功 ───────────────────────────────────────────────────
  const fileName = '报价单.pdf';
  const fileRoute = `/messageFile?messageId=om_file&fileKey=file_x&fileName=${encodeURIComponent(fileName)}`;
  const downloaded = await rawGet('/feishu-panel' + fileRoute, { host: `127.0.0.1:${port}` });
  const disposition = String(downloaded.headers['content-disposition'] || '');
  check('/messageFile 返回 200', downloaded.status === 200, `status=${downloaded.status}`);
  check('/messageFile 带了 content-disposition', Boolean(disposition), `header=${disposition || 'missing'}`);
  check('content-disposition 是 attachment', /attachment/i.test(disposition), `header=${disposition}`);
  check('content-disposition 含 URI 编码的文件名', disposition.includes(encodeURIComponent(fileName)), `header=${disposition}`);
  check('/messageFile content-type 来自资源', String(downloaded.headers['content-type'] || '') === 'application/pdf', `type=${downloaded.headers['content-type']}`);
  check('/messageFile 真的去取了字节', seen.resource.some((r) => r.messageId === 'om_file' && r.fileKey === 'file_x'), JSON.stringify(seen.resource[0] || null));

  // ── /messageFile 缺参 ───────────────────────────────────────────────────
  const noMessage = await getJson('/messageFile?fileKey=file_x&fileName=x.pdf');
  check('缺 messageId 返回 400', noMessage.status === 400, `status=${noMessage.status}`);
  check('缺 messageId 带 error', Boolean(noMessage.body?.error), `body=${JSON.stringify(noMessage.body)}`);
  const noKey = await getJson('/messageFile?messageId=om_file&fileName=x.pdf');
  check('缺 fileKey 返回 400', noKey.status === 400, `status=${noKey.status}`);
  check('缺 fileKey 带 error', Boolean(noKey.body?.error), `body=${JSON.stringify(noKey.body)}`);

  // ── 桥安全没被破坏：伪造 Host 仍然 403 ───────────────────────────────────
  const evilHost = await rawGet('/feishu-panel/messages?chatId=oc_fake', { host: 'evil.example.com' });
  check('伪造 Host 访问 /messages 被拒（403）', evilHost.status === 403, `status=${evilHost.status}`);
  const evilOrigin = await fetch(base + '/messages?chatId=oc_fake', { headers: { origin: 'https://evil.example.com' } });
  check('外部 Origin 访问 /messages 被拒（403）', evilOrigin.status === 403, `status=${evilOrigin.status}`);
} finally {
  await new Promise((resolve) => server.close(resolve));
}

console.log(failed ? `\n${failed} 项失败` : '\n全部通过');
process.exit(failed ? 1 : 0);
