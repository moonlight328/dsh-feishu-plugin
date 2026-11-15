// 文档页改成「左侧文档栏 + 右侧编辑器」，列表支持右键重命名/删除。
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

// ① 状态：文档右键菜单
swap(
  `      const [sheetOpen, setSheetOpen] = useState(false);`,
  `      const [sheetOpen, setSheetOpen] = useState(false);
      const [docMenu, setDocMenu] = useState(null);`,
  'doc menu state'
);

// ② 重命名 / 删除动作
swap(
  `      const createDoc = useCallback(async () => {`,
  `      const renameDoc = useCallback(
        async (file) => {
          const next = window.prompt('新文件名', file.name || '');
          if (!next || !next.trim() || next.trim() === file.name) return;
          setBusy(true);
          setError('');
          try {
            await bridge('/rename', { method: 'POST', body: JSON.stringify({ token: file.token, name: next.trim(), type: file.type || 'docx' }) });
            if (!mounted.current) return;
            setNotice('已重命名');
            await loadDocs();
          } catch (failure) {
            if (mounted.current) setError(failure.message);
          } finally {
            if (mounted.current) setBusy(false);
          }
        },
        [loadDocs]
      );

      const deleteDoc = useCallback(
        async (file) => {
          const confirmed = window.confirm('确定把「' + (file.name || '这篇') + '」移到回收站？');
          if (!confirmed) return;
          setBusy(true);
          setError('');
          try {
            await bridge('/delete', { method: 'POST', body: JSON.stringify({ token: file.token, type: file.type || 'docx' }) });
            if (!mounted.current) return;
            setNotice('已删除（飞书回收站里能找回）');
            if (doc && doc.id === file.token) setDoc(null);
            await loadDocs();
          } catch (failure) {
            if (mounted.current) setError(failure.message);
          } finally {
            if (mounted.current) setBusy(false);
          }
        },
        [doc, loadDocs]
      );

      const createDoc = useCallback(async () => {`,
  'rename/delete actions'
);

// ③ docsBody：左栏 + 右栏
swap(
  `      const docsBody = doc
        ? h(BlockEditor, {
            blocks,
            onChange: setBlocks,
            onSave: saveDoc,
            onBack: () => setDoc(null),
            busy,
            notice,
            docId: doc.id,
          })
        : docs.length
          ? h(
              'div',
              { className: 'fs-doclist' },
              h(
                'div',
                { className: 'fs-search' },
                h('input', {
                  className: 'fs-search-input',
                  placeholder: '过滤文档…',
                  value: docsQuery,
                  onChange: (event) => setDocsQuery(event.target.value),
                })
              ),
              (() => {
                const needle = docsQuery.trim().toLowerCase();
                const shown = needle ? docs.filter((file) => String(file.name || '').toLowerCase().includes(needle)) : docs;
                if (!shown.length) {
                  return h('div', { className: 'fs-empty' }, h('div', { className: 'fs-empty-emoji' }, '🔍'), h('div', null, '没有匹配的文档'));
                }
                return shown.map((file) =>
                  h(
                    'div',
                    { key: file.token, className: 'fs-doc-row', onClick: () => openDoc(file.token) },
                    h('div', { className: 'fs-doc-icon', 'data-kind': file.type || 'docx' }, docTypeChar(file.type)),
                    h(
                      'div',
                      { className: 'fs-doc-info' },
                      h('div', { className: 'fs-doc-name' }, file.name || '(未命名)'),
                      h(
                        'div',
                        { className: 'fs-doc-meta' },
                        h('span', { className: 'fs-doc-tag' }, docTypeLabel(file.type)),
                        h('span', null, relativeTime(file.modified))
                      )
                    ),
                    h('span', { className: 'fs-doc-go' }, '›')
                  )
                );
              })()
            )
          : h('div', { className: 'fs-empty' }, h('div', { className: 'fs-empty-emoji' }, '📄'), h('div', null, busy ? '读取中…' : '云空间里还没有文档'), h('div', null, '在下面写点东西，Ctrl+Enter 建成飞书文档'));`,
  `      const docFiltered = (() => {
        const needle = docsQuery.trim().toLowerCase();
        return needle ? docs.filter((file) => String(file.name || '').toLowerCase().includes(needle)) : docs;
      })();

      const docsLeft = h(
        'div',
        { className: 'fs-dlist' },
        h(
          'div',
          { className: 'fs-dlist-top' },
          h('button', { type: 'button', className: 'fs-newdoc', title: '新建文档', onClick: () => setSheetOpen(true) }, h('span', { className: 'fs-newdoc-plus' }, '＋'), h('span', null, '新建')),
          h('button', { type: 'button', className: 'fs-btn', title: '刷新列表', disabled: busy, onClick: loadDocs }, '刷新')
        ),
        h(
          'div',
          { className: 'fs-search' },
          h('input', {
            className: 'fs-search-input',
            placeholder: '过滤…',
            value: docsQuery,
            onChange: (event) => setDocsQuery(event.target.value),
          })
        ),
        h(
          'div',
          { className: 'fs-dlist-body' },
          docFiltered.length
            ? docFiltered.map((file) =>
                h(
                  'div',
                  {
                    key: file.token,
                    className: 'fs-drow',
                    'data-active': Boolean(doc && doc.id === file.token),
                    title: file.name,
                    onClick: () => openDoc(file.token),
                    onContextMenu: (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDocMenu({ x: event.clientX, y: event.clientY, file });
                    },
                  },
                  h('div', { className: 'fs-dicon', 'data-kind': file.type || 'docx' }, docTypeChar(file.type)),
                  h('div', { className: 'fs-dname' }, file.name || '(未命名)')
                )
              )
            : h('div', { className: 'fs-dlist-empty' }, busy ? '读取中…' : docs.length ? '没有匹配' : '还没有文档')
        )
      );

      const docsRight = doc
        ? h(BlockEditor, {
            blocks,
            onChange: setBlocks,
            onSave: saveDoc,
            onBack: () => setDoc(null),
            busy,
            notice,
            docId: doc.id,
          })
        : h(
            'div',
            { className: 'fs-dplaceholder' },
            h('div', { className: 'fs-empty-emoji' }, '📄'),
            h('div', null, '左边选一篇文档'),
            h('div', { className: 'fs-status' }, '或者点「＋ 新建」写一篇')
          );

      const docsBody = h('div', { className: 'fs-split' }, docsLeft, docsRight);`,
  'split layout'
);

// ④ 顶部工具条不再需要（挪进左栏了）
swap(
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
`,
  ``,
  'drop toolbar'
);

// ⑤ 主体分支：文档页始终走 split
swap(
  `          : tab === 'chats' ? chatBody : doc ? docsBody : h('div', { className: 'fs-scroll' }, docsBody),`,
  `          : tab === 'chats' ? chatBody : docsBody,`,
  'render split'
);

// ⑥ 文档右键菜单本体（挂在根节点末尾，sheet 之前）
swap(
  `        sheetOpen
          ? h(`,
  `        docMenu
          ? h(
              'div',
              {
                className: 'fs-menu',
                style: { left: Math.min(docMenu.x, (window.innerWidth || 800) - 176) + 'px', top: Math.min(docMenu.y, (window.innerHeight || 800) - 150) + 'px' },
                onMouseDown: (event) => event.stopPropagation(),
                onMouseLeave: () => setDocMenu(null),
              },
              h('button', { type: 'button', className: 'fs-menu-item', onClick: () => { setDocMenu(null); openDoc(docMenu.file.token); } }, h('span', null, '打开')),
              h('button', { type: 'button', className: 'fs-menu-item', onClick: () => { const target = docMenu.file; setDocMenu(null); renameDoc(target); } }, h('span', null, '重命名')),
              h('div', { className: 'fs-menu-sep' }),
              h('button', { type: 'button', className: 'fs-menu-item', 'data-danger': 'true', onClick: () => { const target = docMenu.file; setDocMenu(null); deleteDoc(target); } }, h('span', null, '删除'))
            )
          : null,
        sheetOpen
          ? h(`,
  'doc context menu'
);

// ⑦ CSS：左右分栏 + 左栏 + 右键菜单点开收起
must('.fs-doc-toolbar{');
const css = `.fs-split{display:flex;flex:1;min-height:0}
      .fs-dlist{width:150px;flex:none;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--fs-line);background:linear-gradient(180deg,#80808008,transparent)}
      .fs-dlist-top{display:flex;align-items:center;gap:5px;padding:8px 8px 4px}
      .fs-dlist-top .fs-newdoc{flex:1;justify-content:center;padding:6px 8px;font-size:12px;border-radius:8px}
      .fs-dlist-top .fs-btn{flex:none;padding:6px 8px}
      .fs-dlist .fs-search{padding:2px 8px 6px;position:static;background:transparent;backdrop-filter:none}
      .fs-dlist .fs-search-input{padding:5px 9px;font-size:11.5px;border-radius:8px}
      .fs-dlist-body{flex:1;min-height:0;overflow:auto;padding:0 4px 10px}
      .fs-drow{display:flex;align-items:center;gap:7px;padding:5px 7px;border-radius:8px;cursor:pointer;transition:background .1s ease}
      .fs-drow:hover{background:var(--fs-bubble)}
      .fs-drow[data-active=true]{background:var(--dsw-alias-label-primary-bluish,#4678ef);color:#fff}
      .fs-drow[data-active=true] .fs-dicon{background:#ffffff2e;color:#fff}
      .fs-dicon{width:22px;height:22px;flex:none;border-radius:7px;display:grid;place-items:center;font-size:10.5px;font-weight:700;background:#eef2ff;color:#4a63c8}
      .fs-dicon[data-kind=sheet]{background:#e9f7ee;color:#2f7d4f}
      .fs-dicon[data-kind=bitable]{background:#fdf1e7;color:#a4622a}
      .fs-dicon[data-kind=mindnote]{background:#f4ecfd;color:#7a4fbf}
      .fs-dicon[data-kind=slides]{background:#fdeef4;color:#b8467b}
      .fs-dicon[data-kind=file],.fs-dicon[data-kind=folder]{background:#f1f2f4;color:#5a6270}
      .fs-dname{flex:1;min-width:0;font-size:11.5px;line-height:1.5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fs-dlist-empty{padding:14px 8px;font-size:11.5px;color:var(--dsw-alias-label-secondary,#7b857e);text-align:center}
      .fs-dplaceholder{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#7b857e);text-align:center;padding:20px}
      .fs-doc-toolbar{`;
text = text.replace('.fs-doc-toolbar{', () => css);
count += 1;
console.log('patched: split css');

fs.writeFileSync(file, text, 'utf8');
console.log('done:', count);
