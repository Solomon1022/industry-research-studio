"use client";

import { use, useEffect, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { desktopBridge } from "@/lib/desktop";
import { MODEL_PRESETS, MODEL_PROVIDER_ORDER } from "@/lib/model-presets";
import { saveActiveModel, saveActiveSearchProvider } from "@/lib/client-settings";
import type { ModelProfile, ModelProvider, NetworkConfig, SearchProvider } from "@/lib/research-types";
import { useProject } from "@/lib/use-data";

function NetworkFields({ value, onChange }: { value: NetworkConfig; onChange: (value: NetworkConfig) => void }) {
  return (
    <div className="form-grid">
      <div className="field col-4">
        <label htmlFor="network-mode">网络方式</label>
        <select id="network-mode" className="select" value={value.mode} onChange={(event) => onChange({ mode: event.target.value as NetworkConfig["mode"], proxyUrl: value.proxyUrl })}>
          <option value="direct">直连（不使用代理）</option>
          <option value="system">跟随系统代理</option>
          <option value="custom">自定义 HTTP/HTTPS 代理</option>
        </select>
      </div>
      {value.mode === "custom" && (
        <div className="field col-8">
          <label htmlFor="proxy-url">代理地址</label>
          <input id="proxy-url" className="input" placeholder="http://127.0.0.1:7890" value={value.proxyUrl ?? ""} onChange={(event) => onChange({ ...value, proxyUrl: event.target.value })} />
          <span className="hint">仅用于网络连接适配，不用于绕过网站权限或访问控制</span>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project } = useProject(id);
  const bridge = desktopBridge();
  const [tab, setTab] = useState<"search" | "model">("search");
  const [searchProvider, setSearchProvider] = useState<SearchProvider>("tavily");
  const [searchKey, setSearchKey] = useState("");
  const [searchNetwork, setSearchNetwork] = useState<NetworkConfig>({ mode: "system" });
  const [searchStatus, setSearchStatus] = useState<Record<string, { configured: boolean; persistent: boolean }>>({});
  const [provider, setProvider] = useState<ModelProvider>("deepseek");
  const [profile, setProfile] = useState<ModelProfile>(MODEL_PRESETS.deepseek);
  const [modelKey, setModelKey] = useState("");
  const [modelNetwork, setModelNetwork] = useState<NetworkConfig>({ mode: "system" });
  const [modelStatus, setModelStatus] = useState<Record<string, { configured: boolean; persistent: boolean }>>({});
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    void Promise.all([bridge.searchStatus(), bridge.modelStatus()]).then(([search, model]) => {
      setSearchStatus(search); setModelStatus(model);
    }).catch((error: Error) => setMessage(error.message));
  }, [bridge]);

  const chooseProvider = (next: ModelProvider) => {
    setProvider(next);
    setProfile(MODEL_PRESETS[next]);
    setModelKey("");
    setMessage("");
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Topbar projectId={id} projectName={project?.name} />
      <main className="main">
        <h1 className="section-title">服务与模型设置</h1>
        <p className="section-desc">密钥仅交由桌面主进程使用系统加密保存；界面、日志和 GitHub 均不读取或保存密钥。Web 预览版不提供此设置。</p>
        {!bridge && <div className="issue issue-warning">当前为 Web 版。请使用桌面版配置搜索、模型、代理和授权浏览器。</div>}
        <div className="dim-tabs" style={{ marginTop: 16 }}>
          <button className={`dim-tab${tab === "search" ? " active" : ""}`} onClick={() => setTab("search")}>搜索服务</button>
          <button className={`dim-tab${tab === "model" ? " active" : ""}`} onClick={() => setTab("model")}>AI 模型中心</button>
        </div>

        {tab === "search" && (
          <section className="card">
            <h2 className="section-title">Tavily / Brave Search</h2>
            <p className="section-desc">两家服务可分别保存不同 Key；搜索请求在主进程执行，结果只返回标题、链接、摘要和来源分级。</p>
            <div className="form-grid">
              <div className="field col-4">
                <label htmlFor="search-provider">搜索服务</label>
                <select id="search-provider" className="select" value={searchProvider} onChange={(event) => setSearchProvider(event.target.value as SearchProvider)}>
                  <option value="tavily">Tavily {searchStatus.tavily?.configured ? "（已配置）" : ""}</option>
                  <option value="brave">Brave Search {searchStatus.brave?.configured ? "（已配置）" : ""}</option>
                </select>
              </div>
              <div className="field col-8">
                <label htmlFor="search-key">API Key（保存后不再回显）</label>
                <input id="search-key" className="input" type="password" autoComplete="off" value={searchKey} onChange={(event) => setSearchKey(event.target.value)} placeholder={searchProvider === "tavily" ? "tvly-..." : "Brave Search API Key"} />
              </div>
            </div>
            <NetworkFields value={searchNetwork} onChange={setSearchNetwork} />
            <button className="btn btn-primary" disabled={!bridge || busy || !searchKey.trim()} onClick={() => run(async () => {
              if (!bridge) return;
              const result = await bridge.saveSearchKey(searchProvider, searchKey, searchNetwork);
              saveActiveSearchProvider(searchProvider);
              setSearchStatus(await bridge.searchStatus());
              setSearchKey("");
              setMessage(result.persistent ? "搜索服务已加密保存，可前往「研究中心」检索。" : "系统加密不可用：Key 仅在本次运行期间有效，未写入磁盘。");
            })}>保存搜索配置</button>
          </section>
        )}

        {tab === "model" && (
          <section className="card">
            <h2 className="section-title">主流模型与自定义中转</h2>
            <p className="section-desc">模型用于检索词规划、证据整理与摘要辅助。任何 AI 输出都不能成为新数据来源，也不能自动把数据标为已核验。</p>
            <div className="provider-grid">
              {MODEL_PROVIDER_ORDER.map((item) => (
                <button key={item} className={`provider-option${provider === item ? " active" : ""}`} onClick={() => chooseProvider(item)}>
                  {MODEL_PRESETS[item].name}{modelStatus[item]?.configured ? <span>已配置</span> : null}
                </button>
              ))}
            </div>
            <div className="form-grid" style={{ marginTop: 16 }}>
              <div className="field col-6">
                <label htmlFor="base-url">Base URL</label>
                <input id="base-url" className="input" value={profile.baseUrl} onChange={(event) => setProfile({ ...profile, baseUrl: event.target.value })} placeholder="https://your-relay.example/v1" />
                <span className="hint">可填到 /v1，也可直接填完整 /chat/completions 地址</span>
              </div>
              <div className="field col-6">
                <label htmlFor="model-name">模型名 / 接入点 ID</label>
                <input id="model-name" className="input" value={profile.model} onChange={(event) => setProfile({ ...profile, model: event.target.value })} placeholder="以服务商后台为准" />
              </div>
              <div className="field col-12">
                <label htmlFor="model-key">API Key（保存后不再回显）</label>
                <input id="model-key" className="input" type="password" autoComplete="off" value={modelKey} onChange={(event) => setModelKey(event.target.value)} />
              </div>
            </div>
            <NetworkFields value={modelNetwork} onChange={setModelNetwork} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn btn-primary" disabled={!bridge || busy || !modelKey.trim()} onClick={() => run(async () => {
                if (!bridge) return;
                const result = await bridge.saveModel(profile, modelKey, modelNetwork);
                saveActiveModel(profile);
                setModelStatus(await bridge.modelStatus());
                setModelKey("");
                setMessage(result.persistent ? `${profile.name} 已保存并设为当前模型。` : "系统加密不可用：Key 仅在本次运行期间有效。");
              })}>保存并设为当前模型</button>
              <button className="btn" disabled={!bridge || busy} onClick={() => run(async () => {
                if (!bridge) return;
                const result = await bridge.testModel(profile);
                setMessage(result.message);
              })}>测试已保存配置</button>
            </div>
          </section>
        )}
        {message && <div className="issue issue-info" style={{ marginTop: 16 }} role="status">{message}</div>}
        <div className="guide" style={{ marginTop: 16 }}>
          <h4>安全边界</h4>
          <ul>
            <li>直连 / 系统代理 / 自定义代理只改变 API 的网络出口，不绕过网站登录、验证码、付费墙或 robots 规则。</li>
            <li>中转站由你选择并信任；发送给模型的证据内容会离开本机，请先移除个人信息、机密数据和账号信息。</li>
            <li>报告中的 AI 辅助段落会明确标记，仍须对照证据原文人工复核。</li>
          </ul>
        </div>
      </main>
    </>
  );
}
