"use client";

import { desktopBridge } from "../desktop";

export async function saveBytes(fileName: string, data: Uint8Array | string, mediaType = "application/octet-stream"): Promise<string> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const bridge = desktopBridge();
  if (bridge) {
    const result = await bridge.saveFile(fileName, bytes);
    return result.saved ? result.path ?? fileName : "已取消保存";
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mediaType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return fileName;
}
