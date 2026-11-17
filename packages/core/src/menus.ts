/* Draeven Core: user and message context-menu commands */

import {
  createLookups,
  type CommandWorld,
  type Lookups,
  type User,
  type UserRef,
} from "./lookup.js";
import { commandMark } from "./marks.js";
import { isMeta, type CommandMeta } from "./meta.js";
import { isEmbed, type Embed } from "./embed.js";
import { isCanvas, type Canvas } from "./canvas.js";
import {
  assertReplyParts,
  isForm,
  isRow,
  type Form,
  type Message,
  type Reply,
  type Row,
} from "./pieces.js";
import { isTranscript, type TranscriptFile } from "./transcript.js";

const NAME = /^[\w -]{1,32}$/;

export interface MessageRef {
  readonly id: string;
  readonly content: string;
  readonly authorId: string;
}

export type MenuContext<TTarget> = Lookups & {
  author: UserRef;
  target: TTarget;
  locale?: string;
  wait(options?: { private?: boolean }): Promise<void>;
  edit(message: string | Embed | Message | Row | Canvas | Form | TranscriptFile, card?: Embed): Promise<void>;
  reply(text: string): Reply;
  reply(card: Embed): Reply;
  reply(text: string, card: Embed): Reply;
  reply(part: Row | Canvas | Form | TranscriptFile): Reply;
  reply(message: Message): Reply;
};

type MenuRunner<TTarget> = (
  ctx: MenuContext<TTarget>
) => Reply | Promise<Reply>;

export interface UserMenu {
  readonly kind: "user-menu";
  readonly name: string;
  readonly meta?: CommandMeta;
  run(ctx: MenuContext<User>): Reply | Promise<Reply>;
}

export interface MessageMenu {
  readonly kind: "message-menu";
  readonly name: string;
  readonly meta?: CommandMeta;
  run(ctx: MenuContext<MessageRef>): Reply | Promise<Reply>;
}

export type MenuCommand = UserMenu | MessageMenu;

export function isMenu(value: unknown): value is MenuCommand {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<symbol, unknown>)[commandMark] === true &&
    "kind" in value &&
    (value.kind === "user-menu" || value.kind === "message-menu") &&
    "name" in value &&
    "run" in value
  );
}

export function userMenu(
  name: string,
  run: MenuRunner<User>
): UserMenu;
export function userMenu(
  name: string,
  meta: CommandMeta,
  run: MenuRunner<User>
): UserMenu;
export function userMenu(
  name: string,
  metaOrRun: CommandMeta | MenuRunner<User>,
  maybeRun?: MenuRunner<User>
): UserMenu {
  const run = typeof metaOrRun === "function" ? metaOrRun : maybeRun;
  const meta = typeof metaOrRun === "function" ? undefined : metaOrRun;

  if (!run) {
    throw new Error("[Draeven] A user menu needs a run function.");
  }

  if (meta !== undefined && !isMeta(meta)) {
    throw new Error("[Draeven] Unknown menu metadata.");
  }

  return markMenu({
    kind: "user-menu",
    name: readMenuName(name),
    ...(meta ? { meta } : {}),
    run,
  });
}

export function messageMenu(
  name: string,
  run: MenuRunner<MessageRef>
): MessageMenu;
export function messageMenu(
  name: string,
  meta: CommandMeta,
  run: MenuRunner<MessageRef>
): MessageMenu;
export function messageMenu(
  name: string,
  metaOrRun: CommandMeta | MenuRunner<MessageRef>,
  maybeRun?: MenuRunner<MessageRef>
): MessageMenu {
  const run = typeof metaOrRun === "function" ? metaOrRun : maybeRun;
  const meta = typeof metaOrRun === "function" ? undefined : metaOrRun;

  if (!run) {
    throw new Error("[Draeven] A message menu needs a run function.");
  }

  if (meta !== undefined && !isMeta(meta)) {
    throw new Error("[Draeven] Unknown menu metadata.");
  }

  return markMenu({
    kind: "message-menu",
    name: readMenuName(name),
    ...(meta ? { meta } : {}),
    run,
  });
}

export async function runMenu<TTarget>(
  entry: { run: MenuRunner<TTarget> },
  input: CommandWorld & {
    author: UserRef;
    target: TTarget;
    locale?: string;
    wait?: (options?: { private?: boolean }) => Promise<void>;
    edit?: (reply: Reply) => Promise<void>;
  }
): Promise<Reply> {
  let sent: Reply | undefined;
  let waited = false;
  const lookups = createLookups(input);

  const ctx = {
    ...lookups,
    author: input.author,
    target: input.target,
    ...(input.locale ? { locale: input.locale } : {}),
    async wait(options?: { private?: boolean }) {
      if (waited) {
        return;
      }

      if (!input.wait) {
        throw new Error("[Draeven] This menu cannot wait.");
      }

      if (sent) {
        throw new Error("[Draeven] wait() must run before reply().");
      }

      await input.wait(options);
      waited = true;
    },
    async edit(
      message: string | Embed | Message | Row | Canvas | Form | TranscriptFile,
      card?: Embed
    ) {
      if (!input.edit) {
        throw new Error("[Draeven] This menu cannot edit.");
      }

      if (!waited && !sent) {
        throw new Error("[Draeven] wait() or reply() before edit().");
      }

      const next = readReply(message, card);
      sent = next;
      await input.edit(next);
    },
    reply(message: string | Embed | Message | Row | Canvas | Form | TranscriptFile, card?: Embed) {
      if (sent && !waited) {
        throw new Error("[Draeven] A command can only reply once.");
      }

      sent = readReply(message, card);
      return sent;
    },
  } as MenuContext<TTarget>;

  const result = await entry.run(ctx);

  if (!sent) {
    throw new Error("[Draeven] The command did not reply.");
  }

  if (result !== undefined && result !== sent) {
    throw new Error("[Draeven] A command can only reply once.");
  }

  if (waited) {
    sent.deferred = true;
  }

  return sent;
}

function markMenu<T extends MenuCommand>(entry: T): T {
  Object.defineProperty(entry, commandMark, {
    value: true,
    enumerable: false,
  });
  return entry;
}

function readMenuName(name: string): string {
  const trimmed = name.trim();

  if (!NAME.test(trimmed)) {
    throw new Error(
      "[Draeven] Menu name must be 1-32 characters: letters, numbers, spaces, underscores, or hyphens."
    );
  }

  return trimmed;
}

function readReply(
  message: string | Embed | Message | Row | Canvas | Form | TranscriptFile,
  card?: Embed
): Reply {
  if (typeof message === "string") {
    const text = readText(message);

    if (card === undefined) {
      return { text };
    }

    if (!isEmbed(card)) {
      throw new Error("[Draeven] A reply takes text, an embed, or text and an embed.");
    }

    return { text, embed: card };
  }

  if (card !== undefined) {
    throw new Error("[Draeven] A reply takes text, an embed, or text and an embed.");
  }

  if (isEmbed(message)) {
    return { embed: message };
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

  const bag = message as Message;
  return {
    ...(bag.text ? { text: readText(bag.text) } : {}),
    ...(bag.card ? { embed: bag.card } : {}),
    ...(bag.rows ? { rows: bag.rows } : {}),
    ...(bag.picture ? { picture: bag.picture } : {}),
    ...(bag.form ? { form: bag.form } : {}),
  };
}

function readText(text: string): string {
  const trimmed = text.trim();

  if (!trimmed || trimmed.length > 2000) {
    throw new Error("[Draeven] A reply must be 1-2000 characters.");
  }

  return trimmed;
}
