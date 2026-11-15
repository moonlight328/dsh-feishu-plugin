// 网页版：用 Electron <webview> 真正内嵌（不是 iframe，飞书拦不住），失败再退回入口卡片。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let t = fs.readFileSync(file, 'utf8');

// 1) 找到现有 webBody 定义并整体替换
const startMark = '      const WEB_ENTRIES = [';
const endMark = '      const chatBody = chats.length';
const start = t.indexOf(startMark);
const end = t.indexOf(endMark);
if (start < 0 || end < 0 || end < start) {
  console.error('webBody 区块定位失败');
  process.exit(1);
}

const replacement = `      const WEB_ENTRIES = [
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
          /* 打不开就让用户复制链接 */
        }
      };

      /** webview 打不开时的退路：入口卡片。 */
      const webFallback = (reason) =>
        h(
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
              (reason ? reason + '。' : '') + '点下面的入口在浏览器里打开；也可以用 DSH 右栏的「浏览器」标签直接访问 my.feishu.cn。'
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
          h('button', { type: 'button', className: 'fs-btn fs-web-open', onClick: () => openExternal('https://my.feishu.cn/') }, '在浏览器打开飞书首页')
        );

      /** 内嵌浏览：Electron webview（独立进程，不受 X-Frame-Options / frame 检测限制）。 */
      class WebViewPane extends React.Component {
        constructor(props) {
          super(props);
          this.state = { url: 'https://my.feishu.cn/messenger/', failed: '', loading: true };
          this.ref = React.createRef();
        }
        componentDidMount() {
          const el = this.ref.current;
          if (!el || !el.addEventListener) {
            this.setState({ failed: '这个环境不支持内嵌浏览器' });
            return;
          }
          if (typeof el.getWebContentsId !== 'function') {
            this.setState({ failed: 'webview 没有初始化（宿主可能没开 webviewTag）' });
            return;
          }
          this.onFail = (event) => {
            // -3 是用户中止，不算失败
            if (event && event.errorCode === -3) return;
            this.setState({ failed: '网页加载失败（' + ((event && event.errorDescription) || 'unknown') + '）' });
          };
          this.onStop = () => this.setState({ loading: false });
          this.onNavigate = (event) => this.setState({ url: event.url || this.state.url, loading: false });
          this.onStart = () => this.setState({ loading: true });
          el.addEventListener('did-fail-load', this.onFail);
          el.addEventListener('did-stop-loading', this.onStop);
          el.addEventListener('did-navigate', this.onNavigate);
          el.addEventListener('did-start-loading', this.onStart);
        }
        componentWillUnmount() {
          const el = this.ref.current;
          if (!el || !this.onFail) return;
          el.removeEventListener('did-fail-load', this.onFail);
          el.removeEventListener('did-stop-loading', this.onStop);
          el.removeEventListener('did-navigate', this.onNavigate);
          el.removeEventListener('did-start-loading', this.onStart);
        }
        render() {
          if (this.state.failed) return webFallback(this.state.failed);
          const go = (url) => {
            this.setState({ url, loading: true });
            const el = this.ref.current;
            if (el && el.loadURL) el.loadURL(url);
            else if (el) el.setAttribute('src', url);
          };
          return h(
            'div',
            { className: 'fs-webview-wrap' },
            h(
              'div',
              { className: 'fs-webview-bar' },
              h(
                'button',
                { type: 'button', className: 'fs-icon-btn', title: '回到飞书首页', onClick: () => go('https://my.feishu.cn/messenger/') },
                '⌂'
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'fs-icon-btn',
                  title: '刷新',
                  onClick: () => {
                    const el = this.ref.current;
                    if (el && el.reload) el.reload();
                  },
                },
                '⟳'
              ),
              h('span', { className: 'fs-webview-url', title: this.state.url }, this.state.loading ? '加载中… ' + this.state.url : this.state.url),
              h(
                'button',
                { type: 'button', className: 'fs-icon-btn', title: '在浏览器打开', onClick: () => openExternal(this.state.url) },
                '↗'
              )
            ),
            h('webview', {
              ref: this.ref,
              src: this.state.url,
              allowpopups: 'true',
              style: { flex: 1, width: '100%', minHeight: 0, border: 0, display: 'flex', background: '#fff' },
            })
          );
        }
      }
      const webBody = h(WebViewPane, null);

`;

t = t.slice(0, start) + replacement + t.slice(end);

// 2) CSS：webview 容器与工具栏
const cssAnchor = '      .fs-web{flex:1;min-height:0;overflow:auto;';
if (!t.includes(cssAnchor)) {
  console.error('css anchor missing');
  process.exit(1);
}
t = t.replace(
  cssAnchor,
  `      .fs-webview-wrap{flex:1;min-height:0;display:flex;flex-direction:column;border-top:1px solid var(--fs-line-soft)}
      .fs-webview-bar{display:flex;align-items:center;gap:4px;padding:4px 8px;flex:none;background:var(--fs-brand-softer)}
      .fs-webview-url{flex:1;min-width:0;font-size:10.5px;color:var(--fs-fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
      ${cssAnchor}`,
);

fs.writeFileSync(file, t, 'utf8');
console.log('网页版改成 webview 内嵌');
