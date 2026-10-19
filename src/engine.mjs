import fs from "node:fs";
import { OK_CLASS, FIXED_CSS, themeToVars } from "./inject.mjs";

function mimeFor(p) {
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}
export function readImageB64(theme) { return fs.readFileSync(theme.imagePath).toString("base64"); }
export function mimeForTheme(theme) { return mimeFor(theme.imagePath); }

// 在渲染进程里执行的注入 JS(自包含字符串):建 style、设 CSS 变量、blob 背景图、加类、设 color-scheme。
export function rendererInjectJS(theme, imageBase64, mime) {
  const payload = JSON.stringify({
    cls: OK_CLASS, css: FIXED_CSS, vars: themeToVars(theme),
    img: imageBase64, mime, variant: theme.variant === "light" ? "light" : "dark",
  });
  return `(() => {
    const P = ${payload};
    const root = document.documentElement;
    let st = document.getElementById("okkskin-style");
    if (!st) { st = document.createElement("style"); st.id = "okkskin-style"; (document.head || root).appendChild(st); }
    st.textContent = P.css;
    for (const [k, v] of Object.entries(P.vars)) root.style.setProperty(k, v);
    root.style.setProperty("color-scheme", P.variant);
    if (P.img) { const bin = Uint8Array.from(atob(P.img), c => c.charCodeAt(0)); const u = URL.createObjectURL(new Blob([bin], { type: P.mime })); root.style.setProperty("--ok-art", 'url("' + u + '")'); }
    root.classList.add(P.cls);
    return "ok";
  })()`;
}

// 守卫版注入:该页已有皮肤样式就跳过。agent 每轮对所有 app 页跑一遍,页面刷新/新窗口丢了样式就自动补上。
export const buildEnsureExpr = (rjs) => `document.getElementById("okkskin-style") ? "kept" : ${rjs}`;

// 还原表达式(渲染页内执行):移除已注入的样式/变量。不重启 Codex。
export const RESTORE_EXPR = "(()=>{const s=document.getElementById('okkskin-style');if(s)s.remove();const r=document.documentElement;r.classList.remove('okkskin');r.style.removeProperty('color-scheme');['--ok-bg','--ok-panel','--ok-accent','--ok-text','--ok-muted','--ok-line','--ok-art'].forEach(v=>r.style.removeProperty(v));return 'restored';})()";
