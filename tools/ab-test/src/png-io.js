import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { PNG } from 'pngjs';

const CHANNELS = 4;

/**
 * @param {string} path
 * @returns {Promise<{width: number, height: number, data: Uint8Array}>}
 */
export async function readPng(path) {
  const png = PNG.sync.read(await readFile(path));
  return { width: png.width, height: png.height, data: png.data };
}

/**
 * @param {string} path
 * @param {{width: number, height: number, data: Uint8Array}} image
 * @returns {Promise<void>}
 */
export async function writePng(path, image) {
  const { width, height, data } = image;
  if (data.length !== width * height * CHANNELS) {
    throw new RangeError('Data length does not match width * height * 4');
  }

  await mkdir(dirname(path), { recursive: true });
  const png = new PNG({ width, height });
  png.data = data;
  await writeFile(path, PNG.sync.write(png));
}
