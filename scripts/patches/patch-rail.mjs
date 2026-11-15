// 左栏收窄 + 可收起；编辑器头部精简（去掉 id chip，字数不换行）。
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

// ① rail 开关状态
swap(
  `      const [docMenu, setDocMenu] = useState(null);`,
  `      const [docMenu, setDocMenu] = useState(null);
      const [railOpen, setRailOpen] = useState(true);`,
  'rail state'
);

// ② BlockEditor 接收 backLabel
swap(
  `      const { blocks, onChange, onSave, onBack, busy, notice, docId } = props;`,
  `      const { blocks, onChange, onSave, onBack, busy, notice, docId, backLabel } = props;`,
  'editor backLabel prop'
);

// ③ 编辑器头部：去掉 id chip，标签可配，字数 nowrap
swap(
  `          h('button', { className: 'fs-btn', type: 'button', onClick: onBack }, '← 列表'),
          h('span', { className: 'fs-chip' }, String(docId).slice(-8)),
          h('span', { className: 'fs-chip' }, totalChars + ' 字 / ' + blocks.length + ' 段'),`,
  `          h('button', { className: 'fs-btn', type: 'button', onClick: onBack }, backLabel || '← 列表'),
          h('span', { className: 'fs-chip' }, totalChars + ' 字 · ' + blocks.length + ' 段'),`,
  'editor head'
);

// ④ 传参：切换 rail
swap(
  `        ? h(BlockEditor, {
            blocks,
            onChange: setBlocks,
            onSave: saveDoc,
            onBack: () => setDoc(null),
            busy,
            notice,
            docId: doc.id,
          })`,
  `        ? h(BlockEditor, {
            blocks,
            onChange: setBlocks,
            onSave: saveDoc,
            onBack: () => setRailOpen((open) => !open),
            busy,
            notice,
            docId: doc.id,
            backLabel: railOpen ? '«' : '»',
          })`,
  'editor wiring'
);

// ⑤ 分栏：按 railOpen 决定是否渲染左栏
swap(
  `      const docsBody = h('div', { className: 'fs-split' }, docsLeft, docsRight);`,
  `      const docsBody = h('div', { className: 'fs-split' }, railOpen ? docsLeft : null, docsRight);`,
  'conditional rail'
);

// ⑥ CSS：窄一点 + 头部不换行
swap(
  `      .fs-dlist{width:150px;flex:none;`,
  `      .fs-dlist{width:118px;flex:none;`,
  'rail width'
);
swap(
  `      .fs-doc-head{display:flex;align-items:center;gap:8px;`,
  `      .fs-doc-head .fs-chip{white-space:nowrap;flex:none}
      .fs-doc-head{display:flex;align-items:center;gap:6px;flex:none;`,
  'head nowrap'
);
swap(
  `      .fs-dname{flex:1;min-width:0;font-size:11.5px;`,
  `      .fs-dlist-top .fs-newdoc span:last-child{display:none}
      .fs-dname{flex:1;min-width:0;font-size:11px;`,
  'rail density'
);

fs.writeFileSync(file, text, 'utf8');
console.log('done:', count);
