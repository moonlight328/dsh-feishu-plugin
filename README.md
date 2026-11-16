# dsh-feishu-plugin

把飞书接进 DSH（DeepSeek Harness）侧栏：在对话里收发群消息、浏览云空间文件夹、读写飞书文档。

不用切浏览器，不用把文案复制来复制去。

## 功能

### 会话
- 列出发机器人所在的群，收发消息
- 支持文本、图片、表情（`[笑哭]` 这类短代码转成真表情）、文件、语音等类型
- 5 秒轮询收新消息，滚动到底部自动贴底

### 云空间（文件夹浏览）
- **双身份切换**：「我的」（你的账号，OAuth） / 「机器人」（应用自己的空间）
- 面包屑导航 + 「上一级」返回
- 右键：新建文件夹 / 新建文档 / 打开 / 重命名 / **移动到其他文件夹** / 删除
- 移动支持文件夹本身

### 文档编辑
- 块级编辑器：正文 / H1-H3 / 无序 / 有序 / 代码块，回车分段，行首 `#` 变标题、`-` 变列表
- 悬停显示段类型标记，点箭头**按标题折叠**内容
- **大纲侧栏**：右侧抽屉列出 H1/H2/H3，点击跳转
- 图片块渲染（走你的身份下载媒体）
- **字体与字号**：系统/宋体/楷体/圆体/等宽 + **导入本地字体**（ttf/otf/woff/woff2），字号 10–24px
- 右键菜单改块类型、上移/下移、删除
- Ctrl+S 保存；保存前自动写 Markdown 备份

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
| 空块里按 `/` | 弹出块菜单（↑↓ 选、Enter 确认、Esc 取消） |
| 拖块左侧的类型标记 | 拖动调整块顺序（有落点指示线） |
| `↑` / `↓` 在块首尾 | 光标跳到相邻可编辑块 |
| `#` `##` `###` + 空格 | 变成标题 1/2/3 |
| `-` `*` `+` + 空格 | 变成无序列表 |
| `1.` + 空格 | 变成有序列表（序号自动按连续项算） |
| 三个反引号 + 空格/回车 | 变成代码块 |
| `Enter` | 分段（中文输入法选词时的回车不会切段） |
| `Backspace` 在行首 | 并到上一段 |
| `Ctrl/⌘ + S` | 保存 |
| `Ctrl/⌘ + F` | 查找替换 |

粘贴一律只取纯文本（网页 / Word / 飞书带进来的样式会污染块内容）；多段文本会自动拆成多个段落。

消息面板支持富文本（链接、@提及、行内代码、表情）和内嵌文件下载；`post` 类型不再被拍平成一行纯文本。

**并发修改**：打开文档时会记下 revision，保存前再比对一次。如果这期间有人在飞书里改过，会先弹确认（并说明新旧版本号），不会默默覆盖；确认后才写，写之前照样备份块 JSON。

## 开发

```bash
node scripts/lint.mjs          # 语法检查
node scripts/test-client.mjs   # 用 react-dom/server 渲染面板，验证 bundle 能加载
node scripts/test-bridge.mjs   # 本地起桥，逐个端点自检
node scripts/shots.mjs         # 无头浏览器截三张界面图
```

## 发布

```bash
node scripts/release.mjs "新功能：xxx"   # bump patch + 更新 CHANGELOG + commit + tag + push
```

## 保存与数据安全

保存是「整篇覆盖」，所以做成**先体检、再动手**：

1. 打开文档时把每个块的类型记下来。编辑器能无损读写的只有段落、标题 1~3、无序、有序、代码、图片。
2. 其它块（表格、待办、引用、高亮块、分割线、分栏…）在编辑器里显示成**只读占位**，标着类型名。
3. 带行内样式（加粗、斜体、链接、@人、颜色）的段落也会被标记。
4. 这种情况下点保存，桥会**直接拒绝**（`UNSAFE_OVERWRITE`），一个块都不追加、不删除，文档保持原样。想改这些内容请去飞书里编辑。
5. 允许保存时，会先把**块 JSON**（含飞书原始字段）落到 `~/.dsh/feishu-docx-backups/`，再「先追加新块 → 后删旧块」——中途失败最多内容重复，不会清空。
6. 块列表按 `page_token` 翻页取全，超过一页（500 块）的长文档也不会只删掉前半截。

编辑区有未保存标记；按 `Ctrl+S` / `⌘S` 保存；返回列表或切换文档前会先确认。

## 桥的安全边界

本地桥只服务 DSH 自己的页面：

- `Host` 只接受 `127.0.0.1` / `localhost` / `[::1]`（防 DNS 重绑定）
- `Origin` 只接受回环 http 和 `dsh-app://`（DSH NEXT 桌面壳的页面来源）；`file://` 和 `Origin: null` 一律拒绝
- 写接口强制 `Content-Type: application/json`，浏览器必须先发预检，挡掉 form / text-plain 这类「简单请求」跨站调用
- OAuth 回调页对 URL 参数和飞书返回值做 HTML 转义

## 已知限制

- 保存是整篇覆盖，所以含表格/待办/引用/行内样式的文档会被拦下（见上一节），目前不支持在面板里编辑它们
- 只支持 docx；多维表格、电子表格能列出和移动，但不在面板里编辑
- 字体设置只影响面板内的显示，不改飞书文档本身的字体
- 消息轮询仍是 5 秒 / 群列表 20 秒，切到别的页签时也会继续（还没接飞书事件订阅）

## License

MIT
