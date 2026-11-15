// 在真实浏览器里复现 feishu-plugin 的 client bundle：mock 掉 DSH 的 ModuleLoader 和 slots，
// 用 react UMD 渲染面板，抓控制台错误。
import fs from 'node:fs';

const app = 'E:/DHSdesktop/DSH Desktop/resources/app/node_modules';
const reactUmd = fs.readFileSync(`${app}/react/umd/react.development.js`, 'utf8');
const reactDomUmd = fs.readFileSync(`${app}/react-dom/umd/react-dom.development.js`, 'utf8');
const client = fs.readFileSync('C:/Users/19941/notes/feishu-plugin/lib/client.js', 'utf8');

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;font-family:system-ui} #root{height:100%;width:360px;border:1px solid #ccc}</style>
</head><body>
<div id="root"></div>
<pre id="log" style="position:fixed;bottom:0;left:0;right:0;max-height:40%;overflow:auto;background:#111;color:#0f0;font:11px monospace;margin:0;padding:4px;z-index:99"></pre>
<script>${reactUmd}</script>
<script>${reactDomUmd}</script>
<script>
const logEl = document.getElementById('log');
function log(msg){ logEl.textContent += msg + "\\n"; }
window.addEventListener('error', (e) => log('window.error: ' + (e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => log('unhandledrejection: ' + (e.reason && e.reason.message || e.reason)));

// mock 桥：直接返回数据，避免网络变量干扰
window.fetch = async (url) => {
  const u = String(url);
  const body = u.includes('/auth') ? { authorized: true, name: 'masuzu328', missing: [] }
    : u.includes('/drive') ? { folders: [{ token: 'f1', name: '拆书', type: 'folder' }], files: [{ token: 'd1', name: '测试文档', type: 'docx', modified: Date.now()/1000 }] }
    : u.includes('/chats') ? { chats: [{ chatId: 'c1', name: '测试群' }] }
    : u.includes('/docblocks') ? { blocks: [{ id: 'b1', type: 'h1', text: '标题' }, { id: 'b2', type: 'p', text: '正文' }] }
    : { messages: [], files: [] };
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
};

let exported = null;
window.__ModuleLoader__ = { load({ id, factory }) { exported = factory((name) => { if (name === 'react') return window.React; throw new Error('unexpected require ' + name); }); exported.__id = id; } };

/* CLIENT_BUNDLE */
</script>
<script>
try {
  log('module: ' + exported.__id);
  const PANE = { name: 'x', inject: [] };
  const reg = { tab: null, slot: null };
  const ctx = {
    effect: (fn) => { try { return fn(); } catch (e) { log('effect throw: ' + e.message); } },
    sidebarRightTabs: { register: (d) => { reg.tab = d; return () => {}; } },
    slots: { inject: (n, run) => run(), register: (d, c) => { reg.slot = { d, c }; return () => {}; } },
  };
  exported.apply(ctx);
  log('tab: ' + (reg.tab && reg.tab.id) + ' | slot: ' + (reg.slot && reg.slot.d.key));
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(reg.slot.c, {}));
  setTimeout(() => { log('DOM 里 fs-root: ' + !!document.querySelector('.fs-root')); log('done'); }, 600);
} catch (e) { log('apply throw: ' + (e && e.stack || e)); }
</script></body></html>`;

const out = html.replace('/* CLIENT_BUNDLE */', client);
fs.writeFileSync('C:/Users/19941/notes/feishu-plugin/repro.html', out, 'utf8');
console.log('repro.html 写好:', out.length, 'bytes');
