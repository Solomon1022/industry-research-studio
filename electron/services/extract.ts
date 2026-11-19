import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { parseHTML } from "linkedom";
import { parse as parseCsv } from "csv-parse/sync";
import chardet from "chardet";
import iconv from "iconv-lite";
import ExcelJS from "exceljs";
import { readSav, applyUserMissing } from "datareader-spss";
import { createHash } from "node:crypto";
import path from "node:path";
import type { CellValue, EvidenceTable } from "../../lib/research-types";
import type { ExtractedPayload } from "../../lib/desktop";

const MAX_TABLES = 80;
const MAX_ROWS = 5000;
const MAX_TEXT = 500_000;

function cleanText(value: string): string {
  return value.replace(/\r/g, "").replace(/[\t \u00a0]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_TEXT);
}

function cleanCell(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function checksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function extractHtml(html: string, url?: string): ExtractedPayload {
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document, { charThreshold: 120 }).parse();
  const $ = cheerio.load(html);
  $("script,style,noscript,template,svg").remove();
  const tables: EvidenceTable[] = [];
  $("table").slice(0, MAX_TABLES).each((tableIndex, element) => {
    const rows: CellValue[][] = [];
    $(element).find("tr").slice(0, MAX_ROWS).each((_, row) => {
      const cells = $(row).find("th,td").map((__, cell) => cleanCell($(cell).text())).get();
      if (cells.some(Boolean)) rows.push(cells);
    });
    if (!rows.length) return;
    const headerRowIndex = rows.findIndex((row) => row.length > 0);
    const headers = rows[headerRowIndex].map((cell, index) => cleanCell(cell) || `列${index + 1}`);
    const caption = cleanCell($(element).find("caption").first().text());
    tables.push({
      id: crypto.randomUUID(),
      name: caption || `网页表格 ${tableIndex + 1}`,
      headers,
      rows: rows.slice(headerRowIndex + 1),
      locator: `HTML table ${tableIndex + 1}`,
    });
  });
  const title = cleanCell(article?.title || $("meta[property='og:title']").attr("content") || $("title").first().text() || url || "未命名网页");
  const publishedAt = $("meta[property='article:published_time']").attr("content")
    || $("meta[name='publishdate']").attr("content") || $("meta[name='date']").attr("content") || $("time[datetime]").attr("datetime");
  const publisher = $("meta[property='og:site_name']").attr("content") || $("meta[name='author']").attr("content");
  const rawText = cleanText(article?.textContent || $("main").first().text() || $("body").text());
  if (!rawText && !tables.length) throw new Error("页面没有提取到正文或表格，可改用授权浏览器打开后采集");
  return {
    title, url, publisher, publishedAt, mediaType: "html", rawText, tables,
    metadata: { extraction: article ? "Readability + HTML tables" : "HTML text + tables" },
    checksum: checksum(Buffer.from(html)),
  };
}

function excelCellValue(value: ExcelJS.CellValue): CellValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return excelCellValue(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value && typeof value.text === "string") return value.hyperlink ? `${value.text} (${value.hyperlink})` : value.text;
    if ("formula" in value) return null;
    if ("error" in value) return String(value.error);
  }
  if (["string", "number", "boolean"].includes(typeof value)) return value as string | number | boolean;
  return String(value);
}

function rowsToTable(name: string, locator: string, rows: CellValue[][]): EvidenceTable | null {
  const nonEmpty = rows.filter((row) => row.some((cell) => cleanCell(cell).length > 0)).slice(0, MAX_ROWS);
  if (!nonEmpty.length) return null;
  const width = Math.max(...nonEmpty.map((row) => row.length));
  const normalized = nonEmpty.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? null));
  return {
    id: crypto.randomUUID(), name, locator,
    headers: normalized[0].map((cell, index) => cleanCell(cell) || `列${index + 1}`),
    rows: normalized.slice(1),
  };
}

export async function extractTabular(buffer: Buffer, fileName: string): Promise<ExtractedPayload> {
  const extension = path.extname(fileName).toLowerCase();
  const tables: EvidenceTable[] = [];
  let variables: string[] = [];
  if (extension === ".csv" || extension === ".txt") {
    const encoding = chardet.detect(buffer) || "UTF-8";
    const text = iconv.decode(buffer, encoding);
    const rows = parseCsv(text, { relax_column_count: true, skip_empty_lines: true, bom: true }) as CellValue[][];
    const table = rowsToTable(path.basename(fileName), "CSV", rows);
    if (table) tables.push(table);
  } else if (extension === ".xlsx" || extension === ".xlsm") {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    workbook.eachSheet((sheet) => {
      const rows: CellValue[][] = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const values: CellValue[] = [];
        for (let index = 1; index <= Math.max(1, row.cellCount); index += 1) values.push(excelCellValue(row.getCell(index).value));
        rows.push(values);
      });
      const table = rowsToTable(sheet.name, `工作表：${sheet.name}`, rows);
      if (table) tables.push(table);
    });
  } else if (extension === ".sav" || extension === ".zsav") {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const parsed = await readSav(arrayBuffer, { maxCells: 50_000_000, maxInflatedBytes: 256 * 1024 * 1024 });
    for (const original of parsed.sheets) {
      const sheet = applyUserMissing(original);
      variables = sheet.variables.map((variable) => variable.label ? `${variable.name}：${variable.label}` : variable.name);
      const rows: CellValue[][] = [[...sheet.variables.map((variable) => variable.name)], ...sheet.rows.map((row) => row.map((cell) => cell instanceof Date ? cell.toISOString() : cell))];
      const table = rowsToTable(sheet.name || "SPSS 数据", "SPSS system file", rows);
      if (table) tables.push(table);
    }
  } else {
    throw new Error("仅支持 CSV、TXT、XLSX、XLSM、SAV、ZSAV 表格文件");
  }
  if (!tables.length) throw new Error("文件中没有读取到有效数据行");
  const rawText = tables.map((table) => `${table.name}\n${table.headers.join("\t")}\n${table.rows.slice(0, 200).map((row) => row.map(cleanCell).join("\t")).join("\n")}`).join("\n\n");
  return {
    title: path.basename(fileName), fileName: path.basename(fileName), mediaType: extension === ".sav" || extension === ".zsav" ? "sav" : extension === ".csv" || extension === ".txt" ? "csv" : "xlsx",
    rawText: cleanText(rawText), tables,
    metadata: { variables: variables.join("\n"), rowLimit: String(MAX_ROWS) }, checksum: checksum(buffer),
  };
}

export async function extractPdf(buffer: Buffer, fileName: string, url?: string): Promise<ExtractedPayload> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(buffer.byteLength);
  data.set(buffer);
  const document = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  const pageCount = document.numPages;
  const limit = Math.min(pageCount, 300);
  for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pages.push(`\n\n[第 ${pageNumber} 页]\n${cleanText(text)}`);
  }
  const metadata = await document.getMetadata().catch(() => null);
  const info = (metadata?.info ?? {}) as Record<string, unknown>;
  await document.cleanup();
  return {
    title: cleanCell(String(info.Title || "")) || path.basename(fileName), url,
    publisher: cleanCell(String(info.Author || info.Creator || "")) || undefined,
    publishedAt: cleanCell(String(info.CreationDate || "")) || undefined,
    fileName: path.basename(fileName), mediaType: "pdf", rawText: cleanText(pages.join("")), tables: [],
    metadata: { pages: String(pageCount), extractedPages: String(limit), note: "PDF 保留逐页文本；复杂表格需回到原页人工核对列关系" },
    checksum: checksum(buffer),
  };
}
