import { clearState } from "../state.mjs";
import { findCodexDebugPort, pulse } from "../pulse.mjs";
import { RESTORE_EXPR } from "../engine.mjs";

export async function run() {
  if (findCodexDebugPort()) {
    try { await pulse(RESTORE_EXPR); }
    catch (e) { console.warn("okkskin: 还原未完成(Codex 可能正在关闭):" + e.message); }
  }
  clearState();
  console.log("okkskin: 已还原(移除皮肤,未重启 Codex;调试口随 Codex 下次不带参数启动关闭)");
}
