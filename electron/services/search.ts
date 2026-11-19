import { tierForUrl } from "../../lib/source-catalog";
import type { SearchProvider, SearchResultItem } from "../../lib/research-types";
import { getSecret } from "./store";
import { fetchWithNetwork } from "./http";

interface TavilyResult { title?: string; url?: string; content?: string; score?: number; published_date?: string }
interface BraveResult { title?: string; url?: string; description?: string; page_age?: string; age?: string }

export async function searchWeb(provider: SearchProvider, query: string, maxResults = 10): Promise<SearchResultItem[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2 || cleanQuery.length > 500) throw new Error("检索词需为 2–500 个字符");
  const count = Math.max(1, Math.min(20, Math.round(maxResults)));
  const { apiKey, network } = await getSecret("search", provider);
  if (!apiKey) throw new Error(`尚未配置 ${provider === "tavily" ? "Tavily" : "Brave"} API Key`);
  let results: SearchResultItem[];
  if (provider === "tavily") {
    const response = await fetchWithNetwork("https://api.tavily.com/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: cleanQuery, max_results: count, search_depth: "advanced", include_answer: false }),
    }, network);
    if (!response.ok) throw new Error(`Tavily 请求失败（HTTP ${response.status}）`);
    const data = await response.json() as { results?: TavilyResult[] };
    results = (data.results ?? []).flatMap((item, index) => item.url ? [{
      title: item.title || item.url,
      url: item.url,
      snippet: item.content || "",
      publishedAt: item.published_date,
      tier: tierForUrl(item.url),
      score: item.score ?? 1 - index / Math.max(1, count),
    }] : []);
  } else {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", cleanQuery);
    url.searchParams.set("count", String(count));
    const response = await fetchWithNetwork(url.toString(), {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
    }, network);
    if (!response.ok) throw new Error(`Brave 请求失败（HTTP ${response.status}）`);
    const data = await response.json() as { web?: { results?: BraveResult[] } };
    results = (data.web?.results ?? []).flatMap((item, index) => item.url ? [{
      title: item.title || item.url,
      url: item.url,
      snippet: item.description || "",
      publishedAt: item.page_age || item.age,
      tier: tierForUrl(item.url),
      score: 1 - index / Math.max(1, count),
    }] : []);
  }
  const tierWeight = { A: 0.16, B: 0.08, C: 0 };
  return results.sort((a, b) => (b.score + tierWeight[b.tier]) - (a.score + tierWeight[a.tier]));
}
