// 大纲从浮层改成文档区右侧的侧栏。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let t = fs.readFileSync(file, 'utf8');
let n = 0;
function swap(a, b, label) {
  if (!t.includes(a)) {
    console.error('ANCHOR MISS:', label, '\n---\n' + a.slice(0, 200) + '\n---');
    process.exit(1);
  }
  t = t.replace(a, () => b);
  n += 1;
  console.log('patched:', label);
}

// ① body 外面套一层 main
swap(
  `        h(
          'div',
          { className: 'fs-doc-body' },
`,
  `        h(
          'div',
          { className: 'fs-doc-main' },
          h(
          'div',
          { className: 'fs-doc-body' },
`,
  'wrap body in main'
);

// ② 删掉原来的浮层大纲
const floatOutline = `          outlineOpen
            ? h(
                'div',
                { className: 'fs-outline' },
                outline.length
                  ? outline.map(({ block, index }) =>
                      h(
                        'button',
                        {
                          key: block.key,
                          type: 'button',
                          className: 'fs-outline-item',
                          'data-level': levelOf(block.type),
                          onClick: () => jumpTo(block.key),
                        },
                        String(block.text || '（空标题）').slice(0, 40)
                      )
                    )
                  : h('div', { className: 'fs-outline-empty' }, '没有标题')
              )
            : null,
`;
swap(floatOutline, '', 'drop floating outline');

// ③ 收尾处插入侧栏大纲
swap(
  `            h('span', { className: 'fs-status' }, '回车分段 · 行首 # 变标题 · 行首 - 变列表 · Ctrl+S 保存')
          )
        )
      );
    }`,
  `            h('span', { className: 'fs-status' }, '回车分段 · 行首 # 变标题 · 行首 - 变列表 · Ctrl+S 保存')
          )
          ),
          h(
            'div',
            { className: 'fs-outline-rail', 'data-open': outlineOpen },
            h(
              'div',
              { className: 'fs-outline-head' },
              h('span', { className: 'fs-outline-title' }, '大纲'),
              h(
                'button',
                { type: 'button', className: 'fs-icon-btn', title: '收起大纲', onClick: () => setOutlineOpen(false) },
                '×'
              )
            ),
            h(
              'div',
              { className: 'fs-outline-list' },
              outline.length
                ? outline.map(({ block, index }) =>
                    h(
                      'button',
                      {
                        key: block.key,
                        type: 'button',
                        className: 'fs-outline-item',
                        'data-level': levelOf(block.type),
                        title: String(block.text || '（空标题）'),
                        onClick: () => jumpTo(block.key),
                      },
                      String(block.text || '（空标题）').slice(0, 30)
                    )
                  )
                : h('div', { className: 'fs-outline-empty' }, '这篇没有标题')
            )
          )
        )
      );
    }`,
  'add outline rail'
);

// ④ 大纲按钮：打开时高亮，点开侧栏
swap(
  `              className: 'fs-btn',
              type: 'button',
              'data-active': outlineOpen,
              onClick: () => setOutlineOpen((open) => !open),
            },
            '大纲'`,
  `              className: 'fs-btn fs-outline-toggle',
              type: 'button',
              'data-active': outlineOpen,
              title: outlineOpen ? '收起大纲' : '展开大纲',
              onClick: () => setOutlineOpen((open) => !open),
            },
            '大纲'`,
  'outline toggle button'
);

fs.writeFileSync(file, t, 'utf8');
console.log('done:', n);
