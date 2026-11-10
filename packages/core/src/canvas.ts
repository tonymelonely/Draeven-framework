/*
 * Draeven Core: a picture you draw, then send.
 *
 * canvas({ width, height }) starts a transparent picture.
 * fill, box, dot, and text paint with a name from colors.
 * png() is the file Discord receives.
 *
 * Text uses a built-in 5 by 7 font for ASCII, from space through tilde.
 */

import { deflateSync } from "node:zlib";
import { paintColor, type Color } from "./embed.js";
import { pictureMark } from "./marks.js";

export interface CanvasSize {
  width: number;
  height: number;
}

export interface CanvasBox {
  x: number;
  y: number;
  width: number;
  height: number;
  color: Color;
}

export interface CanvasDot {
  x: number;
  y: number;
  radius: number;
  color: Color;
}

export interface CanvasText {
  value: string;
  x: number;
  y: number;
  color: Color;
  size?: number;
}

export interface CanvasPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Canvas {
  fill(color: Color): Canvas;
  box(spot: CanvasBox): Canvas;
  dot(spot: CanvasDot): Canvas;
  text(spot: CanvasText): Canvas;
  pixel(x: number, y: number): CanvasPixel;
  png(): Uint8Array;
}

const drawn = new WeakSet<object>();

/* Columns, low bit is the top row. ASCII 32 through 126. */
const FONT = readFont(`
0000000000 00005F0000 0007000700 147F147F14 242A7F2A12
2313086462 3649552250 0005030000 001C224100 0041221C00
14083E0814 08083E0808 0050300000 0808080808 0060600000
2010080402 3E5149453E 00427F4000 4261514946 2141454B31
1814127F10 2745454539 3C4A494930 0171090503 3649494936
064949291E 0036360000 0056360000 0814224100 1414141414
0041221408 0201510906 324979413E 7E1111117E 7F49494936
3E41414122 7F4141221C 7F49494941 7F09090901 3E4149497A
7F0808087F 00417F4100 2040413F01 7F08142241 7F40404040
7F020C027F 7F0408107F 3E4141413E 7F09090906 3E4151215E
7F09192946 4649494931 01017F0101 3F4040403F 1F2040201F
3F4038403F 6314081463 0708700807 6151494543 007F414100
0204081020 0041417F00 0402010204 4040404040 0001020400
2054545478 7F48444438 3844444420 384444487F 3854545418
087E090102 0C5252523E 7F08040478 00447D4000 2040443D00
7F10284400 00417F4000 7C04180478 7C08040478 3844444438
7C14141408 081414187C 7C08040408 4854545420 043F444020
3C4040207C 1C2040201C 3C4030403C 4428102844 0C5050503C
4464544C44 0008364100 00007F0000 0041360800 0804081008
`);

class Drawn implements Canvas {
  private readonly pixels: Uint8Array;

  constructor(
    private readonly width: number,
    private readonly height: number
  ) {
    this.pixels = new Uint8Array(width * height * 4);
    Object.defineProperty(this, pictureMark, { value: true });
  }

  fill(color: Color): Canvas {
    const paint = paintColor(color);

    for (let index = 0; index < this.pixels.length; index += 4) {
      this.paintAt(index, paint);
    }

    return this;
  }

  box(spot: CanvasBox): Canvas {
    const x = whole(spot.x, "A box x");
    const y = whole(spot.y, "A box y");
    const width = whole(spot.width, "A box width");
    const height = whole(spot.height, "A box height");

    if (width < 1 || height < 1) {
      throw new Error("[Draeven] A box needs a width and height of at least 1.");
    }

    const paint = paintColor(spot.color);

    for (let row = y; row < y + height; row += 1) {
      for (let column = x; column < x + width; column += 1) {
        this.set(column, row, paint);
      }
    }

    return this;
  }

  dot(spot: CanvasDot): Canvas {
    const x = whole(spot.x, "A dot x");
    const y = whole(spot.y, "A dot y");
    const radius = whole(spot.radius, "A dot radius");

    if (radius < 1 || radius > 512) {
      throw new Error("[Draeven] A dot radius is a whole number from 1 to 512.");
    }

    const paint = paintColor(spot.color);
    const reach = radius * radius;

    for (let row = y - radius; row <= y + radius; row += 1) {
      for (let column = x - radius; column <= x + radius; column += 1) {
        const dx = column - x;
        const dy = row - y;

        if (dx * dx + dy * dy <= reach) {
          this.set(column, row, paint);
        }
      }
    }

    return this;
  }

  text(spot: CanvasText): Canvas {
    const value = spot.value;
    const x = whole(spot.x, "Text x");
    const y = whole(spot.y, "Text y");
    const size = spot.size === undefined ? 2 : whole(spot.size, "Text size");

    if (size < 1 || size > 8) {
      throw new Error("[Draeven] Text size is a whole number from 1 to 8.");
    }

    if (value.length > 200) {
      throw new Error("[Draeven] Canvas text is at most 200 characters.");
    }

    const paint = paintColor(spot.color);
    let cursor = x;

    for (const character of value) {
      const code = character.codePointAt(0) ?? 0;
      cursor += this.glyph(code, cursor, y, size, paint);
    }

    return this;
  }

  pixel(x: number, y: number): CanvasPixel {
    const column = whole(x, "A pixel x");
    const row = whole(y, "A pixel y");

    if (column < 0 || row < 0 || column >= this.width || row >= this.height) {
      return { r: 0, g: 0, b: 0, a: 0 };
    }

    const index = (row * this.width + column) * 4;
    return {
      r: this.pixels[index] ?? 0,
      g: this.pixels[index + 1] ?? 0,
      b: this.pixels[index + 2] ?? 0,
      a: this.pixels[index + 3] ?? 0,
    };
  }

  png(): Uint8Array {
    const stride = this.width * 4;
    const raw = new Uint8Array((stride + 1) * this.height);

    for (let row = 0; row < this.height; row += 1) {
      const start = row * (stride + 1);
      raw[start] = 0;
      raw.set(this.pixels.subarray(row * stride, (row + 1) * stride), start + 1);
    }

    const header = new Uint8Array(13);
    const view = new DataView(header.buffer);
    view.setUint32(0, this.width);
    view.setUint32(4, this.height);
    header[8] = 8;
    header[9] = 6;

    const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    return concat([
      signature,
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", new Uint8Array()),
    ]);
  }

  private glyph(
    code: number,
    x: number,
    y: number,
    size: number,
    paint: { r: number; g: number; b: number }
  ): number {
    if (code >= 32 && code <= 126) {
      const start = (code - 32) * 5;

      for (let column = 0; column < 5; column += 1) {
        const bits = FONT[start + column] ?? 0;

        for (let row = 0; row < 7; row += 1) {
          if ((bits & (1 << row)) === 0) {
            continue;
          }

          for (let sy = 0; sy < size; sy += 1) {
            for (let sx = 0; sx < size; sx += 1) {
              this.set(x + column * size + sx, y + row * size + sy, paint);
            }
          }
        }
      }
    }

    return 6 * size;
  }

  private set(
    x: number,
    y: number,
    paint: { r: number; g: number; b: number }
  ): void {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }

    this.paintAt((y * this.width + x) * 4, paint);
  }

  private paintAt(index: number, paint: { r: number; g: number; b: number }): void {
    this.pixels[index] = paint.r;
    this.pixels[index + 1] = paint.g;
    this.pixels[index + 2] = paint.b;
    this.pixels[index + 3] = 255;
  }
}

/* A transparent picture. width and height are whole numbers from 1 to 1024. */
export function canvas(size: CanvasSize): Canvas {
  const width = whole(size.width, "Canvas width");
  const height = whole(size.height, "Canvas height");

  if (width < 1 || height < 1 || width > 1024 || height > 1024) {
    throw new Error("[Draeven] A canvas is from 1 to 1024 pixels on each side.");
  }

  const picture = new Drawn(width, height);
  drawn.add(picture);
  return picture;
}

export function isCanvas(value: unknown): value is Canvas {
  return typeof value === "object" && value !== null && drawn.has(value);
}

function whole(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new Error(`[Draeven] ${label} must be a whole number.`);
  }

  return value;
}

function readFont(hex: string): Uint8Array {
  const compact = hex.replace(/\s+/g, "");
  const bytes = new Uint8Array(compact.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16);
  }

  if (compact.length !== 95 * 10 || /[^0-9a-f]/i.test(compact)) {
    throw new Error("[Draeven] The canvas font is incomplete.");
  }

  return bytes;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const name = new TextEncoder().encode(type);
  const body = concat([name, data]);
  const crc = new Uint8Array(4);
  new DataView(crc.buffer).setUint32(0, crc32(body));
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  return concat([length, body, crc]);
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc ^= byte;

    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;

  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}
