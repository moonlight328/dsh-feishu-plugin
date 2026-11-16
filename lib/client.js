// feishu-plugin 浏览器半：侧栏右侧一个「飞书」页签。
//
// 不直连 open.feishu.cn（App Secret 不能进浏览器），所有请求打主机半的本地桥
// http://127.0.0.1:<port>/feishu-panel/*。端口用探测找，主机换端口也能跟上。

window.__ModuleLoader__.load({
  id: 'feishu-plugin',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useRef, useMemo, memo } = React;

    const PORT_START = 6820;
    const PORT_COUNT = 6;

    const CSS = `:root{
        --fs-brand: var(--dsw-alias-label-primary-bluish, #4678ef);
        --fs-brand-soft: rgba(70,120,239,.1);
        --fs-brand-softer: rgba(70,120,239,.06);
        --fs-brand-ring: rgba(70,120,239,.18);
        --fs-fg: var(--dsw-alias-label-primary, #1f2430);
        --fs-fg2: var(--dsw-alias-label-secondary, #6b7280);
        --fs-fg3: rgba(128,138,150,.85);
        --fs-line: var(--dsw-alias-border-l1, rgba(128,138,150,.22));
        --fs-line-soft: rgba(128,138,150,.14);
        --fs-hover: rgba(128,138,150,.1);
        --fs-fill: rgba(128,138,150,.14);
        --fs-bubble: rgba(128,138,150,.12);
        --fs-card: var(--dsw-alias-bg-base, #fff);
        --fs-radius: 10px;
        --fs-radius-sm: 7px;
        --fs-radius-lg: 14px;
        --fs-shadow: 0 16px 40px -12px rgba(15,23,42,.22), 0 4px 12px -4px rgba(15,23,42,.1), 0 0 0 .5px rgba(15,23,42,.04);
        --fs-shadow-sm: 0 1px 2px rgba(15,23,42,.06), 0 0 0 .5px rgba(15,23,42,.04);
        --fs-ease: cubic-bezier(.32,.72,0,1);
      }
      .fs-root{display:flex;flex-direction:column;height:100%;min-height:320px;font:13px/1.6 var(--fs-font,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif);color:var(--fs-fg);position:relative;overflow:hidden;-webkit-font-smoothing:antialiased;letter-spacing:.005em}
      .fs-root *{box-sizing:border-box}
      .fs-root button{font:inherit;color:inherit;cursor:pointer;transition:background .16s var(--fs-ease),color .16s var(--fs-ease),opacity .16s var(--fs-ease),transform .12s var(--fs-ease),box-shadow .16s var(--fs-ease),border-color .16s var(--fs-ease)}

      /* 顶栏 */
      .fs-bar{display:flex;align-items:center;gap:7px;padding:9px 12px 6px;flex:none}
      .fs-dot{width:7px;height:7px;border-radius:50%;background:#c0c6cf;flex:none;transition:background .2s var(--fs-ease),box-shadow .2s var(--fs-ease)}
      .fs-dot[data-state=ok]{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.14);animation:fs-pulse 2.4s ease-in-out infinite}
      .fs-dot[data-state=fail]{background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.14)}
      @keyframes fs-pulse{0%,100%{opacity:1}50%{opacity:.45}}
      .fs-status{font-size:11px;color:var(--fs-fg2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.01em}
      .fs-bar .fs-btn{margin-left:auto}

      /* 页签：分段控件 */
      .fs-tabs{display:flex;gap:2px;margin:0 10px 8px;padding:3px;background:var(--fs-brand-softer);border-radius:10px;flex:none;box-shadow:inset 0 0 0 .5px var(--fs-line-soft)}
      .fs-tab{flex:1;border:0;background:transparent;color:var(--fs-fg2);font-size:11.5px;font-weight:500;padding:5px 0;border-radius:8px;position:relative}
      .fs-tab:hover{color:var(--fs-fg)}
      .fs-tab[data-active=true]{background:var(--fs-card);color:var(--fs-fg);font-weight:600;box-shadow:0 1px 3px rgba(15,23,42,.1),0 0 0 .5px rgba(15,23,42,.05)}

      /* 按钮 */
      .fs-btn{border:1px solid var(--fs-line);background:transparent;border-radius:9px;font-size:11.5px;font-weight:500;padding:4px 10px;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
      .fs-btn:hover{background:var(--fs-hover);transform:translateY(-.5px);box-shadow:0 1px 3px rgba(15,23,42,.06)}
      .fs-btn:active{transform:scale(.975);box-shadow:none}
      .fs-btn[data-active=true]{background:var(--fs-brand-soft);border-color:transparent;color:var(--fs-brand);font-weight:600;box-shadow:none}
      .fs-btn[data-primary=true]{background:linear-gradient(180deg,#5285f6,#4678ef);border-color:transparent;color:#fff;font-weight:600;box-shadow:0 1px 2px rgba(70,120,239,.3),0 4px 12px -3px rgba(70,120,239,.35)}
      .fs-btn[data-primary=true]:hover{filter:brightness(1.05);transform:translateY(-.5px)}
      .fs-btn:disabled{opacity:.45;cursor:default;transform:none;box-shadow:none}
      .fs-btn[data-danger=true]{color:#e5484d;border-color:transparent;background:transparent}
      .fs-btn[data-danger=true]:hover{background:rgba(229,72,77,.1)}
      .fs-icon-btn{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;border-radius:7px;color:var(--fs-fg2);font-size:13px;line-height:1}
      .fs-icon-btn:hover{background:var(--fs-hover);color:var(--fs-fg)}
      .fs-chip{font-size:10.5px;color:var(--fs-fg2);background:var(--fs-brand-softer);border-radius:6px;padding:2px 7px;white-space:nowrap;box-shadow:inset 0 0 0 .5px var(--fs-line-soft)}

      /* 通用滚动区 / 空态 */
      .fs-scroll{flex:1;min-height:0;overflow:auto;padding:4px}
      .fs-root ::-webkit-scrollbar{width:7px;height:7px}
      .fs-root ::-webkit-scrollbar-thumb{background:rgba(128,138,150,.22);border-radius:7px;border:1.5px solid transparent;background-clip:content-box;transition:background .16s var(--fs-ease)}
      .fs-root ::-webkit-scrollbar-thumb:hover{background:rgba(128,138,150,.42);background-clip:content-box}
      .fs-root ::-webkit-scrollbar-track{background:transparent}
      .fs-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:var(--fs-fg2);font-size:11.5px;text-align:center;padding:26px 18px;line-height:1.7}
      .fs-empty-emoji{font-size:24px;opacity:.7;filter:saturate(.9)}
      .fs-err{color:#e5484d;font-size:11px;padding:7px 10px;background:rgba(229,72,77,.08);border-radius:9px;margin:4px 8px;box-shadow:inset 0 0 0 .5px rgba(229,72,77,.16)}
      .fs-hint{font-size:11px;color:var(--fs-fg2);line-height:1.7;padding:9px 11px;background:var(--fs-brand-softer);border-radius:9px;margin:4px 8px;box-shadow:inset 0 0 0 .5px var(--fs-line-soft)}

      /* 会话列表 */
      .fs-chat-body{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
      .fs-row{display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:9px;cursor:pointer;position:relative;transition:background .16s var(--fs-ease)}
      .fs-row:hover{background:var(--fs-hover)}
      .fs-row[data-active=true]{background:var(--fs-brand-soft);box-shadow:inset 0 0 0 .5px rgba(70,120,239,.12)}
      .fs-row[data-active=true]:before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:2.5px;height:18px;border-radius:0 3px 3px 0;background:var(--fs-brand)}
      .fs-avatar{width:26px;height:26px;flex:none;border-radius:8px;background:linear-gradient(135deg,rgba(70,120,239,.18),rgba(70,120,239,.05));color:var(--fs-brand);display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:650;box-shadow:inset 0 0 0 .5px rgba(70,120,239,.14)}
      .fs-row-body{min-width:0;flex:1}
      .fs-row-name{font-size:12.5px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;letter-spacing:.005em}
      .fs-row-sub{font-size:10.5px;color:var(--fs-fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}

      /* 消息 */
      .fs-msg-row{display:flex;flex-direction:column;margin:7px 2px}
      .fs-msg-row[data-mine=true]{align-items:flex-end}
      .fs-bubble{max-width:86%;padding:8px 11px;border-radius:13px 13px 13px 4px;background:var(--fs-bubble);font-size:12.5px;line-height:1.62;word-break:break-word;white-space:pre-wrap;position:relative;box-shadow:0 1px 2px rgba(15,23,42,.04)}
      .fs-msg-row[data-mine=true] .fs-bubble{border-radius:13px 13px 4px 13px;background:linear-gradient(180deg,#5285f6,#4678ef);color:#fff;box-shadow:0 1px 2px rgba(70,120,239,.28),0 4px 14px -6px rgba(70,120,239,.5)}
      .fs-bubble-meta{font-size:9.5px;color:var(--fs-fg3);margin-top:4px;opacity:.8;letter-spacing:.01em}
      .fs-msg-row[data-mine=true] .fs-bubble-meta{text-align:right;color:rgba(255,255,255,.72)}
      .fs-emoji{font-size:22px;line-height:1.2}
      .fs-img{max-width:100%;border-radius:10px;display:block;margin:2px 0}
      /* 富文本片段：链接、@人、行内代码 */
      .fs-segs{white-space:pre-wrap;word-break:break-word}
      .fs-seg-link{color:var(--fs-brand);text-decoration:underline;text-underline-offset:2px}
      .fs-msg-row[data-mine=true] .fs-seg-link{color:#fff;text-decoration-color:rgba(255,255,255,.6)}
      .fs-seg-mention{color:var(--fs-brand);font-weight:600;background:var(--fs-brand-softer);border-radius:4px;padding:0 3px}
      .fs-msg-row[data-mine=true] .fs-seg-mention{color:#fff;background:rgba(255,255,255,.18)}
      .fs-seg-code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;background:var(--fs-fill);border-radius:4px;padding:0 4px}
      .fs-seg-emoji{opacity:.95;font-size:1.05em;line-height:1}
      .fs-seg-emoji-raw{opacity:.7;font-size:.9em}
      .fs-seg-img{opacity:.75;font-size:11px}
      /* 文件消息：整块可点下载 */
      .fs-file-card{display:flex;align-items:center;gap:7px;padding:6px 8px;border-radius:9px;background:var(--fs-fill);text-decoration:none;color:inherit;max-width:100%}
      .fs-file-card:hover{background:var(--fs-hover)}
      .fs-msg-row[data-mine=true] .fs-file-card{background:rgba(255,255,255,.16)}
      .fs-file-icon{font-size:15px;line-height:1;flex:none}
      .fs-file-name{font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
      .fs-file-size{font-size:10px;opacity:.7;flex:none;margin-left:auto}

      /* 输入区 */
      .fs-composer{flex:none;border-top:1px solid var(--fs-line-soft);padding:9px 10px 10px;display:flex;flex-direction:column;gap:7px;background:transparent}
      .fs-composer textarea{width:100%;min-height:52px;max-height:120px;resize:vertical;border:1px solid var(--fs-line);background:transparent;color:inherit;border-radius:11px;padding:8px 10px;font:inherit;font-size:12.5px;line-height:1.62;transition:border-color .16s var(--fs-ease),box-shadow .16s var(--fs-ease)}
      .fs-composer textarea::placeholder{color:var(--fs-fg3)}
      .fs-composer textarea:focus{outline:none;border-color:var(--fs-brand);box-shadow:0 0 0 3px var(--fs-brand-ring)}
      .fs-row-line{display:flex;align-items:center;gap:8px}
      .fs-send{flex:none;margin-left:auto}
      .fs-pick{cursor:pointer;flex:none}
      .fs-more{display:flex;justify-content:center;padding:4px 0 8px}
      .fs-more .fs-btn{font-size:10.5px;color:var(--fs-fg2);border-style:dashed}
      .fs-more-end{font-size:10px;color:var(--fs-fg3);letter-spacing:.02em}
      /* 编辑器读不懂的块：只读占位，避免被当成空段落覆盖 */
      .fs-block-locked{padding-left:16px}
      .fs-block-locked-body{display:flex;align-items:center;gap:7px;padding:6px 9px;border:1px dashed var(--fs-line);border-radius:9px;background:var(--fs-hover);font-size:11.5px;color:var(--fs-fg2)}
      .fs-block-locked-kind{font-weight:600;color:var(--fs-fg)}
      .fs-block-locked-note{opacity:.8}
      .fs-block[data-rich=true] .fs-block-text{box-shadow:inset 2px 0 0 var(--fs-brand-ring);padding-left:6px}
      .fs-chip-warn{color:#b7791f;background:rgba(245,158,11,.14);box-shadow:inset 0 0 0 .5px rgba(245,158,11,.3);padding:1px 5px;font-size:10px}
      .fs-save[data-dirty=true]{box-shadow:0 1px 2px rgba(70,120,239,.3),0 0 0 3px var(--fs-brand-ring)}
      .fs-find-panel{position:absolute;right:8px;top:44px;z-index:42;width:220px;background:var(--fs-card);border:1px solid var(--fs-line);border-radius:13px;box-shadow:var(--fs-shadow);padding:9px;display:flex;flex-direction:column;gap:6px;animation:fs-pop .12s ease-out}
      .fs-find-input{width:100%;border:1px solid var(--fs-line);background:transparent;color:inherit;border-radius:8px;font:inherit;font-size:11.5px;padding:5px 8px}
      .fs-find-input:focus{outline:none;border-color:var(--fs-brand);box-shadow:0 0 0 3px var(--fs-brand-ring)}
      .fs-find-row{display:flex;align-items:center;gap:5px}
      .fs-find-count{flex:1;font-size:10.5px;color:var(--fs-fg2);font-variant-numeric:tabular-nums}
      .fs-find-note{flex:1;font-size:10.5px;color:var(--fs-brand)}
      .fs-find-row .fs-btn{margin-left:auto}

      /* 文档：左右分栏 */
      .fs-split{display:flex;flex:1;min-height:0;min-width:0;overflow:hidden}
      .fs-dlist{width:142px;flex:none;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--fs-line-soft);background:var(--fs-brand-softer)}
      .fs-dlist-top{display:flex;gap:4px;align-items:center;padding:7px 7px 5px}
      .fs-newdoc{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid transparent;background:linear-gradient(180deg,#5285f6,#4678ef);color:#fff;border-radius:9px;font-size:11.5px;font-weight:600;padding:5px 0;box-shadow:0 1px 2px rgba(70,120,239,.3),0 4px 12px -4px rgba(70,120,239,.4)}
      .fs-newdoc:hover{filter:brightness(1.06)}
      .fs-newdoc-plus{font-size:12px;line-height:1}
      .fs-ident{display:flex;gap:3px;padding:0 7px 6px}
      .fs-ident-btn{flex:1;border:1px solid var(--fs-line);background:transparent;font-size:10.5px;padding:3px 0;border-radius:7px;color:var(--fs-fg2)}
      .fs-ident-btn:hover{background:var(--fs-hover)}
      .fs-ident-btn[data-active=true]{background:var(--fs-brand);border-color:transparent;color:#fff;font-weight:600}
      .fs-auth{font-size:10.5px;color:var(--fs-fg2);padding:2px 9px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fs-auth-btn{display:block;width:calc(100% - 14px);margin:0 7px 6px;border:1px dashed var(--fs-line);background:transparent;color:var(--fs-brand);font-size:10.5px;font-weight:600;padding:4px;border-radius:7px}
      .fs-auth-btn:hover{background:var(--fs-brand-soft);border-style:solid}
      .fs-crumbs{display:flex;flex-wrap:nowrap;gap:2px;overflow:hidden;padding:0 7px 4px}
      .fs-crumb{border:0;background:transparent;font-size:10.5px;color:var(--fs-fg2);padding:1px 3px;border-radius:5px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:none}
      .fs-crumb:hover{background:var(--fs-hover);color:var(--fs-fg)}
      .fs-crumb:last-child{color:var(--fs-fg);font-weight:600}
      .fs-crumb+.fs-crumb:before{content:"/";color:var(--fs-fg3);margin-right:2px}
      .fs-search{padding:0 7px 5px}
      .fs-search-input{width:100%;border:1px solid var(--fs-line);background:var(--fs-bg, transparent);color:inherit;border-radius:7px;font:inherit;font-size:11px;padding:3px 7px}
      .fs-search-input:focus{outline:none;border-color:var(--fs-brand);box-shadow:0 0 0 3px var(--fs-brand-ring)}
      .fs-dlist-body{flex:1;min-height:0;overflow:auto;padding:0 5px 8px}
      .fs-dlist-body::-webkit-scrollbar{width:7px}
      .fs-dlist-body::-webkit-scrollbar-thumb{background:rgba(128,138,150,.26);border-radius:7px}
      .fs-drow{display:flex;align-items:center;gap:7px;padding:5px 7px;border-radius:8px;cursor:pointer;position:relative;transition:background .16s var(--fs-ease)}
      .fs-drow:hover{background:var(--fs-hover)}
      .fs-drow[data-active=true]{background:var(--fs-brand-soft);box-shadow:inset 0 0 0 .5px rgba(70,120,239,.12)}
      .fs-drow[data-active=true]:before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:2.5px;height:15px;border-radius:0 3px 3px 0;background:var(--fs-brand)}
      .fs-dicon{width:19px;height:19px;flex:none;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:650;background:var(--fs-fill);color:var(--fs-fg2)}
      .fs-dicon[data-kind=docx]{background:rgba(70,120,239,.14);color:#3b6fe0}
      .fs-dicon[data-kind=folder]{background:rgba(245,158,11,.16);color:#b7791f}
      .fs-dicon[data-kind=sheet]{background:rgba(34,197,94,.15);color:#18864b}
      .fs-dname{font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
      .fs-drow[data-kind=folder] .fs-dname{font-weight:600}
      .fs-drow[data-kind=up] .fs-dname{font-weight:600;opacity:.85}
      .fs-dlist-empty{font-size:10.5px;color:var(--fs-fg3);text-align:center;padding:14px 6px;line-height:1.6}

      /* 文档：编辑区 */
      .fs-doc-wrap{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0;overflow:hidden;position:relative}
      .fs-type-panel{position:absolute;right:8px;top:42px;z-index:40;width:214px;background:var(--fs-card);border:1px solid var(--fs-line);border-radius:13px;box-shadow:var(--fs-shadow);padding:10px;display:flex;flex-direction:column;gap:7px;animation:fs-pop .12s ease-out}
      .fs-type-label{font-size:9.5px;font-weight:650;color:var(--fs-fg2);letter-spacing:.07em;text-transform:uppercase}
      .fs-type-grid{display:flex;flex-wrap:wrap;gap:4px}
      .fs-type-opt{border:1px solid var(--fs-line);background:transparent;color:var(--fs-fg);border-radius:7px;font-size:11px;padding:4px 7px;min-width:40px}
      .fs-type-opt:hover{background:var(--fs-hover)}
      .fs-type-opt[data-active=true]{background:var(--fs-brand-soft);border-color:transparent;color:var(--fs-brand);font-weight:600}
      .fs-type-custom{display:flex;align-items:center;gap:2px}
      .fs-type-del{border:0;background:transparent;color:var(--fs-fg3);font-size:12px;line-height:1;padding:2px 3px;border-radius:5px}
      .fs-type-del:hover{background:rgba(229,72,77,.12);color:#e5484d}
      .fs-type-import{border-style:dashed;color:var(--fs-fg2);cursor:pointer;min-width:auto}
      .fs-type-import:hover{background:var(--fs-brand-soft);color:var(--fs-brand);border-style:solid}
      .fs-type-grid-fonts{max-height:104px;overflow-y:auto;padding-right:2px}
      .fs-type-grid-sizes{max-height:none;overflow:visible}
      .fs-type-grid-sizes .fs-type-opt{min-width:36px;padding:4px 5px;font-size:10.5px}
      .fs-type-reset{border:0;background:transparent;color:var(--fs-fg2);font-size:10.5px;padding:3px 0 0;text-align:right}
      .fs-type-reset:hover{color:var(--fs-brand)}
      .fs-type-btn{font-weight:650;min-width:28px;justify-content:center}
      .fs-webview-wrap{flex:1;min-height:0;display:flex;flex-direction:column;border-top:1px solid var(--fs-line-soft)}
      .fs-webview-bar{display:flex;align-items:center;gap:4px;padding:4px 8px;flex:none;background:var(--fs-brand-softer)}
      .fs-webview-url{flex:1;min-width:0;font-size:10.5px;color:var(--fs-fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
            .fs-web-host{flex:1;min-height:0;flex-direction:column}
      .fs-web{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding:18px 14px 20px}
      .fs-web-head{display:flex;flex-direction:column;gap:6px;align-items:flex-start}
      .fs-web-emoji{font-size:24px;line-height:1}
      .fs-web-title{font-size:15px;font-weight:650;letter-spacing:-.01em}
      .fs-web-note{font-size:11.5px;color:var(--fs-fg2);line-height:1.75}
      .fs-web-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .fs-web-card{display:flex;align-items:center;gap:8px;border:1px solid var(--fs-line-soft);background:var(--fs-bg,transparent);border-radius:10px;padding:10px 11px;font-size:12px;text-align:left}
      .fs-web-card:hover{background:var(--fs-brand-softer);border-color:var(--fs-brand-soft)}
      .fs-web-card-icon{font-size:15px;line-height:1}
      .fs-web-card-label{font-weight:500}
      .fs-web-open{align-self:flex-start;margin-top:2px}
            .fs-move-card{max-width:320px}
      .fs-move-path{display:flex;flex-wrap:wrap;gap:2px;padding:6px 8px;background:var(--fs-brand-softer);border-radius:8px;min-height:30px;align-items:center}
      .fs-move-path .fs-crumb{max-width:110px}
      .fs-move-path .fs-crumb[data-current=true]{background:var(--fs-brand-soft);color:var(--fs-brand);font-weight:600}
      .fs-move-list{max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:1px;border:1px solid var(--fs-line-soft);border-radius:9px;padding:4px}
      .fs-move-item{display:flex;align-items:center;gap:7px;border:0;background:transparent;text-align:left;font-size:12px;padding:5px 8px;border-radius:7px;width:100%}
      .fs-move-item:hover{background:var(--fs-hover)}
      .fs-move-up{color:var(--fs-brand);font-weight:600}
      .fs-move-icon{font-size:12px;line-height:1}
      .fs-move-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fs-move-empty{font-size:11px;color:var(--fs-fg3);text-align:center;padding:12px 8px}
      .fs-doc-head{display:flex;align-items:center;gap:3px;flex:none;padding:7px 6px 6px;border-bottom:1px solid var(--fs-line-soft);min-width:0;overflow:hidden}
      .fs-doc-head .fs-btn{flex:none;padding:4px 8px}
      .fs-doc-head .fs-chip{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:clip}
      .fs-doc-head .fs-save{margin-left:0}
      .fs-doc-head .fs-status{font-size:10px;color:var(--fs-fg3);flex:1 1 0;min-width:0;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fs-doc-main{display:flex;flex:1;min-height:0;position:relative}
      .fs-dplaceholder{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;padding:28px 22px;color:var(--fs-fg2);font-size:11.5px;text-align:center;line-height:1.75}
      .fs-dplaceholder .fs-empty-emoji{font-size:24px;opacity:.6}
      .fs-outline-toggle[data-active=true]{background:var(--fs-brand-soft);color:var(--fs-brand);font-weight:600}
      .fs-save{flex:none;margin-left:0;padding:4px 8px}
      /* 斜杠菜单 */
      .fs-slash{position:fixed;z-index:62;width:196px;max-height:264px;overflow:auto;background:var(--fs-card);border:1px solid var(--fs-line);border-radius:12px;box-shadow:var(--fs-shadow);padding:5px;display:flex;flex-direction:column;gap:1px;animation:fs-pop .12s var(--fs-ease)}
      .fs-slash-title{font-size:9.5px;font-weight:650;color:var(--fs-fg2);letter-spacing:.08em;text-transform:uppercase;padding:3px 8px 5px}
      .fs-slash-item{display:flex;align-items:center;justify-content:space-between;gap:8px;border:0;background:transparent;text-align:left;font-size:12px;padding:6px 8px;border-radius:8px;cursor:pointer}
      .fs-slash-item[data-active=true]{background:var(--fs-brand-soft);color:var(--fs-brand);font-weight:600}
      .fs-slash-hint{font-size:10px;color:var(--fs-fg3);font-weight:400}
      /* 尊重系统的「减少动效」设置 */
      @media (prefers-reduced-motion: reduce){
        .fs-root *{animation:none !important;transition:none !important}
      }
      .fs-doc-body{flex:1;min-width:0;overflow-y:auto;overflow-x:hidden;padding:16px 14px 80px;position:relative;transition:padding-right .16s ease}
      .fs-doc-main[data-outline=true] .fs-doc-body{padding-right:150px}
      .fs-doc-body::-webkit-scrollbar{width:8px}
      .fs-doc-body::-webkit-scrollbar-thumb{background:rgba(128,138,150,.26);border-radius:8px}
      .fs-block{position:relative;padding-left:16px;margin:0 auto;max-width:640px}
      .fs-gutter{position:absolute;left:0;top:6px;font-size:9px;color:var(--fs-fg3);opacity:0;transition:opacity .12s ease;user-select:none;font-weight:600}
      .fs-block:hover .fs-gutter{opacity:.75}
      .fs-collapse{position:absolute;left:0;top:5px;width:15px;height:15px;border:0;background:transparent;color:var(--fs-fg2);font-size:9px;border-radius:4px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .12s ease}
      .fs-block:hover .fs-collapse{opacity:1}
      .fs-collapse:hover{background:var(--fs-hover)}
      .fs-block[data-type=h1] .fs-block-text{font-size:calc(var(--fs-doc-size,13px) * 1.62);font-weight:700;line-height:1.35;letter-spacing:-.01em;margin:16px 0 6px}
      .fs-block[data-type=h2] .fs-block-text{font-size:calc(var(--fs-doc-size,13px) * 1.27);font-weight:650;line-height:1.4;margin:14px 0 5px}
      .fs-block[data-type=h3] .fs-block-text{font-size:calc(var(--fs-doc-size,13px) * 1.08);font-weight:650;line-height:1.5;margin:12px 0 4px}
      .fs-block-text{font-size:var(--fs-doc-size,13px);line-height:1.75;outline:none;white-space:pre-wrap;word-break:break-word;padding:2px 0;border-radius:4px;min-height:22px}
      .fs-block-text:focus{background:var(--fs-brand-softer);box-shadow:0 0 0 2px var(--fs-brand-ring);border-radius:6px}
      .fs-block[data-type=bullet] .fs-block-text{padding-left:14px;position:relative}
      .fs-block[data-type=bullet] .fs-block-text:before{content:"";position:absolute;left:3px;top:10px;width:4px;height:4px;border-radius:50%;background:var(--fs-fg2);opacity:.6}
            /* 块拖拽：gutter 当手柄，落点画一条 2px 的线 */
      .fs-gutter{cursor:grab}
      .fs-gutter:active{cursor:grabbing}
      .fs-block[data-dragging=true]{opacity:.42}
      .fs-block[data-drop=before]:before{content:"";position:absolute;left:0;right:0;top:-3px;height:2.5px;border-radius:2px;background:var(--fs-brand);z-index:3}
      .fs-block[data-drop=after]:after{content:"";position:absolute;left:0;right:0;bottom:-3px;height:2.5px;border-radius:2px;background:var(--fs-brand);z-index:3}.fs-block[data-type=ordered] .fs-block-text{padding-left:18px;position:relative}
      .fs-block[data-type=ordered] .fs-block-text:before{content:attr(data-ordinal) ".";position:absolute;left:0;top:0;color:var(--fs-fg2);font-variant-numeric:tabular-nums}
      .fs-block[data-type=code] .fs-block-text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:calc(var(--fs-doc-size,13px) - 1px);line-height:1.65;background:var(--fs-fill);border-radius:8px;padding:9px 11px;color:var(--fs-fg)}
      .fs-block-text[data-empty=true]:before{color:var(--fs-fg3);font-weight:400;pointer-events:none}
      .fs-doc-img{display:block;max-width:100%;border-radius:10px;margin:6px 0;border:1px solid var(--fs-line-soft)}
      .fs-doc-tail{display:flex;align-items:center;gap:8px;margin:14px auto 0;max-width:640px;padding-left:16px;flex-wrap:wrap}
      .fs-doc-tail .fs-status{font-size:10px;color:var(--fs-fg3);flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

      /* 大纲侧栏 */
      .fs-outline-rail{position:absolute;right:0;top:0;bottom:0;width:0;overflow:hidden;display:flex;flex-direction:column;z-index:15;background:var(--fs-brand-softer);transition:width .16s ease,box-shadow .16s ease;border-left:1px solid transparent}
      .fs-outline-rail[data-open=true]{width:140px;border-left-color:var(--fs-line-soft);box-shadow:-10px 0 28px -8px rgba(15,23,42,.12)}
      .fs-outline-head{display:flex;align-items:center;gap:4px;padding:8px 8px 4px;flex:none}
      .fs-outline-title{font-size:10px;font-weight:650;color:var(--fs-fg2);letter-spacing:.06em;text-transform:uppercase;flex:1}
      .fs-outline-list{flex:1;min-height:0;overflow:auto;padding:0 6px 10px}
      .fs-outline-list::-webkit-scrollbar{width:6px}
      .fs-outline-list::-webkit-scrollbar-thumb{background:rgba(128,138,150,.24);border-radius:6px}
      .fs-outline-item{display:block;width:100%;text-align:left;border:0;background:transparent;font-size:10.5px;line-height:1.45;padding:3px 5px;border-radius:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fs-fg2)}
      .fs-outline-item:hover{background:var(--fs-hover);color:var(--fs-fg)}
      .fs-outline-item[data-level="1"]:hover{border-left:2px solid var(--fs-brand);padding-left:4px}
      .fs-outline-item[data-level="1"]{font-weight:600;color:var(--fs-fg);font-size:11.5px}
      .fs-outline-item[data-level="2"]{padding-left:14px}
      .fs-outline-item[data-level="3"]{padding-left:24px;font-size:10.5px;opacity:.82}
      .fs-outline-empty{font-size:10.5px;color:var(--fs-fg3);padding:10px 8px;line-height:1.6}

      /* 右键菜单 */
      .fs-menu{position:fixed;z-index:60;min-width:158px;background:var(--fs-card);border:1px solid var(--fs-line);border-radius:11px;box-shadow:var(--fs-shadow);padding:4px;animation:fs-pop .12s ease-out}
      @keyframes fs-pop{from{opacity:0;transform:translateY(-3px) scale(.985)}to{opacity:1;transform:none}}
      .fs-menu-item{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;text-align:left;font-size:12px;padding:5px 8px;border-radius:7px}
      .fs-menu-item:hover{background:var(--fs-brand-soft);color:var(--fs-brand);transform:translateX(1px)}
      .fs-menu-item[data-active=true]{background:var(--fs-brand-soft);color:var(--fs-brand);font-weight:600}
      .fs-menu-item[data-danger=true]:hover{background:rgba(229,72,77,.1);color:#e5484d}
      .fs-menu-key{margin-left:auto;font-size:10px;color:var(--fs-fg3);font-family:ui-monospace,monospace}
      .fs-menu-sep{height:1px;background:var(--fs-line-soft);margin:4px 2px}

      /* 弹层（新建文档 / 重命名等） */
      .fs-sheet{position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.36);backdrop-filter:blur(3px) saturate(1.1);animation:fs-fade .14s ease-out}
      @keyframes fs-fade{from{opacity:0}to{opacity:1}}
      .fs-sheet-card{width:100%;max-width:300px;background:var(--fs-card);border:1px solid var(--fs-line);border-radius:15px;box-shadow:var(--fs-shadow);padding:14px;display:flex;flex-direction:column;gap:10px;animation:fs-rise .16s ease-out}
      @keyframes fs-rise{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
      .fs-sheet-title{font-size:13.5px;font-weight:650;letter-spacing:-.01em}
      .fs-sheet-note{font-size:11px;color:var(--fs-fg2);line-height:1.6}
      .fs-sheet-body{display:flex;flex-direction:column;gap:8px}
      .fs-sheet-input{width:100%;border:1px solid var(--fs-line);background:var(--fs-bg, transparent);color:inherit;border-radius:9px;padding:7px 9px;font:inherit;font-size:12.5px}
      .fs-sheet-input:focus{outline:none;border-color:var(--fs-brand);box-shadow:0 0 0 3px var(--fs-brand-ring)}
      .fs-sheet-actions{display:flex;gap:6px;justify-content:flex-end}
      .fs-sheet-head{display:flex;align-items:center;gap:6px}
      .fs-sheet-body textarea{width:100%;min-height:110px;resize:vertical;border:1px solid var(--fs-line);background:var(--fs-bg, transparent);color:inherit;border-radius:9px;padding:7px 9px;font:inherit;font-size:12.5px;line-height:1.6}
      .fs-sheet-body textarea:focus{outline:none;border-color:var(--fs-brand);box-shadow:0 0 0 3px var(--fs-brand-ring)}
      .fs-select,.fs-sheet select{border:1px solid var(--fs-line);background:var(--fs-bg, transparent);color:inherit;border-radius:8px;font:inherit;font-size:11.5px;padding:4px 6px}
      .fs-doc-go{display:none}`;

    let bridgeOrigin = '';

    async function bridge(pathname, options = {}) {
      if (!bridgeOrigin) throw new Error('本地桥还没找到');
      const response = await fetch(bridgeOrigin + '/feishu-panel' + pathname, {
        ...options,
        headers: { 'content-type': 'application/json', ...(options.headers || {}) },
        signal: options.signal || AbortSignal.timeout(25000),
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        throw new Error(`桥返回了非 JSON（HTTP ${response.status}）`);
      }
      if (!response.ok) {
        const failure = new Error(data?.error || `请求失败（HTTP ${response.status}）`);
        // 桥会带上 code（例如 UNSAFE_OVERWRITE）和 risk，调用方据此走不同的提示
        failure.code = data?.code || '';
        failure.risk = data?.risk || null;
        failure.revision = data?.revision || null;
        failure.status = response.status;
        throw failure;
      }
      return data;
    }

    async function findBridge() {
      for (let offset = 0; offset < PORT_COUNT; offset += 1) {
        const origin = `http://127.0.0.1:${PORT_START + offset}`;
        try {
          const response = await fetch(`${origin}/feishu-panel/status`, { signal: AbortSignal.timeout(1200) });
          if (!response.ok) continue;
          bridgeOrigin = origin;
          return await response.json();
        } catch {
          /* 下一个端口 */
        }
      }
      bridgeOrigin = '';
      return null;
    }

    function formatTime(value) {
      if (!value) return '';
      const date = new Date(Number(value));
      if (Number.isNaN(date.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function relativeTime(seconds) {
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

    // 飞书 emotion 节点带的 emoji_type（大写英文）→ Unicode。
    // 没收录的回退成 [TYPE] 原文，至少能看出是哪个表情。
    const EMOJI_BY_TYPE = {
      SMILE: '🙂', GRIN: '😁', LAUGH: '😂', JOY: '😄', BLUSH: '😊', WINK: '😉',
      CRY: '😢', SOB: '😭', ANGRY: '😠', RAGE: '😡', SHOCK: '😱', SCREAM: '😨',
      THINK: '🤔', SLEEP: '😴', SLEEPY: '🥱', DROOL: '🤤', SPEECHLESS: '😶',
      FACEPALM: '🤦', SIGH: '😮‍💨', YAWN: '🥱', SICK: '🤢', DIZZY: '😵',
      SWEAT: '😅', GRIMACE: '😬', SMIRK: '😏', RELIEVED: '😌', CONFUSED: '😕',
      THUMBSUP: '👍', THUMBSDOWN: '👎', OK: '👌', YES: '✌️', NO: '🙅',
      CLAP: '👏', PRAY: '🙏', HANDSHAKE: '🤝', MUSCLE: '💪', FIST: '✊',
      POINT_UP: '☝️', WAVE: '👋', HUG: '🤗', KISS: '😘',
      HEART: '❤️', BROKEN_HEART: '💔', TWO_HEARTS: '💕', SPARK_HEART: '💖',
      FIRE: '🔥', PARTY: '🎉', GIFT: '🎁', COFFEE: '☕', BEER: '🍺', CAKE: '🎂',
      ROSE: '🌹', MONEY: '💰', RED_PACKET: '🧧', STAR: '⭐', SUN: '☀️', MOON: '🌙',
      LIGHTNING: '⚡', CHECK: '✅', CROSS: '❌', QUESTION: '❓', EXCLAMATION: '❗',
      WARNING: '⚠️', HOURGLASS: '⏳', CLOCK: '🕐', DOG: '🐶', CAT: '🐱', PIG: '🐷',
    };

    const FEISHU_EMOJI = {
      笑哭: '😂', 破涕为笑: '😭', 微笑: '🙂', 偷笑: '🤭', 允悲: '😔', 汗: '😅', 尴尬: '😅',
      打脸: '🫠', 捂脸: '🤦', 白眼: '🙄', 骷髅: '💀', 拥抱: '🤗', 亲亲: '😘', 可怜: '🥺',
      强: '👍', 赞: '👍', 鼓掌: '👏', 握手: '🤝', 加油: '💪', 拳头: '✊', ok: '👌',
      玫瑰: '🌹', 心: '❤️', 爱心: '❤️', 心碎: '💔', 烟花: '🎉', 庆祝: '🥳', 礼物: '🎁',
      咖啡: '☕', 蛋糕: '🎂', 啤酒: '🍺', 干杯: '🥂', 钱: '💰', 红包: '🧧', 火: '🔥',
      狗头: '🐶', 猫: '🐱', 猪头: '🐷', 太阳: '☀️', 月亮: '🌙', 星星: '⭐', 闪电: '⚡',
      问号: '❓', 感叹号: '❗', 对号: '✅', 叉: '❌', 警告: '⚠️', 沙漏: '⏳', 时钟: '🕐',
      // 英文 emoji_type 一起并进来，纯文本里的 [SMILE] 也能转
      ...EMOJI_BY_TYPE,
    };

    function renderEmojiText(value) {
      const source = String(value ?? '');
      if (!source) return '';
      const nodes = [];
      // 上限放到 20：BROKEN_HEART、SPARK_HEART 这类长名字才装得下
      const regex = /\[([^\[\]]{1,20})\]/g;
      let last = 0;
      let match;
      let index = 0;
      while ((match = regex.exec(source))) {
        const mapped = FEISHU_EMOJI[match[1]] || FEISHU_EMOJI[String(match[1]).toUpperCase()];
        if (!mapped) continue;
        if (match.index > last) nodes.push(source.slice(last, match.index));
        nodes.push(h('span', { key: 'emoji-' + index, className: 'fs-emoji', title: match[1] }, mapped));
        index += 1;
        last = match.index + match[0].length;
      }
      if (last < source.length) nodes.push(source.slice(last));
      return nodes.length ? nodes : source;
    }

    function blocksToMarkdown(blocks) {
      return blocks
        .map((block) => {
          const value = String(block.text ?? '');
          if (block.type === 'h1') return '# ' + value;
          if (block.type === 'h2') return '## ' + value;
          if (block.type === 'h3') return '### ' + value;
          if (block.type === 'bullet') return '- ' + value;
          if (block.type === 'ordered') return '1. ' + value;
          if (block.type === 'code') return '\u0060\u0060\u0060\n' + value + '\n\u0060\u0060\u0060';
          return value;
        })
        .join('\n');
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

    const FONT_CHOICES = [
      { id: 'sans', label: '系统', stack: '-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif' },
      { id: 'serif', label: '宋体', stack: 'Georgia,"Songti SC","SimSun","Noto Serif SC",serif' },
      { id: 'kai', label: '楷体', stack: '"Kaiti SC","KaiTi","STKaiti",serif' },
      { id: 'round', label: '圆体', stack: '"Yuanti SC","HYQiHei","Microsoft YaHei",system-ui,sans-serif' },
      { id: 'mono', label: '等宽', stack: 'ui-monospace,SFMono-Regular,Menlo,Consolas,"Courier New",monospace' },
    ];
    const SIZE_CHOICES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24];

    /** 本地字体存 IndexedDB（localStorage 装不下字体文件）。 */
    const FontStore = {
      open() {
        return new Promise((resolve, reject) => {
          if (!window.indexedDB) return reject(new Error('no indexedDB'));
          const req = window.indexedDB.open('feishu-panel-fonts', 1);
          req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains('fonts')) req.result.createObjectStore('fonts');
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      },
      async put(name, buffer) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fonts', 'readwrite');
          tx.objectStore('fonts').put(buffer, name);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      },
      async all() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fonts', 'readonly');
          const store = tx.objectStore('fonts');
          const keys = store.getAllKeys();
          const vals = store.getAll();
          tx.oncomplete = () => resolve((keys.result || []).map((k, i) => ({ name: String(k), buffer: vals.result[i] })));
          tx.onerror = () => reject(tx.error);
        });
      },
      async remove(name) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
          const tx = db.transaction('fonts', 'readwrite');
          tx.objectStore('fonts').delete(name);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      },
    };

    async function registerFontFace(name, buffer) {
      const face = new window.FontFace(name, buffer);
      await face.load();
      window.document.fonts.add(face);
      return face;
    }
    const TYPE_KEY = 'feishu-panel:type';
    const DEFAULT_TYPE = { font: 'sans', size: 13 };
    // 斜杠菜单的固定项：只列编辑器真正能存回去的块类型，
    // 待办/引用/表格这些飞书有、这里写不回去，就不放进来误导人。
    const SLASH_ITEMS = [
      { id: 'p', label: '正文', hint: '普通段落' },
      { id: 'h1', label: '标题 1', hint: '大标题' },
      { id: 'h2', label: '标题 2', hint: '小标题' },
      { id: 'h3', label: '标题 3', hint: '更小的标题' },
      { id: 'bullet', label: '无序列表', hint: '• 圆点' },
      { id: 'ordered', label: '有序列表', hint: '1. 2. 3.' },
      { id: 'code', label: '代码块', hint: '等宽字体' },
    ];

    function BlockEditor(props) {
      const identity = props.identity || 'user';
      const { blocks, onSave, onBack, busy, notice, docId, backLabel } = props;
      const refs = useRef(new Map());
      const focusKey = useRef(null);
      // 输入法组合状态：中文选词时按回车/空格不能触发分段和 Markdown 转换
      const composingRef = useRef(false);
      // 所有改动都从这里出去，顺手把「未保存」标上
      const onChange = useCallback(
        (next) => {
          props.onChange(next);
          if (props.onDirtyChange) props.onDirtyChange(true);
        },
        [props.onChange, props.onDirtyChange]
      );
      const [menu, setMenu] = useState(null);
      const [collapsed, setCollapsed] = useState(() => new Set());
      const [outlineOpen, setOutlineOpen] = useState(false);
      const [typeOpen, setTypeOpen] = useState(false);
      // 斜杠菜单（必须在引用它的 effect 之前声明，否则撞 TDZ）
      const [slashMenu, setSlashMenu] = useState(null); // { index, x, y }
      const [slashIndex, setSlashIndex] = useState(0);
      // 块拖拽：from 是被拖的原始下标，over/before 决定落点线画在哪。
      // 起点另存一份 ref：合成拖拽事件可能在同一次渲染里连发，state 追不上。
      const [dragState, setDragState] = useState(null);
      const dragFromRef = useRef(null);
      const typeSet = props.typeSet || DEFAULT_TYPE;
      // 打开大纲时顺手收起左边的文件列表，窄面板里正文才不会被挤没
      const toggleOutline = () => {
        const next = !outlineOpen;
        setOutlineOpen(next);
        if (next) setTypeOpen(false);
        if (props.onOutlineToggle) props.onOutlineToggle(next);
      };
      const toggleType = () => {
        const next = !typeOpen;
        setTypeOpen(next);
        if (next) setOutlineOpen(false);
        if (next) setFindOpen(false);
      };

      const levelOf = (type) => (type === 'h1' ? 1 : type === 'h2' ? 2 : type === 'h3' ? 3 : 0);
      // 折叠后的隐藏集合。注意打字时 blocks 就是新数组，这里照样会重算；
      // 它省掉的是「只动了折叠状态或别的无关 state」时的那一次全量扫描。
      const hidden = useMemo(() => {
        const set = new Set();
        let collapsedLevel = 0;
        for (const block of blocks) {
          const level = levelOf(block.type);
          if (collapsedLevel && level > 0 && level <= collapsedLevel) collapsedLevel = 0;
          if (collapsedLevel && level === 0) {
            set.add(block.key);
            continue;
          }
          if (level > 0 && collapsed.has(block.key)) collapsedLevel = level;
        }
        return set;
      }, [blocks, collapsed]);
      const outline = useMemo(() => blocks.map((block, index) => ({ block, index })).filter(({ block }) => levelOf(block.type) > 0), [blocks]);
      // 可见行 + 各自在原数组里的位置。原来在 map 里 indexOf，段数一多就是平方复杂度
      const visibleBlocks = useMemo(() => {
        const rows = [];
        blocks.forEach((block, index) => {
          if (!hidden.has(block.key)) rows.push({ block, index });
        });
        return rows;
      }, [blocks, hidden]);
      // 有序列表序号：连续的同级 ordered 块依次 1、2、3…
      // 原来 CSS 里写死成 "1."，每一项都显示 1，读起来像全是第一项。
      const ordinals = useMemo(() => {
        const map = new Map();
        let counter = 0;
        for (const block of blocks) {
          if (block.type === 'ordered') {
            counter += 1;
            map.set(block.key, counter);
          } else {
            counter = 0;
          }
        }
        return map;
      }, [blocks]);
      const toggleCollapse = (key) => {
        const next = new Set(collapsed);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setCollapsed(next);
      };
      const jumpTo = (key) => {
        const node = refs.current.get(key);
        if (node && node.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setOutlineOpen(false);
      };

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

      // Ctrl+F / ⌘F 直接叫出查找框
      useEffect(() => {
        const onKey = (event) => {
          if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'f') {
            event.preventDefault();
            setFindOpen(true);
            setTypeOpen(false);
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, []);

      // 斜杠菜单的键盘导航：↑↓ 选、回车确认、Esc 取消。
      // 用捕获阶段拦，免得 contentEditable 先吃掉回车。
      useEffect(() => {
        if (!slashMenu) return undefined;
        const onKey = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setSlashMenu(null);
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            setSlashIndex((prev) => (prev + 1) % SLASH_ITEMS.length);
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            setSlashIndex((prev) => (prev - 1 + SLASH_ITEMS.length) % SLASH_ITEMS.length);
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            const item = SLASH_ITEMS[slashIndex];
            const target = slashMenu.index;
            setSlashMenu(null);
            if (item) applyMenu(item.id, target);
            return;
          }
          if (event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            setSlashMenu(null);
          }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
      }, [slashMenu, slashIndex, blocks]);

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
      };

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

      // Ctrl+S / ⌘S：底部提示写了就真让它生效（原来只挂在会话输入框上，文档页根本没有）
      useEffect(() => {
        const onKey = (event) => {
          if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 's') {
            event.preventDefault();
            if (!props.busy) props.onSave();
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [props.busy, props.onSave]);

      const handleKeyDown = (event, index) => {
        // 输入法还在组合中（拼音/五笔没上屏）：回车是选词、空格是候选词分隔，
        // 都不该被当成「分段」或「# 变标题」，否则选词一回车就多切出一段。
        if (composingRef.current || event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229) return;
        const block = blocks[index];
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          // 空块里敲 ``` 再回车 = 代码块，别真分成两段
          const rawText = String(event.currentTarget.textContent || '');
          if (/^```$/.test(rawText) && block.type !== 'code') {
            const node = refs.current.get(block.key);
            if (node) node.textContent = '';
            onChange(blocks.map((row) => (row.key === block.key ? { ...row, type: 'code', text: '' } : row)));
            focusKey.current = block.key;
            return;
          }
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
        // 上下方向键跨块：光标已经在该块首/尾时跳到相邻可编辑块，
        // 写作时不用再去点鼠标。图片这类没有编辑区的块自动跳过。
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          const text = String(block.text || '');
          const caret = caretOffset(event.currentTarget);
          const wantNext = event.key === 'ArrowDown';
          const atEdge = wantNext ? caret >= text.length : caret <= 0;
          if (atEdge) {
            const step = wantNext ? 1 : -1;
            let cursor = index + step;
            let target = null;
            let targetKey = '';
            while (cursor >= 0 && cursor < blocks.length) {
              const node = refs.current.get(blocks[cursor].key);
              if (node) {
                target = node;
                targetKey = blocks[cursor].key;
                break;
              }
              cursor += step;
            }
            if (target) {
              event.preventDefault();
              target.focus();
              const range = document.createRange();
              range.selectNodeContents(target);
              // 向下 → 落到下一块开头；向上 → 落到上一块末尾
              range.collapse(!wantNext);
              const selection = window.getSelection();
              selection.removeAllRanges();
              selection.addRange(range);
              refs.current.set(targetKey, target);
            }
          }
          return;
        }
        // 空块里按 / 唤起块菜单（飞书式）。有内容时不抢，免得打断正常输入。
        if (event.key === '/' && !String(block.text || '').trim()) {
          event.preventDefault();
          const node = refs.current.get(block.key);
          const rect = node ? node.getBoundingClientRect() : null;
          setSlashMenu({ index, x: rect ? rect.left : 40, y: rect ? rect.bottom + 6 : 120 });
          setSlashIndex(0);
          return;
        }
        if (event.key === ' ') {
          const raw = String(event.currentTarget.textContent || '');
          const heading = /^(#{1,3})$/.exec(raw);
          const bullet = /^[-*+]$/.exec(raw);
          const ordered = /^\d+\.$/.exec(raw);
          const fence = /^```$/.exec(raw);
          if (heading || bullet || ordered || fence) {
            event.preventDefault();
            const node = refs.current.get(block.key);
            if (node) node.textContent = '';
            const nextType = heading ? 'h' + heading[1].length : bullet ? 'bullet' : ordered ? 'ordered' : 'code';
            onChange(blocks.map((row) => (row.key === block.key ? { ...row, type: nextType, text: '' } : row)));
            focusKey.current = block.key;
          }
        }
      };

      const totalChars = useMemo(() => blocks.reduce((sum, block) => sum + String(block.text || '').length, 0), [blocks]);

      /** 把第 from 块挪到第 to 块的前面/后面。下标要先摘再插，注意补偿。 */
      const moveBlock = (from, to, before) => {
        if (from === to) return;
        const next = blocks.slice();
        const [moved] = next.splice(from, 1);
        let insertAt = before ? to : to + 1;
        if (from < insertAt) insertAt -= 1;
        if (insertAt < 0) insertAt = 0;
        next.splice(insertAt, 0, moved);
        onChange(next);
      };

      // ── 文档内查找 / 替换 ──────────────────────────────────────────────
      const [findOpen, setFindOpen] = useState(false);
      const [findQ, setFindQ] = useState('');
      const [replaceQ, setReplaceQ] = useState('');
      const [findIndex, setFindIndex] = useState(0);
      const [findNote, setFindNote] = useState('');
      // 程序改动过正文的块要强制回填，否则 contentEditable 里还是旧文字
      const forcedRef = useRef(new Set());

      const hits = useMemo(() => {
        const needle = findQ.trim();
        if (!needle) return [];
        const list = [];
        blocks.forEach((block, index) => {
          if (String(block.text || '').includes(needle)) list.push({ key: block.key, index });
        });
        return list;
      }, [blocks, findQ]);

      const gotoHit = (step) => {
        if (!hits.length) return;
        const next = (findIndex + step + hits.length) % hits.length;
        setFindIndex(next);
        const node = refs.current.get(hits[next].key);
        if (node && node.scrollIntoView) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };

      const replaceAll = () => {
        const needle = findQ.trim();
        if (!needle) return;
        let count = 0;
        const next = blocks.map((block) => {
          const text = String(block.text || '');
          if (!text.includes(needle)) return block;
          count += text.split(needle).length - 1;
          forcedRef.current.add(block.key);
          return { ...block, text: text.split(needle).join(replaceQ) };
        });
        if (!count) {
          setFindNote('没找到可替换的内容');
          return;
        }
        onChange(next);
        setFindNote('已替换 ' + count + ' 处');
      };

      return h(
        'div',
        { className: 'fs-doc-wrap' },
        h(
          'div',
          { className: 'fs-doc-head' },
          h(
            'button',
            {
              className: 'fs-btn',
              type: 'button',
              onClick: () => {
                // 有未保存改动时先拦一下，别让人手滑丢稿
                if (props.dirty && !window.confirm('这篇文档还有没保存的修改，返回会丢掉。要继续吗？')) return;
                if (props.onDirtyChange) props.onDirtyChange(false);
                onBack();
              },
            },
            backLabel || '← 列表'
          ),
          h(
            'button',
            {
              className: 'fs-btn fs-type-btn',
              type: 'button',
              'data-active': typeOpen,
              title: '字体与字号',
              onClick: toggleType,
            },
            'Aa'
          ),
          h(
            'button',
            {
              className: 'fs-btn fs-outline-toggle',
              type: 'button',
              'data-active': outlineOpen,
              title: outlineOpen ? '收起大纲' : '展开大纲',
              onClick: toggleOutline,
            },
            '大纲'
          ),
          h(
            'button',
            {
              className: 'fs-btn',
              type: 'button',
              'data-active': findOpen,
              title: '查找 / 替换（Ctrl+F）',
              onClick: () => {
                const next = !findOpen;
                setFindOpen(next);
                if (next) {
                  setTypeOpen(false);
                } else {
                  setFindQ('');
                  setFindNote('');
                }
              },
            },
            '⌕'
          ),
          h('span', { className: 'fs-status' }, notice || (props.dirty ? '未保存' : '')),
          props.docMeta && (props.docMeta.unsupported > 0 || props.docMeta.styled > 0)
            ? h(
                'span',
                {
                  className: 'fs-chip fs-chip-warn',
                  title: [
                    props.docMeta.unsupported ? props.docMeta.unsupported + ' 个块编辑器读不全（表格/待办/引用等）' : '',
                    props.docMeta.styled ? props.docMeta.styled + ' 个块带加粗/链接等行内样式' : '',
                    '保存会被拦住，不会覆盖你的文档',
                  ]
                    .filter(Boolean)
                    .join('；'),
                },
                '⚠' + (Number(props.docMeta.unsupported || 0) + Number(props.docMeta.styled || 0))
              )
            : null,
          h(
            'button',
            {
              className: 'fs-btn fs-save',
              type: 'button',
              'data-primary': 'true',
              'data-dirty': props.dirty ? 'true' : undefined,
              disabled: busy,
              onClick: onSave,
            },
            '保存'
          )
        ),
        typeOpen
          ? h(
              'div',
              { className: 'fs-type-panel', onMouseDown: (event) => event.stopPropagation() },
              h('div', { className: 'fs-type-label' }, '字体'),
              h(
                'div',
                { className: 'fs-type-grid fs-type-grid-fonts' },
                FONT_CHOICES.map((choice) =>
                  h(
                    'button',
                    {
                      key: choice.id,
                      type: 'button',
                      className: 'fs-type-opt',
                      'data-active': typeSet.font === choice.id,
                      style: { fontFamily: choice.stack },
                      onClick: () => props.onTypeChange && props.onTypeChange({ ...typeSet, font: choice.id }),
                    },
                    choice.label
                  )
                ),
                (props.customFonts || []).map((name) =>
                  h(
                    'div',
                    { key: 'c-' + name, className: 'fs-type-custom' },
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'fs-type-opt',
                        'data-active': typeSet.font === name,
                        title: name,
                        style: { fontFamily: '"' + name + '", system-ui, sans-serif' },
                        onClick: () => props.onTypeChange && props.onTypeChange({ ...typeSet, font: name }),
                      },
                      name.length > 6 ? name.slice(0, 6) + '…' : name
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'fs-type-del',
                        title: '移除这个字体',
                        onClick: () => props.onRemoveFont && props.onRemoveFont(name),
                      },
                      '×'
                    )
                  )
                ),
                h(
                  'label',
                  { className: 'fs-type-opt fs-type-import', title: '导入本地字体（ttf / otf / woff / woff2）' },
                  '＋ 导入',
                  h('input', {
                    type: 'file',
                    accept: '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2',
                    style: { display: 'none' },
                    onChange: (event) => {
                      const picked = event.currentTarget.files && event.currentTarget.files[0];
                      if (picked && props.onImportFont) props.onImportFont(picked);
                      event.currentTarget.value = '';
                    },
                  })
                )
              ),
              h('div', { className: 'fs-type-label' }, '字号'),
              h(
                'div',
                { className: 'fs-type-grid fs-type-grid-sizes' },
                SIZE_CHOICES.map((size) =>
                  h(
                    'button',
                    {
                      key: size,
                      type: 'button',
                      className: 'fs-type-opt',
                      'data-active': Number(typeSet.size) === size,
                      onClick: () => props.onTypeChange && props.onTypeChange({ ...typeSet, size }),
                    },
                    size + 'px'
                  )
                )
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'fs-type-reset',
                  onClick: () => props.onTypeChange && props.onTypeChange({ ...DEFAULT_TYPE }),
                },
                '恢复默认'
              )
            )
          : null,
        findOpen
          ? h(
              'div',
              { className: 'fs-find-panel', onMouseDown: (event) => event.stopPropagation() },
              h('input', {
                className: 'fs-find-input',
                placeholder: '查找…',
                value: findQ,
                autoFocus: true,
                onChange: (event) => {
                  setFindQ(event.target.value);
                  setFindIndex(0);
                  setFindNote('');
                },
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    gotoHit(event.shiftKey ? -1 : 1);
                  }
                  if (event.key === 'Escape') setFindOpen(false);
                },
              }),
              h(
                'div',
                { className: 'fs-find-row' },
                h('span', { className: 'fs-find-count' }, findQ.trim() ? (hits.length ? findIndex + 1 + ' / ' + hits.length : '没有命中') : ' '),
                h('button', { className: 'fs-icon-btn', type: 'button', title: '上一个（Shift+Enter）', disabled: !hits.length, onClick: () => gotoHit(-1) }, '↑'),
                h('button', { className: 'fs-icon-btn', type: 'button', title: '下一个（Enter）', disabled: !hits.length, onClick: () => gotoHit(1) }, '↓')
              ),
              h('input', {
                className: 'fs-find-input',
                placeholder: '替换成…（留空＝删除）',
                value: replaceQ,
                onChange: (event) => setReplaceQ(event.target.value),
              }),
              h(
                'div',
                { className: 'fs-find-row' },
                h('span', { className: 'fs-find-note' }, findNote),
                h('button', { className: 'fs-btn', type: 'button', disabled: !hits.length, onClick: replaceAll }, '全部替换')
              )
            )
          : null,
          h(
            'div',
            { className: 'fs-doc-main', 'data-outline': outlineOpen },
            h(
              'div',
              { className: 'fs-doc-body' },
              visibleBlocks.map(({ block, index }) => {
                // 编辑器读不懂的块：只展示类型名，不给编辑区。
                // 这样它不会被当成空段落覆盖掉，保存时桥那边也会整体拦住。
                if (block.supported === false) {
                  return h(
                    'div',
                    {
                      key: block.key,
                      className: 'fs-block fs-block-locked',
                      'data-type': 'locked',
                      title: '这一类块编辑器改不了：可以看，但保存会被拦住，不会动它',
                    },
                    h('span', { className: 'fs-gutter' }, '锁'),
                    h(
                      'div',
                      { className: 'fs-block-locked-body' },
                      h('span', { className: 'fs-block-locked-kind' }, block.kind || '其它块'),
                      h('span', { className: 'fs-block-locked-note' }, '要在飞书里编辑')
                    )
                  );
                }
                return h(
              'div',
              {
                key: block.key,
                className: 'fs-block',
                'data-type': block.type,
                'data-rich': block.rich ? 'true' : undefined,
                'data-drop': dragState && dragState.over === index ? (dragState.before ? 'before' : 'after') : undefined,
                'data-dragging': dragState && dragState.from === index ? 'true' : undefined,
                onContextMenu: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setMenu({ x: event.clientX, y: event.clientY, index });
                },
                onDragOver: (event) => {
                  if (dragFromRef.current === null) return;
                  if (dragFromRef.current === index) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  const rect = event.currentTarget.getBoundingClientRect();
                  const before = event.clientY < rect.top + rect.height / 2;
                  setDragState((prev) => (prev && prev.over === index && prev.before === before ? prev : { from: dragFromRef.current, over: index, before }));
                },
                onDrop: (event) => {
                  if (dragFromRef.current === null) return;
                  event.preventDefault();
                  const from = dragFromRef.current;
                  const overIndex = index;
                  const rect = event.currentTarget.getBoundingClientRect();
                  const before = event.clientY < rect.top + rect.height / 2;
                  dragFromRef.current = null;
                  setDragState(null);
                  moveBlock(from, overIndex, before);
                },
                onDragEnd: () => {
                  dragFromRef.current = null;
                  setDragState(null);
                },
              },
              h(
                'span',
                {
                  className: 'fs-gutter',
                  draggable: true,
                  title: '按住拖动调整位置',
                  onDragStart: (event) => {
                    // 只把下标塞进 dataTransfer 里，具体移动放在 drop 时算
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', String(index));
                    dragFromRef.current = index;
                    setDragState({ from: index, over: null, before: true });
                  },
                },
                BLOCK_LABEL[block.type] || '¶'
              ),
              levelOf(block.type) > 0
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'fs-collapse',
                      title: collapsed.has(block.key) ? '展开' : '收起',
                      onClick: (event) => {
                        event.stopPropagation();
                        toggleCollapse(block.key);
                      },
                    },
                    collapsed.has(block.key) ? '▸' : '▾'
                  )
                : null,
              block.type === 'image'
                ? h('img', {
                    className: 'fs-doc-img',
                    alt: '图片',
                    src: bridgeOrigin + '/feishu-panel/mediaDoc?token=' + encodeURIComponent(block.token || '') + '&identity=' + identity,
                    onError: (event) => {
                      event.currentTarget.style.display = 'none';
                    },
                  })
                : h('div', {
                className: 'fs-block-text',
                contentEditable: true,
                suppressContentEditableWarning: true,
                spellCheck: false,
                'data-ordinal': block.type === 'ordered' ? ordinals.get(block.key) || 1 : undefined,
                'data-empty': String(!block.text),
                'data-placeholder': block.type === 'h1' ? '大标题' : block.type === 'h2' ? '小标题' : block.type === 'bullet' ? '列表项' : block.type === 'code' ? '代码' : '',
                // 输入法组合状态要显式跟踪：compositionend 之后紧跟的那次
                // keydown 仍属于输入法，光看 event.isComposing 在部分输入法上不够
                onCompositionStart: () => {
                  composingRef.current = true;
                },
                onCompositionEnd: () => {
                  setTimeout(() => {
                    composingRef.current = false;
                  }, 0);
                },
                ref: (node) => {
                  if (!node) {
                    refs.current.delete(block.key);
                    return;
                  }
                  refs.current.set(block.key, node);
                  const forced = forcedRef.current.has(block.key);
                  if (forced) forcedRef.current.delete(block.key);
                  if (forced || node.dataset.filled !== block.key) {
                    node.textContent = block.text;
                    node.dataset.filled = block.key;
                  }
                },
                onInput: (event) => setText(block.key, event.currentTarget.textContent || ''),
                onKeyDown: (event) => handleKeyDown(event, index),
                onPaste: (event) => {
                  const clipboard = event.clipboardData;
                  if (!clipboard) return;
                  const pasted = clipboard.getData('text/plain') || '';
                  // 图片之类没有纯文本，交给浏览器默认处理
                  if (!pasted) return;
                  // 一律只取纯文本：从网页 / Word / 飞书粘进来会带一堆行内标签和样式，
                  // 混进 contentEditable 之后保存出去就是脏数据
                  event.preventDefault();
                  const lines = pasted.split(/\r?\n/);
                  if (lines.length <= 1) {
                    document.execCommand('insertText', false, pasted);
                    return;
                  }
                  // 多段：第一段接到当前块，后面的按行拆成新段落
                  const rest = lines.slice(1).map((line) => line.trim()).filter(Boolean);
                  const existing = String(block.text || '');
                  const next = blocks.slice();
                  next[index] = { ...block, text: existing ? existing + lines[0] : lines[0] };
                  if (rest.length) {
                    const extra = rest.map((line, i) => ({
                      key: 'blk-' + Date.now() + '-paste-' + index + '-' + i,
                      type: 'p',
                      text: line,
                    }));
                    next.splice(index + 1, 0, ...extra);
                  }
                  onChange(next);
                },
              })
                );
              }),
          slashMenu
            ? h(
                'div',
                {
                  className: 'fs-slash',
                  style: {
                    left: Math.min(slashMenu.x, (window.innerWidth || 800) - 200) + 'px',
                    top: Math.min(slashMenu.y, (window.innerHeight || 800) - 300) + 'px',
                  },
                  role: 'menu',
                  'aria-label': '插入块',
                  onMouseDown: (event) => event.preventDefault(),
                },
                h('div', { className: 'fs-slash-title' }, '插入块'),
                SLASH_ITEMS.map((item, i) =>
                  h(
                    'button',
                    {
                      key: item.id,
                      type: 'button',
                      className: 'fs-slash-item',
                      'data-active': i === slashIndex ? 'true' : undefined,
                      role: 'menuitem',
                      onMouseEnter: () => setSlashIndex(i),
                      onClick: () => {
                        const target = slashMenu.index;
                        setSlashMenu(null);
                        applyMenu(item.id, target);
                      },
                    },
                    h('span', { className: 'fs-slash-label' }, item.label),
                    h('span', { className: 'fs-slash-hint' }, item.hint)
                  )
                )
              )
            : null,
          menu
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
                  ['code', '代码块', '```'],
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
            h('span', { className: 'fs-chip' }, totalChars + ' 字 · ' + blocks.length + ' 段'),
            h('span', { className: 'fs-status' }, '回车分段 · 行首 # 变标题 · Ctrl+S 保存')
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
                { type: 'button', className: 'fs-icon-btn', title: '收起大纲', onClick: toggleOutline },
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
    }

    /** 面板渲染出错时别白屏，把错误打到界面上，方便定位。 */
    class PaneBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { err: null };
      }
      static getDerivedStateFromError(err) {
        return { err };
      }
      componentDidCatch(err) {
        try {
          console.error('[feishu-panel]', err);
        } catch {
          /* ignore */
        }
      }
      render() {
        if (this.state.err) {
          return React.createElement(
            'div',
            { className: 'fs-root', style: { padding: '14px', fontSize: '12px', lineHeight: 1.6, color: '#c0392b', whiteSpace: 'pre-wrap', overflow: 'auto' } },
            '飞书面板渲染出错：\n\n' + String((this.state.err && this.state.err.stack) || this.state.err)
          );
        }
        return this.props.children;
      }
    }

    // 三个列表行。memo 用自定义比较：桥每次返回的都是新对象，浅比较永远不等，
    // 比的是真正决定画面的字段。父组件的数组比对也用 sameMessage，两层标准必须一致，
    // 否则父层判「没变」时子组件根本收不到新 props。
    const sameMessage = (a, b) =>
      Boolean(a && b) &&
      a.id === b.id &&
      a.text === b.text &&
      a.time === b.time &&
      a.senderType === b.senderType &&
      a.imageKey === b.imageKey &&
      a.fileKey === b.fileKey &&
      (a.segments ? a.segments.length : 0) === (b.segments ? b.segments.length : 0) &&
      (a.media ? String(a.media.fileKey || '') : '') === (b.media ? String(b.media.fileKey || '') : '');

    const ChatRow = memo(
      function ChatRow({ chat, active, onPick }) {
        return h(
          'div',
          { className: 'fs-row', 'data-active': active, onClick: () => onPick(chat.chatId) },
          h('div', { className: 'fs-avatar' }, (chat.name || '群').slice(0, 1)),
          h(
            'div',
            { className: 'fs-row-body' },
            h('div', { className: 'fs-row-name' }, chat.name || chat.chatId),
            h('div', { className: 'fs-row-sub' }, chat.description || '群会话')
          )
        );
      },
      (a, b) => a.chat.chatId === b.chat.chatId && a.chat.name === b.chat.name && a.chat.description === b.chat.description && a.active === b.active
    );

    /** 文件大小：1.2 MB 这种。 */
    function formatSize(bytes) {
      const value = Number(bytes) || 0;
      if (value <= 0) return '';
      if (value < 1024) return value + ' B';
      if (value < 1024 * 1024) return (value / 1024).toFixed(1) + ' KB';
      return (value / 1024 / 1024).toFixed(1) + ' MB';
    }

    /** 富文本片段：链接可点、@人高亮、代码用等宽、表情保留标记。 */
    function renderSegments(message) {
      const segments = Array.isArray(message.segments) ? message.segments : null;
      if (!segments || !segments.length) return h('div', null, renderEmojiText(message.text || ''));
      return h(
        'div',
        { className: 'fs-segs' },
        segments.map((seg, i) => {
          if (!seg) return null;
          if (seg.kind === 'link' && seg.href) {
            return h(
              'a',
              { key: i, className: 'fs-seg-link', href: seg.href, target: '_blank', rel: 'noreferrer noopener' },
              seg.text || seg.href
            );
          }
          if (seg.kind === 'mention') return h('span', { key: i, className: 'fs-seg-mention' }, seg.text || '@');
          if (seg.kind === 'code') return h('code', { key: i, className: 'fs-seg-code' }, seg.text || '');
          if (seg.kind === 'image') return h('span', { key: i, className: 'fs-seg-img' }, '[图片]');
          if (seg.kind === 'emoji') {
            // emoji_type 是英文大写（SMILE / THUMBSUP…），转成真表情
            const glyph = EMOJI_BY_TYPE[String(seg.emojiType || '').toUpperCase()] || null;
            const label = seg.emojiType || seg.text || '';
            return h('span', { key: i, className: glyph ? 'fs-seg-emoji' : 'fs-seg-emoji fs-seg-emoji-raw', title: label }, glyph || seg.text || '[表情]');
          }
          return h('span', { key: i }, seg.text || '');
        })
      );
    }

    const MsgRow = memo(
      function MsgRow({ message }) {
        const mine = message.senderType === 'app';
        const media = message.media || null;
        // 贴图（sticker）本质也是图片资源，走 /media?kind=image 就能显示出来
        const isImage = Boolean(message.imageKey) || (media && (media.kind === 'image' || media.kind === 'sticker'));
        const imageKey = message.imageKey || (media && media.fileKey) || '';
        const isFile = Boolean(media) && media.kind === 'file' && media.fileKey;
        return h(
          'div',
          { className: 'fs-msg-row', 'data-mine': mine },
          h(
            'div',
            { className: 'fs-bubble' },
            isImage && imageKey
              ? h('img', {
                  className: 'fs-img',
                  alt: message.text,
                  src:
                    bridgeOrigin +
                    '/feishu-panel/media?messageId=' +
                    encodeURIComponent(message.id) +
                    '&fileKey=' +
                    encodeURIComponent(imageKey) +
                    '&kind=image',
                  onError: (event) => {
                    event.currentTarget.style.display = 'none';
                  },
                })
              : isFile
                ? h(
                    'a',
                    {
                      className: 'fs-file-card',
                      href:
                        bridgeOrigin +
                        '/feishu-panel/messageFile?messageId=' +
                        encodeURIComponent(message.id) +
                        '&fileKey=' +
                        encodeURIComponent(media.fileKey) +
                        '&fileName=' +
                        encodeURIComponent(media.fileName || 'file.bin'),
                      target: '_blank',
                      rel: 'noreferrer noopener',
                      title: '点击下载',
                    },
                    h('span', { className: 'fs-file-icon' }, '📎'),
                    h('span', { className: 'fs-file-name' }, media.fileName || message.text || '文件'),
                    formatSize(media.size) ? h('span', { className: 'fs-file-size' }, formatSize(media.size)) : null
                  )
                : renderSegments(message),
            h('div', { className: 'fs-bubble-meta' }, `${mine ? '机器人' : '成员'} · ${formatTime(message.time)}`)
          )
        );
      },
      (a, b) => sameMessage(a.message, b.message)
    );

    const DocRow = memo(
      function DocRow({ entry, kind, active, onOpen, onMenu }) {
        return h(
          'div',
          {
            className: 'fs-drow',
            'data-kind': kind,
            'data-active': active,
            title: entry.name,
            onClick: () => onOpen(entry),
            onContextMenu: (event) => {
              event.preventDefault();
              event.stopPropagation();
              onMenu(entry, event);
            },
          },
          h('div', { className: 'fs-dicon', 'data-kind': kind }, kind === 'folder' ? '📁' : docTypeChar(entry.type)),
          h('div', { className: 'fs-dname' }, entry.name || '(未命名)')
        );
      },
      // kind 和 entry.type 决定图标和右键菜单，onOpen/onMenu 决定用哪个身份去请求，
      // 少比一个就会拿旧回调打开文档（切身份后最容易复现）
      (a, b) =>
        a.entry.token === b.entry.token &&
        a.entry.name === b.entry.name &&
        a.entry.type === b.entry.type &&
        a.kind === b.kind &&
        a.active === b.active &&
        a.onOpen === b.onOpen &&
        a.onMenu === b.onMenu
    );

    // ── 网页版面板 ─────────────────────────────────────────────────────
    // 必须定义在模块级：放进 FeishuPane 会每次渲染都产生新的组件类型，
    // React 会把 webview 当新组件卸载重挂，切个页签回来整页重新加载。
    const WEB_ENTRIES = [
      { id: 'msg', label: '消息', icon: '💬', url: 'https://my.feishu.cn/messenger/' },
      { id: 'doc', label: '云文档', icon: '📄', url: 'https://my.feishu.cn/drive/' },
      { id: 'base', label: '多维表格', icon: '🗂', url: 'https://my.feishu.cn/base/' },
      { id: 'cal', label: '日历', icon: '📅', url: 'https://my.feishu.cn/calendar/' },
      { id: 'wiki', label: '知识库', icon: '📚', url: 'https://my.feishu.cn/wiki/' },
      { id: 'appr', label: '审批', icon: '✅', url: 'https://my.feishu.cn/approval/' },
    ];
    const openExternal = (url) => {
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        /* 打不开就让用户复制链接 */
      }
    };

    /** webview 打不开时的退路：入口卡片。 */
    const webFallback = (reason) =>
      h(
        'div',
        { className: 'fs-web' },
        h(
          'div',
          { className: 'fs-web-head' },
          h('div', { className: 'fs-web-emoji' }, '🌐'),
          h('div', { className: 'fs-web-title' }, '飞书网页版'),
          h(
            'div',
            { className: 'fs-web-note' },
            (reason ? reason + '。' : '') + '点下面的入口在浏览器里打开；也可以用 DSH 右栏的「浏览器」标签直接访问 my.feishu.cn。'
          )
        ),
        h(
          'div',
          { className: 'fs-web-grid' },
          WEB_ENTRIES.map((entry) =>
            h(
              'button',
              { key: entry.id, type: 'button', className: 'fs-web-card', onClick: () => openExternal(entry.url) },
              h('span', { className: 'fs-web-card-icon' }, entry.icon),
              h('span', { className: 'fs-web-card-label' }, entry.label)
            )
          )
        ),
        h('button', { type: 'button', className: 'fs-btn fs-web-open', onClick: () => openExternal('https://my.feishu.cn/') }, '在浏览器打开飞书首页')
      );

    /** 内嵌浏览：Electron webview（独立进程，不受 X-Frame-Options / frame 检测限制）。 */
    class WebViewPane extends React.Component {
      constructor(props) {
        super(props);
        this.state = { url: 'https://my.feishu.cn/messenger/', failed: '', loading: true };
        this.ref = React.createRef();
      }
      componentDidMount() {
        const el = this.ref.current;
        if (!el || !el.addEventListener) {
          this.setState({ failed: '这个环境不支持内嵌浏览器' });
          return;
        }
        if (typeof el.getWebContentsId !== 'function') {
          this.setState({ failed: 'webview 没有初始化（宿主可能没开 webviewTag）' });
          return;
        }
        this.onFail = (event) => {
          // -3 是用户中止，不算失败
          if (event && event.errorCode === -3) return;
          this.setState({ failed: '网页加载失败（' + ((event && event.errorDescription) || 'unknown') + '）' });
        };
        this.onStop = () => this.setState({ loading: false });
        this.onNavigate = (event) => this.setState({ url: event.url || this.state.url, loading: false });
        this.onStart = () => this.setState({ loading: true });
        el.addEventListener('did-fail-load', this.onFail);
        el.addEventListener('did-stop-loading', this.onStop);
        el.addEventListener('did-navigate', this.onNavigate);
        el.addEventListener('did-start-loading', this.onStart);
      }
      componentWillUnmount() {
        const el = this.ref.current;
        if (!el || !this.onFail) return;
        el.removeEventListener('did-fail-load', this.onFail);
        el.removeEventListener('did-stop-loading', this.onStop);
        el.removeEventListener('did-navigate', this.onNavigate);
        el.removeEventListener('did-start-loading', this.onStart);
      }
      render() {
        if (this.state.failed) return webFallback(this.state.failed);
        const go = (url) => {
          this.setState({ url, loading: true });
          const el = this.ref.current;
          if (el && el.loadURL) el.loadURL(url);
          else if (el) el.setAttribute('src', url);
        };
        return h(
          'div',
          { className: 'fs-webview-wrap' },
          h(
            'div',
            { className: 'fs-webview-bar' },
            h(
              'button',
              { type: 'button', className: 'fs-icon-btn', title: '回到飞书首页', onClick: () => go('https://my.feishu.cn/messenger/') },
              '⌂'
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'fs-icon-btn',
                title: '刷新',
                onClick: () => {
                  const el = this.ref.current;
                  if (el && el.reload) el.reload();
                },
              },
              '⟳'
            ),
            h('span', { className: 'fs-webview-url', title: this.state.url }, this.state.loading ? '加载中… ' + this.state.url : this.state.url),
            h(
              'button',
              { type: 'button', className: 'fs-icon-btn', title: '在浏览器打开', onClick: () => openExternal(this.state.url) },
              '↗'
            )
          ),
          h('webview', {
            ref: this.ref,
            src: this.state.url,
            allowpopups: 'true',
            style: { flex: 1, width: '100%', minHeight: 0, border: 0, display: 'flex', background: '#fff' },
          })
        );
      }
    }

    function FeishuPane() {
      const [health, setHealth] = useState({ state: 'probing', text: '连接飞书…', bot: '' });
      const [tab, setTab] = useState('chats');
      // 进过一次「网页版」之后 webview 就常驻，切走只隐藏不卸载
      const [webMounted, setWebMounted] = useState(false);
      const [chats, setChats] = useState([]);
      const [chatId, setChatId] = useState('');
      const [messages, setMessages] = useState([]);
      const [docs, setDocs] = useState([]);
      const [folders, setFolders] = useState([]);
      const [folderPath, setFolderPath] = useState([{ token: '', name: '我的空间' }]);
      const [authInfo, setAuthInfo] = useState({ authorized: false, name: '' });
      const [listMenu, setListMenu] = useState(null);
      const [moveTarget, setMoveTarget] = useState(null);
      const [movePath, setMovePath] = useState([]);
      const [moveFolders, setMoveFolders] = useState([]);
      const [moveBusy, setMoveBusy] = useState(false);
      const [identity, setIdentity] = useState('user');
      const [typeSet, setTypeSet] = useState(() => {
        try {
          const raw = window.localStorage.getItem(TYPE_KEY);
          const parsed = raw ? JSON.parse(raw) : null;
          return parsed && parsed.font ? parsed : DEFAULT_TYPE;
        } catch {
          return DEFAULT_TYPE;
        }
      });
      const applyType = useCallback((next) => {
        setTypeSet(next);
        try {
          window.localStorage.setItem(TYPE_KEY, JSON.stringify(next));
        } catch {
          /* 存不了就算了，本次会话仍然生效 */
        }
      }, []);
      const [customFonts, setCustomFonts] = useState([]);
      useEffect(() => {
        let alive = true;
        (async () => {
          try {
            const list = await FontStore.all();
            const names = [];
            for (const item of list) {
              try {
                await registerFontFace(item.name, item.buffer);
                names.push(item.name);
              } catch {
                /* 单个字体坏了不影响其它 */
              }
            }
            if (alive) setCustomFonts(names);
          } catch {
            /* IndexedDB 不可用时忽略 */
          }
        })();
        return () => {
          alive = false;
        };
      }, []);
      const importFont = useCallback(
        async (file) => {
          try {
            const buffer = await file.arrayBuffer();
            const name = String(file.name || '本地字体').replace(/\.[^.]+$/, '');
            await registerFontFace(name, buffer);
            await FontStore.put(name, buffer);
            setCustomFonts((prev) => (prev.includes(name) ? prev : [...prev, name]));
            applyType({ ...typeSet, font: name });
            setNotice('已导入字体：' + name);
          } catch (error) {
            setError('导入字体失败：' + error.message);
          }
        },
        [applyType, typeSet]
      );
      const removeFont = useCallback(
        async (name) => {
          try {
            await FontStore.remove(name);
          } catch {
            /* 删库失败也别拦着 UI */
          }
          setCustomFonts((prev) => prev.filter((item) => item !== name));
          if (typeSet.font === name) applyType({ ...typeSet, font: DEFAULT_TYPE.font });
        },
        [applyType, typeSet]
      );
      const currentFolder = folderPath[folderPath.length - 1];
      const [docsQuery, setDocsQuery] = useState('');
      const [sheetOpen, setSheetOpen] = useState(false);
      const [docMenu, setDocMenu] = useState(null);
      const [railOpen, setRailOpen] = useState(true);
      const [ask, setAsk] = useState(null);
      const [doc, setDoc] = useState(null);
      const [blocks, setBlocks] = useState([]);
      // 未保存标记。dirtyRef 供回调里同步读取（state 在闭包里会过期）
      const [dirty, setDirty] = useState(false);
      const dirtyRef = useRef(false);
      const markDirty = useCallback((next) => {
        const value = Boolean(next);
        dirtyRef.current = value;
        setDirty(value);
      }, []);
      const [draft, setDraft] = useState('');
      const [docTitle, setDocTitle] = useState('');
      const [busy, setBusy] = useState(false);
      const [error, setError] = useState('');
      const [notice, setNotice] = useState('');
      const mounted = useRef(true);
      const listRef = useRef(null);
      const stickRef = useRef(true);
      const olderRef = useRef('');
      const keepScrollRef = useRef(null);
      // 连续失败次数，用来给轮询做指数退避（成功一次就清零）
      const msgFailRef = useRef(0);
      const chatFailRef = useRef(0);
      const [hasMore, setHasMore] = useState(false);

      useEffect(() => {
        if (document.getElementById('feishu-plugin-style')) return undefined;
        const node = document.createElement('style');
        node.id = 'feishu-plugin-style';
        node.textContent = CSS;
        document.head.appendChild(node);
        return () => node.remove();
      }, []);

      useEffect(() => () => { mounted.current = false; }, []);

      // 给 memo 行组件用的稳定回调：引用不变，行才不会被父组件的重渲带下去
      const pickChat = useCallback((id) => setChatId(id), []);
      const enterFolder = useCallback((entry) => {
        setFolderPath((prev) => [...prev, { token: entry.token, name: entry.name }]);
      }, []);
      const openListMenu = useCallback((entry, event) => {
        setListMenu({ x: event.clientX, y: event.clientY, kind: entry.type === 'folder' ? 'folder' : 'file', entry });
      }, []);
      const openFolderMenu = useCallback((entry, event) => {
        setListMenu({ x: event.clientX, y: event.clientY, kind: 'folder', entry });
      }, []);

      const connect = useCallback(async (quiet = false) => {
        if (quiet === true) {
          // 20 秒轮询：状态点别闪灰，静默刷就行
        } else {
          setError('');
          setHealth({ state: 'probing', text: '连接飞书…', bot: '' });
        }
        const found = await findBridge();
        if (!mounted.current) return;
        if (!found) {
          setHealth({ state: 'bad', text: '本地桥没起来（插件需要重新加载）', bot: '' });
          return;
        }
        if (!found.ok) {
          setHealth({ state: 'bad', text: found.error || '飞书没连上', bot: '' });
          return;
        }
        setHealth({ state: 'ok', text: `已连接 · ${found.bot?.name || '机器人'}`, bot: found.bot?.name || '' });
        try {
          const data = await bridge('/chats');
          if (!mounted.current) return;
          const nextChats = data.chats || [];
          // 20 秒轮询一次，群里名字/描述没变就别造新数组
          setChats((prev) => {
            if (
              prev.length === nextChats.length &&
              prev.every((row, i) => row.chatId === nextChats[i].chatId && row.name === nextChats[i].name && row.description === nextChats[i].description)
            ) {
              return prev;
            }
            return nextChats;
          });
          // 首条会话只在还没有选中时补上；用函数式更新，connect 就不用依赖 chatId
          if (nextChats.length) setChatId((prev) => prev || nextChats[0].chatId);
          chatFailRef.current = 0;
        } catch (failure) {
          chatFailRef.current += 1;
          if (mounted.current) setError(failure.message);
        }
      }, []);

      useEffect(() => { if (tab === 'web') setWebMounted(true); }, [tab]);

      useEffect(() => { connect(); }, [connect]);

      const loadMessages = useCallback(async (id, options = {}) => {
        if (!id) return;
        const quiet = options.quiet === true;
        const older = options.older === true;
        if (!quiet) {
          setBusy(true);
          setError('');
        }
        try {
          const query = `chatId=${encodeURIComponent(id)}&pageSize=40${older && olderRef.current ? '&pageToken=' + encodeURIComponent(olderRef.current) : ''}`;
          const data = await bridge(`/messages?${query}`);
          if (!mounted.current) return;
          msgFailRef.current = 0;
          const batch = data.messages || [];
          if (older) {
            // 往前翻历史：倒序批次反转后接到顶上，顺手去重
            setMessages((prev) => {
              const seen = new Set(prev.map((row) => row.id));
              const head = batch.slice().reverse().filter((row) => !seen.has(row.id));
              if (!head.length) return prev;
              return head.concat(prev);
            });
          } else {
            // 飞书返回的是倒序（新的在前），聊天框要正序，最新那条落到最下面
            // 已经往上翻过历史时，不能拿这 40 条把整段历史换掉：只替换尾部窗口，前面接原样保留
            setMessages((prev) => {
              const next = batch.slice().reverse();
              let head = [];
              if (prev.length > next.length && next.length) {
                const cut = prev.findIndex((row) => row.id === next[0].id);
                if (cut > 0) head = prev.slice(0, cut);
              }
              const merged = head.concat(next);
              // 跟上次一样就还回原引用：静默轮询不再触发整棵树重渲
              if (prev.length === merged.length && prev.every((row, i) => sameMessage(row, merged[i]))) return prev;
              return merged;
            });
          }
          // 静默轮询不动游标，否则「加载更早」会跳页
          if (!quiet) {
            olderRef.current = data.pageToken || '';
            setHasMore(Boolean(data.hasMore));
          }
        } catch (failure) {
          msgFailRef.current += 1;
          if (mounted.current && !quiet) setError(failure.message);
        } finally {
          if (mounted.current && !quiet) setBusy(false);
        }
      }, []);

      // 切会话：游标归零，重新从最新一页开始
      useEffect(() => {
        olderRef.current = '';
        setHasMore(false);
      }, [chatId]);

      useEffect(() => { loadMessages(chatId); }, [chatId, loadMessages]);

      // 新消息进来时，只有原本就贴着底才自动滚下去（正在往上翻历史就不打扰）
      // 如果是「加载更早」，把视图钉在原来那条消息上，别跳
      useEffect(() => {
        const node = listRef.current;
        if (!node) return;
        const keep = keepScrollRef.current;
        if (keep) {
          keepScrollRef.current = null;
          node.scrollTop = node.scrollHeight - keep.height + keep.top;
          return;
        }
        if (!stickRef.current) return;
        node.scrollTop = node.scrollHeight;
      }, [messages]);

      // 面板可见性：DSH 切到别的页签、窗口最小化、或整个界面被隐藏时，
      // 不该继续每 5 秒打飞书接口（多开窗口时很容易把限频踩满）。
      const pollingAllowed = () => {
        try {
          if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
        } catch {
          /* 拿不到就当可见 */
        }
        return true;
      };

      // 群列表也跟着刷（新建/新拉进群的会话能自动出现）。
      // 失败按 2 的幂退避，最多 5 分钟一次，别在飞书抽风时死磕。
      useEffect(() => {
        if (tab !== 'chats') return undefined;
        let cancelled = false;
        let timer = null;
        const tick = async () => {
          if (cancelled) return;
          if (pollingAllowed()) {
            await connect(true);
          }
          const delay = Math.min(20000 * Math.pow(2, Math.min(chatFailRef.current, 4)), 300000);
          if (!cancelled) timer = setTimeout(tick, delay);
        };
        timer = setTimeout(tick, 20000);
        return () => {
          cancelled = true;
          if (timer) clearTimeout(timer);
        };
      }, [tab, connect]);

      // 每 5 秒静默拉一次，实现「随时随地更新」；隐藏时只做计时不打接口
      useEffect(() => {
        if (tab !== 'chats' || !chatId) return undefined;
        let cancelled = false;
        let timer = null;
        const tick = async () => {
          if (cancelled) return;
          if (pollingAllowed()) {
            await loadMessages(chatId, { quiet: true });
          }
          const delay = Math.min(5000 * Math.pow(2, Math.min(msgFailRef.current, 4)), 60000);
          if (!cancelled) timer = setTimeout(tick, delay);
        };
        timer = setTimeout(tick, 5000);
        return () => {
          cancelled = true;
          if (timer) clearTimeout(timer);
        };
      }, [tab, chatId, loadMessages]);

      const loadDrive = useCallback(async (token) => {
        setBusy(true);
        setError('');
        try {
          const data = await bridge(`/drive?folderToken=${encodeURIComponent(token || '')}&identity=${identity}`);
          if (!mounted.current) return;
          setFolders(data.folders || []);
          setDocs(data.files || []);
        } catch (failure) {
          if (mounted.current) setError(failure.message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, [identity]);

      const loadDocs = useCallback(() => loadDrive(currentFolder.token), [loadDrive, currentFolder.token]);


      const loadAuth = useCallback(async () => {
        try {
          const info = await bridge('/auth');
          if (mounted.current) setAuthInfo(info || { authorized: false });
        } catch {
          /* 桥没起来时忽略 */
        }
      }, []);

      // 进文档页先立刻查一次授权状态（不能等下面那个 4 秒轮询，否则首次进来是空的）
      useEffect(() => {
        if (tab !== 'docs') return;
        loadAuth();
      }, [tab, loadAuth]);

      // 授权在浏览器里完成，面板这边轮询等它变成已授权
      useEffect(() => {
        if (tab !== 'docs' || authInfo.authorized) return undefined;
        const timer = setInterval(() => { loadAuth(); }, 4000);
        return () => clearInterval(timer);
      }, [tab, authInfo.authorized, loadAuth]);

      const loadMoveFolders = useCallback(
        async (token) => {
          try {
            const data = await bridge(`/drive?folderToken=${encodeURIComponent(token || '')}&identity=${identity}`);
            setMoveFolders((data.folders || []).map((row) => ({ token: row.token, name: row.name })));
          } catch (error) {
            setMoveFolders([]);
            setError(error.message);
          }
        },
        [identity]
      );
      const openMove = useCallback(
        (entry) => {
          setListMenu(null);
          setDocMenu(null);
          setMoveTarget({ token: entry.token, name: entry.name, type: entry.type || 'docx' });
          setMovePath([{ token: '', name: identity === 'bot' ? '机器人空间' : '我的空间' }]);
          loadMoveFolders('');
        },
        [identity, loadMoveFolders]
      );
      const enterMoveFolder = useCallback(
        (folder) => {
          setMovePath((prev) => [...prev, folder]);
          loadMoveFolders(folder.token);
        },
        [loadMoveFolders]
      );
      const doMove = useCallback(async () => {
        if (!moveTarget) return;
        const dest = movePath[movePath.length - 1] || { token: '', name: '根目录' };
        setMoveBusy(true);
        try {
          await bridge('/move', {
            method: 'POST',
            body: JSON.stringify({
              token: moveTarget.token,
              type: moveTarget.type,
              folderToken: dest.token,
              identity,
            }),
          });
          setMoveTarget(null);
          setNotice('已移动到「' + dest.name + '」');
          loadDrive(currentFolder.token);
        } catch (error) {
          setError(error.message);
        } finally {
          setMoveBusy(false);
        }
      }, [moveTarget, movePath, identity, loadDrive, currentFolder.token]);

      const mkdir = useCallback(

        async (name) => {
          const value = String(name || '').trim();
          if (!value) return;
          setBusy(true);
          setError('');
          try {
            await bridge('/mkdir', { method: 'POST', body: JSON.stringify({ name: value, parentToken: currentFolder.token, identity }) });
            if (!mounted.current) return;
            setNotice('已新建文件夹「' + value + '」');
            await loadDrive(currentFolder.token);
          } catch (failure) {
            if (mounted.current) setError(failure.message);
          } finally {
            if (mounted.current) setBusy(false);
          }
        },
        [currentFolder.token, identity, loadDrive]
      );

      // 已授权后拉列表：进页面 / 切身份 / 换文件夹 / 刚授权都会走到这里。
      // 原来这里有两个 effect 各自 loadDrive，进页面会重复请求两遍。
      useEffect(() => {
        if (tab !== 'docs' || !authInfo.authorized) return;
        loadDrive(currentFolder.token);
      }, [tab, identity, authInfo.authorized, currentFolder.token, loadDrive]);

      const send = useCallback(async () => {
        const text = draft.trim();
        if (!text || !chatId) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
          await bridge('/send', { method: 'POST', body: JSON.stringify({ chatId, text }) });
          if (!mounted.current) return;
          setDraft('');
          setNotice('已发送');
          await loadMessages(chatId);
        } catch (failure) {
          if (mounted.current) setError(failure.message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, [draft, chatId, loadMessages]);

      // 发图片 / 文件：读成 base64 交给桥，桥上传到飞书再发出去
      const uploadMedia = useCallback(
        async (file, kind) => {
          if (!file || !chatId) return;
          setBusy(true);
          setError('');
          setNotice('正在上传 ' + (file.name || (kind === 'image' ? '图片' : '文件')) + '…');
          try {
            const bytes = new Uint8Array(await file.arrayBuffer());
            let binary = '';
            const CHUNK = 0x8000;
            for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
            const data = btoa(binary);
            const result = await bridge('/upload', {
              method: 'POST',
              body: JSON.stringify({ chatId, kind, fileName: file.name || 'file', data }),
              signal: AbortSignal.timeout(120000),
            });
            if (!mounted.current) return;
            setNotice('已发送 ' + (result.fileName || '文件'));
            await loadMessages(chatId);
          } catch (error) {
            if (mounted.current) setError('上传失败：' + error.message);
          } finally {
            if (mounted.current) setBusy(false);
          }
        },
        [chatId, loadMessages]
      );

      const openDoc = useCallback(async (token) => {
        // 有未保存改动时先问一句，别让人点一下就丢稿
        if (dirtyRef.current && !window.confirm('这篇文档还有没保存的修改，切换会丢掉。要继续吗？')) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
          const data = await bridge(`/docblocks?id=${encodeURIComponent(token)}&identity=${identity}`);
          if (!mounted.current) return;
          const list = (data.blocks || []).map((block, index) => ({
            key: `${block.id || 'new'}-${index}`,
            type: block.type || 'p',
            text: block.text || '',
            token: block.token || '',
            // 下面四个字段决定「这个块编辑器能不能安全地改写回去」
            blockType: Number(block.blockType) || 0,
            supported: block.supported !== false,
            kind: block.kind || '',
            rich: Boolean(block.rich),
          }));
          setDoc({ id: token, unsupported: Number(data.unsupported) || 0, styled: Number(data.styled) || 0, revision: Number(data.revision) || 0 });
          setBlocks(list.length ? list : [{ key: `blk-${Date.now()}`, type: 'p', text: '' }]);
          dirtyRef.current = false;
          setDirty(false);
        } catch (failure) {
          if (mounted.current) setError(failure.message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, [identity]);

      // DocRow 用：拿到 entry 只要 token
      const openDocEntry = useCallback((entry) => { openDoc(entry.token); }, [openDoc]);

      const saveDoc = useCallback(async () => {
        if (!doc) return;
        // 只提交编辑器真正读懂的块；不支持的块如果混进来，桥那边也会拦住并解释原因
        const payloadBlocks = blocks
          .filter((block) => block.supported !== false)
          .map((block) => ({ type: block.type, text: block.text || '', token: block.token || '' }));
        const hasContent = payloadBlocks.some((block) => (block.type === 'image' && block.token) || String(block.text || '').trim());
        if (!hasContent) {
          setError('正文是空的，先写点东西再保存');
          return;
        }
        setBusy(true);
        setError('');
        setNotice('');
        const post = async (revision) =>
          bridge('/save', {
            method: 'POST',
            body: JSON.stringify({
              id: doc.id,
              blocks: payloadBlocks,
              identity,
              ...(revision ? { revision } : {}),
            }),
          });
        try {
          let data;
          try {
            data = await post(doc.revision);
          } catch (conflict) {
            // 打开之后有人在飞书里改过：别默默覆盖，让人自己决定
            if (conflict.code === 'REVISION_CONFLICT') {
              const proceed = window.confirm(conflict.message + '\n\n仍要覆盖对方的修改吗？（会先备份成块 JSON）');
              if (!proceed) {
                if (mounted.current) {
                  setError('已取消保存，文档一个字没动。要看别人的改动请重新打开这篇文档。');
                  setBusy(false);
                }
                return;
              }
              data = await post(conflict.revision ? conflict.revision.current : 0);
            } else {
              throw conflict;
            }
          }
          if (!mounted.current) return;
          setNotice(`已保存（原 ${data.removed} 块 → 新 ${data.blocks} 块，备份是块 JSON）`);
          dirtyRef.current = false;
          setDirty(false);
          const refreshed = await bridge(`/docblocks?id=${encodeURIComponent(doc.id)}&identity=${identity}`);
          if (!mounted.current) return;
          setDoc((prev) => ({
            ...(prev || { id: doc.id }),
            unsupported: Number(refreshed.unsupported) || 0,
            styled: Number(refreshed.styled) || 0,
            revision: Number(refreshed.revision) || Number(data.revision) || 0,
          }));
          setBlocks(
            (refreshed.blocks || []).map((block, index) => ({
              key: `${block.id || 'new'}-${index}`,
              type: block.type || 'p',
              text: block.text || '',
              token: block.token || '',
              blockType: Number(block.blockType) || 0,
              supported: block.supported !== false,
              kind: block.kind || '',
              rich: Boolean(block.rich),
            }))
          );
        } catch (failure) {
          if (mounted.current) {
            // 被安全拦截时不是「保存失败」，是「根本没动你的文档」，文案要分开
            setError(failure.code === 'UNSAFE_OVERWRITE' ? failure.message : '保存失败：' + failure.message);
          }
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, [doc, blocks, identity]);

      useEffect(() => {
        if (!docMenu) return undefined;
        const close = () => setDocMenu(null);
        window.addEventListener('mousedown', close);
        return () => window.removeEventListener('mousedown', close);
      }, [docMenu]);

      const renameDoc = useCallback(
        async (target, nextName) => {
          const name = String(nextName || '').trim();
          if (!name || name === target.name) return;
          setBusy(true);
          setError('');
          try {
            const kind = target.type === 'folder' ? 'folder' : target.type || 'docx';
            await bridge('/rename', { method: 'POST', body: JSON.stringify({ token: target.token, name, type: kind, identity }) });
            if (!mounted.current) return;
            setNotice('已重命名为「' + name + '」');
            await loadDocs();
          } catch (failure) {
            if (mounted.current) setError(failure.message);
          } finally {
            if (mounted.current) setBusy(false);
          }
        },
        [loadDocs, identity]
      );

      const deleteDoc = useCallback(
        async (file) => {
          setBusy(true);
          setError('');
          try {
            await bridge('/delete', { method: 'POST', body: JSON.stringify({ token: file.token, type: file.type || 'docx', identity }) });
            if (!mounted.current) return;
            setNotice('已删除（飞书回收站里能找回）');
            if (doc && doc.id === file.token) setDoc(null);
            await loadDocs();
          } catch (failure) {
            if (mounted.current) setError(failure.message);
          } finally {
            if (mounted.current) setBusy(false);
          }
        },
        [doc, loadDocs, identity]
      );

      const createDoc = useCallback(async () => {
        const markdown = draft.trim();
        if (!markdown) return;
        setBusy(true);
        setError('');
        setNotice('');
        try {
          const data = await bridge('/doc', {
            method: 'POST',
            body: JSON.stringify({ title: docTitle.trim(), markdown, folderToken: currentFolder.token, identity }),
          });
          if (!mounted.current) return;
          setNotice(`已建成文档：${data.title}`);
          setDraft('');
          setDocTitle('');
          setSheetOpen(false);
          setTab('docs');
          await loadDrive(currentFolder.token);
        } catch (failure) {
          if (mounted.current) setError(failure.message);
        } finally {
          if (mounted.current) setBusy(false);
        }
      }, [draft, docTitle, currentFolder.token, identity, loadDrive]);

      const webBody = h(WebViewPane, null);

      const chatBody = chats.length
        ? h(
            'div',
            { className: 'fs-chat-body' },
            h(
              'div',
              { className: 'fs-scroll', style: { maxHeight: '34%', flex: 'none' } },
              chats.map((chat) => h(ChatRow, { key: chat.chatId, chat, active: chat.chatId === chatId, onPick: pickChat }))
            ),
            h(
              'div',
              {
                className: 'fs-scroll',
                ref: listRef,
                onScroll: () => {
                  const node = listRef.current;
                  if (!node) return;
                  stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
                },
              },
              h(
                'div',
                { className: 'fs-more' },
                hasMore
                  ? h(
                      'button',
                      {
                        className: 'fs-btn',
                        type: 'button',
                        disabled: busy,
                        onClick: () => {
                          const node = listRef.current;
                          if (node) keepScrollRef.current = { height: node.scrollHeight, top: node.scrollTop };
                          loadMessages(chatId, { older: true });
                        },
                      },
                      '加载更早'
                    )
                  : messages.length
                    ? h('span', { className: 'fs-more-end' }, '已经到头了')
                    : null
              ),
              messages.length
                ? messages.map((message) => h(MsgRow, { key: message.id, message }))
                : h(
                    'div',
                    { className: 'fs-empty' },
                    h('div', { className: 'fs-empty-emoji' }, '💬'),
                    h('div', null, busy ? '读取中…' : '这个会话还没有消息'),
                    h('div', null, '在下面的输入框说句话试试')
                  )
            )
          )
        : h('div', { className: 'fs-empty' }, h('div', { className: 'fs-empty-emoji' }, '👥'), h('div', null, '机器人还不在任何群里'), h('div', null, '群设置 → 群机器人 → 添加「DSH插件」'));

      // 只在 docs 或搜索词真的变了才重算（原先每次渲染都跑一遍过滤）
      const docFiltered = useMemo(() => {
        const needle = docsQuery.trim().toLowerCase();
        if (!needle) return docs;
        return docs.filter((file) => String(file.name || '').toLowerCase().includes(needle));
      }, [docs, docsQuery]);

      const upRow =
        folderPath.length > 1
          ? h(
              'div',
              {
                className: 'fs-drow',
                'data-kind': 'up',
                title: '返回上一级',
                onClick: () => setFolderPath(folderPath.slice(0, -1)),
              },
              h('div', { className: 'fs-dicon', 'data-kind': 'up' }, '↑'),
              h('div', { className: 'fs-dname' }, '上一级')
            )
          : null;

      const folderRows = folders.map((folder) => h(DocRow, { key: folder.token, entry: folder, kind: 'folder', onOpen: enterFolder, onMenu: openFolderMenu }));

      const fileRows = docFiltered.map((entry) =>
        h(DocRow, { key: entry.token, entry, kind: entry.type || 'docx', active: Boolean(doc && doc.id === entry.token), onOpen: openDocEntry, onMenu: openListMenu })
      );

      const docsLeft = h(
        'div',
        { className: 'fs-dlist' },
        h(
          'div',
          { className: 'fs-dlist-top' },
          h('button', { type: 'button', className: 'fs-newdoc', title: '新建文档', onClick: () => setSheetOpen(true) }, h('span', { className: 'fs-newdoc-plus' }, '＋'), h('span', null, '新建')),
          h('button', { type: 'button', className: 'fs-btn', title: '刷新', disabled: busy, onClick: () => loadDrive(currentFolder.token) }, '刷新')
        ),
        h(
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
          ? h('div', { className: 'fs-auth' }, identity === 'bot' ? '🤖 机器人自己的空间' : '👤 ' + (authInfo.name || '已授权'))
          : h(
              'button',
              {
                type: 'button',
                className: 'fs-auth-btn',
                title: authInfo.authorized ? '当前授权缺少云空间权限，需要重新授权' : '',
                onClick: () => window.open(bridgeOrigin + '/feishu-panel/oauth/start', '_blank', 'width=560,height=720'),
              },
              authInfo.authorized ? '重新授权（缺：' + ((authInfo.missing || []).join('、') || '云空间权限') + '）' : '授权我的飞书账号'
            ),
        h(
          'div',
          { className: 'fs-crumbs' },
          folderPath.map((node, index) =>
            h(
              'button',
              {
                key: String(index) + node.token,
                type: 'button',
                className: 'fs-crumb',
                title: node.name,
                onClick: () => setFolderPath(folderPath.slice(0, index + 1)),
              },
              index === 0 ? '我的空间' : node.name
            )
          )
        ),
        h(
          'div',
          { className: 'fs-search' },
          h('input', {
            className: 'fs-search-input',
            placeholder: '过滤…',
            value: docsQuery,
            onChange: (event) => setDocsQuery(event.target.value),
          })
        ),
        h(
          'div',
          {
            className: 'fs-dlist-body',
            onContextMenu: (event) => {
              if (event.target !== event.currentTarget) return;
              event.preventDefault();
              setListMenu({ x: event.clientX, y: event.clientY, kind: 'blank' });
            },
          },
          folderRows.length || fileRows.length || upRow
            ? [].concat(upRow ? [upRow] : [], folderRows, fileRows)
            : h(
                'div',
                { className: 'fs-dlist-empty' },
                busy ? '读取中…' : authInfo.authorized ? (docsQuery ? '没有匹配' : '这里还空着') : '先授权再看你的文件'
              )
        )
      );

      const docsRight = doc
        ? h(BlockEditor, { identity,
            blocks,
            onChange: setBlocks,
            onSave: saveDoc,
            onBack: () => setRailOpen((open) => !open),
            busy,
            notice,
            dirty,
            onDirtyChange: markDirty,
            docMeta: doc,
            onOutlineToggle: (open) => setRailOpen(!open),
            typeSet,
            onTypeChange: applyType,
            customFonts,
            onImportFont: importFont,
            onRemoveFont: removeFont,
            docId: doc.id,
            backLabel: railOpen ? '«' : '»',
          })
        : h(
            'div',
            { className: 'fs-dplaceholder' },
            h('div', { className: 'fs-empty-emoji' }, '📄'),
            h('div', null, '左边选一篇文档'),
            h('div', { className: 'fs-status' }, '或者点「＋ 新建」写一篇')
          );

      const docsBody = h('div', { className: 'fs-split' }, railOpen ? docsLeft : null, docsRight);

      return h(
        'div',
        {
          className: 'fs-root',
          style: {
            '--fs-font':
              (FONT_CHOICES.find((choice) => choice.id === typeSet.font) || {}).stack ||
              (customFonts.includes(typeSet.font)
                ? '"' + typeSet.font + '", system-ui, sans-serif'
                : FONT_CHOICES[0].stack),
            '--fs-doc-size': (Number(typeSet.size) || 13) + 'px',
          },
        },
        h(
          'div',
          { className: 'fs-bar' },
          h('span', { className: 'fs-dot', 'data-state': health.state === 'ok' ? 'ok' : health.state === 'bad' ? 'bad' : 'wait' }),
          h('span', { className: 'fs-status', title: health.text }, health.text),
          h('button', { className: 'fs-btn', type: 'button', onClick: () => connect(), disabled: busy }, '重连')
        ),
        h(
          'div',
          { className: 'fs-tabs' },
          h('button', { className: 'fs-tab', type: 'button', 'data-active': tab === 'chats', onClick: () => setTab('chats') }, '会话'),
          h('button', { className: 'fs-tab', type: 'button', 'data-active': tab === 'docs', onClick: () => { setTab('docs'); setDoc(null); } }, '文档'),
          h('button', { className: 'fs-tab', type: 'button', 'data-active': tab === 'web', onClick: () => setTab('web') }, '网页版')
        ),
        error ? h('div', { className: 'fs-hint fs-err' }, error) : null,
        ask
          ? h(
              'div',
              { className: 'fs-sheet', onClick: () => setAsk(null) },
              h(
                'div',
                { className: 'fs-sheet-card', onClick: (event) => event.stopPropagation() },
                h(
                  'div',
                  { className: 'fs-sheet-head' },
                  h('span', { className: 'fs-sheet-title' }, ask.kind === 'rename' ? '重命名' : ask.kind === 'mkdir' ? '新建文件夹' : '删除'),
                  h('button', { className: 'fs-btn', type: 'button', onClick: () => setAsk(null) }, '取消')
                ),
                ask.kind === 'delete'
                  ? h('div', { className: 'fs-sheet-note' }, '「' + (ask.file.name || '这一项') + '」会移到飞书回收站，还能找回。')
                  : h('input', {
                      className: 'fs-sheet-input',
                      value: ask.value,
                      autoFocus: true,
                      onChange: (event) => setAsk({ ...ask, value: event.target.value }),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') {
                          const target = ask.file;
                          const next = ask.value;
                          const mode = ask.kind;
                          setAsk(null);
                          if (mode === 'mkdir') mkdir(next);
                          else renameDoc(target, next);
                        }
                      },
                    }),
                h(
                  'div',
                  { className: 'fs-sheet-actions' },
                  h('span', { className: 'fs-status' }, ''),
                  ask.kind === 'rename'
                    ? h(
                        'button',
                        {
                          className: 'fs-btn fs-save',
                          type: 'button',
                          'data-primary': 'true',
                          disabled: busy || !String(ask.value || '').trim(),
                          onClick: () => {
                            const target = ask.file;
                            const next = ask.value;
                            const mode = ask.kind;
                            setAsk(null);
                            if (mode === 'mkdir') mkdir(next);
                            else renameDoc(target, next);
                          },
                        },
                        '确定'
                      )
                    : h(
                        'button',
                        {
                          className: 'fs-btn fs-save',
                          type: 'button',
                          'data-danger': 'true',
                          style: { background: '#c1533f', borderColor: 'transparent', color: '#fff' },
                          disabled: busy,
                          onClick: () => {
                            const target = ask.file;
                            setAsk(null);
                            deleteDoc(target);
                          },
                        },
                        '删除'
                      )
                )
              )
            )
          : null,
        listMenu
          ? h(
              'div',
              {
                className: 'fs-menu',
                style: { left: Math.min(listMenu.x, (window.innerWidth || 800) - 186) + 'px', top: Math.min(listMenu.y, (window.innerHeight || 800) - 190) + 'px' },
                onMouseDown: (event) => event.stopPropagation(),
              },
              listMenu.kind === 'blank'
                ? [
                    h('button', { key: 'mk', type: 'button', className: 'fs-menu-item', onClick: () => { setListMenu(null); setAsk({ kind: 'mkdir', value: '' }); } }, h('span', null, '新建文件夹')),
                    h('button', { key: 'nd', type: 'button', className: 'fs-menu-item', onClick: () => { setListMenu(null); setSheetOpen(true); } }, h('span', null, '新建文档')),
                    h('div', { key: 'sep', className: 'fs-menu-sep' }),
                    h('button', { key: 'rf', type: 'button', className: 'fs-menu-item', onClick: () => { setListMenu(null); loadDrive(currentFolder.token); } }, h('span', null, '刷新')),
                  ]
                : [
                    listMenu.kind === 'folder'
                      ? h('button', { key: 'open', type: 'button', className: 'fs-menu-item', onClick: () => { const e = listMenu.entry; setListMenu(null); setFolderPath([...folderPath, { token: e.token, name: e.name }]); } }, h('span', null, '打开文件夹'))
                      : h('button', { key: 'open', type: 'button', className: 'fs-menu-item', onClick: () => { const e = listMenu.entry; setListMenu(null); openDoc(e.token); } }, h('span', null, '打开')),
                    h('button', { key: 'rn', type: 'button', className: 'fs-menu-item', onClick: () => { const e = listMenu.entry; setListMenu(null); setAsk({ kind: 'rename', file: e, value: e.name || '' }); } }, h('span', null, '重命名')),
                    h('button', { key: 'mv', type: 'button', className: 'fs-menu-item', onClick: () => openMove(listMenu.entry) }, h('span', null, '移动到…')),
                    h('div', { key: 'sep2', className: 'fs-menu-sep' }),
                    h('button', { key: 'del', type: 'button', className: 'fs-menu-item', 'data-danger': 'true', onClick: () => { const e = listMenu.entry; setListMenu(null); setAsk({ kind: 'delete', file: e }); } }, h('span', null, '删除')),
                  ]
            )
          : null,
        docMenu
          ? h(
              'div',
              {
                className: 'fs-menu',
                style: { left: Math.min(docMenu.x, (window.innerWidth || 800) - 176) + 'px', top: Math.min(docMenu.y, (window.innerHeight || 800) - 150) + 'px' },
                onMouseDown: (event) => event.stopPropagation(),
                onMouseLeave: () => setDocMenu(null),
              },
              h('button', { type: 'button', className: 'fs-menu-item', onClick: () => { setDocMenu(null); openDoc(docMenu.file.token); } }, h('span', null, '打开')),
              h('button', { type: 'button', className: 'fs-menu-item', onClick: () => { const target = docMenu.file; setDocMenu(null); setAsk({ kind: 'rename', file: target, value: target.name || '' }); } }, h('span', null, '重命名')),
              h('button', { type: 'button', className: 'fs-menu-item', onClick: () => openMove(docMenu.file) }, h('span', null, '移动到…')),
              h('div', { className: 'fs-menu-sep' }),
              h('button', { type: 'button', className: 'fs-menu-item', 'data-danger': 'true', onClick: () => { const target = docMenu.file; setDocMenu(null); setAsk({ kind: 'delete', file: target }); } }, h('span', null, '删除'))
            )
          : null,
        moveTarget
          ? h(
              'div',
              { className: 'fs-sheet', onClick: () => setMoveTarget(null) },
              h(
                'div',
                { className: 'fs-sheet-card fs-move-card', onClick: (event) => event.stopPropagation() },
                h(
                  'div',
                  { className: 'fs-sheet-head' },
                  h('span', { className: 'fs-sheet-title' }, '移动到'),
                  h('button', { className: 'fs-btn', type: 'button', onClick: () => setMoveTarget(null) }, '取消')
                ),
                h('div', { className: 'fs-sheet-note' }, '「' + (moveTarget.name || '未命名') + '」'),
                h(
                  'div',
                  { className: 'fs-move-path' },
                  movePath.map((node, index) =>
                    index === movePath.length - 1
                      ? h('span', { key: 'p' + index, className: 'fs-crumb', 'data-current': 'true' }, node.name)
                      : h(
                          'button',
                          {
                            key: 'p' + index,
                            type: 'button',
                            className: 'fs-crumb',
                            onClick: () => {
                              setMovePath(movePath.slice(0, index + 1));
                              loadMoveFolders(node.token);
                            },
                          },
                          node.name
                        )
                  )
                ),
                h(
                  'div',
                  { className: 'fs-move-list' },
                  movePath.length > 1
                    ? h(
                        'button',
                        {
                          type: 'button',
                          className: 'fs-move-item fs-move-up',
                          onClick: () => {
                            const next = movePath.slice(0, -1);
                            setMovePath(next);
                            loadMoveFolders((next[next.length - 1] || {}).token || '');
                          },
                        },
                        '↑ 上一级'
                      )
                    : null,
                  moveFolders.length
                    ? moveFolders.map((folder) =>
                        h(
                          'button',
                          { key: folder.token, type: 'button', className: 'fs-move-item', onClick: () => enterMoveFolder(folder) },
                          h('span', { className: 'fs-move-icon' }, '📁'),
                          h('span', { className: 'fs-move-name' }, folder.name || '未命名')
                        )
                      )
                    : h('div', { className: 'fs-move-empty' }, '这里没有子文件夹')
                ),
                h(
                  'div',
                  { className: 'fs-sheet-actions' },
                  h(
                    'button',
                    { className: 'fs-btn', type: 'button', 'data-primary': 'true', disabled: moveBusy, onClick: doMove },
                    moveBusy ? '移动中…' : '移动到这里'
                  )
                )
              )
            )
          : null,
        sheetOpen
          ? h(
              'div',
              { className: 'fs-sheet', onClick: () => setSheetOpen(false) },
              h(
                'div',
                { className: 'fs-sheet-card', onClick: (event) => event.stopPropagation() },
                h(
                  'div',
                  { className: 'fs-sheet-head' },
                  h('span', { className: 'fs-sheet-title' }, '新建飞书文档'),
                  h('button', { className: 'fs-btn', type: 'button', onClick: () => setSheetOpen(false) }, '取消')
                ),
                h('input', {
                  className: 'fs-sheet-input',
                  placeholder: '标题（留空取正文第一行）',
                  value: docTitle,
                  onChange: (event) => setDocTitle(event.target.value),
                }),
                h('textarea', {
                  className: 'fs-sheet-body',
                  placeholder: '正文，支持 Markdown：# 标题、- 列表、\u0060\u0060\u0060 代码块',
                  value: draft,
                  onChange: (event) => setDraft(event.target.value),
                }),
                h(
                  'div',
                  { className: 'fs-sheet-actions' },
                  h('span', { className: 'fs-status' }, notice || '会建成一篇真飞书文档'),
                  h(
                    'button',
                    { className: 'fs-btn fs-save', type: 'button', 'data-primary': 'true', disabled: busy || !draft.trim(), onClick: createDoc },
                    busy ? '创建中…' : '创建'
                  )
                )
              )
            )
          : null,
        tab === 'web' ? null : tab === 'chats' ? chatBody : docsBody,
        // 网页版一旦打开过就留着，切走只隐藏：webview 卸载就会重新加载整个飞书
        webMounted
          ? h('div', { className: 'fs-web-host', style: tab === 'web' ? { display: 'flex' } : { display: 'none' } }, webBody)
          : null,
        tab === 'web' || tab === 'docs' ? null : h(
          'div',
          { className: 'fs-composer' },
          tab === 'docs' && !doc
            ? h('input', {
                className: 'fs-select',
                placeholder: '新文档标题（留空取正文第一行）',
                value: docTitle,
                onChange: (event) => setDocTitle(event.target.value),
              })
            : null,
          h('textarea', {
            value: draft,
            placeholder: tab === 'chats' ? '发给这个群…（Ctrl+Enter 发送）' : '写文案，Ctrl+Enter 建成飞书文档',
            onChange: (event) => setDraft(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                if (tab === 'chats') send();
                else createDoc();
              }
              if (event.key === 's' && (event.metaKey || event.ctrlKey) && doc) {
                event.preventDefault();
                saveDoc();
              }
            },
          }),
          h(
            'div',
            { className: 'fs-row-line' },
            tab === 'chats'
              ? h(
                  'label',
                  { className: 'fs-icon-btn fs-pick', title: '发送图片' },
                  '🖼',
                  h('input', {
                    type: 'file',
                    accept: 'image/*',
                    style: { display: 'none' },
                    onChange: (event) => {
                      const picked = event.currentTarget.files && event.currentTarget.files[0];
                      if (picked) uploadMedia(picked, 'image');
                      event.currentTarget.value = '';
                    },
                  })
                )
              : null,
            tab === 'chats'
              ? h(
                  'label',
                  { className: 'fs-icon-btn fs-pick', title: '发送文件' },
                  '📎',
                  h('input', {
                    type: 'file',
                    style: { display: 'none' },
                    onChange: (event) => {
                      const picked = event.currentTarget.files && event.currentTarget.files[0];
                      if (picked) uploadMedia(picked, 'file');
                      event.currentTarget.value = '';
                    },
                  })
                )
              : null,
            h('span', { className: 'fs-status' }, notice || (tab === 'chats' ? 'Ctrl+Enter 发送' : 'Ctrl+Enter 建文档')),
            h('button', { className: 'fs-btn', type: 'button', disabled: busy || !draft.trim(), onClick: () => connect() }, '刷新状态'),
            tab === 'chats'
              ? h('button', { className: 'fs-btn fs-send', type: 'button', 'data-primary': 'true', disabled: busy || !draft.trim() || !chatId, onClick: send }, '发送')
              : h('button', { className: 'fs-btn fs-send', type: 'button', 'data-primary': 'true', disabled: busy || !draft.trim(), onClick: createDoc }, '建成文档')
          )
        )
      );
    }

    const inject = ['slots', 'sidebarRightTabs'];

    function apply(ctx) {
      ctx.effect(
        () =>
          ctx.sidebarRightTabs.register({
            id: 'feishu-plugin/panel',
            kind: 'feishu-panel',
            title: () => '飞书',
            keepMounted: true,
            guide: [{ id: 'feishu', order: 92, title: () => '飞书', description: () => '在 DSH 里收发飞书消息、写飞书文档' }],
          }),
        'feishu-plugin: sidebar tab'
      );
      ctx.effect(
        () =>
          ctx.slots.inject('sidebar.right.pane.tab', () =>
            ctx.slots.register(
              { name: 'sidebar.right.pane.tab', key: 'feishu-plugin/panel', inject: () => ({}) },
              (props) => h(PaneBoundary, null, h(FeishuPane, props))
            )
          ),
        'feishu-plugin: sidebar pane'
      );
    }

    return { name: 'feishu-plugin', inject, apply };
  },
});
