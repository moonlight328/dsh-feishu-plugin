const fs = require("node:fs");
const YAML = require("C:/Users/19941/.dsh/profiles/node_modules/yaml");
const doc = YAML.parse(fs.readFileSync("C:/Users/19941/.dsh/profiles/desktop/cordis.patch.yml", "utf8"), { customTags: [{ tag: "!!js", resolve: (v) => v }] });
const cfg = doc.find((e) => e && e.id === "feishu").config;

(async () => {
  const mod = await import("feishu-plugin");
  const tools = [];
  const ctx = { effect: (fn) => fn(), tools: { register: (d) => (tools.push(d), () => {}) }, get: () => null };
  mod.apply(ctx, cfg);
  const tool = (n) => tools.find((t) => t.name === n);

  const step = async (label, fn) => {
    try { const r = await fn(); console.log(`[OK] ${label}:`, JSON.stringify(r).slice(0, 400)); return r; }
    catch (e) { console.log(`[FAIL] ${label}:`, e.message); return null; }
  };

  await step("status(bot info)", () => tool("feishu_status").execute({}, {}));
  await step("find_chat(全部)", () => tool("feishu_find_chat").execute({}, {}));
  const created = await step("create_doc", () => tool("feishu_create_doc").execute({ title: "DSH 接入自检", markdown: "# DSH 接入自检\n\n这是一条从 DSH 写入飞书文档的测试。\n\n- 第一条\n- 第二条\n\n```js\nconsole.log(1)\n```" }, {}));
  if (created && created.documentId) {
    await step("read_doc", () => tool("feishu_read_doc").execute({ documentId: created.documentId }, {}));
  }
})().catch((e) => console.log("HARNESS FAIL:", e.message));