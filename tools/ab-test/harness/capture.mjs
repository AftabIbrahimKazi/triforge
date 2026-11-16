#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium } from 'playwright-core';

const DEFAULT_WIDTH = '1280';
const DEFAULT_HEIGHT = '720';
const READY_TIMEOUT_MS = 120000;
const POSE_PAD = 3;
const JSON_INDENT = 2;
const VARIANT_PATTERN = /^[A-Za-z0-9_-]{1,16}$/;
const CHROME_ARGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--use-angle=default'];

/**
 * @param {string} value
 * @param {string} name
 * @returns {number}
 */
function parsePositiveInt(value, name) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new RangeError(`${name} must be a positive integer`);
  }
  return parsed;
}

/**
 * @returns {{url: string, outDir: string, variant: string, poses: number, width: number, height: number, chromePath: string | undefined, headless: boolean}}
 */
function readOptions() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string' },
      out: { type: 'string' },
      variant: { type: 'string' },
      poses: { type: 'string' },
      width: { type: 'string', default: DEFAULT_WIDTH },
      height: { type: 'string', default: DEFAULT_HEIGHT },
      chrome: { type: 'string' },
      headless: { type: 'boolean', default: false }
    }
  });

  for (const required of ['url', 'out', 'variant', 'poses']) {
    if (!values[required]) {
      throw new RangeError(`--${required} is required`);
    }
  }
  if (!VARIANT_PATTERN.test(values.variant)) {
    throw new RangeError('Invalid variant name');
  }

  return {
    url: values.url,
    outDir: values.out,
    variant: values.variant,
    poses: parsePositiveInt(values.poses, 'poses'),
    width: parsePositiveInt(values.width, 'width'),
    height: parsePositiveInt(values.height, 'height'),
    chromePath: values.chrome,
    headless: values.headless
  };
}

/**
 * @param {import('playwright-core').Page} page
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
function waitForReady(page, timeoutMs) {
  return page.waitForFunction(() => window.__ab && window.__ab.ready === true, undefined, { timeout: timeoutMs });
}

/**
 * @param {ReturnType<typeof readOptions>} options
 * @returns {Promise<void>}
 */
async function capture(options) {
  const { url, outDir, variant, poses, width, height, chromePath, headless } = options;
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: chromePath,
    channel: chromePath ? undefined : 'chrome',
    headless,
    args: CHROME_ARGS
  });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width, height });

    const target = new URL(url);
    target.searchParams.set('variant', variant);
    target.searchParams.set('poses', String(poses));
    await page.goto(target.toString());
    await waitForReady(page, READY_TIMEOUT_MS);

    for (let i = 0; i < poses; i++) {
      await page.evaluate((index) => window.__ab.renderPose(index), i);
      const name = `${variant}-pose${String(i).padStart(POSE_PAD, '0')}.png`;
      await page.screenshot({ path: join(outDir, name) });
    }

    const frameTimes = await page.evaluate(() => window.__ab.frameTimes);
    await writeFile(join(outDir, `${variant}-frametimes.json`), JSON.stringify(frameTimes, null, JSON_INDENT));
  } finally {
    await browser.close();
  }
}

try {
  await capture(readOptions());
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exitCode = 1;
}
