"use client";

/**
 * 客户端数据访问 hooks
 *
 * 基于 dexie-react-hooks 的 useLiveQuery：
 * Dexie 数据变更（含其他标签页）会自动驱动 UI 更新，
 * 无需手动 refresh——写入即响应。
 */

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db, ensureSeedData } from "./db";

export function useSeedOnBoot(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void ensureSeedData().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  return ready;
}

export function useProjects() {
  const projects = useLiveQuery(
    () => db.projects.orderBy("updatedAt").reverse().toArray(),
    []
  );
  return { projects, loading: projects === undefined };
}

export function useProject(id: string) {
  const project = useLiveQuery(() => db.projects.get(id), [id]);
  return { project, loading: project === undefined };
}

export function useDataPoints(projectId: string) {
  const dataPoints = useLiveQuery(
    () => db.dataPoints.where("projectId").equals(projectId).toArray(),
    [projectId]
  );
  return { dataPoints, loading: dataPoints === undefined };
}

export function useSources() {
  const sources = useLiveQuery(
    () => db.sources.orderBy("updatedAt").reverse().toArray(),
    []
  );
  return { sources, loading: sources === undefined };
}

export function useEvidence(projectId: string) {
  const evidence = useLiveQuery(
    () => db.evidence.where("projectId").equals(projectId).reverse().sortBy("acquiredAt"),
    [projectId]
  );
  return { evidence, loading: evidence === undefined };
}

export function useQuestionnaires(projectId: string) {
  const datasets = useLiveQuery(
    () => db.questionnaires.where("projectId").equals(projectId).reverse().sortBy("importedAt"),
    [projectId]
  );
  return { datasets, loading: datasets === undefined };
}

/** 项目统计（数据点数 / 引用的来源数），随数据实时更新 */
export function useProjectStats(projectId: string) {
  return useLiveQuery(async () => {
    const points = await db.dataPoints.where("projectId").equals(projectId).toArray();
    return {
      count: points.length,
      sources: new Set(points.map((p) => p.sourceId).filter(Boolean)).size,
    };
  }, [projectId]);
}

/** 全部来源的被引用计数（跨项目），随数据实时更新 */
export function useSourceRefCounts() {
  return useLiveQuery(async () => {
    const points = await db.dataPoints.toArray();
    const m = new Map<string, number>();
    for (const p of points) {
      if (p.sourceId) m.set(p.sourceId, (m.get(p.sourceId) ?? 0) + 1);
    }
    return m;
  }, []);
}

/** 触发浏览器下载一个文本文件 */
export function downloadTextFile(filename: string, content: string, mime = "text/markdown") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
