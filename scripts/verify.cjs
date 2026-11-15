const fs = require("node:fs");
const YAML = require("C:/Users/19941/.dsh/profiles/node_modules/yaml");
const patch = YAML.parse(fs.readFileSync("C:/Users/19941/.dsh/profiles/desktop/cordis.patch.yml", "utf8"), { customTags: [{ tag: "!!js", resolve: (v) => v }] });
const feishuRow = patch.filter((e) => e && e.id === "feishu");
console.log("profile patch: feishu override rows =", feishuRow.length, JSON.stringify(feishuRow.map((r) => r.config)));
const bundlePatch = YAML.parse(fs.readFileSync("C:/Users/19941/.dsh/plugins/feishu-plugin/cordis.patch.yml", "utf8"));
console.log("bundle patch rows:", bundlePatch[0].insert.map((r) => r.id + ":" + r.name).join(","));
const pkg = JSON.parse(fs.readFileSync("C:/Users/19941/.dsh/profiles/desktop/package.json", "utf8"));
console.log("bundles:", pkg.dsh.profile.bundles.slice(-2).join(","));
