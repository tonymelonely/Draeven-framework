/* Draeven Core: commands a bot author writes */

import { isCanvas, type Canvas } from "./canvas.js";
import { isEmbed, type Embed } from "./embed.js";
import {
  createLookups,
  type CommandWorld,
  type Lookups,
  type UserRef,
} from "./lookup.js";
import { commandMark } from "./marks.js";
import {
  storeOptions,
  type OptionMap,
  type OptOf,
  type StoredOption,
} from "./options.js";
import { isLayout, type Layout } from "./layout.js";
import {
  assertReplyParts,
  isForm,
  isRow,
  type Form,
  type Message,
  type Press,
  type PressContext,
  type Reply,
  type ReplyOptions,
  type Row,
} from "./pieces.js";
import type { ChannelRef } from "./lookup.js";
import { isMeta, type CommandMeta } from "./meta.js";
import { isPoll, type Poll } from "./poll.js";
import {
  isSubMap,
  storeSubs,
  type StoredBranch,
  type SubMap,
} from "./subcommands.js";
import { isTranscript, type TranscriptFile, type TranscriptOptions } from "./transcript.js";

export type { Message, Reply };
export { poll, isPoll } from "./poll.js";
export type { Poll, PollAnswer, PollOptions } from "./poll.js";
export {
  album,
  beside,
  divide,
  isLayout,
  layout,
  pack,
  show,
  showFile,
  thumb,
  COMPONENTS_V2,
} from "./layout.js";
export type {
  Album,
  AlbumItem,
  Beside,
  Divide,
  Layout,
  LayoutPart,
  Pack,
  Show,
  ShowFile,
  Thumb,
} from "./layout.js";
export {
  channel,
  choice,
  file,
  flag,
  mentionable,
  number,
  role,
  text,
  user,
} from "./options.js";
export type {
  ChannelOption,
  ChoiceItem,
  ChoiceOption,
  FileOption,
  FlagOption,
  Mentionable,
  MentionableOption,
  NumberOption,
  RoleOption,
  StoredOption,
  TextOption,
  UserOption,
} from "./options.js";
export { group, sub } from "./subcommands.js";
export type { StoredBranch, StoredGroup, StoredSub } from "./subcommands.js";
export { messageMenu, userMenu, isMenu } from "./menus.js";
export type { MenuCommand, MessageMenu, MessageRef, UserMenu } from "./menus.js";
export type {
  CommandCooldown,
  CommandInstall,
  CommandMeta,
  CommandPlace,
  CooldownScope,
  PermissionName,
} from "./meta.js";

/*
 * One ctx object for every command run.
 *
 * Prefer a single parameter and destructure what you need:
 *   async (ctx) => {
 *     const { who, author, getUser, reply } = ctx;
 *     return reply((who ?? getUser(author)).name);
 *   }
 *
 * Option names sit on ctx next to author.
 * Profiles, the bot, the guild, the channel, and roles come from the lookups.
 */
export type CommandContext<TOpt> = Lookups & {
  author: UserRef;
  opt: TOpt;
  transcript(options?: TranscriptOptions): Promise<TranscriptFile>;
  /** Tell Discord the bot is working. Later reply() edits that placeholder. */
  wait(options?: ReplyOptions): Promise<void>;
  /** Replace the deferred or already-sent reply. */
  edit(text: string, options?: ReplyOptions): Promise<void>;
  edit(card: Embed, options?: ReplyOptions): Promise<void>;
  edit(text: string, card: Embed, options?: ReplyOptions): Promise<void>;
  edit(part: Row | Canvas | Form | TranscriptFile | Poll | Layout | Message, options?: ReplyOptions): Promise<void>;
  /** Delete the interaction reply. */
  remove(): Promise<void>;
  reply(text: string, options?: ReplyOptions): Reply;
  reply(card: Embed, options?: ReplyOptions): Reply;
  reply(text: string, card: Embed, options?: ReplyOptions): Reply;
  reply(part: Row | Canvas | Form | TranscriptFile | Poll | Layout, options?: ReplyOptions): Reply;
  reply(message: Message): Reply;
  followup(text: string, options?: ReplyOptions): Promise<Reply>;
  followup(card: Embed, options?: ReplyOptions): Promise<Reply>;
  followup(text: string, card: Embed, options?: ReplyOptions): Promise<Reply>;
  followup(part: Row | Canvas | Form | TranscriptFile | Poll | Layout, options?: ReplyOptions): Promise<Reply>;
  followup(message: Message): Promise<Reply>;
  send(
    channel: ChannelRef | string,
    text: string,
    options?: ReplyOptions
  ): Promise<void>;
  send(channel: ChannelRef | string, card: Embed, options?: ReplyOptions): Promise<void>;
  send(
    channel: ChannelRef | string,
    text: string,
    card: Embed,
    options?: ReplyOptions
  ): Promise<void>;
  send(
    channel: ChannelRef | string,
    part: Row | Canvas | Form | TranscriptFile | Poll | Layout | Message,
    options?: ReplyOptions
  ): Promise<void>;
} & TOpt;

/*
 * TOpt is fixed where you write the command.
 * Start keeps those commands together in one list.
 */
export interface Command<TOpt = any> {
  readonly kind: "slash";
  readonly name: string;
  readonly description: string;
  readonly options: Readonly<Record<string, StoredOption>>;
  readonly subs: Readonly<Record<string, StoredBranch>>;
  readonly meta?: CommandMeta;
  run?(ctx: CommandContext<TOpt>): Reply | Promise<Reply>;
}

export function isCommand(value: unknown): value is Command {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[commandMark] === true &&
    "kind" in value &&
    value.kind === "slash" &&
    "name" in value &&
    "description" in value &&
    "options" in value &&
    "subs" in value
  );
}

type CommandRunner<TOpt> = (
  ctx: CommandContext<TOpt>
) => Reply | Promise<Reply>;

const COMMAND_NAME = /^[a-z0-9-]{1,32}$/;

type NoOptions = {};

export function command(
  name: string,
  description: string,
  run: CommandRunner<NoOptions>,
  meta?: CommandMeta
): Command<NoOptions>;
export function command<const TOptions extends OptionMap>(
  name: string,
  description: string,
  options: TOptions,
  run: CommandRunner<OptOf<TOptions>>,
  meta?: CommandMeta
): Command<OptOf<TOptions>>;
export function command(
  name: string,
  description: string,
  subs: SubMap,
  meta?: CommandMeta
): Command;
export function command(
  name: string,
  description: string,
  optionsOrRunOrSubs: OptionMap | SubMap | CommandRunner<NoOptions>,
  maybeRunOrMeta?: CommandRunner<OptOf<OptionMap>> | CommandMeta,
  maybeMeta?: CommandMeta
): Command {
  const commandName = name.trim();

  if (!COMMAND_NAME.test(commandName)) {
    throw new Error(
      "[Draeven] Command name must be 1-32 characters: lowercase letters, numbers, or hyphens."
    );
  }

  const commandDescription = description.trim();

  if (!commandDescription || commandDescription.length > 100) {
    throw new Error("[Draeven] Command description must be 1-100 characters.");
  }

  if (typeof optionsOrRunOrSubs === "function") {
    const meta =
      maybeRunOrMeta && isMeta(maybeRunOrMeta) ? maybeRunOrMeta : undefined;

    return markCommand({
      kind: "slash",
      name: commandName,
      description: commandDescription,
      options: {},
      subs: {},
      ...(meta ? { meta } : {}),
      run: optionsOrRunOrSubs,
    });
  }

  if (isSubMap(optionsOrRunOrSubs)) {
    const meta =
      maybeRunOrMeta && isMeta(maybeRunOrMeta) ? maybeRunOrMeta : undefined;

    if (maybeRunOrMeta && !meta && typeof maybeRunOrMeta === "function") {
      throw new Error("[Draeven] A command with subcommands has no top-level run.");
    }

    return markCommand({
      kind: "slash",
      name: commandName,
      description: commandDescription,
      options: {},
      subs: storeSubs(optionsOrRunOrSubs),
      ...(meta ? { meta } : {}),
    });
  }

  if (typeof maybeRunOrMeta !== "function") {
    throw new Error("[Draeven] A command needs a run function.");
  }

  const meta = maybeMeta && isMeta(maybeMeta) ? maybeMeta : undefined;

  return markCommand({
    kind: "slash",
    name: commandName,
    description: commandDescription,
    options: storeOptions(optionsOrRunOrSubs),
    subs: {},
    ...(meta ? { meta } : {}),
    run: maybeRunOrMeta,
  });
}

function markCommand<TOpt>(entry: Command<TOpt>): Command<TOpt> {
  Object.defineProperty(entry, commandMark, {
    value: true,
    enumerable: false,
  });
  return entry;
}

type ReplyBody =
  | string
  | Embed
  | Message
  | Row
  | Canvas
  | Form
  | TranscriptFile
  | Poll
  | Layout;

/** Build a Reply the same way ctx.reply does. */
export function buildReply(
  message: ReplyBody,
  cardOrOptions?: Embed | ReplyOptions,
  maybeOptions?: ReplyOptions
): Reply {
  return readReply(message, cardOrOptions, maybeOptions);
}

function readReply(
  message: ReplyBody,
  cardOrOptions?: Embed | ReplyOptions,
  maybeOptions?: ReplyOptions
): Reply {
  if (typeof message === "string") {
    const text = readText(message);

    if (cardOrOptions === undefined) {
      return { text };
    }

    if (isEmbed(cardOrOptions)) {
      return markPrivate(carried(cardOrOptions, { text }), maybeOptions);
    }

    if (isReplyOptions(cardOrOptions)) {
      return markPrivate({ text }, cardOrOptions);
    }

    throw new Error("[Draeven] A reply takes text, an embed, or text and an embed.");
  }

  if (isReplyOptions(cardOrOptions) && maybeOptions === undefined) {
    return markPrivate(readReplyBody(message), cardOrOptions);
  }

  if (cardOrOptions !== undefined) {
    throw new Error("[Draeven] A reply takes text, an embed, or text and an embed.");
  }

  return readReplyBody(message);
}

function readReplyBody(message: Exclude<ReplyBody, string>): Reply {
  if (isEmbed(message)) {
    return carried(message, {});
  }

  if (isRow(message)) {
    const reply = { rows: [message] };
    assertReplyParts(reply.rows, undefined);
    return reply;
  }

  if (isCanvas(message)) {
    return { picture: message };
  }

  if (isForm(message)) {
    return { form: message };
  }

  if (isTranscript(message)) {
    return { text: message.note, file: message };
  }

  if (isPoll(message)) {
    return { poll: message };
  }

  if (isLayout(message)) {
    return { layout: message };
  }

  return readMessage(message);
}

function readMessage(value: object): Reply {
  for (const key of Object.keys(value)) {
    if (
      key !== "text" &&
      key !== "card" &&
      key !== "rows" &&
      key !== "picture" &&
      key !== "form" &&
      key !== "poll" &&
      key !== "layout" &&
      key !== "private"
    ) {
      throw new Error(
        "[Draeven] A reply can use text, card, rows, picture, form, poll, layout, and private."
      );
    }
  }

  const bag = value as Message;
  const text = bag.text === undefined ? undefined : readText(bag.text);
  const options: ReplyOptions | undefined =
    bag.private === undefined ? undefined : { private: bag.private };

  if (bag.card !== undefined && !isEmbed(bag.card)) {
    throw new Error("[Draeven] A card comes from embed().");
  }

  if (bag.picture !== undefined && !isCanvas(bag.picture)) {
    throw new Error("[Draeven] A picture comes from canvas().");
  }

  if (bag.poll !== undefined && !isPoll(bag.poll)) {
    throw new Error("[Draeven] A poll comes from poll().");
  }

  if (bag.layout !== undefined && !isLayout(bag.layout)) {
    throw new Error("[Draeven] A layout comes from layout().");
  }

  if (bag.form !== undefined && (text !== undefined || bag.card || bag.rows || bag.picture || bag.poll || bag.layout)) {
    throw new Error("[Draeven] A form is the whole reply.");
  }

  if (bag.poll !== undefined && (text !== undefined || bag.card || bag.rows || bag.picture || bag.layout)) {
    throw new Error("[Draeven] A poll is the whole reply.");
  }

  if (bag.layout !== undefined && (text !== undefined || bag.card || bag.picture || bag.poll)) {
    throw new Error("[Draeven] A layout cannot mix with text, embeds, or polls.");
  }

  if (bag.rows !== undefined && !Array.isArray(bag.rows)) {
    throw new Error("[Draeven] A row comes from row().");
  }

  if (bag.poll && options?.private) {
    throw new Error("[Draeven] A poll cannot be private.");
  }

  if (bag.layout) {
    return markPrivate(
      {
        layout: bag.layout,
        ...(bag.rows === undefined ? {} : { rows: bag.rows }),
      },
      options
    );
  }

  if (bag.poll) {
    return { poll: bag.poll };
  }

  return markPrivate(
    carried(bag.card, {
      ...(text === undefined ? {} : { text }),
      ...(bag.rows === undefined ? {} : { rows: bag.rows }),
      ...(bag.picture === undefined ? {} : { picture: bag.picture }),
      ...(bag.form === undefined ? {} : { form: bag.form }),
    }),
    options
  );
}

/* Rows and a picture on the card travel with the reply. */
function carried(
  card: Embed | undefined,
  extra: { text?: string; rows?: readonly Row[]; picture?: Canvas; form?: Form; file?: TranscriptFile }
): Reply {
  if (extra.picture !== undefined && card?.picture !== undefined) {
    throw new Error("[Draeven] A reply has one picture.");
  }

  const rows = [...(card?.rows ?? []), ...(extra.rows ?? [])];
  const picture = extra.picture ?? card?.picture;
  const reply: Reply = {
    ...(extra.text === undefined ? {} : { text: extra.text }),
    ...(card === undefined ? {} : { embed: card }),
    ...(rows.length > 0 ? { rows } : {}),
    ...(picture === undefined ? {} : { picture }),
    ...(extra.form === undefined ? {} : { form: extra.form }),
    ...(extra.file === undefined ? {} : { file: extra.file }),
  };

  if (!reply.text && !reply.embed && !reply.rows && !reply.picture && !reply.form && !reply.file) {
    throw new Error(
      "[Draeven] A reply needs text, an embed, a row, a picture, a form, a poll, or a layout."
    );
  }

  assertReplyParts(reply.rows, reply.form);
  return reply;
}

function markPrivate(reply: Reply, options?: ReplyOptions): Reply {
  if (!options?.private) {
    return reply;
  }

  if (reply.poll) {
    throw new Error("[Draeven] A poll cannot be private.");
  }

  if (reply.form) {
    throw new Error("[Draeven] A form cannot be private.");
  }

  return { ...reply, private: true };
}

function isReplyOptions(value: unknown): value is ReplyOptions {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  if (isEmbed(value) || isRow(value) || isCanvas(value) || isForm(value) || isTranscript(value) || isPoll(value) || isLayout(value)) {
    return false;
  }

  for (const key of Object.keys(value)) {
    if (key !== "private") {
      return false;
    }
  }

  const bag = value as ReplyOptions;
  return bag.private === undefined || typeof bag.private === "boolean";
}

function readText(text: string): string {
  if (typeof text !== "string") {
    throw new Error("[Draeven] A reply must be 1-2000 characters.");
  }

  const trimmed = text.trim();

  if (!trimmed || trimmed.length > 2000) {
    throw new Error("[Draeven] A reply must be 1-2000 characters.");
  }

  return trimmed;
}

/* One command run: who called it, plus the Discord records lookups can read. */
export interface CommandRun<TOpt> extends CommandWorld {
  author: UserRef;
  opt: TOpt;
  transcript?: (options?: TranscriptOptions) => Promise<TranscriptFile>;
  send?: (channelId: string, reply: Reply) => Promise<void>;
  wait?: (options?: ReplyOptions) => Promise<void>;
  edit?: (reply: Reply) => Promise<void>;
  remove?: () => Promise<void>;
}

/* Run a command as if Discord just delivered it. */
export async function runCommand<TOpt>(
  entry: Command<TOpt> | { run: CommandRunner<TOpt> },
  input: CommandRun<TOpt>
): Promise<Reply> {
  const run = "run" in entry && entry.run ? entry.run : undefined;

  if (!run) {
    throw new Error("[Draeven] This command has no run function.");
  }

  let sent: Reply | undefined;
  let waited = false;
  let removed = false;
  const followups: Reply[] = [];
  const lookups = createLookups(input);

  const ctx = {
    ...input.opt,
    ...lookups,
    author: input.author,
    opt: input.opt,
    transcript(options?: TranscriptOptions) {
      if (!input.transcript) {
        throw new Error("[Draeven] This command has no channel.");
      }

      return input.transcript(options);
    },
    async wait(options?: ReplyOptions) {
      if (waited) {
        return;
      }

      if (!input.wait) {
        throw new Error("[Draeven] This command cannot wait.");
      }

      if (sent) {
        throw new Error("[Draeven] wait() must run before reply().");
      }

      await input.wait(options);
      waited = true;
    },
    async edit(
      message: ReplyBody,
      cardOrOptions?: Embed | ReplyOptions,
      maybeOptions?: ReplyOptions
    ) {
      if (!input.edit) {
        throw new Error("[Draeven] This command cannot edit.");
      }

      if (removed) {
        throw new Error("[Draeven] The reply was removed.");
      }

      if (!waited && !sent) {
        throw new Error("[Draeven] wait() or reply() before edit().");
      }

      const next = readReply(message, cardOrOptions, maybeOptions);
      sent = next;
      await input.edit(next);
    },
    async remove() {
      if (!input.remove) {
        throw new Error("[Draeven] This command cannot remove.");
      }

      if (removed) {
        return;
      }

      if (!waited && !sent) {
        throw new Error("[Draeven] wait() or reply() before remove().");
      }

      await input.remove();
      removed = true;
    },
    reply(message: ReplyBody, cardOrOptions?: Embed | ReplyOptions, maybeOptions?: ReplyOptions) {
      if (removed) {
        throw new Error("[Draeven] The reply was removed.");
      }

      if (sent && !waited) {
        throw new Error("[Draeven] A command can only reply once.");
      }

      const reply = readReply(message, cardOrOptions, maybeOptions);
      sent = reply;
      return sent;
    },
    async followup(
      message: ReplyBody,
      cardOrOptions?: Embed | ReplyOptions,
      maybeOptions?: ReplyOptions
    ) {
      if (!sent) {
        throw new Error("[Draeven] Reply before followup.");
      }

      const next = readReply(message, cardOrOptions, maybeOptions);
      followups.push(next);
      return next;
    },
    async send(
      channel: ChannelRef | string,
      message: ReplyBody,
      cardOrOptions?: Embed | ReplyOptions,
      maybeOptions?: ReplyOptions
    ) {
      if (!input.send) {
        throw new Error("[Draeven] This command cannot send to a channel.");
      }

      const channelId = typeof channel === "string" ? channel.trim() : channel.id.trim();

      if (!channelId) {
        throw new Error("[Draeven] send() needs a channel.");
      }

      const reply = readReply(message, cardOrOptions, maybeOptions);

      if (reply.private) {
        throw new Error("[Draeven] Channel messages cannot be private.");
      }

      if (reply.form) {
        throw new Error("[Draeven] A form cannot be sent to a channel.");
      }

      await input.send(channelId, reply);
    },
  } as CommandContext<TOpt>;

  const result = await run(ctx);

  if (removed) {
    return sent ?? { text: "Removed." };
  }

  if (!sent) {
    throw new Error("[Draeven] The command did not reply.");
  }

  if (result !== undefined && result !== sent) {
    throw new Error("[Draeven] A command can only reply once.");
  }

  if (followups.length > 0) {
    sent.followups = followups;
  }

  if (waited) {
    sent.deferred = true;
  }

  return sent;
}

/* Run the handler on a button, a menu, or a form. */
export async function runPress(
  handler: Press,
  input: CommandWorld & {
    author: UserRef;
    values: readonly string[];
    fields: Readonly<Record<string, string>>;
  }
): Promise<Reply> {
  let sent: Reply | undefined;

  const ctx = {
    ...createLookups(input),
    author: input.author,
    values: input.values,
    fields: input.fields,
    reply(message: ReplyBody, cardOrOptions?: Embed | ReplyOptions, maybeOptions?: ReplyOptions) {
      if (sent) {
        throw new Error("[Draeven] A command can only reply once.");
      }

      sent = readReply(message, cardOrOptions, maybeOptions);
      return sent;
    },
  } as PressContext;

  const result = await handler(ctx);

  if (!sent) {
    throw new Error("[Draeven] The command did not reply.");
  }

  if (result !== undefined && result !== sent) {
    throw new Error("[Draeven] A command can only reply once.");
  }

  return sent;
}

/* A bot may define each command name only once. */
export function assertCommands(commands: readonly Command[]): void {
  const names = new Set<string>();

  for (const entry of commands) {
    if (names.has(entry.name)) {
      throw new Error(
        `[Draeven] Command ${entry.name} is defined more than once.`
      );
    }

    names.add(entry.name);
  }
}
