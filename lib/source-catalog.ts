import type { SourceTier } from "./types";

export interface PublicSourceEntry {
  name: string;
  homepage: string;
  tier: SourceTier;
  coverage: string;
  queryHint: string;
}

/** 检索优先目录，不代表其中每篇资料都自动可信；仍以具体原文、日期和口径为准。 */
export const PUBLIC_SOURCES: PublicSourceEntry[] = [
  { name: "国家统计局", homepage: "https://www.stats.gov.cn", tier: "A", coverage: "宏观经济、社零、网零、人口", queryHint: "site:stats.gov.cn 行业 指标 年份" },
  { name: "商务部", homepage: "https://www.mofcom.gov.cn", tier: "A", coverage: "电子商务、消费、外贸与政策", queryHint: "site:mofcom.gov.cn 行业 报告 年份" },
  { name: "国家市场监督管理总局", homepage: "https://www.samr.gov.cn", tier: "A", coverage: "市场监管、企业、执法", queryHint: "site:samr.gov.cn 行业 监管" },
  { name: "中国互联网络信息中心 CNNIC", homepage: "https://www.cnnic.net.cn", tier: "A", coverage: "互联网用户、应用与网络行为", queryHint: "site:cnnic.net.cn 互联网发展统计报告" },
  { name: "中国信通院", homepage: "https://www.caict.ac.cn", tier: "B", coverage: "数字经济、技术与产业白皮书", queryHint: "site:caict.ac.cn 白皮书 行业 年份" },
  { name: "国家金融监督管理总局", homepage: "https://www.nfra.gov.cn", tier: "A", coverage: "金融与监管", queryHint: "site:nfra.gov.cn 行业 数据" },
  { name: "海关总署", homepage: "http://www.customs.gov.cn", tier: "A", coverage: "进出口与跨境电商", queryHint: "site:customs.gov.cn 进出口 行业" },
  { name: "SEC EDGAR", homepage: "https://www.sec.gov/edgar/search/", tier: "A", coverage: "美股公司财报与法定披露", queryHint: "site:sec.gov company 10-k metric" },
  { name: "港交所披露易", homepage: "https://www1.hkexnews.hk", tier: "A", coverage: "港股公告、财报、招股书", queryHint: "site:hkexnews.hk 公司 年报" },
  { name: "艾瑞咨询", homepage: "https://www.iresearch.com.cn", tier: "B", coverage: "互联网、电商与数字经济研究", queryHint: "site:iresearch.com.cn 行业 研究报告" },
  { name: "艾媒咨询", homepage: "https://www.iimedia.cn", tier: "B", coverage: "新经济、消费与调研", queryHint: "site:iimedia.cn 行业 数据 年份" },
  { name: "QuestMobile", homepage: "https://www.questmobile.com.cn", tier: "B", coverage: "移动互联网用户与行为", queryHint: "site:questmobile.com.cn 行业 用户 报告" },
  { name: "网经社", homepage: "https://www.100ec.cn", tier: "B", coverage: "电商、直播与跨境数据", queryHint: "site:100ec.cn 电数宝 行业 数据" },
  { name: "Stanford HAI AI Index", homepage: "https://hai.stanford.edu/ai-index", tier: "B", coverage: "人工智能年度数据", queryHint: "site:hai.stanford.edu ai index report" },
  { name: "Crossref", homepage: "https://search.crossref.org", tier: "B", coverage: "论文 DOI 与书目信息", queryHint: "论文题名 DOI" },
];

const A_DOMAINS = ["stats.gov.cn", "mofcom.gov.cn", "samr.gov.cn", "gov.cn", "cnnic.net.cn", "sec.gov", "hkexnews.hk", "customs.gov.cn", "nfra.gov.cn", "pbc.gov.cn"];
const B_DOMAINS = ["caict.ac.cn", "iresearch.com.cn", "iimedia.cn", "questmobile.com.cn", "100ec.cn", "idc.com", "gartner.com", "mckinsey.com", "bcg.com", "bain.com", "statista.com", "hai.stanford.edu", "cnki.net", "wanfangdata.com.cn", "doi.org"];

export function tierForUrl(url: string): SourceTier {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (A_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return "A";
    if (B_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return "B";
    return "C";
  } catch {
    return "C";
  }
}
