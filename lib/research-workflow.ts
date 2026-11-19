import { saveEvidence, upsertDataPoint, upsertSource } from "./db";
import { tierForUrl } from "./source-catalog";
import type { ExtractedPayload } from "./desktop";
import { assessCandidate } from "./evidence-score";
import type { CandidateMapping, CellValue, EvidenceMethod } from "./research-types";
import type { Source, MetricKind } from "./types";

function inferMetricKind(metric: string, unit: string, dimension: CandidateMapping["dimension"]): MetricKind {
  if (dimension === "policy") return "text";
  if (/渗透率/.test(metric)) return "penetration";
  if (/%|％|比例|增速|占比/.test(`${unit}${metric}`)) return "ratio";
  if (/人|户|账号|用户/.test(unit)) return "users";
  if (/GMV|成交总额/i.test(metric)) return "gmv";
  if (/支付/.test(metric)) return "paid";
  if (/营业收入|确认收入/.test(metric)) return "revenue";
  if (dimension === "investment" || /元|美元|欧元|港元|日元/.test(unit)) return "amount";
  return "count";
}

export async function ingestEvidence(projectId: string, payload: ExtractedPayload, method: EvidenceMethod) {
  const hostname = payload.url ? new URL(payload.url).hostname.replace(/^www\./, "") : "用户本地文件";
  const tier = payload.url ? tierForUrl(payload.url) : "C";
  const source = await upsertSource({
    name: payload.publisher || hostname,
    title: payload.title,
    publisher: payload.publisher || hostname,
    publishedAt: payload.publishedAt,
    url: payload.url,
    tier,
    linkStatus: payload.url ? "ok" : "unknown",
    note: `${method === "authorized-browser" ? "授权浏览器主动采集" : method === "file" ? "用户导入本地文件" : "公开链接提取"}；原始内容已存入证据库${payload.url ? "" : "，请人工核对来源等级"}`,
  });
  const evidence = await saveEvidence({
    projectId, sourceId: source.id, title: payload.title, url: payload.url,
    publisher: payload.publisher, publishedAt: payload.publishedAt, method,
    mediaType: payload.mediaType, rawText: payload.rawText, tables: payload.tables,
    metadata: payload.metadata, checksum: payload.checksum,
  });
  return { source, evidence };
}

function text(value: CellValue | undefined): string { return String(value ?? "").trim(); }
function numeric(value: CellValue | undefined): number | null {
  const cleaned = text(value).replace(/,/g, "").replace(/%$/, "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

export async function saveCandidateRows(input: {
  projectId: string;
  source: Source;
  headers: string[];
  rows: CellValue[][];
  selectedIndexes: number[];
  mapping: CandidateMapping;
  defaultUnit: string;
  defaultScope: string;
  note?: string;
}) {
  const saved = [];
  const skipped: string[] = [];
  for (const index of input.selectedIndexes) {
    const row = input.rows[index];
    if (!row) continue;
    const period = text(row[input.mapping.period]);
    const rawValue = text(row[input.mapping.value]);
    const isText = input.mapping.dimension === "policy";
    const value = isText ? null : numeric(row[input.mapping.value]);
    const unit = isText ? "文本" : input.mapping.unit >= 0 ? text(row[input.mapping.unit]) : input.defaultUnit;
    const scope = input.mapping.scope >= 0 ? text(row[input.mapping.scope]) : input.defaultScope;
    const metric = text(row[input.mapping.metric]);
    const assessment = assessCandidate({ source: input.source, period, value: isText ? rawValue : value, unit, scope });
    if (assessment.verdict === "reject") { skipped.push(`第 ${index + 2} 行：${assessment.reasons.join("；")}`); continue; }
    const point = await upsertDataPoint({
      projectId: input.projectId,
      dimension: input.mapping.dimension,
      metric,
      value,
      unit,
      period,
      kind: inferMetricKind(metric, unit, input.mapping.dimension),
      scope: { label: scope, detail: `由证据表格映射导入；${assessment.reasons.join("；")}` },
      forecast: input.mapping.forecast,
      sourceId: input.source.id,
      subject: input.mapping.subject >= 0 ? text(row[input.mapping.subject]) || undefined : undefined,
      text: isText ? rawValue : undefined,
      note: [input.note, `原表第 ${index + 2} 行`, ...assessment.reasons].filter(Boolean).join("；"),
    });
    saved.push(point);
  }
  return { saved, skipped };
}
