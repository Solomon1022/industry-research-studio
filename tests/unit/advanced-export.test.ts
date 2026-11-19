import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { exportCsv, exportWorkbook } from "@/lib/export/tabular";
import { exportDocx } from "@/lib/export/docx";
import { analyzeSurvey } from "@/lib/stats/survey";
import type { DataPoint, Project, Source } from "@/lib/types";
import type { EvidenceRecord } from "@/lib/research-types";

const now = Date.now();
const project: Project = { id: "p", name: "真实导出验收", industry: "直播电商", region: "中国", periodRange: "2024-2025", dimensions: ["market"], status: "done", createdAt: now, updatedAt: now, thesis: { researchQuestions: ["互动性如何影响购买意愿"], independentVar: "互动性", mediator: "社会临场感", dependentVar: "购买意愿", controls: [], fixedReferences: [] } };
const sources: Source[] = [{ id: "s", name: "国家统计局", title: "公开统计资料", tier: "A", linkStatus: "ok", publishedAt: "2025-01", url: "https://www.stats.gov.cn/", createdAt: now, updatedAt: now }];
const dataPoints: DataPoint[] = [{ id: "d", projectId: "p", dimension: "market", metric: "测试指标", value: 123.45, unit: "亿元", period: "2024", kind: "gmv", scope: { label: "中国；全年" }, forecast: false, sourceId: "s", note: "仅用于软件格式单元测试，不作为行业事实", createdAt: now, updatedAt: now }];
const evidence: EvidenceRecord[] = [{ id: "e", projectId: "p", sourceId: "s", title: "测试证据", url: "https://www.stats.gov.cn/", acquiredAt: now, method: "url", mediaType: "html", rawText: "原始文本", tables: [], metadata: {}, checksum: "abc123", status: "used" }];
const analysis = analyzeSurvey({ rows: [{ x: 1, m: 2, y: 2 }, { x: 2, m: 3, y: 4 }, { x: 3, m: 5, y: 5 }, { x: 4, m: 5, y: 7 }, { x: 5, m: 7, y: 8 }], variables: ["x", "m", "y"], min: 1, max: 10, checkStraightline: false, reliability: true, validity: true });

describe("advanced tabular exports", () => {
  it("writes BOM and protects against spreadsheet formulas", () => {
    const bytes = exportCsv({ project, sources, dataPoints: [{ ...dataPoints[0], metric: "=HYPERLINK(\"bad\")" }] });
    const text = new TextDecoder().decode(bytes);
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toContain("'=HYPERLINK");
  });
  it("creates a real workbook with sources, evidence and survey sheets", async () => {
    const bytes = await exportWorkbook({ project, sources, dataPoints, evidence, analysis });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer as ArrayBuffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(expect.arrayContaining(["入选数据", "来源清单", "证据索引", "问卷描述统计", "相关分析", "清洗排除日志"]));
    expect(workbook.getWorksheet("入选数据")?.getCell("D2").value).toBe("2024");
  });
});

describe("DOCX export", () => {
  it("creates an OOXML package with requested fonts, line spacing and real data", async () => {
    const bytes = await exportDocx({ project, sources, dataPoints, evidence, analysis, aiSummary: "仅整理给定测试数据。" });
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toContain("宋体");
    expect(xml).toContain("w:line=\"300\"");
    expect(xml).toContain("123.45");
    expect(xml).toContain("真实问卷分析");
    expect(xml).toContain("abc123");
    expect(zip.file("word/styles.xml")).toBeTruthy();
  });
  it("never invents a fixed bibliography when none was supplied", async () => {
    const bytes = await exportDocx({ project, sources, dataPoints });
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).not.toContain("固定文献清单");
  });
});
