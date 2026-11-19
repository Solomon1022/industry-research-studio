/**
 * 本地持久化层（Dexie / IndexedDB）
 *
 * 数据完全存储在用户浏览器本地，不上传任何服务器——
 * 这是产品有意的隐私设计：背调数据可能含未公开的研究笔记。
 */

import Dexie, { type EntityTable } from "dexie";
import type { DataPoint, Project, Source } from "./types";
import type { EvidenceRecord, QuestionnaireDataset } from "./research-types";
import { seedDataPoints, seedProject, seedSources, SEED_PROJECT_ID } from "./seed-data";

export class ResearchDB extends Dexie {
  projects!: EntityTable<Project, "id">;
  sources!: EntityTable<Source, "id">;
  dataPoints!: EntityTable<DataPoint, "id">;
  evidence!: EntityTable<EvidenceRecord, "id">;
  questionnaires!: EntityTable<QuestionnaireDataset, "id">;

  constructor(name = "industry-research-studio") {
    super(name);
    this.version(1).stores({
      projects: "id, name, status, updatedAt",
      sources: "id, name, tier, updatedAt",
      dataPoints: "id, projectId, dimension, metric, sourceId, period, updatedAt",
    });
    // 仅新增表，不改动 v1 数据；旧版打开后自动原地升级。
    this.version(2).stores({
      projects: "id, name, status, updatedAt",
      sources: "id, name, tier, updatedAt",
      dataPoints: "id, projectId, dimension, metric, sourceId, period, updatedAt",
      evidence: "id, projectId, sourceId, status, acquiredAt",
      questionnaires: "id, projectId, importedAt",
    });
  }
}

export const db = new ResearchDB();

/** 首次启动时注入示例数据集（Strict Mode、多标签页下均保持幂等） */
let sharedSeedPromise: Promise<boolean> | null = null;

async function writeSeedData(database: ResearchDB): Promise<boolean> {
  return database.transaction("rw", database.projects, database.sources, database.dataPoints, async () => {
    const existing = await database.projects.get(SEED_PROJECT_ID);
    if (existing) return false;
    await database.projects.put(seedProject);
    await database.sources.bulkPut(seedSources);
    await database.dataPoints.bulkPut(seedDataPoints);
    return true;
  });
}

export async function ensureSeedData(database: ResearchDB = db): Promise<boolean> {
  if (database !== db) return writeSeedData(database);
  if (!sharedSeedPromise) {
    sharedSeedPromise = writeSeedData(database).catch((error) => {
      sharedSeedPromise = null;
      throw error;
    });
  }
  return sharedSeedPromise;
}

// ============ Project CRUD ============

export async function listProjects(database: ResearchDB = db): Promise<Project[]> {
  return database.projects.orderBy("updatedAt").reverse().toArray();
}

export async function getProject(id: string, database: ResearchDB = db): Promise<Project | undefined> {
  return database.projects.get(id);
}

export async function createProject(
  input: Omit<Project, "id" | "createdAt" | "updatedAt">,
  database: ResearchDB = db
): Promise<Project> {
  const now = Date.now();
  const project: Project = { ...input, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
  await database.projects.add(project);
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<Omit<Project, "id" | "createdAt">>,
  database: ResearchDB = db
): Promise<void> {
  await database.projects.update(id, { ...patch, updatedAt: Date.now() });
}

/** 删除项目及其全部关联数据 */
export async function deleteProject(id: string, database: ResearchDB = db): Promise<void> {
  await database.transaction("rw", [database.projects, database.dataPoints, database.evidence, database.questionnaires], async () => {
    await database.dataPoints.where("projectId").equals(id).delete();
    await database.evidence.where("projectId").equals(id).delete();
    await database.questionnaires.where("projectId").equals(id).delete();
    await database.projects.delete(id);
  });
}

/** 复制项目（含数据点；来源为全局共享，不复制） */
export async function duplicateProject(id: string, database: ResearchDB = db): Promise<Project | undefined> {
  const src = await database.projects.get(id);
  if (!src) return undefined;
  const now = Date.now();
  const copy: Project = {
    ...src,
    id: crypto.randomUUID(),
    name: `${src.name}（副本）`,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  const points = await database.dataPoints.where("projectId").equals(id).toArray();
  const copiedPoints = points.map((p) => ({
    ...p,
    id: crypto.randomUUID(),
    projectId: copy.id,
    createdAt: now,
    updatedAt: now,
  }));
  const copiedEvidence = (await database.evidence.where("projectId").equals(id).toArray())
    .map((item) => ({ ...item, id: crypto.randomUUID(), projectId: copy.id }));
  const copiedQuestionnaires = (await database.questionnaires.where("projectId").equals(id).toArray())
    .map((item) => ({ ...item, id: crypto.randomUUID(), projectId: copy.id }));
  await database.transaction("rw", [database.projects, database.dataPoints, database.evidence, database.questionnaires], async () => {
    await database.projects.add(copy);
    await database.dataPoints.bulkAdd(copiedPoints);
    await database.evidence.bulkAdd(copiedEvidence);
    await database.questionnaires.bulkAdd(copiedQuestionnaires);
  });
  return copy;
}

// ============ Source CRUD（来源为全局库，跨项目共享） ============

export async function listSources(database: ResearchDB = db): Promise<Source[]> {
  return database.sources.orderBy("updatedAt").reverse().toArray();
}

export async function upsertSource(
  input: Omit<Source, "id" | "createdAt" | "updatedAt"> & { id?: string },
  database: ResearchDB = db
): Promise<Source> {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  const existing = await database.sources.get(id);
  const source: Source = {
    ...input,
    id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await database.sources.put(source);
  return source;
}

/** 删除来源前检查是否仍被引用 */
export async function deleteSourceIfUnused(
  id: string,
  database: ResearchDB = db
): Promise<{ ok: boolean; referencedBy?: number }> {
  const count = await database.dataPoints.where("sourceId").equals(id).count();
  if (count > 0) return { ok: false, referencedBy: count };
  await database.sources.delete(id);
  return { ok: true };
}

// ============ DataPoint CRUD ============

export async function listDataPoints(projectId: string, database: ResearchDB = db): Promise<DataPoint[]> {
  return database.dataPoints.where("projectId").equals(projectId).toArray();
}

export async function upsertDataPoint(
  input: Omit<DataPoint, "id" | "createdAt" | "updatedAt"> & { id?: string },
  database: ResearchDB = db
): Promise<DataPoint> {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  const existing = await database.dataPoints.get(id);
  const point: DataPoint = {
    ...input,
    id,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await database.dataPoints.put(point);
  await database.projects.update(input.projectId, { updatedAt: now });
  return point;
}

export async function deleteDataPoint(id: string, database: ResearchDB = db): Promise<void> {
  await database.dataPoints.delete(id);
}

// ============ 统计 ============

export async function projectStats(
  projectId: string,
  database: ResearchDB = db
): Promise<{ dataPointCount: number; usedSourceIds: string[] }> {
  const points = await database.dataPoints.where("projectId").equals(projectId).toArray();
  const usedSourceIds = [...new Set(points.map((p) => p.sourceId).filter(Boolean))];
  return { dataPointCount: points.length, usedSourceIds };
}

// ============ Evidence / Questionnaire ============

export async function saveEvidence(
  input: Omit<EvidenceRecord, "id" | "acquiredAt" | "status"> & { id?: string; status?: EvidenceRecord["status"] },
  database: ResearchDB = db,
): Promise<EvidenceRecord> {
  const existing = input.id ? await database.evidence.get(input.id) : undefined;
  const record: EvidenceRecord = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    acquiredAt: existing?.acquiredAt ?? Date.now(),
    status: input.status ?? existing?.status ?? "inbox",
  };
  await database.evidence.put(record);
  return record;
}

export async function listEvidence(projectId: string, database: ResearchDB = db): Promise<EvidenceRecord[]> {
  return database.evidence.where("projectId").equals(projectId).reverse().sortBy("acquiredAt");
}

export async function deleteEvidence(id: string, database: ResearchDB = db): Promise<void> {
  await database.evidence.delete(id);
}

export async function saveQuestionnaire(
  input: Omit<QuestionnaireDataset, "id" | "importedAt"> & { id?: string },
  database: ResearchDB = db,
): Promise<QuestionnaireDataset> {
  const existing = input.id ? await database.questionnaires.get(input.id) : undefined;
  const dataset: QuestionnaireDataset = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    importedAt: existing?.importedAt ?? Date.now(),
  };
  await database.questionnaires.put(dataset);
  return dataset;
}

export async function updateQuestionnaire(
  id: string,
  patch: Partial<QuestionnaireDataset>,
  database: ResearchDB = db,
): Promise<void> {
  await database.questionnaires.update(id, { ...patch, id });
}

export async function listQuestionnaires(projectId: string, database: ResearchDB = db): Promise<QuestionnaireDataset[]> {
  return database.questionnaires.where("projectId").equals(projectId).reverse().sortBy("importedAt");
}
