import { contextBridge, ipcRenderer } from "electron";
import type { ChatMessage, ModelProfile, NetworkConfig, SearchProvider } from "../lib/research-types";

const invoke = (channel: string, ...args: unknown[]) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("researchDesktop", {
  runtime: () => invoke("runtime"),
  search: (provider: SearchProvider, query: string, maxResults: number) => invoke("search:query", provider, query, maxResults),
  saveSearchKey: (provider: SearchProvider, apiKey: string, network: NetworkConfig) => invoke("search:save", provider, apiKey, network),
  searchStatus: () => invoke("search:status"),
  saveModel: (profile: ModelProfile, apiKey: string, network: NetworkConfig) => invoke("model:save", profile, apiKey, network),
  modelStatus: () => invoke("model:status"),
  chat: (profile: ModelProfile, messages: ChatMessage[], requireJson = false) => invoke("model:chat", profile, messages, requireJson),
  testModel: (profile: ModelProfile) => invoke("model:test", profile),
  extractUrl: (url: string) => invoke("extract:url", url),
  extractFile: () => invoke("extract:file"),
  openAuthorized: (url: string) => invoke("auth:open", url),
  captureAuthorized: () => invoke("auth:capture"),
  saveFile: (fileName: string, bytes: Uint8Array) => invoke("file:save", fileName, bytes),
});
