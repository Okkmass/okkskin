// okkskin 常驻 agent(由 launchd 拉起,RunAtLoad+KeepAlive)。
// 逻辑:每几秒看一次 Codex;若它是带调试口启动的 → 对每个 app 页补注已暂存的主题(已有就跳过)。
// 不重启、不杀 Codex;没带调试口启动的实例不处理。
import { setTimeout as sleep } from "node:timers/promises";
import { loadLocalTheme } from "./theme.mjs";
import { findCodexDebugPort, pulse } from "./pulse.mjs";
import { rendererInjectJS, readImageB64, mimeForTheme, buildEnsureExpr } from "./engine.mjs";
import { readState, currentDir } from "./state.mjs";

const CURRENT = currentDir();

async function tick() {
  const s = readState();
  if (!s || !s.enabled) return;            // 未启用常驻 → 空转
  if (!findCodexDebugPort()) return;       // Codex 没在跑,或不是带调试口启动的
  const theme = loadLocalTheme(CURRENT);   // 暂存主题
  const rjs = rendererInjectJS(theme, readImageB64(theme), mimeForTheme(theme));
  await pulse(buildEnsureExpr(rjs));
}

for (;;) {
  try { await tick(); } catch { /* 窗口还没就绪等下一轮 */ }
  await sleep(3500);
}
