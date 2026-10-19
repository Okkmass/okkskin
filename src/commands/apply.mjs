import fs from "node:fs";
import path from "node:path";
import { loadLocalTheme } from "../theme.mjs";
import { resolveRemoteTheme } from "../remote.mjs";
import { lastManifestVersion, recordManifestVersion, writeState } from "../state.mjs";
import { findCodexBundle, verifyCodexSignature } from "../codex.mjs";
import { launchCodexWithDebugPort } from "../launch.mjs";
import { findCodexMainPid, findCodexDebugPort, pulse } from "../pulse.mjs";
import { rendererInjectJS, readImageB64, mimeForTheme } from "../engine.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resolveTheme(target) {
  if (target.startsWith("https://")) return resolveRemoteTheme(target, lastManifestVersion);
  const abs = path.resolve(target);
  if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return loadLocalTheme(abs);
  throw new Error("slug 需从画廊取钉死 manifest URL;请传完整 https URL 或本地主题目录");
}

// 等 Codex 带调试口的主进程 + 窗口就绪
async function ensureCodexReady() {
  const codex = findCodexBundle();
  if (!verifyCodexSignature(codex.bundlePath)) throw new Error("Codex 签名校验未通过,拒绝注入");
  if (findCodexMainPid()) {
    if (findCodexDebugPort()) return;
    throw new Error("Codex 正在运行但不是带调试口启动的:请先退出 Codex,再运行 okkskin apply");
  }
  launchCodexWithDebugPort(codex.execPath);
  for (let i = 0; i < 40 && !findCodexDebugPort(); i++) await sleep(500);
  if (!findCodexDebugPort()) throw new Error("Codex 未能启动");
  await sleep(3500); // 等窗口/渲染就绪
}

export async function run(args) {
  const target = args[0];
  if (!target) throw new Error("用法: okkskin apply <主题目录|URL>");
  const theme = await resolveTheme(target);

  await ensureCodexReady();

  const rjs = rendererInjectJS(theme, readImageB64(theme), mimeForTheme(theme));
  await pulse(rjs); // 经调试口注入到每个 app 页

  writeState({ codexPid: findCodexMainPid(), skinId: theme.id, startedAt: new Date().toISOString() });
  if (theme.version) recordManifestVersion(theme.id, theme.version);
  console.log(`okkskin: 已套用 ${theme.id}。页面刷新后会丢失,想持久用 okkskin enable。还原:okkskin restore`);
}
