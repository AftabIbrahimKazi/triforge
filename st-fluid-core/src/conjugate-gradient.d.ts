declare module 'conjugate-gradient' {
  interface SparseMatrix {
    rowCount: number
    get(i: number, j: number): number
    apply(x: Float64Array, out: Float64Array): void
  }
  function conjugateGradient(
    A: SparseMatrix,
    b: Float64Array,
    x: Float64Array,
    tolerance?: number,
    maxIter?: number
  ): void
  export default conjugateGradient
}
