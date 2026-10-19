import { execFileSync } from "node:child_process";

// argv0 必须就是主执行档(避免 shell/编辑器等命令行里恰好含这个路径的进程被误认)
const MAIN_RE = /^(\d+)\s+(\S*\/ChatGPT\.app\/Contents\/MacOS\/ChatGPT)(\s.*)?$/;

// macOS: ps 过滤主执行档且参数不含 --type=(排除 renderer/gpu 等 helper),返回 {pid, cmd}
function findMainProcPosix() {
  let out;
  try { out = execFileSync("/bin/ps", ["-axo", "pid=,command="], { encoding: "utf8" }); }
  catch { return null; }
  for (const line of out.split("\n")) {
    const m = line.trim().match(MAIN_RE);
    if (m && !line.includes("--type=")) return { pid: Number(m[1]), cmd: line };
  }
  return null;
}

// Windows: Win32_Process 带 CommandLine,挑不含 --type= 的 ChatGPT.exe 主进程。导出供测试。
export function pickWinMainPid(json) {
  let arr;
  try { arr = JSON.parse(json); } catch { return null; }
  if (!arr) return null;
  if (!Array.isArray(arr)) arr = [arr];
  for (const p of arr) {
    const cmd = String(p.CommandLine || "");
    if (cmd && !cmd.includes("--type=")) return Number(p.ProcessId);
  }
  return null;
}
function findMainPidWin() {
  const cmd = "Get-CimInstance Win32_Process -Filter \"Name='ChatGPT.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress";
  let out;
  try { out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", cmd], { encoding: "utf8" }); }
  catch { return null; }
  return pickWinMainPid(out);
}

// Codex 主进程 PID(跨平台)
export function findCodexMainPid() {
  return process.platform === "win32" ? findMainPidWin() : findMainProcPosix()?.pid ?? null;
}

// 主进程命令行里的 Chromium --remote-debugging-port(Codex 把 Node inspector 熔断关了,SIGUSR1 会直接杀进程,
// 只剩带这个参数启动这一条入口)。仅 macOS;没带参数返回 null。
export function parseDebugPort(cmd) {
  const m = String(cmd).match(/--remote-debugging-port=(\d+)/);
  return m ? Number(m[1]) : null;
}
export function findCodexDebugPort() {
  if (process.platform === "win32") return null;
  const proc = findMainProcPosix();
  return proc ? parseDebugPort(proc.cmd) : null;
}

// 连一个 CDP 页面目标,执行表达式,返回值
async function evalInPage(wsUrl, expr) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true });
    ws.addEventListener("error", () => rej(new Error("CDP ws 连接失败")), { once: true });
  });
  try {
    return await new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error("CDP 超时")), 6000);
      ws.addEventListener("message", (e) => {
        const m = JSON.parse(String(e.data));
        if (m.id !== 1) return;
        clearTimeout(timer);
        if (m.error) rej(new Error(m.error.message));
        else if (m.result.exceptionDetails) rej(new Error(m.result.exceptionDetails.exception?.description || m.result.exceptionDetails.text));
        else res(m.result.result?.value);
      });
      ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression: expr, returnByValue: true } }));
    });
  } finally { try { ws.close(); } catch { /* ignore */ } }
}

/**
 * 在 Codex 每个 app:// 渲染页里执行表达式(经 Chromium 调试口)。返回各页的值。
 * 带重试:窗口刚建好时页面目标可能还没出现。注入表达式是幂等的,重试安全。
 */
export async function pulse(expr) {
  if (!findCodexMainPid()) throw new Error("Codex 未运行");
  const port = findCodexDebugPort();
  if (!port) throw new Error("Codex 不是带调试口启动的:请先退出 Codex,再用 okkskin launch 启动");
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const pages = list.filter((t) => t.type === "page" && String(t.url).startsWith("app://") && t.webSocketDebuggerUrl);
      if (!pages.length) throw new Error("Codex 窗口未就绪");
      return await Promise.all(pages.map((t) => evalInPage(t.webSocketDebuggerUrl, expr)));
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 600));
    }
  }
  throw lastErr;
}
