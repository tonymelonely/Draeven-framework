/*
 * Draeven Core: Components V2 layouts.
 *
 * reply(layout(...)) sends Discord's new message layout (flag IS_COMPONENTS_V2).
 * Legacy embeds and content cannot mix with a layout on the same reply.
 */

import { paintColor, type Color } from "./embed.js";
import {
  actionsIn as rowActions,
  discordRows,
  isRow,
  type Press,
  type Row,
} from "./pieces.js";

const owned = new WeakSet<object>();

/** Discord message flag for Components V2. */
export const COMPONENTS_V2 = 1 << 15;

export type LayoutPart =
  | Show
  | Divide
  | Pack
  | Beside
  | Album
  | ShowFile
  | Row;

export interface Layout {
  readonly kind: "layout";
  readonly parts: readonly LayoutPart[];
}

export interface Show {
  readonly kind: "show";
  readonly text: string;
}

export interface Divide {
  readonly kind: "divide";
  readonly size: "sm" | "lg";
  readonly line: boolean;
}

export interface Pack {
  readonly kind: "pack";
  /** Resolved Discord accent color. */
  readonly color?: number;
  readonly spoiler: boolean;
  readonly parts: readonly LayoutPart[];
}

export interface Beside {
  readonly kind: "beside";
  readonly text: string;
  readonly with: Thumb | Row;
}

export interface Thumb {
  readonly kind: "thumb";
  readonly url: string;
  readonly description?: string;
}

export interface AlbumItem {
  readonly url: string;
  readonly description?: string;
  readonly spoiler?: boolean;
}

export interface Album {
  readonly kind: "album";
  readonly items: readonly AlbumItem[];
}

export interface ShowFile {
  readonly kind: "show-file";
  /** Attachment filename already on the message, or a URL Discord can show. */
  readonly name: string;
  readonly spoiler: boolean;
}

export function layout(...parts: readonly LayoutPart[]): Layout {
  if (parts.length < 1 || parts.length > 40) {
    throw new Error("[Draeven] A layout holds 1-40 parts.");
  }

  for (const part of parts) {
    assertPart(part);
  }

  return seal({ kind: "layout", parts: [...parts] });
}

export function show(text: string): Show {
  const value = text.trim();

  if (!value || value.length > 4000) {
    throw new Error("[Draeven] show() needs 1-4000 characters.");
  }

  return seal({ kind: "show", text: value });
}

export function divide(options: { size?: "sm" | "lg"; line?: boolean } = {}): Divide {
  const size = options.size ?? "sm";

  if (size !== "sm" && size !== "lg") {
    throw new Error('[Draeven] divide size is "sm" or "lg".');
  }

  return seal({
    kind: "divide",
    size,
    line: options.line === true,
  });
}

export function pack(
  options: { color?: Color; spoiler?: boolean },
  ...parts: readonly LayoutPart[]
): Pack {
  if (parts.length < 1) {
    throw new Error("[Draeven] pack() needs at least one part.");
  }

  for (const part of parts) {
    assertPart(part);
  }

  return seal({
    kind: "pack",
    ...(options.color === undefined ? {} : { color: accentColor(options.color) }),
    spoiler: options.spoiler === true,
    parts: [...parts],
  });
}

export function beside(options: { text: string; with: Thumb | Row }): Beside {
  const text = options.text.trim();

  if (!text || text.length > 4000) {
    throw new Error("[Draeven] beside() text must be 1-4000 characters.");
  }

  if (!isThumb(options.with) && !isRow(options.with)) {
    throw new Error("[Draeven] beside() with must be thumb() or a row().");
  }

  return seal({
    kind: "beside",
    text,
    with: options.with,
  });
}

export function thumb(options: { url: string; description?: string } | string): Thumb {
  const url = typeof options === "string" ? options.trim() : options.url.trim();
  const description =
    typeof options === "string" ? undefined : options.description?.trim();

  if (!/^https:\/\//i.test(url)) {
    throw new Error("[Draeven] thumb() needs an https url.");
  }

  if (description !== undefined && (!description || description.length > 1024)) {
    throw new Error("[Draeven] thumb description must be 1-1024 characters.");
  }

  return seal({
    kind: "thumb",
    url,
    ...(description ? { description } : {}),
  });
}

export function album(...items: readonly (string | AlbumItem)[]): Album {
  if (items.length < 1 || items.length > 10) {
    throw new Error("[Draeven] album() needs 1-10 images.");
  }

  return seal({
    kind: "album",
    items: items.map((item, index) => readAlbumItem(item, index)),
  });
}

export function showFile(options: { name: string; spoiler?: boolean } | string): ShowFile {
  const name = typeof options === "string" ? options.trim() : options.name.trim();
  const spoiler = typeof options === "string" ? false : options.spoiler === true;

  if (!name) {
    throw new Error("[Draeven] showFile() needs a file name.");
  }

  return seal({ kind: "show-file", name, spoiler });
}

export function isLayout(value: unknown): value is Layout {
  return marked(value, "layout");
}

export function isThumb(value: unknown): value is Thumb {
  return marked(value, "thumb");
}

export function discordLayout(entry: Layout): object[] {
  return entry.parts.map(discordPart);
}

export function layoutActions(entry: Layout): { id: string; run: Press }[] {
  const actions: { id: string; run: Press }[] = [];

  walk(entry.parts, actions);
  return actions;
}

function walk(parts: readonly LayoutPart[], actions: { id: string; run: Press }[]): void {
  for (const part of parts) {
    if (isRow(part)) {
      actions.push(...rowActions({ rows: [part] }));
      continue;
    }

    if (part.kind === "pack") {
      walk(part.parts, actions);
      continue;
    }

    if (part.kind === "beside" && isRow(part.with)) {
      actions.push(...rowActions({ rows: [part.with] }));
    }
  }
}

function discordPart(part: LayoutPart): object {
  switch (part.kind) {
    case "show":
      return { type: 10, content: part.text };
    case "divide":
      return {
        type: 14,
        divider: part.line,
        spacing: part.size === "lg" ? 2 : 1,
      };
    case "pack":
      return {
        type: 17,
        ...(part.color === undefined ? {} : { accent_color: part.color }),
        spoiler: part.spoiler,
        components: part.parts.map(discordPart),
      };
    case "beside":
      return {
        type: 9,
        components: [{ type: 10, content: part.text }],
        accessory: isThumb(part.with)
          ? {
              type: 11,
              media: { url: part.with.url },
              ...(part.with.description
                ? { description: part.with.description }
                : {}),
            }
          : discordRowAccessory(part.with),
      };
    case "album":
      return {
        type: 12,
        items: part.items.map((item) => ({
          media: { url: item.url },
          ...(item.description ? { description: item.description } : {}),
          spoiler: item.spoiler === true,
        })),
      };
    case "show-file":
      return {
        type: 13,
        file: { url: part.name.startsWith("https://") ? part.name : `attachment://${part.name}` },
        spoiler: part.spoiler,
      };
    case "row":
      return discordRowsOne(part);
    default:
      throw new Error("[Draeven] Unknown layout part.");
  }
}

function discordRowsOne(row: Row): object {
  return discordRows([row])[0]!;
}

function discordRowAccessory(row: Row): object {
  const encoded = discordRowsOne(row) as { components?: object[] };
  const first = encoded.components?.[0];

  if (!first) {
    throw new Error("[Draeven] beside() row needs one button.");
  }

  return first;
}

function readAlbumItem(item: string | AlbumItem, index: number): AlbumItem {
  if (typeof item === "string") {
    const url = item.trim();

    if (!/^https:\/\//i.test(url)) {
      throw new Error(`[Draeven] album item ${index + 1} needs an https url.`);
    }

    return { url };
  }

  const url = item.url.trim();

  if (!/^https:\/\//i.test(url)) {
    throw new Error(`[Draeven] album item ${index + 1} needs an https url.`);
  }

  const description = item.description?.trim();

  if (description !== undefined && (!description || description.length > 1024)) {
    throw new Error(`[Draeven] album item ${index + 1} description must be 1-1024 characters.`);
  }

  return {
    url,
    ...(description ? { description } : {}),
    ...(item.spoiler === true ? { spoiler: true } : {}),
  };
}

function assertPart(part: LayoutPart): void {
  if (
    !part ||
    typeof part !== "object" ||
    !("kind" in part) ||
    (part.kind !== "row" && !owned.has(part) && !isRow(part))
  ) {
    if (isRow(part)) {
      return;
    }

    throw new Error(
      "[Draeven] layout() parts come from show, divide, pack, beside, album, showFile, or row."
    );
  }
}

function accentColor(color: Color): number {
  const { r, g, b } = paintColor(color);
  return (r << 16) | (g << 8) | b;
}

function seal<T extends object>(value: T): T {
  owned.add(value);
  return value;
}

function marked(value: unknown, kind: string): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    owned.has(value) &&
    "kind" in value &&
    value.kind === kind
  );
}
