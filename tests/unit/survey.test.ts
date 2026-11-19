import { describe, expect, it } from "vitest";
import { analyzeSurvey, cronbachAlpha, linearRegression, mediationAnalysis, type SurveyRow } from "@/lib/stats/survey";
import { determinant, inverse, multiply } from "@/lib/stats/matrix";

const rows = Array.from({ length: 30 }, (_, index) => {
  const x = index + 1;
  const m = x * 1.4 + (index % 3) * 0.7 + 1;
  const y = m * 0.8 + x * 0.35 + (index % 4) * 0.2;
  return { x, m, y, q1: (index % 5) + 1, q2: ((index + 1) % 5) + 1, q3: ((index + 3) % 5) + 1 };
});

describe("matrix and regression known answers", () => {
  it("inverts a matrix within floating point tolerance", () => {
    const matrix = [[4, 1], [2, 3]];
    const identity = multiply(matrix, inverse(matrix));
    expect(identity[0][0]).toBeCloseTo(1, 10);
    expect(identity[0][1]).toBeCloseTo(0, 10);
    expect(determinant(matrix)).toBeCloseTo(10, 10);
  });
  it("recovers intercept and slope for y = 1 + 2x", () => {
    const sample = Array.from({ length: 8 }, (_, i) => ({ x: i + 1, y: 1 + 2 * (i + 1) }));
    const model = linearRegression(sample, "y", ["x"]);
    expect(model.coefficients[0].coefficient).toBeCloseTo(1, 10);
    expect(model.coefficients[1].coefficient).toBeCloseTo(2, 10);
    expect(model.r2).toBeCloseTo(1, 10);
  });
});

describe("survey cleaning and reliability", () => {
  it("keeps original rows and records exact source row numbers", () => {
    const input: SurveyRow[] = [{ a: 1, b: 2 }, { a: null, b: null }, { a: 9, b: 2 }, { a: 3, b: 3, c: 3, d: 3 }, { a: 2, b: 4 }, { a: 4, b: 1 }];
    const snapshot = structuredClone(input);
    const result = analyzeSurvey({ rows: input, variables: ["a", "b"], min: 1, max: 5, checkStraightline: false, reliability: false, validity: false });
    expect(input).toEqual(snapshot);
    expect(result.exclusions.map((item) => item.rowNumber)).toEqual([3, 4]);
    expect(result.analysisN).toBe(4);
  });
  it("flags optional straight-line responses", () => {
    const result = analyzeSurvey({ rows: [{ a: 1, b: 1, c: 1, d: 1 }, { a: 1, b: 2, c: 3, d: 4 }, { a: 2, b: 3, c: 4, d: 5 }, { a: 2, b: 1, c: 4, d: 3 }], variables: ["a", "b", "c", "d"], min: 1, max: 5, checkStraightline: true, reliability: false, validity: false });
    expect(result.exclusions[0].rowNumber).toBe(2);
    expect(result.exclusions[0].reasons.join(" ")).toContain("直线作答");
  });
  it("returns alpha = 1 for perfectly covarying items", () => {
    const sample = Array.from({ length: 10 }, (_, i) => ({ a: i + 1, b: i + 1, c: i + 1 }));
    expect(cronbachAlpha(sample, ["a", "b", "c"]).alpha).toBeCloseTo(1, 10);
  });
});

describe("bootstrap mediation", () => {
  it("preserves total/direct/indirect algebra and deterministic bootstrap", () => {
    const first = mediationAnalysis(rows, "x", "m", "y", [], 200);
    const second = mediationAnalysis(rows, "x", "m", "y", [], 200);
    expect(first.indirect).toBeCloseTo(first.a * first.b, 12);
    expect(first.total).toBeCloseTo(first.direct + first.indirect, 8);
    expect(first.indirectCi95).toEqual(second.indirectCi95);
    expect(first.bootstrapIterations).toBeGreaterThanOrEqual(100);
  });
  it("produces descriptive, correlation and validity results without synthetic rows", () => {
    const result = analyzeSurvey({ rows, variables: ["x", "m", "y"], min: 0, max: 100, checkStraightline: false, reliability: true, validity: true });
    expect(result.originalN).toBe(30);
    expect(result.analysisN).toBe(30);
    expect(result.descriptive).toHaveLength(3);
    expect(result.correlations).toHaveLength(3);
    expect(result.validity?.kmo).toBeGreaterThanOrEqual(0);
    expect(result.validity?.kmo).toBeLessThanOrEqual(1);
  });
});
