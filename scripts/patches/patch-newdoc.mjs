// 「新建文档」独立成一枚按钮 + 底部弹层，不再借用底部输入框。
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

// ① 状态：弹层开关
swap(
  `      const [docsQuery, setDocsQuery] = useState('');`,
  `      const [docsQuery, setDocsQuery] = useState('');
      const [sheetOpen, setSheetOpen] = useState(false);`,
  'sheet state'
);

// ② 建完之后关弹层
swap(
  `          setNotice(\`已建成文档：\${data.title}\`);
          setDraft('');
          setDocTitle('');
          setDocs([]);
          setTab('docs');`,
  `          setNotice(\`已建成文档：\${data.title}\`);
          setDraft('');
          setDocTitle('');
          setDocs([]);
          setSheetOpen(false);
          setTab('docs');
          loadDocs();`,
  'create closes sheet'
);

// ③ 文档页顶部工具条（新建 / 刷新）
swap(
  `        error ? h('div', { className: 'fs-hint fs-err' }, error) : null,`,
  `        tab === 'docs' && !doc
          ? h(
              'div',
              { className: 'fs-doc-toolbar' },
              h(
                'button',
                { type: 'button', className: 'fs-newdoc', onClick: () => setSheetOpen(true) },
                h('span', { className: 'fs-newdoc-plus' }, '＋'),
                h('span', null, '新建文档')
              ),
              h('button', { type: 'button', className: 'fs-btn', disabled: busy, onClick: loadDocs }, '刷新')
            )
          : null,
        error ? h('div', { className: 'fs-hint fs-err' }, error) : null,`,
  'docs toolbar'
);

// ④ 底部输入区只在会话页出现
swap(
  `        tab === 'web' ? null : h(`,
  `        tab === 'web' || tab === 'docs' ? null : h(`,
  'composer only in chats'
);

// ⑤ 弹层本体（挂在根节点末尾）
swap(
  `        tab === 'web'
          ? h('iframe', {`,
  `        sheetOpen
          ? h(
              'div',
              { className: 'fs-sheet', onClick: () => setSheetOpen(false) },
              h(
                'div',
                { className: 'fs-sheet-card', onClick: (event) => event.stopPropagation() },
                h(
                  'div',
                  { className: 'fs-sheet-head' },
                  h('span', { className: 'fs-sheet-title' }, '新建飞书文档'),
                  h('button', { className: 'fs-btn', type: 'button', onClick: () => setSheetOpen(false) }, '取消')
                ),
                h('input', {
                  className: 'fs-sheet-input',
                  placeholder: '标题（留空取正文第一行）',
                  value: docTitle,
                  onChange: (event) => setDocTitle(event.target.value),
                }),
                h('textarea', {
                  className: 'fs-sheet-body',
                  placeholder: '正文，支持 Markdown：# 标题、- 列表、\\u0060\\u0060\\u0060 代码块',
                  value: draft,
                  onChange: (event) => setDraft(event.target.value),
                }),
                h(
                  'div',
                  { className: 'fs-sheet-actions' },
                  h('span', { className: 'fs-status' }, notice || '会建成一篇真飞书文档'),
                  h(
                    'button',
                    { className: 'fs-btn fs-save', type: 'button', 'data-primary': 'true', disabled: busy || !draft.trim(), onClick: createDoc },
                    busy ? '创建中…' : '创建'
                  )
                )
              )
            )
          : null,
        tab === 'web'
          ? h('iframe', {`,
  'sheet body'
);

// ⑥ CSS
must('.fs-doclist{');
const css = `.fs-doc-toolbar{display:flex;align-items:center;gap:8px;padding:8px 12px 4px;flex:none}
      .fs-newdoc{display:inline-flex;align-items:center;gap:7px;padding:7px 15px 7px 12px;border-radius:9px;border:1px solid var(--fs-line);background:var(--dsw-alias-bg-base,#fff);color:inherit;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;box-shadow:0 1px 2px #0b1a2a12,inset 0 1px 0 #ffffffcc;transition:background .12s ease,box-shadow .12s ease,transform .06s ease}
      .fs-newdoc:hover{background:var(--fs-bubble);box-shadow:0 2px 8px #0b1a2a1a}
      .fs-newdoc:active{transform:translateY(1px);box-shadow:0 1px 1px #0b1a2a14}
      .fs-newdoc-plus{font-size:14px;line-height:1;color:var(--dsw-alias-label-primary-bluish,#4678ef)}
      .fs-sheet{position:absolute;inset:0;z-index:60;display:flex;align-items:flex-end;justify-content:center;background:#0b1a2a33;backdrop-filter:blur(2px);animation:fs-fade .12s ease}
      @keyframes fs-fade{from{opacity:0}to{opacity:1}}
      .fs-sheet-card{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-base,#fff);border-radius:16px 16px 0 0;padding:14px 14px 16px;display:flex;flex-direction:column;gap:9px;box-shadow:0 -10px 34px #0b1a2a26;animation:fs-rise .16s ease}
      @keyframes fs-rise{from{transform:translateY(12px)}to{transform:translateY(0)}}
      .fs-sheet-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .fs-sheet-title{font-size:13.5px;font-weight:650}
      .fs-sheet-input,.fs-sheet-body{width:100%;box-sizing:border-box;border:1px solid var(--fs-line);border-radius:10px;background:var(--dsw-alias-bg-base,#fff);color:inherit;font:inherit;font-size:12.5px;padding:9px 11px}
      .fs-sheet-input:focus,.fs-sheet-body:focus{outline:2px solid var(--dsw-alias-label-primary-bluish,#4678ef);outline-offset:-1px}
      .fs-sheet-body{min-height:132px;resize:vertical;line-height:1.7}
      .fs-sheet-actions{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .fs-doclist{`;
text = text.replace('.fs-doclist{', () => css);
count += 1;
console.log('patched: sheet css');

fs.writeFileSync(file, text, 'utf8');
console.log('done:', count);
