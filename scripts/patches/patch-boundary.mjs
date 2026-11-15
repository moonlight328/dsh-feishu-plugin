// 给面板加错误边界 + 高度兜底，把白屏变成可见报错。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let text = fs.readFileSync(file, 'utf8');
let n = 0;
function swap(a, b, label) {
  if (!text.includes(a)) {
    console.error('ANCHOR MISS:', label, '\n' + a.slice(0, 160));
    process.exit(1);
  }
  text = text.replace(a, () => b);
  n += 1;
  console.log('patched:', label);
}

// ① 错误边界类（放在 FeishuPane 之前）
swap(
  `    function FeishuPane() {`,
  `    /** 面板渲染出错时别白屏，把错误打到界面上，方便定位。 */
    class PaneBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { err: null };
      }
      static getDerivedStateFromError(err) {
        return { err };
      }
      componentDidCatch(err) {
        try {
          console.error('[feishu-panel]', err);
        } catch {
          /* ignore */
        }
      }
      render() {
        if (this.state.err) {
          return React.createElement(
            'div',
            { className: 'fs-root', style: { padding: '14px', fontSize: '12px', lineHeight: 1.6, color: '#c0392b', whiteSpace: 'pre-wrap', overflow: 'auto' } },
            '飞书面板渲染出错：\\n\\n' + String((this.state.err && this.state.err.stack) || this.state.err)
          );
        }
        return this.props.children;
      }
    }

    function FeishuPane() {`,
  'error boundary'
);

// ② 注册时用边界包一层
swap(
  `          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'feishu-plugin/panel', inject: () => ({}) }, FeishuPane)
          ),`,
  `          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab', key: 'feishu-plugin/panel', inject: () => ({}) },
              (props) => h(PaneBoundary, null, h(FeishuPane, props))
            )
          ),`,
  'wrap with boundary'
);

// ③ 高度兜底：父容器没高度时也能看见
swap(
  `.fs-root{display:flex;flex-direction:column;height:100%;min-height:0;`,
  `.fs-root{display:flex;flex-direction:column;height:100%;min-height:320px;`,
  'min height fallback'
);

fs.writeFileSync(file, text, 'utf8');
console.log('done:', n);
