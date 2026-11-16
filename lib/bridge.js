// feishu-plugin 的本地桥：给侧栏面板用。
//
// 浏览器半不拿 App Secret，所有请求都从主机走。只绑 127.0.0.1，只对 loopback 放开 CORS。

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { blocksToChildren, firstLine, markdownToBlocks } from './markdown.js';

export const PREFIX = '/feishu-panel';

// 允许的页面来源：本地 http 回环，以及 DSH 自己的自定义协议（新版桌面壳的页面
// origin 是 dsh-app://app）。file:// 和 Origin: null 一律不给 —— 那两种来源
// 无法区分是本地文件还是被别人塞进来的内容。
function loopbackOrigin(origin) {
  if (!origin) return false;
  if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(origin)) return true;
  if (/^dsh-app:\/\/[a-z0-9.-]*$/i.test(origin)) return true;
  return false;
}

function send(response, status, payload) {
  const body = JSON.stringify(payload ?? null);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  response.end(body);
}

function readBody(request, maxBytes = 2 * 1024 * 1024) {
  // 只收 application/json。浏览器对 application/json 必须先发预检，预检会带着
  // Origin 被上面的白名单检查拦掉；而 form / text-plain 属于「简单请求」，
  // 不预检就能跨站打过来 —— 这正是别人网页能调 /delete、/send、/save 的原因。
  const contentType = String(request.headers['content-type'] || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return Promise.reject(Object.assign(new Error('请求必须是 application/json'), { httpStatus: 415 }));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    request.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > maxBytes) {
        failed = true;
        reject(new Error('请求太大（上限 ' + Math.round(maxBytes / 1024 / 1024) + ' MB）'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (failed) return;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('请求体不是 JSON'));
      }
    });
    request.on('error', reject);
  });
}

// ── 文档块分类：编辑器能无损读写的类型 ──────────────────────────────────────
// 段落 / 标题 1~3 / 无序 / 有序 / 代码 / 图片。其余块（表格、待办、引用、高亮块、
// 分割线、分栏…）编辑器读不到内容，一旦「整篇覆盖保存」就会把它们清成空段落，
// 所以这些块必须先被识别出来，拦在保存之前。
const EDITABLE_BLOCK_TYPES = new Set([2, 3, 4, 5, 12, 13, 14, 27]);
const TEXT_HOLDERS = ['text', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6', 'heading7', 'heading8', 'heading9', 'bullet', 'ordered', 'code'];
const BLOCK_KIND_NAME = {
  1: '页面', 15: '引用', 17: '待办', 18: '多维表格', 19: '高亮块', 20: '分割线',
  21: '文件', 22: '分栏', 23: '分栏列', 24: '内嵌网页', 25: '图片', 26: '小组件',
  29: '表格', 30: '单元格', 31: '视图', 32: '引用容器', 33: '任务', 34: 'OKR',
  37: '扩展', 38: 'Jira', 40: '看板', 45: '链接预览', 49: 'AI 模板',
};

/** 块里有没有加粗、斜体、链接、@人、颜色这类行内样式（编辑器只留纯文字）。 */
function blockHasRichStyle(item) {
  for (const key of TEXT_HOLDERS) {
    const holder = item[key];
    if (!holder || !Array.isArray(holder.elements)) continue;
    for (const el of holder.elements) {
      if (!el) continue;
      if (el.mention_doc || el.mention_user || el.equation || el.reminder) return true;
      const run = el.text_run;
      if (!run) continue;
      const style = run.text_element_style || {};
      if (style.bold || style.italic || style.underline || style.strikethrough || style.inline_code) return true;
      if (style.link && style.link.url) return true;
      if (style.text_color && Number(style.text_color) !== 1) return true;
      if (style.background_color && Number(style.background_color) !== 1) return true;
    }
  }
  return false;
}

/** 取一个块的纯文本（编辑器只认这个）。 */
function blockTextOf(item) {
  for (const key of TEXT_HOLDERS) {
    const holder = item?.[key];
    if (holder && Array.isArray(holder.elements)) {
      return holder.elements.map((el) => el?.text_run?.content ?? '').join('');
    }
  }
  return '';
}

/** 整篇覆盖前体检：这篇文档里有多少内容编辑器读不全。 */
function assessOverwriteRisk(items) {
  const kinds = [];
  let unsupported = 0;
  let styled = 0;
  for (const item of Array.isArray(items) ? items : []) {
    const blockType = Number(item.block_type) || 0;
    if (!EDITABLE_BLOCK_TYPES.has(blockType)) {
      unsupported += 1;
      kinds.push(BLOCK_KIND_NAME[blockType] || `块类型 ${blockType}`);
    } else if (blockType !== 27 && blockHasRichStyle(item)) {
      styled += 1;
    }
  }
  const details = [];
  if (unsupported) details.push(`${unsupported} 个不支持的块（${[...new Set(kinds)].join('、')}）`);
  if (styled) details.push(`${styled} 个带加粗/链接等行内样式的块`);
  return { blocking: details.length > 0, detail: details.join('，'), unsupported, styled };
}

// ── 富文本（post）：一行摘要 + 按顺序的结构化片段 ────────────────────────────
// text 仍是给人看的纯文本摘要（前端拿它做搜索 / 回退），segments 是新增的结构化视图，
// 只增不改 —— 老前端只读 text 也照样跑。
const POST_LOCALES = ['zh_cn', 'en_us'];

/** 取第一个存在的语言分支；少数消息把 { title, content } 直接放在顶层。 */
function pickPostLocale(content) {
  for (const key of POST_LOCALES) {
    const locale = content?.[key];
    if (locale && typeof locale === 'object' && !Array.isArray(locale)) return locale;
  }
  if (Array.isArray(content?.content)) return content;
  return null;
}

/** 单个行内节点 → 片段；认不出的返回 null（外层再试着当容器往下走）。 */
function segmentFromNode(node) {
  const tag = String(node?.tag || '');
  if (tag === 'text' || tag === 'md') {
    const text = String(node.text ?? '');
    return text ? { kind: 'text', text } : null;
  }
  if (tag === 'a') {
    const text = String(node.text ?? node.href ?? '');
    return text ? { kind: 'link', text, href: String(node.href || '') } : null;
  }
  if (tag === 'at') {
    const memberId = String(node.user_id || node.open_id || '');
    const docToken = String(node.doc_token || '');
    const name = String(node.user_name || node.user_id || node.doc_name || docToken || memberId || '');
    return {
      kind: 'mention',
      text: '@' + name,
      ...(memberId ? { memberId } : {}),
      ...(docToken ? { docToken } : {}),
    };
  }
  if (tag === 'emotion') {
    const emojiType = String(node.emoji_type || '');
    return { kind: 'emoji', text: emojiType ? `[${emojiType}]` : '[表情]', emojiType };
  }
  if (tag === 'code_block') {
    const text = String(node.text ?? '');
    return text ? { kind: 'code', text } : null;
  }
  if (tag === 'img') return { kind: 'image' };
  return null;
}

function summarizeSegments(segments) {
  return segments
    .map((seg) => (seg.kind === 'image' ? '[图片]' : String(seg.text || '')))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePostContent(content) {
  const locale = pickPostLocale(content);
  const segments = [];
  const push = (seg) => {
    if (seg) segments.push(seg);
  };
  const walk = (nodes) => {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!node) continue;
      const seg = segmentFromNode(node);
      if (seg) push(seg);
      else if (Array.isArray(node.content)) walk(node.content);
    }
  };
  if (locale?.title) push({ kind: 'text', text: String(locale.title) });
  for (const line of Array.isArray(locale?.content) ? locale.content : []) walk(line);
  return { text: summarizeSegments(segments), segments };
}

// 媒体 / 文件消息：只从 content 里取，不发网络请求
const MEDIA_TYPES = new Set(['image', 'file', 'audio', 'media', 'sticker']);

function mediaFromContent(kind, content) {
  // 图片的 key 在 image_key 里，其余（文件/语音/视频/贴图）在 file_key 里
  const fileKey = String((kind === 'image' ? content.image_key : content.file_key) || content.file_key || content.image_key || '');
  // 飞书文件消息的字节数两种字段名都见过
  const size = Number(content.file_size ?? content.size ?? 0);
  return {
    kind,
    fileKey,
    fileName: String(content.file_name || ''),
    size: Number.isFinite(size) && size > 0 ? size : 0,
  };
}

function parseMessage(item) {
  const type = String(item?.msg_type || '');
  let content = {};
  try {
    content = JSON.parse(item?.body?.content || '{}');
  } catch {
    content = {};
  }
  if (!content || typeof content !== 'object' || Array.isArray(content)) content = {};
  const message = {
    id: item?.message_id || '',
    type,
    text: '',
    sender: item?.sender?.id || '',
    senderType: item?.sender?.sender_type || '',
    time: Number(item?.create_time || 0),
    imageKey: '',
    fileKey: '',
    fileName: '',
    // 新增：富文本按顺序的片段（老字段一个没动）
    segments: [],
    // 新增：媒体 / 文件消息的资源描述，纯文本消息是 null
    media: null,
  };
  if (type === 'text') {
    message.text = String(content.text || '');
    message.segments = [{ kind: 'text', text: message.text }];
  } else if (type === 'post') {
    const parsed = parsePostContent(content);
    message.text = parsed.text;
    message.segments = parsed.segments;
    // 帖子里内嵌的图片只有 image_key，没有独立消息可以下载，所以只做占位
  } else if (MEDIA_TYPES.has(type)) {
    message.media = mediaFromContent(type, content);
    if (type === 'image') {
      message.imageKey = String(content.image_key || '');
      message.text = '[图片]';
    } else if (type === 'sticker') {
      message.fileKey = String(content.file_key || '');
      message.text = '[表情]';
    } else if (type === 'file') {
      message.fileKey = String(content.file_key || '');
      message.fileName = String(content.file_name || '');
      message.text = `[文件] ${message.fileName}`.trim();
    } else if (type === 'audio') {
      message.fileKey = String(content.file_key || '');
      message.text = '[语音]';
    } else {
      message.fileKey = String(content.file_key || '');
      message.text = '[视频]';
    }
  } else if (type === 'system') {
    message.text = '（系统消息）';
  } else {
    message.text = JSON.stringify(content).slice(0, 200);
  }
  return message;
}

/** HTML 转义：回调页会把 URL 参数和飞书返回的字符串拼进页面，不转义就是反射型 XSS。 */
function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&#39;';
  });
}

/** 授权回调：飞书会打到 /oauth/callback（不带面板前缀），所以两个路径都接。 */
async function handleOAuthCallback(url, response, auth) {
  const send = (status, type, body) => {
    response.writeHead(status, { 'content-type': type + '; charset=utf-8', 'cache-control': 'no-store' });
    response.end(body);
  };
  const fail = url.searchParams.get('error') || '';
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  if (fail) return send(400, 'text/html', `<html><body style="font:14px system-ui;padding:32px">授权被拒绝：${escapeHtml(fail)}</body></html>`);
  if (!code) return send(400, 'text/html', '<html><body style="font:14px system-ui;padding:32px">回调里没有 code</body></html>');
  if (!auth) return send(400, 'text/html', '<html><body style="font:14px system-ui;padding:32px">授权模块没装配</body></html>');
  try {
    const info = await auth.exchange(code, state);
    return send(
      200,
      'text/html',
      `<html><body style="font:14px system-ui;padding:32px;line-height:1.9">` +
        `<h3 style="margin:0 0 10px">授权成功</h3>` +
        `<div>已授权为 <b>${escapeHtml(info?.name || '我的账号')}</b>。</div>` +
        `<div style="color:#6b7280;margin-top:8px">这个窗口可以关掉了，回到 DSH 侧栏会自动刷新。</div>` +
        `<script>setTimeout(function(){window.close()}, 1500)</script>` +
        `</body></html>`
    );
  } catch (error) {
    return send(400, 'text/html', `<html><body style="font:14px system-ui;padding:32px">授权失败：${escapeHtml(error.message)}</body></html>`);
  }
}

export function createBridge(feishu, auth) {
  return http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    // Host 只认回环地址：防 DNS 重绑定（外部域名解析到 127.0.0.1 后打这个桥）。
    const host = String(request.headers.host || '');
    if (host && !/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(host)) {
      return send(response, 403, { error: 'host not allowed' });
    }
    if (origin && !loopbackOrigin(origin)) {
      // 带了 Origin 但不是自己人 → 直接拒，连响应体都不给跨站页面读
      return send(response, 403, { error: 'origin not allowed' });
    }
    if (loopbackOrigin(origin)) {
      response.setHeader('access-control-allow-origin', origin);
      response.setHeader('vary', 'origin');
    }
    response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    response.setHeader('access-control-allow-headers', 'content-type');
    // 自定义协议页面访问 127.0.0.1 会被 Chromium 当成私有网络请求，预检要显式放行
    response.setHeader('access-control-allow-private-network', 'true');
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      return response.end();
    }

    const url = new URL(request.url || '/', 'http://127.0.0.1');
    // 飞书回调不经过面板前缀：/oauth/callback 也要接
    if (request.method === 'GET' && (url.pathname === '/oauth/callback' || url.pathname === PREFIX + '/oauth/callback')) {
      return handleOAuthCallback(url, response, auth);
    }
    const route = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) || '/' : '';
    if (!route) return send(response, 404, { error: 'not found' });

    try {
      // ── 用户身份（OAuth）─────────────────────────────────────────────────
      if (request.method === 'GET' && route === '/auth') {
        const status = auth ? auth.status() : { authorized: false };
        return send(response, 200, { ...status, canAuthorize: Boolean(auth && auth.appId && auth.appSecret && auth.redirectUri) });
      }

      if (request.method === 'GET' && route === '/oauth/start') {
        if (!auth) throw new Error('授权模块没装配');
        if (!auth.appId || !auth.appSecret) throw new Error('还没配 App ID / App Secret');
        const url = auth.authorizeUrl();
        response.writeHead(302, { location: url, 'cache-control': 'no-store' });
        return response.end();
      }

      if (request.method === 'GET' && route === '/oauth/callback') {
        return handleOAuthCallback(url, response, auth);
      }

      // ── 云空间：文件夹浏览 ────────────────────────────────────────────────
      if (request.method === 'GET' && route === '/drive') {
        const folderToken = url.searchParams.get('folderToken') || '';
        const identity = url.searchParams.get('identity') === 'bot' ? 'bot' : 'user';
        const files = await feishu.listFiles(folderToken, identity);
        const folders = files.filter((file) => file.type === 'folder');
        const docs = files.filter((file) => file.type !== 'folder');
        return send(response, 200, { folderToken, folders, files: docs });
      }

      if (request.method === 'POST' && route === '/mkdir') {
        const body = await readBody(request);
        const name = String(body.name || '').trim();
        if (!name) throw new Error('文件夹名字是空的');
        const created = await feishu.createFolder(name, String(body.parentToken || ''), String(body.identity || 'user'));
        return send(response, 200, { ok: true, ...created });
      }

      if (request.method === 'GET' && route === '/status') {
        const settings = feishu.settings();
        const state = { ok: false, baseUrl: settings.baseUrl, appIdSet: Boolean(settings.appId), bot: null, error: '' };
        // 凭据形状（不含明文）：排查 code=10003 时先看这里
        const appId = String(settings.appId || '');
        const secret = String(settings.appSecret || '');
        state.cred = {
          appIdLen: appId.length,
          appIdPrefix: appId.slice(0, 4),
          appIdLooksMasked: /[*•·]/.test(appId),
          secretLen: secret.length,
          secretLooksMasked: /[*•·]/.test(secret) || /^x{6,}$/i.test(secret),
          secretOnlyAlnum: /^[A-Za-z0-9]*$/.test(secret),
          domain: settings.domain || 'feishu',
        };
        try {
          const info = await feishu.botInfo();
          state.bot = { name: info?.bot?.app_name || '', openId: info?.bot?.open_id || '' };
          state.ok = true;
        } catch (error) {
          state.error = error.message;
          if (/10003/.test(String(error.message))) {
            state.error +=
              `｜app_id 长度 ${state.cred.appIdLen}、前缀 ${state.cred.appIdPrefix}` +
              `；secret 长度 ${state.cred.secretLen}` +
              (state.cred.secretLooksMasked ? '（含掩码字符）' : '') +
              (state.cred.secretOnlyAlnum ? '' : '（含非字母数字字符）');
          }
        }
        return send(response, 200, state);
      }

      if (request.method === 'GET' && route === '/chats') {
        return send(response, 200, { chats: await feishu.listChats() });
      }

      if (request.method === 'GET' && route === '/messages') {
        const chatId = url.searchParams.get('chatId') || '';
        if (!chatId) throw new Error('缺少 chatId');
        const pageSize = Math.min(50, Number(url.searchParams.get('pageSize') || 20));
        const pageToken = url.searchParams.get('pageToken') || '';
        // 读群消息必须用「应用身份」：用户身份要 im:message.history:readonly 等一整套权限，
        // 而机器人身份有 im:message 就能读它在的群。
        const data = await feishu.call('GET', '/open-apis/im/v1/messages', {
          query: {
            container_id_type: 'chat',
            container_id: chatId,
            sort_type: 'ByCreateTimeDesc',
            page_size: pageSize,
            ...(pageToken ? { page_token: pageToken } : {}),
          },
        }, { preferUser: false });
        return send(response, 200, {
          messages: (data?.items || []).map(parseMessage),
          pageToken: data?.page_token || '',
          hasMore: Boolean(data?.has_more),
        });
      }

      if (request.method === 'POST' && route === '/send') {
        const body = await readBody(request);
        const chatId = String(body.chatId || '').trim();
        const text = String(body.text || '').trim();
        if (!chatId) throw new Error('缺少 chatId');
        if (!text) throw new Error('消息是空的');
        const sent = await feishu.sendMessage({ receiveId: chatId, receiveIdType: 'chat_id', text });
        return send(response, 200, { ok: true, ...sent });
      }

      // 发图片 / 文件：前端把文件读成 base64 丢过来，这里上传到飞书再发出去
      if (request.method === 'POST' && route === '/upload') {
        const body = await readBody(request, 40 * 1024 * 1024);
        const chatId = String(body.chatId || '').trim();
        const kind = String(body.kind || 'image') === 'file' ? 'file' : 'image';
        const fileName = String(body.fileName || (kind === 'image' ? 'image.png' : 'file'));
        if (!chatId) throw new Error('缺少 chatId');
        const buffer = Buffer.from(String(body.data || ''), 'base64');
        if (!buffer.length) throw new Error('文件是空的或者解码失败');
        if (kind === 'image' && buffer.length > 10 * 1024 * 1024) throw new Error('图片超过 10 MB，飞书发不了');
        if (kind === 'file' && buffer.length > 30 * 1024 * 1024) throw new Error('文件超过 30 MB，飞书发不了');
        const uploaded = await feishu.uploadMedia({ kind, buffer, fileName });
        const content = kind === 'image' ? { image_key: uploaded.imageKey } : { file_key: uploaded.fileKey };
        const sent = await feishu.sendMessage({ receiveId: chatId, receiveIdType: 'chat_id', msgType: kind, content });
        return send(response, 200, { ok: true, ...sent, fileName, kind, bytes: buffer.length });
      }

      if (request.method === 'GET' && route === '/docs') {
        const folderToken = url.searchParams.get('folderToken') || '';
        const data = await feishu.call('GET', '/open-apis/drive/v1/files', {
          query: { folder_token: folderToken, page_size: 50, order_by: 'EditedTime', direction: 'DESC' },
        });
        return send(response, 200, {
          files: (data?.files || []).map((file) => ({
            token: file.token,
            name: file.name,
            type: file.type,
            url: file.url,
            modified: Number(file.modified_time || 0),
          })),
        });
      }

      if (request.method === 'POST' && route === '/rename') {
        const body = await readBody(request);
        const token = String(body.token || '').trim();
        const name = String(body.name || '').trim();
        if (!token) throw new Error('缺少 token');
        if (!name) throw new Error('新名字是空的');
        await feishu.renameFile(token, name, String(body.type || 'docx'));
        return send(response, 200, { ok: true, token, name });
      }

      if (request.method === 'POST' && route === '/delete') {
        const body = await readBody(request);
        const token = String(body.token || '').trim();
        if (!token) throw new Error('缺少 token');
        await feishu.deleteFile(token, String(body.type || 'docx'));
        return send(response, 200, { ok: true, token });
      }

      // 结构化块：文档编辑器要按「标题/段落/列表/代码」分别渲染，纯文本做不到。
      // 文档里的图片：drive 的媒体下载接口，用你的身份
      if (request.method === 'GET' && route === '/mediaDoc') {
        const token = url.searchParams.get('token') || '';
        if (!token) throw new Error('缺少 token');
        const resource = await feishu.downloadMedia(token, url.searchParams.get('identity') === 'bot' ? 'bot' : 'user');
        response.writeHead(200, {
          'content-type': resource.contentType,
          'content-length': resource.bytes,
          'cache-control': 'private, max-age=600',
        });
        return response.end(resource.buffer);
      }

      if (request.method === 'POST' && route === '/move') {
        const body = await readBody(request);
        const token = String(body.token || '').trim();
        if (!token) throw new Error('缺少 token');
        const moved = await feishu.moveFile(
          token,
          String(body.type || 'docx'),
          String(body.folderToken || ''),
          String(body.identity || 'user')
        );
        return send(response, 200, { ok: true, token: moved?.token || token });
      }

      if (request.method === 'GET' && route === '/docblocks') {
        const id = url.searchParams.get('id') || '';
        if (!id) throw new Error('缺少 id');
        const identity = url.searchParams.get('identity') === 'bot' ? 'bot' : 'user';
        const items = await feishu.listChildBlocks(id, identity);
        // 记下打开时的 revision：保存前比对，能发现「你打开之后别人在飞书里改过」
        const revision = await feishu.documentRevision(id, identity);
        const pickImage = (item) => String(item?.image?.token || item?.image?.file_token || '');
        const pick = (item) => blockTextOf(item);

        const typeOf = (blockType) => {
          if (blockType >= 3 && blockType <= 11) return `h${blockType - 2}`;
          if (blockType === 12) return 'bullet';
          if (blockType === 13) return 'ordered';
          if (blockType === 14) return 'code';
          return 'p';
        };
        let unsupported = 0;
        let styled = 0;
        const blocks = items.map((item) => {
          const blockType = Number(item.block_type) || 0;
          const base = { id: item.block_id, blockType };
          if (!EDITABLE_BLOCK_TYPES.has(blockType)) {
            unsupported += 1;
            return { ...base, type: 'unsupported', text: '', supported: false, kind: BLOCK_KIND_NAME[blockType] || `块类型 ${blockType}` };
          }
          if (blockType === 27) return { ...base, type: 'image', text: '', token: pickImage(item), supported: true };
          const rich = blockHasRichStyle(item);
          if (rich) styled += 1;
          return { ...base, type: typeOf(blockType), text: pick(item), supported: true, rich };
        });
        return send(response, 200, { documentId: id, blocks, unsupported, styled, revision });
      }

      // 消息里的图片 / 贴图：浏览器 <img src> 直接指过来，桥负责带 token 拉字节
      if (request.method === 'GET' && route === '/media') {
        const messageId = url.searchParams.get('messageId') || '';
        const fileKey = url.searchParams.get('fileKey') || '';
        const kind = url.searchParams.get('kind') === 'file' ? 'file' : 'image';
        if (!messageId || !fileKey) throw new Error('缺少 messageId / fileKey');
        const resource = await feishu.fetchResource(messageId, fileKey, kind);
        response.writeHead(200, {
          'content-type': resource.contentType,
          'content-length': resource.bytes,
          'cache-control': 'private, max-age=600',
        });
        return response.end(resource.buffer);
      }

      // 消息里的文件附件：前端给个链接指过来，桥带 token 拉字节并按附件下发
      if (request.method === 'GET' && route === '/messageFile') {
        const messageId = url.searchParams.get('messageId') || '';
        const fileKey = url.searchParams.get('fileKey') || '';
        if (!messageId || !fileKey) throw new Error('缺少 messageId / fileKey');
        const fileName = url.searchParams.get('fileName') || 'file.bin';
        const resource = await feishu.fetchResource(messageId, fileKey, 'file');
        const buffer = resource.buffer;
        const encoded = encodeURIComponent(fileName).replace(/['()*]/g, (ch) => '%' + ch.charCodeAt(0).toString(16).toUpperCase());
        response.writeHead(200, {
          'content-type': resource.contentType || 'application/octet-stream',
          'content-length': buffer.length,
          'content-disposition': `attachment; filename="download"; filename*=UTF-8''${encoded}`,
          'cache-control': 'private, max-age=600',
        });
        return response.end(buffer);
      }

      if (request.method === 'GET' && route === '/doc') {
        const id = url.searchParams.get('id') || '';
        if (!id) throw new Error('缺少 id');
        return send(response, 200, { documentId: id, content: await feishu.readDoc(id) });
      }

      if (request.method === 'POST' && route === '/doc') {
        const body = await readBody(request);
        const markdown = String(body.markdown || '').trim();
        if (!markdown) throw new Error('正文是空的');
        const settings = feishu.settings();
        const title = String(body.title || '').trim() || firstLine(markdown);
        const created = await feishu.createDoc({
          title,
          folderToken: body.folderToken || settings.defaultFolderToken,
          identity: String(body.identity || 'user'),
        });
        const blocks = markdownToBlocks(markdown, title);
        const written = await feishu.appendBlocks(created.documentId, blocks);
        return send(response, 200, { documentId: created.documentId, title, blocks: written });
      }

      // 整篇覆盖保存：先体检 → 备份块 JSON → 追加新块 → 删旧块。
      // 备份落在 <home>/.dsh/feishu-docx-backups，出事能捞回来。
      if (request.method === 'POST' && route === '/save') {
        const body = await readBody(request);
        const documentId = String(body.id || '').trim();
        if (!documentId) throw new Error('缺少 id');
        const identity = String(body.identity || 'user');
        const force = body.force === true;
        const expectedRevision = Number(body.revision) || 0;
        const incomingBlocks = Array.isArray(body.blocks) ? body.blocks : null;
        const markdown = String(body.markdown ?? '');
        if (!incomingBlocks && !markdown.trim()) throw new Error('正文是空的（要清空文档就别用保存）');

        // 冲突检查：打开文档时记过 revision，这里比对一次。
        // 对不上说明你打开之后有人在飞书里改过，直接覆盖会吃掉对方的修改。
        if (expectedRevision > 0) {
          const currentRevision = await feishu.documentRevision(documentId, identity);
          if (currentRevision > 0 && currentRevision !== expectedRevision) {
            const conflict = new Error(
              `这篇文档在你打开之后被改过（打开时版本 ${expectedRevision}，现在是 ${currentRevision}）。直接保存会覆盖那些修改。`
            );
            conflict.code = 'REVISION_CONFLICT';
            conflict.httpStatus = 409;
            conflict.revision = { expected: expectedRevision, current: currentRevision };
            throw conflict;
          }
        }

        const existing = await feishu.listChildBlocks(documentId, identity);
        // 编辑器读不全的块（表格/待办/引用/带行内样式…）会被覆盖成空段落，
        // 这是永久性损失，所以默认拦住，不做任何改动。
        const risk = assessOverwriteRisk(existing);
        const incremental = body.incremental === true;
        if (risk.blocking && !force && !incremental) {
          const refusal = new Error(
            `这篇文档里有${risk.detail}，编辑器读不全，保存会把它们清掉。已拦住，文档一个字没动 —— 要改这些内容请去飞书里编辑。`
          );
          refusal.code = 'UNSAFE_OVERWRITE';
          refusal.risk = risk;
          throw refusal;
        }

        // 备份存块 JSON（含飞书原始字段），不再只存纯文本：纯文本还原不了表格结构。
        const backupDir = path.join(os.homedir(), '.dsh', 'feishu-docx-backups');
        fs.mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, documentId + '-' + stamp + '.json');
        fs.writeFileSync(
          backupFile,
          JSON.stringify({ documentId, savedAt: new Date().toISOString(), identity, risk, blocks: existing }, null, 2),
          'utf8'
        );

        // ── 增量保存：只 PATCH 改过文字的纯文本块，别的块一个都不动 ──────────
        // 这是「文档里有表格/待办」时唯一安全的保存方式：不增删块、重整篇。
        if (incremental) {
          if (!incomingBlocks) throw new Error('增量保存必须带 blocks');
          if (incomingBlocks.length !== existing.length) {
            const mismatch = new Error(
              `这篇文档里有${risk.detail || '编辑器读不全的块'}，只能改文字，不能增删段落（当前 ${existing.length} 块，编辑器里 ${incomingBlocks.length} 块）。` +
                ' 要增删请去飞书里操作。'
            );
            mismatch.code = 'STRUCTURE_LOCKED';
            mismatch.httpStatus = 400;
            mismatch.risk = risk;
            throw mismatch;
          }
          const byId = new Map(existing.map((item) => [item.block_id, item]));
          let updated = 0;
          let skippedRich = 0;
          let skippedUnknown = 0;
          for (const block of incomingBlocks) {
            const original = byId.get(String(block.blockId || ''));
            if (!original) {
              skippedUnknown += 1;
              continue;
            }
            const blockType = Number(original.block_type) || 0;
            // 不认识的块不碰
            if (!EDITABLE_BLOCK_TYPES.has(blockType)) {
              skippedUnknown += 1;
              continue;
            }
            // 带行内样式的块也不碰：PATCH 是整段替换，会把加粗、链接冲掉
            if (blockHasRichStyle(original)) {
              skippedRich += 1;
              continue;
            }
            if (blockTextOf(original) === String(block.text ?? '')) continue;
            await feishu.updateBlockText(documentId, String(block.blockId), String(block.text ?? ''), identity);
            updated += 1;
          }
          const afterRevision = await feishu.documentRevision(documentId, identity);
          return send(response, 200, {
            documentId,
            mode: 'incremental',
            updated,
            skippedRich,
            skippedUnknown,
            backupFile,
            risk,
            revision: afterRevision,
          });
        }

        const children = incomingBlocks ? blocksToChildren(incomingBlocks) : markdownToBlocks(markdown);
        // 先追加新块、再删旧块：中途失败最多是内容重复，不会把文档清空
        const written = children.length > 0 ? await feishu.appendBlocks(documentId, children) : 0;
        if (existing.length > 0) await feishu.deleteChildren(documentId, 0, existing.length);
        const after = await feishu.readDoc(documentId);
        const afterRevision = await feishu.documentRevision(documentId, identity);
        return send(response, 200, { documentId, mode: 'full', removed: existing.length, blocks: written, backupFile, risk, revision: afterRevision, content: after });
      }
      return send(response, 404, { error: 'not found' });
    } catch (error) {
      return send(response, error.httpStatus || 400, {
        error: error.message,
        code: error.code || '',
        ...(error.risk ? { risk: error.risk } : {}),
        ...(error.revision ? { revision: error.revision } : {}),
      });
    }
  });
}

export function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}
