import { spawn } from "node:child_process";

export const DEBUG_PORT = Number(process.env.OKKSKIN_PORT) || 9335;

// 直接执行主程序并带 Chromium 调试口参数(open -a 会被 LaunchServices 丢参数)。仅监听 127.0.0.1。仅 macOS;Windows 待补。
export function launchCodexWithDebugPort(execPath, port = DEBUG_PORT) {
  spawn(execPath, ["--remote-debugging-address=127.0.0.1", `--remote-debugging-port=${port}`], { detached: true, stdio: "ignore" }).unref();
}
