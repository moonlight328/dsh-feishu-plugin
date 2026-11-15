// 重命名/删除改成面板内弹层（Electron 禁用了 window.prompt / confirm）。
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

// ① 提问弹层状态
swap(
  `      const [railOpen, setRailOpen] = useState(true);`,
  `      const [railOpen, setRailOpen] = useState(true);
      const [ask, setAsk] = useState(null);`,
  'ask state'
);

// ② renameDoc：直接改名，不再 prompt
swap(
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
      );`,
  `      const renameDoc = useCallback(
        async (target, nextName) => {
          const name = String(nextName || '').trim();
          if (!name || name === target.name) return;
          setBusy(true);
          setError('');
          try {
            await bridge('/rename', { method: 'POST', body: JSON.stringify({ token: target.token, name, type: target.type || 'docx' }) });
            if (!mounted.current) return;
            setNotice('已重命名为「' + name + '」');
            await loadDocs();
          } catch (failure) {
            if (mounted.current) setError(failure.message);
          } finally {
            if (mounted.current) setBusy(false);
          }
        },
        [loadDocs]
      );`,
  'rename without prompt'
);

// ③ deleteDoc：不再 confirm
swap(
  `      const deleteDoc = useCallback(
        async (file) => {
          const confirmed = window.confirm('确定把「' + (file.name || '这篇') + '」移到回收站？');
          if (!confirmed) return;
          setBusy(true);`,
  `      const deleteDoc = useCallback(
        async (file) => {
          setBusy(true);`,
  'delete without confirm'
);

// ④ 菜单项接到弹层
swap(
  `              h('button', { type: 'button', className: 'fs-menu-item', onClick: () => { const target = docMenu.file; setDocMenu(null); renameDoc(target); } }, h('span', null, '重命名')),`,
  `              h('button', { type: 'button', className: 'fs-menu-item', onClick: () => { const target = docMenu.file; setDocMenu(null); setAsk({ kind: 'rename', file: target, value: target.name || '' }); } }, h('span', null, '重命名')),`,
  'menu rename'
);
swap(
  `              h('button', { type: 'button', className: 'fs-menu-item', 'data-danger': 'true', onClick: () => { const target = docMenu.file; setDocMenu(null); deleteDoc(target); } }, h('span', null, '删除'))`,
  `              h('button', { type: 'button', className: 'fs-menu-item', 'data-danger': 'true', onClick: () => { const target = docMenu.file; setDocMenu(null); setAsk({ kind: 'delete', file: target }); } }, h('span', null, '删除'))`,
  'menu delete'
);

// ⑤ 弹层本体
swap(
  `        docMenu
          ? h(`,
  `        ask
          ? h(
              'div',
              { className: 'fs-sheet', onClick: () => setAsk(null) },
              h(
                'div',
                { className: 'fs-sheet-card', onClick: (event) => event.stopPropagation() },
                h(
                  'div',
                  { className: 'fs-sheet-head' },
                  h('span', { className: 'fs-sheet-title' }, ask.kind === 'rename' ? '重命名' : '删除文档'),
                  h('button', { className: 'fs-btn', type: 'button', onClick: () => setAsk(null) }, '取消')
                ),
                ask.kind === 'rename'
                  ? h('input', {
                      className: 'fs-sheet-input',
                      value: ask.value,
                      autoFocus: true,
                      onChange: (event) => setAsk({ ...ask, value: event.target.value }),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') {
                          const target = ask.file;
                          const next = ask.value;
                          setAsk(null);
                          renameDoc(target, next);
                        }
                      },
                    })
                  : h('div', { className: 'fs-sheet-note' }, '「' + (ask.file.name || '这篇') + '」会移到飞书回收站，还能找回。'),
                h(
                  'div',
                  { className: 'fs-sheet-actions' },
                  h('span', { className: 'fs-status' }, ''),
                  ask.kind === 'rename'
                    ? h(
                        'button',
                        {
                          className: 'fs-btn fs-save',
                          type: 'button',
                          'data-primary': 'true',
                          disabled: busy || !String(ask.value || '').trim(),
                          onClick: () => {
                            const target = ask.file;
                            const next = ask.value;
                            setAsk(null);
                            renameDoc(target, next);
                          },
                        },
                        '确定'
                      )
                    : h(
                        'button',
                        {
                          className: 'fs-btn fs-save',
                          type: 'button',
                          'data-danger': 'true',
                          style: { background: '#c1533f', borderColor: 'transparent', color: '#fff' },
                          disabled: busy,
                          onClick: () => {
                            const target = ask.file;
                            setAsk(null);
                            deleteDoc(target);
                          },
                        },
                        '删除'
                      )
                )
              )
            )
          : null,
        docMenu
          ? h(`,
  'ask sheet'
);

// ⑥ CSS：说明文字
swap(
  `      .fs-sheet-actions{`,
  `      .fs-sheet-note{font-size:12px;line-height:1.7;color:var(--dsw-alias-label-secondary,#7b857e)}
      .fs-sheet-actions{`,
  'sheet note css'
);

fs.writeFileSync(file, text, 'utf8');
console.log('done:', count);
