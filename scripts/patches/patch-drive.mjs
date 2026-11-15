// 文档栏做成「我的空间」文件夹浏览器：面包屑 + 文件夹/文档 + 右键新建。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let text = fs.readFileSync(file, 'utf8');
let count = 0;
function must(a) {
  if (!text.includes(a)) {
    console.error('ANCHOR MISS:\n' + a.slice(0, 220));
    process.exit(1);
  }
}
function swap(from, to, label) {
  must(from);
  text = text.replace(from, () => to);
  count += 1;
  console.log('patched:', label);
}

// ① 状态
swap(
  `      const [docs, setDocs] = useState([]);`,
  `      const [docs, setDocs] = useState([]);
      const [folders, setFolders] = useState([]);
      const [folderPath, setFolderPath] = useState([{ token: '', name: '我的空间' }]);
      const [authInfo, setAuthInfo] = useState({ authorized: false, name: '' });
      const [listMenu, setListMenu] = useState(null);
      const currentFolder = folderPath[folderPath.length - 1];`,
  'drive states'
);

// ② loadDocs → loadDrive（带文件夹）+ 授权状态
swap(
  `      const loadDocs = useCallback(async () => {
        setBusy(true);
        setError('');
        try {
          const data = await bridge('/docs');
          if (mounted.current) setDocs(data.files || []);
        } catch (failure) {
          if (mounted.current) setError(failure.message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, []);`,
  `      const loadDrive = useCallback(async (token) => {
        setBusy(true);
        setError('');
        try {
          const data = await bridge(\`/drive?folderToken=\${encodeURIComponent(token || '')}\`);
          if (!mounted.current) return;
          setFolders(data.folders || []);
          setDocs(data.files || []);
        } catch (failure) {
          if (mounted.current) setError(failure.message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, []);

      const loadDocs = useCallback(() => loadDrive(currentFolder.token), [loadDrive, currentFolder.token]);

      const loadAuth = useCallback(async () => {
        try {
          const info = await bridge('/auth');
          if (mounted.current) setAuthInfo(info || { authorized: false });
        } catch {
          /* 桥没起来时忽略 */
        }
      }, []);

      const mkdir = useCallback(
        async (name) => {
          const value = String(name || '').trim();
          if (!value) return;
          setBusy(true);
          setError('');
          try {
            await bridge('/mkdir', { method: 'POST', body: JSON.stringify({ name: value, parentToken: currentFolder.token }) });
            if (!mounted.current) return;
            setNotice('已新建文件夹「' + value + '」');
            await loadDrive(currentFolder.token);
          } catch (failure) {
            if (mounted.current) setError(failure.message);
          } finally {
            if (mounted.current) setBusy(false);
          }
        },
        [currentFolder.token, loadDrive]
      );`,
  'loadDrive/mkdir'
);

// ③ 文档页进入时加载 + 授权状态
swap(
  `      useEffect(() => { if (tab === 'docs' && !docs.length) loadDocs(); }, [tab, docs.length, loadDocs]);`,
  `      useEffect(() => {
        if (tab !== 'docs') return;
        loadAuth();
        loadDrive(currentFolder.token);
      }, [tab, currentFolder.token, loadDrive, loadAuth]);`,
  'docs effects'
);

// ④ 建文档时落到当前文件夹
swap(
  `          const data = await bridge('/doc', { method: 'POST', body: JSON.stringify({ title: docTitle.trim(), markdown }) });`,
  `          const data = await bridge('/doc', {
            method: 'POST',
            body: JSON.stringify({ title: docTitle.trim(), markdown, folderToken: currentFolder.token }),
          });`,
  'create into folder'
);
swap(
  `          setDocs([]);
          setSheetOpen(false);
          setTab('docs');
          loadDocs();`,
  `          setSheetOpen(false);
          setTab('docs');
          await loadDrive(currentFolder.token);`,
  'refresh after create'
);

// ⑤ 文档栏重写
const oldLeft = `      const docsLeft = h(
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
      );`;

const newLeft = `      const folderRows = folders.map((folder) =>
        h(
          'div',
          {
            key: folder.token,
            className: 'fs-drow',
            'data-kind': 'folder',
            title: folder.name,
            onClick: () => setFolderPath([...folderPath, { token: folder.token, name: folder.name }]),
            onContextMenu: (event) => {
              event.preventDefault();
              event.stopPropagation();
              setListMenu({ x: event.clientX, y: event.clientY, kind: 'folder', entry: folder });
            },
          },
          h('div', { className: 'fs-dicon', 'data-kind': 'folder' }, '📁'),
          h('div', { className: 'fs-dname' }, folder.name || '(未命名)')
        )
      );

      const fileRows = docFiltered.map((entry) =>
        h(
          'div',
          {
            key: entry.token,
            className: 'fs-drow',
            'data-active': Boolean(doc && doc.id === entry.token),
            title: entry.name,
            onClick: () => openDoc(entry.token),
            onContextMenu: (event) => {
              event.preventDefault();
              event.stopPropagation();
              setListMenu({ x: event.clientX, y: event.clientY, kind: entry.type === 'folder' ? 'folder' : 'file', entry });
            },
          },
          h('div', { className: 'fs-dicon', 'data-kind': entry.type || 'docx' }, docTypeChar(entry.type)),
          h('div', { className: 'fs-dname' }, entry.name || '(未命名)')
        )
      );

      const docsLeft = h(
        'div',
        { className: 'fs-dlist' },
        h(
          'div',
          { className: 'fs-dlist-top' },
          h('button', { type: 'button', className: 'fs-newdoc', title: '新建文档', onClick: () => setSheetOpen(true) }, h('span', { className: 'fs-newdoc-plus' }, '＋'), h('span', null, '新建')),
          h('button', { type: 'button', className: 'fs-btn', title: '刷新', disabled: busy, onClick: () => loadDrive(currentFolder.token) }, '刷新')
        ),
        authInfo.authorized
          ? h('div', { className: 'fs-auth' }, '👤 ' + (authInfo.name || '已授权'))
          : h(
              'button',
              {
                type: 'button',
                className: 'fs-auth-btn',
                onClick: () => window.open(bridgeOrigin + '/feishu-panel/oauth/start', '_blank', 'width=560,height=720'),
              },
              '授权我的飞书账号'
            ),
        h(
          'div',
          { className: 'fs-crumbs' },
          folderPath.map((node, index) =>
            h(
              'button',
              {
                key: String(index) + node.token,
                type: 'button',
                className: 'fs-crumb',
                title: node.name,
                onClick: () => setFolderPath(folderPath.slice(0, index + 1)),
              },
              index === 0 ? '我的空间' : node.name
            )
          )
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
          {
            className: 'fs-dlist-body',
            onContextMenu: (event) => {
              if (event.target !== event.currentTarget) return;
              event.preventDefault();
              setListMenu({ x: event.clientX, y: event.clientY, kind: 'blank' });
            },
          },
          folderRows.length || fileRows.length
            ? [].concat(folderRows, fileRows)
            : h(
                'div',
                { className: 'fs-dlist-empty' },
                busy ? '读取中…' : authInfo.authorized ? (docsQuery ? '没有匹配' : '这里还空着') : '先授权再看你的文件'
              )
        )
      );`;

must(oldLeft);
text = text.replace(oldLeft, () => newLeft);
count += 1;
console.log('patched: docsLeft');

// ⑥ 列表右键菜单（挂在 docMenu 之前）
swap(
  `        docMenu
          ? h(`,
  `        listMenu
          ? h(
              'div',
              {
                className: 'fs-menu',
                style: { left: Math.min(listMenu.x, (window.innerWidth || 800) - 186) + 'px', top: Math.min(listMenu.y, (window.innerHeight || 800) - 190) + 'px' },
                onMouseDown: (event) => event.stopPropagation(),
              },
              listMenu.kind === 'blank'
                ? [
                    h('button', { key: 'mk', type: 'button', className: 'fs-menu-item', onClick: () => { setListMenu(null); setAsk({ kind: 'mkdir', value: '' }); } }, h('span', null, '新建文件夹')),
                    h('button', { key: 'nd', type: 'button', className: 'fs-menu-item', onClick: () => { setListMenu(null); setSheetOpen(true); } }, h('span', null, '新建文档')),
                    h('div', { key: 'sep', className: 'fs-menu-sep' }),
                    h('button', { key: 'rf', type: 'button', className: 'fs-menu-item', onClick: () => { setListMenu(null); loadDrive(currentFolder.token); } }, h('span', null, '刷新')),
                  ]
                : [
                    listMenu.kind === 'folder'
                      ? h('button', { key: 'open', type: 'button', className: 'fs-menu-item', onClick: () => { const e = listMenu.entry; setListMenu(null); setFolderPath([...folderPath, { token: e.token, name: e.name }]); } }, h('span', null, '打开文件夹'))
                      : h('button', { key: 'open', type: 'button', className: 'fs-menu-item', onClick: () => { const e = listMenu.entry; setListMenu(null); openDoc(e.token); } }, h('span', null, '打开')),
                    h('button', { key: 'rn', type: 'button', className: 'fs-menu-item', onClick: () => { const e = listMenu.entry; setListMenu(null); setAsk({ kind: 'rename', file: e, value: e.name || '' }); } }, h('span', null, '重命名')),
                    h('div', { key: 'sep2', className: 'fs-menu-sep' }),
                    h('button', { key: 'del', type: 'button', className: 'fs-menu-item', 'data-danger': 'true', onClick: () => { const e = listMenu.entry; setListMenu(null); setAsk({ kind: 'delete', file: e }); } }, h('span', null, '删除')),
                  ]
            )
          : null,
        docMenu
          ? h(`,
  'list menu'
);

// ⑦ 重命名：文件夹走 drive 接口
swap(
  `            await bridge('/rename', { method: 'POST', body: JSON.stringify({ token: target.token, name, type: target.type || 'docx' }) });`,
  `            const kind = target.type === 'folder' ? 'folder' : target.type || 'docx';
            await bridge('/rename', { method: 'POST', body: JSON.stringify({ token: target.token, name, type: kind }) });`,
  'rename kind'
);

// ⑩ CSS
swap(
  `      .fs-dlist{width:118px;flex:none;`,
  `      .fs-dlist{width:168px;flex:none;`,
  'rail width'
);
swap(
  `      .fs-dlist-body{flex:1;min-height:0;overflow:auto;padding:0 4px 10px}`,
  `      .fs-dlist-body{flex:1;min-height:0;overflow:auto;padding:0 4px 10px;min-height:120px}
      .fs-auth{padding:0 8px 6px;font-size:10.5px;color:var(--dsw-alias-label-secondary,#7b857e);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fs-auth-btn{margin:0 8px 6px;padding:5px 8px;border-radius:8px;border:1px dashed var(--dsw-alias-label-primary-bluish,#4678ef);background:transparent;color:var(--dsw-alias-label-primary-bluish,#4678ef);font:inherit;font-size:11px;cursor:pointer}
      .fs-auth-btn:hover{background:var(--fs-bubble)}
      .fs-crumbs{display:flex;flex-wrap:wrap;gap:2px;padding:0 8px 4px}
      .fs-crumb{border:0;background:transparent;color:inherit;font:inherit;font-size:10.5px;padding:1px 4px;border-radius:5px;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.75}
      .fs-crumb:hover{background:var(--fs-bubble);opacity:1}
      .fs-crumb:not(:last-child):after{content:'/';margin-left:4px;opacity:.5}
      .fs-drow[data-kind=folder] .fs-dname{font-weight:600}`,
  'crumbs css'
);

fs.writeFileSync(file, text, 'utf8');
console.log('done:', count);
