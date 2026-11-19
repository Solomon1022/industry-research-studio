import ExcelJS from "exceljs";
import type { DataPoint, Project, Source } from "../types";
import type { EvidenceRecord, SurveyAnalysisResult } from "../research-types";

export interface TabularExportInput {
  project: Project;
  dataPoints: DataPoint[];
  sources: Source[];
  evidence?: EvidenceRecord[];
  analysis?: SurveyAnalysisResult;
}

function safeCell(value: unknown): string | number {
  if (typeof value === "number") return value;
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function exportCsv(input: TabularExportInput): Uint8Array {
  const sourceMap = new Map(input.sources.map((source) => [source.id, source]));
  const header = ["维度", "指标", "主体", "时间", "数值", "单位", "币种", "口径", "预测", "来源等级", "来源机构", "报告全名", "发布日期", "链接", "备注"];
  const rows = input.dataPoints.map((point) => {
    const source = sourceMap.get(point.sourceId);
    return [point.dimension, point.metric, point.subject ?? "", point.period, point.value ?? "", point.unit, point.currency ?? "CNY", point.scope.label, point.forecast ? "E" : "实际", source?.tier ?? "", source?.publisher || source?.name || "", source?.title ?? "", source?.publishedAt ?? "", source?.url ?? "", point.note ?? ""];
  });
  const text = [header, ...rows].map((row) => row.map((cell) => `"${String(safeCell(cell)).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  return new TextEncoder().encode(`\uFEFF${text}`);
}

function addSheet(workbook: ExcelJS.Workbook, name: string, headers: string[], rows: unknown[][]): void {
  const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row.map(safeCell)));
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF174A6E" } };
  header.alignment = { vertical: "middle" };
  header.height = 24;
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  sheet.columns.forEach((column, index) => {
    const lengths = [headers[index].length, ...rows.slice(0, 200).map((row) => String(row[index] ?? "").length)];
    column.width = Math.min(52, Math.max(10, Math.max(...lengths) * 1.4 + 2));
  });
  sheet.eachRow((row) => row.eachCell((cell) => { cell.alignment = { vertical: "top", wrapText: true }; }));
}

export async function exportWorkbook(input: TabularExportInput): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Industry Research Studio";
  workbook.created = new Date();
  addSheet(workbook, "使用说明", ["项目", "内容"], [
    ["研究项目", input.project.name], ["行业边界", input.project.industry], ["地域", input.project.region], ["研究时段", input.project.periodRange],
    ["入选数据点", input.dataPoints.length], ["来源数", input.sources.length], ["导出问题", new Date().toISOString()],
    ["保真约定", "预测标 E；口径不混用；未核实内容不得补造；问卷清洗只作用于分析副本"],
  ]);
  addSheet(workbook, "入选数据", ["维度", "指标", "主体", "时间", "数值", "单位", "币种", "口径", "口径详情", "预测", "来源ID", "备注"], input.dataPoints.map((point) => [
    point.dimension, point.metric, point.subject ?? "", point.period, point.value ?? "", point.unit, point.currency ?? "CNY", point.scope.label, point.scope.detail ?? "", point.forecast ? "E" : "实际", point.sourceId, point.note ?? "",
  ]));
  addSheet(workbook, "来源清单", ["来源ID", "等级", "机构", "报告全名", "发布方", "发布日期", "链接", "可访问性", "备注"], input.sources.map((source) => [
    source.id, source.tier, source.name, source.title, source.publisher ?? "", source.publishedAt ?? "", source.url ?? "", source.linkStatus, source.note ?? "",
  ]));
  if (input.evidence?.length) addSheet(workbook, "证据索引", ["证据ID", "标题", "获取方式", "格式", "原文链接", "表格数", "SHA-256", "获取时间", "状态"], input.evidence.map((item) => [
    item.id, item.title, item.method, item.mediaType, item.url ?? "", item.tables.length, item.checksum ?? "", new Date(item.acquiredAt).toISOString(), item.status,
  ]));
  if (input.analysis) {
    addSheet(workbook, "问卷描述统计", ["变量", "有效N", "缺失", "均值", "标准差", "中位数", "最小值", "最大值"], input.analysis.descriptive.map((item) => [item.variable, item.n, item.missing, item.mean, item.sd, item.median, item.min, item.max]));
    addSheet(workbook, "相关分析", ["变量1", "变量2", "N", "Pearson r", "p值"], input.analysis.correlations.map((item) => [item.x, item.y, item.n, item.r, item.p]));
    addSheet(workbook, "清洗排除日志", ["原文件行号", "排除原因"], input.analysis.exclusions.map((item) => [item.rowNumber, item.reasons.join("；")]));
    const models = input.analysis.mediation?.regressions;
    if (models) {
      const rows: unknown[][] = [];
      for (const [name, model] of Object.entries(models)) {
        model.coefficients.forEach((item) => rows.push([name, model.dependent, item.variable, model.n, item.coefficient, item.standardError, item.t, item.p, model.r2, model.adjustedR2]));
      }
      addSheet(workbook, "回归结果", ["模型", "因变量", "变量", "N", "系数", "标准误", "t", "p", "R²", "调整R²"], rows);
      const mediation = input.analysis.mediation!;
      addSheet(workbook, "中介效应", ["X", "M", "Y", "a", "b", "直接效应", "总效应", "间接效应", "Bootstrap有效次数", "CI下限", "CI上限"], [[mediation.x, mediation.m, mediation.y, mediation.a, mediation.b, mediation.direct, mediation.total, mediation.indirect, mediation.bootstrapIterations, mediation.indirectCi95[0], mediation.indirectCi95[1]]]);
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
