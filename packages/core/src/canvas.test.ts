/* Draeven Core: tests for canvas pictures */

import { inflateSync } from "node:zlib";
import { expect, test } from "vitest";
import { canvas } from "./canvas.js";
import { colors } from "./embed.js";

test("fills a pixel and writes a PNG", () => {
  const picture = canvas({ width: 1, height: 1 });
  picture.fill(colors.red);

  expect(picture.pixel(0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });

  const png = picture.png();
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);

  const chunks = readChunks(png);
  const header = chunks.find((chunk) => chunk.type === "IHDR");
  const data = chunks.find((chunk) => chunk.type === "IDAT");
  const headerView = new DataView(
    header?.data.buffer ?? new ArrayBuffer(0),
    header?.data.byteOffset ?? 0,
    header?.data.byteLength ?? 0
  );
  expect(headerView.getUint32(0)).toBe(1);
  expect(headerView.getUint32(4)).toBe(1);
  expect([...(data ? inflateSync(data.data) : [])]).toEqual([0, 255, 0, 0, 255]);
});

test("draws the letter A from the built-in font", () => {
  const picture = canvas({ width: 5, height: 7 });
  picture.text({ value: "A", x: 0, y: 0, color: colors.black, size: 1 });

  expect(picture.pixel(0, 0).a).toBe(0);
  expect(picture.pixel(0, 1)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
  expect(picture.pixel(1, 0)).toEqual({ r: 0, g: 0, b: 0, a: 255 });
});

function readChunks(png: Uint8Array): { type: string; data: Uint8Array }[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: { type: string; data: Uint8Array }[] = [];
  let offset = 8;

  while (offset + 8 <= png.length) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...png.subarray(offset + 4, offset + 8));
    const data = png.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
  }

  return chunks;
}
