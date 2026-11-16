// 浏览器半自检：按模块加载器的形状跑 client.js，mock ctx 走 apply()，
// 再用 react-dom/server 渲一次首屏。
import { createRequire } from 'node:module';
import fs from 'node:fs';

// react 由宿主提供，DSH 升级/换版后安装位置会变，所以按候选路径挨个试，
// 不要在脚本里钉死某一份 npm 缓存目录。
const REACT_ROOTS = [
  'C:/Users/19941/.dsh/profiles/node_modules/',
  'C:/Users/19941/.dsh/plugins/eac-design-world/node_modules/',
  'C:/Users/19941/AppData/Roaming/dsh-desktop/harness/profiles/node_modules/',
  './node_modules/',
];
let React = null;
let ReactDOMServer = null;
const tried = [];
for (const root of REACT_ROOTS) {
  try {
    const req = createRequire(root + '__resolve__.js');
    React = req('react');
    ReactDOMServer = req('react-dom/server');
    tried.push(root + ' ✓');
    break;
  } catch (error) {
    tried.push(root + ' ×');
  }
}
if (!React || !ReactDOMServer) {
  console.error('找不到 react / react-dom，试过：\n  ' + tried.join('\n  '));
  process.exit(1);
}

globalThis.fetch = async (url) => {
  const body = String(url).includes('/status')
    ? { ok: true, bot: { name: 'DSH插件' }, error: '' }
    : { chats: [{ chatId: 'oc_test', name: '测试群' }], messages: [], files: [] };
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
};

let exported = null;
globalThis.window = {
  __ModuleLoader__: {
    load({ id, factory }) {
      exported = factory((name) => {
        if (name === 'react') return React;
        throw new Error(`unexpected require: ${name}`);
      });
      exported.__id = id;
    },
  },
};
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ set textContent(v) { this._t = v; }, get textContent() { return this._t; } }),
  head: { appendChild() {} },
};

const source = fs.readFileSync('C:/Users/19941/notes/feishu-plugin/lib/client.js', 'utf8');
new Function('window', 'document', source)(globalThis.window, globalThis.document);
console.log('module id  ', exported.__id, '| name', exported.name);

const reg = { tabs: [], slots: [] };
const ctx = {
  effect: (fn) => fn(),
  sidebarRightTabs: { register: (d) => (reg.tabs.push(d), () => {}) },
  slots: { inject: (_n, run) => run(), register: (d, c) => (reg.slots.push({ d, c }), () => {}) },
};
exported.apply(ctx);
console.log('tabs       ', reg.tabs.map((t) => `${t.id}/${t.kind}/${t.title()}`).join(', '));
console.log('slots      ', reg.slots.map((s) => `${s.d.name}:${s.d.key}`).join(', '));

const Pane = reg.slots[0].c;
const html = ReactDOMServer.renderToStaticMarkup(React.createElement(Pane, {}));
console.log('render len ', html.length);
console.log('has tabs   ', html.includes('会话') && html.includes('文档'));
console.log('snippet    ', html.slice(0, 180));
