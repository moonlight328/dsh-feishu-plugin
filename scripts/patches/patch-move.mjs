// 右键「移动到…」：飞书 move 接口 + 文件夹选择器。
import fs from 'node:fs';

// ---------- 主机半：index.js ----------
const idx = 'C:/Users/19941/notes/feishu-plugin/lib/index.js';
let i = fs.readFileSync(idx, 'utf8');
if (!i.includes('async moveFile(')) {
  const anchor = '  async readDoc(documentId) {';
  if (!i.includes(anchor)) {
    console.error('index anchor missing');
    process.exit(1);
  }
  const add = `  /** 把文件/文件夹移动到另一个文件夹（目标 folder_token 为空表示根目录）。 */
  async moveFile(fileToken, type = 'docx', folderToken = '', identity = 'user') {
    const data = await this.call(
      'POST',
      \`/open-apis/drive/v1/files/\${encodeURIComponent(fileToken)}/move\`,
      { body: { type, folder_token: folderToken || '' } },
      { preferUser: identity !== 'bot' }
    );
    return data?.data ?? data;
  }

  async readDoc(documentId) {`;
  i = i.replace(anchor, add);
  fs.writeFileSync(idx, i, 'utf8');
  console.log('index.js: moveFile added');
} else {
  console.log('index.js: moveFile 已存在');
}

// ---------- 主机半：bridge.js ----------
const br = 'C:/Users/19941/notes/feishu-plugin/lib/bridge.js';
let b = fs.readFileSync(br, 'utf8');
if (!b.includes("route === '/move'")) {
  const anchor = "      if (request.method === 'GET' && route === '/docblocks') {";
  if (!b.includes(anchor)) {
    console.error('bridge anchor missing');
    process.exit(1);
  }
  const add = `      if (request.method === 'POST' && route === '/move') {
        const body = await readBody(request);
        const token = String(body.token || '').trim();
        if (!token) throw new Error('缺少 token');
        const moved = await feishu.moveFile(
          token,
          String(body.type || 'docx'),
          String(body.folderToken || ''),
          String(body.identity || 'user')
        );
        return send(response, 200, { ok: true, token: moved?.token || token });
      }

${anchor}`;
  b = b.replace(anchor, add);
  fs.writeFileSync(br, b, 'utf8');
  console.log('bridge.js: /move added');
} else {
  console.log('bridge.js: /move 已存在');
}

// ---------- 前端：client.js ----------
const cl = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let t = fs.readFileSync(cl, 'utf8');
let n = 0;
function swap(a, x, label) {
  if (!t.includes(a)) {
    console.error('MISS:', label);
    process.exit(1);
  }
  t = t.replace(a, () => x);
  n += 1;
  console.log('patched:', label);
}

// ① 状态
swap(
  `      const [listMenu, setListMenu] = useState(null);`,
  `      const [listMenu, setListMenu] = useState(null);
      const [moveTarget, setMoveTarget] = useState(null);
      const [movePath, setMovePath] = useState([]);
      const [moveFolders, setMoveFolders] = useState([]);
      const [moveBusy, setMoveBusy] = useState(false);`,
  'move state'
);

// ② 加载 / 执行函数（放在 mkdir 之前）
swap(
  `      const mkdir = useCallback(`,
  `      const loadMoveFolders = useCallback(
        async (token) => {
          try {
            const data = await bridge(\`/drive?folderToken=\${encodeURIComponent(token || '')}&identity=\${identity}\`);
            setMoveFolders((data.folders || []).map((row) => ({ token: row.token, name: row.name })));
          } catch (error) {
            setMoveFolders([]);
            setError(error.message);
          }
        },
        [identity]
      );
      const openMove = useCallback(
        (entry) => {
          setListMenu(null);
          setDocMenu(null);
          setMoveTarget({ token: entry.token, name: entry.name, type: entry.type || 'docx' });
          setMovePath([{ token: '', name: identity === 'bot' ? '机器人空间' : '我的空间' }]);
          loadMoveFolders('');
        },
        [identity, loadMoveFolders]
      );
      const enterMoveFolder = useCallback(
        (folder) => {
          setMovePath((prev) => [...prev, folder]);
          loadMoveFolders(folder.token);
        },
        [loadMoveFolders]
      );
      const doMove = useCallback(async () => {
        if (!moveTarget) return;
        const dest = movePath[movePath.length - 1] || { token: '', name: '根目录' };
        setMoveBusy(true);
        try {
          await bridge('/move', {
            method: 'POST',
            body: JSON.stringify({
              token: moveTarget.token,
              type: moveTarget.type,
              folderToken: dest.token,
              identity,
            }),
          });
          setMoveTarget(null);
          setNotice('已移动到「' + dest.name + '」');
          loadDrive(currentFolder.token);
        } catch (error) {
          setError(error.message);
        } finally {
          setMoveBusy(false);
        }
      }, [moveTarget, movePath, identity, loadDrive, currentFolder.token]);

      const mkdir = useCallback(`,
  'move handlers'
);

// ③ 菜单项：文件/文件夹都加「移动到…」
swap(
  `                    h('button', { key: 'rn', type: 'button', className: 'fs-menu-item', onClick: () => { const e = listMenu.entry; setListMenu(null); setAsk({ kind: 'rename', file: e, value: e.name || '' }); } }, h('span', null, '重命名')),`,
  `                    h('button', { key: 'rn', type: 'button', className: 'fs-menu-item', onClick: () => { const e = listMenu.entry; setListMenu(null); setAsk({ kind: 'rename', file: e, value: e.name || '' }); } }, h('span', null, '重命名')),
                    h('button', { key: 'mv', type: 'button', className: 'fs-menu-item', onClick: () => openMove(listMenu.entry) }, h('span', null, '移动到…')),`,
  'menu move item'
);
swap(
  `              h('button', { type: 'button', className: 'fs-menu-item', onClick: () => { const target = docMenu.file; setDocMenu(null); setAsk({ kind: 'rename', file: target, value: target.name || '' }); } }, h('span', null, '重命名')),`,
  `              h('button', { type: 'button', className: 'fs-menu-item', onClick: () => { const target = docMenu.file; setDocMenu(null); setAsk({ kind: 'rename', file: target, value: target.name || '' }); } }, h('span', null, '重命名')),
              h('button', { type: 'button', className: 'fs-menu-item', onClick: () => openMove(docMenu.file) }, h('span', null, '移动到…')),`,
  'doc menu move item'
);

// ④ 弹层：移动到
swap(
  `        sheetOpen
          ? h(`,
  `        moveTarget
          ? h(
              'div',
              { className: 'fs-sheet', onClick: () => setMoveTarget(null) },
              h(
                'div',
                { className: 'fs-sheet-card fs-move-card', onClick: (event) => event.stopPropagation() },
                h(
                  'div',
                  { className: 'fs-sheet-head' },
                  h('span', { className: 'fs-sheet-title' }, '移动到'),
                  h('button', { className: 'fs-btn', type: 'button', onClick: () => setMoveTarget(null) }, '取消')
                ),
                h('div', { className: 'fs-sheet-note' }, '「' + (moveTarget.name || '未命名') + '」'),
                h(
                  'div',
                  { className: 'fs-move-path' },
                  movePath.map((node, index) =>
                    index === movePath.length - 1
                      ? h('span', { key: 'p' + index, className: 'fs-crumb', 'data-current': 'true' }, node.name)
                      : h(
                          'button',
                          {
                            key: 'p' + index,
                            type: 'button',
                            className: 'fs-crumb',
                            onClick: () => {
                              setMovePath(movePath.slice(0, index + 1));
                              loadMoveFolders(node.token);
                            },
                          },
                          node.name
                        )
                  )
                ),
                h(
                  'div',
                  { className: 'fs-move-list' },
                  movePath.length > 1
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'fs-move-item fs-move-up',
                          onClick: () => {
                            const next = movePath.slice(0, -1);
                            setMovePath(next);
                            loadMoveFolders((next[next.length - 1] || {}).token || '');
                          },
                        },
                        '↑ 上一级'
                      )
                    : null,
                  moveFolders.length
                    ? moveFolders.map((folder) =>
                        h(
                          'button',
                          { key: folder.token, type: 'button', className: 'fs-move-item', onClick: () => enterMoveFolder(folder) },
                          h('span', { className: 'fs-move-icon' }, '📁'),
                          h('span', { className: 'fs-move-name' }, folder.name || '未命名')
                        )
                      )
                    : h('div', { className: 'fs-move-empty' }, '这里没有子文件夹')
                ),
                h(
                  'div',
                  { className: 'fs-sheet-actions' },
                  h(
                    'button',
                    { className: 'fs-btn', type: 'button', 'data-primary': 'true', disabled: moveBusy, onClick: doMove },
                    moveBusy ? '移动中…' : '移动到这里'
                  )
                )
              )
            )
          : null,
        sheetOpen
          ? h(`,
  'move sheet'
);

// ⑤ CSS
swap(
  `      .fs-type-btn{font-weight:650;min-width:28px;justify-content:center}`,
  `      .fs-type-btn{font-weight:650;min-width:28px;justify-content:center}
      .fs-move-card{max-width:320px}
      .fs-move-path{display:flex;flex-wrap:wrap;gap:2px;padding:6px 8px;background:var(--fs-brand-softer);border-radius:8px;min-height:30px;align-items:center}
      .fs-move-path .fs-crumb{max-width:110px}
      .fs-move-path .fs-crumb[data-current=true]{background:var(--fs-brand-soft);color:var(--fs-brand);font-weight:600}
      .fs-move-list{max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:1px;border:1px solid var(--fs-line-soft);border-radius:9px;padding:4px}
      .fs-move-item{display:flex;align-items:center;gap:7px;border:0;background:transparent;text-align:left;font-size:12px;padding:5px 8px;border-radius:7px;width:100%}
      .fs-move-item:hover{background:var(--fs-hover)}
      .fs-move-up{color:var(--fs-brand);font-weight:600}
      .fs-move-icon{font-size:12px;line-height:1}
      .fs-move-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fs-move-empty{font-size:11px;color:var(--fs-fg3);text-align:center;padding:12px 8px}`,
  'move css'
);

fs.writeFileSync(cl, t, 'utf8');
console.log('client 改动:', n);
