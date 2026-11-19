import { jStat } from "jstat";
import type {
  CellValue, DescriptiveResult, ExclusionLog, MediationResult, RegressionResult,
  ReliabilityResult, SurveyAnalysisResult, ValidityResult,
} from "../research-types";
import { determinant, inverse, multiply, transpose, type Matrix } from "./matrix";

export type SurveyRow = Record<string, CellValue>;

function asNumber(value: CellValue | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(number) ? number : null;
}

function mean(values: number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const center = mean(values);
  return values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1);
}
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
function correlation(x: number[], y: number[]): number {
  const mx = mean(x); const my = mean(y);
  let numerator = 0; let dx = 0; let dy = 0;
  for (let index = 0; index < x.length; index += 1) {
    numerator += (x[index] - mx) * (y[index] - my);
    dx += (x[index] - mx) ** 2; dy += (y[index] - my) ** 2;
  }
  if (dx === 0 || dy === 0) throw new Error("常量字段不能计算相关系数");
  return numerator / Math.sqrt(dx * dy);
}
function twoSidedT(t: number, df: number): number {
  return Math.max(0, Math.min(1, 2 * (1 - jStat.studentt.cdf(Math.abs(t), df))));
}

export function cleanSurveyRows(
  rows: SurveyRow[], variables: string[], min: number, max: number, checkStraightline: boolean,
): { cleaned: SurveyRow[]; exclusions: ExclusionLog[]; warnings: string[] } {
  const cleaned: SurveyRow[] = [];
  const exclusions: ExclusionLog[] = [];
  rows.forEach((row, index) => {
    const values = variables.map((variable) => row[variable]);
    const numeric = values.map(asNumber);
    const reasons: string[] = [];
    const missing = numeric.filter((value) => value === null).length;
    if (missing / variables.length > 0.5) reasons.push(`分析字段缺失超过 50%（${missing}/${variables.length}）`);
    if (values.some((value) => value !== null && value !== undefined && String(value).trim() !== "" && asNumber(value) === null)) {
      reasons.push("存在无法转换为数值的分析字段");
    }
    if (numeric.some((value) => value !== null && (value < min || value > max))) reasons.push(`存在超出 ${min}–${max} 量表范围的值`);
    const valid = numeric.filter((value): value is number => value !== null);
    if (checkStraightline && valid.length >= 4 && new Set(valid).size === 1) reasons.push("全部量表题项选择同一答案（直线作答规则）");
    if (reasons.length) exclusions.push({ rowNumber: index + 2, reasons });
    else cleaned.push(Object.fromEntries(variables.map((variable, variableIndex) => [variable, numeric[variableIndex]])));
  });
  const warnings = [
    "清洗只生成分析副本，原始导入数据不变；每条排除记录均保留原文件行号。",
    "直线作答只是待复核线索，排除规则由使用者选择，不代表受访者一定无效。",
  ];
  return { cleaned, exclusions, warnings };
}

export function descriptiveStatistics(rows: SurveyRow[], variables: string[]): DescriptiveResult[] {
  return variables.map((variable) => {
    const values = rows.map((row) => asNumber(row[variable])).filter((value): value is number => value !== null);
    if (!values.length) throw new Error(`${variable} 没有有效数值`);
    return {
      variable, n: values.length, missing: rows.length - values.length,
      mean: mean(values), sd: Math.sqrt(variance(values)), median: median(values),
      min: Math.min(...values), max: Math.max(...values),
    };
  });
}

function completeNumericRows(rows: SurveyRow[], variables: string[]): number[][] {
  return rows.flatMap((row) => {
    const values = variables.map((variable) => asNumber(row[variable]));
    return values.every((value): value is number => value !== null) ? [values as number[]] : [];
  });
}

export function cronbachAlpha(rows: SurveyRow[], variables: string[]): ReliabilityResult {
  if (variables.length < 2) throw new Error("Cronbach α 至少需要两个题项");
  const complete = completeNumericRows(rows, variables);
  if (complete.length < 3) throw new Error("信度分析至少需要 3 行完整数据");
  const itemVariance = variables.map((_, index) => variance(complete.map((row) => row[index])));
  const totals = complete.map((row) => row.reduce((sum, value) => sum + value, 0));
  const totalVariance = variance(totals);
  if (totalVariance === 0) throw new Error("总分没有变异，无法计算信度");
  const alpha = variables.length / (variables.length - 1) * (1 - itemVariance.reduce((sum, value) => sum + value, 0) / totalVariance);
  return { variables, n: complete.length, itemCount: variables.length, alpha };
}

export function kmoBartlett(rows: SurveyRow[], variables: string[]): ValidityResult {
  const complete = completeNumericRows(rows, variables);
  const p = variables.length;
  if (p < 3) throw new Error("KMO 与 Bartlett 检验至少需要三个字段");
  if (complete.length <= p + 1) throw new Error("完整样本量必须大于字段数 + 1");
  const r: Matrix = variables.map((_, i) => variables.map((__, j) => i === j ? 1 : correlation(complete.map((row) => row[i]), complete.map((row) => row[j]))));
  const inv = inverse(r);
  let r2 = 0; let partial2 = 0;
  for (let i = 0; i < p; i += 1) for (let j = i + 1; j < p; j += 1) {
    r2 += r[i][j] ** 2;
    const partial = -inv[i][j] / Math.sqrt(inv[i][i] * inv[j][j]);
    partial2 += partial ** 2;
  }
  const kmo = r2 / (r2 + partial2);
  const det = determinant(r);
  if (det <= 0) throw new Error("相关矩阵非正定，无法执行 Bartlett 检验");
  const chi = -(complete.length - 1 - (2 * p + 5) / 6) * Math.log(det);
  const df = p * (p - 1) / 2;
  return { n: complete.length, variableCount: p, kmo, bartlettChiSquare: chi, bartlettDf: df, bartlettP: Math.max(0, 1 - jStat.chisquare.cdf(chi, df)) };
}

export function linearRegression(rows: SurveyRow[], dependent: string, predictors: string[]): RegressionResult {
  const variables = [dependent, ...predictors];
  const complete = completeNumericRows(rows, variables);
  const k = predictors.length;
  if (complete.length <= k + 2) throw new Error("回归完整样本量不足，需大于自变量数 + 2");
  const x: Matrix = complete.map((row) => [1, ...row.slice(1)]);
  const y: Matrix = complete.map((row) => [row[0]]);
  const xt = transpose(x);
  const xtxInv = inverse(multiply(xt, x));
  const beta = multiply(multiply(xtxInv, xt), y).map((row) => row[0]);
  const actual = complete.map((row) => row[0]);
  const fitted = x.map((row) => row.reduce((sum, value, index) => sum + value * beta[index], 0));
  const residuals = actual.map((value, index) => value - fitted[index]);
  const sse = residuals.reduce((sum, value) => sum + value ** 2, 0);
  const center = mean(actual);
  const sst = actual.reduce((sum, value) => sum + (value - center) ** 2, 0);
  const df = complete.length - k - 1;
  const mse = sse / df;
  const coefficients = ["(Intercept)", ...predictors].map((variable, index) => {
    const standardError = Math.sqrt(Math.max(0, xtxInv[index][index] * mse));
    const t = standardError === 0 ? 0 : beta[index] / standardError;
    return { variable, coefficient: beta[index], standardError, t, p: twoSidedT(t, df) };
  });
  const r2 = sst === 0 ? 0 : 1 - sse / sst;
  return { dependent, predictors, n: complete.length, r2, adjustedR2: 1 - (1 - r2) * (complete.length - 1) / df, coefficients };
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function mediationAnalysis(
  rows: SurveyRow[], x: string, m: string, y: string, controls: string[], bootstrapIterations = 2000, seed = 20261119,
): MediationResult {
  if (new Set([x, m, y]).size !== 3) throw new Error("X、M、Y 必须是不同字段");
  const mediator = linearRegression(rows, m, [x, ...controls]);
  const directModel = linearRegression(rows, y, [x, m, ...controls]);
  const total = linearRegression(rows, y, [x, ...controls]);
  const a = mediator.coefficients.find((item) => item.variable === x)?.coefficient ?? 0;
  const b = directModel.coefficients.find((item) => item.variable === m)?.coefficient ?? 0;
  const direct = directModel.coefficients.find((item) => item.variable === x)?.coefficient ?? 0;
  const totalEffect = total.coefficients.find((item) => item.variable === x)?.coefficient ?? 0;
  const iterations = Math.max(100, Math.min(10000, Math.round(bootstrapIterations)));
  const random = seededRandom(seed);
  const effects: number[] = [];
  const variables = [x, m, y, ...controls];
  const complete = completeNumericRows(rows, variables).map((row) => Object.fromEntries(variables.map((variable, index) => [variable, row[index]])));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const sample = Array.from({ length: complete.length }, () => complete[Math.floor(random() * complete.length)]);
    try {
      const ma = linearRegression(sample, m, [x, ...controls]).coefficients.find((item) => item.variable === x)?.coefficient ?? 0;
      const mb = linearRegression(sample, y, [x, m, ...controls]).coefficients.find((item) => item.variable === m)?.coefficient ?? 0;
      effects.push(ma * mb);
    } catch { /* 奇异重抽样不进入区间；有效次数在结果中如实返回 */ }
  }
  effects.sort((left, right) => left - right);
  if (effects.length < 100) throw new Error("有效 Bootstrap 次数不足，请检查共线性与样本量");
  const percentile = (p: number) => effects[Math.min(effects.length - 1, Math.max(0, Math.floor(p * (effects.length - 1))))];
  return {
    x, m, y, controls, n: directModel.n, a, b, direct, total: totalEffect, indirect: a * b,
    bootstrapIterations: effects.length, indirectCi95: [percentile(0.025), percentile(0.975)],
    regressions: { total, mediator, direct: directModel },
  };
}

export function analyzeSurvey(input: {
  rows: SurveyRow[]; variables: string[]; min: number; max: number; checkStraightline: boolean;
  reliability: boolean; validity: boolean;
  mediation?: { x: string; m: string; y: string; controls: string[]; bootstrapIterations: number };
}): SurveyAnalysisResult {
  const { cleaned, exclusions, warnings } = cleanSurveyRows(input.rows, input.variables, input.min, input.max, input.checkStraightline);
  if (cleaned.length < 3) throw new Error("清洗后有效样本少于 3 行，无法分析");
  if (cleaned.length < 80) warnings.push(`有效样本为 ${cleaned.length}，低于你论文预设的 80 份；这只是样本量提醒，不构成统计有效性结论`);
  const result: SurveyAnalysisResult = {
    originalN: input.rows.length, analysisN: cleaned.length, exclusions,
    descriptive: descriptiveStatistics(cleaned, input.variables),
    correlations: [], warnings,
  };
  if (input.reliability) result.reliability = cronbachAlpha(cleaned, input.variables);
  if (input.validity) result.validity = kmoBartlett(cleaned, input.variables);
  for (let i = 0; i < input.variables.length; i += 1) for (let j = i + 1; j < input.variables.length; j += 1) {
    const x = input.variables[i]; const y = input.variables[j];
    const complete = completeNumericRows(cleaned, [x, y]);
    if (complete.length >= 3) {
      try {
        const r = correlation(complete.map((row) => row[0]), complete.map((row) => row[1]));
        result.correlations.push({ x, y, r, p: twoSidedT(r * Math.sqrt((complete.length - 2) / Math.max(1e-15, 1 - r * r)), complete.length - 2), n: complete.length });
      } catch { /* 常量字段在描述统计中保留，但不输出相关系数 */ }
    }
  }
  if (input.mediation) {
    const { x, m, y, controls, bootstrapIterations } = input.mediation;
    result.mediation = mediationAnalysis(cleaned, x, m, y, controls, bootstrapIterations);
  }
  return result;
}
