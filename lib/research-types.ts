/** 主动研究、证据、论文与问卷的数据模型。所有采集结果都保留原始文本与来源定位。 */

import type { Dimension, SourceTier } from "./types";

export type CellValue = string | number | boolean | null;

export interface EvidenceTable {
  id: string;
  name: string;
  headers: string[];
  rows: CellValue[][];
  /** 表在原文中的位置，如 table 2 / Sheet1 / 第 4 页 */
  locator: string;
}

export type EvidenceMethod = "search" | "url" | "file" | "authorized-browser" | "manual";
export type EvidenceMediaType = "html" | "pdf" | "csv" | "xlsx" | "sav" | "text";

export interface EvidenceRecord {
  id: string;
  projectId: string;
  sourceId: string;
  title: string;
  url?: string;
  publisher?: string;
  publishedAt?: string;
  acquiredAt: number;
  method: EvidenceMethod;
  mediaType: EvidenceMediaType;
  rawText: string;
  tables: EvidenceTable[];
  metadata: Record<string, string>;
  checksum?: string;
  status: "inbox" | "used" | "rejected";
  note?: string;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  publishedAt?: string;
  tier: SourceTier;
  score: number;
}

export interface ThesisConfig {
  researchQuestions: string[];
  independentVar: string;
  mediator: string;
  dependentVar: string;
  controls: string[];
  /** 用户自己的固定文献清单；为空时不得生成参考文献或编号。 */
  fixedReferences: string[];
}

export interface QuestionnaireVariable {
  name: string;
  label?: string;
  type: "numeric" | "string" | "date";
  missingValues?: string[];
}

export interface QuestionnaireDataset {
  id: string;
  projectId: string;
  name: string;
  fileName?: string;
  variables: QuestionnaireVariable[];
  rows: Array<Record<string, CellValue>>;
  importedAt: number;
  /** 最近一次真实统计结果；原始 rows 永不被分析过程覆盖。 */
  analysis?: SurveyAnalysisResult;
}

export interface ExclusionLog {
  rowNumber: number;
  reasons: string[];
}

export interface DescriptiveResult {
  variable: string;
  n: number;
  missing: number;
  mean: number;
  sd: number;
  median: number;
  min: number;
  max: number;
}

export interface ReliabilityResult {
  variables: string[];
  n: number;
  itemCount: number;
  alpha: number;
}

export interface ValidityResult {
  n: number;
  variableCount: number;
  kmo: number;
  bartlettChiSquare: number;
  bartlettDf: number;
  bartlettP: number;
}

export interface RegressionCoefficient {
  variable: string;
  coefficient: number;
  standardError: number;
  t: number;
  p: number;
}

export interface RegressionResult {
  dependent: string;
  predictors: string[];
  n: number;
  r2: number;
  adjustedR2: number;
  coefficients: RegressionCoefficient[];
}

export interface MediationResult {
  x: string;
  m: string;
  y: string;
  controls: string[];
  n: number;
  a: number;
  b: number;
  direct: number;
  total: number;
  indirect: number;
  bootstrapIterations: number;
  indirectCi95: [number, number];
  regressions: {
    total: RegressionResult;
    mediator: RegressionResult;
    direct: RegressionResult;
  };
}

export interface SurveyAnalysisResult {
  originalN: number;
  analysisN: number;
  exclusions: ExclusionLog[];
  descriptive: DescriptiveResult[];
  reliability?: ReliabilityResult;
  validity?: ValidityResult;
  correlations: Array<{ x: string; y: string; r: number; p: number; n: number }>;
  mediation?: MediationResult;
  warnings: string[];
}

export type ProxyMode = "direct" | "system" | "custom";
export interface NetworkConfig {
  mode: ProxyMode;
  /** 仅在 custom 时使用，如 http://127.0.0.1:7890；不允许认证信息写入日志。 */
  proxyUrl?: string;
}

export type SearchProvider = "tavily" | "brave";
export type ModelProvider =
  | "openai" | "deepseek" | "qwen" | "doubao" | "moonshot" | "zhipu"
  | "gemini" | "anthropic" | "openrouter" | "custom";

export interface ModelProfile {
  id: ModelProvider;
  name: string;
  baseUrl: string;
  model: string;
  apiStyle: "openai" | "anthropic";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CandidateAssessment {
  verdict: "recommended" | "review" | "reject";
  score: number;
  reasons: string[];
}

export interface CandidateMapping {
  metric: number;
  period: number;
  value: number;
  unit: number;
  subject: number;
  scope: number;
  dimension: Dimension;
  forecast: boolean;
}
