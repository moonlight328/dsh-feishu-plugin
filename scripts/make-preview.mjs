// 生成面板静态预览（会话 / 文档列表 / 文档编辑），用真 CSS，供截图检查。
import fs from 'node:fs';

const client = fs.readFileSync('C:/Users/19941/notes/feishu-plugin/lib/client.js', 'utf8');
const match = /const CSS = `([\s\S]*?)`;/.exec(client);
if (!match) throw new Error('CSS 提取失败');
const css = match[1];

const bubble = (text, mine, meta) =>
  `<div class="fs-msg-row"${mine ? ' data-mine="true"' : ''}><div class="fs-bubble"><div>${text}</div><div class="fs-bubble-meta">${meta}</div></div></div>`;

const docRow = (char, kind, name, tag, when) =>
  `<div class="fs-doc-row"><div class="fs-doc-icon" data-kind="${kind}">${char}</div><div class="fs-doc-info"><div class="fs-doc-name">${name}</div><div class="fs-doc-meta"><span class="fs-doc-tag">${tag}</span><span>${when}</span></div></div><span class="fs-doc-go">›</span></div>`;

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<style>
  body{margin:0;background:#eceff3;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;padding:18px;display:flex;gap:16px;align-items:flex-start}
  .frame{position:relative;width:340px;height:768px;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 18px 44px #0b1a2a1f;display:flex;flex-direction:column;border:1px solid #e3e6ea}
  ${css}
</style></head>
<body>
  <div class="frame"><div class="fs-root">
    <div class="fs-bar"><span class="fs-dot" data-state="ok"></span><span class="fs-status">已连接 · DSH插件</span><button class="fs-btn">重连</button></div>
    <div class="fs-tabs"><button class="fs-tab" data-active="true">会话</button><button class="fs-tab">文档</button><button class="fs-tab">网页版</button></div>
    <div class="fs-chat-body"><div class="fs-scroll" style="max-height:30%;flex:none">
      <div class="fs-row" data-active="true"><div class="fs-avatar">D</div><div class="fs-row-body"><div class="fs-row-name">DSH会话管理</div><div class="fs-row-sub">群会话</div></div></div>
      <div class="fs-row"><div class="fs-avatar">设</div><div class="fs-row-body"><div class="fs-row-name">设计组</div><div class="fs-row-sub">群会话</div></div></div>
    </div>
    <div class="fs-scroll" style="flex:1">
      ${bubble('看得见吗', false, '成员 · 11-16 01:32')}
      ${bubble('看得见。这条是从 DSH 面板发出来的。', true, '机器人 · 11-16 01:33')}
      <div class="fs-msg-row"><div class="fs-bubble"><div><span class="fs-emoji" title="笑哭">😂</span> <span class="fs-emoji" title="赞">👍</span> <span class="fs-emoji" title="火">🔥</span></div><div class="fs-bubble-meta">成员 · 11-16 01:33</div></div></div>
      <div class="fs-msg-row"><div class="fs-bubble"><img class="fs-img" src="data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27100%27%3E%3Crect width=%27200%27 height=%27100%27 fill=%27%23dfe7f5%27/%3E%3Ctext x=%2718%27 y=%2758%27 font-size=%2716%27 fill=%27%2344526b%27%3E图片消息%3C/text%3E%3C/svg%3E" alt="图片"><div class="fs-bubble-meta">成员 · 11-16 01:34</div></div></div>
      ${bubble('那以后文案写完直接丢这儿？', false, '成员 · 11-16 01:34')}
      ${bubble('对，要么发群，要么建成飞书文档给你。', true, '机器人 · 11-16 01:35')}
      ${bubble('那我现在试一条', false, '成员 · 11-16 01:36')}
      ${bubble('好，我盯着', true, '机器人 · 11-16 01:36')}
      ${bubble('测试滚动测试滚动测试滚动测试滚动', false, '成员 · 11-16 01:37')}
      ${bubble('收到', true, '机器人 · 11-16 01:37')}
    </div></div>
    <div class="fs-composer">
      <textarea placeholder="发给这个群…（Ctrl+Enter 发送）"></textarea>
      <div class="fs-row-line"><span class="fs-status">Ctrl+Enter 发送</span><button class="fs-btn fs-send" data-primary="true">发送</button></div>
    </div>
  </div></div>

  <div class="frame"><div class="fs-root">
    <div class="fs-bar"><span class="fs-dot" data-state="ok"></span><span class="fs-status">已连接 · DSH插件</span><button class="fs-btn">重连</button></div>
    <div class="fs-tabs"><button class="fs-tab">会话</button><button class="fs-tab" data-active="true">文档</button><button class="fs-tab">网页版</button></div>
    <div class="fs-split">
      <div class="fs-dlist">
        <div class="fs-dlist-top"><button class="fs-newdoc"><span class="fs-newdoc-plus">＋</span><span>新建</span></button><button class="fs-btn">刷新</button></div>
        <div class="fs-auth">👤 岳不群</div>
        <div class="fs-crumbs"><button class="fs-crumb">我的空间</button><button class="fs-crumb">营销素材</button></div>
        <div class="fs-search"><input class="fs-search-input" placeholder="过滤…"></div>
        <div class="fs-dlist-body">
          <div class="fs-drow" data-kind="folder"><div class="fs-dicon" data-kind="folder">📁</div><div class="fs-dname">2026 双十一</div></div>
          <div class="fs-drow" data-kind="folder"><div class="fs-dicon" data-kind="folder">📁</div><div class="fs-dname">旧稿归档</div></div>
          <div class="fs-drow" data-active="true"><div class="fs-dicon" data-kind="docx">文</div><div class="fs-dname">新品发布文案 · 终版</div></div>
          <div class="fs-drow"><div class="fs-dicon" data-kind="docx">文</div><div class="fs-dname">DSH 接入自检</div></div>
          <div class="fs-drow"><div class="fs-dicon" data-kind="sheet">表</div><div class="fs-dname">投放排期</div></div>
          <div class="fs-menu" style="position:absolute;left:120px;top:330px">
            <button class="fs-menu-item"><span>新建文件夹</span></button>
            <button class="fs-menu-item"><span>新建文档</span></button>
            <div class="fs-menu-sep"></div>
            <button class="fs-menu-item"><span>刷新</span></button>
          </div>
        </div>
      </div>
      <div class="fs-doc-wrap">
        <div class="fs-doc-head"><button class="fs-btn">«</button><span class="fs-chip">216 字 · 6 段</span><span class="fs-status"></span><button class="fs-btn fs-save" data-primary="true">保存</button></div>
        <div class="fs-doc-body">
          <div class="fs-block" data-type="h1"><span class="fs-gutter">H1</span><div class="fs-block-text">新品发布文案</div></div>
          <div class="fs-block" data-type="p"><span class="fs-gutter">¶</span><div class="fs-block-text">这一版把开头换成了场景化切入，不再从参数讲起。</div></div>
          <div class="fs-block" data-type="h2"><span class="fs-gutter">H2</span><div class="fs-block-text">改了什么</div></div>
          <div class="fs-block" data-type="bullet"><span class="fs-gutter">•</span><div class="fs-block-text">第三段删掉了一个数据</div></div>
          <div class="fs-doc-tail"><button class="fs-btn">+ 段落</button><span class="fs-status">右键改格式</span></div>
        </div>
      </div>
    </div>
    <div class="fs-menu" style="position:absolute;left:30px;top:250px">
      <button class="fs-menu-item"><span>打开</span></button>
      <button class="fs-menu-item"><span>重命名</span></button>
      <div class="fs-menu-sep"></div>
      <button class="fs-menu-item" data-danger="true"><span>删除</span></button>
    </div>
  </div></div>

  <div class="frame"><div class="fs-root">
    <div class="fs-bar"><span class="fs-dot" data-state="ok"></span><span class="fs-status">已连接 · DSH插件</span><button class="fs-btn">重连</button></div>
    <div class="fs-tabs"><button class="fs-tab">会话</button><button class="fs-tab" data-active="true">文档</button><button class="fs-tab">网页版</button></div>
    <div class="fs-doc-wrap">
      <div class="fs-doc-head"><button class="fs-btn">← 列表</button><span class="fs-chip">8G9xsfRz</span><span class="fs-chip">216 字 / 6 段</span><span class="fs-status"></span><button class="fs-btn fs-save" data-primary="true">保存</button></div>
      <div class="fs-doc-body">
        <div class="fs-block" data-type="h1"><span class="fs-gutter">H1</span><div class="fs-block-text">新品发布文案</div></div>
        <div class="fs-block" data-type="p"><span class="fs-gutter">¶</span><div class="fs-block-text">这一版把开头换成了场景化切入，不再从参数讲起。鼠标划过这一行的时候，左边会出现类型标记。</div></div>
        <div class="fs-block" data-type="h2"><span class="fs-gutter">H2</span><div class="fs-block-text">改了什么</div></div>
        <div class="fs-block" data-type="bullet"><span class="fs-gutter">•</span><div class="fs-block-text">第三段删掉了一个数据</div></div>
        <div class="fs-block" data-type="bullet"><span class="fs-gutter">•</span><div class="fs-block-text">结尾加了一句行动号召</div></div>
        <div class="fs-block" data-type="code"><span class="fs-gutter">&lt;/&gt;</span><div class="fs-block-text">console.log('code block')</div></div>
        <div class="fs-doc-tail"><button class="fs-btn">+ 段落</button><span class="fs-status">回车分段 · 右键改格式 · Ctrl+S 保存</span></div>
      </div>
    </div>
  </div></div>
</body></html>`;

fs.writeFileSync('C:/Users/19941/notes/feishu-plugin/preview.html', html, 'utf8');
console.log('preview.html written', html.length, 'bytes');
