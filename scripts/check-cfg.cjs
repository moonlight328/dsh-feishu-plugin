const fs = require("node:fs");
const YAML = require("C:/Users/19941/.dsh/profiles/node_modules/yaml");
const doc = YAML.parse(fs.readFileSync("C:/Users/19941/.dsh/profiles/desktop/cordis.patch.yml", "utf8"), { customTags: [{ tag: "!!js", resolve: (v) => v }] });
const row = doc.find((e) => e && e.id === "feishu");
const cfg = row.config || {};
const mask = (v) => (v ? v.slice(0, 6) + "…" + v.slice(-3) : "(empty)");
console.log("appId     =", mask(cfg.appId), "len", String(cfg.appId || "").length);
console.log("appSecret =", mask(cfg.appSecret), "len", String(cfg.appSecret || "").length);
console.log("domain    =", cfg.domain);
