/*
 * Draeven Core: a card Discord shows under a reply.
 *
 * A field is { name, value }. Up to three fields share a row.
 * breakline starts the next row. wide: true takes the whole row.
 * rows and picture belong to the card. reply(card) sends them with it.
 */

import { assertReplyParts, isRow, type Row } from "./pieces.js";
import { pictureMark } from "./marks.js";
import type { Canvas } from "./canvas.js";

const EMBED = Symbol("embed");

/* One column of empty space, so a short row really ends. */
const BLANK = "\u200b";

/** Put this between fields. The next fields start on a new row. */
export const breakline = Symbol("breakline");

export type ColorName =
  | "aliceblue"
  | "antiquewhite"
  | "aqua"
  | "aquamarine"
  | "azure"
  | "beige"
  | "bisque"
  | "black"
  | "blanchedalmond"
  | "blue"
  | "blueviolet"
  | "blurple"
  | "brown"
  | "burlywood"
  | "cadetblue"
  | "chartreuse"
  | "chocolate"
  | "coral"
  | "cornflowerblue"
  | "cornsilk"
  | "crimson"
  | "cyan"
  | "darkblue"
  | "darkcyan"
  | "darkgoldenrod"
  | "darkgray"
  | "darkgreen"
  | "darkgrey"
  | "darkkhaki"
  | "darkmagenta"
  | "darkolivegreen"
  | "darkorange"
  | "darkorchid"
  | "darkred"
  | "darksalmon"
  | "darkseagreen"
  | "darkslateblue"
  | "darkslategray"
  | "darkslategrey"
  | "darkturquoise"
  | "darkviolet"
  | "deeppink"
  | "deepskyblue"
  | "dimgray"
  | "dimgrey"
  | "dodgerblue"
  | "firebrick"
  | "floralwhite"
  | "forestgreen"
  | "fuchsia"
  | "gainsboro"
  | "ghostwhite"
  | "gold"
  | "goldenrod"
  | "gray"
  | "green"
  | "greenyellow"
  | "grey"
  | "honeydew"
  | "hotpink"
  | "indianred"
  | "indigo"
  | "ivory"
  | "khaki"
  | "lavender"
  | "lavenderblush"
  | "lawngreen"
  | "lemonchiffon"
  | "lightblue"
  | "lightcoral"
  | "lightcyan"
  | "lightgoldenrodyellow"
  | "lightgray"
  | "lightgreen"
  | "lightgrey"
  | "lightpink"
  | "lightsalmon"
  | "lightseagreen"
  | "lightskyblue"
  | "lightslategray"
  | "lightslategrey"
  | "lightsteelblue"
  | "lightyellow"
  | "lime"
  | "limegreen"
  | "linen"
  | "magenta"
  | "maroon"
  | "mediumaquamarine"
  | "mediumblue"
  | "mediumorchid"
  | "mediumpurple"
  | "mediumseagreen"
  | "mediumslateblue"
  | "mediumspringgreen"
  | "mediumturquoise"
  | "mediumvioletred"
  | "midnightblue"
  | "mintcream"
  | "mistyrose"
  | "moccasin"
  | "navajowhite"
  | "navy"
  | "oldlace"
  | "olive"
  | "olivedrab"
  | "orange"
  | "orangered"
  | "orchid"
  | "palegoldenrod"
  | "palegreen"
  | "paleturquoise"
  | "palevioletred"
  | "papayawhip"
  | "peachpuff"
  | "peru"
  | "pink"
  | "plum"
  | "powderblue"
  | "purple"
  | "rebeccapurple"
  | "red"
  | "rosybrown"
  | "royalblue"
  | "saddlebrown"
  | "salmon"
  | "sandybrown"
  | "seagreen"
  | "seashell"
  | "sienna"
  | "silver"
  | "skyblue"
  | "slateblue"
  | "slategray"
  | "slategrey"
  | "snow"
  | "springgreen"
  | "steelblue"
  | "tan"
  | "teal"
  | "thistle"
  | "tomato"
  | "turquoise"
  | "violet"
  | "wheat"
  | "white"
  | "whitesmoke"
  | "yellow"
  | "yellowgreen";

/** Every named color. A quote or colors. lists them. */
export type Color = ColorName;

const colorHex = {
  aliceblue: "#F0F8FF",
  antiquewhite: "#FAEBD7",
  aqua: "#00FFFF",
  aquamarine: "#7FFFD4",
  azure: "#F0FFFF",
  beige: "#F5F5DC",
  bisque: "#FFE4C4",
  black: "#000000",
  blanchedalmond: "#FFEBCD",
  blue: "#0000FF",
  blueviolet: "#8A2BE2",
  blurple: "#5865F2",
  brown: "#A52A2A",
  burlywood: "#DEB887",
  cadetblue: "#5F9EA0",
  chartreuse: "#7FFF00",
  chocolate: "#D2691E",
  coral: "#FF7F50",
  cornflowerblue: "#6495ED",
  cornsilk: "#FFF8DC",
  crimson: "#DC143C",
  cyan: "#00FFFF",
  darkblue: "#00008B",
  darkcyan: "#008B8B",
  darkgoldenrod: "#B8860B",
  darkgray: "#A9A9A9",
  darkgreen: "#006400",
  darkgrey: "#A9A9A9",
  darkkhaki: "#BDB76B",
  darkmagenta: "#8B008B",
  darkolivegreen: "#556B2F",
  darkorange: "#FF8C00",
  darkorchid: "#9932CC",
  darkred: "#8B0000",
  darksalmon: "#E9967A",
  darkseagreen: "#8FBC8F",
  darkslateblue: "#483D8B",
  darkslategray: "#2F4F4F",
  darkslategrey: "#2F4F4F",
  darkturquoise: "#00CED1",
  darkviolet: "#9400D3",
  deeppink: "#FF1493",
  deepskyblue: "#00BFFF",
  dimgray: "#696969",
  dimgrey: "#696969",
  dodgerblue: "#1E90FF",
  firebrick: "#B22222",
  floralwhite: "#FFFAF0",
  forestgreen: "#228B22",
  fuchsia: "#FF00FF",
  gainsboro: "#DCDCDC",
  ghostwhite: "#F8F8FF",
  gold: "#FFD700",
  goldenrod: "#DAA520",
  gray: "#808080",
  green: "#008000",
  greenyellow: "#ADFF2F",
  grey: "#808080",
  honeydew: "#F0FFF0",
  hotpink: "#FF69B4",
  indianred: "#CD5C5C",
  indigo: "#4B0082",
  ivory: "#FFFFF0",
  khaki: "#F0E68C",
  lavender: "#E6E6FA",
  lavenderblush: "#FFF0F5",
  lawngreen: "#7CFC00",
  lemonchiffon: "#FFFACD",
  lightblue: "#ADD8E6",
  lightcoral: "#F08080",
  lightcyan: "#E0FFFF",
  lightgoldenrodyellow: "#FAFAD2",
  lightgray: "#D3D3D3",
  lightgreen: "#90EE90",
  lightgrey: "#D3D3D3",
  lightpink: "#FFB6C1",
  lightsalmon: "#FFA07A",
  lightseagreen: "#20B2AA",
  lightskyblue: "#87CEFA",
  lightslategray: "#778899",
  lightslategrey: "#778899",
  lightsteelblue: "#B0C4DE",
  lightyellow: "#FFFFE0",
  lime: "#00FF00",
  limegreen: "#32CD32",
  linen: "#FAF0E6",
  magenta: "#FF00FF",
  maroon: "#800000",
  mediumaquamarine: "#66CDAA",
  mediumblue: "#0000CD",
  mediumorchid: "#BA55D3",
  mediumpurple: "#9370DB",
  mediumseagreen: "#3CB371",
  mediumslateblue: "#7B68EE",
  mediumspringgreen: "#00FA9A",
  mediumturquoise: "#48D1CC",
  mediumvioletred: "#C71585",
  midnightblue: "#191970",
  mintcream: "#F5FFFA",
  mistyrose: "#FFE4E1",
  moccasin: "#FFE4B5",
  navajowhite: "#FFDEAD",
  navy: "#000080",
  oldlace: "#FDF5E6",
  olive: "#808000",
  olivedrab: "#6B8E23",
  orange: "#FFA500",
  orangered: "#FF4500",
  orchid: "#DA70D6",
  palegoldenrod: "#EEE8AA",
  palegreen: "#98FB98",
  paleturquoise: "#AFEEEE",
  palevioletred: "#DB7093",
  papayawhip: "#FFEFD5",
  peachpuff: "#FFDAB9",
  peru: "#CD853F",
  pink: "#FFC0CB",
  plum: "#DDA0DD",
  powderblue: "#B0E0E6",
  purple: "#800080",
  rebeccapurple: "#663399",
  red: "#FF0000",
  rosybrown: "#BC8F8F",
  royalblue: "#4169E1",
  saddlebrown: "#8B4513",
  salmon: "#FA8072",
  sandybrown: "#F4A460",
  seagreen: "#2E8B57",
  seashell: "#FFF5EE",
  sienna: "#A0522D",
  silver: "#C0C0C0",
  skyblue: "#87CEEB",
  slateblue: "#6A5ACD",
  slategray: "#708090",
  slategrey: "#708090",
  snow: "#FFFAFA",
  springgreen: "#00FF7F",
  steelblue: "#4682B4",
  tan: "#D2B48C",
  teal: "#008080",
  thistle: "#D8BFD8",
  tomato: "#FF6347",
  turquoise: "#40E0D0",
  violet: "#EE82EE",
  wheat: "#F5DEB3",
  white: "#FFFFFF",
  whitesmoke: "#F5F5F5",
  yellow: "#FFFF00",
  yellowgreen: "#9ACD32",
} as const satisfies Record<ColorName, string>;

/**
 * Every named color.
 * Typing colors. lists the names. A quote on color lists the same names.
 */
export const colors = {
  /** #F0F8FF */
  aliceblue: "aliceblue",
  /** #FAEBD7 */
  antiquewhite: "antiquewhite",
  /** #00FFFF */
  aqua: "aqua",
  /** #7FFFD4 */
  aquamarine: "aquamarine",
  /** #F0FFFF */
  azure: "azure",
  /** #F5F5DC */
  beige: "beige",
  /** #FFE4C4 */
  bisque: "bisque",
  /** #000000 */
  black: "black",
  /** #FFEBCD */
  blanchedalmond: "blanchedalmond",
  /** #0000FF */
  blue: "blue",
  /** #8A2BE2 */
  blueviolet: "blueviolet",
  /** #5865F2 */
  blurple: "blurple",
  /** #A52A2A */
  brown: "brown",
  /** #DEB887 */
  burlywood: "burlywood",
  /** #5F9EA0 */
  cadetblue: "cadetblue",
  /** #7FFF00 */
  chartreuse: "chartreuse",
  /** #D2691E */
  chocolate: "chocolate",
  /** #FF7F50 */
  coral: "coral",
  /** #6495ED */
  cornflowerblue: "cornflowerblue",
  /** #FFF8DC */
  cornsilk: "cornsilk",
  /** #DC143C */
  crimson: "crimson",
  /** #00FFFF */
  cyan: "cyan",
  /** #00008B */
  darkblue: "darkblue",
  /** #008B8B */
  darkcyan: "darkcyan",
  /** #B8860B */
  darkgoldenrod: "darkgoldenrod",
  /** #A9A9A9 */
  darkgray: "darkgray",
  /** #006400 */
  darkgreen: "darkgreen",
  /** #A9A9A9 */
  darkgrey: "darkgrey",
  /** #BDB76B */
  darkkhaki: "darkkhaki",
  /** #8B008B */
  darkmagenta: "darkmagenta",
  /** #556B2F */
  darkolivegreen: "darkolivegreen",
  /** #FF8C00 */
  darkorange: "darkorange",
  /** #9932CC */
  darkorchid: "darkorchid",
  /** #8B0000 */
  darkred: "darkred",
  /** #E9967A */
  darksalmon: "darksalmon",
  /** #8FBC8F */
  darkseagreen: "darkseagreen",
  /** #483D8B */
  darkslateblue: "darkslateblue",
  /** #2F4F4F */
  darkslategray: "darkslategray",
  /** #2F4F4F */
  darkslategrey: "darkslategrey",
  /** #00CED1 */
  darkturquoise: "darkturquoise",
  /** #9400D3 */
  darkviolet: "darkviolet",
  /** #FF1493 */
  deeppink: "deeppink",
  /** #00BFFF */
  deepskyblue: "deepskyblue",
  /** #696969 */
  dimgray: "dimgray",
  /** #696969 */
  dimgrey: "dimgrey",
  /** #1E90FF */
  dodgerblue: "dodgerblue",
  /** #B22222 */
  firebrick: "firebrick",
  /** #FFFAF0 */
  floralwhite: "floralwhite",
  /** #228B22 */
  forestgreen: "forestgreen",
  /** #FF00FF */
  fuchsia: "fuchsia",
  /** #DCDCDC */
  gainsboro: "gainsboro",
  /** #F8F8FF */
  ghostwhite: "ghostwhite",
  /** #FFD700 */
  gold: "gold",
  /** #DAA520 */
  goldenrod: "goldenrod",
  /** #808080 */
  gray: "gray",
  /** #008000 */
  green: "green",
  /** #ADFF2F */
  greenyellow: "greenyellow",
  /** #808080 */
  grey: "grey",
  /** #F0FFF0 */
  honeydew: "honeydew",
  /** #FF69B4 */
  hotpink: "hotpink",
  /** #CD5C5C */
  indianred: "indianred",
  /** #4B0082 */
  indigo: "indigo",
  /** #FFFFF0 */
  ivory: "ivory",
  /** #F0E68C */
  khaki: "khaki",
  /** #E6E6FA */
  lavender: "lavender",
  /** #FFF0F5 */
  lavenderblush: "lavenderblush",
  /** #7CFC00 */
  lawngreen: "lawngreen",
  /** #FFFACD */
  lemonchiffon: "lemonchiffon",
  /** #ADD8E6 */
  lightblue: "lightblue",
  /** #F08080 */
  lightcoral: "lightcoral",
  /** #E0FFFF */
  lightcyan: "lightcyan",
  /** #FAFAD2 */
  lightgoldenrodyellow: "lightgoldenrodyellow",
  /** #D3D3D3 */
  lightgray: "lightgray",
  /** #90EE90 */
  lightgreen: "lightgreen",
  /** #D3D3D3 */
  lightgrey: "lightgrey",
  /** #FFB6C1 */
  lightpink: "lightpink",
  /** #FFA07A */
  lightsalmon: "lightsalmon",
  /** #20B2AA */
  lightseagreen: "lightseagreen",
  /** #87CEFA */
  lightskyblue: "lightskyblue",
  /** #778899 */
  lightslategray: "lightslategray",
  /** #778899 */
  lightslategrey: "lightslategrey",
  /** #B0C4DE */
  lightsteelblue: "lightsteelblue",
  /** #FFFFE0 */
  lightyellow: "lightyellow",
  /** #00FF00 */
  lime: "lime",
  /** #32CD32 */
  limegreen: "limegreen",
  /** #FAF0E6 */
  linen: "linen",
  /** #FF00FF */
  magenta: "magenta",
  /** #800000 */
  maroon: "maroon",
  /** #66CDAA */
  mediumaquamarine: "mediumaquamarine",
  /** #0000CD */
  mediumblue: "mediumblue",
  /** #BA55D3 */
  mediumorchid: "mediumorchid",
  /** #9370DB */
  mediumpurple: "mediumpurple",
  /** #3CB371 */
  mediumseagreen: "mediumseagreen",
  /** #7B68EE */
  mediumslateblue: "mediumslateblue",
  /** #00FA9A */
  mediumspringgreen: "mediumspringgreen",
  /** #48D1CC */
  mediumturquoise: "mediumturquoise",
  /** #C71585 */
  mediumvioletred: "mediumvioletred",
  /** #191970 */
  midnightblue: "midnightblue",
  /** #F5FFFA */
  mintcream: "mintcream",
  /** #FFE4E1 */
  mistyrose: "mistyrose",
  /** #FFE4B5 */
  moccasin: "moccasin",
  /** #FFDEAD */
  navajowhite: "navajowhite",
  /** #000080 */
  navy: "navy",
  /** #FDF5E6 */
  oldlace: "oldlace",
  /** #808000 */
  olive: "olive",
  /** #6B8E23 */
  olivedrab: "olivedrab",
  /** #FFA500 */
  orange: "orange",
  /** #FF4500 */
  orangered: "orangered",
  /** #DA70D6 */
  orchid: "orchid",
  /** #EEE8AA */
  palegoldenrod: "palegoldenrod",
  /** #98FB98 */
  palegreen: "palegreen",
  /** #AFEEEE */
  paleturquoise: "paleturquoise",
  /** #DB7093 */
  palevioletred: "palevioletred",
  /** #FFEFD5 */
  papayawhip: "papayawhip",
  /** #FFDAB9 */
  peachpuff: "peachpuff",
  /** #CD853F */
  peru: "peru",
  /** #FFC0CB */
  pink: "pink",
  /** #DDA0DD */
  plum: "plum",
  /** #B0E0E6 */
  powderblue: "powderblue",
  /** #800080 */
  purple: "purple",
  /** #663399 */
  rebeccapurple: "rebeccapurple",
  /** #FF0000 */
  red: "red",
  /** #BC8F8F */
  rosybrown: "rosybrown",
  /** #4169E1 */
  royalblue: "royalblue",
  /** #8B4513 */
  saddlebrown: "saddlebrown",
  /** #FA8072 */
  salmon: "salmon",
  /** #F4A460 */
  sandybrown: "sandybrown",
  /** #2E8B57 */
  seagreen: "seagreen",
  /** #FFF5EE */
  seashell: "seashell",
  /** #A0522D */
  sienna: "sienna",
  /** #C0C0C0 */
  silver: "silver",
  /** #87CEEB */
  skyblue: "skyblue",
  /** #6A5ACD */
  slateblue: "slateblue",
  /** #708090 */
  slategray: "slategray",
  /** #708090 */
  slategrey: "slategrey",
  /** #FFFAFA */
  snow: "snow",
  /** #00FF7F */
  springgreen: "springgreen",
  /** #4682B4 */
  steelblue: "steelblue",
  /** #D2B48C */
  tan: "tan",
  /** #008080 */
  teal: "teal",
  /** #D8BFD8 */
  thistle: "thistle",
  /** #FF6347 */
  tomato: "tomato",
  /** #40E0D0 */
  turquoise: "turquoise",
  /** #EE82EE */
  violet: "violet",
  /** #F5DEB3 */
  wheat: "wheat",
  /** #FFFFFF */
  white: "white",
  /** #F5F5F5 */
  whitesmoke: "whitesmoke",
  /** #FFFF00 */
  yellow: "yellow",
  /** #9ACD32 */
  yellowgreen: "yellowgreen",
} as const satisfies Record<ColorName, ColorName>;

/** Text, a number, yes or no, or a date. */
export type FieldValue = string | number | boolean | Date;

/** One fact on the card. `wide: true` takes the whole row. */
export interface EmbedFieldInput {
  /** Label on the left. */
  name: string;
  /** Text, a number, yes or no, or a date. */
  value: FieldValue;
  /** Takes the whole row. Leave it out to share the row, up to three fields. */
  wide?: boolean;
}

export type EmbedFieldLine = EmbedFieldInput | typeof breakline;

/** The title, the link on that title, and the picture beside it. */
export interface EmbedHeader {
  /** Large title. */
  title?: string;
  /** Makes the title a link. Needs a title. */
  link?: string;
  /** Picture beside the title. */
  image?: string;
}

/** Small line above the title. */
export interface EmbedAuthor {
  /** Name above the title. */
  name: string;
  /** Small icon in front of the name. */
  icon?: string;
  /** Makes the name a link. */
  link?: string;
}

/** Line at the bottom of the card. */
export interface EmbedFooter {
  /** Footer text. */
  text: string;
  /** Small icon in front of the footer. */
  icon?: string;
}

export interface EmbedOptions {
  /** Bar on the left. A quote or colors. lists every named color. */
  color?: Color;
  /** Name above the title, with an optional icon and link. */
  author?: EmbedAuthor;
  /** Title, the link on that title, and the picture beside it. */
  header?: EmbedHeader;
  /** Paragraph under the title. */
  description?: string;
  /**
   * Rows of { name, value }.
   * Up to three fields share a row. breakline starts the next row.
   * wide: true takes the whole row.
   */
  fields?: readonly EmbedFieldLine[];
  /** Large picture under the fields. */
  image?: string;
  /** Line at the bottom, with an optional icon. */
  footer?: EmbedFooter;
  /** Time beside the footer, shown in the reader's timezone. */
  timestamp?: Date;
  /** Buttons and menus under the card. Up to five rows. */
  rows?: readonly Row[];
  /** A picture from canvas(), sent with the card. */
  picture?: Canvas;
}

export interface EmbedField {
  readonly name: string;
  readonly value: string;
  readonly inline: boolean;
}

export interface Embed {
  readonly color?: number;
  readonly author?: EmbedAuthor;
  readonly header?: EmbedHeader;
  readonly description?: string;
  readonly image?: string;
  readonly footer?: EmbedFooter;
  readonly timestamp?: string;
  readonly fields: readonly EmbedField[];
  readonly rows?: readonly Row[];
  readonly picture?: Canvas;
}

export type TimeStyle =
  | "time"
  | "long time"
  | "date"
  | "long date"
  | "date and time"
  | "full"
  | "relative"
  | "t"
  | "T"
  | "d"
  | "D"
  | "f"
  | "F"
  | "R";

const TIME_STYLES: Record<TimeStyle, string> = {
  time: "t",
  "long time": "T",
  date: "d",
  "long date": "D",
  "date and time": "f",
  full: "F",
  relative: "R",
  t: "t",
  T: "T",
  d: "d",
  D: "D",
  f: "f",
  F: "F",
  R: "R",
};

/* A date Discord renders in the reader's own timezone. */
export function time(date: Date, style: TimeStyle): string {
  assertDate(date, "A time");

  const letter = TIME_STYLES[style];

  if (!letter) {
    throw new Error(
      "[Draeven] Unknown time style. Use time, long time, date, long date, date and time, full, or relative."
    );
  }

  return `<t:${Math.floor(date.getTime() / 1000)}:${letter}>`;
}

/* Build one embed. */
export function embed(options: EmbedOptions): Embed {
  const header = options.header === undefined ? undefined : readHeader(options.header);
  const description = text(options.description, "A description", 4096);
  const author = options.author === undefined ? undefined : readAuthor(options.author);
  const footer = options.footer === undefined ? undefined : readFooter(options.footer);
  const image = options.image === undefined ? undefined : httpUrl(options.image, "An image");
  const timestamp = options.timestamp === undefined ? undefined : readTimestamp(options.timestamp);
  const color = options.color === undefined ? undefined : readColor(options.color);
  const fields = layout(options.fields ?? []);
  const rows = readRows(options.rows);
  const picture = readPicture(options.picture);

  if (
    !header &&
    !description &&
    !author &&
    !image &&
    !footer &&
    !timestamp &&
    fields.length === 0
  ) {
    throw new Error("[Draeven] An embed needs a title, text, a picture, or fields.");
  }

  const card: Embed = {
    ...(color !== undefined ? { color } : {}),
    ...(author ? { author } : {}),
    ...(header ? { header } : {}),
    ...(description ? { description } : {}),
    ...(image ? { image } : {}),
    ...(footer ? { footer } : {}),
    ...(timestamp ? { timestamp } : {}),
    ...(rows ? { rows } : {}),
    ...(picture ? { picture } : {}),
    fields,
  };

  assertEmbedLength(card);
  Object.defineProperty(card, EMBED, { value: true });
  return card;
}

export function isEmbed(value: unknown): value is Embed {
  return typeof value === "object" && value !== null && EMBED in value;
}

function readRows(rows: readonly Row[] | undefined): readonly Row[] | undefined {
  if (rows === undefined) {
    return undefined;
  }

  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 5) {
    throw new Error("[Draeven] A card holds up to 5 rows.");
  }

  assertReplyParts(rows, undefined);
  return rows;
}

function readPicture(picture: Canvas | undefined): Canvas | undefined {
  if (picture === undefined) {
    return undefined;
  }

  if (typeof picture !== "object" || picture === null || !(pictureMark in picture)) {
    throw new Error("[Draeven] A picture comes from canvas().");
  }

  return picture;
}

function readHeader(header: EmbedHeader): EmbedHeader {
  const title = text(header.title, "A title", 256);
  const link = header.link === undefined ? undefined : httpUrl(header.link, "A title link");
  const image = header.image === undefined ? undefined : httpUrl(header.image, "A header image");

  if (link && !title) {
    throw new Error("[Draeven] A title link needs a title.");
  }

  if (!title && !image) {
    throw new Error("[Draeven] A header needs a title or an image.");
  }

  return {
    ...(title ? { title } : {}),
    ...(link ? { link } : {}),
    ...(image ? { image } : {}),
  };
}

function readAuthor(author: EmbedAuthor): EmbedAuthor {
  const name = text(author.name, "An author name", 256);

  if (!name) {
    throw new Error("[Draeven] An author name must be 1-256 characters.");
  }

  return {
    name,
    ...(author.icon === undefined ? {} : { icon: httpUrl(author.icon, "An author icon") }),
    ...(author.link === undefined ? {} : { link: httpUrl(author.link, "An author link") }),
  };
}

function readFooter(footer: EmbedFooter): EmbedFooter {
  const footerText = text(footer.text, "A footer", 2048);

  if (!footerText) {
    throw new Error("[Draeven] A footer must be 1-2048 characters.");
  }

  return {
    text: footerText,
    ...(footer.icon === undefined ? {} : { icon: httpUrl(footer.icon, "A footer icon") }),
  };
}

function readTimestamp(date: Date): string {
  assertDate(date, "A timestamp");
  return date.toISOString();
}

/* The red, green, and blue of a named color. Canvas uses this when it paints. */
export function paintColor(color: Color): { r: number; g: number; b: number } {
  const value = readColor(color);

  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function readColor(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isInteger(input) || input < 0 || input > 0xffffff) {
      throw new Error(colorError());
    }

    return input;
  }

  const named = colorHex[input.trim().toLowerCase() as ColorName];

  if (named) {
    return hexToNumber(named);
  }

  return hexToNumber(input);
}

function hexToNumber(input: string): number {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(input.trim());

  if (!match) {
    throw new Error(colorError());
  }

  const hex = match[1].length === 3
    ? match[1].split("").map((digit) => digit + digit).join("")
    : match[1];

  return Number.parseInt(hex, 16);
}

function colorError(): string {
  return "[Draeven] A color must be a name from colors, or #RRGGBB.";
}

interface FieldPiece {
  name: string;
  value: string;
}

interface FieldGroup {
  wide: boolean;
  items: FieldPiece[];
}

function layout(lines: readonly EmbedFieldLine[]): EmbedField[] {
  const groups: FieldGroup[] = [];
  let row: FieldPiece[] = [];

  const flushRow = () => {
    if (row.length === 0) {
      return;
    }

    groups.push({ wide: false, items: row });
    row = [];
  };

  for (const line of lines) {
    if (line === breakline) {
      flushRow();
      continue;
    }

    if (typeof line !== "object" || line === null) {
      throw new Error("[Draeven] A field is { name, value }.");
    }

    const piece = readField(line);

    if (piece.wide) {
      flushRow();
      groups.push({ wide: true, items: [{ name: piece.name, value: piece.value }] });
      continue;
    }

    row.push({ name: piece.name, value: piece.value });
  }

  flushRow();

  const fields: EmbedField[] = [];

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const next = groups[index + 1];

    if (group.wide) {
      fields.push({ ...group.items[0], inline: false });
      continue;
    }

    for (const item of group.items) {
      fields.push({ ...item, inline: true });
    }

    /* A following wide field already starts its own row. */
    if (!next || next.wide) {
      continue;
    }

    const remainder = group.items.length % 3;

    if (remainder === 0) {
      continue;
    }

    for (let pad = 0; pad < 3 - remainder; pad += 1) {
      fields.push({ name: BLANK, value: BLANK, inline: true });
    }
  }

  if (fields.length > 25) {
    throw new Error(
      "[Draeven] An embed can have 25 fields, including the empty columns a short row needs before a breakline."
    );
  }

  return fields;
}

function readField(field: EmbedFieldInput): FieldPiece & { wide: boolean } {
  if (typeof field.name !== "string" || !("value" in field)) {
    throw new Error("[Draeven] A field is { name, value }.");
  }

  const name = field.name.trim();

  if (!name || name.length > 256) {
    throw new Error("[Draeven] A field name must be 1-256 characters.");
  }

  return { name, value: fieldValue(field.value), wide: field.wide === true };
}

function fieldValue(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed || trimmed.length > 1024) {
      throw new Error("[Draeven] A field value must be 1-1024 characters.");
    }

    return trimmed;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("[Draeven] A field value must be a finite number.");
    }

    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }

  if (value instanceof Date) {
    return time(value, "long date");
  }

  throw new Error("[Draeven] A field value must be text, a number, yes or no, or a date.");
}

function text(value: string | undefined, label: string, max: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed || trimmed.length > max) {
    throw new Error(`[Draeven] ${label} must be 1-${max} characters.`);
  }

  return trimmed;
}

function httpUrl(value: string, label: string): string {
  const trimmed = value.trim();
  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(`[Draeven] ${label} must be an http(s) link.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`[Draeven] ${label} must be an http(s) link.`);
  }

  if (trimmed.length > 2048) {
    throw new Error(`[Draeven] ${label} must be at most 2048 characters.`);
  }

  return trimmed;
}

function assertDate(date: Date, label: string): void {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error(`[Draeven] ${label} must be a valid date.`);
  }
}

/* Discord counts these parts toward the 6000 character limit. Links do not count. */
function assertEmbedLength(card: Embed): void {
  let length = 0;
  length += card.header?.title?.length ?? 0;
  length += card.description?.length ?? 0;
  length += card.author?.name.length ?? 0;
  length += card.footer?.text.length ?? 0;

  for (const field of card.fields) {
    length += field.name.length + field.value.length;
  }

  if (length > 6000) {
    throw new Error("[Draeven] An embed can hold 6000 characters in total.");
  }
}
