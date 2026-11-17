/**
 * 六维研究指南（内置方法论，源自 industry-research skill）
 *
 * 每个维度给出：要回答的问题、核心指标、口径陷阱、来源指向。
 * 在产品录入页按维度展示，帮助用户把「背调方法论」落到实处。
 */

import type { Dimension } from "./types";

export interface DimensionGuide {
  dimension: Dimension;
  questions: string[];
  keyMetrics: Array<{ name: string; plain: string }>;
  pitfalls: string[];
  sourceHints: string[];
}

export const DIMENSION_GUIDES: DimensionGuide[] = [
  {
    dimension: "market",
    questions: ["这个行业现在多大？", "过去怎么长起来的？", "未来还能长多快？"],
    keyMetrics: [
      { name: "市场规模", plain: "一定时期内的成交总量——类比：量一个池塘有多少水" },
      { name: "同比增速 YoY", plain: "本期 ÷ 去年同期 − 1，如 100 vs 80 即 +25%" },
      { name: "CAGR", plain: "多年平均增速，(期末÷期初)^(1/年数)−1，平滑对比用" },
      { name: "渗透率", plain: "占上层大盘的比例；S 型曲线后段放缓≠衰退" },
    ],
    pitfalls: [
      "区分 GMV（含退货）/ 支付口径 / 营收口径，三者可能差一倍以上",
      "不同机构数字差异常源于是否含店播、退货处理、统计范围",
      "预测值必须标 E 并注明机构与年份",
    ],
    sourceHints: ["统计局、商务部等官方数据", "网经社电数宝 / 艾瑞 / 艾媒 / IDC", "上市公司财报"],
  },
  {
    dimension: "competition",
    questions: ["谁在场上？", "头部占多少？", "各自靠什么赢？"],
    keyMetrics: [
      { name: "市场份额", plain: "单个玩家规模 ÷ 全行业规模，对口径高度敏感" },
      { name: "集中度 CRn", plain: "前 n 名份额之和，衡量头部垄断程度" },
      { name: "商业模式", plain: "企业如何赚钱：抽佣 / 广告 / 订阅 / 自营差价…" },
      { name: "竞争壁垒", plain: "网络效应、规模成本、牌照、供应链、数据资产" },
    ],
    pitfalls: [
      "份额饼图若来自低质量二手报告且与财报矛盾，弃用",
      "改用各玩家官方披露的绝对值对比，并注明口径差异",
    ],
    sourceHints: ["财报与招股书", "行业白皮书与券商研报", "平台官方数据"],
  },
  {
    dimension: "policy",
    questions: ["谁在管？", "规则是什么？", "合规红线在哪？"],
    keyMetrics: [
      { name: "主管部门", plain: "行业对应的行政监管机构" },
      { name: "法规层级", plain: "法律 > 行政法规 > 部门规章 > 规范性文件" },
      { name: "监管动作", plain: "专项整治、处罚、牌照与备案要求、国家标准" },
    ],
    pitfalls: [
      "政策以官方原文为准，不依据媒体转述下结论",
      "引用条款时核对文号、发布与生效日期，区分现行有效与待生效",
    ],
    sourceHints: ["gov.cn 及各部委官网", "国家标准平台", "官方政策解读"],
  },
  {
    dimension: "consumer",
    questions: ["用户是谁？", "怎么行为？", "什么态度？"],
    keyMetrics: [
      { name: "用户规模 DAU/MAU", plain: "去重活跃用户；跨平台用户需去重口径" },
      { name: "客单价 AOV", plain: "总成交额 ÷ 订单数" },
      { name: "复购/留存", plain: "行为忠诚度的核心指标" },
      { name: "态度调研", plain: "偏好、满意度、购买意愿；单选与多选要区分" },
    ],
    pitfalls: [
      "问卷数据注明样本量、调研机构与时间",
      "多选题占比之和大于 100% 属正常，不是错误",
    ],
    sourceHints: ["QuestMobile / 艾瑞 / 艾媒调研", "学术实证研究", "平台官方披露"],
  },
  {
    dimension: "technology",
    questions: ["什么技术在改变行业？", "成熟度如何？"],
    keyMetrics: [
      { name: "关键技术", plain: "对行业有实质影响的技术（大模型、数字人、算法…）" },
      { name: "成熟度", plain: "实验室 / 试点 / 规模化，用落地案例佐证" },
      { name: "效能证据", plain: "成本下降、效率提升、转化变化的量化指标" },
    ],
    pitfalls: [
      "厂商宣传的效能数字标注为「企业披露」，与独立研究区分",
      "不把相关性表述为因果",
    ],
    sourceHints: ["技术白皮书", "企业发布会与官方博客", "同行评议论文"],
  },
  {
    dimension: "investment",
    questions: ["资本在往哪走？", "估值如何？"],
    keyMetrics: [
      { name: "融资事件", plain: "轮次、金额、投资方、并购、IPO" },
      { name: "热度趋势", plain: "事件数量与披露金额的时序变化" },
      { name: "估值", plain: "公开披露估值或上市市值，注明时点" },
    ],
    pitfalls: ["未披露金额不臆造，标注「未披露」", "估值随时间波动，必须标注时点"],
    sourceHints: ["企业公告与交易所披露", "投融资数据库", "权威财经媒体"],
  },
];
