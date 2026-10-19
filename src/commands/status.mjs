import { readState } from "../state.mjs";
import { findCodexMainPid, findCodexDebugPort } from "../pulse.mjs";

export async function run() {
  const s = readState();
  const mainPid = findCodexMainPid();
  if (!s) { console.log(`okkskin: 无活动皮肤${mainPid ? "(Codex 运行中)" : "(Codex 未运行)"}`); return; }
  const codexAlive = !!mainPid && mainPid === s.codexPid;
  console.log(JSON.stringify({ ...s, codexAlive, debugPort: findCodexDebugPort() }, null, 2));
}
