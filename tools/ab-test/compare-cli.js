#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { compareImages } from './src/compare.js';
import { readPng } from './src/png-io.js';

const JSON_INDENT = 2;
const REGION_KEYS = ['x', 'y', 'width', 'height'];
const USAGE = 'Usage: node compare-cli.js <ref.png> <test.png> [--regions regions.json]';

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} parsed
 * @returns {Record<string, {x: number, y: number, width: number, height: number}>}
 */
function validateRegions(parsed) {
  if (!isPlainObject(parsed)) {
    throw new RangeError('Regions file must contain a plain object');
  }
  for (const [name, region] of Object.entries(parsed)) {
    if (!isPlainObject(region)) {
      throw new RangeError(`Region "${name}" must be an object`);
    }
    if (!REGION_KEYS.every((key) => Number.isFinite(region[key]))) {
      throw new RangeError(`Region "${name}" must have finite x, y, width and height`);
    }
  }
  return parsed;
}

/**
 * @param {string | undefined} regionsPath
 * @returns {Promise<Record<string, object> | undefined>}
 */
async function loadRegions(regionsPath) {
  if (!regionsPath) {
    return undefined;
  }
  return validateRegions(JSON.parse(await readFile(regionsPath, 'utf8')));
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { regions: { type: 'string', short: 'r' } },
    allowPositionals: true
  });
  const [refPath, testPath] = positionals;
  if (!refPath || !testPath) {
    throw new RangeError(USAGE);
  }

  const regions = await loadRegions(values.regions);
  const [ref, test] = await Promise.all([readPng(refPath), readPng(testPath)]);
  process.stdout.write(`${JSON.stringify(compareImages(ref, test, regions), null, JSON_INDENT)}\n`);
}

try {
  await main();
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exitCode = 1;
}
