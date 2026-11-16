// 拿真实配置打一次 tenant_access_token，看飞书到底说什么。不打印 secret。
import fs from 'node:fs';

const file = 'C:/Users/19941/.dsh/profiles/desktop/cordis.patch.yml';
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const idIndex = lines.findIndex((line) => /^\s*-\s*id:\s*feishu\b/.test(line));
const found = {};
for (let i = idIndex; i < lines.length; i += 1) {
  if (i > idIndex && /^\s*-\s*id:/.test(lines[i])) break;
  const match = /^\s*(appId|appSecret|domain)\s*:\s*(.*)$/.exec(lines[i]);
  if (match) {
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    found[match[1]] = value;
  }
}

const tryHost = async (host, label) => {
  const response = await fetch(`${host}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: found.appId, app_secret: found.appSecret }),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text.slice(0, 200) };
  }
  console.log('[' + label + '] HTTP', response.status, '→ code=' + payload.code, 'msg=' + (payload.msg || payload.message || ''));
  if (payload.code === 0) console.log('   拿到 token 长度', String(payload.tenant_access_token || '').length);
  return payload.code;
};

const codeFeishu = await tryHost('https://open.feishu.cn', 'open.feishu.cn');
const codeLark = await tryHost('https://open.larksuite.com', 'open.larksuite.com');

console.log('\n结论:');
if (codeFeishu === 0) console.log('· 中国版凭据有效，问题在配置没传到插件（domain 设置或热重载）');
else if (codeLark === 0) console.log('· 这是国际版（Lark）应用！domain 要改成 lark');
else console.log('· 两个域名都不认这组 app_id/app_secret：凭据本身有问题（被重置过 / 复制少字符 / 不是自建应用）');
