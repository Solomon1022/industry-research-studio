/**
 * 行业研究工作台 · 领域类型定义
 *
 * 数据保真红线（与 industry-research skill 一致）：
 * - 每个数据点必须可追溯到来源（sourceId 必填）
 * - 预测值必须标 forecast=true（报告中渲染为「E」）
 * - 口径（metric/scope/unit）必须显式声明，不静默混用
 */

// ============ 基础枚举 ============

/** 六大研究维度（与 industry-research skill 的六维框架一致） */
export const DIMENSIONS = [
  "market",      // 市场规模与增速
  "competition", // 竞争格局与玩家
  "policy",      // 政策与监管
  "consumer",    // 消费者与用户
  "technology",  // 技术趋势
  "investment",  // 投融资
] as const;

export type Dimension = (typeof DIMENSIONS)[number];

/** 来源可靠度分级（A 级官方/财报，B 级机构研究，C 级媒体线索） */
export const SOURCE_TIERS = ["A", "B", "C"] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];

/** 统计口径：数据是哪种"规模" */
export const METRIC_KINDS = [
  "gmv",        // 成交总额（含未付款/退货）
  "paid",       // 实际支付额（扣退货）
  "revenue",    // 企业确认收入
  "users",      // 用户规模
  "penetration",// 渗透率（%）
  "count",      // 数量（企业数、事件数等）
  "amount",     // 金额（融资额、估值等）
  "ratio",      // 比率（占比、增速等）
  "text",       // 非数值条目（政策、案例、观点）
] as const;
export type MetricKind = (typeof METRIC_KINDS)[number];

/** 统计范围口径补充说明（如「含店播」「扣退货」「去重用户」） */
export interface ScopeNote {
  /** 简短口径标签，如 "GMV口径" / "支付口径" / "MAU去重" */
  label: string;
  /** 详细口径说明，可选 */
  detail?: string;
}

// ============ 来源 ============

export interface Source {
  id: string;
  /** 来源名称，如「网经社电数宝」 */
  name: string;
  /** 报告/文件全名，如《2025年度中国直播电商市场数据报告》 */
  title: string;
  /** 发布机构（可与 name 不同，如媒体转载时原始机构） */
  publisher?: string;
  /** 发布日期 ISO 字符串，如 "2025-03-15" */
  publishedAt?: string;
  /** 可访问链接 */
  url?: string;
  /** 可靠度分级 */
  tier: SourceTier;
  /** 链接当前可访问性 */
  linkStatus: "ok" | "dead" | "unknown";
  /** 备注（口径说明、样本量等） */
  note?: string;
  createdAt: number;
  updatedAt: number;
}

// ============ 数据点（六维条目） ============

/**
 * 一个数据点 = 某个维度下的一条可溯源记录。
 * 数值型与文本型共用同一结构：text 类型时 value 可空。
 */
export interface DataPoint {
  id: string;
  projectId: string;
  dimension: Dimension;
  /** 指标名，如「直播电商市场规模」「抖音双11用户规模」 */
  metric: string;
  /** 数值（text 类型可为 null） */
  value: number | null;
  /** 单位，如「亿元」「%」「亿人次」 */
  unit: string;
  /** 币种（金额为非人民币时必填，默认 CNY） */
  currency?: string;
  /** 时间：年份或 ISO 日期，如 2025 / "2024-06-18" */
  period: string;
  /** 指标类型 */
  kind: MetricKind;
  /** 口径说明 */
  scope: ScopeNote;
  /** 是否为预测值（渲染时标 E） */
  forecast: boolean;
  /** 来源（必填——数据保真红线） */
  sourceId: string;
  /** 主体（竞争格局维度用，如「抖音」「京东云言犀」） */
  subject?: string;
  /** 文本内容（政策条文、案例描述、观点） */
  text?: string;
  /** 附加说明（样本量、调研方式、多选题等） */
  note?: string;
  createdAt: number;
  updatedAt: number;
}

// ============ 项目 ============

export interface Project {
  id: string;
  /** 研究对象名，如「直播电商与 AI 虚拟主播」 */
  name: string;
  /** 项目类型；旧项目缺省视为 industry */
  kind?: "industry" | "thesis";
  /** 论文模式的变量与研究问题配置 */
  thesis?: import("./research-types").ThesisConfig;
  /** 行业/赛道边界描述 */
  industry: string;
  /** 地域范围，如「中国」 */
  region: string;
  /** 研究时间范围，如「2017-2025」 */
  periodRange: string;
  /** 启用的维度（默认六维全集） */
  dimensions: Dimension[];
  /** 项目状态 */
  status: "draft" | "active" | "done";
  /** 备注 */
  note?: string;
  createdAt: number;
  updatedAt: number;
}

// ============ 校验结果 ============

export type ValidationLevel = "error" | "warning" | "info";

export interface ValidationIssue {
  level: ValidationLevel;
  /** 规则标识，如 "missing-source" */
  rule: string;
  /** 人类可读的问题描述 */
  message: string;
  /** 关联的数据点 id（如有） */
  dataPointId?: string;
}

// ============ 工具类型 ============

export interface ProjectWithStats extends Project {
  dataPointCount: number;
  sourceCount: number;
  issueCount: number;
}

export const DIMENSION_LABELS: Record<Dimension, string> = {
  market: "市场规模与增速",
  competition: "竞争格局与玩家",
  policy: "政策与监管",
  consumer: "消费者与用户",
  technology: "技术趋势",
  investment: "投融资",
};

export const METRIC_KIND_LABELS: Record<MetricKind, string> = {
  gmv: "GMV 成交额",
  paid: "实际支付额",
  revenue: "企业营收",
  users: "用户规模",
  penetration: "渗透率",
  count: "数量",
  amount: "金额",
  ratio: "比率/占比",
  text: "文本条目",
};

export const SOURCE_TIER_LABELS: Record<SourceTier, string> = {
  A: "A级 · 官方/财报",
  B: "B级 · 机构研究",
  C: "C级 · 媒体线索",
};
