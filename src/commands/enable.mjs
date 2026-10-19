import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalTheme } from "../theme.mjs";
import { resolveRemoteTheme } from "../remote.mjs";
import { lastManifestVersion, writeState, currentDir } from "../state.mjs";
import { findCodexBundle, verifyCodexSignature } from "../codex.mjs";
import { findCodexDebugPort, pulse } from "../pulse.mjs";
import { rendererInjectJS, readImageB64, mimeForTheme } from "../engine.mjs";
import { installAgent } from "../persist.mjs";

const CURRENT = currentDir();
const AGENT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "agent.mjs");

async function resolveTheme(target) {
  if (target.startsWith("https://")) return resolveRemoteTheme(target, lastManifestVersion);
  const abs = path.resolve(target);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return loadLocalTheme(abs);
  throw new Error("请传完整 https URL 或本地主题目录");
}

// 把主题暂存到稳定目录,供常驻 agent 每次重套读取
function stage(theme) {
  fs.rmSync(CURRENT, { recursive: true, force: true });
  fs.mkdirSync(CURRENT, { recursive: true });
  const ext = path.extname(theme.imagePath) || ".jpg";
  fs.copyFileSync(theme.imagePath, path.join(CURRENT, "bg" + ext));
  fs.writeFileSync(path.join(CURRENT, "theme.json"), JSON.stringify({
    schemaVersion: 1, id: theme.id, name: theme.name, variant: theme.variant,
    image: "bg" + ext, colors: theme.colors,
  }));
}

export async function run(args) {
  const target = args[0];
  if (!target) throw new Error("用法: okkskin enable <主题目录|URL>");
  const theme = await resolveTheme(target);
  const codex = findCodexBundle();
  if (!verifyCodexSignature(codex.bundlePath)) throw new Error("Codex 签名校验未通过,拒绝启用");

  stage(theme);
  writeState({ skinId: theme.id, enabled: true, startedAt: new Date().toISOString() });
  installAgent(AGENT);

  // 若 Codex 正以调试口运行,立即套一次;否则由 agent 在它以 okkskin launch 启动后套
  if (findCodexDebugPort()) {
    const rjs = rendererInjectJS(theme, readImageB64(theme), mimeForTheme(theme));
    await pulse(rjs);
  }
  console.log(`okkskin: 已启用常驻(${theme.id})—— 用 okkskin launch 启动 Codex 即自动套上。停用:okkskin disable`);
  console.log("⚠ Codex 须带本地调试口(127.0.0.1)启动,整个会话期间端口保持开启;仅个人可信设备使用。");
}
