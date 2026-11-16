// markdown → 飞书 docx blocks（够用就行的子集）
// 只处理：标题、段落、无序/有序列表、代码块。行内样式（粗体/链接/表格）暂不映射——
// 飞书行内样式要拆 text_run + style，v1 先保持纯文本，避免写出一堆半残格式。

const textRun = (content) => [{ text_run: { content } }];

export function markdownToBlocks(markdown, title = '') {
  const blocks = [];
  const lines = String(markdown || '').split('\n');
  let fence = null;
  let fenceLines = [];
  for (const raw of lines) {
    if (raw.trim().startsWith('```')) {
      if (fence) {
        blocks.push({ block_type: 14, code: { elements: textRun(fenceLines.join('\n')), style: { language: 1, wrap: true } } });
        fence = null;
        fenceLines = [];
      } else {
        fence = true;
      }
      continue;
    }
    if (fence) {
      fenceLines.push(raw);
      continue;
    }
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      // 正文第一行如果就是标题本身，别再重复一遍（标题已经写进文档 title）
      if (blocks.length === 0 && title && heading[2].trim() === String(title).trim()) continue;
      const level = Math.min(9, heading[1].length);
      const key = `heading${level}`;
      blocks.push({ block_type: 2 + level, [key]: { elements: textRun(heading[2]), style: {} } });
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      blocks.push({ block_type: 12, bullet: { elements: textRun(bullet[1]), style: {} } });
      continue;
    }
    const ordered = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
    if (ordered) {
      blocks.push({ block_type: 13, ordered: { elements: textRun(ordered[2]), style: {} } });
      continue;
    }
    blocks.push({ block_type: 2, text: { elements: textRun(line), style: {} } });
  }
  if (fence && fenceLines.length) {
    blocks.push({ block_type: 14, code: { elements: textRun(fenceLines.join('\n')), style: { language: 1, wrap: true } } });
  }
  return blocks;
}

export function firstLine(markdown) {
  const line = String(markdown || '')
    .split('\n')
    .map((row) => row.replace(/^#+\s*/, '').replace(/^[-*+]\s*/, '').trim())
    .find(Boolean);
  return (line || '未命名文档').slice(0, 80);
}

/**
 * 编辑器里的「片段」→ 飞书 elements。
 * 片段形如 { text, bold, italic, underline, strike, code, link }；
 * 没有片段时退化成单个纯文本 run（老数据、纯文字段落都走这条路）。
 */
export function elementsFromSpans(spans, fallbackText = '') {
  const list = Array.isArray(spans) ? spans.filter((s) => s && String(s.text ?? '') !== '') : [];
  if (!list.length) return [{ text_run: { content: String(fallbackText ?? '') } }];
  const out = [];
  for (const span of list) {
    const style = {};
    if (span.bold) style.bold = true;
    if (span.italic) style.italic = true;
    if (span.underline) style.underline = true;
    if (span.strike) style.strikethrough = true;
    if (span.code) style.inline_code = true;
    if (span.link) style.link = { url: String(span.link) };
    const run = { content: String(span.text ?? '') };
    if (Object.keys(style).length) run.text_element_style = style;
    out.push({ text_run: run });
  }
  // 飞书不接受全空的 elements
  return out.length ? out : [{ text_run: { content: '' } }];
}

/** 块数组 → 飞书 docx children（比 markdown 多支持图片块和行内样式）。 */
export function blocksToChildren(blocks) {
  const textRun = (content) => [{ text_run: { content } }];
  // 有片段就用片段生成 elements（保留加粗/斜体/链接），否则退回纯文本
  const elementsOf = (block, text) => (Array.isArray(block?.spans) && block.spans.length ? elementsFromSpans(block.spans, text) : textRun(text));
  const children = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const type = String(block?.type || 'p');
    const text = String(block?.text ?? '');
    if (type === 'image') {
      const token = String(block?.token || block?.text || '').trim();
      // 图片块字段是 file_token（写 token 会 1770001 invalid param）
      if (token) children.push({ block_type: 27, image: { file_token: token } });
      continue;
    }
    // 分割线没有文字，必须放在空文本检查之前
    if (type === 'divider') {
      children.push({ block_type: 22, divider: {} });
      continue;
    }
    if (!text.trim()) continue;
    if (type === 'todo') {
      children.push({ block_type: 17, todo: { elements: elementsOf(block, text), style: { done: Boolean(block?.done) } } });
      continue;
    }
    if (type === 'quote') {
      children.push({ block_type: 15, quote: { elements: elementsOf(block, text), style: {} } });
      continue;
    }
    if (type === 'h1' || type === 'h2' || type === 'h3') {
      const level = Number(type.slice(1));
      const key = `heading${level}`;
      children.push({ block_type: 2 + level, [key]: { elements: elementsOf(block, text), style: {} } });
      continue;
    }
    if (type === 'bullet') {
      children.push({ block_type: 12, bullet: { elements: elementsOf(block, text), style: {} } });
      continue;
    }
    if (type === 'ordered') {
      children.push({ block_type: 13, ordered: { elements: elementsOf(block, text), style: {} } });
      continue;
    }
    if (type === 'code') {
      children.push({ block_type: 14, code: { elements: elementsOf(block, text), style: { language: 1, wrap: true } } });
      continue;
    }
    children.push({ block_type: 2, text: { elements: elementsOf(block, text), style: {} } });
  }
  return children;
}

/** 飞书 elements → 编辑器片段（读文档时用，保留行内样式）。 */
export function spansFromElements(elements) {
  const spans = [];
  for (const el of Array.isArray(elements) ? elements : []) {
    if (!el) continue;
    const run = el.text_run;
    if (!run) {
      // 非文本元素：@人、公式、提醒、图片这些编辑器改不了，留个可见占位
      if (el.mention_doc || el.mention_user) spans.push({ text: '［提及］' });
      else if (el.equation) spans.push({ text: '［公式］' });
      else if (el.reminder) spans.push({ text: '［提醒］' });
      continue;
    }
    const style = run.text_element_style || {};
    const span = { text: String(run.content ?? '') };
    if (style.bold) span.bold = true;
    if (style.italic) span.italic = true;
    if (style.underline) span.underline = true;
    if (style.strikethrough) span.strike = true;
    if (style.inline_code) span.code = true;
    if (style.link && style.link.url) span.link = String(style.link.url);
    spans.push(span);
  }
  return spans;
}

/** 片段里有没有任何样式（全纯文本就没必要带着 spans 走）。 */
export function spansHaveStyle(spans) {
  return (Array.isArray(spans) ? spans : []).some((s) => s && (s.bold || s.italic || s.underline || s.strike || s.code || s.link));
}