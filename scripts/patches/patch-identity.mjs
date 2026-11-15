// 左栏加「我的 / 机器人」身份切换。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let text = fs.readFileSync(file, 'utf8');
let count = 0;
function must(a) {
  if (!text.includes(a)) {
    console.error('ANCHOR MISS:\n' + a.slice(0, 160));
    process.exit(1);
  }
}
function swap(from, to, label) {
  must(from);
  text = text.replace(from, () => to);
  count += 1;
  console.log('patched:', label);
}

// ① 身份状态
swap(
  `      const [listMenu, setListMenu] = useState(null);`,
  `      const [listMenu, setListMenu] = useState(null);
      const [identity, setIdentity] = useState('user');`,
  'identity state'
);

// ② loadDrive 带 identity
swap(
  '          const data = await bridge(`/drive?folderToken=${encodeURIComponent(token || \'\')}`);',
  '          const data = await bridge(`/drive?folderToken=${encodeURIComponent(token || \'\')}&identity=${identity}`);',
  'drive identity'
);
swap(
  `      }, []);

      const loadDocs = useCallback(() => loadDrive(currentFolder.token), [loadDrive, currentFolder.token]);`,
  `      }, [identity]);

      const loadDocs = useCallback(() => loadDrive(currentFolder.token), [loadDrive, currentFolder.token]);`,
  'loadDrive deps'
);

// ③ 切身份后重新加载
swap(
  `        loadAuth();
        loadDrive(currentFolder.token);
      }, [tab, currentFolder.token, loadDrive, loadAuth]);`,
  `        loadAuth();
        loadDrive(currentFolder.token);
      }, [tab, identity, currentFolder.token, loadDrive, loadAuth]);`,
  'effect deps'
);

// ④ 新建文件夹 / 文档带 identity
swap(
  `            await bridge('/mkdir', { method: 'POST', body: JSON.stringify({ name: value, parentToken: currentFolder.token }) });`,
  `            await bridge('/mkdir', { method: 'POST', body: JSON.stringify({ name: value, parentToken: currentFolder.token, identity }) });`,
  'mkdir identity'
);
swap(
  `            body: JSON.stringify({ title: docTitle.trim(), markdown, folderToken: currentFolder.token }),`,
  `            body: JSON.stringify({ title: docTitle.trim(), markdown, folderToken: currentFolder.token, identity }),`,
  'create identity'
);

// ⑤ 左栏切换控件
swap(
  `        authInfo.authorized && !authInfo.missingDriveScope
          ? h('div', { className: 'fs-auth' }, '👤 ' + (authInfo.name || '已授权'))`,
  `        h(
          'div',
          { className: 'fs-ident' },
          h(
            'button',
            {
              type: 'button',
              className: 'fs-ident-btn',
              'data-active': identity === 'user',
              onClick: () => {
                if (identity === 'user') return;
                setIdentity('user');
                setFolderPath([{ token: '', name: '我的空间' }]);
                setDoc(null);
              },
            },
            '我的'
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'fs-ident-btn',
              'data-active': identity === 'bot',
              onClick: () => {
                if (identity === 'bot') return;
                setIdentity('bot');
                setFolderPath([{ token: '', name: '机器人空间' }]);
                setDoc(null);
              },
            },
            '机器人'
          )
        ),
        identity === 'bot' || (authInfo.authorized && !authInfo.missingDriveScope)
          ? h('div', { className: 'fs-auth' }, identity === 'bot' ? '🤖 机器人自己的空间' : '👤 ' + (authInfo.name || '已授权'))`,
  'identity switch'
);

// ⑥ CSS
swap(
  `      .fs-auth{`,
  `      .fs-ident{display:flex;gap:4px;padding:2px 8px 6px}
      .fs-ident-btn{flex:1;border:1px solid var(--fs-line);background:transparent;color:inherit;font:inherit;font-size:11px;padding:4px 0;border-radius:8px;cursor:pointer;opacity:.7}
      .fs-ident-btn[data-active=true]{background:var(--dsw-label-primary-bluish,var(--dsw-alias-label-primary-bluish,#4678ef));border-color:transparent;color:#fff;opacity:1;font-weight:600}
      .fs-auth{`,
  'identity css'
);

fs.writeFileSync(file, text, 'utf8');
console.log('done:', count);
