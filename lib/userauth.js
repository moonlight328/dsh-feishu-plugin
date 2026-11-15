// 用户身份的 OAuth：拿 user_access_token，用它读「我的空间」的文件夹与文档。
//
// 飞书新版授权码流程：
//   ① 浏览器打开 https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=&redirect_uri=&state=
//   ② 回跳到 redirect_uri?code=...&state=...
//   ③ POST /open-apis/authen/v2/oauth/token 换 access_token（2 小时后过期，用 refresh_token 续）
//
// token 落盘在 <插件目录>/.user-token.json（本机文件，不进 patch）。

import fs from 'node:fs';
import path from 'node:path';

export class UserAuth {
  constructor({ baseUrl, appId, appSecret, redirectUri, tokenFile, scopes = '', log = () => {} }) {
    this.baseUrl = baseUrl;
    this.appId = appId;
    this.appSecret = appSecret;
    this.redirectUri = redirectUri;
    this.tokenFile = tokenFile;
    this.scopes = String(scopes || '').trim();
    this.log = log;
    this.state = '';
    this.cache = this.#load();
  }

  #load() {
    try {
      return JSON.parse(fs.readFileSync(this.tokenFile, 'utf8'));
    } catch {
      return null;
    }
  }

  #save(data) {
    this.cache = data;
    try {
      fs.mkdirSync(path.dirname(this.tokenFile), { recursive: true });
      fs.writeFileSync(this.tokenFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      this.log(`存 user token 失败：${error.message}`);
    }
  }

  get configured() {
    return Boolean(this.appId && this.appSecret && this.redirectUri);
  }

  /** 生成授权链接（state 用来防串台，回调里核对）。 */
  authorizeUrl() {
    this.state = Math.random().toString(36).slice(2, 12);
    const url = new URL('https://accounts.feishu.cn/open-apis/authen/v1/authorize');
    url.searchParams.set('client_id', this.appId);
    url.searchParams.set('redirect_uri', this.redirectUri);
    url.searchParams.set('state', this.state);
    url.searchParams.set('response_type', 'code');
    const scope = (this.scopes + ' offline_access').replace(/\s+/g, ' ').trim();
    if (scope) url.searchParams.set('scope', scope);
    return url.toString();
  }

  async #tokenRequest(body) {
    const response = await fetch(`${this.baseUrl}/open-apis/authen/v2/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const payload = await response.json().catch(() => null);
    if (!payload || (payload.code && payload.code !== 0) || !payload.access_token) {
      const detail = payload?.error_description || payload?.msg || payload?.error || `HTTP ${response.status}`;
      throw new Error(`换 user token 失败：${detail}`);
    }
    return payload;
  }

  /** 授权码 → token。 */
  async exchange(code, state) {
    if (this.state && state && state !== this.state) throw new Error('state 不匹配，重新发起授权');
    const payload = await this.#tokenRequest({
      grant_type: 'authorization_code',
      client_id: this.appId,
      client_secret: this.appSecret,
      code,
      redirect_uri: this.redirectUri,
    });
    this.#save({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || '',
      expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 7200) - 120) * 1000,
      refreshExpiresAt: Date.now() + Math.max(60, Number(payload.refresh_token_expires_in || 2592000) - 120) * 1000,
      scope: payload.scope || '',
      name: '',
      openId: '',
    });
    await this.#whoami();
    return this.cache;
  }

  /** 拉一次自己的名字，面板上显示「已授权为 XXX」。 */
  async #whoami() {
    try {
      const response = await fetch(`${this.baseUrl}/open-apis/authen/v1/user_info`, {
        headers: { authorization: `Bearer ${this.cache.accessToken}` },
        signal: AbortSignal.timeout(15000),
      });
      const payload = await response.json();
      if (payload?.code === 0 && payload.data) {
        this.#save({ ...this.cache, name: payload.data.name || payload.data.en_name || '', openId: payload.data.open_id || '' });
      }
    } catch {
      /* 拿不到名字不影响用 */
    }
  }

  /** 有效的 access token；过期自动用 refresh_token 续，续不了返回 null。 */
  async token() {
    const cache = this.cache;
    if (!cache?.accessToken) return null;
    if (Date.now() < (cache.expiresAt || 0)) return cache.accessToken;
    if (!cache.refreshToken || Date.now() > (cache.refreshExpiresAt || 0)) return null;
    try {
      const payload = await this.#tokenRequest({
        grant_type: 'refresh_token',
        client_id: this.appId,
        client_secret: this.appSecret,
        refresh_token: cache.refreshToken,
      });
      this.#save({
        ...cache,
        accessToken: payload.access_token,
        refreshToken: payload.refresh_token || cache.refreshToken,
        expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 7200) - 120) * 1000,
      });
      this.log('user token 已续期');
      return this.cache.accessToken;
    } catch (error) {
      this.log(`续期失败：${error.message}`);
      return null;
    }
  }

  /** 每组里有一个就够；缺任意一组就干不了对应的活。 */
  static REQUIRED_GROUPS = [
    { label: '云空间', scopes: ['drive:drive', 'drive:drive:readonly', 'space:document:retrieve'] },
    { label: '文档读写', scopes: ['docx:document', 'docx:document:readonly'] },
  ];

  missingGroups() {
    const granted = String(this.cache?.scope || '');
    if (!granted) return UserAuth.REQUIRED_GROUPS.map((group) => group.label);
    const parts = granted.split(/[\s,]+/).filter(Boolean);
    return UserAuth.REQUIRED_GROUPS.filter((group) => !group.scopes.some((scope) => parts.includes(scope))).map((group) => group.label);
  }

  status() {
    const cache = this.cache;
    const missing = this.missingGroups();
    return {
      scope: String(cache?.scope || ''),
      missing,
      missingDriveScope: missing.length > 0,
      requestedScopes: this.scopes,
      authorized: Boolean(cache?.accessToken),
      name: cache?.name || '',
      expiresAt: cache?.expiresAt || 0,
      canRefresh: Boolean(cache?.refreshToken),
      redirectUri: this.redirectUri,
    };
  }

  clear() {
    this.cache = null;
    try {
      fs.rmSync(this.tokenFile, { force: true });
    } catch {
      /* 忽略 */
    }
  }
}
