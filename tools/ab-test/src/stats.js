const PERCENT_SCALE = 100;
const MEDIAN_PERCENT = 50;
const P95_PERCENT = 95;
const P99_PERCENT = 99;
const MS_PER_SECOND = 1000;

/**
 * @param {number[]} values
 * @param {number} p percentile in [0, 100]
 * @returns {number}
 */
export function percentile(values, p) {
  if (values.length === 0) {
    throw new RangeError('Empty input');
  }
  if (p < 0 || p > PERCENT_SCALE) {
    throw new RangeError('Percentile must be between 0 and 100');
  }
  if (!values.every(Number.isFinite)) {
    throw new RangeError('Non-finite value in input');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = ((sorted.length - 1) * p) / PERCENT_SCALE;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const weight = index - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
}

/**
 * @param {number[]} ms frame times in milliseconds
 * @returns {{count: number, mean: number, min: number, max: number, p50: number, p95: number, p99: number, fps: number}}
 */
export function summarizeFrameTimes(ms) {
  if (ms.length === 0) {
    throw new RangeError('Empty input');
  }
  if (!ms.every((value) => Number.isFinite(value) && value >= 0)) {
    throw new RangeError('Non-finite or negative value in input');
  }

  const count = ms.length;
  const mean = ms.reduce((acc, value) => acc + value, 0) / count;
  return {
    count,
    mean,
    min: Math.min(...ms),
    max: Math.max(...ms),
    p50: percentile(ms, MEDIAN_PERCENT),
    p95: percentile(ms, P95_PERCENT),
    p99: percentile(ms, P99_PERCENT),
    fps: MS_PER_SECOND / mean
  };
}

/**
 * @param {{p95: number}} summary
 * @param {number} budgetMs
 * @returns {{withinBudget: boolean, headroomMs: number}}
 */
export function budgetVerdict(summary, budgetMs) {
  return {
    withinBudget: summary.p95 <= budgetMs,
    headroomMs: budgetMs - summary.p95
  };
}
