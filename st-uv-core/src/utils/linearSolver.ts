/**
 * Sparse conjugate gradient solver.
 * Solves A*x = b where A is symmetric positive semi-definite.
 * Used by LSCM and ABF for UV parameterization.
 *
 * Matrix stored as adjacency list: rows[i] = Map<column, value>
 */

export type SparseMatrix = Map<number, number>[]

/** Multiply sparse matrix A by dense vector x, result into out. */
function spMv(A: SparseMatrix, x: Float64Array, out: Float64Array): void {
  const n = A.length
  for (let i = 0; i < n; i++) {
    let sum = 0
    for (const [j, val] of A[i]) sum += val * x[j]
    out[i] = sum
  }
}

/** Dot product of two dense vectors. */
function dot(a: Float64Array, b: Float64Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/**
 * Solve A*x = b using conjugate gradient.
 * maxIter: maximum iterations (default 400)
 * tol:     convergence tolerance (default 1e-6)
 */
export function cgSolve(
  A:       SparseMatrix,
  b:       Float64Array,
  x0?:     Float64Array,
  maxIter = 400,
  tol     = 1e-6,
): Float64Array {
  const n   = b.length
  const x   = x0 ? new Float64Array(x0) : new Float64Array(n)
  const r   = new Float64Array(n)
  const p   = new Float64Array(n)
  const Ap  = new Float64Array(n)

  // r = b - A*x
  spMv(A, x, Ap)
  for (let i = 0; i < n; i++) r[i] = b[i] - Ap[i]
  p.set(r)

  let rsOld = dot(r, r)
  if (Math.sqrt(rsOld) < tol) return x

  for (let iter = 0; iter < maxIter; iter++) {
    spMv(A, p, Ap)
    const pAp = dot(p, Ap)
    if (Math.abs(pAp) < 1e-14) break

    const alpha = rsOld / pAp
    for (let i = 0; i < n; i++) {
      x[i] += alpha * p[i]
      r[i] -= alpha * Ap[i]
    }

    const rsNew = dot(r, r)
    if (Math.sqrt(rsNew) < tol) break

    const beta = rsNew / rsOld
    for (let i = 0; i < n; i++) p[i] = r[i] + beta * p[i]
    rsOld = rsNew
  }

  return x
}

/** Add value to sparse matrix entry (i, j). */
export function sparseAdd(A: SparseMatrix, i: number, j: number, val: number): void {
  const existing = A[i].get(j) ?? 0
  A[i].set(j, existing + val)
}

/** Create an n×n zero sparse matrix. */
export function sparseZero(n: number): SparseMatrix {
  return Array.from({ length: n }, () => new Map<number, number>())
}
