"use client";

import { useState } from "react";
import { desktopBridge, type ExtractedPayload } from "@/lib/desktop";
import { PUBLIC_SOURCES } from "@/lib/source-catalog";
import { getActiveModel, getActiveSearchProvider, saveActiveSearchProvider } from "@/lib/client-settings";
import type { EvidenceMethod, SearchProvider, SearchResultItem } from "@/lib/research-types";

export function SearchPanel({ projectName, industry, onIngest }: {
  projectName: string;
  industry: string;
  onIngest: (payload: ExtractedPayload, method: EvidenceMethod) => Promise<void>;
}) {
  const bridge = desktopBridge();
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<SearchProvider>(getActiveSearchProvider());
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [plannedQueries, setPlannedQueries] = useState<string[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label); setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(""); }
  };

  const extract = (target: string, method: EvidenceMethod = "url") => run(`extract:${target}`, async () => {
    if (!bridge) throw new Error("网页提取需要桌面版；Web 版可继续手动录入");
    const payload = await bridge.extractUrl(target);
    await onIngest(payload, method);
    setMessage(`已提取《${payload.title}》：${payload.tables.length} 个表格，正文 ${payload.rawText.length} 字`);
  });

  const search = () => run("search", async () => {
    if (!bridge) throw new Error("主动检索需要桌面版");
    if (!query.trim()) throw new Error("请输入研究问题或检索词");
    saveActiveSearchProvider(provider);
    const items = await bridge.search(provider, query, 12);
    setResults(items);
    if (!items.length) setMessage("没有搜索结果，请调整关键词或改用 AI 规划检索词");
  });

  const planQueries = () => run("plan", async () => {
    if (!bridge) throw new Error("AI 检索规划需要桌面版");
    if (!query.trim()) throw new Error("先输入论文题目、行业或研究问题");
    const profile = getActiveModel();
    const text = await bridge.chat(profile, [
      { role: "system", content: "你是检索式规划器。只输出 JSON 数组，包含 5 个具体搜索字符串。优先官方统计、财报、机构原文、学术论文；不要生成任何数据、事实或文献。" },
      { role: "user", content: `研究项目：${projectName}\n行业边界：${industry}\n用户研究问题：${query}` },
    ], true);
    const parsed = JSON.parse(text.replace(/^```(?:json)?|```$/g, "").trim()) as unknown;
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) throw new Error("模型没有返回有效检索词数组，请重试");
    setPlannedQueries(parsed.slice(0, 5));
  });

  return (
    <section className="card">
      <div className="section-heading-row">
        <div>
          <h2 className="section-title">主动找数据</h2>
          <p className="section-desc">搜索结果只是线索；提取原文并保存证据后，才能进入论文选数。</p>
        </div>
        <button className="btn" disabled={!bridge || Boolean(busy)} onClick={planQueries}>AI 规划检索词</button>
      </div>
      <div className="search-row">
        <input className="input" aria-label="研究问题" placeholder="例如：AI 虚拟主播 直播互动性 购买意愿 行业规模 用户调研" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} />
        <select className="select search-provider" aria-label="搜索服务" value={provider} onChange={(event) => setProvider(event.target.value as SearchProvider)}>
          <option value="tavily">Tavily</option><option value="brave">Brave</option>
        </select>
        <button className="btn btn-primary" disabled={!bridge || Boolean(busy)} onClick={search}>{busy === "search" ? "检索中…" : "搜索"}</button>
      </div>
      {plannedQueries.length > 0 && (
        <div className="query-chips">
          {plannedQueries.map((item) => <button key={item} className="dim-tab" onClick={() => { setQuery(item); setPlannedQueries([]); }}>{item}</button>)}
        </div>
      )}
      <div className="search-row" style={{ marginTop: 12 }}>
        <input className="input" aria-label="公开或授权页面链接" placeholder="粘贴你已经找到的网页 / PDF 链接" value={url} onChange={(event) => setUrl(event.target.value)} />
        <button className="btn" disabled={!bridge || Boolean(busy) || !url.trim()} onClick={() => extract(url)}>提取链接</button>
        <button className="btn" disabled={!bridge || Boolean(busy) || !url.trim()} onClick={() => run("auth", async () => { if (!bridge) return; await bridge.openAuthorized(url); })}>授权打开</button>
        <button className="btn" disabled={!bridge || Boolean(busy)} onClick={() => run("file", async () => {
          if (!bridge) return;
          const payload = await bridge.extractFile();
          if (payload) { await onIngest(payload, "file"); setMessage(`已导入 ${payload.fileName ?? payload.title}`); }
        })}>导入文件</button>
      </div>
      {url && bridge && (
        <button className="btn btn-sm" style={{ marginTop: 8 }} disabled={Boolean(busy)} onClick={() => run("capture", async () => {
          const payload = await bridge.captureAuthorized();
          await onIngest(payload, "authorized-browser");
          setMessage(`已从授权窗口采集《${payload.title}》`);
        })}>采集当前授权页面</button>
      )}
      {message && <div className="issue issue-info" style={{ marginTop: 12 }} role="status">{message}</div>}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((item) => (
            <article key={item.url} className="search-result">
              <div className="search-result-main">
                <span className={`badge badge-tier-${item.tier}`}>{item.tier} 级</span>
                <strong>{item.title}</strong>
                <span className="search-url">{item.url}</span>
                <p>{item.snippet}</p>
              </div>
              <div className="search-result-actions">
                <button className="btn btn-sm" disabled={Boolean(busy)} onClick={() => extract(item.url, "search")}>提取原文</button>
                <button className="btn btn-sm" disabled={!bridge || Boolean(busy)} onClick={() => { setUrl(item.url); void run("auth", async () => { if (bridge) await bridge.openAuthorized(item.url); }); }}>授权打开</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <details className="source-directory">
        <summary>公开来源目录（{PUBLIC_SOURCES.length}）</summary>
        <div className="source-directory-grid">
          {PUBLIC_SOURCES.map((source) => (
            <button key={source.homepage} className="source-directory-item" onClick={() => setUrl(source.homepage)}>
              <span className={`badge badge-tier-${source.tier}`}>{source.tier}</span>
              <strong>{source.name}</strong><small>{source.coverage}</small>
            </button>
          ))}
        </div>
      </details>
    </section>
  );
}
