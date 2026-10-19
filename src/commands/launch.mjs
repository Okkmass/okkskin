import { findCodexBundle, verifyCodexSignature } from "../codex.mjs";
import { findCodexMainPid, findCodexDebugPort } from "../pulse.mjs";
import { launchCodexWithDebugPort } from "../launch.mjs";

export async function run() {
  const codex = findCodexBundle();
  if (!verifyCodexSignature(codex.bundlePath)) throw new Error("Codex 签名校验未通过,拒绝启动");
  if (findCodexMainPid()) {
    if (findCodexDebugPort()) { console.log("okkskin: Codex 已是带调试口运行,无需重启"); return; }
    throw new Error("Codex 正在运行但不是带调试口启动的:请先退出 Codex,再运行 okkskin launch");
  }
  launchCodexWithDebugPort(codex.execPath);
  console.log("okkskin: 已启动 Codex(127.0.0.1 调试口);已 enable 的皮肤几秒内自动套上");
}
