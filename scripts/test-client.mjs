// 浏览器半自检：按模块加载器的形状跑 client.js，mock ctx 走 apply()，
// 再用 react-dom/server 渲一次首屏。
import { createRequire } from 'node:module';
import fs from 'node:fs';

const reqFromReact19 = createRequire(
  'C:/Users/19941/AppData/Local/npm-cache/_npx/1e7f6d9597241db0/node_modules/@deepseek-ai/dsh-client-ui-trajectory/node_modules/'
);
const React = reqFromReact19('react');
const ReactDOMServer = reqFromReact19('react-dom/server');

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
