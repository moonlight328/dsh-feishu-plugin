// 整体重做面板样式：现代 SaaS / 互联网公司风。
import fs from 'node:fs';

const file = 'C:/Users/19941/notes/feishu-plugin/lib/client.js';
let t = fs.readFileSync(file, 'utf8');

const CSS = `:root{
        --fs-brand: var(--dsw-alias-label-primary-bluish, #4678ef);
        --fs-brand-soft: rgba(70,120,239,.1);
        --fs-brand-softer: rgba(70,120,239,.06);
        --fs-fg: var(--dsw-alias-label-primary, #1f2430);
        --fs-fg2: var(--dsw-alias-label-secondary, #6b7280);
        --fs-fg3: rgba(128,138,150,.85);
        --fs-line: var(--dsw-alias-border-l1, rgba(128,138,150,.22));
        --fs-line-soft: rgba(128,138,150,.14);
        --fs-hover: rgba(128,138,150,.1);
        --fs-fill: rgba(128,138,150,.14);
        --fs-bubble: rgba(128,138,150,.12);
        --fs-radius: 10px;
        --fs-shadow: 0 12px 32px rgba(15,23,42,.14), 0 2px 8px rgba(15,23,42,.06);
        --fs-shadow-sm: 0 1px 2px rgba(15,23,42,.06);
      }
      .fs-root{display:flex;flex-direction:column;height:100%;min-height:320px;font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",system-ui,sans-serif;color:var(--fs-fg);position:relative;overflow:hidden;-webkit-font-smoothing:antialiased}
      .fs-root *{box-sizing:border-box}
      .fs-root button{font:inherit;color:inherit;cursor:pointer;transition:background .14s ease,color .14s ease,opacity .14s ease,transform .14s ease}

      /* 顶栏 */
      .fs-bar{display:flex;align-items:center;gap:6px;padding:7px 12px 5px;flex:none}
      .fs-dot{width:6px;height:6px;border-radius:50%;background:#c0c6cf;flex:none}
      .fs-dot[data-state=ok]{background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.16);animation:fs-pulse 2.4s ease-in-out infinite}
      .fs-dot[data-state=fail]{background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.16)}
      @keyframes fs-pulse{0%,100%{opacity:1}50%{opacity:.45}}
      .fs-status{font-size:11px;color:var(--fs-fg2);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fs-bar .fs-btn{margin-left:auto}

      /* 页签：分段控件 */
      .fs-tabs{display:flex;gap:2px;margin:0 10px 6px;padding:2px;background:var(--fs-brand-softer);border-radius:9px;flex:none}
      .fs-tab{flex:1;border:0;background:transparent;color:var(--fs-fg2);font-size:11.5px;font-weight:500;padding:5px 0;border-radius:7px}
      .fs-tab:hover{color:var(--fs-fg)}
      .fs-tab[data-active=true]{background:var(--fs-bg, #fff);color:var(--fs-fg);font-weight:600;box-shadow:var(--fs-shadow-sm)}

      /* 按钮 */
      .fs-btn{border:1px solid var(--fs-line);background:var(--fs-bg, transparent);border-radius:8px;font-size:11.5px;font-weight:500;padding:4px 9px;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
      .fs-btn:hover{background:var(--fs-hover);border-color:var(--fs-line)}
      .fs-btn:active{transform:scale(.97)}
      .fs-btn[data-active=true]{background:var(--fs-brand-soft);border-color:transparent;color:var(--fs-brand);font-weight:600}
      .fs-btn[data-primary=true]{background:var(--fs-brand);border-color:transparent;color:#fff;font-weight:600;box-shadow:0 2px 8px rgba(70,120,239,.24)}
      .fs-btn[data-primary=true]:hover{filter:brightness(1.06)}
      .fs-btn:disabled{opacity:.45;cursor:default}
      .fs-btn[data-danger=true]{color:#e5484d;border-color:transparent;background:transparent}
      .fs-btn[data-danger=true]:hover{background:rgba(229,72,77,.1)}
      .fs-icon-btn{width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;border-radius:6px;color:var(--fs-fg2);font-size:13px;line-height:1}
      .fs-icon-btn:hover{background:var(--fs-hover);color:var(--fs-fg)}
      .fs-chip{font-size:10.5px;color:var(--fs-fg2);background:var(--fs-brand-softer);border-radius:6px;padding:2px 7px;white-space:nowrap}

      /* 通用滚动区 / 空态 */
      .fs-scroll{flex:1;min-height:0;overflow:auto;padding:4px}
      .fs-scroll::-webkit-scrollbar{width:8px;height:8px}
      .fs-scroll::-webkit-scrollbar-thumb{background:rgba(128,138,150,.28);border-radius:8px;border:2px solid transparent;background-clip:content-box}
      .fs-scroll::-webkit-scrollbar-thumb:hover{background:rgba(128,138,150,.45);background-clip:content-box}
      .fs-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--fs-fg2);font-size:11.5px;text-align:center;padding:24px 16px;line-height:1.7}
      .fs-empty-emoji{font-size:22px;opacity:.75}
      .fs-err{color:#e5484d;font-size:11px;padding:6px 10px;background:rgba(229,72,77,.08);border-radius:8px;margin:4px 8px}
      .fs-hint{font-size:11px;color:var(--fs-fg2);line-height:1.7;padding:8px 10px;background:var(--fs-brand-softer);border-radius:8px;margin:4px 8px}

      /* 会话列表 */
      .fs-chat-body{display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden}
      .fs-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;position:relative}
      .fs-row:hover{background:var(--fs-hover)}
      .fs-row[data-active=true]{background:var(--fs-brand-soft)}
      .fs-row[data-active=true]:before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:2px;height:16px;border-radius:2px;background:var(--fs-brand)}
      .fs-avatar{width:24px;height:24px;flex:none;border-radius:7px;background:linear-gradient(135deg,rgba(70,120,239,.16),rgba(70,120,239,.06));color:var(--fs-brand);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600}
      .fs-row-body{min-width:0;flex:1}
      .fs-row-name{font-size:12.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fs-row-sub{font-size:10.5px;color:var(--fs-fg2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

      /* 消息 */
      .fs-msg-row{display:flex;flex-direction:column;margin:6px 2px}
      .fs-msg-row[data-mine=true]{align-items:flex-end}
      .fs-bubble{max-width:86%;padding:7px 10px;border-radius:12px;background:var(--fs-bubble);font-size:12.5px;line-height:1.6;word-break:break-word;white-space:pre-wrap;position:relative}
      .fs-msg-row[data-mine=true] .fs-bubble{background:linear-gradient(180deg,#4f7ef5,#4678ef);color:#fff;box-shadow:0 2px 10px rgba(70,120,239,.22)}
      .fs-bubble-meta{font-size:9.5px;color:var(--fs-fg3);margin-top:3px;opacity:.85}
      .fs-msg-row[data-mine=true] .fs-bubble-meta{text-align:right}
      .fs-emoji{font-size:22px;line-height:1.2}
      .fs-img{max-width:100%;border-radius:9px;display:block;margin:2px 0}

      /* 输入区 */
      .fs-composer{flex:none;border-top:1px solid var(--fs-line-soft);padding:8px 10px 9px;display:flex;flex-direction:column;gap:6px;background:var(--fs-bg, transparent)}
      .fs-composer textarea{width:100%;min-height:50px;max-height:120px;resize:vertical;border:1px solid var(--fs-line);background:var(--fs-bg, transparent);color:inherit;border-radius:9px;padding:7px 9px;font:inherit;font-size:12.5px;line-height:1.6;transition:border-color .14s ease,box-shadow .14s ease}
      .fs-composer textarea:focus{outline:none;border-color:var(--fs-brand);box-shadow:0 0 0 3px rgba(70,120,239,.14)}
      .fs-row-line{display:flex;align-items:center;gap:8px}
      .fs-send{flex:none;margin-left:auto}

      /* 文档：左右分栏 */
      .fs-split{display:flex;flex:1;min-height:0}
      .fs-dlist{width:152px;flex:none;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--fs-line-soft);background:var(--fs-brand-softer)}
      .fs-dlist-top{display:flex;gap:4px;align-items:center;padding:7px 7px 5px}
      .fs-newdoc{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid transparent;background:var(--fs-brand);color:#fff;border-radius:8px;font-size:11.5px;font-weight:600;padding:4px 0;box-shadow:0 2px 8px rgba(70,120,239,.22)}
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
      .fs-search-input:focus{outline:none;border-color:var(--fs-brand);box-shadow:0 0 0 2px rgba(70,120,239,.12)}
      .fs-dlist-body{flex:1;min-height:0;overflow:auto;padding:0 5px 8px}
      .fs-dlist-body::-webkit-scrollbar{width:7px}
      .fs-dlist-body::-webkit-scrollbar-thumb{background:rgba(128,138,150,.26);border-radius:7px}
      .fs-drow{display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:7px;cursor:pointer;position:relative}
      .fs-drow:hover{background:var(--fs-hover)}
      .fs-drow[data-active=true]{background:var(--fs-brand-soft)}
      .fs-drow[data-active=true]:before{content:"";position:absolute;left:0;top:50%;transform:translateY(-50%);width:2px;height:14px;border-radius:2px;background:var(--fs-brand)}
      .fs-dicon{width:18px;height:18px;flex:none;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:600;background:var(--fs-fill);color:var(--fs-fg2)}
      .fs-dicon[data-kind=docx]{background:rgba(70,120,239,.14);color:#3b6fe0}
      .fs-dicon[data-kind=folder]{background:rgba(245,158,11,.16);color:#b7791f}
      .fs-dicon[data-kind=sheet]{background:rgba(34,197,94,.15);color:#18864b}
      .fs-dname{font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
      .fs-drow[data-kind=folder] .fs-dname{font-weight:600}
      .fs-drow[data-kind=up] .fs-dname{font-weight:600;opacity:.85}
      .fs-dlist-empty{font-size:10.5px;color:var(--fs-fg3);text-align:center;padding:14px 6px;line-height:1.6}

      /* 文档：编辑区 */
      .fs-doc-wrap{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}
      .fs-doc-head{display:flex;align-items:center;gap:5px;flex:none;padding:7px 10px 5px;border-bottom:1px solid var(--fs-line-soft)}
      .fs-doc-head .fs-status{font-size:10px;color:var(--fs-fg3);flex:1;text-align:right}
      .fs-doc-main{display:flex;flex:1;min-height:0}
      .fs-doc-body{flex:1;min-width:0;overflow:auto;padding:18px 16px 80px;position:relative}
      .fs-doc-body::-webkit-scrollbar{width:8px}
      .fs-doc-body::-webkit-scrollbar-thumb{background:rgba(128,138,150,.26);border-radius:8px}
      .fs-block{position:relative;padding-left:16px;margin:0 auto;max-width:640px}
      .fs-gutter{position:absolute;left:0;top:6px;font-size:9px;color:var(--fs-fg3);opacity:0;transition:opacity .12s ease;user-select:none;font-weight:600}
      .fs-block:hover .fs-gutter{opacity:.75}
      .fs-collapse{position:absolute;left:0;top:5px;width:15px;height:15px;border:0;background:transparent;color:var(--fs-fg2);font-size:9px;border-radius:4px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .12s ease}
      .fs-block:hover .fs-collapse{opacity:1}
      .fs-collapse:hover{background:var(--fs-hover)}
      .fs-block[data-type=h1] .fs-block-text{font-size:21px;font-weight:700;line-height:1.35;letter-spacing:-.01em;margin:16px 0 6px}
      .fs-block[data-type=h2] .fs-block-text{font-size:16.5px;font-weight:650;line-height:1.4;margin:14px 0 5px}
      .fs-block[data-type=h3] .fs-block-text{font-size:14px;font-weight:650;line-height:1.5;margin:12px 0 4px}
      .fs-block-text{font-size:13px;line-height:1.75;outline:none;white-space:pre-wrap;word-break:break-word;padding:2px 0;border-radius:4px;min-height:22px}
      .fs-block-text:focus{background:var(--fs-brand-softer);box-shadow:0 0 0 2px rgba(70,120,239,.1)}
      .fs-block[data-type=bullet] .fs-block-text{padding-left:14px;position:relative}
      .fs-block[data-type=bullet] .fs-block-text:before{content:"";position:absolute;left:3px;top:10px;width:4px;height:4px;border-radius:50%;background:var(--fs-fg2);opacity:.6}
      .fs-block[data-type=ordered] .fs-block-text{padding-left:18px;position:relative}
      .fs-block[data-type=ordered] .fs-block-text:before{content:"1.";position:absolute;left:0;top:0;color:var(--fs-fg2)}
      .fs-block[data-type=code] .fs-block-text{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px;line-height:1.65;background:var(--fs-fill);border-radius:8px;padding:9px 11px;color:var(--fs-fg)}
      .fs-block-text[data-empty=true]:before{color:var(--fs-fg3);font-weight:400;pointer-events:none}
      .fs-doc-img{display:block;max-width:100%;border-radius:10px;margin:6px 0;border:1px solid var(--fs-line-soft)}
      .fs-doc-tail{display:flex;align-items:center;gap:8px;margin:14px auto 0;max-width:640px;padding-left:16px;flex-wrap:wrap}
      .fs-doc-tail .fs-status{font-size:10px;color:var(--fs-fg3);flex:1}

      /* 大纲侧栏 */
      .fs-outline-rail{flex:none;width:0;overflow:hidden;display:flex;flex-direction:column;border-left:1px solid transparent;transition:width .16s ease,border-color .16s ease;background:var(--fs-brand-softer)}
      .fs-outline-rail[data-open=true]{width:138px;border-left-color:var(--fs-line-soft)}
      .fs-outline-head{display:flex;align-items:center;gap:4px;padding:8px 8px 4px;flex:none}
      .fs-outline-title{font-size:10.5px;font-weight:650;color:var(--fs-fg2);letter-spacing:.04em;text-transform:uppercase;flex:1}
      .fs-outline-list{flex:1;min-height:0;overflow:auto;padding:0 6px 10px}
      .fs-outline-list::-webkit-scrollbar{width:6px}
      .fs-outline-list::-webkit-scrollbar-thumb{background:rgba(128,138,150,.24);border-radius:6px}
      .fs-outline-item{display:block;width:100%;text-align:left;border:0;background:transparent;font-size:11px;line-height:1.5;padding:3px 6px;border-radius:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fs-fg2)}
      .fs-outline-item:hover{background:var(--fs-hover);color:var(--fs-fg)}
      .fs-outline-item[data-level="1"]{font-weight:600;color:var(--fs-fg);font-size:11.5px}
      .fs-outline-item[data-level="2"]{padding-left:14px}
      .fs-outline-item[data-level="3"]{padding-left:24px;font-size:10.5px;opacity:.82}
      .fs-outline-empty{font-size:10.5px;color:var(--fs-fg3);padding:10px 8px;line-height:1.6}

      /* 右键菜单 */
      .fs-menu{position:fixed;z-index:60;min-width:158px;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--fs-line);border-radius:10px;box-shadow:var(--fs-shadow);padding:4px;animation:fs-pop .12s ease-out}
      @keyframes fs-pop{from{opacity:0;transform:translateY(-3px) scale(.985)}to{opacity:1;transform:none}}
      .fs-menu-item{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;text-align:left;font-size:12px;padding:5px 8px;border-radius:7px}
      .fs-menu-item:hover{background:var(--fs-brand-soft);color:var(--fs-brand)}
      .fs-menu-item[data-active=true]{background:var(--fs-brand-soft);color:var(--fs-brand);font-weight:600}
      .fs-menu-item[data-danger=true]:hover{background:rgba(229,72,77,.1);color:#e5484d}
      .fs-menu-key{margin-left:auto;font-size:10px;color:var(--fs-fg3);font-family:ui-monospace,monospace}
      .fs-menu-sep{height:1px;background:var(--fs-line-soft);margin:4px 2px}

      /* 弹层（新建文档 / 重命名等） */
      .fs-sheet{position:absolute;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,23,42,.32);backdrop-filter:blur(2px);animation:fs-fade .14s ease-out}
      @keyframes fs-fade{from{opacity:0}to{opacity:1}}
      .fs-sheet-card{width:100%;max-width:300px;background:var(--dsw-alias-bg-base,#fff);border:1px solid var(--fs-line);border-radius:14px;box-shadow:var(--fs-shadow);padding:14px;display:flex;flex-direction:column;gap:10px;animation:fs-rise .16s ease-out}
      @keyframes fs-rise{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}
      .fs-sheet-title{font-size:13.5px;font-weight:650;letter-spacing:-.01em}
      .fs-sheet-note{font-size:11px;color:var(--fs-fg2);line-height:1.6}
      .fs-sheet-body{display:flex;flex-direction:column;gap:8px}
      .fs-sheet-input{width:100%;border:1px solid var(--fs-line);background:var(--fs-bg, transparent);color:inherit;border-radius:9px;padding:7px 9px;font:inherit;font-size:12.5px}
      .fs-sheet-input:focus{outline:none;border-color:var(--fs-brand);box-shadow:0 0 0 3px rgba(70,120,239,.14)}
      .fs-sheet-actions{display:flex;gap:6px;justify-content:flex-end}
      .fs-sheet-head{display:flex;align-items:center;gap:6px}
      .fs-sheet-body textarea{width:100%;min-height:110px;resize:vertical;border:1px solid var(--fs-line);background:var(--fs-bg, transparent);color:inherit;border-radius:9px;padding:7px 9px;font:inherit;font-size:12.5px;line-height:1.6}
      .fs-sheet-body textarea:focus{outline:none;border-color:var(--fs-brand);box-shadow:0 0 0 3px rgba(70,120,239,.14)}
      .fs-select,.fs-sheet select{border:1px solid var(--fs-line);background:var(--fs-bg, transparent);color:inherit;border-radius:8px;font:inherit;font-size:11.5px;padding:4px 6px}
      .fs-doc-go{display:none}`;

const start = t.indexOf('const CSS = `');
if (start < 0) {
  console.error('CSS start not found');
  process.exit(1);
}
const endMark = '`;';
const end = t.indexOf(endMark, start);
if (end < 0) {
  console.error('CSS end not found');
  process.exit(1);
}
const before = t.slice(0, start);
const after = t.slice(end + endMark.length);
fs.writeFileSync(file, before + 'const CSS = `' + CSS + '`;' + after, 'utf8');
console.log('CSS 替换完成，新长度:', CSS.length);
