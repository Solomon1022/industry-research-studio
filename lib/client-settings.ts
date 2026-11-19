"use client";

import type { ModelProfile, SearchProvider } from "./research-types";
import { MODEL_PRESETS } from "./model-presets";

const MODEL_KEY = "research.activeModel.v1";
const SEARCH_KEY = "research.searchProvider.v1";

export function saveActiveModel(profile: ModelProfile): void {
  if (typeof window !== "undefined") localStorage.setItem(MODEL_KEY, JSON.stringify(profile));
}

export function getActiveModel(): ModelProfile {
  if (typeof window === "undefined") return MODEL_PRESETS.deepseek;
  try {
    const raw = localStorage.getItem(MODEL_KEY);
    if (raw) return JSON.parse(raw) as ModelProfile;
  } catch { /* use preset */ }
  return MODEL_PRESETS.deepseek;
}

export function saveActiveSearchProvider(provider: SearchProvider): void {
  if (typeof window !== "undefined") localStorage.setItem(SEARCH_KEY, provider);
}

export function getActiveSearchProvider(): SearchProvider {
  if (typeof window === "undefined") return "tavily";
  return localStorage.getItem(SEARCH_KEY) === "brave" ? "brave" : "tavily";
}
