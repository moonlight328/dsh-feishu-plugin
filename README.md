# dsh-feishu-plugin

把飞书接进 DSH（DeepSeek Harness）侧栏：在对话里收发群消息、浏览云空间文件夹、读写飞书文档。

不用切浏览器，不用把文案复制来复制去。

## 功能

### 会话
- 列机器人所在的群，收发消息
- **乐观发送**：点发送立刻出现在列表里（发送中半透明），失败变红并「点此重发」；本地未确认的消息不会被轮询冲掉
- 文本 / 图片 / 文件（可点下载，带大小）/ 表情包；富文本保留**链接、@提及、行内代码、表情**（`[笑哭]` 这类短代码会渲染成 😂）
- 5 秒轮询收新消息，滚动到底自动贴底；「加载更早」翻历史
- 面板隐藏时暂停轮询，失败按指数退避（最多 60 秒一次）

### 云空间
- **双身份切换**：「我的」（你的账号，OAuth）/「机器人」（应用自己的空间）
- 面包屑导航 + 「上一级」返回
- 右键：新建文件夹 / 新建文档 / 打开 / 重命名 / **移动到其他文件夹** / 删除
- **全局搜索**：侧栏搜索框走 `suite/docs-api/search/object`，跨文件夹搜整个云空间
- 移动、重命名、删除后只更新本地列表，不整页重拉

### 文档编辑
- 块类型：正文 / 标题 1-3 / 无序 / 有序 / 代码 / **待办** / **引用** / **分割线** / 图片
- **斜杠菜单**（空块按 `/`）、右键菜单、**块拖拽排序**（有落点线）、**↑↓ 跨块移动光标**
- **行内格式**：选中文字浮出格式条 —— 加粗 / 斜体 / 下划线 / 删除线 / 行内代码 / 链接
- **撤销重做**（自建历史栈，连续输入合并成一步）
- 大纲侧栏（点击跳转）、查找替换（`Ctrl+F`）、字体字号 / 导入本地字体
- 按标题折叠、有序列表自动编号

保存策略、并发保护和备份见 [保存与数据安全](#保存与数据安全)。

## 安装

```bash
# 1. 放进 DSH 插件目录
git clone https://github.com/<you>/dsh-feishu-plugin.git ~/.dsh/plugins/feishu-plugin

# 2. 依赖（与宿主共用同一份，用 junction 指过去，Windows）
#    node_modules/<包> → DSH 自带的那套 @deepseek-ai/*

# 3. 在 profile 里登记（~/.dsh/profiles/<profile>/package.json）
#    dependencies: { "feishu-plugin": "link:.../feishu-plugin" }
#    dsh.profile.bundles 末尾追加 "feishu-plugin"
```

改完 profile 需要重载 DSH。

## 配置

在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: feishu
  config:
    appId: cli_xxxxxxxxxxxx
    appSecret: xxxxxxxxxxxxxxxxxxxxxx
    domain: feishu            # 或 lark
    bridgePort: 6820
    redirectUri: http://127.0.0.1:6820/oauth/callback
    scopes: drive:drive space:document:retrieve docx:document im:resource
```

### 飞书开放平台要开的权限

| 权限 | 身份 | 用途 |
| --- | --- | --- |
| `drive:drive` | 用户 | 列文件夹、建文件夹、重命名、移动、删除 |
| `docx:document` | 用户 | 新建文档、读写正文块、改标题 |
| `space:document:retrieve` | 用户 | 云空间检索（可替代上一项） |
| `im:message` | 应用 | 读群消息 |
| `im:message:send_as_bot` | 应用 | 以机器人身份发消息 |
| `im:chat:readonly` | 应用 | 列机器人所在的群 |
| `im:resource` | 应用 | 下载消息里的图片 |

**重定向 URL** 必须与控制台「安全设置」里登记的一致，默认 `http://127.0.0.1:6820/oauth/callback`。

权限变更后要**创建版本 → 申请发布 → 审批通过**才生效；已授权的 token 不会自动长出新权限，需要重新授权。

## 架构

```
lib/index.js     Cordis 插件（host 半）：飞书客户端 + OAuth + 7 个 agent 工具 + 本地桥
lib/bridge.js    面板用的 HTTP 桥（/feishu-panel/*）
lib/userauth.js  OAuth 授权码流程、token 刷新、权限缺口判断
lib/markdown.js  Markdown ⇄ 飞书 docx 块转换
lib/client.js    侧栏面板（client 半）：会话 / 文档 / 网页版
```

面板桥跑在 6820–6825（自动探测空闲端口），所有请求只监听 127.0.0.1。

**身份用在哪**：

| 场景 | 身份 |
| --- | --- |
| 会话列表、收发消息、下载消息图片 / 文件 | 应用（机器人） |
| 云空间浏览、建/改/移/删、文档读写 | 用户（OAuth） |

## 编辑器快捷键与快捷输入

| 操作 | 效果 |
| --- | --- |
| 空块里按 `/` | 弹出块菜单（↑↓ 选、Enter 确认、Esc 取消）：正文 / 标题 1-3 / 无序 / 有序 / 代码 / 待办 / 引用 / 分割线 |
| 拖块左侧的类型标记 | 拖动调整块顺序（有落点指示线） |
| `↑` / `↓` 在块首尾 | 光标跳到相邻可编辑块 |
| 选中文字 | 浮出格式条：加粗 / 斜体 / 下划线 / 删除线 / 行内代码 / 链接 |
| `#` `##` `###` + 空格 | 变成标题 1/2/3 |
| `-` `*` `+` + 空格 | 变成无序列表 |
| `1.` + 空格 | 变成有序列表（序号自动按连续项算） |
| 三个反引号 + 空格/回车 | 变成代码块 |
| `Enter` | 分段（中文输入法选词时的回车不会切段） |
| `Backspace` 在行首 | 并到上一段 |
| `Ctrl/⌘ + S` | 保存 |
| `Ctrl/⌘ + F` | 查找替换 |
| `Ctrl/⌘ + Z` / `Ctrl/⌘ + Shift + Z` | 撤销 / 重做 |

粘贴一律只取纯文本（网页 / Word / 飞书带进来的样式会污染块内容）；多段文本会自动拆成多个段落。

消息面板支持富文本（链接、@提及、行内代码、表情）和内嵌文件下载；`post` 类型不再被拍平成一行纯文本。

**并发修改**：打开文档时会记下 revision，保存前再比对一次。如果这期间有人在飞书里改过，会先弹确认（并说明新旧版本号），不会默默覆盖；确认后才写，写之前照样备份块 JSON。

## 开发

```bash
node scripts/lint.mjs          # 语法 / 结构检查（20 项）
node scripts/test-p0.mjs       # 桥端点 + 保存全流程（含增量保存、revision 冲突、结构锁定）
node scripts/test-msg.mjs      # 消息解析（富文本、表情、附件）
node scripts/test-upload.mjs   # 媒体上传
node scripts/test-client.mjs   # 用 react-dom/server 渲染整个面板，验证 bundle 能加载
node scripts/make-shots.mjs    # 无头浏览器跑 14 个交互场景并截图（打字、拖拽、输入法、撤销、搜索…）
```

`make-shots.mjs` 会在截图顶部画 `IME OK` / `DRAG OK` / `UNDO OK` / `SEARCH OK` 这类横幅，判断是真实跑过 DOM 事件的，不是摆拍。

## 发布

```bash
node scripts/release.mjs "改动说明" patch   # 或 minor / major
```

会依次：跑 lint → 升版本 → 写 CHANGELOG → 同步到 `~/.dsh/plugins/feishu-plugin` → commit → tag → push。

## 还没做的

按影响排序，都是明确评估后**主动跳过**的：

| 项 | 为什么没做 |
| --- | --- |
| 国际化 | 界面只有中文；用户是中文场景，抽 60+ 处文案改错的风险大于收益 |
| 事件订阅替代轮询 | 要后台开长连接 + 引 `@larksuiteoapi/node-sdk` + 写 WS 客户端；5 秒轮询已够用，且有退避和隐藏暂停 |
| 虚拟滚动 | 消息一页 40 条不需要；文档块已用「元素缓存」解决打字卡顿，真虚拟化在块高不一时容易错位 |
| 构建拆分（拆成 src/ 模块） | 纯工程改造、界面无变化，会显著增加构建复杂度；现在单文件 `client.js` 不需要构建步骤 |
| 高亮块 / 分栏 / 表格的编辑 | 这些块有子块嵌套，编辑器模型不支持嵌套结构；只能在飞书里改 |

## 保存与数据安全

保存有两种模式，按文档内容自动选。

**A. 增量保存**（文档里有编辑器读不全的块时）

只对**你改过文字或样式**的块发 `PATCH /docx/v1/documents/{id}/blocks/{blockId}`，其它块一个字节都不碰。

- 能改：段落、标题、列表、代码块、待办、引用的文字，以及它们的**加粗 / 斜体 / 下划线 / 删除线 / 行内代码 / 链接**
- 待办勾选走另一条通道：`update_text_style` + `fields:[2]`（飞书要字段掩码，少了报 field validation failed）
- 不动：编辑器不认识的块（表格、高亮块、分栏、多维表格…）
- 不能做：**增删段落**（块数变了会被拒绝，返回 `STRUCTURE_LOCKED` 并说明原因）
- 带样式的块如果前端没带样式快照，会跳过而不是盲改（宁可不动，也不把加粗冲掉）

**B. 整篇覆盖**（文档里全是纯文本块时）

先把**块 JSON**（含飞书原始字段）落到 `~/.dsh/feishu-docx-backups/`，再「先追加新块 → 后删旧块」——中途失败最多内容重复，不会清空。

两种模式共同的护栏：

1. 打开时记 revision，保存前比对；期间别人在飞书里改过会先弹确认（带新旧版本号），确认前一个字都不写
2. 块列表按 `page_token` **翻页取全**，超过一页（500 块）的长文档不会只删掉前半截
3. 编辑区有未保存标记；`Ctrl+S` / `⌘S` 保存；返回列表或切换文档前先确认
4. 每次保存都把现有块落成 JSON 备份，出事能捞

## 桥的安全边界

本地桥只服务 DSH 自己的页面：

- `Host` 只接受 `127.0.0.1` / `localhost` / `[::1]`（防 DNS 重绑定）
- `Origin` 只接受回环 http 和 `dsh-app://`（DSH NEXT 桌面壳的页面来源）；`file://` 和 `Origin: null` 一律拒绝
- 写接口强制 `Content-Type: application/json`，浏览器必须先发预检，挡掉 form / text-plain 这类「简单请求」跨站调用
- OAuth 回调页对 URL 参数和飞书返回值做 HTML 转义

## 已知限制

- 含表格 / 高亮块 / 分栏的文档只能**改文字**，不能增删段落（见 [保存与数据安全](#保存与数据安全)）；要动这些块请去飞书
- 只支持 docx；多维表格、电子表格、幻灯片能搜到、能列出和移动，但不在面板里编辑
- 字体设置只影响面板内的显示，不改飞书文档本身的字体
- 消息轮询仍是 5 秒 / 群列表 20 秒（没接事件订阅）
- 界面文案只有中文

## License

MIT
