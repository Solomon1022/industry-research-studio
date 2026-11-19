import { app, safeStorage } from "electron";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ModelProfile, NetworkConfig, SearchProvider } from "../../lib/research-types";

interface SecretRecord { ciphertext: string; network: NetworkConfig }
interface SettingsShape {
  secrets: Record<string, SecretRecord>;
  networks: Record<string, NetworkConfig>;
  profiles: Record<string, ModelProfile>;
}

let settings: SettingsShape = { secrets: {}, networks: {}, profiles: {} };
const volatileKeys = new Map<string, string>();
let loaded = false;

function settingsPath(): string {
  return path.join(app.getPath("userData"), "research-settings.json");
}

async function load(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await fs.readFile(settingsPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<SettingsShape>;
    settings = {
      secrets: parsed.secrets ?? {},
      networks: parsed.networks ?? {},
      profiles: parsed.profiles ?? {},
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  loaded = true;
}

async function persist(): Promise<void> {
  const target = settingsPath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, JSON.stringify(settings, null, 2), { encoding: "utf8", mode: 0o600 });
  await fs.rename(temp, target);
}

function keyFor(namespace: string, id: string): string { return `${namespace}:${id}`; }

export async function saveSecret(
  namespace: "search" | "model",
  id: SearchProvider | ModelProfile["id"],
  apiKey: string,
  network: NetworkConfig,
): Promise<{ configured: boolean; persistent: boolean }> {
  await load();
  const key = keyFor(namespace, id);
  settings.networks[key] = network;
  let persistent = false;
  if (apiKey.trim()) {
    if (safeStorage.isEncryptionAvailable()) {
      settings.secrets[key] = { ciphertext: safeStorage.encryptString(apiKey.trim()).toString("base64"), network };
      volatileKeys.delete(key);
      persistent = true;
    } else {
      // 无系统加密能力时仅保留到本次进程结束，绝不明文落盘。
      volatileKeys.set(key, apiKey.trim());
      delete settings.secrets[key];
    }
  }
  await persist();
  return { configured: true, persistent };
}

export async function saveProfile(profile: ModelProfile): Promise<void> {
  await load();
  settings.profiles[keyFor("model", profile.id)] = profile;
  await persist();
}

export async function getSecret(namespace: "search" | "model", id: string): Promise<{ apiKey: string; network: NetworkConfig }> {
  await load();
  const key = keyFor(namespace, id);
  const network = settings.networks[key] ?? { mode: "system" as const };
  const volatile = volatileKeys.get(key);
  if (volatile) return { apiKey: volatile, network };
  const record = settings.secrets[key];
  if (!record || !safeStorage.isEncryptionAvailable()) return { apiKey: "", network };
  return { apiKey: safeStorage.decryptString(Buffer.from(record.ciphertext, "base64")), network: record.network };
}

export async function getProfile(id: string): Promise<ModelProfile | undefined> {
  await load();
  return settings.profiles[keyFor("model", id)];
}

export async function secretStatus(namespace: "search" | "model", ids: string[]): Promise<Record<string, { configured: boolean; persistent: boolean }>> {
  await load();
  return Object.fromEntries(ids.map((id) => {
    const key = keyFor(namespace, id);
    return [id, { configured: Boolean(settings.secrets[key] || volatileKeys.has(key)), persistent: Boolean(settings.secrets[key]) }];
  }));
}
