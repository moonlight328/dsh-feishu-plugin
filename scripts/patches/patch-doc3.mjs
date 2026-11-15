// 文档层三项：返回上级、图片显示、大纲跳转 + 标题折叠。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let text = fs.readFileSync(file, 'utf8');
let count = 0;
function must(a) {
  if (!text.includes(a)) {
    console.error('ANCHOR MISS:\n' + a.slice(0, 200));
    process.exit(1);
  }
}
function swap(from, to, label) {
  must(from);
  text = text.replace(from, () => to);
  count += 1;
  console.log('patched:', label);
}

// ① openDoc：图片块带 token
swap(
  `          const list = (data.blocks || []).map((block, index) => ({
            key: \`\${block.id || 'new'}-\${index}\`,
            type: block.type || 'p',
            text: block.text || '',
          }));`,
  `          const list = (data.blocks || []).map((block, index) => ({
            key: \`\${block.id || 'new'}-\${index}\`,
            type: block.type || 'p',
            text: block.text || '',
            token: block.token || '',
          }));`,
  'openDoc image token'
);

// ② saveDoc：改成提交块数组（否则图片会被 markdown 抹掉）
swap(
  `        const markdown = blocksToMarkdown(blocks);
        if (!markdown.trim()) {
          setError('正文是空的，先写点东西再保存');
          return;
        }`,
  `        const payloadBlocks = blocks.map((block) => ({ type: block.type, text: block.text || '', token: block.token || '' }));
        const hasContent = payloadBlocks.some((block) => (block.type === 'image' && block.token) || String(block.text || '').trim());
        if (!hasContent) {
          setError('正文是空的，先写点东西再保存');
          return;
        }`,
  'saveDoc guard'
);
swap(
  `          const data = await bridge('/save', { method: 'POST', body: JSON.stringify({ id: doc.id, markdown }) });`,
  `          const data = await bridge('/save', { method: 'POST', body: JSON.stringify({ id: doc.id, blocks: payloadBlocks }) });`,
  'saveDoc blocks'
);
swap(
  `            (refreshed.blocks || []).map((block, index) => ({
              key: \`\${block.id || 'new'}-\${index}\`,
              type: block.type || 'p',
              text: block.text || '',
            }))`,
  `            (refreshed.blocks || []).map((block, index) => ({
              key: \`\${block.id || 'new'}-\${index}\`,
              type: block.type || 'p',
              text: block.text || '',
              token: block.token || '',
            }))`,
  'saveDoc refresh tokens'
);

// ③ 返回上级：列表顶部一行
swap(
  `      const folderRows = folders.map((folder) =>`,
  `      const upRow =
        folderPath.length > 1
          ? h(
              'div',
              {
                className: 'fs-drow',
                'data-kind': 'up',
                title: '返回上一级',
                onClick: () => setFolderPath(folderPath.slice(0, -1)),
              },
              h('div', { className: 'fs-dicon', 'data-kind': 'up' }, '↑'),
              h('div', { className: 'fs-dname' }, '上一级')
            )
          : null;

      const folderRows = folders.map((folder) =>`,
  'up row'
);
swap(
  `          folderRows.length || fileRows.length
            ? [].concat(folderRows, fileRows)`,
  `          folderRows.length || fileRows.length || upRow
            ? [].concat(upRow ? [upRow] : [], folderRows, fileRows)`,
  'up row in list'
);

// ④ BlockEditor：折叠状态 + 大纲 + 图片
swap(
  `      const refs = useRef(new Map());
      const focusKey = useRef(null);
      const [menu, setMenu] = useState(null);`,
  `      const refs = useRef(new Map());
      const focusKey = useRef(null);
      const [menu, setMenu] = useState(null);
      const [collapsed, setCollapsed] = useState(() => new Set());
      const [outlineOpen, setOutlineOpen] = useState(false);

      const levelOf = (type) => (type === 'h1' ? 1 : type === 'h2' ? 2 : type === 'h3' ? 3 : 0);
      const hidden = (() => {
        const set = new Set();
        let collapsedLevel = 0;
        for (const block of blocks) {
          const level = levelOf(block.type);
          if (collapsedLevel && level > 0 && level <= collapsedLevel) collapsedLevel = 0;
          if (collapsedLevel && level === 0) {
            set.add(block.key);
            continue;
          }
          if (level > 0 && collapsed.has(block.key)) collapsedLevel = level;
        }
        return set;
      })();
      const outline = blocks
        .map((block, index) => ({ block, index }))
        .filter(({ block }) => levelOf(block.type) > 0);
      const toggleCollapse = (key) => {
        const next = new Set(collapsed);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setCollapsed(next);
      };
      const jumpTo = (key) => {
        const node = refs.current.get(key);
        if (node && node.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setOutlineOpen(false);
      };`,
  'editor state'
);

// ⑤ 头部：大纲按钮
swap(
  `          h('span', { className: 'fs-chip' }, totalChars + ' 字 · ' + blocks.length + ' 段'),`,
  `          h('span', { className: 'fs-chip' }, totalChars + ' 字 · ' + blocks.length + ' 段'),
          h(
            'button',
            {
              className: 'fs-btn',
              type: 'button',
              'data-active': outlineOpen,
              onClick: () => setOutlineOpen((open) => !open),
            },
            '大纲'
          ),`,
  'outline button'
);

// ⑥ 块渲染：跳过被折叠的、图片块、标题折叠箭头
swap(
  `          blocks.map((block, index) =>
            h(
              'div',
              {
                key: block.key,
                className: 'fs-block',
                'data-type': block.type,`,
  `          blocks
            .filter((block) => !hidden.has(block.key))
            .map((block) =>
            h(
              'div',
              {
                key: block.key,
                className: 'fs-block',
                'data-type': block.type,`,
  'filter hidden'
);
swap(
  `              h('span', { className: 'fs-gutter' }, BLOCK_LABEL[block.type] || '¶'),
              h('div', {
                className: 'fs-block-text',`,
  `              h('span', { className: 'fs-gutter' }, BLOCK_LABEL[block.type] || '¶'),
              levelOf(block.type) > 0
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'fs-collapse',
                      title: collapsed.has(block.key) ? '展开' : '收起',
                      onClick: (event) => {
                        event.stopPropagation();
                        toggleCollapse(block.key);
                      },
                    },
                    collapsed.has(block.key) ? '▸' : '▾'
                  )
                : null,
              block.type === 'image'
                ? h('img', {
                    className: 'fs-doc-img',
                    alt: '图片',
                    src: bridgeOrigin + '/feishu-panel/mediaDoc?token=' + encodeURIComponent(block.token || ''),
                    onError: (event) => {
                      event.currentTarget.style.display = 'none';
                    },
                  })
                : h('div', {
                className: 'fs-block-text',`,
  'image + caret'
);
// 关闭上面那个三元的括号
swap(
  `                onKeyDown: (event) => handleKeyDown(event, index),
              })
            )
          ),`,
  `                onKeyDown: (event) => handleKeyDown(event, index),
              })
            )
            )
          ),`,
  'close ternary'
);

// ⑦ 大纲面板
swap(
  `          h(
            'div',
            { className: 'fs-doc-tail' },`,
  `          outlineOpen
            ? h(
                'div',
                { className: 'fs-outline' },
                outline.length
                  ? outline.map(({ block, index }) =>
                      h(
                        'button',
                        {
                          key: block.key,
                          type: 'button',
                          className: 'fs-outline-item',
                          'data-level': levelOf(block.type),
                          onClick: () => jumpTo(block.key),
                        },
                        String(block.text || '（空标题）').slice(0, 40)
                      )
                    )
                  : h('div', { className: 'fs-outline-empty' }, '没有标题')
              )
            : null,
          h(
            'div',
            { className: 'fs-doc-tail' },`,
  'outline panel'
);

// ⑧ CSS
swap(
  `      .fs-doc-body{flex:1;min-height:0;overflow:auto;padding:16px 4px 70px}`,
  `      .fs-collapse{position:absolute;left:0;top:6px;width:18px;height:18px;border:0;background:transparent;color:var(--dsw-alias-label-secondary,#7b857e);font-size:10px;cursor:pointer;border-radius:5px;opacity:0;transition:opacity .12s ease}
      .fs-block:hover .fs-collapse{opacity:.9}
      .fs-collapse:hover{background:var(--fs-bubble)}
      .fs-doc-img{display:block;max-width:100%;border-radius:10px;margin:4px 0;border:1px solid var(--fs-line)}
      .fs-outline{position:absolute;right:10px;top:46px;z-index:20;width:190px;max-height:60%;overflow:auto;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--fs-line);border-radius:11px;box-shadow:0 12px 30px #0b1a2a24;padding:6px}
      .fs-outline-item{display:block;width:100%;text-align:left;border:0;background:transparent;color:inherit;font:inherit;font-size:12px;padding:5px 8px;border-radius:7px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fs-outline-item:hover{background:var(--fs-bubble)}
      .fs-outline-item[data-level="2"]{padding-left:20px;font-size:11.5px;opacity:.85}
      .fs-outline-item[data-level="3"]{padding-left:32px;font-size:11px;opacity:.7}
      .fs-outline-empty{padding:10px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#7b857e)}
      .fs-doc-body{flex:1;min-height:0;overflow:auto;padding:16px 4px 70px}`,
  'editor css'
);
swap(
  `      .fs-drow[data-kind=folder] .fs-dname{font-weight:600}`,
  `      .fs-drow[data-kind=folder] .fs-dname{font-weight:600}
      .fs-drow[data-kind=up] .fs-dname{font-weight:600;opacity:.8}
      .fs-dicon[data-kind=up]{background:var(--fs-bubble);color:var(--dsw-alias-label-secondary,#7b857e)}`,
  'up row css'
);

fs.writeFileSync(file, text, 'utf8');
console.log('done:', count);
