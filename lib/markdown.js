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

/** 块数组 → 飞书 docx children（比 markdown 多支持图片块）。 */
export function blocksToChildren(blocks) {
  const textRun = (content) => [{ text_run: { content } }];
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
    if (!text.trim()) continue;
    if (type === 'h1' || type === 'h2' || type === 'h3') {
      const level = Number(type.slice(1));
      const key = `heading${level}`;
      children.push({ block_type: 2 + level, [key]: { elements: textRun(text), style: {} } });
      continue;
    }
    if (type === 'bullet') {
      children.push({ block_type: 12, bullet: { elements: textRun(text), style: {} } });
      continue;
    }
    if (type === 'ordered') {
      children.push({ block_type: 13, ordered: { elements: textRun(text), style: {} } });
      continue;
    }
    if (type === 'code') {
      children.push({ block_type: 14, code: { elements: textRun(text), style: { language: 1, wrap: true } } });
      continue;
    }
    children.push({ block_type: 2, text: { elements: textRun(text), style: {} } });
  }
  return children;
}