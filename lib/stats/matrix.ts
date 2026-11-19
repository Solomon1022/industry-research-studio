export type Matrix = number[][];

export function transpose(matrix: Matrix): Matrix {
  return Array.from({ length: matrix[0]?.length ?? 0 }, (_, column) => matrix.map((row) => row[column]));
}

export function multiply(a: Matrix, b: Matrix): Matrix {
  if (!a.length || !b.length || a[0].length !== b.length) throw new Error("矩阵维度不匹配");
  return a.map((row) => Array.from({ length: b[0].length }, (_, column) =>
    row.reduce((sum, value, index) => sum + value * b[index][column], 0)));
}

export function inverse(matrix: Matrix): Matrix {
  const n = matrix.length;
  if (!n || matrix.some((row) => row.length !== n)) throw new Error("仅支持方阵求逆");
  const augmented = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    if (Math.abs(augmented[pivot][column]) < 1e-12) throw new Error("变量存在完全共线性，无法估计模型；请移除重复或高度共线字段");
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    augmented[column] = augmented[column].map((value) => value / divisor);
    for (let row = 0; row < n; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      augmented[row] = augmented[row].map((value, index) => value - factor * augmented[column][index]);
    }
  }
  return augmented.map((row) => row.slice(n));
}

export function determinant(matrix: Matrix): number {
  const n = matrix.length;
  const copy = matrix.map((row) => [...row]);
  let sign = 1;
  let result = 1;
  for (let column = 0; column < n; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < n; row += 1) if (Math.abs(copy[row][column]) > Math.abs(copy[pivot][column])) pivot = row;
    if (Math.abs(copy[pivot][column]) < 1e-15) return 0;
    if (pivot !== column) { [copy[column], copy[pivot]] = [copy[pivot], copy[column]]; sign *= -1; }
    const pivotValue = copy[column][column];
    result *= pivotValue;
    for (let row = column + 1; row < n; row += 1) {
      const factor = copy[row][column] / pivotValue;
      for (let index = column + 1; index < n; index += 1) copy[row][index] -= factor * copy[column][index];
    }
  }
  return sign * result;
}
