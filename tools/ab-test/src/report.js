const SCORE_DECIMALS = 2;
const SSIM_DECIMALS = 3;
const BUDGET_DECIMALS = 1;
const PIPE_ESCAPED = String.raw`\|`;
const TABLE_HEADER =
  '| Variant | ΔE mean | ΔE p95 | SSIM | Frame p50 (ms) | Frame p95 (ms) | FPS | Download (MB) | Budget |\n' +
  '|---------|---------|--------|------|----------------|----------------|-----|---------------|--------|\n';

/**
 * @typedef {{variant: string, scene: string, meanDeltaE: number, p95DeltaE: number, ssim: number, frameP50: number, frameP95: number, fps: number, downloadMB: number}} ReportRow
 */

/**
 * @param {string} text
 * @returns {string}
 */
function escapePipes(text) {
  return text.replaceAll('|', PIPE_ESCAPED);
}

/**
 * @param {ReportRow} row
 * @param {number} budgetMs
 * @returns {string}
 */
function renderRow(row, budgetMs) {
  const cells = [
    escapePipes(row.variant),
    row.meanDeltaE.toFixed(SCORE_DECIMALS),
    row.p95DeltaE.toFixed(SCORE_DECIMALS),
    row.ssim.toFixed(SSIM_DECIMALS),
    row.frameP50.toFixed(SCORE_DECIMALS),
    row.frameP95.toFixed(SCORE_DECIMALS),
    row.fps.toFixed(SCORE_DECIMALS),
    row.downloadMB.toFixed(SCORE_DECIMALS),
    row.frameP95 <= budgetMs ? 'ok' : 'over'
  ];
  return `| ${cells.join(' | ')} |\n`;
}

/**
 * @param {string} title
 * @param {ReportRow[]} rows
 * @param {number} budgetMs
 * @returns {string} markdown
 */
export function renderReport(title, rows, budgetMs) {
  if (rows.length === 0) {
    throw new RangeError('Rows cannot be empty');
  }
  if (!Number.isFinite(budgetMs)) {
    throw new RangeError('Budget must be a finite number');
  }

  const byScene = new Map();
  for (const row of rows) {
    byScene.set(row.scene, [...(byScene.get(row.scene) ?? []), row]);
  }

  let markdown = `# ${title}\nFrame budget: ${budgetMs.toFixed(BUDGET_DECIMALS)} ms (p95)\n\n`;
  for (const [scene, sceneRows] of byScene) {
    markdown += `## ${escapePipes(scene)}\n${TABLE_HEADER}`;
    markdown += sceneRows.map((row) => renderRow(row, budgetMs)).join('');
    markdown += '\n';
  }
  return markdown;
}
