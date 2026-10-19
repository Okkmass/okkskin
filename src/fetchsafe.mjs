// 完整路径前缀白名单。只允许 okkmax 自托管(固定路径,完整性靠签名 + version 防回滚)。
export const ALLOWED_PREFIXES = [
  /^https:\/\/www\.okkmax\.com\/skins\/[a-z0-9][a-z0-9-]{0,63}\//,
];

export function assertAllowedUrl(url) {
  if (typeof url !== "string" || !ALLOWED_PREFIXES.some((re) => re.test(url))) {
    throw new Error(`url not in whitelist: ${url}`);
  }
  return url;
}

export async function readCapped(stream, maxBytes) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { try { await reader.cancel(); } catch { /* ignore */ } throw new Error(`response exceeds ${maxBytes} bytes`); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

// 取白名单内 URL,禁重定向,流式硬截断
export async function fetchAllowed(url, maxBytes) {
  assertAllowedUrl(url);
  const res = await fetch(url, { redirect: "error" });
  if (!res.ok) throw new Error(`fetch ${url}: HTTP ${res.status}`);
  return readCapped(res.body, maxBytes);
}
