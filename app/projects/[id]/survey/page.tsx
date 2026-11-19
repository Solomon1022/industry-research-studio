"use client";

import { use, useState } from "react";
import { Topbar } from "@/components/Topbar";
import { SurveyAnalyzer } from "@/components/research/SurveyAnalyzer";
import { desktopBridge } from "@/lib/desktop";
import { saveQuestionnaire, updateQuestionnaire } from "@/lib/db";
import { useProject, useQuestionnaires } from "@/lib/use-data";

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((header, index) => {
    const base = header.trim() || `字段_${index + 1}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

export default function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { project } = useProject(id);
  const { datasets = [] } = useQuestionnaires(id);
  const bridge = desktopBridge();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dataset = datasets.find((item) => item.id === selectedId) ?? datasets[0];
  return (
    <>
      <Topbar projectId={id} projectName={project?.name} />
      <main className="main">
        <h1 className="section-title">真实问卷分析</h1>
        <p className="section-desc">支持 CSV、Excel、SPSS .sav/.zsav。只分析导入数据，不生成样本；原始行不变，清洗排除逐条留痕。</p>
        <div className="search-row">
          <select className="select" aria-label="选择问卷数据集" value={dataset?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
            {!datasets.length && <option value="">尚未导入问卷</option>}
            {datasets.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.rows.length} 行）</option>)}
          </select>
          <button className="btn btn-primary" disabled={!bridge} onClick={async () => {
            if (!bridge) return;
            try {
              const payload = await bridge.extractFile();
              if (!payload?.tables.length) throw new Error("文件中没有可分析的表格");
              const table = payload.tables[0];
              const columns = uniqueHeaders(table.headers);
              const rows = table.rows.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null])));
              const saved = await saveQuestionnaire({ projectId: id, name: payload.fileName ?? payload.title, fileName: payload.fileName ?? payload.title, variables: columns.map((name) => ({ name, type: "numeric" })), rows });
              setSelectedId(saved.id);
            } catch (error) { window.alert(error instanceof Error ? error.message : String(error)); }
          }}>导入问卷文件</button>
        </div>
        {!bridge && <div className="issue issue-warning" style={{ marginTop: 16 }}>Web 版暂不提供本地文件解析；请在桌面版导入。</div>}
        {dataset && <SurveyAnalyzer key={dataset.id} dataset={dataset} onSaved={(result) => void updateQuestionnaire(dataset.id, { analysis: result })} />}
      </main>
    </>
  );
}
