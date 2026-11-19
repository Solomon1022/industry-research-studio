declare module "jstat" {
  export const jStat: {
    studentt: { cdf(value: number, df: number): number };
    chisquare: { cdf(value: number, df: number): number };
  };
}
