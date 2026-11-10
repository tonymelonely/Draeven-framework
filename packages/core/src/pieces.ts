/*
 * Draeven Core: the pieces a Discord message can carry besides text and an embed.
 *
 * button, link, and sku sit in a row. A menu, people, roles, channels, or
 * mentions takes a row of its own. form() opens a popup. canvas() is the picture.
 *
 * Button colors are the four Discord paints: blurple, grey, green, and red.
 * Write color: " and the list appears. Canvas uses the names from colors.
 */

import type { Canvas } from "./canvas.js";
import type { Embed } from "./embed.js";
import type { Layout } from "./layout.js";
import type { Lookups, UserRef } from "./lookup.js";
import type { Poll } from "./poll.js";
import type { TranscriptFile } from "./transcript.js";

const owned = new WeakSet<object>();

export interface ReplyOptions {
  /** Only the caller can see this message. */
  private?: boolean;
}

export interface Reply {
  text?: string;
  embed?: Embed;
  rows?: readonly Row[];
  picture?: Canvas;
  form?: Form;
  file?: TranscriptFile;
  poll?: Poll;
  layout?: Layout;
  /** Only the caller can see this message. */
  private?: boolean;
  /** Extra messages queued after the first reply. */
  followups?: Reply[];
  /** True when wait() deferred the interaction. */
  deferred?: boolean;
}

export interface Message {
  /** The line above the card, the rows, and the picture. */
  text?: string;
  /** One embed, from embed(). */
  card?: Embed;
  /** Up to five rows, from row(). */
  rows?: readonly Row[];
  /** A picture from canvas(), sent as picture.png. */
  picture?: Canvas;
  /** A popup from form(). It is the whole reply. */
  form?: Form;
  /** A poll from poll(). */
  poll?: Poll;
  /** A Components V2 layout from layout(). */
  layout?: Layout;
  /** Only the caller can see this message. */
  private?: boolean;
}

export interface PressContext extends Lookups {
  readonly author: UserRef;
  /** What a menu sent back. Empty for a button. */
  readonly values: readonly string[];
  /** What a form sent back, by field id. */
  readonly fields: Readonly<Record<string, string>>;
  reply(text: string): Reply;
  reply(card: Embed): Reply;
  reply(text: string, card: Embed): Reply;
  reply(message: Message): Reply;
  reply(part: Row | Canvas | Form | Poll | Layout): Reply;
}

export type Press = (ctx: PressContext) => Reply | Promise<Reply>;

export type ButtonColor = "blurple" | "grey" | "green" | "red";

export const buttonColors = {
  /** Primary. #5865F2 */
  blurple: "blurple",
  /** Secondary. #4E5058 */
  grey: "grey",
  /** Success. #248046 */
  green: "green",
  /** Danger. #DA373C */
  red: "red",
} as const satisfies Record<ButtonColor, ButtonColor>;

export type ChannelKind =
  | "text"
  | "voice"
  | "category"
  | "announcement"
  | "announcement thread"
  | "thread"
  | "private thread"
  | "stage"
  | "forum"
  | "media";

export const channelKinds = {
  text: "text",
  voice: "voice",
  category: "category",
  announcement: "announcement",
  "announcement thread": "announcement thread",
  thread: "thread",
  "private thread": "private thread",
  stage: "stage",
  forum: "forum",
  media: "media",
} as const satisfies Record<ChannelKind, ChannelKind>;

export type FieldStyle = "short" | "long";

export const fieldStyles = {
  /** One line. */
  short: "short",
  /** A paragraph. */
  long: "long",
} as const satisfies Record<FieldStyle, FieldStyle>;

export interface Button {
  readonly kind: "button";
}

export interface Link {
  readonly kind: "link";
}

export interface Sku {
  readonly kind: "sku";
}

export interface Menu {
  readonly kind: "menu";
}

export interface People {
  readonly kind: "people";
}

export interface Roles {
  readonly kind: "roles";
}

export interface Channels {
  readonly kind: "channels";
}

export interface Mentions {
  readonly kind: "mentions";
}

export interface Row {
  readonly kind: "row";
}

export interface Form {
  readonly kind: "form";
}

export interface ButtonOptions {
  /** Sent back when someone presses. 1-100 characters. */
  id: string;
  /** The words on the button. 1-80 characters. */
  label: string;
  /** blurple, grey, green, or red. Defaults to blurple. */
  color?: ButtonColor;
  /** A unicode emoji, or <:name:id>. */
  emoji?: string;
  disabled?: boolean;
  press?: Press;
}

export interface LinkOptions {
  url: string;
  label: string;
  emoji?: string;
  disabled?: boolean;
}

export interface SkuOptions {
  /** The Discord SKU id. */
  id: string;
}

export interface MenuChoice {
  label: string;
  value: string;
  description?: string;
  emoji?: string;
  selected?: boolean;
}

export interface MenuOptions {
  id: string;
  /** Shown before a choice is made. */
  placeholder: string;
  choices: readonly MenuChoice[];
  /** How many must be picked. Defaults to 1. */
  min?: number;
  /** How many may be picked. Defaults to 1. */
  max?: number;
  disabled?: boolean;
  press?: Press;
}

export interface PickerOptions {
  id: string;
  placeholder?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  press?: Press;
}

export interface ChannelOptions extends PickerOptions {
  /** Leave this out to allow every kind. */
  kinds?: readonly ChannelKind[];
}

export interface FormField {
  id: string;
  label: string;
  /** short or long. Defaults to short. */
  style?: FieldStyle;
  /** Defaults to true. */
  required?: boolean;
  placeholder?: string;
  /** Minimum characters. */
  min?: number;
  /** Maximum characters. */
  max?: number;
}

export interface FormOptions {
  id: string;
  /** The title of the popup. 1-45 characters. */
  title: string;
  fields: readonly FormField[];
  submit?: Press;
}

interface ButtonData extends Button {
  id: string;
  label: string;
  color: ButtonColor;
  emoji?: { name: string; id?: string; animated?: boolean };
  disabled: boolean;
  press?: Press;
}

interface LinkData extends Link {
  label: string;
  url: string;
  emoji?: { name: string; id?: string; animated?: boolean };
  disabled: boolean;
}

interface SkuData extends Sku {
  id: string;
}

interface ChoiceData {
  label: string;
  value: string;
  description?: string;
  emoji?: { name: string; id?: string; animated?: boolean };
  selected: boolean;
}

interface MenuData extends Menu {
  id: string;
  placeholder: string;
  choices: ChoiceData[];
  min: number;
  max: number;
  disabled: boolean;
  press?: Press;
}

interface PickerData {
  id: string;
  placeholder?: string;
  min: number;
  max: number;
  disabled: boolean;
  press?: Press;
  kinds?: number[];
}

interface PeopleData extends People, PickerData {}
interface RolesData extends Roles, PickerData {}
interface ChannelsData extends Channels, PickerData {}
interface MentionsData extends Mentions, PickerData {}

interface RowData extends Row {
  pieces: readonly PieceData[];
}

interface FieldData {
  id: string;
  label: string;
  style: 1 | 2;
  required: boolean;
  placeholder?: string;
  min?: number;
  max?: number;
}

interface FormData extends Form {
  id: string;
  title: string;
  fields: FieldData[];
  submit?: Press;
}

type PieceData =
  | ButtonData
  | LinkData
  | SkuData
  | MenuData
  | PeopleData
  | RolesData
  | ChannelsData
  | MentionsData;

type AnyPiece = Button | Link | Sku | Menu | People | Roles | Channels | Mentions;

const buttonStyle: Record<ButtonColor, number> = {
  blurple: 1,
  grey: 2,
  green: 3,
  red: 4,
};

const channelType: Record<ChannelKind, number> = {
  text: 0,
  voice: 2,
  category: 4,
  announcement: 5,
  "announcement thread": 10,
  thread: 11,
  "private thread": 12,
  stage: 13,
  forum: 15,
  media: 16,
};

export function button(options: ButtonOptions): Button {
  const color = options.color ?? "blurple";

  if (!(color in buttonStyle)) {
    throw new Error("[Draeven] A button color is blurple, grey, green, or red.");
  }

  return seal<ButtonData>({
    kind: "button",
    id: readId(options.id, "button"),
    label: readLabel(options.label, "button", 80),
    color,
    ...(options.emoji === undefined ? {} : { emoji: readEmoji(options.emoji) }),
    disabled: readFlag(options.disabled, "disabled"),
    ...(options.press === undefined ? {} : { press: readPress(options.press) }),
  });
}

export function link(options: LinkOptions): Link {
  return seal<LinkData>({
    kind: "link",
    label: readLabel(options.label, "link", 80),
    url: readUrl(options.url),
    ...(options.emoji === undefined ? {} : { emoji: readEmoji(options.emoji) }),
    disabled: readFlag(options.disabled, "disabled"),
  });
}

export function sku(options: SkuOptions): Sku {
  const id = options.id.trim();

  if (!/^\d{1,20}$/.test(id)) {
    throw new Error("[Draeven] A SKU id is a number of 1-20 digits.");
  }

  return seal<SkuData>({ kind: "sku", id });
}

export function menu(options: MenuOptions): Menu {
  const range = readRange(options.min, options.max);
  const choices = options.choices.map(readChoice);
  const values = new Set<string>();

  for (const choice of choices) {
    if (values.has(choice.value)) {
      throw new Error(`[Draeven] Menu value ${choice.value} is used more than once.`);
    }

    values.add(choice.value);
  }

  if (choices.length < 1 || choices.length > 25) {
    throw new Error("[Draeven] A menu has 1-25 choices.");
  }

  if (range.max > choices.length || range.min > choices.length) {
    throw new Error("[Draeven] A menu cannot ask for more picks than it has choices.");
  }

  const selected = choices.filter((choice) => choice.selected).length;

  if (selected > range.max) {
    throw new Error("[Draeven] A menu has more selected choices than max.");
  }

  return seal<MenuData>({
    kind: "menu",
    id: readId(options.id, "menu"),
    placeholder: readPlaceholder(options.placeholder, true),
    choices,
    min: range.min,
    max: range.max,
    disabled: readFlag(options.disabled, "disabled"),
    ...(options.press === undefined ? {} : { press: readPress(options.press) }),
  });
}

export function people(options: PickerOptions): People {
  return picker<PeopleData>("people", options);
}

export function roles(options: PickerOptions): Roles {
  return picker<RolesData>("roles", options);
}

export function channels(options: ChannelOptions): Channels {
  return picker<ChannelsData>("channels", options, readKinds(options.kinds));
}

export function mentions(options: PickerOptions): Mentions {
  return picker<MentionsData>("mentions", options);
}

/* Up to five buttons, links, and SKUs. A menu takes the row alone. */
export function row(...parts: readonly AnyPiece[]): Row {
  if (parts.length < 1) {
    throw new Error("[Draeven] A row needs a button, a link, or a menu.");
  }

  if (parts.length > 5) {
    throw new Error("[Draeven] A row holds up to 5 buttons.");
  }

  const pieces = parts.map(readPiece);
  const menus = pieces.filter(isMenuPiece);

  if (menus.length > 0 && pieces.length > 1) {
    throw new Error("[Draeven] A menu takes the whole row.");
  }

  const ids = new Set<string>();

  for (const piece of pieces) {
    if (!("id" in piece) || piece.kind === "sku") {
      continue;
    }

    if (ids.has(piece.id)) {
      throw new Error(`[Draeven] ${piece.id} is used more than once.`);
    }

    ids.add(piece.id);
  }

  return seal<RowData>({ kind: "row", pieces });
}

/* A popup. One to five fields, each short or long. */
export function form(options: FormOptions): Form {
  const title = options.title.trim();

  if (!title || title.length > 45) {
    throw new Error("[Draeven] A form title must be 1-45 characters.");
  }

  if (options.fields.length < 1 || options.fields.length > 5) {
    throw new Error("[Draeven] A form has 1-5 fields.");
  }

  const id = readId(options.id, "form");
  const fields = options.fields.map(readField);
  const ids = new Set<string>([id]);

  for (const field of fields) {
    if (ids.has(field.id)) {
      throw new Error(`[Draeven] ${field.id} is used more than once.`);
    }

    ids.add(field.id);
  }

  return seal<FormData>({
    kind: "form",
    id,
    title,
    fields,
    ...(options.submit === undefined ? {} : { submit: readPress(options.submit) }),
  });
}

export function isRow(value: unknown): value is Row {
  return marked(value, "row");
}

export function isForm(value: unknown): value is Form {
  return marked(value, "form");
}

export function assertReplyParts(
  rows: readonly Row[] | undefined,
  form: Form | undefined
): void {
  if (rows !== undefined && (rows.length < 1 || rows.length > 5)) {
    throw new Error("[Draeven] A reply holds up to 5 rows.");
  }

  const ids = new Set<string>();

  for (const line of rows ?? []) {
    if (!isRow(line)) {
      throw new Error("[Draeven] A row comes from row().");
    }

    for (const piece of (line as RowData).pieces) {
      if (!("id" in piece) || piece.kind === "sku") {
        continue;
      }

      if (ids.has(piece.id)) {
        throw new Error(`[Draeven] ${piece.id} is used more than once.`);
      }

      ids.add(piece.id);
    }
  }

  if (form !== undefined && !isForm(form)) {
    throw new Error("[Draeven] A form comes from form().");
  }
}

export function actionsIn(reply: Reply): { id: string; run: Press }[] {
  const actions: { id: string; run: Press }[] = [];

  for (const line of reply.rows ?? []) {
    for (const piece of (line as RowData).pieces) {
      if ("press" in piece && piece.press) {
        actions.push({ id: piece.id, run: piece.press });
      }
    }
  }

  if (reply.form) {
    const data = reply.form as FormData;

    if (data.submit) {
      actions.push({ id: data.id, run: data.submit });
    }
  }

  return actions;
}

export function discordRows(rows: readonly Row[]): object[] {
  return rows.map((line) => ({
    type: 1,
    components: (line as RowData).pieces.map(discordPiece),
  }));
}

export function discordForm(form: Form): {
  custom_id: string;
  title: string;
  components: object[];
} {
  const data = form as FormData;

  return {
    custom_id: data.id,
    title: data.title,
    components: data.fields.map((field) => ({
      type: 1,
      components: [
        {
          type: 4,
          custom_id: field.id,
          label: field.label,
          style: field.style,
          required: field.required,
          ...(field.placeholder === undefined ? {} : { placeholder: field.placeholder }),
          ...(field.min === undefined ? {} : { min_length: field.min }),
          ...(field.max === undefined ? {} : { max_length: field.max }),
        },
      ],
    })),
  };
}

function picker<T extends PeopleData | RolesData | ChannelsData | MentionsData>(
  kind: T["kind"],
  options: PickerOptions,
  kinds?: number[]
): T {
  const range = readRange(options.min, options.max);

  return seal({
    kind,
    id: readId(options.id, "menu"),
    ...(options.placeholder === undefined
      ? {}
      : { placeholder: readPlaceholder(options.placeholder, false) }),
    min: range.min,
    max: range.max,
    disabled: readFlag(options.disabled, "disabled"),
    ...(kinds === undefined ? {} : { kinds }),
    ...(options.press === undefined ? {} : { press: readPress(options.press) }),
  }) as T;
}

function discordPiece(piece: PieceData): object {
  if (piece.kind === "button") {
    return {
      type: 2,
      style: buttonStyle[piece.color],
      label: piece.label,
      custom_id: piece.id,
      ...(piece.emoji === undefined ? {} : { emoji: piece.emoji }),
      ...(piece.disabled ? { disabled: true } : {}),
    };
  }

  if (piece.kind === "link") {
    return {
      type: 2,
      style: 5,
      label: piece.label,
      url: piece.url,
      ...(piece.emoji === undefined ? {} : { emoji: piece.emoji }),
      ...(piece.disabled ? { disabled: true } : {}),
    };
  }

  if (piece.kind === "sku") {
    return { type: 2, style: 6, sku_id: piece.id };
  }

  if (piece.kind === "menu") {
    return {
      type: 3,
      custom_id: piece.id,
      placeholder: piece.placeholder,
      min_values: piece.min,
      max_values: piece.max,
      options: piece.choices.map((choice) => ({
        label: choice.label,
        value: choice.value,
        ...(choice.description === undefined ? {} : { description: choice.description }),
        ...(choice.emoji === undefined ? {} : { emoji: choice.emoji }),
        ...(choice.selected ? { default: true } : {}),
      })),
      ...(piece.disabled ? { disabled: true } : {}),
    };
  }

  const type = piece.kind === "people" ? 5 : piece.kind === "roles" ? 6 : piece.kind === "mentions" ? 7 : 8;

  return {
    type,
    custom_id: piece.id,
    min_values: piece.min,
    max_values: piece.max,
    ...(piece.placeholder === undefined ? {} : { placeholder: piece.placeholder }),
    ...(piece.kinds === undefined ? {} : { channel_types: piece.kinds }),
    ...(piece.disabled ? { disabled: true } : {}),
  };
}

function readPiece(value: AnyPiece): PieceData {
  if (!owned.has(value)) {
    throw new Error("[Draeven] A row takes buttons, links, and menus from Draeven.");
  }

  return value as PieceData;
}

function isMenuPiece(piece: PieceData): boolean {
  return (
    piece.kind === "menu" ||
    piece.kind === "people" ||
    piece.kind === "roles" ||
    piece.kind === "channels" ||
    piece.kind === "mentions"
  );
}

function readChoice(choice: MenuChoice): ChoiceData {
  const label = readLabel(choice.label, "choice", 100);
  const value = choice.value.trim();

  if (!value || value.length > 100) {
    throw new Error("[Draeven] A choice value must be 1-100 characters.");
  }

  let description: string | undefined;

  if (choice.description !== undefined) {
    description = choice.description.trim();

    if (!description || description.length > 100) {
      throw new Error("[Draeven] A choice description must be 1-100 characters.");
    }
  }

  return {
    label,
    value,
    ...(description === undefined ? {} : { description }),
    ...(choice.emoji === undefined ? {} : { emoji: readEmoji(choice.emoji) }),
    selected: readFlag(choice.selected, "selected"),
  };
}

function readField(field: FormField): FieldData {
  const style = field.style ?? "short";

  if (style !== "short" && style !== "long") {
    throw new Error("[Draeven] A form field is short or long.");
  }

  let placeholder: string | undefined;

  if (field.placeholder !== undefined) {
    placeholder = field.placeholder.trim();

    if (!placeholder || placeholder.length > 100) {
      throw new Error("[Draeven] A form placeholder must be 1-100 characters.");
    }
  }

  if (field.min !== undefined && (!Number.isInteger(field.min) || field.min < 0 || field.min > 4000)) {
    throw new Error("[Draeven] A form field length is a whole number from 0 to 4000.");
  }

  if (field.max !== undefined && (!Number.isInteger(field.max) || field.max < 1 || field.max > 4000)) {
    throw new Error("[Draeven] A form field length is a whole number from 0 to 4000.");
  }

  if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
    throw new Error("[Draeven] A form field minimum is higher than its maximum.");
  }

  return {
    id: readId(field.id, "field"),
    label: readLabel(field.label, "field", 45),
    style: style === "long" ? 2 : 1,
    required: field.required === undefined ? true : readFlag(field.required, "required"),
    ...(placeholder === undefined ? {} : { placeholder }),
    ...(field.min === undefined ? {} : { min: field.min }),
    ...(field.max === undefined ? {} : { max: field.max }),
  };
}

function readKinds(kinds: readonly ChannelKind[] | undefined): number[] | undefined {
  if (kinds === undefined) {
    return undefined;
  }

  if (kinds.length < 1) {
    throw new Error("[Draeven] Leave kinds out, or name at least one channel kind.");
  }

  const seen = new Set<ChannelKind>();
  const types: number[] = [];

  for (const kind of kinds) {
    if (!(kind in channelType)) {
      throw new Error(
        "[Draeven] A channel kind is text, voice, category, announcement, announcement thread, thread, private thread, stage, forum, or media."
      );
    }

    if (seen.has(kind)) {
      throw new Error(`[Draeven] Channel kind ${kind} is listed twice.`);
    }

    seen.add(kind);
    types.push(channelType[kind]);
  }

  return types;
}

function readRange(min: number | undefined, max: number | undefined): { min: number; max: number } {
  const low = min ?? 1;
  const high = max ?? 1;

  if (
    !Number.isInteger(low) ||
    !Number.isInteger(high) ||
    low < 0 ||
    high < 1 ||
    high > 25 ||
    low > high
  ) {
    throw new Error(
      "[Draeven] A menu's min and max are whole numbers, min from 0, max from 1 to 25, and min at most max."
    );
  }

  return { min: low, max: high };
}

function readId(id: string, what: string): string {
  const trimmed = id.trim();

  if (!trimmed || trimmed.length > 100 || /[\r\n]/.test(trimmed)) {
    throw new Error(`[Draeven] A ${what} id must be 1-100 characters.`);
  }

  return trimmed;
}

function readLabel(label: string, what: string, max: number): string {
  const trimmed = label.trim();

  if (!trimmed || trimmed.length > max) {
    throw new Error(`[Draeven] A ${what} label must be 1-${max} characters.`);
  }

  return trimmed;
}

function readPlaceholder(placeholder: string, required: boolean): string {
  const trimmed = placeholder.trim();

  if (!trimmed || trimmed.length > 150) {
    throw new Error(
      required
        ? "[Draeven] A menu placeholder must be 1-150 characters."
        : "[Draeven] A placeholder must be 1-150 characters."
    );
  }

  return trimmed;
}

function readUrl(url: string): string {
  if (url.length > 512) {
    throw new Error("[Draeven] A link url must be 1-512 characters.");
  }

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    throw new Error("[Draeven] A link needs an http or https url.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("[Draeven] A link needs an http or https url.");
  }

  return url;
}

function readEmoji(emoji: string): { name: string; id?: string; animated?: boolean } {
  const trimmed = emoji.trim();
  const custom = /^<(a)?:([A-Za-z0-9_]{2,32}):(\d{1,20})>$/.exec(trimmed);

  if (custom?.[2] && custom[3]) {
    return {
      name: custom[2],
      id: custom[3],
      ...(custom[1] ? { animated: true } : {}),
    };
  }

  if (!trimmed || trimmed.length > 80 || /[\r\n]/.test(trimmed)) {
    throw new Error("[Draeven] An emoji is a unicode emoji or <:name:id>.");
  }

  return { name: trimmed };
}

function readFlag(value: boolean | undefined, name: string): boolean {
  if (value === undefined) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new Error(`[Draeven] ${name} must be true or false.`);
  }

  return value;
}

function readPress(press: Press): Press {
  if (typeof press !== "function") {
    throw new Error("[Draeven] press must be a function.");
  }

  return press;
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
