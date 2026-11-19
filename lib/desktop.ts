"use client";

import type {
  CellValue, ChatMessage, EvidenceMediaType, EvidenceTable, ModelProfile,
  NetworkConfig, SearchProvider, SearchResultItem,
} from "./research-types";

export interface ExtractedPayload {
  title: string;
  url?: string;
  publisher?: string;
  publishedAt?: string;
  mediaType: EvidenceMediaType;
  rawText: string;
  tables: EvidenceTable[];
  metadata: Record<string, string>;
  checksum?: string;
  fileName?: string;
}

export interface RuntimeInfo {
  isDesktop: boolean;
  platform?: string;
  versions?: Record<string, string>;
}

export interface DesktopBridge {
  runtime(): Promise<RuntimeInfo>;
  search(provider: SearchProvider, query: string, maxResults: number): Promise<SearchResultItem[]>;
  saveSearchKey(provider: SearchProvider, apiKey: string, network: NetworkConfig): Promise<{ configured: boolean; persistent: boolean }>;
  searchStatus(): Promise<Record<SearchProvider, { configured: boolean; persistent: boolean }>>;
  saveModel(profile: ModelProfile, apiKey: string, network: NetworkConfig): Promise<{ configured: boolean; persistent: boolean }>;
  modelStatus(): Promise<Record<string, { configured: boolean; persistent: boolean }>>;
  chat(profile: ModelProfile, messages: ChatMessage[], requireJson?: boolean): Promise<string>;
  testModel(profile: ModelProfile): Promise<{ ok: boolean; message: string }>;
  extractUrl(url: string): Promise<ExtractedPayload>;
  extractFile(): Promise<ExtractedPayload | null>;
  openAuthorized(url: string): Promise<{ opened: boolean }>;
  captureAuthorized(): Promise<ExtractedPayload>;
  saveFile(fileName: string, bytes: Uint8Array): Promise<{ saved: boolean; path?: string }>;
}

declare global {
  interface Window { researchDesktop?: DesktopBridge }
}

export function desktopBridge(): DesktopBridge | undefined {
  return typeof window === "undefined" ? undefined : window.researchDesktop;
}

export async function saveBinaryFile(fileName: string, bytes: Uint8Array, mime = "application/octet-stream"): Promise<void> {
  const bridge = desktopBridge();
  if (bridge) {
    const result = await bridge.saveFile(fileName, bytes);
    if (!result.saved) return;
    return;
  }
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function rowsToObjects(headers: string[], rows: CellValue[][]): Array<Record<string, CellValue>> {
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header || `列${index + 1}`, row[index] ?? null])));
}
