import { describe, expect, it } from "vitest";
import { validatePublicUrl } from "@/lib/url-security";
import { assessCandidate, buildThesisDataPlan } from "@/lib/evidence-score";
import { MODEL_PRESETS } from "@/lib/model-presets";
import type { Source } from "@/lib/types";

const source: Source = { id: "s", name: "测试机构", title: "原文", tier: "A", linkStatus: "ok", publishedAt: "2025-01", createdAt: 0, updatedAt: 0 };

describe("public URL security", () => {
  it.each(["file:///C:/secret.txt", "http://user:pass@example.com", "http://127.0.0.1/admin", "http://localhost:3000", "http://192.168.1.10/internal", "http://169.254.169.254/metadata"])("rejects unsafe URL %s", async (url) => {
    await expect(validatePublicUrl(url)).rejects.toThrow();
  });
});

describe("evidence assessment", () => {
  it("recommends complete traceable data", () => {
    expect(assessCandidate({ source, period: "2025", value: 12, unit: "%", scope: "中国大陆" }).verdict).toBe("recommended");
  });
  it("rejects records missing core fields", () => {
    expect(assessCandidate({ source, period: "", value: null, unit: "", scope: "" }).verdict).toBe("reject");
  });
  it("marks a single C-tier item for review or rejection", () => {
    const result = assessCandidate({ source: { ...source, tier: "C" }, period: "2025", value: 12, unit: "%", scope: "中国大陆" });
    expect(result.verdict).not.toBe("recommended");
  });
  it("builds a complete six-dimension thesis checklist without filling data", () => {
    const plan = buildThesisDataPlan([], [source]);
    expect(plan).toHaveLength(6);
    expect(plan.every((item) => item.pointCount === 0 && item.gaps.includes("尚无入选数据"))).toBe(true);
  });
});

describe("model presets", () => {
  it("contains mainstream and custom OpenAI-compatible providers", () => {
    expect(Object.keys(MODEL_PRESETS)).toEqual(expect.arrayContaining(["openai", "deepseek", "qwen", "doubao", "moonshot", "zhipu", "gemini", "anthropic", "openrouter", "custom"]));
  });
  it("does not embed any API keys", () => {
    expect(JSON.stringify(MODEL_PRESETS)).not.toMatch(/sk-[a-z0-9]{10}/i);
  });
});
