import { clearState } from "../state.mjs";
import { findCodexDebugPort, pulse } from "../pulse.mjs";
import { RESTORE_EXPR } from "../engine.mjs";
import { uninstallAgent } from "../persist.mjs";

export async function run() {
  uninstallAgent();
  if (findCodexDebugPort()) {
    try { await pulse(RESTORE_EXPR); }
    catch (e) { console.warn("okkskin: 还原未完成:" + e.message); }
  }
  clearState();
  console.log("okkskin: 已停用常驻、移除皮肤、卸载 agent。");
}
