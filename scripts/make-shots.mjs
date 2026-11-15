// 用真实 client bundle 渲染三种状态并截图：会话页、文档列表、文档编辑（带大纲栏）。
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const app = 'E:/DHSdesktop/DSH Desktop/resources/app/node_modules';
const reactUmd = fs.readFileSync(`${app}/react/umd/react.development.js`, 'utf8');
const reactDomUmd = fs.readFileSync(`${app}/react-dom/umd/react-dom.development.js`, 'utf8');
const client = fs.readFileSync('C:/Users/19941/notes/feishu-plugin/lib/client.js', 'utf8');

const mockDrive = `{ folders: [{ token: 'f1', name: '拆书', type: 'folder' }, { token: 'f2', name: '小说', type: 'folder' }],
  files: [
    { token: 'd1', name: '起点拆书 · 卷一', type: 'docx', modified: Date.now()/1000 },
    { token: 'd2', name: '人物小传', type: 'docx', modified: Date.now()/1000 },
    { token: 'd3', name: '投放排期', type: 'sheet', modified: Date.now()/1000 },
    { token: 'd4', name: '素材命名规范', type: 'docx', modified: Date.now()/1000 },
  ] }`;

const mockBlocks = `{ blocks: [
  { id: 'b0', type: 'h1', text: '起点拆书 · 卷一' },
  { id: 'b1', type: 'p', text: '这一版把开头换成了场景化切入，不再从参数讲起。' },
  { id: 'b2', type: 'h2', text: '改了哪些' },
  { id: 'b3', type: 'bullet', text: '第三段删掉了一个数据' },
  { id: 'b4', type: 'bullet', text: '结尾加了一句行动号召' },
  { id: 'b5', type: 'h2', text: '下一步' },
  { id: 'b6', type: 'p', text: '把人物线补完，再决定要不要拆成两篇。' },
  { id: 'b7', type: 'h3', text: '细节备注' },
  { id: 'b8', type: 'p', text: '这里先留空，等编辑确认。' },
] }`;

function page(steps) {
  return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#eef1f6;font-family:system-ui} #root{width:360px;height:740px;background:#fff;overflow:hidden}</style>
</head><body><div id="root"></div>
<script>${reactUmd}</script><script>${reactDomUmd}</script>
<script>
const errs = [];
window.addEventListener('error', (e) => errs.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => errs.push('rej: ' + (e.reason && e.reason.message)));
window.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('/status') ? { ok: true, bot: { name: '测试机器人' } }
    : u.includes('/auth') ? { authorized: true, name: 'masuzu328', missing: [] }
    : u.includes('/chats') ? { chats: [{ chatId: 'c1', name: 'DSH会话管理', description: '群会话' }, { chatId: 'c2', name: '设计组', description: '群会话' }] }
    : u.includes('/messages') ? { messages: [
        { id: 'm5', type: 'text', text: '对，要么发群，要么建成飞书文档给你。', senderType: 'app', senderName: '机器人', createTime: String(Date.now()/1000 - 60) },
        { id: 'm4', type: 'text', text: '那以后文案写完直接丢这儿？', senderType: 'user', senderName: '成员', createTime: String(Date.now()/1000 - 120) },
        { id: 'm3', type: 'text', text: '笑哭', senderType: 'user', senderName: '成员', createTime: String(Date.now()/1000 - 180) },
        { id: 'm2', type: 'text', text: '看得见。这条是从 DSH 面板发出来的。', senderType: 'app', senderName: '机器人', createTime: String(Date.now()/1000 - 240) },
        { id: 'm1', type: 'text', text: '看得见吗', senderType: 'user', senderName: '成员', createTime: String(Date.now()/1000 - 300) },
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
  ['web', `setTimeout(() => { document.querySelectorAll('.fs-tab')[2].click(); }, 500);`],
  ['move', moveSteps],
  ['type', openDoc + `setTimeout(() => { const b = [...document.querySelectorAll('.fs-btn')].find((x) => x.textContent.trim() === 'Aa'); b && b.click(); }, 1500);`],
  ['chats', ''],
  ['docs', `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 400);`],
  [
    'editor',
    `setTimeout(() => { document.querySelectorAll('.fs-tab')[1].click(); }, 300);
     setTimeout(() => { const rows = document.querySelectorAll('.fs-drow'); (rows[2] || rows[0]).click(); }, 900);
     setTimeout(() => { const b = [...document.querySelectorAll('.fs-btn')].find((x) => x.textContent.trim() === '大纲'); b && b.click(); }, 1500);
     setTimeout(() => { const b = [...document.querySelectorAll('.fs-btn')].find((x) => x.textContent.trim() === 'Aa'); b && b.click(); }, 1800);
     setTimeout(() => { const r = document.querySelector('.fs-outline-rail'); const bd = document.querySelector('.fs-doc-body'); const mn = document.querySelector('.fs-doc-main'); document.title = 'wide=' + [...document.querySelectorAll('*')].filter((el) => el.getBoundingClientRect().right > 381).map((el) => (el.className || el.tagName) + ':' + Math.round(el.getBoundingClientRect().right)).slice(0, 10).join(' | '); }, 2400);`,
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
