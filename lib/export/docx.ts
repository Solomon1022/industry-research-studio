import {
  AlignmentType, Document, ExternalHyperlink, Footer, HeadingLevel, ImageRun, PageNumber,
  Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { DIMENSION_LABELS, type DataPoint, type Dimension, type Project, type Source } from "../types";
import type { EvidenceRecord, SurveyAnalysisResult } from "../research-types";

export interface DocxExportInput {
  project: Project;
  dataPoints: DataPoint[];
  sources: Source[];
  evidence?: EvidenceRecord[];
  analysis?: SurveyAnalysisResult;
  aiSummary?: string;
  charts?: Array<{ title: string; data: Uint8Array; width: number; height: number; source: string }>;
}

const BODY_FONT = { ascii: "Times New Roman", hAnsi: "Times New Roman", eastAsia: "宋体" };
const HEADING_FONT = { ascii: "Times New Roman", hAnsi: "Times New Roman", eastAsia: "黑体" };

function body(text: string, options: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; indent?: boolean; size?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: options.align ?? AlignmentType.JUSTIFIED,
    spacing: { line: 300, lineRule: "auto", before: 0, after: 0 },
    indent: options.indent === false ? undefined : { firstLine: 480 },
    children: [new TextRun({ text, font: BODY_FONT, size: options.size ?? 24, bold: options.bold, color: "000000" })],
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({
    heading: level,
    keepNext: true,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 240 : 120, after: 120, line: 300, lineRule: "auto" },
    children: [new TextRun({ text, font: HEADING_FONT, size: level === HeadingLevel.HEADING_1 ? 28 : 24, bold: true, color: "000000" })],
  });
}

function caption(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER, keepNext: true,
    spacing: { before: 80, after: 80, line: 240, lineRule: "auto" },
    children: [new TextRun({ text, font: BODY_FONT, size: 21, color: "000000" })],
  });
}

function cell(text: unknown, header = false): TableCell {
  return new TableCell({
    shading: header ? { fill: "F2F2F2" } : undefined,
    verticalAlign: "center",
    children: [new Paragraph({
      alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT,
      spacing: { line: 240, lineRule: "auto", before: 40, after: 40 },
      indent: { firstLine: 0, left: 0, right: 0 },
      children: [new TextRun({ text: String(text ?? ""), font: BODY_FONT, size: 18, bold: header, color: "000000" })],
    })],
  });
}

function dataTable(headers: string[], rows: unknown[][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((item) => cell(item, true)) }),
      ...rows.map((row) => new TableRow({ cantSplit: true, children: row.map((item) => cell(item)) })),
    ],
  });
}

function sourceReference(source: Source, index: number): Paragraph {
  const text = `[${index + 1}] ${source.publisher || source.name}. 《${source.title}》[R/OL]. ${source.publishedAt ? `(${source.publishedAt})` : ""}`;
  return new Paragraph({
    spacing: { line: 240, lineRule: "auto", after: 60 },
    indent: { left: 480, hanging: 480 },
    children: [
      new TextRun({ text, font: BODY_FONT, size: 18, color: "000000" }),
      ...(source.url ? [new ExternalHyperlink({
        link: source.url,
        children: [new TextRun({ text: ` ${source.url}`, font: BODY_FONT, size: 18, color: "0563C1", underline: {} })],
      })] : []),
    ],
  });
}

export async function exportDocx(input: DocxExportInput): Promise<Uint8Array> {
  const sourceMap = new Map(input.sources.map((source) => [source.id, source]));
  const usedSources = input.sources.filter((source) => input.dataPoints.some((point) => point.sourceId === source.id));
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 360 },
      children: [new TextRun({ text: `${input.project.name} · 研究数据报告`, font: HEADING_FONT, size: 36, bold: true, color: "000000" })],
    }),
    body(`${input.project.industry}；${input.project.region}；研究时段：${input.project.periodRange}。`, { align: AlignmentType.CENTER, indent: false }),
    body(`本报告由 Industry Research Studio 根据已核验来源的结构化数据生成，导出时间为 ${new Date().toISOString().slice(0, 10)}。`, { align: AlignmentType.CENTER, indent: false, size: 21 }),
    heading("1 研究说明"),
    body(`本报告共纳入 ${input.dataPoints.length} 个数据点，引用 ${usedSources.length} 个来源。所有数值保留单位、时间、统计口径和来源；机构预测值以 E 标注。报告不构成投资、法律或统计咨询意见。`),
  ];
  if (input.aiSummary?.trim()) {
    children.push(heading("2 数据摘要（AI 辅助，需人工复核）"));
    input.aiSummary.trim().split(/\n+/).filter(Boolean).forEach((paragraph) => children.push(body(paragraph)));
  }
  input.project.dimensions.forEach((dimension: Dimension, dimensionIndex) => {
    const points = input.dataPoints.filter((point) => point.dimension === dimension);
    if (!points.length) return;
    children.push(heading(`${dimensionIndex + 3} ${DIMENSION_LABELS[dimension]}`));
    children.push(caption(`表 ${dimensionIndex + 1} ${DIMENSION_LABELS[dimension]}入选数据`));
    children.push(dataTable(["时间", "指标/主体", "数值", "口径", "来源"], points.map((point) => {
      const source = sourceMap.get(point.sourceId);
      const sourceIndex = usedSources.findIndex((item) => item.id === point.sourceId);
      return [
        point.period,
        `${point.metric}${point.subject ? `（${point.subject}）` : ""}`,
        point.value === null ? (point.text ?? "—") : `${point.value.toLocaleString("zh-CN")} ${point.unit}${point.forecast ? "（E）" : ""}`,
        point.scope.label,
        source ? `[${sourceIndex + 1}] ${source.name}` : "缺来源",
      ];
    })));
    points.filter((point) => point.note).forEach((point) => children.push(body(`注：${point.metric}（${point.period}）：${point.note}`, { indent: false, size: 18 })));
  });
  if (input.analysis) {
    children.push(heading("真实问卷分析"));
    children.push(body(`原始样本 ${input.analysis.originalN} 行，按已声明规则排除 ${input.analysis.exclusions.length} 行，分析样本 ${input.analysis.analysisN} 行。原始数据未被修改，排除明细保留在导出工作簿。`));
    children.push(caption("表 A1 描述统计"));
    children.push(dataTable(["变量", "N", "均值", "标准差", "中位数", "范围"], input.analysis.descriptive.map((item) => [item.variable, item.n, item.mean.toFixed(4), item.sd.toFixed(4), item.median.toFixed(4), `${item.min}–${item.max}`])));
    if (input.analysis.reliability) children.push(body(`Cronbach α = ${input.analysis.reliability.alpha.toFixed(4)}（题项 ${input.analysis.reliability.itemCount}，完整样本 ${input.analysis.reliability.n}）。`, { indent: false }));
    if (input.analysis.validity) children.push(body(`KMO = ${input.analysis.validity.kmo.toFixed(4)}；Bartlett 球形检验 χ²(${input.analysis.validity.bartlettDf}) = ${input.analysis.validity.bartlettChiSquare.toFixed(3)}，p = ${input.analysis.validity.bartlettP.toExponential(3)}。`, { indent: false }));
    if (input.analysis.mediation) {
      const result = input.analysis.mediation;
      children.push(body(`中介模型：${result.x} → ${result.m} → ${result.y}。间接效应 a×b = ${result.indirect.toFixed(4)}，Bootstrap 95% 置信区间 [${result.indirectCi95[0].toFixed(4)}, ${result.indirectCi95[1].toFixed(4)}]，有效重抽样 ${result.bootstrapIterations} 次。${result.indirectCi95[0] * result.indirectCi95[1] > 0 ? "区间不包含 0。" : "区间包含 0，不应宣称间接效应显著。"}`, { indent: false }));
    }
  }
  input.charts?.forEach((chart, index) => {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [new ImageRun({ data: chart.data, type: "png", transformation: { width: chart.width, height: chart.height } })] }));
    children.push(caption(`图 ${index + 1} ${chart.title}`));
    children.push(body(`数据来源：${chart.source}`, { align: AlignmentType.CENTER, indent: false, size: 18 }));
  });
  children.push(heading("参考来源"));
  usedSources.forEach((source, index) => children.push(sourceReference(source, index)));
  if (input.project.thesis?.fixedReferences.length) {
    children.push(heading("固定文献清单"));
    input.project.thesis.fixedReferences.forEach((reference, index) => children.push(body(`[${index + 1}] ${reference}`, { indent: false, size: 18 })));
  }
  children.push(heading("附录：证据索引"));
  if (input.evidence?.length) {
    children.push(dataTable(["证据标题", "方式", "格式", "SHA-256"], input.evidence.map((item) => [item.title, item.method, item.mediaType, item.checksum ?? "—"])));
  } else children.push(body("本次导出未附证据索引。", { indent: false }));
  const document = new Document({
    creator: "Industry Research Studio",
    title: `${input.project.name} · 研究数据报告`,
    styles: { default: { document: { run: { font: BODY_FONT, size: 24, color: "000000" }, paragraph: { spacing: { line: 300, lineRule: "auto" } } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1418, right: 1418, bottom: 1418, left: 1418 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: BODY_FONT, size: 18 })] })] }) },
      children,
    }],
  });
  const buffer = await Packer.toBuffer(document);
  return new Uint8Array(buffer);
}
