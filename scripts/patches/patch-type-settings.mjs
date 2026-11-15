// 字体 / 字号设置：文档工具条加「Aa」，选择存 localStorage。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let t = fs.readFileSync(file, 'utf8');
let n = 0;
function swap(a, b, label) {
  if (!t.includes(a)) {
    console.error('MISS:', label);
    process.exit(1);
  }
  t = t.replace(a, () => b);
  n += 1;
  console.log('patched:', label);
}

// ① 字体表 + 常量（放在模块内、BlockEditor 之前）
swap(
  `    function BlockEditor(props) {`,
  `    const FONT_CHOICES = [
      { id: 'sans', label: '系统', stack: '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif' },
      { id: 'serif', label: '宋体', stack: 'Georgia,"Songti SC","SimSun","Noto Serif SC",serif' },
      { id: 'kai', label: '楷体', stack: '"Kaiti SC","KaiTi","STKaiti",serif' },
      { id: 'round', label: '圆体', stack: '"Yuanti SC","HYQiHei","Microsoft YaHei",system-ui,sans-serif' },
      { id: 'mono', label: '等宽', stack: 'ui-monospace,SFMono-Regular,Menlo,Consolas,"Courier New",monospace' },
    ];
    const SIZE_CHOICES = [12, 13, 14, 15, 16, 18];
    const TYPE_KEY = 'feishu-panel:type';
    const DEFAULT_TYPE = { font: 'sans', size: 13 };

    function BlockEditor(props) {`,
  'font tables'
);

// ② BlockEditor 里的状态
swap(
  `      const [outlineOpen, setOutlineOpen] = useState(false);`,
  `      const [outlineOpen, setOutlineOpen] = useState(false);
      const [typeOpen, setTypeOpen] = useState(false);
      const typeSet = props.typeSet || DEFAULT_TYPE;`,
  'type state'
);

// ③ 工具条按钮：Aa
swap(
  `          h('span', { className: 'fs-chip' }, totalChars + ' 字 · ' + blocks.length + ' 段'),`,
  `          h('span', { className: 'fs-chip' }, totalChars + ' 字 · ' + blocks.length + ' 段'),
          h(
            'button',
            {
              className: 'fs-btn fs-type-btn',
              type: 'button',
              'data-active': typeOpen,
              title: '字体与字号',
              onClick: () => setTypeOpen((open) => !open),
            },
            'Aa'
          ),`,
  'Aa button'
);

// ④ 设置面板（挂在 doc-wrap 下，absolute 定位）
swap(
  `        h(
          'div',
          { className: 'fs-doc-main', 'data-outline': outlineOpen },`,
  `        typeOpen
          ? h(
              'div',
              { className: 'fs-type-panel', onMouseDown: (event) => event.stopPropagation() },
              h('div', { className: 'fs-type-label' }, '字体'),
              h(
                'div',
                { className: 'fs-type-grid' },
                FONT_CHOICES.map((choice) =>
                  h(
                    'button',
                    {
                      key: choice.id,
                      type: 'button',
                      className: 'fs-type-opt',
                      'data-active': typeSet.font === choice.id,
                      style: { fontFamily: choice.stack },
                      onClick: () => props.onTypeChange && props.onTypeChange({ ...typeSet, font: choice.id }),
                    },
                    choice.label
                  )
                )
              ),
              h('div', { className: 'fs-type-label' }, '字号'),
              h(
                'div',
                { className: 'fs-type-grid' },
                SIZE_CHOICES.map((size) =>
                  h(
                    'button',
                    {
                      key: size,
                      type: 'button',
                      className: 'fs-type-opt',
                      'data-active': Number(typeSet.size) === size,
                      onClick: () => props.onTypeChange && props.onTypeChange({ ...typeSet, size }),
                    },
                    size + 'px'
                  )
                )
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'fs-type-reset',
                  onClick: () => props.onTypeChange && props.onTypeChange({ ...DEFAULT_TYPE }),
                },
                '恢复默认'
              )
            )
          : null,
        h(
          'div',
          { className: 'fs-doc-main', 'data-outline': outlineOpen },`,
  'type panel'
);

// ⑤ FeishuPane：状态 + 持久化 + 传给 BlockEditor + 根节点变量
swap(
  `      const [identity, setIdentity] = useState('user');`,
  `      const [identity, setIdentity] = useState('user');
      const [typeSet, setTypeSet] = useState(() => {
        try {
          const raw = window.localStorage.getItem(TYPE_KEY);
          const parsed = raw ? JSON.parse(raw) : null;
          return parsed && parsed.font ? parsed : DEFAULT_TYPE;
        } catch {
          return DEFAULT_TYPE;
        }
      });
      const applyType = useCallback((next) => {
        setTypeSet(next);
        try {
          window.localStorage.setItem(TYPE_KEY, JSON.stringify(next));
        } catch {
          /* 存不了就算了，本次会话仍然生效 */
        }
      }, []);`,
  'type state in pane'
);

swap(
  `        { className: 'fs-root' },`,
  `        {
          className: 'fs-root',
          style: {
            '--fs-font': (FONT_CHOICES.find((choice) => choice.id === typeSet.font) || FONT_CHOICES[0]).stack,
            '--fs-doc-size': (Number(typeSet.size) || 13) + 'px',
          },
        },`,
  'root style vars'
);

swap(
  `            onOutlineToggle: (open) => setRailOpen(!open),`,
  `            onOutlineToggle: (open) => setRailOpen(!open),
            typeSet,
            onTypeChange: applyType,`,
  'pass type props'
);

// ⑥ CSS：变量化字体与字号 + 面板样式
swap(
  `.fs-root{display:flex;flex-direction:column;height:100%;min-height:320px;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--fs-fg);position:relative;overflow:hidden;-webkit-font-smoothing:antialiased}`,
  `.fs-root{display:flex;flex-direction:column;height:100%;min-height:320px;font:13px/1.6 var(--fs-font,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif);color:var(--fs-fg);position:relative;overflow:hidden;-webkit-font-smoothing:antialiased}`,
  'root font var'
);
swap(
  `.fs-block-text{font-size:13px;line-height:1.75;`,
  `.fs-block-text{font-size:var(--fs-doc-size,13px);line-height:1.75;`,
  'body size var'
);
swap(
  `.fs-block[data-type=h1] .fs-block-text{font-size:21px;`,
  `.fs-block[data-type=h1] .fs-block-text{font-size:calc(var(--fs-doc-size,13px) * 1.62);`,
  'h1 scale'
);
swap(
  `.fs-block[data-type=h2] .fs-block-text{font-size:16.5px;`,
  `.fs-block[data-type=h2] .fs-block-text{font-size:calc(var(--fs-doc-size,13px) * 1.27);`,
  'h2 scale'
);
swap(
  `.fs-block[data-type=h3] .fs-block-text{font-size:14px;`,
  `.fs-block[data-type=h3] .fs-block-text{font-size:calc(var(--fs-doc-size,13px) * 1.08);`,
  'h3 scale'
);
swap(
  `.fs-block[data-type=code] .fs-block-text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;`,
  `.fs-block[data-type=code] .fs-block-text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:calc(var(--fs-doc-size,13px) - 1px);`,
  'code scale'
);
swap(
  `      .fs-doc-wrap{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;overflow:hidden}`,
  `      .fs-doc-wrap{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;overflow:hidden;position:relative}
      .fs-type-panel{position:absolute;right:8px;top:42px;z-index:40;width:200px;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--fs-line);border-radius:12px;box-shadow:var(--fs-shadow);padding:10px;display:flex;flex-direction:column;gap:7px;animation:fs-pop .12s ease-out}
      .fs-type-label{font-size:9.5px;font-weight:650;color:var(--fs-fg2);letter-spacing:.07em;text-transform:uppercase}
      .fs-type-grid{display:flex;flex-wrap:wrap;gap:4px}
      .fs-type-opt{border:1px solid var(--fs-line);background:transparent;color:var(--fs-fg);border-radius:7px;font-size:11px;padding:4px 7px;min-width:40px}
      .fs-type-opt:hover{background:var(--fs-hover)}
      .fs-type-opt[data-active=true]{background:var(--fs-brand-soft);border-color:transparent;color:var(--fs-brand);font-weight:600}
      .fs-type-reset{border:0;background:transparent;color:var(--fs-fg2);font-size:10.5px;padding:3px 0 0;text-align:right}
      .fs-type-reset:hover{color:var(--fs-brand)}
      .fs-type-btn{font-weight:650;min-width:28px;justify-content:center}`,
  'type panel css'
);

fs.writeFileSync(file, t, 'utf8');
console.log('done:', n);
