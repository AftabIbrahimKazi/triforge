#!/usr/bin/env node
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { compareImages } from './src/compare.js';
import { readPng } from './src/png-io.js';
import { renderReport } from './src/report.js';
import { summarizeFrameTimes } from './src/stats.js';

const REFERENCE = 'R';
const REPORT_TITLE = 'A/B render results';
const FRAME_BUDGET_MS = 16.7;
const POSE_PAD = 3;
const USAGE = 'Usage: node results-cli.js --out results.md --budget 16.7 <scene>=<dir> [<scene>=<dir> ...]  (each dir holds R-, plus other variants)';

/**
 * @param {string} path
 * @returns {Promise<unknown>}
 */
async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

/**
 * @param {number[]} values
 * @returns {number}
 */
function mean(values) {
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>} variant ids found (excluding the reference)
 */
async function findVariants(dir) {
  const names = await readdir(dir);
  const ids = new Set(names.map((n) => /^([A-Z])-pose000\.png$/.exec(n)?.[1]).filter(Boolean));
  ids.delete(REFERENCE);
  return [...ids].sort();
}

/**
 * @param {string} scene
 * @param {string} dir
 * @param {string} variant
 * @returns {Promise<import('./src/report.js').ReportRow>}
 */
async function scoreVariant(scene, dir, variant) {
  const meta = await readJson(join(dir, `${variant}-meta.json`));
  const frameTimes = await readJson(join(dir, `${variant}-frametimes.json`));
  const frames = summarizeFrameTimes(frameTimes);
  const perPose = [];
  const poseCount = await countPoses(dir, variant);
  for (let i = 0; i < poseCount; i++) {
    const tag = `pose${String(i).padStart(POSE_PAD, '0')}`;
    const [ref, test] = await Promise.all([readPng(join(dir, `${REFERENCE}-${tag}.png`)), readPng(join(dir, `${variant}-${tag}.png`))]);
    perPose.push(compareImages(ref, test).overall);
  }
  return {
    variant,
    scene,
    meanDeltaE: mean(perPose.map((m) => m.meanDeltaE)),
    p95DeltaE: mean(perPose.map((m) => m.p95DeltaE)),
    ssim: mean(perPose.map((m) => m.ssim)),
    frameP50: frames.p50,
    frameP95: frames.p95,
    fps: frames.fps,
    downloadMB: meta.bakeMB ?? 0
  };
}

/**
 * @param {string} dir
 * @param {string} variant
 * @returns {Promise<number>}
 */
async function countPoses(dir, variant) {
  return (await readdir(dir)).filter((n) => n.startsWith(`${variant}-pose`) && n.endsWith('.png')).length;
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { out: { type: 'string' }, budget: { type: 'string', default: String(FRAME_BUDGET_MS) } },
    allowPositionals: true
  });
  if (!values.out || positionals.length === 0) {
    throw new RangeError(USAGE);
  }

  const rows = [];
  for (const entry of positionals) {
    const [scene, dir] = entry.split('=');
    if (!scene || !dir) {
      throw new RangeError(USAGE);
    }
    for (const variant of await findVariants(dir)) {
      rows.push(await scoreVariant(scene, dir, variant));
    }
  }
  await writeFile(values.out, renderReport(REPORT_TITLE, rows, Number.parseFloat(values.budget)));
}

try {
  await main();
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exitCode = 1;
}
