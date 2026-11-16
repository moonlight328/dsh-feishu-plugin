// 用真实 client bundle 渲染各种状态并截图：会话页、文档列表、文档编辑、输入法、只读块。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// React UMD 由宿主机器的 node_modules 提供，DSH 换版后位置会变 —— 按候选挨个试。
const REACT_ROOTS = [
  'C:/Users/19941/.dsh/plugins/eac-design-world/node_modules',
  'C:/Users/19941/AppData/Roaming/dsh-desktop/harness/profiles/node_modules',
  'E:/DHSdesktop/DSH Desktop/resources/app/node_modules',
];
let reactUmd = null;
let reactDomUmd = null;
for (const root of REACT_ROOTS) {
  try {
    reactUmd = fs.readFileSync(`${root}/react/umd/react.development.js`, 'utf8');
    reactDomUmd = fs.readFileSync(`${root}/react-dom/umd/react-dom.development.js`, 'utf8');
    break;
  } catch {
    /* 试下一个 */
  }
}
if (!reactUmd || !reactDomUmd) {
  console.error('找不到 React UMD，试过：\n  ' + REACT_ROOTS.join('\n  '));
  process.exit(1);
}
const client = fs.readFileSync('C:/Users/19941/notes/feishu-plugin/lib/client.js', 'utf8');

const mockDrive = `{ folders: [{ token: 'f1', name: '拆书', type: 'folder' }, { token: 'f2', name: '小说', type: 'folder' }],
  files: [
    { token: 'd1', name: '起点拆书 · 卷一', type: 'docx', modified: Date.now()/1000 },
    { token: 'd2', name: '人物小传', type: 'docx', modified: Date.now()/1000 },
    { token: 'd3', name: '投放排期', type: 'sheet', modified: Date.now()/1000 },
    { token: 'd4', name: '素材命名规范', type: 'docx', modified: Date.now()/1000 },
  ] }`;

const mockBlocks = `{ unsupported: 1, styled: 1, blocks: [
  { id: 'b0', type: 'h1', text: '起点拆书 · 卷一', supported: true },
  { id: 'b1', type: 'p', text: '这一版把开头换成了场景化切入，不再从参数讲起。', supported: true },
  { id: 'b2', type: 'h2', text: '改了哪些', supported: true },
  { id: 'b3', type: 'bullet', text: '第三段删掉了一个数据', supported: true },
  { id: 'b4', type: 'bullet', text: '结尾加了一句行动号召', supported: true },
  { id: 'b5', type: 'h2', text: '下一步', supported: true },
  { id: 'b6', type: 'ordered', text: '先把人物线补完', supported: true },
  { id: 'b7', type: 'ordered', text: '再看要不要拆成两篇', supported: true },
  { id: 'b8', type: 'ordered', text: '最后调标题', supported: true },
  { id: 'b9', type: 'unsupported', text: '', supported: false, kind: '表格', blockType: 29 },
  { id: 'b10', type: 'p', text: '这段有 加粗 和 链接 还有 代码', supported: true, rich: true,
    spans: [{ text: '这段有 ' }, { text: '加粗', bold: true }, { text: ' 和 ' }, { text: '链接', link: 'https://example.com' }, { text: ' 还有 ' }, { text: '代码', code: true }] },
  { id: 'b11', type: 'p', text: '', supported: true },
  { id: 'b12', type: 'todo', text: '把封面图定下来', supported: true, done: false },
  { id: 'b13', type: 'todo', text: '这版结构已经过了', supported: true, done: true },
  { id: 'b14', type: 'quote', text: '先把能做完的做完，再谈优化。', supported: true },
  { id: 'b15', type: 'divider', text: '', supported: true },
] }`;

function page(steps) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#eef1f6;font-family:system-ui} #root{width:360px;height:740px;background:#fff;overflow:hidden}</style>
</head><body><div id="root"></div>
<script>${reactUmd}</script><script>${reactDomUmd}</script>
<script>
const errs = [];
window.addEventListener('error', (e) => {
  errs.push(String(e.message));
  try {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#dc2626;color:#fff;font:11px/1.4 monospace;padding:6px;white-space:pre-wrap';
    d.textContent = 'JS ERROR: ' + e.message;
    document.body.appendChild(d);
  } catch (_) {}
});
window.addEventListener('unhandledrejection', (e) => errs.push('rej: ' + (e.reason && e.reason.message)));
window.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('/status') ? { ok: true, bot: { name: '测试机器人' } }
    : u.includes('/auth') ? { authorized: true, name: 'masuzu328', missing: [] }
    : u.includes('/chats') ? { chats: [{ chatId: 'c1', name: 'DSH会话管理', description: '群会话' }, { chatId: 'c2', name: '设计组', description: '群会话' }] }
    : u.includes('/messages') ? { hasMore: true, pageToken: 'p2', messages: [
        { id: 'm7', type: 'file', text: '[文件] 投放排期.xlsx', senderType: 'user', senderName: '成员', time: Date.now() - 30000,
          media: { kind: 'file', fileKey: 'file_7', fileName: '投放排期.xlsx', size: 1536000 }, segments: [] },
        { id: 'm6', type: 'post', text: '刚更新了方案 见文档 @小林 记得看 [OK]', senderType: 'user', senderName: '成员', time: Date.now() - 45000,
          segments: [
            { kind: 'text', text: '刚更新了方案 ' },
            { kind: 'link', text: '见文档', href: 'https://my.feishu.cn/docx/abc' },
            { kind: 'text', text: ' ' },
            { kind: 'mention', text: '@小林', memberId: 'ou_lin' },
            { kind: 'text', text: ' 记得看 ' },
            { kind: 'emoji', text: '[OK]', emojiType: 'OK' },
          ], media: null },
        { id: 'm5', type: 'text', text: '对，要么发群，要么建成飞书文档给你。', senderType: 'app', senderName: '机器人', time: Date.now() - 60000,
          segments: [{ kind: 'text', text: '对，要么发群，要么建成飞书文档给你。' }], media: null },
        { id: 'm4', type: 'text', text: '那以后文案写完直接丢这儿？', senderType: 'user', senderName: '成员', time: Date.now() - 120000,
          segments: [{ kind: 'text', text: '那以后文案写完直接丢这儿？' }], media: null },
        { id: 'm3b', type: 'text', text: '[笑哭]', senderType: 'user', senderName: '成员', time: Date.now() - 150000,
          segments: [{ kind: 'text', text: '[笑哭]' }], media: null },
        { id: 'm3c', type: 'text', text: '收到 [强] 谢谢 [玫瑰]', senderType: 'app', senderName: '机器人', time: Date.now() - 170000,
          segments: [{ kind: 'text', text: '收到 [强] 谢谢 [玫瑰]' }], media: null },
        { id: 'm2', type: 'text', text: '看得见。这条是从 DSH 面板发出来的。', senderType: 'app', senderName: '机器人', time: Date.now() - 240000,
          segments: [{ kind: 'text', text: '看得见。这条是从 DSH 面板发出来的。' }], media: null },
        { id: 'm1', type: 'text', text: '看得见吗', senderType: 'user', senderName: '成员', time: Date.now() - 300000,
          segments: [{ kind: 'text', text: '看得见吗' }], media: null },
      ] }
    : u.includes('/search') ? { keyword: '拆书', files: [
        { token: 's1', name: '起点拆书', type: 'docx' },
        { token: 's2', name: '拆书方法论 v3', type: 'docx' },
        { token: 's3', name: '拆书排期', type: 'sheet' },
      ] }
    : u.includes('/drive') ? ${mockDrive}
    : u.includes('/docblocks') ? ${mockBlocks}
    : {};
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
};
let exported = null;
window.__ModuleLoader__ = { load({ id, factory }) { exported = factory((n) => { if (n === 'react') return window.React; throw new Error('require ' + n); }); } };
try {
${client}
} catch (e) { document.title = 'bundle error: ' + e.message; }
const reg = { slot: null };
exported.apply({ effect: (f) => f(), sidebarRightTabs: { register: () => () => {} }, slots: { inject: (n, run) => run(), register: (d, c) => { reg.slot = c; return () => {}; } } });
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(reg.slot, {}));
${steps}
</script></body></html>`;
}

const openDoc = `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);`;

const openDocs = `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 400);`;
const moveSteps = openDocs + `
     setTimeout(() => {
       const row = document.querySelectorAll('.fs-drow')[2] || document.querySelectorAll('.fs-drow')[0];
       const box = row.getBoundingClientRect();
       row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: box.left + 20, clientY: box.top + 8 }));
     }, 900);
     setTimeout(() => {
       const item = [...document.querySelectorAll('.fs-menu-item')].find((x) => x.textContent.indexOf('移动') >= 0);
       item && item.click();
     }, 1500);`;

const shots = [

  [
    // 右键改块类型：之前 onChange 被字面量 \n 注释掉，点了没反应
    'typefix',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);
     setTimeout(() => {
       
       const banner = (title, detail, ok) => {
         const d = document.createElement('div');
         d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;background:' + (ok ? '#16a34a' : '#dc2626') + ';color:#fff;font:11px/1.5 system-ui;padding:7px 9px;white-space:pre-wrap';
         d.textContent = title + '  ' + detail;
         document.body.appendChild(d);
       };
       const block = document.querySelector('.fs-block[data-type=p]');
       if (!block) { banner('TYPEFIX SKIP', '没找到正文块', false); return; }
       const rect = block.getBoundingClientRect();
       block.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: Math.round(rect.left + 50), clientY: Math.round(rect.top + 8) }));
       setTimeout(() => {
         const items = [...document.querySelectorAll('.fs-menu-item')];
         const h1 = items.find((b) => (b.textContent || '').indexOf('标题 1') >= 0);
         if (!h1) { banner('TYPEFIX FAIL', '菜单里没有「标题 1」，菜单项数=' + items.length, false); return; }
         h1.click();
         setTimeout(() => {
           const count = document.querySelectorAll('.fs-block[data-type=h1]').length;
           banner(count > 0 ? 'TYPEFIX OK' : 'TYPEFIX FAIL', 'h1 块数=' + count, count > 0);
         }, 250);
       }, 250);
     }, 1400);`
  ],
  [
    // 选中文字 → 格式条 → 块类型下拉 → 标题 1
    'kindmenu',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);
     setTimeout(() => {
       
       const banner = (title, detail, ok) => {
         const d = document.createElement('div');
         d.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;background:' + (ok ? '#16a34a' : '#dc2626') + ';color:#fff;font:11px/1.5 system-ui;padding:7px 9px;white-space:pre-wrap';
         d.textContent = title + '  ' + detail;
         document.body.appendChild(d);
       };
       const texts = [...document.querySelectorAll('.fs-block-text')].filter((t) => (t.textContent || '').trim().length > 3);
       const target = texts[0];
       if (!target) { banner('KINDMENU SKIP', '没找到有字的块', false); return; }
       target.focus();
       const range = document.createRange();
       range.selectNodeContents(target);
       const sel = window.getSelection();
       sel.removeAllRanges();
       sel.addRange(range);
       document.dispatchEvent(new Event('selectionchange'));
       setTimeout(() => {
         const kindBtn = document.querySelector('.fs-fmt-kind');
         if (!kindBtn) { banner('KINDMENU FAIL', '格式条里没有块类型按钮', false); return; }
         kindBtn.click();
         setTimeout(() => {
           const items = [...document.querySelectorAll('.fs-fmt-type-item')];
           const h1 = items.find((b) => (b.textContent || '').trim() === '标题 1');
           if (!h1) { banner('KINDMENU FAIL', '下拉里没有「标题 1」，项数=' + items.length, false); return; }
           h1.click();
           setTimeout(() => {
             const count = document.querySelectorAll('.fs-block[data-type=h1]').length;
             banner(count > 0 ? 'KINDMENU OK' : 'KINDMENU FAIL', 'h1 块数=' + count, count > 0);
           }, 250);
         }, 250);
       }, 300);
     }, 1400);`
  ],

  [
    // 搜索框应该跨文件夹搜（走 /search）
    'search2',
    `setTimeout(() => {
       const tab = document.querySelectorAll('.fs-tab')[1];
       if (tab) tab.click();
     }, 600);
     setTimeout(() => {
       const input = document.querySelector('.fs-search-input');
       if (!input) return;
       const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
       setter.call(input, '拆书');
       input.dispatchEvent(new Event('input', { bubbles: true }));
     }, 1500);`
  ],
  [
    // 选中文字应该浮出格式条
    'toolbar',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);
     setTimeout(() => {
       const texts = [...document.querySelectorAll('.fs-block-text')].filter((t) => (t.textContent || '').trim().length > 3);
       const target = texts[texts.length - 1] || texts[0];
       if (!target) { document.title = 'no block'; return; }
       target.focus();
       const range = document.createRange();
       range.selectNodeContents(target);
       const sel = window.getSelection();
       sel.removeAllRanges();
       sel.addRange(range);
       document.dispatchEvent(new Event('selectionchange'));
       setTimeout(() => {
         const bar = document.querySelector('.fs-fmt');
         const banner = document.createElement('div');
         banner.style.cssText = 'position:fixed;right:6px;bottom:6px;z-index:9999;background:' + (bar ? '#16a34a' : '#dc2626') + ';color:#fff;font:11px/1.4 system-ui;padding:6px 8px;border-radius:6px';
         banner.textContent = (bar ? 'TOOLBAR OK' : 'TOOLBAR FAIL') + ' 按钮数=' + (bar ? bar.querySelectorAll('.fs-fmt-btn').length : 0);
         document.body.appendChild(banner);
       }, 250);
     }, 1400);`
  ],
  [
    // 乐观发送：点发送后消息应立刻出现在列表里（不等服务端）
    'send',
    `setTimeout(() => {
       const ta = document.querySelector('.fs-composer textarea');
       if (!ta) { document.title = 'no textarea'; return; }
       const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
       setter.call(ta, '乐观发送测试：这条应该立刻出现');
       ta.dispatchEvent(new Event('input', { bubbles: true }));
       setTimeout(() => {
         const btn = document.querySelector('.fs-send');
         if (btn) btn.click();
         setTimeout(() => {
           const texts = [...document.querySelectorAll('.fs-bubble')].map((b) => b.textContent || '');
           const ok = texts.some((t) => t.includes('乐观发送测试'));
           const pending = Boolean(document.querySelector('.fs-msg-row[data-pending=true]')) || texts.some((t) => t.includes('发送中'));
           const banner = document.createElement('div');
           banner.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;background:' + (ok ? '#16a34a' : '#dc2626') + ';color:#fff;font:12px/1.5 system-ui;padding:8px 10px;white-space:pre-wrap';
           banner.textContent = (ok ? 'SEND OK' : 'SEND FAIL') + '  消息立刻可见=' + ok + '  出现发送中态=' + pending;
           document.body.appendChild(banner);
         }, 500);
       }, 250);
     }, 600);`
  ],
  [
    // 撤销：改一段文字 → Ctrl+Z → 应该退回原文
    'undo',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);
     setTimeout(() => {
       const pick = () => document.querySelectorAll('.fs-block-text')[1];
       const t = pick();
       const before = (t || {}).textContent || '';
       if (t) {
         t.focus();
         t.textContent = before + '【临时输入】';
         t.dispatchEvent(new Event('input', { bubbles: true }));
       }
       setTimeout(() => {
         const typed = (pick() || {}).textContent || '';
         window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', code: 'KeyZ', ctrlKey: true, bubbles: true, cancelable: true }));
         setTimeout(() => {
           const after = (pick() || {}).textContent || '';
           const typedOk = typed.includes('【临时输入】');
           const undoOk = after === before;
           const ok = typedOk && undoOk;
           const banner = document.createElement('div');
           banner.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;background:' + (ok ? '#16a34a' : '#dc2626') + ';color:#fff;font:12px/1.5 system-ui;padding:8px 10px;white-space:pre-wrap';
           banner.textContent = (ok ? 'UNDO OK' : 'UNDO FAIL') + '\\n输入后=' + (typedOk ? '含新增文字' : '没写进去') + '\\n撤销后=' + (undoOk ? '与原文一致' : '不一致：' + after.slice(0, 30));
           document.body.appendChild(banner);
         }, 200);
       }, 200);
     }, 1300);`
  ],
  [
    'drag',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);
     setTimeout(() => {
       const blocks = [...document.querySelectorAll('.fs-block')];
       const gutters = [...document.querySelectorAll('.fs-gutter')];
       const before = blocks.map((b) => (b.querySelector('.fs-block-text') || {}).textContent || '').slice(0, 3);
       const dt = new DataTransfer();
       gutters[2].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
       const target = blocks[0];
       const rect = target.getBoundingClientRect();
       const at = { bubbles: true, cancelable: true, dataTransfer: dt, clientX: rect.left + 20, clientY: rect.top + 4 };
       target.dispatchEvent(new DragEvent('dragover', at));
       setTimeout(() => {
         target.dispatchEvent(new DragEvent('drop', at));
         target.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
         setTimeout(() => {
           const after = [...document.querySelectorAll('.fs-block')].map((b) => (b.querySelector('.fs-block-text') || {}).textContent || '').slice(0, 3);
           const ok = after[0] === before[2] && after[1] === before[0];
           const banner = document.createElement('div');
           banner.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;background:' + (ok ? '#16a34a' : '#dc2626') + ';color:#fff;font:12px/1.5 system-ui;padding:8px 10px;white-space:pre-wrap';
           banner.textContent = (ok ? 'DRAG OK' : 'DRAG FAIL') + '\\n前:' + before.join(' | ') + '\\n后:' + after.join(' | ');
           document.body.appendChild(banner);
         }, 150);
       }, 80);
     }, 1400);`
  ],
  [
    'slash',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);
     setTimeout(() => {
       const all = [...document.querySelectorAll('.fs-block-text')];
       const text = all.find((t) => !(t.textContent || '').trim()) || all[0];
       if (text) {
         text.focus();
         text.dispatchEvent(new KeyboardEvent('keydown', { key: '/', code: 'Slash', bubbles: true, cancelable: true }));
       }
     }, 1500);`
  ],
  [
    'find',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);
     setTimeout(() => { const b = [...document.querySelectorAll('.fs-btn')].find((x) => x.textContent.trim() === '⌕'); b && b.click(); }, 1500);
     setTimeout(() => { const i = document.querySelector('.fs-find-input'); if (i) { i.value = '删掉'; i.dispatchEvent(new Event('input', { bubbles: true })); } }, 1900);`
  ],
  ['web', `setTimeout(() => { document.querySelectorAll('.fs-tab')[2].click(); }, 500);`],
  ['move', moveSteps],
  ['type', openDoc + `setTimeout(() => { const b = [...document.querySelectorAll('.fs-btn')].find((x) => x.textContent.trim() === 'Aa'); b && b.click(); }, 1500);`],
  ['chats', ''],
  ['docs', `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 400);`],
  [
    'locked',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);`
  ],
  [
    // 输入法组合中输入回车：块数必须不变（分段是 P0 bug）
    'ime',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);
     setTimeout(() => {
       const count = () => document.querySelectorAll('.fs-block').length;
       const before = count();
       const text = document.querySelector('.fs-block-text');
       let afterComposing = -1;
       let afterPlain = -1;
       if (text) {
         text.focus();
         text.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
         text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, isComposing: true }));
         text.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
       }
       setTimeout(() => {
         afterComposing = count();
         // 组合结束一拍之后再按回车，应该正常分段
         if (text) {
           text.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
         }
         setTimeout(() => {
           afterPlain = count();
           const ok = afterComposing === before && afterPlain === before + 1;
           const banner = document.createElement('div');
           banner.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;background:' + (ok ? '#16a34a' : '#dc2626') + ';color:#fff;font:13px/1.6 system-ui;padding:8px 10px;white-space:pre-wrap';
           banner.textContent = (ok ? 'IME OK  ' : 'IME FAIL  ') +
             'before=' + before + ' 组合中回车后=' + afterComposing + ' 普通回车后=' + afterPlain +
             '\\n期望：组合中不变、普通回车 +1';
           document.body.appendChild(banner);
         }, 120);
       }, 120);
     }, 1400);`
  ],
  [
    'editor',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);
     setTimeout(() => { const b = [...document.querySelectorAll('.fs-btn')].find((x) => x.textContent.trim() === '大纲'); b && b.click(); }, 1500);
     setTimeout(() => { const b = [...document.querySelectorAll('.fs-btn')].find((x) => x.textContent.trim() === 'Aa'); b && b.click(); }, 1800);
     setTimeout(() => { const r = document.querySelector('.fs-outline-rail'); const bd = document.querySelector('.fs-doc-body'); const mn = document.querySelector('.fs-doc-main'); document.title = 'wide=' + [...document.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > 381).map((el) => (el.className || el.tagName) + ':' + Math.round(el.getBoundingClientRect().right)).slice(0, 10).join(' | '); }, 2400);`
  ],
];

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
for (const [name, steps] of shots) {
  const html = page(steps);
  const file = `C:/Users/19941/notes/feishu-plugin/shot-${name}.html`;
  fs.writeFileSync(file, html, 'utf8');
  const out = `C:/Users/19941/notes/feishu-plugin/shot-${name}.png`;
  try {
    execFileSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--virtual-time-budget=4000', '--window-size=400,800', `--screenshot=${out}`, `file:///${file}`], { stdio: 'ignore', timeout: 60000 });
    console.log('ok:', name, fs.statSync(out).size, 'bytes');
  } catch (e) {
    console.log('fail:', name, e.message);
  }
}
