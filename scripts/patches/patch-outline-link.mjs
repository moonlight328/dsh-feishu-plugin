// 上一轮 PowerShell 脚本中途 exit 没写入，这三处重做。
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

swap(
  `      const [outlineOpen, setOutlineOpen] = useState(false);`,
  `      const [outlineOpen, setOutlineOpen] = useState(false);
      // 打开大纲时顺手收起左边的文件列表，窄面板里正文才不会被挤没
      const toggleOutline = () => {
        const next = !outlineOpen;
        setOutlineOpen(next);
        if (props.onOutlineToggle) props.onOutlineToggle(next);
      };`,
  'toggleOutline'
);

swap(
  `              title: outlineOpen ? '收起大纲' : '展开大纲',
              onClick: () => setOutlineOpen((open) => !open),`,
  `              title: outlineOpen ? '收起大纲' : '展开大纲',
              onClick: toggleOutline,`,
  'button uses toggleOutline'
);

swap(
  `                { type: 'button', className: 'fs-icon-btn', title: '收起大纲', onClick: () => setOutlineOpen(false) },`,
  `                { type: 'button', className: 'fs-icon-btn', title: '收起大纲', onClick: toggleOutline },`,
  'rail close uses toggleOutline'
);

fs.writeFileSync(file, t, 'utf8');
console.log('done:', n);
