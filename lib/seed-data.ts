/**
 * 内置示例数据集：直播电商与 AI 虚拟主播
 *
 * 全部数据来自公开可溯源来源（见各来源条目），用作产品功能演示与
 * industry-research skill 的首个应用样板。严禁在此数据集中虚构任何数字。
 */

import type { DataPoint, Project, Source } from "./types";

export const SEED_PROJECT_ID = "seed-live-commerce";

export const seedProject: Project = {
  id: SEED_PROJECT_ID,
  name: "直播电商与 AI 虚拟主播",
  industry: "直播电商 / 数字人技术应用",
  region: "中国",
  periodRange: "2017-2030E",
  dimensions: ["market", "competition", "policy", "consumer", "technology", "investment"],
  status: "done",
  note: "示例项目：演示六维背调的完整数据结构。数据保留多机构口径差异，不混用。",
  createdAt: Date.parse("2026-11-17T00:00:00+08:00"),
  updatedAt: Date.parse("2026-11-17T00:00:00+08:00"),
};

export const seedSources: Source[] = [
  {
    id: "src-100ec-2025",
    name: "网经社电数宝",
    title: "2025年度中国直播电商市场数据报告",
    publisher: "网经社电子商务研究中心",
    publishedAt: "2026-03",
    url: "https://www.100ec.cn/",
    tier: "B",
    linkStatus: "ok",
    note: "GMV 口径，含退货与店播统计；与其他机构口径存在差异，报告中并列说明",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "src-iimedia-dh-2025",
    name: "艾媒咨询",
    title: "中国数字人产业发展白皮书（核心市场与带动市场）",
    publisher: "iiMedia Research",
    publishedAt: "2025",
    url: "https://www.iimedia.cn/",
    tier: "B",
    linkStatus: "ok",
    note: "数字人「核心市场」与「带动市场」两套口径并列",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "src-questmobile-d11",
    name: "QuestMobile",
    title: "双11 电商平台 App 用户规模监测",
    publisher: "QuestMobile",
    publishedAt: "2024-11",
    url: "https://www.questmobile.com.cn/",
    tier: "B",
    linkStatus: "ok",
    note: "统一监测口径的横向对比，用于替代存在争议的 GMV 份额饼图",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "src-jdcloud-yanxi",
    name: "京东云官方披露",
    title: "言犀数字人 2024 年 618 大促运营数据",
    publisher: "京东云",
    publishedAt: "2024-06",
    url: "https://www.jdcloud.com/",
    tier: "A",
    linkStatus: "ok",
    note: "企业官方披露，属厂商口径，与独立第三方数据区分",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "src-baidu-huiboxing",
    name: "百度官方披露",
    title: "慧播星数字人直播产品数据",
    publisher: "百度",
    publishedAt: "2024",
    url: "https://www.baidu.com/",
    tier: "A",
    linkStatus: "ok",
    note: "企业官方披露的效能数据（成本/GMV 变化），标注为厂商口径",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "src-kuaishou-ir",
    name: "快手财报",
    title: "快手科技季度及年度业绩公告",
    publisher: "快手科技（港交所：1024）",
    publishedAt: "2025",
    url: "https://ir.kuaishou.com/",
    tier: "A",
    linkStatus: "ok",
    note: "上市公司法定披露",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

const base = { createdAt: Date.now(), updatedAt: Date.now() };

/** 市场规模时间序列（网经社电数宝，GMV 口径，亿元） */
const marketSize: Array<[number, number]> = [
  [2017, 196.4], [2018, 1354.1], [2019, 4437.5], [2020, 12850],
  [2021, 23615.1], [2022, 35000], [2023, 49168], [2024, 53256], [2025, 69461],
];

const penetration: Array<[number, number]> = [
  [2017, 0.27], [2018, 1.6], [2019, 4.3], [2020, 10],
  [2021, 17.97], [2022, 25.3], [2023, 31.9], [2024, 34.3], [2025, 36.02],
];

/** 数字人核心市场（艾媒，亿元）；2030 为预测 */
const dhCore: Array<[number, number, boolean]> = [
  [2023, 205.2, false], [2024, 339.2, false], [2025, 480.6, false], [2030, 935.6, true],
];
const dhDriven: Array<[number, number, boolean]> = [
  [2023, 3334.7, false], [2024, 4785.3, false], [2025, 6402.7, false], [2030, 10468.6, true],
];

/** 双11 App 用户规模（QuestMobile，亿） */
const d11Users: Array<[string, number]> = [
  ["抖音", 6.32], ["淘宝", 5.08], ["拼多多", 4.14],
  ["京东", 2.27], ["快手", 1.96], ["小红书", 1.22],
];

let n = 0;
const nid = () => `dp-seed-${String(++n).padStart(3, "0")}`;

export const seedDataPoints: DataPoint[] = [
  // ===== 市场规模与增速 =====
  ...marketSize.map(([year, v]): DataPoint => ({
    id: nid(), projectId: SEED_PROJECT_ID, dimension: "market",
    metric: "直播电商市场规模", value: v, unit: "亿元",
    period: String(year), kind: "gmv",
    scope: { label: "GMV口径（含退货/店播）", detail: "网经社电数宝口径；与支付口径存在差异" },
    forecast: false, sourceId: "src-100ec-2025",
    createdAt: base.createdAt, updatedAt: base.updatedAt,
  })),
  ...penetration.map(([year, v]): DataPoint => ({
    id: nid(), projectId: SEED_PROJECT_ID, dimension: "market",
    metric: "直播电商渗透率", value: v, unit: "%",
    period: String(year), kind: "penetration",
    scope: { label: "占网络零售额比例" },
    forecast: false, sourceId: "src-100ec-2025",
    note: "渗透率进入 S 型曲线后半段，增速放缓不代表行业衰退",
    createdAt: base.createdAt, updatedAt: base.updatedAt,
  })),

  // ===== 技术趋势：数字人市场 =====
  ...dhCore.map(([year, v, f]): DataPoint => ({
    id: nid(), projectId: SEED_PROJECT_ID, dimension: "technology",
    metric: "数字人核心市场规模", value: v, unit: "亿元",
    period: String(year), kind: "revenue",
    scope: { label: "核心市场（艾媒口径）" },
    forecast: f, sourceId: "src-iimedia-dh-2025",
    createdAt: base.createdAt, updatedAt: base.updatedAt,
  })),
  ...dhDriven.map(([year, v, f]): DataPoint => ({
    id: nid(), projectId: SEED_PROJECT_ID, dimension: "technology",
    metric: "数字人带动市场规模", value: v, unit: "亿元",
    period: String(year), kind: "gmv",
    scope: { label: "带动市场（艾媒口径）" },
    forecast: f, sourceId: "src-iimedia-dh-2025",
    note: "与核心市场为两套口径，不可相加",
    createdAt: base.createdAt, updatedAt: base.updatedAt,
  })),

  // ===== 竞争格局：双11 用户规模（统一口径替代争议份额） =====
  ...d11Users.map(([subject, v]): DataPoint => ({
    id: nid(), projectId: SEED_PROJECT_ID, dimension: "competition",
    metric: "双11期间App用户规模", subject, value: v, unit: "亿",
    period: "2024-11", kind: "users",
    scope: { label: "QuestMobile监测（去重）" },
    forecast: false, sourceId: "src-questmobile-d11",
    note: "弃用存在口径矛盾的 GMV 份额饼图，改用统一监测口径的用户规模横向对比",
    createdAt: base.createdAt, updatedAt: base.updatedAt,
  })),

  // ===== 技术趋势：标杆案例（文本条目） =====
  {
    id: nid(), projectId: SEED_PROJECT_ID, dimension: "technology",
    metric: "京东云言犀数字人 618 大促", subject: "京东云言犀",
    value: null, unit: "", period: "2024-06", kind: "text",
    scope: { label: "企业官方披露" },
    forecast: false, sourceId: "src-jdcloud-yanxi",
    text: "2024 年 618 期间服务 5000+ 品牌，累计直播 40 万+ 小时，观看超 1 亿人次，互动超 500 万次。",
    note: "厂商口径，效能数据未经第三方审计",
    createdAt: base.createdAt, updatedAt: base.updatedAt,
  },
  {
    id: nid(), projectId: SEED_PROJECT_ID, dimension: "technology",
    metric: "百度慧播星数字人", subject: "百度慧播星",
    value: null, unit: "", period: "2024", kind: "text",
    scope: { label: "企业官方披露" },
    forecast: false, sourceId: "src-baidu-huiboxing",
    text: "5 分钟即可生成数字人直播间；官方称开播成本下降约 80%，带动 GMV 提升约 62%（厂商口径）。",
    note: "效能数字为企业披露，与独立研究结论区分",
    createdAt: base.createdAt, updatedAt: base.updatedAt,
  },

  // ===== 政策与监管（文本条目，核对原文时补充文号） =====
  {
    id: nid(), projectId: SEED_PROJECT_ID, dimension: "policy",
    metric: "直播电商监管框架",
    value: null, unit: "", period: "2021-2025", kind: "text",
    scope: { label: "法规原文为准" },
    forecast: false, sourceId: "src-100ec-2025",
    text: "行业监管覆盖《电子商务法》《网络交易监督管理办法》及直播营销专门规范；AI 数字人直播的标识、广告合规为近年监管重点。引用具体条款时需核对官方原文与文号。",
    note: "政策引用一律以 gov.cn 官方原文为准，不依据媒体转述",
    createdAt: base.createdAt, updatedAt: base.updatedAt,
  },

  // ===== 投融资（示例：未披露标注） =====
  {
    id: nid(), projectId: SEED_PROJECT_ID, dimension: "investment",
    metric: "数字人赛道投融资热度",
    value: null, unit: "", period: "2024-2025", kind: "text",
    scope: { label: "公开披露事件整理" },
    forecast: false, sourceId: "src-iimedia-dh-2025",
    text: "数字人直播 SaaS、虚拟主播 IP 运营为近两年资本关注方向；多数早期轮次未披露金额，标注为「未披露」，不做估算填充。",
    createdAt: base.createdAt, updatedAt: base.updatedAt,
  },

  // ===== 消费者（示例：标注待补充样本量） =====
  {
    id: nid(), projectId: SEED_PROJECT_ID, dimension: "consumer",
    metric: "消费者对虚拟主播直播的接受度",
    value: null, unit: "", period: "2024", kind: "text",
    scope: { label: "问卷调研（多选题）" },
    forecast: false, sourceId: "src-iimedia-dh-2025",
    text: "调研显示消费者关注虚拟主播的「互动真实感」「商品讲解专业度」与「价格透明度」；多选题占比之和大于 100% 属正常。",
    note: "待补充：具体样本量与调研时间窗",
    createdAt: base.createdAt, updatedAt: base.updatedAt,
  },
];
