# 飞书接入：你要做的三步（约 5 分钟）

插件已经装好了（`feishu-plugin`，bundle 方式注册），工具也齐了：
`feishu_status` / `feishu_find_chat` / `feishu_send_message` / `feishu_create_doc` / `feishu_append_doc` / `feishu_read_doc`。
现在只差你建一个自建应用，把凭证给我。

## 1. 建应用、拿凭证

1. 打开 <https://open.feishu.cn/app> → **创建企业自建应用**（名字随便，比如「DSH 助手」）
2. 左侧 **添加应用能力** → 添加 **机器人**
3. 左侧 **凭证与基础信息** → 复制 **App ID** 和 **App Secret**

## 2. 开权限（权限管理里逐个搜，勾上后保存）

| scope | 用途 |
| --- | --- |
| `im:message` | 发消息 |
| `im:message:send_as_bot` | 以应用身份发消息 |
| `im:chat:readonly` | 列出机器人所在的群（找群用） |
| `docx:document` | 创建 / 编辑新版文档（写文案用） |
| `drive:drive` | 云空间文件（把文档建到指定文件夹） |

保存后页面顶部通常会出现「创建版本」的提示。

## 3. 发版 + 把机器人拉进群

1. 左侧 **版本管理与发布** → **创建版本** → 可用范围选「部分成员」并加上你自己 → **申请发布**
   （企业自建应用要管理员审批，你自己的企业自己点通过就行）
2. 打开你要发消息的群 → 右上 **设置** → **群机器人** → **添加机器人** → 搜你刚建的应用名
3. （可选）想指定文档落到某个文件夹：飞书云文档里进那个文件夹，地址栏 `/folder/<这一段>` 就是 `folder_token`

## 拿到凭证之后

把 **App ID** 和 **App Secret** 发我，我写进 profile 的 `cordis.patch.yml`（明文存在本机），
然后冷启动一次 DSH，六把工具就都能用了。

不想把 secret 贴聊天里也行：重启后你自己填进插件设置卡片，或者直接编辑
`C:\Users\19941\.dsh\profiles\desktop\cordis.patch.yml` 里 `- id: feishu` 那一段的 `appId` / `appSecret`。

## 配好之后怎么用

- 「把这个写成飞书文档」→ 我调 `feishu_create_doc`，返回 `documentId`
- 「往这个文档再加一段」→ `feishu_append_doc`
- 「发到 XX 群」→ 我先 `feishu_find_chat` 找 chat_id，再 `feishu_send_message`
- 「读一下那篇文档」→ `feishu_read_doc`

写入的 Markdown 会按「标题 / 段落 / 列表 / 代码块」转成飞书文档块；行内粗体、链接、表格暂不映射（v1 保持纯文本，避免写出半残格式）。
