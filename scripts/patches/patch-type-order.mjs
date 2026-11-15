// 把 applyType 挪到 importFont/removeFont 之前（避免 TDZ）。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let t = fs.readFileSync(file, 'utf8');

const applyTypeBlock = `      const applyType = useCallback((next) => {
        setTypeSet(next);
        try {
          window.localStorage.setItem(TYPE_KEY, JSON.stringify(next));
        } catch {
          /* 存不了就算了，本次会话仍然生效 */
        }
      }, []);
`;

if (!t.includes(applyTypeBlock)) {
  console.error('applyType block not found verbatim');
  process.exit(1);
}

// 先摘掉
t = t.replace(applyTypeBlock, '');
// 再插到 customFonts 之前
const anchor = `      const [customFonts, setCustomFonts] = useState([]);`;
if (!t.includes(anchor)) {
  console.error('customFonts anchor missing');
  process.exit(1);
}
t = t.replace(anchor, applyTypeBlock + anchor);

fs.writeFileSync(file, t, 'utf8');
console.log('order fixed');
