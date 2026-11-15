// 「网页版」不再用 iframe（飞书禁止被嵌套），改成入口页 + 系统浏览器打开。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let t = fs.readFileSync(file, 'utf8');

const old = `        tab === 'web'
          ? h('iframe', {
              key: 'feishu-web',
              src: 'https://my.feishu.cn/messenger/',
              title: '飞书网页版',
              style: { flex: 1, width: '100%', minHeight: 0, border: 0, background: '#fff' },
              allow: 'clipboard-read; clipboard-write; microphone; camera; fullscreen',
            })
          : tab === 'chats' ? chatBody : docsBody,`;

if (!t.includes(old)) {
  console.error('web tab block not found');
  process.exit(1);
}

const next = `        tab === 'web' ? webBody : tab === 'chats' ? chatBody : docsBody,`;

t = t.replace(old, next);

// 插入 webBody 定义（放在 chatBody 之后）
const anchor = `      const chatBody = chats.length`;
if (!t.includes(anchor)) {
  console.error('chatBody anchor missing');
  process.exit(1);
}

const webBody = `      const WEB_ENTRIES = [
        { id: 'msg', label: '消息', icon: '💬', url: 'https://my.feishu.cn/messenger/' },
        { id: 'doc', label: '云文档', icon: '📄', url: 'https://my.feishu.cn/drive/' },
        { id: 'base', label: '多维表格', icon: '🗂', url: 'https://my.feishu.cn/base/' },
        { id: 'cal', label: '日历', icon: '📅', url: 'https://my.feishu.cn/calendar/' },
        { id: 'wiki', label: '知识库', icon: '📚', url: 'https://my.feishu.cn/wiki/' },
        { id: 'appr', label: '审批', icon: '✅', url: 'https://my.feishu.cn/approval/' },
      ];
      const openExternal = (url) => {
        try {
          window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
          /* 打不开就交给用户复制链接 */
        }
      };
      // 飞书网页版有 top === self 检测，嵌进 iframe 会白屏，所以这里给入口而不是内嵌
      const webBody = h(
        'div',
        { className: 'fs-web' },
        h(
          'div',
          { className: 'fs-web-head' },
          h('div', { className: 'fs-web-emoji' }, '🌐'),
          h('div', { className: 'fs-web-title' }, '飞书网页版'),
          h(
            'div',
            { className: 'fs-web-note' },
            '飞书的网页不允许被别的页面嵌进去（页面会检测自己是不是最外层），所以这里没法内嵌打开。点下面的入口在浏览器里打开，或者在 DSH 右栏用「浏览器」标签直接访问。'
          )
        ),
        h(
          'div',
          { className: 'fs-web-grid' },
          WEB_ENTRIES.map((entry) =>
            h(
              'button',
              { key: entry.id, type: 'button', className: 'fs-web-card', onClick: () => openExternal(entry.url) },
              h('span', { className: 'fs-web-card-icon' }, entry.icon),
              h('span', { className: 'fs-web-card-label' }, entry.label)
            )
          )
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'fs-btn fs-web-open',
            onClick: () => openExternal('https://my.feishu.cn/'),
          },
          '在浏览器打开飞书首页'
        )
      );

`;

t = t.replace(anchor, webBody + anchor);

// CSS
const cssAnchor = `      .fs-move-card{max-width:320px}`;
if (!t.includes(cssAnchor)) {
  console.error('css anchor missing');
  process.exit(1);
}
t = t.replace(
  cssAnchor,
  `      .fs-web{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:18px 14px 20px}
      .fs-web-head{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
      .fs-web-emoji{font-size:24px;line-height:1}
      .fs-web-title{font-size:15px;font-weight:650;letter-spacing:-.01em}
      .fs-web-note{font-size:11.5px;color:var(--fs-fg2);line-height:1.75}
      .fs-web-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .fs-web-card{display:flex;align-items:center;gap:8px;border:1px solid var(--fs-line-soft);background:var(--fs-bg,transparent);border-radius:10px;padding:10px 11px;font-size:12px;text-align:left}
      .fs-web-card:hover{background:var(--fs-brand-softer);border-color:var(--fs-brand-soft)}
      .fs-web-card-icon{font-size:15px;line-height:1}
      .fs-web-card-label{font-weight:500}
      .fs-web-open{align-self:flex-start;margin-top:2px}
      ${cssAnchor}`,
);

fs.writeFileSync(file, t, 'utf8');
console.log('网页版改成入口页');
