/* Draeven Core: slash-command options a bot author writes */

import type { ChannelKind } from "./pieces.js";
import type { Channel, File, Role, User } from "./lookup.js";
import type { SuggestHandler } from "./suggest.js";

/* Stored on the command after required() has been applied. */

export interface UserOption {
  readonly kind: "user";
  readonly question: string;
  readonly required: boolean;
}

export interface TextOption {
  readonly kind: "text";
  readonly question: string;
  readonly required: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly suggest?: SuggestHandler;
}

export interface NumberOption {
  readonly kind: "number";
  readonly question: string;
  readonly required: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly suggest?: SuggestHandler;
}

export interface ChoiceItem {
  readonly label: string;
  readonly value: string;
  readonly note?: string;
}

export interface ChoiceOption {
  readonly kind: "choice";
  readonly question: string;
  readonly required: boolean;
  readonly choices: readonly ChoiceItem[];
}

export interface ChannelOption {
  readonly kind: "channel";
  readonly question: string;
  readonly required: boolean;
  readonly kinds?: readonly ChannelKind[];
}

export interface RoleOption {
  readonly kind: "role";
  readonly question: string;
  readonly required: boolean;
}

export interface FileOption {
  readonly kind: "file";
  readonly question: string;
  readonly required: boolean;
}

export interface FlagOption {
  readonly kind: "flag";
  readonly question: string;
  readonly required: boolean;
}

export interface MentionableOption {
  readonly kind: "mentionable";
  readonly question: string;
  readonly required: boolean;
}

/** A user or a role from mentionable(). Tell them apart with `"bot" in value`. */
export type Mentionable = User | Role;

export type StoredOption =
  | UserOption
  | TextOption
  | NumberOption
  | ChoiceOption
  | ChannelOption
  | RoleOption
  | FileOption
  | FlagOption
  | MentionableOption;

/* Used while writing. isRequired does not clash with the required() method. */

export interface UserOptionDraft<R extends boolean = boolean> {
  readonly kind: "user";
  readonly question: string;
  readonly isRequired: R;
}

export interface TextOptionDraft<R extends boolean = boolean> {
  readonly kind: "text";
  readonly question: string;
  readonly isRequired: R;
  readonly min?: number;
  readonly max?: number;
  readonly suggestHandler?: SuggestHandler;
}

export interface NumberOptionDraft<R extends boolean = boolean> {
  readonly kind: "number";
  readonly question: string;
  readonly isRequired: R;
  readonly min?: number;
  readonly max?: number;
  readonly suggestHandler?: SuggestHandler;
}

export interface ChoiceOptionDraft<R extends boolean = boolean> {
  readonly kind: "choice";
  readonly question: string;
  readonly isRequired: R;
  readonly choices: readonly ChoiceItem[];
}

export interface ChannelOptionDraft<R extends boolean = boolean> {
  readonly kind: "channel";
  readonly question: string;
  readonly isRequired: R;
  readonly kinds?: readonly ChannelKind[];
}

export interface RoleOptionDraft<R extends boolean = boolean> {
  readonly kind: "role";
  readonly question: string;
  readonly isRequired: R;
}

export interface FileOptionDraft<R extends boolean = boolean> {
  readonly kind: "file";
  readonly question: string;
  readonly isRequired: R;
}

export interface FlagOptionDraft<R extends boolean = boolean> {
  readonly kind: "flag";
  readonly question: string;
  readonly isRequired: R;
}

export interface MentionableOptionDraft<R extends boolean = boolean> {
  readonly kind: "mentionable";
  readonly question: string;
  readonly isRequired: R;
}

type AnyDraft =
  | UserOptionDraft<boolean>
  | TextOptionDraft<boolean>
  | NumberOptionDraft<boolean>
  | ChoiceOptionDraft<boolean>
  | ChannelOptionDraft<boolean>
  | RoleOptionDraft<boolean>
  | FileOptionDraft<boolean>
  | FlagOptionDraft<boolean>
  | MentionableOptionDraft<boolean>;

export type OptionMap = Record<string, AnyDraft>;

type OptionValue<O> = O extends UserOptionDraft<infer R>
  ? R extends true
    ? User
    : User | undefined
  : O extends TextOptionDraft<infer R>
    ? R extends true
      ? string
      : string | undefined
    : O extends NumberOptionDraft<infer R>
      ? R extends true
        ? number
        : number | undefined
      : O extends ChoiceOptionDraft<infer R>
        ? R extends true
          ? string
          : string | undefined
        : O extends ChannelOptionDraft<infer R>
          ? R extends true
            ? Channel
            : Channel | undefined
          : O extends RoleOptionDraft<infer R>
            ? R extends true
              ? Role
              : Role | undefined
            : O extends FileOptionDraft<infer R>
              ? R extends true
                ? File
                : File | undefined
              : O extends FlagOptionDraft<infer R>
                ? R extends true
                  ? boolean
                  : boolean | undefined
                : O extends MentionableOptionDraft<infer R>
                  ? R extends true
                    ? Mentionable
                    : Mentionable | undefined
                  : never;

export type OptOf<TOptions extends OptionMap> = {
  [K in keyof TOptions]: OptionValue<TOptions[K]>;
};

export interface TextLimits {
  /** Minimum characters Discord accepts. */
  min?: number;
  /** Maximum characters Discord accepts. */
  max?: number;
}

export interface NumberLimits {
  /** Lowest number Discord accepts. */
  min?: number;
  /** Highest number Discord accepts. */
  max?: number;
}

export interface ChannelLimits {
  /** Leave this out to allow every kind. */
  kinds?: readonly ChannelKind[];
}

export type ChoiceInput = string | { label: string; value: string; note?: string };

/* Ask for a user. Without required() the answer may be left empty. */
export function user(question: string): UserOptionDraft<false> & {
  required(): UserOptionDraft<true>;
} {
  const trimmed = readQuestion(question, "user");

  return {
    kind: "user",
    question: trimmed,
    isRequired: false,
    required() {
      return { kind: "user", question: trimmed, isRequired: true };
    },
  };
}

/* Ask for free text. */
export function text(question: string, limits?: TextLimits): TextDraft<false> {
  const trimmed = readQuestion(question, "text");
  const range = readTextLimits(limits);

  return textDraft(trimmed, false, range);
}

/* Ask for a whole number. */
export function number(question: string, limits?: NumberLimits): NumberDraft<false> {
  const trimmed = readQuestion(question, "number");
  const range = readNumberLimits(limits);

  return numberDraft(trimmed, false, range);
}

/* Ask the caller to pick one listed value. */
export function choice(
  question: string,
  choices: readonly ChoiceInput[]
): ChoiceOptionDraft<false> & { required(): ChoiceOptionDraft<true> } {
  const trimmed = readQuestion(question, "choice");
  const stored = readChoices(choices);

  return {
    kind: "choice",
    question: trimmed,
    isRequired: false,
    choices: stored,
    required() {
      return {
        kind: "choice",
        question: trimmed,
        isRequired: true,
        choices: stored,
      };
    },
  };
}

/* Ask for a channel. */
export function channel(
  question: string,
  limits?: ChannelLimits
): ChannelOptionDraft<false> & { required(): ChannelOptionDraft<true> } {
  const trimmed = readQuestion(question, "channel");
  const kinds = readChannelKinds(limits?.kinds);

  return {
    kind: "channel",
    question: trimmed,
    isRequired: false,
    ...(kinds ? { kinds } : {}),
    required() {
      return {
        kind: "channel",
        question: trimmed,
        isRequired: true,
        ...(kinds ? { kinds } : {}),
      };
    },
  };
}

/* Ask for a role. */
export function role(question: string): RoleOptionDraft<false> & {
  required(): RoleOptionDraft<true>;
} {
  const trimmed = readQuestion(question, "role");

  return {
    kind: "role",
    question: trimmed,
    isRequired: false,
    required() {
      return { kind: "role", question: trimmed, isRequired: true };
    },
  };
}

/* Ask for an uploaded file. */
export function file(question: string): FileOptionDraft<false> & {
  required(): FileOptionDraft<true>;
} {
  const trimmed = readQuestion(question, "file");

  return {
    kind: "file",
    question: trimmed,
    isRequired: false,
    required() {
      return { kind: "file", question: trimmed, isRequired: true };
    },
  };
}

/* Ask a yes/no question. */
export function flag(question: string): FlagOptionDraft<false> & {
  required(): FlagOptionDraft<true>;
} {
  const trimmed = readQuestion(question, "flag");

  return {
    kind: "flag",
    question: trimmed,
    isRequired: false,
    required() {
      return { kind: "flag", question: trimmed, isRequired: true };
    },
  };
}

/* Ask for a user or a role. */
export function mentionable(question: string): MentionableOptionDraft<false> & {
  required(): MentionableOptionDraft<true>;
} {
  const trimmed = readQuestion(question, "mentionable");

  return {
    kind: "mentionable",
    question: trimmed,
    isRequired: false,
    required() {
      return { kind: "mentionable", question: trimmed, isRequired: true };
    },
  };
}

type TextDraft<R extends boolean> = TextOptionDraft<R> & {
  required(): TextDraft<true>;
  suggest(handler: SuggestHandler): TextDraft<R>;
};

type NumberDraft<R extends boolean> = NumberOptionDraft<R> & {
  required(): NumberDraft<true>;
  suggest(handler: SuggestHandler): NumberDraft<R>;
};

function textDraft<R extends boolean>(
  question: string,
  isRequired: R,
  range: { min?: number; max?: number },
  suggest?: SuggestHandler
): TextDraft<R> {
  return {
    kind: "text",
    question,
    isRequired,
    ...range,
    ...(suggest ? { suggestHandler: suggest } : {}),
    required() {
      return textDraft(question, true, range, suggest);
    },
    suggest(handler: SuggestHandler) {
      return textDraft(question, isRequired, range, handler);
    },
  };
}

function numberDraft<R extends boolean>(
  question: string,
  isRequired: R,
  range: { min?: number; max?: number },
  suggest?: SuggestHandler
): NumberDraft<R> {
  return {
    kind: "number",
    question,
    isRequired,
    ...range,
    ...(suggest ? { suggestHandler: suggest } : {}),
    required() {
      return numberDraft(question, true, range, suggest);
    },
    suggest(handler: SuggestHandler) {
      return numberDraft(question, isRequired, range, handler);
    },
  };
}

const COMMAND_NAME = /^[a-z0-9-]{1,32}$/;

/* These names already exist on the command context. */
const RESERVED_OPTION_NAMES = new Set([
  "author",
  "opt",
  "reply",
  "followup",
  "send",
  "wait",
  "edit",
  "remove",
  "collect",
  "locale",
  "getuser",
  "getmember",
  "getbot",
  "getguild",
  "getchannel",
  "getrole",
  "getroles",
  "getfile",
  "transcript",
]);

const CHANNEL_KIND_SET = new Set<ChannelKind>([
  "text",
  "voice",
  "category",
  "announcement",
  "announcement thread",
  "thread",
  "private thread",
  "stage",
  "forum",
  "media",
]);

/* Store only the data, not the required() helper. */
export function storeOptions(options: OptionMap): Record<string, StoredOption> {
  const stored: Record<string, StoredOption> = {};

  for (const [key, option] of Object.entries(options)) {
    if (!COMMAND_NAME.test(key)) {
      throw new Error(
        "[Draeven] Option name must be 1-32 characters: lowercase letters, numbers, or hyphens."
      );
    }

    if (RESERVED_OPTION_NAMES.has(key)) {
      throw new Error(`[Draeven] Option name ${key} is reserved.`);
    }

    stored[key] = storeOne(option);
  }

  return stored;
}

function storeOne(option: AnyDraft): StoredOption {
  if (typeof option.isRequired !== "boolean") {
    throw new Error("[Draeven] Unknown command option.");
  }

  switch (option.kind) {
    case "user":
      return {
        kind: "user",
        question: option.question,
        required: option.isRequired,
      };
    case "text":
      return {
        kind: "text",
        question: option.question,
        required: option.isRequired,
        ...(option.min === undefined ? {} : { min: option.min }),
        ...(option.max === undefined ? {} : { max: option.max }),
        ...(option.suggestHandler ? { suggest: option.suggestHandler } : {}),
      };
    case "number":
      return {
        kind: "number",
        question: option.question,
        required: option.isRequired,
        ...(option.min === undefined ? {} : { min: option.min }),
        ...(option.max === undefined ? {} : { max: option.max }),
        ...(option.suggestHandler ? { suggest: option.suggestHandler } : {}),
      };
    case "choice":
      return {
        kind: "choice",
        question: option.question,
        required: option.isRequired,
        choices: option.choices,
      };
    case "channel":
      return {
        kind: "channel",
        question: option.question,
        required: option.isRequired,
        ...(option.kinds ? { kinds: option.kinds } : {}),
      };
    case "role":
      return {
        kind: "role",
        question: option.question,
        required: option.isRequired,
      };
    case "file":
      return {
        kind: "file",
        question: option.question,
        required: option.isRequired,
      };
    case "flag":
      return {
        kind: "flag",
        question: option.question,
        required: option.isRequired,
      };
    case "mentionable":
      return {
        kind: "mentionable",
        question: option.question,
        required: option.isRequired,
      };
    default:
      throw new Error("[Draeven] Unknown command option.");
  }
}

function readQuestion(question: string, kind: string): string {
  if (typeof question !== "string") {
    throw new Error(`[Draeven] A ${kind} option question must be 1-100 characters.`);
  }

  const trimmed = question.trim();

  if (!trimmed || trimmed.length > 100) {
    throw new Error(`[Draeven] A ${kind} option question must be 1-100 characters.`);
  }

  return trimmed;
}

function readTextLimits(limits: TextLimits | undefined): { min?: number; max?: number } {
  if (!limits) {
    return {};
  }

  const min = limits.min;
  const max = limits.max;

  if (min !== undefined && (!Number.isInteger(min) || min < 0 || min > 6000)) {
    throw new Error("[Draeven] A text option min must be an integer from 0 to 6000.");
  }

  if (max !== undefined && (!Number.isInteger(max) || max < 1 || max > 6000)) {
    throw new Error("[Draeven] A text option max must be an integer from 1 to 6000.");
  }

  if (min !== undefined && max !== undefined && min > max) {
    throw new Error("[Draeven] A text option min cannot be greater than max.");
  }

  return {
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  };
}

function readNumberLimits(limits: NumberLimits | undefined): { min?: number; max?: number } {
  if (!limits) {
    return {};
  }

  const min = limits.min;
  const max = limits.max;

  if (min !== undefined && !Number.isFinite(min)) {
    throw new Error("[Draeven] A number option min must be a finite number.");
  }

  if (max !== undefined && !Number.isFinite(max)) {
    throw new Error("[Draeven] A number option max must be a finite number.");
  }

  if (min !== undefined && max !== undefined && min > max) {
    throw new Error("[Draeven] A number option min cannot be greater than max.");
  }

  return {
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
  };
}

function readChoices(choices: readonly ChoiceInput[]): ChoiceItem[] {
  if (!Array.isArray(choices) || choices.length < 1 || choices.length > 25) {
    throw new Error("[Draeven] A choice option needs 1-25 choices.");
  }

  const seen = new Set<string>();
  const stored: ChoiceItem[] = [];

  for (const entry of choices) {
    const item = readChoice(entry);

    if (seen.has(item.value)) {
      throw new Error(`[Draeven] Choice value ${item.value} is listed twice.`);
    }

    seen.add(item.value);
    stored.push(item);
  }

  return stored;
}

function readChoice(entry: ChoiceInput): ChoiceItem {
  if (typeof entry === "string") {
    const value = entry.trim();

    if (!value || value.length > 100) {
      throw new Error("[Draeven] A choice value must be 1-100 characters.");
    }

    return { label: value, value };
  }

  if (typeof entry !== "object" || entry === null) {
    throw new Error("[Draeven] A choice is a string, or { label, value }.");
  }

  const label = typeof entry.label === "string" ? entry.label.trim() : "";
  const value = typeof entry.value === "string" ? entry.value.trim() : "";

  if (!label || label.length > 100) {
    throw new Error("[Draeven] A choice label must be 1-100 characters.");
  }

  if (!value || value.length > 100) {
    throw new Error("[Draeven] A choice value must be 1-100 characters.");
  }

  const note =
    entry.note === undefined
      ? undefined
      : typeof entry.note === "string"
        ? entry.note.trim()
        : "";

  if (note !== undefined && (!note || note.length > 100)) {
    throw new Error("[Draeven] A choice note must be 1-100 characters.");
  }

  return {
    label,
    value,
    ...(note ? { note } : {}),
  };
}

function readChannelKinds(
  kinds: readonly ChannelKind[] | undefined
): readonly ChannelKind[] | undefined {
  if (kinds === undefined) {
    return undefined;
  }

  if (kinds.length < 1) {
    throw new Error("[Draeven] Leave kinds out, or name at least one channel kind.");
  }

  const seen = new Set<ChannelKind>();
  const stored: ChannelKind[] = [];

  for (const kind of kinds) {
    if (!CHANNEL_KIND_SET.has(kind)) {
      throw new Error(
        "[Draeven] A channel kind is text, voice, category, announcement, announcement thread, thread, private thread, stage, forum, or media."
      );
    }

    if (seen.has(kind)) {
      throw new Error(`[Draeven] Channel kind ${kind} is listed twice.`);
    }

    seen.add(kind);
    stored.push(kind);
  }

  return stored;
}
