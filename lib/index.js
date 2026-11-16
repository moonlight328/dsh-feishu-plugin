// feishu-plugin —— 把飞书接进 DSH。
//
// 主机半：tenant_access_token + 一组工具（发消息 / 建文档 / 追加 / 读文档 / 找群）。
// 凭证来自 patch 行的 config（App ID / App Secret），没有凭证时所有工具都返回明确的
// 「还没配凭证」，不假装成功。
//
// 注册方式：作为 bundle（package.json 的 dsh.bundle.patch + profile 的 dsh.profile.bundles），
// 这是这台机器上验证过能加载的路径。

import z from '@deepseek-ai/schemastery';

import { PREFIX, createBridge, listen } from './bridge.js';
import { firstLine, markdownToBlocks } from './markdown.js';
import { UserAuth } from './userauth.js';

export const name = 'feishu-plugin';
export const inject = ['tools'];

export const Config = z.object({
  appId: z.string().default('').description('飞书自建应用 App ID').extra('volatile', true),
  appSecret: z.string().default('').description('飞书自建应用 App Secret').extra('volatile', true),
  domain: z
    .union([z.const('feishu'), z.const('lark')])
    .default('feishu')
    .description('feishu = open.feishu.cn；lark = open.larksuite.com')
    .extra('volatile', true),
  defaultChatId: z.string().default('').description('默认发送目标群 chat_id（可留空）').extra('volatile', true),
  defaultFolderToken: z.string().default('').description('建文档时默认放进哪个文件夹（可留空 = 应用根目录）').extra('volatile', true),
  bridgePort: z.number().default(6820).description('侧栏面板本地桥的起始端口').extra('volatile', true),
  scopes: z
    .string()
    .default('drive:drive drive:drive:readonly space:document:retrieve docx:document docx:document:readonly im:resource')
    .description('授权时要申请的用户身份权限（空格分隔）')
    .extra('volatile', true),
  redirectUri: z
    .string()
    .default('http://127.0.0.1:6820/oauth/callback')
    .description('用户授权的回调地址，必须和开放平台里配置的一模一样')
    .extra('volatile', true),
});

const BASES = {
  feishu: 'https://open.feishu.cn',
  lark: 'https://open.larksuite.com',
};

// DSH（cordis loader）会把声明了 .volatile() 的配置字段包成引用对象 { get() }，
// 直接 String() 拿到的是 "[object Object]"，飞书那边就回 code=10003 invalid param。
// 每次读配置都解一层，volatile 热更新也就自动跟上了。
function unwrapVolatile(value) {
  if (value && typeof value === 'object' && typeof value.get === 'function') {
    try {
      return value.get();
    } catch {
      return undefined;
    }
  }
  return value;
}

function unwrapConfig(input) {
  const raw = unwrapVolatile(input);
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) out[key] = unwrapVolatile(value);
  return out;
}

// ── 飞书客户端 ───────────────────────────────────────────────────────────────
class Feishu {
  constructor(readConfig) {
    this.readConfig = readConfig;
    this.token = '';
    this.expiresAt = 0;
  }

  settings() {
    const cfg = unwrapConfig(this.readConfig());
    const domain = cfg.domain === 'lark' ? 'lark' : 'feishu';
    return {
      baseUrl: BASES[domain],
      domain,
      appId: String(cfg.appId || '').trim(),
      appSecret: String(cfg.appSecret || '').trim(),
      defaultChatId: String(cfg.defaultChatId || '').trim(),
      defaultFolderToken: String(cfg.defaultFolderToken || '').trim(),
    };
  }

  requireCredentials() {
    const { appId, appSecret } = this.settings();
    if (!appId || !appSecret) {
      throw new Error('还没配飞书凭证：到插件设置里填 App ID / App Secret（也可以直接写进 profile 的 cordis.patch.yml）');
    }
  }

  async tenantToken() {
    this.requireCredentials();
    if (this.token && Date.now() < this.expiresAt) return this.token;
    const { baseUrl, appId, appSecret } = this.settings();
    const response = await fetch(`${baseUrl}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      signal: AbortSignal.timeout(15000),
    });
    const payload = await response.json().catch(() => null);
    if (!payload) throw new Error(`飞书 token 接口返回了非 JSON（HTTP ${response.status}）`);
    if (payload.code !== 0 || !payload.tenant_access_token) {
      throw new Error(`拿 tenant_access_token 失败：code=${payload.code} ${payload.msg || ''}`);
    }
    this.token = payload.tenant_access_token;
    this.expiresAt = Date.now() + Math.max(60, Number(payload.expire || 7200) - 300) * 1000;
    return this.token;
  }

  async call(method, path, { query, body } = {}, options = {}) {
    const { baseUrl } = this.settings();
    let token = '';
    // 默认优先用「用户身份」——只有它能看见你自己云空间里的东西；im 类调用显式 preferUser:false
    if (options.preferUser !== false && this.auth) token = (await this.auth.token()) || '';
    if (!token) token = await this.tenantToken();
    const url = new URL(baseUrl + path);
    for (const [key, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'content-type': 'application/json; charset=utf-8' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new Error(`飞书返回了非 JSON（HTTP ${response.status}）：${text.slice(0, 200)}`);
    }
    if (payload && typeof payload.code === 'number' && payload.code !== 0) {
      const error = new Error(`飞书接口失败 ${path}：code=${payload.code} ${payload.msg || ''}`);
      error.feishuCode = payload.code;
      throw error;
    }
    if (!response.ok) throw new Error(`飞书接口 HTTP ${response.status}：${payload?.msg || ''}`);
    return payload?.data ?? payload;
  }

  async botInfo() {
    return this.call('GET', '/open-apis/bot/v3/info', {}, { preferUser: false });
  }

  async listChats() {
    const chats = [];
    let pageToken = '';
    for (let page = 0; page < 5; page += 1) {
      const data = await this.call('GET', '/open-apis/im/v1/chats', { query: { page_size: 100, page_token: pageToken } }, { preferUser: false });
      for (const item of data?.items || []) chats.push({ chatId: item.chat_id, name: item.name, description: item.description });
      if (!data?.has_more) break;
      pageToken = data.page_token || '';
      if (!pageToken) break;
    }
    return chats;
  }

  async sendMessage({ receiveId, receiveIdType, text, msgType = 'text', content }) {
    const data = await this.call('POST', '/open-apis/im/v1/messages', {
      query: { receive_id_type: receiveIdType },
      body: {
        receive_id: receiveId,
        msg_type: msgType,
        content: JSON.stringify(content || { text }),
      },
    }, { preferUser: false });
    return { messageId: data?.message_id || '', chatId: data?.chat_id || '' };
  }

  /** 上传图片 / 文件，拿到 image_key / file_key。im 上传必须走应用身份。 */
  async uploadMedia({ kind, buffer, fileName }) {
    const { baseUrl } = this.settings();
    const token = await this.tenantToken();
    const name = String(fileName || (kind === 'image' ? 'image.png' : 'file'));
    const form = new FormData();
    const blob = new Blob([new Uint8Array(buffer)]);
    if (kind === 'image') {
      form.append('image_type', 'message');
      form.append('image', blob, name);
    } else {
      form.append('file_type', 'stream');
      form.append('file_name', name);
      form.append('file', blob, name);
    }
    const path = kind === 'image' ? '/open-apis/im/v1/images' : '/open-apis/im/v1/files';
    const response = await fetch(baseUrl + path, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
      signal: AbortSignal.timeout(90000),
    });
    const payload = await response.json().catch(() => null);
    if (!payload) throw new Error(`上传失败（HTTP ${response.status}）`);
    if (payload.code !== 0) throw new Error(`上传失败：code=${payload.code} ${payload.msg || ''}`);
    const data = payload.data || {};
    if (kind === 'image') {
      if (!data.image_key) throw new Error('飞书没返回 image_key');
      return { imageKey: data.image_key };
    }
    if (!data.file_key) throw new Error('飞书没返回 file_key');
    return { fileKey: data.file_key };
  }

  async createDoc({ title, folderToken, identity = 'user' }) {
    const data = await this.call('POST', '/open-apis/docx/v1/documents', {
      body: { ...(folderToken ? { folder_token: folderToken } : {}), title },
    }, { preferUser: identity !== 'bot' });
    const documentId = data?.document?.document_id || '';
    if (!documentId) throw new Error('飞书没返回 document_id');
    return { documentId };
  }

  async appendBlocks(documentId, blocks) {
    let added = 0;
    for (let offset = 0; offset < blocks.length; offset += 40) {
      const chunk = blocks.slice(offset, offset + 40);
      await this.call('POST', `/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children`, {
        body: { children: chunk, index: -1 },
      });
      added += chunk.length;
    }
    return added;
  }

  /** 拉消息里的资源（图片 / 贴图 / 文件）。返回原始字节，桥直接吐给浏览器。 */
  async fetchResource(messageId, fileKey, kind = 'image') {
    const { baseUrl } = this.settings();
    const token = await this.tenantToken();
    const url = new URL(`${baseUrl}/open-apis/im/v1/messages/${encodeURIComponent(messageId)}/resources/${encodeURIComponent(fileKey)}`);
    url.searchParams.set('type', kind === 'file' ? 'file' : 'image');
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`拉资源失败（HTTP ${response.status}）：${text.slice(0, 160)}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, contentType: response.headers.get('content-type') || 'application/octet-stream', bytes: buffer.length };
  }

  /**
   * 重命名。
   * docx 文档的标题就是文档根块（block_type=1）的文字——实测 PATCH 根块的
   * update_text_elements 就能改名（drive 的 PATCH /files 对应用身份是 981002 无权限）。
   * 其它类型（表格/多维表格/文件）才走 drive 的重命名接口。
   */
  /** 列指定文件夹下的内容（空 = 我的空间根目录）。用户身份才能看到你自己的文件。 */
  async listFiles(folderToken = '', identity = 'user') {
    const files = [];
    let pageToken = '';
    for (let page = 0; page < 5; page += 1) {
      const data = await this.call('GET', '/open-apis/drive/v1/files', {
        query: { folder_token: folderToken, page_size: 100, order_by: 'EditedTime', direction: 'DESC', page_token: pageToken },
      }, { preferUser: identity !== 'bot' });
      for (const file of data?.files || []) {
        files.push({
          token: file.token,
          name: file.name,
          type: file.type,
          url: file.url,
          modified: Number(file.modified_time || 0),
        });
      }
      if (!data?.has_more) break;
      pageToken = data.next_page_token || '';
      if (!pageToken) break;
    }
    return files;
  }

  /** 新建文件夹（parent 为空 = 我的空间根目录）。 */
  async createFolder(name, parentToken = '', identity = 'user') {
    const data = await this.call('POST', '/open-apis/drive/v1/files/create_folder', {
      body: { name, folder_token: parentToken },
    }, { preferUser: identity !== 'bot' });
    return { token: data?.token || '', name };
  }

  async renameFile(fileToken, name, type = 'docx') {
    if (type === 'docx' || type === 'doc') {
      return this.call('PATCH', `/open-apis/docx/v1/documents/${encodeURIComponent(fileToken)}/blocks/${encodeURIComponent(fileToken)}`, {
        body: { update_text_elements: { elements: [{ text_run: { content: name } }] } },
      });
    }
    return this.call('PATCH', `/open-apis/drive/v1/files/${encodeURIComponent(fileToken)}`, {
      body: { name, type },
    });
  }

  /** 删除云文档（进回收站）。 */
  async deleteFile(fileToken, type = 'docx') {
    return this.call('DELETE', `/open-apis/drive/v1/files/${encodeURIComponent(fileToken)}`, {
      query: { type },
    });
  }

  /** 下载文档里的图片（云空间媒体接口，用你的身份）。 */
  async downloadMedia(fileToken, identity = 'user') {
    const { baseUrl } = this.settings();
    let token = '';
    if (identity !== 'bot' && this.auth) token = (await this.auth.token()) || '';
    if (!token) token = await this.tenantToken();
    const response = await fetch(`${baseUrl}/open-apis/drive/v1/medias/${encodeURIComponent(fileToken)}/download`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`下载图片失败（HTTP ${response.status}）：${text.slice(0, 160)}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, bytes: buffer.length, contentType: response.headers.get('content-type') || 'image/png' };
  }

  /** 把文件/文件夹移动到另一个文件夹（目标 folder_token 为空表示根目录）。 */
  async moveFile(fileToken, type = 'docx', folderToken = '', identity = 'user') {
    const data = await this.call(
      'POST',
      `/open-apis/drive/v1/files/${encodeURIComponent(fileToken)}/move`,
      { body: { type, folder_token: folderToken || '' } },
      { preferUser: identity !== 'bot' }
    );
    return data?.data ?? data;
  }

  async readDoc(documentId) {
    const data = await this.call('GET', `/open-apis/docx/v1/documents/${documentId}/raw_content`);
    return String(data?.content ?? '');
  }

  /** 文档当前 revision，用来判断打开之后有没有人在飞书里改过。拿不到返回 0。 */
  async documentRevision(documentId, identity = 'user') {
    try {
      const data = await this.call('GET', `/open-apis/docx/v1/documents/${documentId}`, {}, { preferUser: identity !== 'bot' });
      return Number(data?.document?.revision_id) || 0;
    } catch {
      // 权限不足或接口变动都不该挡住保存，交给调用方按「未知」处理
      return 0;
    }
  }

  /** 文档正文的直接子块（按文档顺序）。用于「整篇覆盖保存」前先数清楚有几块。 */
  async listChildBlocks(documentId, identity = 'user') {
    // 必须翻页取全：飞书单页最多 500 块，只取一页会让超长文档在保存时只删掉前半截，
    // 后半截旧块留在原地和新内容混在一起（内容重复且越滚越多）。
    const items = [];
    let pageToken = '';
    for (let page = 0; page < 200; page += 1) {
      const data = await this.call('GET', `/open-apis/docx/v1/documents/${documentId}/blocks`, {
        query: { page_size: 500, document_revision_id: -1, ...(pageToken ? { page_token: pageToken } : {}) },
      }, { preferUser: identity !== 'bot' });
      const batch = Array.isArray(data?.items) ? data.items : [];
      items.push(...batch);
      if (!data?.has_more) break;
      pageToken = data?.page_token || '';
      if (!pageToken) break;
    }
    return items.filter((item) => item.parent_id === documentId);
  }

  /** 删掉文档正文第 start..end 个子块（用于整篇替换）。 */
  async deleteChildren(documentId, startIndex, endIndex) {
    return this.call('DELETE', `/open-apis/docx/v1/documents/${documentId}/blocks/${documentId}/children/batch_delete`, {
      body: { start_index: startIndex, end_index: endIndex },
    });
  }
}

// ── 工具 ─────────────────────────────────────────────────────────────────────
const text = (description) => ({ type: 'string', description });

function toolDefinitions() {
  return [
    {
      name: 'feishu_status',
      readOnly: true,
      description: '检查飞书连接：凭证有没有配、token 拿不拿得到、机器人是谁。发消息和写文档之前先跑它。',
      inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
      run: async (feishu) => {
        const settings = feishu.settings();
        const state = { ok: false, domain: settings.domain || 'feishu', baseUrl: settings.baseUrl, appIdSet: Boolean(settings.appId), bot: null, error: '' };
        try {
          const info = await feishu.botInfo();
          state.bot = { name: info?.bot?.app_name || '', openId: info?.bot?.open_id || '', avatar: info?.bot?.avatar_url || '' };
          state.ok = true;
        } catch (error) {
          state.error = error.message;
        }
        return state;
      },
    },
    {
      name: 'feishu_find_chat',
      readOnly: true,
      description: '列出机器人所在的飞书群，按名字模糊匹配。拿到 chatId 再发消息。',
      inputSchema: { type: 'object', properties: { query: text('群名关键词，可留空列出全部') }, required: [], additionalProperties: false },
      run: async (feishu, args) => {
        const chats = await feishu.listChats();
        const needle = String(args.query || '').trim().toLowerCase();
        const matched = needle ? chats.filter((chat) => String(chat.name || '').toLowerCase().includes(needle)) : chats;
        return { total: chats.length, matched: matched.length, chats: matched.slice(0, 30) };
      },
    },
    {
      name: 'feishu_send_message',
      description: '给飞书群或某个人发一条文本消息。不给目标就用配置里的默认群。',
      inputSchema: {
        type: 'object',
        properties: {
          text: text('消息正文（纯文本，支持换行）'),
          chatId: text('群 chat_id，可省略'),
          openId: text('个人 open_id，可省略'),
          email: text('个人邮箱，可省略（openId 优先）'),
        },
        required: ['text'],
        additionalProperties: false,
      },
      run: async (feishu, args) => {
        const settings = feishu.settings();
        const content = String(args.text || '').trim();
        if (!content) throw new Error('消息正文是空的');
        if (args.chatId || (!args.openId && !args.email && settings.defaultChatId)) {
          const chatId = String(args.chatId || settings.defaultChatId);
          return { sent: true, target: { type: 'chat_id', id: chatId }, ...(await feishu.sendMessage({ receiveId: chatId, receiveIdType: 'chat_id', text: content })) };
        }
        if (args.openId) {
          return { sent: true, target: { type: 'open_id', id: args.openId }, ...(await feishu.sendMessage({ receiveId: String(args.openId), receiveIdType: 'open_id', text: content })) };
        }
        if (args.email) {
          return { sent: true, target: { type: 'email', id: args.email }, ...(await feishu.sendMessage({ receiveId: String(args.email), receiveIdType: 'email', text: content })) };
        }
        throw new Error('没给目标：传 chatId / openId / email，或者先在设置里配 defaultChatId');
      },
    },
    {
      name: 'feishu_create_doc',
      description: '把 Markdown 写成一篇飞书文档（标题 + 正文块）。返回 documentId，用它继续追加或读回。',
      inputSchema: {
        type: 'object',
        properties: {
          title: text('文档标题，可留空（取正文第一行）'),
          markdown: text('正文 Markdown'),
          folderToken: text('放进哪个云文档文件夹，可留空'),
        },
        required: ['markdown'],
        additionalProperties: false,
      },
      run: async (feishu, args) => {
        const markdown = String(args.markdown || '').trim();
        if (!markdown) throw new Error('正文是空的');
        const settings = feishu.settings();
        const title = String(args.title || '').trim() || firstLine(markdown);
        const created = await feishu.createDoc({ title, folderToken: args.folderToken || settings.defaultFolderToken });
        const blocks = markdownToBlocks(markdown, title);
        const written = await feishu.appendBlocks(created.documentId, blocks);
        return { documentId: created.documentId, title, blocks: written, note: '打开飞书云文档用 documentId 拼 /docx/<id>' };
      },
    },
    {
      name: 'feishu_append_doc',
      description: '往已有飞书文档末尾追加 Markdown 内容。',
      inputSchema: {
        type: 'object',
        properties: { documentId: text('文档 id'), markdown: text('要追加的 Markdown') },
        required: ['documentId', 'markdown'],
        additionalProperties: false,
      },
      run: async (feishu, args) => {
        const markdown = String(args.markdown || '').trim();
        if (!markdown) throw new Error('要追加的内容是空的');
        const blocks = markdownToBlocks(markdown);
        const written = await feishu.appendBlocks(String(args.documentId), blocks);
        return { documentId: args.documentId, blocks: written };
      },
    },
    {
      name: 'feishu_read_doc',
      description: '读飞书文档的纯文本内容（raw content）。',
      inputSchema: {
        type: 'object',
        properties: { documentId: text('文档 id') },
        required: ['documentId'],
        additionalProperties: false,
      },
      run: async (feishu, args) => {
        const content = await feishu.readDoc(String(args.documentId));
        return { documentId: args.documentId, characters: content.length, content };
      },
    },
  ];
}

function toRegistrations(ctx, feishu, definitions) {
  return definitions.map((definition) => ({
    name: definition.name,
    description: definition.description,
    parameters: definition.inputSchema,
    output: { schema: {}, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
    isConcurrencySafe: () => definition.readOnly === true,
    async execute(args, execution) {
      execution?.signal?.throwIfAborted();
      return definition.run(feishu, args || {});
    },
  }));
}

const INSTRUCTIONS = [
  '你连着用户的飞书（feishu_* 工具）。',
  '发消息前可以用 feishu_find_chat 找群；写文案用 feishu_create_doc，写进文档的 Markdown 会转成飞书文档块。',
  '工具报「还没配飞书凭证」时直说没配，不要编造已发送。',
].join('\n');

export function apply(ctx, config) {
  // config 里 volatile 字段是引用对象，留着原始引用由 settings() 每次解包，
  // 这样设置面板改了凭据不用重挂插件也能读到新值。
  const current = { config: unwrapConfig(config) };
  const feishu = new Feishu(() => config);
  const settings = feishu.settings();
  const auth = new UserAuth({
    baseUrl: settings.baseUrl,
    appId: settings.appId,
    appSecret: settings.appSecret,
    redirectUri: String(current.config.redirectUri || 'http://127.0.0.1:6820/oauth/callback'),
    scopes: String(current.config.scopes || 'drive:drive drive:drive:readonly space:document:retrieve docx:document docx:document:readonly im:resource'),
    tokenFile: new URL('../.user-token.json', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
    log: (message) => console.log(`[feishu-plugin] ${message}`),
  });
  feishu.auth = auth;

  // 启动自检：把「插件实际拿到的」凭据形状写进日志。排查 code=10003 时先看这一行，
  // 它跟 profile 的 cordis.patch.yml 对不上，就说明配置没合并进来或读的是旧值。
  console.log(
    `[feishu-plugin] 凭据自检：appId ${
      settings.appId ? `长度 ${settings.appId.length}（${settings.appId.slice(0, 4)}…）` : '空'
    }，appSecret ${settings.appSecret ? `长度 ${settings.appSecret.length}` : '空'}，domain ${settings.domain || 'feishu'}`
  );

  const disposers = toRegistrations(ctx, feishu, toolDefinitions()).map((definition) => ctx.tools.register(definition));
  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try {
        dispose?.();
      } catch {
        /* teardown 里不抛 */
      }
    }
  }, 'feishu-plugin: tools');

  // 侧栏面板的本地桥：浏览器半不拿 App Secret，请求都从这里过。
  let bridgePort = 0;
  const bridge = createBridge(feishu, auth);
  const basePort = Number(current.config.bridgePort ?? 6820) || 6820;
  const startBridge = async () => {
    for (let offset = 0; offset < 6; offset += 1) {
      try {
        await listen(bridge, '127.0.0.1', basePort + offset);
        bridgePort = basePort + offset;
        console.log(`[feishu-plugin] 面板桥在 http://127.0.0.1:${bridgePort}${PREFIX}`);
        return;
      } catch (error) {
        if (error?.code !== 'EADDRINUSE' || offset === 5) {
          console.warn(`[feishu-plugin] 面板桥起不来：${error.message}`);
          return;
        }
      }
    }
  };
  startBridge();
  ctx.effect(() => () => bridge.close(), 'feishu-plugin: bridge');

  const systemPrompt = ctx.get?.('systemPrompt') ?? ctx.systemPrompt;
  if (systemPrompt?.section) {
    ctx.effect(
      () => systemPrompt.section({ name: 'feishu-plugin:usage', order: 8700, interpolate: false, text: INSTRUCTIONS }),
      'feishu-plugin: system prompt'
    );
  }

  return { feishu, auth, get port() { return bridgePort; } };
}