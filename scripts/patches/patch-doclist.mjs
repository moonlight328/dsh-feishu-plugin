// 文档列表 UI 重做：过滤 + 类型色块 + 相对时间 + 悬停箭头。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let text = fs.readFileSync(file, 'utf8');
let count = 0;
function must(a) {
  if (!text.includes(a)) {
    console.error('ANCHOR MISS:\n' + a.slice(0, 180));
    process.exit(1);
  }
}
function swap(from, to, label) {
  must(from);
  text = text.replace(from, () => to);
  count += 1;
  console.log('patched:', label);
}

// ① 工具函数：相对时间 / 类型标签 / 类型字符
const helpers = `    function relativeTime(seconds) {
      const value = Number(seconds);
      if (!value) return '';
      const diff = Date.now() / 1000 - value;
      if (diff < 60) return '刚刚';
      if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
      if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
      if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';
      const date = new Date(value * 1000);
      return date.getMonth() + 1 + '/' + date.getDate();
    }

    function docTypeLabel(type) {
      const labels = { docx: '文档', sheet: '表格', bitable: '多维表格', mindnote: '思维笔记', slides: '幻灯片', file: '文件', folder: '文件夹' };
      return labels[type] || (type || '文件');
    }

    function docTypeChar(type) {
      const chars = { docx: '文', sheet: '表', bitable: '多', mindnote: '脑', slides: '幻', file: '件', folder: '夹' };
      return chars[type] || '文';
    }

`;
must('    const FEISHU_EMOJI = {');
text = text.replace('    const FEISHU_EMOJI = {', () => helpers + '    const FEISHU_EMOJI = {');
count += 1;
console.log('patched: list helpers');

// ② 过滤状态
swap(
  `      const [docs, setDocs] = useState([]);`,
  `      const [docs, setDocs] = useState([]);
      const [docsQuery, setDocsQuery] = useState('');`,
  'docs filter state'
);

// ③ 列表渲染
swap(
  `        : docs.length
          ? docs.map((file) =>
              h(
                'div',
                { key: file.token, className: 'fs-row', onClick: () => openDoc(file.token) },
                h('span', null, file.name),
                h('small', null, file.type)
              )
            )
          : h('div', { className: 'fs-empty' }, h('div', { className: 'fs-empty-emoji' }, '📄'), h('div', null, busy ? '读取中…' : '云空间里还没有文档'), h('div', null, '在下面写点东西，Ctrl+Enter 建成飞书文档'));`,
  `        : docs.length
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
                      { className: 'fs-doc-body' },
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
  'doc list render'
);

// ④ CSS
must('.fs-emoji{');
const css = `.fs-doclist{padding:2px 6px 10px}
      .fs-search{padding:6px 6px 10px;position:sticky;top:0;z-index:2;background:var(--dsw-alias-bg-base,#fff);backdrop-filter:blur(6px)}
      .fs-search-input{width:100%;box-sizing:border-box;border:1px solid var(--fs-line);background:var(--fs-bubble);border-radius:10px;padding:7px 11px;font:inherit;font-size:12px;color:inherit}
      .fs-search-input:focus{outline:2px solid var(--dsw-alias-label-primary-bluish,#4678ef);outline-offset:-1px}
      .fs-doc-row{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:11px;cursor:pointer;transition:background .12s ease}
      .fs-doc-row:hover{background:var(--fs-bubble)}
      .fs-doc-icon{width:30px;height:30px;flex:none;border-radius:9px;display:grid;place-items:center;font-size:12.5px;font-weight:600;background:#eef2ff;color:#4a63c8}
      .fs-doc-icon[data-kind=sheet]{background:#e9f7ee;color:#2f7d4f}
      .fs-doc-icon[data-kind=bitable]{background:#fdf1e7;color:#a4622a}
      .fs-doc-icon[data-kind=mindnote]{background:#f4ecfd;color:#7a4fbf}
      .fs-doc-icon[data-kind=slides]{background:#fdeef4;color:#b8467b}
      .fs-doc-icon[data-kind=file],.fs-doc-icon[data-kind=folder]{background:#f1f2f4;color:#5a6270}
      .fs-doc-body{flex:1;min-width:0}
      .fs-doc-name{font-size:13px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fs-doc-meta{display:flex;align-items:center;gap:6px;margin-top:2px;font-size:10.5px;color:var(--dsw-alias-label-secondary,#7b857e)}
      .fs-doc-tag{padding:0 6px;border-radius:5px;background:var(--fs-bubble);line-height:1.6}
      .fs-doc-go{flex:none;font-size:16px;line-height:1;color:var(--dsw-alias-label-secondary,#7b857e);opacity:0;transition:opacity .12s ease}
      .fs-doc-row:hover .fs-doc-go{opacity:.65}
      .fs-emoji{`;
text = text.replace('.fs-emoji{', () => css);
count += 1;
console.log('patched: list css');

fs.writeFileSync(file, text, 'utf8');
console.log('done:', count);
