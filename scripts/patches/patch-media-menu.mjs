// 前端两块改动：
//  ① 消息渲染：飞书表情短码 [笑哭] → 真 emoji；图片/贴图直接用 <img> 打桥拿字节。
//  ② 块编辑器：右键弹格式菜单（正文/标题/列表/代码/上移/下移/删除）。
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

// ① emoji 短码表 + 渲染器（插在 formatTime 之后）
const emojiHelpers = `    const FEISHU_EMOJI = {
      笑哭: '😂', 破涕为笑: '😭', 微笑: '🙂', 偷笑: '🤭', 允悲: '😔', 汗: '😅', 尴尬: '😅',
      打脸: '🫠', 捂脸: '🤦', 白眼: '🙄', 骷髅: '💀', 拥抱: '🤗', 亲亲: '😘', 可怜: '🥺',
      强: '👍', 赞: '👍', 鼓掌: '👏', 握手: '🤝', 加油: '💪', 拳头: '✊', ok: '👌',
      玫瑰: '🌹', 心: '❤️', 爱心: '❤️', 心碎: '💔', 烟花: '🎉', 庆祝: '🥳', 礼物: '🎁',
      咖啡: '☕', 蛋糕: '🎂', 啤酒: '🍺', 干杯: '🥂', 钱: '💰', 红包: '🧧', 火: '🔥',
      狗头: '🐶', 猫: '🐱', 猪头: '🐷', 太阳: '☀️', 月亮: '🌙', 星星: '⭐', 闪电: '⚡',
      问号: '❓', 感叹号: '❗', 对号: '✅', 叉: '❌', 警告: '⚠️', 沙漏: '⏳', 时钟: '🕐',
    };

    function renderEmojiText(value) {
      const source = String(value ?? '');
      if (!source) return '';
      const nodes = [];
      const regex = /\\[([^\\[\\]]{1,8})\\]/g;
      let last = 0;
      let match;
      let index = 0;
      while ((match = regex.exec(source))) {
        const mapped = FEISHU_EMOJI[match[1]];
        if (!mapped) continue;
        if (match.index > last) nodes.push(source.slice(last, match.index));
        nodes.push(h('span', { key: 'emoji-' + index, className: 'fs-emoji', title: match[1] }, mapped));
        index += 1;
        last = match.index + match[0].length;
      }
      if (last < source.length) nodes.push(source.slice(last));
      return nodes.length ? nodes : source;
    }

`;
must('    function blocksToMarkdown(blocks) {');
text = text.replace('    function blocksToMarkdown(blocks) {', () => emojiHelpers + '    function blocksToMarkdown(blocks) {');
count += 1;
console.log('patched: emoji helpers');

// ② 消息气泡：文本走 renderEmojiText，图片/贴图走 <img>
swap(
  `                        h('div', null, message.text),`,
  `                        message.imageKey || message.fileKey
                          ? h('img', {
                              className: 'fs-img',
                              alt: message.text,
                              src:
                                bridgeOrigin +
                                '/feishu-panel/media?messageId=' +
                                encodeURIComponent(message.id) +
                                '&fileKey=' +
                                encodeURIComponent(message.imageKey || message.fileKey) +
                                '&kind=' +
                                (message.imageKey ? 'image' : 'file'),
                              onError: (event) => {
                                event.currentTarget.style.display = 'none';
                              },
                            })
                          : h('div', null, renderEmojiText(message.text)),`,
  'message media'
);

// ③ 块编辑器：右键菜单状态 + 菜单项 + 应用函数
swap(
  `      const refs = useRef(new Map());
      const focusKey = useRef(null);`,
  `      const refs = useRef(new Map());
      const focusKey = useRef(null);
      const [menu, setMenu] = useState(null);

      useEffect(() => {
        if (!menu) return undefined;
        const close = () => setMenu(null);
        window.addEventListener('mousedown', close);
        window.addEventListener('scroll', close, true);
        return () => {
          window.removeEventListener('mousedown', close);
          window.removeEventListener('scroll', close, true);
        };
      }, [menu]);

      const applyMenu = (id, index) => {
        const block = blocks[index];
        if (!block) return;
        if (id === 'up' || id === 'down') {
          const target = id === 'up' ? index - 1 : index + 1;
          if (target < 0 || target >= blocks.length) return;
          const next = blocks.slice();
          next[index] = blocks[target];
          next[target] = block;
          onChange(next);
          return;
        }
        if (id === 'delete') {
          const next = blocks.filter((row) => row.key !== block.key);
          onChange(next.length ? next : [{ key: 'blk-' + Date.now(), type: 'p', text: '' }]);
          return;
        }
        onChange(blocks.map((row) => (row.key === block.key ? { ...row, type: id } : row)));
        focusKey.current = block.key;
      };`,
  'context menu state'
);

// ④ 块上挂 onContextMenu
swap(
  `              { key: block.key, className: 'fs-block', 'data-type': block.type },`,
  `              {
                key: block.key,
                className: 'fs-block',
                'data-type': block.type,
                onContextMenu: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setMenu({ x: event.clientX, y: event.clientY, index });
                },
              },`,
  'block contextmenu'
);

// ⑤ 菜单渲染（挂在 BlockEditor 返回的根节点里）
swap(
  `          h(
            'div',
            { className: 'fs-doc-tail' },`,
  `          menu
            ? h(
                'div',
                {
                  className: 'fs-menu',
                  style: { left: Math.min(menu.x, (window.innerWidth || 800) - 172) + 'px', top: Math.min(menu.y, (window.innerHeight || 800) - 320) + 'px' },
                  onMouseDown: (event) => event.stopPropagation(),
                },
                [
                  ['p', '正文', ''],
                  ['h1', '标题 1', '#'],
                  ['h2', '标题 2', '##'],
                  ['h3', '标题 3', '###'],
                  ['bullet', '无序列表', '-'],
                  ['ordered', '有序列表', '1.'],
                  ['code', '代码块', '\`\`\`'],
                ].map(([id, label, key]) =>
                  h(
                    'button',
                    { key: id, type: 'button', className: 'fs-menu-item', 'data-active': blocks[menu.index]?.type === id, onClick: () => { applyMenu(id, menu.index); setMenu(null); } },
                    h('span', null, label),
                    h('span', { className: 'fs-menu-key' }, key)
                  )
                )
                  .concat([h('div', { key: 'sep', className: 'fs-menu-sep' })])
                  .concat([
                    h('button', { key: 'up', type: 'button', className: 'fs-menu-item', onClick: () => { applyMenu('up', menu.index); setMenu(null); } }, h('span', null, '上移一段')),
                    h('button', { key: 'down', type: 'button', className: 'fs-menu-item', onClick: () => { applyMenu('down', menu.index); setMenu(null); } }, h('span', null, '下移一段')),
                    h('button', { key: 'delete', type: 'button', className: 'fs-menu-item', 'data-danger': 'true', onClick: () => { applyMenu('delete', menu.index); setMenu(null); } }, h('span', null, '删除这段')),
                  ])
              )
            : null,
          h(
            'div',
            { className: 'fs-doc-tail' },`,
  'menu render'
);

// ⑥ CSS：emoji / 图片 / 右键菜单
must('      .fs-empty{');
const css = `.fs-emoji{font-size:15px;line-height:1;vertical-align:-2px}
      .fs-img{display:block;max-width:100%;max-height:220px;border-radius:10px;margin:2px 0}
      .fs-menu{position:fixed;z-index:9999;min-width:168px;padding:5px;border-radius:11px;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--fs-line);box-shadow:0 14px 36px #0b1a2a2b,0 2px 6px #0b1a2a14;display:flex;flex-direction:column;gap:1px}
      .fs-menu-item{display:flex;align-items:center;gap:10px;border:0;background:transparent;color:inherit;font:inherit;font-size:12.5px;text-align:left;padding:6px 10px;border-radius:7px;cursor:pointer}
      .fs-menu-item:hover{background:var(--fs-bubble)}
      .fs-menu-item[data-active=true]{color:var(--dsw-alias-label-primary-bluish,#4678ef);font-weight:600}
      .fs-menu-item[data-danger=true]{color:#c1533f}
      .fs-menu-key{margin-left:auto;font-size:10px;opacity:.45;font-family:ui-monospace,Consolas,monospace}
      .fs-menu-sep{height:1px;background:var(--fs-line);margin:4px 8px}
      .fs-empty{`;
text = text.replace('      .fs-empty{', () => css);
count += 1;
console.log('patched: media css');

fs.writeFileSync(file, text, 'utf8');
console.log('done:', count);
