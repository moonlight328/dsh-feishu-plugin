// feishu-plugin 的本地桥：给侧栏面板用。
//
// 浏览器半不拿 App Secret，所有请求都从主机走。只绑 127.0.0.1，只对 loopback 放开 CORS。

import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { blocksToChildren, firstLine, markdownToBlocks } from './markdown.js';

export const PREFIX = '/feishu-panel';

// 允许的页面来源。除了本地 http 回环，还要认 DSH 自己的自定义协议：
// 新版桌面壳的页面 origin 是 dsh-app://app，旧的 http://127.0.0.1:<port> 仍然要支持。
function loopbackOrigin(origin) {
  if (!origin) return false;
  if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(origin)) return true;
  if (/^(dsh-app|dsh|file):\/\//i.test(origin)) return true;
  if (origin === 'null') return true; // file:// 页面或沙箱 iframe
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

// 富文本（post）拍平成一行文本，顺便把里面的图片标出来
function flattenPost(content) {
  const parts = [];
  const walk = (nodes) => {
    for (const node of Array.isArray(nodes) ? nodes : []) {
      if (!node) continue;
      if (node.tag === 'text' && node.text) parts.push(node.text);
      else if (node.tag === 'a' && node.text) parts.push(node.text);
      else if (node.tag === 'at') parts.push(`@${node.user_name || node.user_id || ''}`);
      else if (node.tag === 'img') parts.push('[图片]');
      else if (node.tag === 'emotion') parts.push(node.emoji_type ? `[${node.emoji_type}]` : '[表情]');
      else if (node.tag === 'code_block' && node.text) parts.push(node.text);
      else if (Array.isArray(node.content)) walk(node.content);
    }
  };
  if (content?.title) parts.push(content.title);
  for (const line of Array.isArray(content?.content) ? content.content : []) walk(line);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function parseMessage(item) {
  const type = String(item?.msg_type || '');
  let content = {};
  try {
    content = JSON.parse(item?.body?.content || '{}');
  } catch {
    content = {};
  }
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
  };
  if (type === 'text') message.text = String(content.text || '');
  else if (type === 'post') message.text = flattenPost(content);
  else if (type === 'image') {
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
  } else if (type === 'media') {
    message.fileKey = String(content.file_key || '');
    message.text = '[视频]';
  } else if (type === 'system') {
    message.text = '（系统消息）';
  } else {
    message.text = JSON.stringify(content).slice(0, 200);
  }
  return message;
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
  if (fail) return send(400, 'text/html', `<html><body style="font:14px system-ui;padding:32px">授权被拒绝：${fail}</body></html>`);
  if (!code) return send(400, 'text/html', '<html><body style="font:14px system-ui;padding:32px">回调里没有 code</body></html>');
  if (!auth) return send(400, 'text/html', '<html><body style="font:14px system-ui;padding:32px">授权模块没装配</body></html>');
  try {
    const info = await auth.exchange(code, state);
    return send(
      200,
      'text/html',
      `<html><body style="font:14px system-ui;padding:32px;line-height:1.9">` +
        `<h3 style="margin:0 0 10px">授权成功</h3>` +
        `<div>已授权为 <b>${info?.name || '我的账号'}</b>。</div>` +
        `<div style="color:#6b7280;margin-top:8px">这个窗口可以关掉了，回到 DSH 侧栏会自动刷新。</div>` +
        `<script>setTimeout(function(){window.close()}, 1500)</script>` +
        `</body></html>`
    );
  } catch (error) {
    return send(400, 'text/html', `<html><body style="font:14px system-ui;padding:32px">授权失败：${error.message}</body></html>`);
  }
}

export function createBridge(feishu, auth) {
  return http.createServer(async (request, response) => {
    const origin = request.headers.origin;
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
        const items = await feishu.listChildBlocks(id, url.searchParams.get('identity') === 'bot' ? 'bot' : 'user');
        const pickImage = (item) => String(item?.image?.token || item?.image?.file_token || '');
        const pick = (item) => {
          const keys = ['text', 'heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6', 'heading7', 'heading8', 'heading9', 'bullet', 'ordered', 'code'];
          for (const key of keys) {
            const holder = item[key];
            if (holder && Array.isArray(holder.elements)) {
              return holder.elements.map((el) => el?.text_run?.content ?? '').join('');
            }
          }
          return '';
        };
        const typeOf = (item) => {
          const t = Number(item.block_type);
          if (t >= 3 && t <= 11) return `h${t - 2}`;
          if (t === 12) return 'bullet';
          if (t === 13) return 'ordered';
          if (t === 14) return 'code';
          return 'p';
        };
        return send(response, 200, {
          documentId: id,
          blocks: items.map((item) => {
            if (Number(item.block_type) === 27) {
              return { id: item.block_id, type: 'image', text: '', token: pickImage(item) };
            }
            return { id: item.block_id, type: typeOf(item), text: pick(item) };
          }),
        });
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

      // 整篇覆盖保存：先数现有子块 → 备份原文 → 删掉 → 按新 Markdown 重写。
      // 备份落在 <home>/.dsh/feishu-docx-backups，出事能捞回来。
      if (request.method === 'POST' && route === '/save') {
        const body = await readBody(request);
        const documentId = String(body.id || '').trim();
        if (!documentId) throw new Error('缺少 id');
        const incomingBlocks = Array.isArray(body.blocks) ? body.blocks : null;
        const markdown = String(body.markdown ?? '');
        if (!incomingBlocks && !markdown.trim()) throw new Error('正文是空的（要清空文档就别用保存）');

        const before = await feishu.readDoc(documentId);
        const backupDir = path.join(os.homedir(), '.dsh', 'feishu-docx-backups');
        fs.mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, documentId + '-' + stamp + '.md');
        fs.writeFileSync(backupFile, before, 'utf8');

        const existing = await feishu.listChildBlocks(documentId);
        const children = incomingBlocks ? blocksToChildren(incomingBlocks) : markdownToBlocks(markdown);
        // 先追加新块、再删旧块：中途失败最多是内容重复，不会把文档清空
        const written = children.length > 0 ? await feishu.appendBlocks(documentId, children) : 0;
        if (existing.length > 0) await feishu.deleteChildren(documentId, 0, existing.length);
        const after = await feishu.readDoc(documentId);
        return send(response, 200, { documentId, removed: existing.length, blocks: written, backupFile, content: after });
      }
      return send(response, 404, { error: 'not found' });
    } catch (error) {
      return send(response, 400, { error: error.message });
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
