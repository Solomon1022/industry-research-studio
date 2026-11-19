import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractHtml, extractPdf, extractTabular } from "@/electron/services/extract";

describe("evidence parsers", () => {
  it("extracts article text, metadata and an HTML table with locator", () => {
    const result = extractHtml(`<!doctype html><html><head><title>测试报告</title><meta property="og:site_name" content="公开机构"><meta name="date" content="2025-01-01"></head><body><article><h1>测试报告</h1><p>这是用于解析器验收的正文内容，不包含任何行业事实。</p><table><caption>数据表</caption><tr><th>年份</th><th>指标</th><th>数值</th></tr><tr><td>2024</td><td>测试指标</td><td>123.45</td></tr></table></article></body></html>`, "https://example.com/report");
    expect(result.title).toBe("测试报告");
    expect(result.publisher).toBe("公开机构");
    expect(result.tables[0].headers).toEqual(["年份", "指标", "数值"]);
    expect(result.tables[0].rows[0][2]).toBe("123.45");
    expect(result.checksum).toHaveLength(64);
  });
  it("decodes UTF-8 BOM CSV and preserves Chinese cells", async () => {
    const result = await extractTabular(Buffer.from("\uFEFF年份,指标,数值\r\n2024,测试指标,123.45", "utf8"), "sample.csv");
    expect(result.tables[0].headers).toEqual(["年份", "指标", "数值"]);
    expect(result.tables[0].rows[0]).toEqual(["2024", "测试指标", "123.45"]);
  });
  it("reads multiple XLSX sheets and cached formula results", async () => {
    const workbook = new ExcelJS.Workbook();
    const first = workbook.addWorksheet("数据");
    first.addRow(["年份", "指标", "数值"]);
    first.addRow([2024, "测试指标", 123.45]);
    first.getCell("D2").value = { formula: "C2*2", result: 246.9 };
    workbook.addWorksheet("说明").addRow(["口径", "测试口径"]);
    const buffer = await workbook.xlsx.writeBuffer();
    const result = await extractTabular(Buffer.from(buffer), "sample.xlsx");
    expect(result.tables).toHaveLength(2);
    expect(result.tables[0].rows[0][2]).toBe(123.45);
    expect(result.tables[0].rows[0][3]).toBe(246.9);
    expect(result.tables[1].locator).toContain("说明");
  });
  it("extracts real PDF page text and preserves page count after cleanup", async () => {
    const pdf = await PDFDocument.create();
    pdf.setTitle("Parser Fixture");
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (const text of ["First page 2024 value 123.45", "Second page forecast marker E"]) {
      const page = pdf.addPage([595, 842]);
      page.drawText(text, { x: 60, y: 760, size: 14, font });
    }
    const result = await extractPdf(Buffer.from(await pdf.save()), "fixture.pdf");
    expect(result.mediaType).toBe("pdf");
    expect(result.metadata.pages).toBe("2");
    expect(result.metadata.extractedPages).toBe("2");
    expect(result.rawText).toContain("123.45");
    expect(result.rawText).toContain("[第 2 页]");
    expect(result.title).toBe("Parser Fixture");
  });
});
