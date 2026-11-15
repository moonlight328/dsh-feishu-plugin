// 把面板的文档区从「大 textarea」换成块编辑器（标题/段落/列表/代码块各自成行）。
// 逐条替换 + 锚点校验，任何一条没匹配上就直接失败，不留半套代码。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let text = fs.readFileSync(file, 'utf8');
let count = 0;

function must(anchor) {
  if (!text.includes(anchor)) {
    console.error('ANCHOR MISS:\n' + anchor.slice(0, 200));
    process.exit(1);
  }
}

function swap(from, to, label) {
  must(from);
  text = text.replace(from, () => to);
  count += 1;
  console.log('patched:', label);
}

// ① 状态：docDraft/textarea → blocks
swap(
  `      const [doc, setDoc] = useState(null);
      const [docDraft, setDocDraft] = useState('');`,
  `      const [doc, setDoc] = useState(null);
      const [blocks, setBlocks] = useState([]);`,
  'state blocks'
);

// ② openDoc：拉结构化块
swap(
  `      const openDoc = useCallback(async (token) => {
        setBusy(true);
        setError('');
        try {
          const data = await bridge(\`/doc?id=\${encodeURIComponent(token)}\`);
          if (mounted.current) {
            setDoc({ id: token, content: data.content || '' });
            setDocDraft(data.content || '');
          }
        } catch (failure) {
          if (mounted.current) setError(failure.message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, []);`,
  `      const openDoc = useCallback(async (token) => {
        setBusy(true);
        setError('');
        setNotice('');
        try {
          const data = await bridge(\`/docblocks?id=\${encodeURIComponent(token)}\`);
          if (!mounted.current) return;
          const list = (data.blocks || []).map((block, index) => ({
            key: \`\${block.id || 'new'}-\${index}\`,
            type: block.type || 'p',
            text: block.text || '',
          }));
          setDoc({ id: token });
          setBlocks(list.length ? list : [{ key: \`blk-\${Date.now()}\`, type: 'p', text: '' }]);
        } catch (failure) {
          if (mounted.current) setError(failure.message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, []);`,
  'openDoc blocks'
);

// ③ saveDoc：blocks → markdown → /save → 重读
swap(
  `      const saveDoc = useCallback(async () => {
        if (!doc) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
          const data = await bridge('/save', { method: 'POST', body: JSON.stringify({ id: doc.id, markdown: docDraft }) });
          if (!mounted.current) return;
          setDoc({ id: doc.id, content: data.content || docDraft });
          setDocDraft(data.content || docDraft);
          setNotice(\`已保存（原 \${data.removed} 块 → 新 \${data.blocks} 块，旧版备份在本地）\`);
        } catch (failure) {
          if (mounted.current) setError(failure.message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, [doc, docDraft]);`,
  `      const saveDoc = useCallback(async () => {
        if (!doc) return;
        const markdown = blocksToMarkdown(blocks);
        if (!markdown.trim()) {
          setError('正文是空的，先写点东西再保存');
          return;
        }
        setBusy(true);
        setError('');
        setNotice('');
        try {
          const data = await bridge('/save', { method: 'POST', body: JSON.stringify({ id: doc.id, markdown }) });
          if (!mounted.current) return;
          setNotice(\`已保存（原 \${data.removed} 块 → 新 \${data.blocks} 块，旧版备份在本地）\`);
          const refreshed = await bridge(\`/docblocks?id=\${encodeURIComponent(doc.id)}\`);
          if (!mounted.current) return;
          setBlocks(
            (refreshed.blocks || []).map((block, index) => ({
              key: \`\${block.id || 'new'}-\${index}\`,
              type: block.type || 'p',
              text: block.text || '',
            }))
          );
        } catch (failure) {
          if (mounted.current) setError(failure.message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, [doc, blocks]);`,
  'saveDoc blocks'
);

// ④ 文档详情：换成 BlockEditor
swap(
  `      const docsBody = doc
        ? h(
            'div',
            null,
            h(
              'div',
              { className: 'fs-doc-head' },
              h('button', { className: 'fs-btn', type: 'button', onClick: () => setDoc(null) }, '← 列表'),
              h('span', { className: 'fs-chip' }, doc.id.slice(-8)),
              h('span', { className: 'fs-chip' }, \`\${docDraft.length} 字\`),
              h('span', { className: 'fs-status' }, notice || '')
            ),
            h('textarea', {
              className: 'fs-doc-editor',
              value: docDraft,
              spellCheck: false,
              onChange: (event) => setDocDraft(event.target.value),
            }),
            h(
              'div',
              { className: 'fs-doc-actions' },
              h('span', { className: 'fs-status' }, '改完 Ctrl+S 存回飞书'),
              h('button', { className: 'fs-btn fs-save', type: 'button', 'data-primary': 'true', disabled: busy, onClick: saveDoc }, '保存')
            )
          )
        : docs.length`,
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
        : docs.length`,
  'docsBody -> BlockEditor'
);

// ⑤ 渲染分支
swap(
  `          : tab === 'chats' ? chatBody : doc ? h('div', { className: 'fs-doc-wrap' }, docsBody) : h('div', { className: 'fs-scroll' }, docsBody),`,
  `          : tab === 'chats' ? chatBody : doc ? docsBody : h('div', { className: 'fs-scroll' }, docsBody),`,
  'render branch'
);

// ⑥ 插入 helpers + BlockEditor（放在 FeishuPane 之前）
const helpers = `    function blocksToMarkdown(blocks) {
      return blocks
        .map((block) => {
          const value = String(block.text ?? '');
          if (block.type === 'h1') return '# ' + value;
          if (block.type === 'h2') return '## ' + value;
          if (block.type === 'h3') return '### ' + value;
          if (block.type === 'bullet') return '- ' + value;
          if (block.type === 'ordered') return '1. ' + value;
          if (block.type === 'code') return '\\u0060\\u0060\\u0060\\n' + value + '\\n\\u0060\\u0060\\u0060';
          return value;
        })
        .join('\\n');
    }

    function caretOffset(node) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return 0;
      const range = selection.getRangeAt(0);
      const before = document.createRange();
      before.selectNodeContents(node);
      before.setEnd(range.endContainer, range.endOffset);
      return before.toString().length;
    }

    const BLOCK_LABEL = { h1: 'H1', h2: 'H2', h3: 'H3', bullet: '•', ordered: '1.', code: '</>', p: '¶' };

    function BlockEditor(props) {
      const { blocks, onChange, onSave, onBack, busy, notice, docId } = props;
      const refs = useRef(new Map());
      const focusKey = useRef(null);

      useEffect(() => {
        const key = focusKey.current;
        if (!key) return undefined;
        focusKey.current = null;
        const node = refs.current.get(key);
        if (!node) return undefined;
        node.focus();
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        return undefined;
      }, [blocks]);

      const setText = (key, value) => onChange(blocks.map((block) => (block.key === key ? { ...block, text: value } : block)));

      const handleKeyDown = (event, index) => {
        const block = blocks[index];
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          const caret = caretOffset(event.currentTarget);
          const head = block.text.slice(0, caret);
          const tail = block.text.slice(caret);
          const next = blocks.map((row) => (row.key === block.key ? { ...row, text: head } : row));
          const created = {
            key: 'blk-' + Date.now() + '-' + index,
            type: block.type === 'h1' || block.type === 'h2' || block.type === 'h3' ? 'p' : block.type,
            text: tail,
          };
          next.splice(index + 1, 0, created);
          focusKey.current = created.key;
          onChange(next);
          return;
        }
        if (event.key === 'Backspace' && index > 0 && caretOffset(event.currentTarget) === 0) {
          event.preventDefault();
          const previous = blocks[index - 1];
          const merged = blocks
            .map((row) => (row.key === previous.key ? { ...row, text: previous.text + block.text } : row))
            .filter((row) => row.key !== block.key);
          focusKey.current = previous.key;
          onChange(merged);
          return;
        }
        if (event.key === ' ') {
          const raw = String(event.currentTarget.textContent || '');
          const heading = /^(#{1,3})$/.exec(raw);
          const bullet = /^[-*+]$/.exec(raw);
          if (heading || bullet) {
            event.preventDefault();
            const node = refs.current.get(block.key);
            if (node) node.textContent = '';
            onChange(blocks.map((row) => (row.key === block.key ? { ...row, type: heading ? 'h' + heading[1].length : 'bullet', text: '' } : row)));
            focusKey.current = block.key;
          }
        }
      };

      const totalChars = blocks.reduce((sum, block) => sum + String(block.text || '').length, 0);

      return h(
        'div',
        { className: 'fs-doc-wrap' },
        h(
          'div',
          { className: 'fs-doc-head' },
          h('button', { className: 'fs-btn', type: 'button', onClick: onBack }, '← 列表'),
          h('span', { className: 'fs-chip' }, String(docId).slice(-8)),
          h('span', { className: 'fs-chip' }, totalChars + ' 字 / ' + blocks.length + ' 段'),
          h('span', { className: 'fs-status' }, notice || ''),
          h('button', { className: 'fs-btn fs-save', type: 'button', 'data-primary': 'true', disabled: busy, onClick: onSave }, '保存')
        ),
        h(
          'div',
          { className: 'fs-doc-body' },
          blocks.map((block, index) =>
            h(
              'div',
              { key: block.key, className: 'fs-block', 'data-type': block.type },
              h('span', { className: 'fs-gutter' }, BLOCK_LABEL[block.type] || '¶'),
              h('div', {
                className: 'fs-block-text',
                contentEditable: true,
                suppressContentEditableWarning: true,
                spellCheck: false,
                'data-empty': String(!block.text),
                ref: (node) => {
                  if (!node) return;
                  refs.current.set(block.key, node);
                  if (node.dataset.filled !== block.key) {
                    node.textContent = block.text;
                    node.dataset.filled = block.key;
                  }
                },
                onInput: (event) => setText(block.key, event.currentTarget.textContent || ''),
                onKeyDown: (event) => handleKeyDown(event, index),
              })
            )
          ),
          h(
            'div',
            { className: 'fs-doc-tail' },
            h(
              'button',
              {
                className: 'fs-btn',
                type: 'button',
                onClick: () => {
                  const created = { key: 'blk-' + Date.now(), type: 'p', text: '' };
                  focusKey.current = created.key;
                  onChange([...blocks, created]);
                },
              },
              '+ 段落'
            ),
            h('span', { className: 'fs-status' }, '回车分段 · 行首 # 变标题 · 行首 - 变列表 · Ctrl+S 保存')
          )
        )
      );
    }

`;
must('    function FeishuPane() {');
text = text.replace('    function FeishuPane() {', () => helpers + '    function FeishuPane() {');
count += 1;
console.log('patched: helpers + BlockEditor');

// ⑦ CSS：块编辑器
const cssAnchor = `      .fs-empty{`;
must(cssAnchor);
const css = `.fs-block{position:relative;display:flex;max-width:820px;margin:0 auto;padding:3px 18px 3px 46px;border-radius:9px;transition:background .1s ease}
      .fs-block:hover{background:var(--fs-bubble)}
      .fs-gutter{position:absolute;left:14px;top:9px;font-size:10px;font-weight:700;letter-spacing:.4px;color:var(--dsw-alias-label-secondary,#7b857e);opacity:0;transition:opacity .12s ease;cursor:default;user-select:none}
      .fs-block:hover .fs-gutter{opacity:.8}
      .fs-block-text{flex:1;min-width:0;outline:none;font-size:14.5px;line-height:1.95;white-space:pre-wrap;word-break:break-word;padding:2px 0;caret-color:var(--dsw-alias-label-primary-bluish,#4678ef)}
      .fs-block-text[data-empty=true]:before{content:attr(data-placeholder);color:#80808066}
      .fs-block[data-type=h1] .fs-block-text{font-size:25px;font-weight:700;line-height:1.4;margin:12px 0 4px;letter-spacing:-.2px}
      .fs-block[data-type=h2] .fs-block-text{font-size:19px;font-weight:650;line-height:1.5;margin:12px 0 3px}
      .fs-block[data-type=h3] .fs-block-text{font-size:16px;font-weight:650;line-height:1.6;margin:10px 0 2px}
      .fs-block[data-type=bullet]{padding-left:52px}
      .fs-block[data-type=bullet] .fs-block-text:before{content:'•';position:absolute;left:34px;color:var(--dsw-alias-label-secondary,#7b857e)}
      .fs-block[data-type=ordered]{padding-left:52px}
      .fs-block[data-type=code] .fs-block-text{font-family:ui-monospace,"Cascadia Mono",Consolas,monospace;font-size:12.5px;line-height:1.75;background:var(--fs-bubble);border-radius:9px;padding:10px 13px;margin:4px 0}
      .fs-doc-body{flex:1;min-height:0;overflow:auto;padding:16px 4px 70px}
      .fs-doc-body::-webkit-scrollbar{width:8px}
      .fs-doc-body::-webkit-scrollbar-thumb{background:#8080802e;border-radius:8px}
      .fs-doc-tail{max-width:820px;margin:6px auto 0;padding:0 18px 0 46px;display:flex;align-items:center;gap:8px}
      .fs-empty{`;
text = text.replace(cssAnchor, () => css);
count += 1;
console.log('patched: block css');

fs.writeFileSync(file, text, 'utf8');
console.log('done, patches applied:', count);
