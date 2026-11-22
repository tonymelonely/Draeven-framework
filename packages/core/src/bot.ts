/* Draeven Core: connect a bot and answer its commands */

import {
  DiscordClient,
  createdAtFromId,
  type ApplicationCommandBody,
  type ApplicationCommandOptionBody,
  type ChannelHistory,
  type DiscordEmbed,
  type DiscordProfile,
  type IncomingChannel,
  type IncomingCommand,
  type IncomingMember,
  type IncomingMenu,
  type IncomingOption,
  type IncomingRole,
  type IncomingSuggest,
  type DiscordRole,
  type DiscordUserCard,
  type IncomingUse,
  type InteractionReply,
  type Presence,
  type GatewayEventName,
  type GatewayEvents,
  type GatewayMember,
  type GatewayMessage,
  gatewayEventNames,
  EPHEMERAL,
  intents,
  intentBits,
} from "@draeven/discord";
import {
  assertCommands,
  buildReply,
  isCommand,
  runCommand,
  runPress,
  type Command,
  type Reply,
} from "./command.js";
import type { Canvas } from "./canvas.js";
import type { Layout } from "./layout.js";
import type { Poll } from "./poll.js";
import type { Message, Row } from "./pieces.js";
import { readConfig, resolveCommandsFolder } from "./config.js";
import type { Embed } from "./embed.js";
import {
  COMPONENTS_V2,
  discordLayout,
  layoutActions,
} from "./layout.js";
import { loadCommands, type LoadableCommand } from "./load-commands.js";
import type { Channel, File, Guild, Member, Role, User } from "./lookup.js";
import { createLookups } from "./lookup.js";
import { isMenu, runMenu, type MenuCommand } from "./menus.js";
import {
  CollectorBook,
  type Collected,
  type CollectOptions,
} from "./collect.js";
import { CooldownBook, cooldownKey, readCooldown } from "./cooldown.js";
import { isGuard, type Guard } from "./guard.js";
import { loadEvents, type BotEvents, type LoadedEvents } from "./load-events.js";
import { readMeta } from "./meta.js";
import type { StoredOption } from "./options.js";
import { discordPoll } from "./poll.js";
import { actionsIn, discordForm, discordRows, type ChannelKind, type Press } from "./pieces.js";
import type { StoredBranch, StoredSub } from "./subcommands.js";
import { toSuggestChoices } from "./suggest.js";
import {
  readTranscriptChoice,
  renderTranscript,
  resolveTimeZone,
  type TranscriptFile,
  type TranscriptOptions,
} from "./transcript.js";
import { watch as fsWatch } from "node:fs";
import { fileURLToPath } from "node:url";
import { claimAlone, type AloneMode } from "./alone.js";
import { createActions } from "./actions.js";
import { checkGates } from "./gates.js";
import { frame } from "./strings.js";
import { findUse, type Use } from "./use.js";

export type { BotEvents, LoadedEvents } from "./load-events.js";
export type { AloneMode } from "./alone.js";

export interface StartOptions {
  token: string;
  /** Explicit commands, a folder path, or omit to use draeven.config. */
  commands?: readonly LoadableCommand[] | string | URL;
  guildId?: string;
  /** IANA time zone used when a transcript does not set its own. */
  timeZone?: string;
  /** Status and activity shown next to the bot. */
  presence?: Presence;
  /** Gateway intents bitmask. Use intents.* or intentBits(...). */
  intents?: number;
  /**
   * Gateway event handlers, a folder of compiled event modules, or omit to use
   * `events` from draeven.config when set.
   * A folder also loads `use()` handlers. Hot-reload when watch is true.
   */
  events?: BotEvents | string | URL;
  /**
   * Extra durable component handlers. Folder `use()` exports are loaded too.
   * Inline press on a button still wins while that reply is remembered.
   */
  uses?: readonly Use[];
  /**
   * Watch the commands (and events) folder and reload without restarting Discord.
   * Requires commands from a folder path / draeven.config.
   */
  watch?: boolean;
  /** Optional error guard from guard(). Keeps the process alive and logs failures. */
  guard?: Guard;
  /**
   * Only one bot process per project.
   * - "ask" (default): prompt on a TTY when another instance is live
   * - true: stop the other process and continue
   * - false: skip the check
   */
  alone?: AloneMode;
  /**
   * Auto-defer before Discord's 3s limit when a handler is still running.
   * true / omitted = 2000ms, false = off, or a custom delay in ms (500-2500).
   */
  autoDefer?: boolean | number;
}
export type { Presence, PresenceActivity, PresenceStatus, ActivityKind } from "@draeven/discord";
export { intents, intentBits, intentsFor, eventIntents } from "@draeven/discord";

export interface BotSyncState {
  watch: boolean;
  commandCount: number;
  lastCommandsReloadAt?: string;
  lastEventsReloadAt?: string;
  lastCommandsError?: string;
  lastEventsError?: string;
}

export interface Bot {
  readonly commands: readonly LoadableCommand[];
  stop(): Promise<void>;
  /** Change gateway presence while the bot is running. */
  setPresence(presence: Presence): void;
  /** Snapshot of command/event hot-reload status. */
  syncState(): BotSyncState;
  /** Subscribe to hot-reload / sync updates. */
  onSync(handler: (state: BotSyncState) => void): () => void;
  /** Post a message to a channel outside a slash reply. */
  send(
    channel: { id: string } | string,
    message: string | Message | Embed | Row | Canvas | Poll | Layout
  ): Promise<void>;
  onEvent<K extends GatewayEventName>(
    name: K,
    handler: (value: GatewayEvents[K]) => void | Promise<void>
  ): () => void;
  onMemberJoin(handler: (member: GatewayMember) => void | Promise<void>): () => void;
  onMemberLeave(handler: (member: GatewayMember) => void | Promise<void>): () => void;
  onMessage(handler: (message: GatewayMessage) => void | Promise<void>): () => void;
}

export interface BotConnection {
  start(): Promise<void>;
  stop(): Promise<void>;
  readyUser(): DiscordProfile & { applicationId: string };
  registerCommands(
    commands: readonly ApplicationCommandBody[],
    guildId?: string
  ): Promise<void>;
  onCommand(handler: (command: IncomingCommand) => void | Promise<void>): () => void;
  onMenu?(handler: (menu: IncomingMenu) => void | Promise<void>): () => void;
  onSuggest?(handler: (suggest: IncomingSuggest) => void | Promise<void>): () => void;
  onUse(handler: (use: IncomingUse) => void | Promise<void>): () => void;
  readGuild(guildId: string): Promise<Guild | undefined>;
  readRoles(guildId: string): Promise<readonly DiscordRole[]>;
  readUser(userId: string): Promise<DiscordUserCard | undefined>;
  defer(
    interactionId: string,
    interactionToken: string,
    options?: { private?: boolean }
  ): Promise<void>;
  /** Acknowledge a component without changing the message. */
  deferUpdate?(interactionId: string, interactionToken: string): Promise<void>;
  editReply(
    applicationId: string,
    interactionToken: string,
    reply: InteractionReply
  ): Promise<string | undefined>;
  deleteReply?(
    applicationId: string,
    interactionToken: string,
    messageId?: string
  ): Promise<void>;
  readHistory(channelId: string): Promise<ChannelHistory>;
  replyTo(
    interactionId: string,
    interactionToken: string,
    reply: InteractionReply
  ): Promise<void>;
  followUp?(
    applicationId: string,
    interactionToken: string,
    reply: InteractionReply
  ): Promise<void>;
  sendMessage?(channelId: string, reply: InteractionReply): Promise<void>;
  setPresence?(presence: Presence): void;
  timeoutMember?(guildId: string, userId: string, seconds: number, reason?: string): Promise<void>;
  kickMember?(guildId: string, userId: string, reason?: string): Promise<void>;
  banMember?(
    guildId: string,
    userId: string,
    options?: { seconds?: number; reason?: string }
  ): Promise<void>;
  moveMemberVoice?(guildId: string, userId: string, channelId: string | null): Promise<void>;
  listRecentMessageIds?(channelId: string, limit: number): Promise<string[]>;
  purgeMessages?(channelId: string, messageIds: readonly string[]): Promise<void>;
  pinMessage?(channelId: string, messageId: string): Promise<void>;
  unpinMessage?(channelId: string, messageId: string): Promise<void>;
  reactToMessage?(channelId: string, messageId: string, emoji: string): Promise<void>;
  editChannelMessage?(
    channelId: string,
    messageId: string,
    reply: InteractionReply
  ): Promise<void>;
  deleteChannelMessage?(channelId: string, messageId: string, reason?: string): Promise<void>;
  onEvent?<K extends GatewayEventName>(
    name: K,
    handler: (value: GatewayEvents[K]) => void | Promise<void>
  ): () => void;
  onMemberJoin?(handler: (member: GatewayMember) => void | Promise<void>): () => void;
  onMemberLeave?(handler: (member: GatewayMember) => void | Promise<void>): () => void;
  onMessage?(handler: (message: GatewayMessage) => void | Promise<void>): () => void;
  replyToSuggest?(
    interactionId: string,
    interactionToken: string,
    choices: readonly { name: string; value: string | number }[]
  ): Promise<void>;
}

/* Start the framework core */
export async function Start(options: StartOptions): Promise<Bot> {
  const token = options.token.trim();

  if (!token) {
    throw new Error(
      "[Draeven] Missing Discord token. Set token in StartOptions."
    );
  }

  if (options.guard !== undefined && !isGuard(options.guard)) {
    throw new Error("[Draeven] Start({ guard }) expects guard({ ... }).");
  }

  const resolved = await resolveStartCommands(options.commands);
  assertCommands(resolved.commands.filter(isCommand));
  assertGuildId(options.guildId);

  if (options.timeZone !== undefined) {
    resolveTimeZone(options.timeZone);
  }

  if (options.watch && !resolved.folder) {
    throw new Error(
      "[Draeven] watch: true needs commands from a folder path or draeven.config."
    );
  }

  const events = await resolveStartEvents(options.events);
  const uses = [...(events.uses ?? []), ...(options.uses ?? [])];
  const lock = await claimAlone({ mode: options.alone ?? "ask" });

  try {
    const bot = await startBot(
      new DiscordClient({
        token,
        ...(options.presence ? { presence: options.presence } : {}),
        ...(options.intents !== undefined ? { intents: options.intents } : {}),
      }),
      {
        commands: resolved.commands,
        ...(resolved.folder ? { commandsFolder: resolved.folder } : {}),
        ...(events.handlers ? { events: events.handlers } : {}),
        ...(events.folder ? { eventsFolder: events.folder } : {}),
        uses,
        guildId: options.guildId,
        timeZone: options.timeZone,
      watch: options.watch === true,
      ...(options.guard ? { guard: options.guard } : {}),
      autoDefer: options.autoDefer,
    }
    );

    return {
      get commands() {
        return bot.commands;
      },
      async stop() {
        await bot.stop();
        await lock.release();
      },
      setPresence: bot.setPresence.bind(bot),
      syncState: bot.syncState.bind(bot),
      onSync: bot.onSync.bind(bot),
      send: bot.send.bind(bot),
      onEvent: bot.onEvent.bind(bot),
      onMemberJoin: bot.onMemberJoin.bind(bot),
      onMemberLeave: bot.onMemberLeave.bind(bot),
      onMessage: bot.onMessage.bind(bot),
    };
  } catch (error) {
    await lock.release();
    throw error;
  }
}
async function resolveStartCommands(
  commands: StartOptions["commands"]
): Promise<{ commands: LoadableCommand[]; folder?: string }> {
  if (Array.isArray(commands)) {
    return { commands: [...commands] };
  }

  if (typeof commands === "string" || commands instanceof URL) {
    const folder =
      typeof commands === "string" ? resolveCommandsFolder(commands) : fileURLToPath(commands);
    return { commands: await loadCommands(folder), folder };
  }

  const config = await readConfig();
  const folder =
    typeof config.commandsFolder === "string"
      ? config.commandsFolder
      : fileURLToPath(config.commandsFolder);
  return { commands: await loadCommands(folder), folder };
}

async function resolveStartEvents(
  events: StartOptions["events"]
): Promise<{ handlers?: BotEvents; uses?: readonly Use[]; folder?: string }> {
  if (events === undefined) {
    const config = await readConfig();

    if (!config.eventsFolder) {
      return {};
    }

    const loaded = await loadEvents(config.eventsFolder);
    return {
      handlers: loaded.handlers,
      uses: loaded.uses,
      folder: config.eventsFolder,
    };
  }

  if (typeof events === "string" || events instanceof URL) {
    const folder =
      typeof events === "string" ? resolveCommandsFolder(events) : fileURLToPath(events);
    const loaded = await loadEvents(folder);
    return { handlers: loaded.handlers, uses: loaded.uses, folder };
  }

  return { handlers: events };
}

/* Register commands and answer them. Tests can pass a fake connection. */
export async function startBot(
  client: BotConnection,
  options: {
    commands: readonly LoadableCommand[];
    commandsFolder?: string;
    eventsFolder?: string;
    guildId?: string;
    timeZone?: string;
    events?: BotEvents;
    uses?: readonly Use[];
    watch?: boolean;
    guard?: Guard;
    autoDefer?: boolean | number;
  }
): Promise<Bot> {
  const live = {
    commands: [...options.commands],
    events: { ...(options.events ?? {}) } as BotEvents,
    uses: [...(options.uses ?? [])],
  };
  assertCommands(live.commands.filter(isCommand));
  assertGuildId(options.guildId);

  const startedAt = Date.now();
  const guard = options.guard;
  const report = (kind: "commands" | "events" | "process", error: unknown) => {
    if (guard?.handles(kind)) {
      guard.report(kind, error);
      return;
    }

    console.error(`[Draeven] ${kind} error.`, error);
  };

  await client.start();
  const bot = client.readyUser();
  await client.registerCommands(toApplicationCommands(live.commands), options.guildId);

  const actions = new Map<string, Press>();
  const cooldowns = new CooldownBook();
  const collectors = new CollectorBook();
  const stopWatchers: Array<() => void> = [];
  let unsubEvents: Array<() => void> = [];

  const wrapEvent = <T>(
    kind: "events",
    handler: ((value: T) => void | Promise<void>) | undefined
  ): ((value: T) => void | Promise<void>) | undefined => {
    if (!handler) {
      return undefined;
    }

    return async (value) => {
      try {
        await handler(value);
      } catch (error) {
        report(kind, error);
      }
    };
  };

  const bindEvents = () => {
    for (const stop of unsubEvents) {
      stop();
    }

    unsubEvents = [];

    for (const name of gatewayEventNames) {
      const raw = live.events[name];

      if (!raw) {
        continue;
      }

      const handler = wrapEvent("events", raw as (value: never) => void | Promise<void>)!;

      if (client.onEvent) {
        unsubEvents.push(
          client.onEvent(name, handler as (value: GatewayEvents[typeof name]) => void | Promise<void>)
        );
        continue;
      }

      if (name === "memberJoin" && client.onMemberJoin) {
        unsubEvents.push(client.onMemberJoin(handler as (member: GatewayMember) => void | Promise<void>));
      } else if (name === "memberLeave" && client.onMemberLeave) {
        unsubEvents.push(client.onMemberLeave(handler as (member: GatewayMember) => void | Promise<void>));
      } else if (name === "message" && client.onMessage) {
        unsubEvents.push(client.onMessage(handler as (message: GatewayMessage) => void | Promise<void>));
      }
    }
  };

  bindEvents();

  const sendChannel = async (channelId: string, text: string) => {
    if (!client.sendMessage) {
      throw new Error("[Draeven] This connection cannot send channel messages.");
    }

    await client.sendMessage(channelId, { content: text });
  };

  guard?.attach({
    startedAt,
    ...(client.sendMessage ? { send: sendChannel } : {}),
  });

  client.onCommand((incoming) =>
    answerAndReply(
      client,
      () => live.commands.filter(isCommand),
      incoming,
      bot,
      actions,
      cooldowns,
      collectors,
      options.timeZone,
      (error) => report("commands", error),
      options.autoDefer
    )
  );
  client.onMenu?.((incoming) =>
    answerMenuAndReply(
      client,
      () => live.commands.filter(isMenu),
      incoming,
      bot,
      actions,
      cooldowns,
      (error) => report("commands", error)
    )
  );
  client.onSuggest?.((incoming) =>
    answerSuggest(client, () => live.commands.filter(isCommand), incoming, bot)
  );
  client.onUse((use) =>
    answerUse(client, actions, collectors, () => live.uses, use, bot, (error) =>
      report("commands", error)
    )
  );

  const syncListeners = new Set<(state: BotSyncState) => void>();
  const syncState: BotSyncState = {
    watch: options.watch === true,
    commandCount: live.commands.length,
  };

  const publishSync = () => {
    syncState.commandCount = live.commands.length;
    const snapshot = { ...syncState };
    for (const listener of syncListeners) {
      listener(snapshot);
    }
  };

  if (options.watch && options.commandsFolder) {
    const reloadCommands = async () => {
      try {
        const next = await loadCommands(options.commandsFolder!, { bust: true });
        live.commands.splice(0, live.commands.length, ...next);
        await client.registerCommands(toApplicationCommands(live.commands), options.guildId);
        syncState.lastCommandsReloadAt = new Date().toISOString();
        syncState.lastCommandsError = undefined;
        publishSync();
        console.log(`[Draeven] Reloaded ${live.commands.length} commands.`);
      } catch (error) {
        syncState.lastCommandsError = error instanceof Error ? error.message : String(error);
        publishSync();
        report("commands", error);
      }
    };

    stopWatchers.push(watchFolder(options.commandsFolder, () => void reloadCommands()));
  }

  if (options.watch && options.eventsFolder) {
    const reloadEvents = async () => {
      try {
        const loaded = await loadEvents(options.eventsFolder!, { bust: true });
        live.events = loaded.handlers;
        live.uses.splice(0, live.uses.length, ...loaded.uses);
        bindEvents();
        syncState.lastEventsReloadAt = new Date().toISOString();
        syncState.lastEventsError = undefined;
        publishSync();
        console.log(
          `[Draeven] Reloaded events (${Object.keys(loaded.handlers).length} gateway, ${loaded.uses.length} use).`
        );
      } catch (error) {
        syncState.lastEventsError = error instanceof Error ? error.message : String(error);
        publishSync();
        report("events", error);
      }
    };

    stopWatchers.push(watchFolder(options.eventsFolder, () => void reloadEvents()));
  }

  return {
    get commands() {
      return live.commands;
    },
    setPresence(presence) {
      if (!client.setPresence) {
        throw new Error("[Draeven] This connection cannot update presence.");
      }

      client.setPresence(presence);
    },
    syncState() {
      return { ...syncState, commandCount: live.commands.length };
    },
    onSync(handler) {
      syncListeners.add(handler);
      return () => {
        syncListeners.delete(handler);
      };
    },
    async stop() {
      for (const stop of stopWatchers) {
        stop();
      }

      for (const stop of unsubEvents) {
        stop();
      }

      syncListeners.clear();
      collectors.clear();
      guard?.dispose();
      await client.stop();
    },
    async send(channel, message) {
      if (!client.sendMessage) {
        throw new Error("[Draeven] This connection cannot send channel messages.");
      }

      const channelId = typeof channel === "string" ? channel.trim() : channel.id.trim();

      if (!channelId) {
        throw new Error("[Draeven] send() needs a channel.");
      }

      const reply = buildReply(message);

      if (reply.private) {
        throw new Error("[Draeven] Channel messages cannot be private.");
      }

      if (reply.form) {
        throw new Error("[Draeven] A form cannot be sent to a channel.");
      }

      await client.sendMessage(channelId, toOutgoing(reply));
    },
    onEvent(name, handler) {
      if (client.onEvent) {
        return client.onEvent(name, wrapEvent("events", handler)!);
      }

      if (name === "memberJoin" && client.onMemberJoin) {
        return client.onMemberJoin(
          wrapEvent("events", handler as (member: GatewayMember) => void | Promise<void>)!
        );
      }

      if (name === "memberLeave" && client.onMemberLeave) {
        return client.onMemberLeave(
          wrapEvent("events", handler as (member: GatewayMember) => void | Promise<void>)!
        );
      }

      if (name === "message" && client.onMessage) {
        return client.onMessage(
          wrapEvent("events", handler as (message: GatewayMessage) => void | Promise<void>)!
        );
      }

      throw new Error(`[Draeven] This connection has no ${String(name)} events.`);
    },
    onMemberJoin(handler) {
      if (client.onEvent) {
        return client.onEvent("memberJoin", wrapEvent("events", handler)!);
      }

      if (!client.onMemberJoin) {
        throw new Error("[Draeven] This connection has no member join events.");
      }

      return client.onMemberJoin(wrapEvent("events", handler)!);
    },
    onMemberLeave(handler) {
      if (client.onEvent) {
        return client.onEvent("memberLeave", wrapEvent("events", handler)!);
      }

      if (!client.onMemberLeave) {
        throw new Error("[Draeven] This connection has no member leave events.");
      }

      return client.onMemberLeave(wrapEvent("events", handler)!);
    },
    onMessage(handler) {
      if (client.onEvent) {
        return client.onEvent("message", wrapEvent("events", handler)!);
      }

      if (!client.onMessage) {
        throw new Error("[Draeven] This connection has no message events.");
      }

      return client.onMessage(wrapEvent("events", handler)!);
    },
  };
}

function watchFolder(dir: string, onChange: () => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watcher = fsWatch(dir, { persistent: false }, (_event, filename) => {
    const name = typeof filename === "string" ? filename : "";

    if (name.startsWith(".")) {
      return;
    }

    clearTimeout(timer);
    timer = setTimeout(onChange, 200);
  });

  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}

export async function answerCommand(
  commands: readonly Command[],
  incoming: IncomingCommand,
  bot: DiscordProfile,
  guild?: Guild,
  transcript?: (options?: TranscriptOptions) => Promise<TranscriptFile>,
  clientSend?: (channelId: string, reply: Reply) => Promise<void>,
  interaction?: {
    wait: (options?: { private?: boolean }) => Promise<void>;
    edit: (reply: Reply) => Promise<void>;
    remove: () => Promise<void>;
    collect: (options: CollectOptions) => Promise<Collected | undefined>;
    flush: (reply: Reply) => Promise<void>;
  },
  actions?: ReturnType<typeof createActions>
): Promise<Reply | undefined> {
  const command = commands.find((entry) => entry.name === incoming.name);

  if (!command) {
    return undefined;
  }

  const leaf = resolveLeaf(command, incoming.options);
  const users = knownUsers(bot, incoming.users);
  const channels = incoming.channels.map(toChannel);
  const knownRoles = incoming.roles.map(toRole);
  const files = incoming.files.map((entry) => ({
    id: entry.id,
    name: entry.name,
    url: entry.url,
    ...(entry.size === undefined ? {} : { size: entry.size }),
    ...(entry.type === undefined ? {} : { type: entry.type }),
  }));
  const members = membersFromIncoming(incoming, knownRoles);
  const roleMap = Object.fromEntries(
    Object.entries(members).map(([id, entry]) => [id, entry.roles])
  );
  const opt = buildOpt(leaf.options, leaf.incomingOptions, {
    users,
    channels,
    roles: knownRoles,
    files,
  });
  const channel =
    incoming.channelId === undefined
      ? undefined
      : channels.find((entry) => entry.id === incoming.channelId) ?? {
          id: incoming.channelId,
          name: "channel",
        };

  return runCommand(
    { run: leaf.run },
    {
      author: { id: incoming.author.id },
      bot: { id: bot.id },
      users,
      ...(incoming.locale ? { locale: incoming.locale } : {}),
      ...(guild ? { guild } : {}),
      ...(channel ? { channel } : {}),
      ...(channels.length > 0 ? { channels } : {}),
      ...(knownRoles.length > 0 ? { knownRoles } : {}),
      ...(Object.keys(members).length > 0
        ? {
            members,
            roles: roleMap,
          }
        : {}),
      ...(files.length > 0 ? { files } : {}),
      ...(transcript ? { transcript } : {}),
      ...(clientSend ? { send: clientSend } : {}),
      ...(interaction
        ? {
            wait: interaction.wait,
            edit: interaction.edit,
            remove: interaction.remove,
            collect: interaction.collect,
            flush: interaction.flush,
          }
        : {}),
      ...(actions
        ? {
            timeout: actions.timeout,
            kick: actions.kick,
            ban: actions.ban,
            moveVoice: actions.moveVoice,
            purge: actions.purge,
            pin: actions.pin,
            unpin: actions.unpin,
            react: actions.react,
            editMessage: actions.editMessage,
            deleteMessage: actions.deleteMessage,
          }
        : {}),
      opt,
    }
  );
}

function membersFromIncoming(
  incoming: IncomingCommand,
  knownRoles: readonly Role[]
): Record<string, Member> {
  const members: Record<string, Member> = {};
  const sources = {
    ...(incoming.members ?? {}),
    ...(incoming.member ? { [incoming.author.id]: incoming.member } : {}),
  };

  for (const [id, entry] of Object.entries(sources)) {
    members[id] = {
      id,
      ...(entry.nick ? { nick: entry.nick } : {}),
      ...(entry.joinedAt ? { joinedAt: entry.joinedAt } : {}),
      roles: rolesForMember(entry, knownRoles),
    };
  }

  return members;
}

function toChannel(entry: IncomingChannel): Channel {
  const kind = entry.type === undefined ? undefined : channelKindFromType(entry.type);

  return {
    id: entry.id,
    name: entry.name,
    ...(kind ? { kind } : {}),
  };
}

function toRole(entry: IncomingRole): Role {
  return {
    id: entry.id,
    name: entry.name,
    ...(entry.color === undefined ? {} : { color: entry.color }),
    ...(entry.position === undefined ? {} : { position: entry.position }),
  };
}

function rolesForMember(
  member: IncomingMember | undefined,
  known: readonly Role[]
): Role[] {
  if (!member) {
    return [];
  }

  const byId = new Map(known.map((role) => [role.id, role]));
  const roles: Role[] = [];

  for (const id of member.roleIds) {
    const found = byId.get(id);
    roles.push(found ?? { id, name: id });
  }

  return roles;
}

const channelTypeName: Record<number, ChannelKind> = {
  0: "text",
  2: "voice",
  4: "category",
  5: "announcement",
  10: "announcement thread",
  11: "thread",
  12: "private thread",
  13: "stage",
  15: "forum",
  16: "media",
};

function channelKindFromType(type: number): ChannelKind | undefined {
  return channelTypeName[type];
}

function resolveLeaf(
  command: Command,
  incomingOptions: IncomingOption[]
): {
  options: Readonly<Record<string, StoredOption>>;
  incomingOptions: IncomingOption[];
  run: NonNullable<Command["run"]>;
} {
  const branches = Object.keys(command.subs);

  if (branches.length === 0) {
    if (!command.run) {
      throw new Error(`[Draeven] Command ${command.name} has no run function.`);
    }

    return {
      options: command.options,
      incomingOptions,
      run: command.run,
    };
  }

  const selected = incomingOptions[0];

  if (!selected || (selected.kind !== "sub" && selected.kind !== "group")) {
    throw new Error(`[Draeven] Command ${command.name} needs a subcommand.`);
  }

  const branch = command.subs[selected.name];

  if (!branch) {
    throw new Error(`[Draeven] Unknown subcommand ${selected.name}.`);
  }

  if (branch.kind === "sub") {
    return {
      options: branch.options,
      incomingOptions: selected.options,
      run: branch.run,
    };
  }

  const nested = selected.options[0];

  if (!nested || nested.kind !== "sub") {
    throw new Error(`[Draeven] Group ${selected.name} needs a subcommand.`);
  }

  const leaf = branch.subs[nested.name];

  if (!leaf) {
    throw new Error(`[Draeven] Unknown subcommand ${nested.name}.`);
  }

  return {
    options: leaf.options,
    incomingOptions: nested.options,
    run: leaf.run,
  };
}

function buildOpt(
  options: Readonly<Record<string, StoredOption>>,
  incoming: IncomingOption[],
  world: {
    users: readonly User[];
    channels: readonly Channel[];
    roles: readonly Role[];
    files: readonly File[];
  }
): Record<string, string | number | boolean | User | Channel | Role | File | undefined> {
  const opt: Record<
    string,
    string | number | boolean | User | Channel | Role | File | undefined
  > = {};

  for (const [name, option] of Object.entries(options)) {
    const selected = incoming.find((item) => item.name === name);

    if (!selected) {
      if (option.required) {
        throw new Error(`[Draeven] Option ${name} is required.`);
      }

      opt[name] = undefined;
      continue;
    }

    opt[name] = readOptionValue(name, option, selected, world);
  }

  return opt;
}

function readOptionValue(
  name: string,
  option: StoredOption,
  selected: IncomingOption,
  world: {
    users: readonly User[];
    channels: readonly Channel[];
    roles: readonly Role[];
    files: readonly File[];
  }
): string | number | boolean | User | Channel | Role | File {
  switch (option.kind) {
    case "user":
      if (selected.kind !== "user") {
        throw new Error(`[Draeven] Option ${name} expected a user.`);
      }

      return needById(world.users, selected.userId, "user");
    case "text":
    case "choice":
      if (selected.kind !== "string") {
        throw new Error(`[Draeven] Option ${name} expected text.`);
      }

      return selected.value;
    case "number":
    case "decimal":
      if (selected.kind !== "integer" && selected.kind !== "number") {
        throw new Error(`[Draeven] Option ${name} expected a number.`);
      }

      return selected.value;
    case "channel":
      if (selected.kind !== "channel") {
        throw new Error(`[Draeven] Option ${name} expected a channel.`);
      }

      return needById(world.channels, selected.channelId, "channel");
    case "role":
      if (selected.kind !== "role") {
        throw new Error(`[Draeven] Option ${name} expected a role.`);
      }

      return needById(world.roles, selected.roleId, "role");
    case "file":
      if (selected.kind !== "file") {
        throw new Error(`[Draeven] Option ${name} expected a file.`);
      }

      return needById(world.files, selected.fileId, "file");
    case "flag":
      if (selected.kind !== "flag") {
        throw new Error(`[Draeven] Option ${name} expected a flag.`);
      }

      return selected.value;
    case "mentionable":
      if (selected.kind !== "mentionable") {
        throw new Error(`[Draeven] Option ${name} expected a mentionable.`);
      }

      {
        const user = world.users.find((entry) => entry.id === selected.id);
        if (user) {
          return user;
        }

        return needById(world.roles, selected.id, "mentionable");
      }
  }
}

function needById<T extends { id: string }>(
  entries: readonly T[],
  id: string,
  label: string
): T {
  const found = entries.find((entry) => entry.id === id);

  if (!found) {
    throw new Error(`[Draeven] Unknown ${label} ${id}.`);
  }

  return found;
}

async function answerMenuAndReply(
  client: BotConnection,
  menus: () => readonly MenuCommand[],
  incoming: IncomingMenu,
  bot: DiscordProfile & { applicationId: string },
  actions: Map<string, Press>,
  cooldowns: CooldownBook,
  report?: (error: unknown) => void
): Promise<void> {
  let deferred = false;

  try {
    const entry = menus().find(
      (menu) => menu.kind === incoming.kind && menu.name === incoming.name
    );

    if (!entry) {
      return;
    }

    const cooling = readCooldown(entry.meta?.cooldown);

    if (cooling) {
      const key = cooldownKey(incoming.name, cooling.scope, {
        userId: incoming.author.id,
        ...(incoming.guildId ? { guildId: incoming.guildId } : {}),
        ...(incoming.channelId ? { channelId: incoming.channelId } : {}),
      });

      if (key) {
        const left = cooldowns.take(key, cooling.seconds);

        if (left > 0) {
          await client.replyTo(incoming.id, incoming.token, {
            content: frame("cooldown", incoming.locale, {
              name: incoming.name,
              seconds: left,
            }),
            ...(cooling.private ? { flags: EPHEMERAL } : {}),
          });
          return;
        }
      }
    }

    const guild = incoming.guildId ? await loadGuild(client, incoming.guildId) : undefined;

    if (entry.meta) {
      const blocked = await checkGates(entry.meta, {
        author: { id: incoming.author.id },
        ...(incoming.locale ? { locale: incoming.locale } : {}),
        ...(guild ? { guild } : {}),
        ...(guild?.ownerId ? { ownerId: guild.ownerId } : {}),
        bot: { id: bot.id },
        users: knownUsers(bot, incoming.users),
      });

      if (blocked) {
        await client.replyTo(incoming.id, incoming.token, {
          content: frame(blocked, incoming.locale),
          flags: EPHEMERAL,
        });
        return;
      }
    }

    if (entry.meta?.defer) {
      const privateDefer =
        typeof entry.meta.defer === "object" && entry.meta.defer.private === true;
      await client.defer(incoming.id, incoming.token, { private: privateDefer });
      deferred = true;
    }

    const users = knownUsers(bot, incoming.users);
    const interaction = {
      ...(incoming.locale ? { locale: incoming.locale } : {}),
      wait: async (options?: { private?: boolean }) => {
        if (!deferred) {
          await client.defer(incoming.id, incoming.token, options);
          deferred = true;
        }
      },
      edit: async (message: Reply) => {
        if (!deferred) {
          await client.defer(incoming.id, incoming.token, {
            private: message.private === true,
          });
          deferred = true;
        }

        remember(actions, message);
        await client.editReply(bot.applicationId, incoming.token, toOutgoing(message));
      },
    };
    const reply =
      entry.kind === "user-menu"
        ? await runMenu(entry, {
            author: { id: incoming.author.id },
            target: needById(users, incoming.targetId, "user"),
            users,
            bot: { id: bot.id },
            ...(guild ? { guild } : {}),
            ...(incoming.channelId
              ? { channel: { id: incoming.channelId, name: "channel" } }
              : {}),
            ...interaction,
          })
        : await runMenu(entry, {
            author: { id: incoming.author.id },
            target: incoming.message
              ? {
                  id: incoming.message.id,
                  content: incoming.message.content,
                  authorId: incoming.message.authorId,
                }
              : { id: incoming.targetId, content: "", authorId: incoming.author.id },
            users,
            bot: { id: bot.id },
            ...(guild ? { guild } : {}),
            ...(incoming.channelId
              ? { channel: { id: incoming.channelId, name: "channel" } }
              : {}),
            ...interaction,
          });

    remember(actions, reply);

    if (deferred || reply.deferred) {
      await client.editReply(bot.applicationId, incoming.token, toOutgoing(reply));
      return;
    }

    await client.replyTo(incoming.id, incoming.token, toOutgoing(reply));
  } catch (error) {
    if (report) {
      report(error);
    } else {
      console.error("[Draeven] Menu failed.", error);
    }

    try {
      if (deferred) {
        await client.editReply(bot.applicationId, incoming.token, {
          content: failureText(error, incoming.locale),
        });
        return;
      }

      await client.replyTo(incoming.id, incoming.token, {
        content: failureText(error, incoming.locale),
      });
    } catch {
      /* The interaction may already have a reply. */
    }
  }
}

async function answerSuggest(
  client: BotConnection,
  commands: () => readonly Command[],
  incoming: IncomingSuggest,
  bot: DiscordProfile
): Promise<void> {
  try {
    const command = commands().find((entry) => entry.name === incoming.name);

    if (!command || !client.replyToSuggest) {
      await client.replyToSuggest?.(incoming.id, incoming.token, []);
      return;
    }

    const leaf = resolveLeaf(command, incoming.options);
    const option = leaf.options[incoming.focused.name];

    if (
      !option ||
      (option.kind !== "text" && option.kind !== "number" && option.kind !== "decimal") ||
      !option.suggest
    ) {
      await client.replyToSuggest(incoming.id, incoming.token, []);
      return;
    }

    const users = knownUsers(bot, incoming.users);
    const channels = incoming.channels.map((entry) => ({ id: entry.id, name: entry.name }));
    const knownRoles = incoming.roles.map((entry) => ({ id: entry.id, name: entry.name }));
    const files = incoming.files.map((entry) => ({
      id: entry.id,
      name: entry.name,
      url: entry.url,
      ...(entry.size === undefined ? {} : { size: entry.size }),
      ...(entry.type === undefined ? {} : { type: entry.type }),
    }));

    const lookups = createLookups({
      users,
      bot: { id: bot.id },
      ...(incoming.channelId ? { channel: { id: incoming.channelId, name: "channel" } } : {}),
      ...(channels.length > 0 ? { channels } : {}),
      ...(knownRoles.length > 0 ? { knownRoles } : {}),
      ...(files.length > 0 ? { files } : {}),
    });

    const items = await option.suggest({
      ...lookups,
      author: { id: incoming.author.id },
      typed: incoming.focused.typed,
      focused: incoming.focused.name,
    });

    await client.replyToSuggest(
      incoming.id,
      incoming.token,
      toSuggestChoices(items, option.kind)
    );
  } catch (error) {
    console.error("[Draeven] Suggest failed.", error);

    try {
      await client.replyToSuggest?.(incoming.id, incoming.token, []);
    } catch {
      /* Autocomplete may already have timed out. */
    }
  }
}

async function answerAndReply(
  client: BotConnection,
  commands: () => readonly Command[],
  incoming: IncomingCommand,
  bot: DiscordProfile & { applicationId: string },
  actions: Map<string, Press>,
  cooldowns: CooldownBook,
  collectors: CollectorBook,
  timeZone?: string,
  report?: (error: unknown) => void,
  autoDeferOption?: boolean | number
): Promise<void> {
  let deferred = false;
  let removed = false;
  let posted = false;
  let pendingSubmit: { id: string; token: string } | undefined;
  let autoDeferTimer: ReturnType<typeof setTimeout> | undefined;

  const clearAutoDefer = () => {
    if (autoDeferTimer) {
      clearTimeout(autoDeferTimer);
      autoDeferTimer = undefined;
    }
  };

  try {
    const command = commands().find((entry) => entry.name === incoming.name);
    const cooling = command ? readCooldown(command.meta?.cooldown) : undefined;

    if (cooling) {
      const key = cooldownKey(incoming.name, cooling.scope, {
        userId: incoming.author.id,
        ...(incoming.guildId ? { guildId: incoming.guildId } : {}),
        ...(incoming.channelId ? { channelId: incoming.channelId } : {}),
      });

      if (key) {
        const left = cooldowns.take(key, cooling.seconds);

        if (left > 0) {
          await client.replyTo(incoming.id, incoming.token, {
            content: frame("cooldown", incoming.locale, {
              name: incoming.name,
              seconds: left,
            }),
            ...(cooling.private ? { flags: EPHEMERAL } : {}),
          });
          return;
        }
      }
    }

    const guild = incoming.guildId ? await loadGuild(client, incoming.guildId) : undefined;

    if (command?.meta) {
      const blocked = await checkGates(command.meta, {
        author: { id: incoming.author.id },
        ...(incoming.locale ? { locale: incoming.locale } : {}),
        ...(guild ? { guild } : {}),
        ...(incoming.member?.permissions
          ? { memberPermissions: incoming.member.permissions }
          : {}),
        ...(guild?.ownerId ? { ownerId: guild.ownerId } : {}),
        bot: { id: bot.id },
        users: knownUsers(bot, incoming.users),
      });

      if (blocked) {
        await client.replyTo(incoming.id, incoming.token, {
          content: frame(blocked, incoming.locale),
          flags: EPHEMERAL,
        });
        return;
      }
    }

    if (command?.meta?.defer) {
      const privateDefer =
        typeof command.meta.defer === "object" && command.meta.defer.private === true;
      await client.defer(incoming.id, incoming.token, { private: privateDefer });
      deferred = true;
    } else {
      const delay = resolveAutoDeferMs(command?.meta?.autoDefer, autoDeferOption);

      if (delay !== undefined) {
        autoDeferTimer = setTimeout(() => {
          if (deferred || posted || removed) {
            return;
          }

          void client
            .defer(incoming.id, incoming.token)
            .then(() => {
              deferred = true;
            })
            .catch(() => undefined);
        }, delay);
      }
    }

    const mod = createActions(incoming.guildId, client);
    const transcript = async (options?: TranscriptOptions) => {
      const choice = readTranscriptChoice(options, timeZone);

      if (!incoming.channelId) {
        throw new Error("[Draeven] This command has no channel.");
      }

      clearAutoDefer();

      if (!deferred) {
        await client.defer(incoming.id, incoming.token);
        deferred = true;
      }

      const history = await client.readHistory(incoming.channelId);
      const roles = incoming.guildId ? await client.readRoles(incoming.guildId) : [];
      const profiles = await loadProfiles(client, history.messages);
      return renderTranscript(history, {
        ...choice,
        ...(guild?.name ? { guildName: guild.name } : {}),
        roles,
        profiles,
      });
    };
    const reply = await answerCommand(
      commands(),
      incoming,
      bot,
      guild,
      transcript,
      client.sendMessage
        ? async (channelId, message) => {
            await client.sendMessage!(channelId, toOutgoing(message));
          }
        : undefined,
      {
        wait: async (options) => {
          clearAutoDefer();
          if (!deferred) {
            await client.defer(incoming.id, incoming.token, options);
            deferred = true;
          }
        },
        edit: async (message) => {
          clearAutoDefer();
          if (!deferred) {
            await client.defer(incoming.id, incoming.token, {
              private: message.private === true,
            });
            deferred = true;
          }

          remember(actions, message);
          await client.editReply(bot.applicationId, incoming.token, toOutgoing(message));
        },
        remove: async () => {
          clearAutoDefer();
          if (!deferred) {
            await client.defer(incoming.id, incoming.token);
            deferred = true;
          }

          if (!client.deleteReply) {
            throw new Error("[Draeven] This connection cannot remove replies.");
          }

          await client.deleteReply(bot.applicationId, incoming.token);
          removed = true;
        },
        flush: async (message) => {
          clearAutoDefer();
          if (message.form && deferred) {
            throw new Error("[Draeven] A form cannot follow wait(). Reply with the form first.");
          }

          remember(actions, message);
          const outgoing = toOutgoing(message);

          if (deferred || posted) {
            await client.editReply(bot.applicationId, incoming.token, outgoing);
          } else {
            await client.replyTo(incoming.id, incoming.token, outgoing);
            posted = true;
          }
        },
        collect: async (options) => {
          const hit = await collectors.wait({
            ...options,
            authorId: incoming.author.id,
          });

          if (hit?.kind === "submit" && hit.interaction) {
            pendingSubmit = hit.interaction;
          }

          return hit;
        },
      },
      mod
    );

    clearAutoDefer();

    if (!reply) {
      return;
    }

    if (removed || reply.text === "Removed.") {
      return;
    }

    remember(actions, reply);
    const outgoing = toOutgoing(reply);

    if (pendingSubmit) {
      await client.replyTo(pendingSubmit.id, pendingSubmit.token, outgoing);
      await flushFollowups(client, bot.applicationId, pendingSubmit.token, reply, actions);
      return;
    }

    if (deferred || reply.deferred || posted) {
      const hosted = await client.editReply(bot.applicationId, incoming.token, outgoing);
      const download = reply.file && hosted ? downloadLine(outgoing.content, hosted) : undefined;

      if (download) {
        await client.editReply(bot.applicationId, incoming.token, { content: download, flags: 4 });
      }

      await flushFollowups(client, bot.applicationId, incoming.token, reply, actions);
      return;
    }

    await client.replyTo(incoming.id, incoming.token, outgoing);
    await flushFollowups(client, bot.applicationId, incoming.token, reply, actions);
  } catch (error) {
    clearAutoDefer();

    if (report) {
      report(error);
    } else {
      console.error("[Draeven] Command failed.", error);
    }

    const text = failureText(error, incoming.locale);

    try {
      if (pendingSubmit) {
        await client.replyTo(pendingSubmit.id, pendingSubmit.token, { content: text });
        return;
      }

      if (deferred || posted) {
        await client.editReply(bot.applicationId, incoming.token, { content: text });
        return;
      }

      await client.replyTo(incoming.id, incoming.token, { content: text });
    } catch {
      /* The interaction may already have a reply. */
    }
  }
}

function resolveAutoDeferMs(
  commandSetting: boolean | undefined,
  startSetting: boolean | number | undefined
): number | undefined {
  if (commandSetting === false) {
    return undefined;
  }

  if (startSetting === false) {
    return undefined;
  }

  if (typeof startSetting === "number") {
    return Math.min(Math.max(startSetting, 500), 2500);
  }

  /* Default on: defer at 2s so Discord's 3s window is kept. */
  return 2000;
}

async function answerUse(
  client: BotConnection,
  actions: Map<string, Press>,
  collectors: CollectorBook,
  uses: () => readonly Use[],
  use: IncomingUse,
  bot: DiscordProfile,
  report?: (error: unknown) => void
): Promise<void> {
  const collected = collectors.take(use);

  if (collected) {
    if (use.kind === "submit") {
      /* Leave the submit unacked; the waiting command answers it. */
      return;
    }

    try {
      if (client.deferUpdate) {
        await client.deferUpdate(use.id, use.token);
      } else {
        await client.replyTo(use.id, use.token, {
          content: "\u200b",
          update: true,
        });
      }
    } catch (error) {
      console.error("[Draeven] Collector ack failed.", error);
    }

    return;
  }

  const remembered = actions.get(use.customId);
  const fromFolder = remembered ? undefined : findUse(uses(), use.customId, use.kind);
  const handler = remembered ?? fromFolder?.run;

  try {
    const guild = use.guildId ? await loadGuild(client, use.guildId) : undefined;
    const people = use.users.some((person) => person.id === use.author.id)
      ? use.users
      : [use.author, ...use.users];
    const reply = handler
      ? await runPress(handler, {
          author: { id: use.author.id },
          id: use.customId,
          values: use.values,
          fields: use.fields,
          users: knownUsers(bot, people),
          bot: { id: bot.id },
          ...(guild ? { guild } : {}),
          ...(use.messageId ? { messageId: use.messageId } : {}),
          ...(use.channelId ? { channel: { id: use.channelId, name: use.channelId } } : {}),
        })
      : { text: "Received." };

    remember(actions, reply);
    const outgoing = toOutgoing(reply);

    if (use.kind === "press" && (reply.embed || reply.rows || reply.picture)) {
      outgoing.update = true;
    }

    await client.replyTo(use.id, use.token, outgoing);
  } catch (error) {
    if (report) {
      report(error);
    } else {
      console.error("[Draeven] Component failed.", error);
    }

    try {
      await client.replyTo(use.id, use.token, {
        content: "The command failed.",
      });
    } catch {
      /* The interaction may already have a reply. */
    }
  }
}

function knownUsers(bot: DiscordProfile, people: readonly DiscordProfile[]): User[] {
  const profiles = new Map<string, DiscordProfile>();
  profiles.set(bot.id, bot);

  for (const person of people) {
    profiles.set(person.id, person);
  }

  return [...profiles.values()].map((profile) => ({
    id: profile.id,
    name: profile.name,
    bot: profile.bot,
    createdAt: createdAtFromId(profile.id),
    ...(profile.icon ? { icon: profile.icon } : {}),
  }));
}

async function loadGuild(client: BotConnection, guildId: string): Promise<Guild> {
  try {
    const found = await client.readGuild(guildId);

    if (found) {
      return found;
    }
  } catch (error) {
    console.error("[Draeven] Guild lookup failed.", error);
  }

  return { id: guildId, name: "Server" };
}

function downloadLine(note: string | undefined, url: string): string | undefined {
  if (url.includes(")") || url.includes(" ")) {
    return undefined;
  }

  const line = `${note ?? ""}\n[Download](${url})`.trim();
  return line.length <= 2000 ? line : undefined;
}

async function loadProfiles(
  client: BotConnection,
  messages: readonly unknown[]
): Promise<DiscordUserCard[]> {
  const ids: string[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    if (typeof message !== "object" || message === null || !("author" in message)) {
      continue;
    }

    const author = message.author;

    if (typeof author !== "object" || author === null || !("id" in author) || typeof author.id !== "string") {
      continue;
    }

    if (!seen.has(author.id)) {
      seen.add(author.id);
      ids.push(author.id);
    }
  }

  const cards: DiscordUserCard[] = [];

  for (let index = 0; index < ids.length && index < 60; index += 4) {
    const batch = await Promise.all(
      ids.slice(index, index + 4).map(async (id) => {
        try {
          return await client.readUser(id);
        } catch {
          return undefined;
        }
      })
    );

    for (const card of batch) {
      if (card) {
        cards.push(card);
      }
    }
  }

  return cards;
}

function failureText(error: unknown, locale?: string): string {
  if (error instanceof Error && error.message.startsWith("[Draeven]") && error.message.length <= 180) {
    return error.message.replace(/^\[Draeven( Discord)?\]\s*/, "");
  }

  return frame("failed", locale);
}

function remember(actions: Map<string, Press>, reply: Reply): void {
  for (const action of actionsIn(reply)) {
    actions.set(action.id, action.run);
  }

  if (reply.layout) {
    for (const action of layoutActions(reply.layout)) {
      actions.set(action.id, action.run);
    }
  }

  for (const next of reply.followups ?? []) {
    remember(actions, next);
  }
}

async function flushFollowups(
  client: BotConnection,
  applicationId: string,
  token: string,
  reply: Reply,
  actions: Map<string, Press>
): Promise<void> {
  if (!reply.followups?.length) {
    return;
  }

  if (!client.followUp) {
    throw new Error("[Draeven] This connection cannot send followups.");
  }

  for (const next of reply.followups) {
    remember(actions, { ...next, followups: undefined });
    await client.followUp(applicationId, token, toOutgoing(next));
  }
}

function toOutgoing(reply: Reply): InteractionReply {
  if (reply.form) {
    return { modal: discordForm(reply.form) };
  }

  if (reply.poll) {
    if (reply.private) {
      throw new Error("[Draeven] A poll cannot be private.");
    }

    return { poll: discordPoll(reply.poll) };
  }

  if (reply.layout) {
    const components = [
      ...discordLayout(reply.layout),
      ...(reply.rows === undefined ? [] : discordRows(reply.rows)),
    ];
    const flags = COMPONENTS_V2 | (reply.private ? EPHEMERAL : 0);

    return {
      components,
      flags,
    };
  }

  const rows = reply.rows === undefined ? undefined : discordRows(reply.rows);
  const files = [
    ...(reply.picture === undefined
      ? []
      : [{ filename: "picture.png", bytes: reply.picture.png(), type: "image/png" }]),
    ...(reply.file === undefined
      ? []
      : [{ filename: reply.file.name, bytes: reply.file.bytes, type: reply.file.type }]),
  ];

  if (!reply.text && !reply.embed && rows === undefined && files.length === 0) {
    throw new Error("[Draeven] A reply needs text, an embed, a row, or a picture.");
  }

  return {
    ...(reply.text ? { content: reply.text } : {}),
    ...(reply.embed ? { embeds: [toDiscordEmbed(reply.embed)] } : {}),
    ...(rows === undefined ? {} : { components: rows }),
    ...(files.length === 0 ? {} : { files }),
    ...(reply.private ? { flags: EPHEMERAL } : {}),
  };
}

function toDiscordEmbed(card: Embed): DiscordEmbed {
  return {
    ...(card.header?.title ? { title: card.header.title } : {}),
    ...(card.description ? { description: card.description } : {}),
    ...(card.header?.link ? { url: card.header.link } : {}),
    ...(card.color !== undefined ? { color: card.color } : {}),
    ...(card.timestamp ? { timestamp: card.timestamp } : {}),
    ...(card.author
      ? {
          author: {
            name: card.author.name,
            ...(card.author.link ? { url: card.author.link } : {}),
            ...(card.author.icon ? { icon_url: card.author.icon } : {}),
          },
        }
      : {}),
    ...(card.footer
      ? {
          footer: {
            text: card.footer.text,
            ...(card.footer.icon ? { icon_url: card.footer.icon } : {}),
          },
        }
      : {}),
    ...(card.header?.image ? { thumbnail: { url: card.header.image } } : {}),
    ...(card.image ? { image: { url: card.image } } : {}),
    ...(card.fields.length > 0
      ? {
          fields: card.fields.map((field) => ({
            name: field.name,
            value: field.value,
            inline: field.inline,
          })),
        }
      : {}),
  };
}

function toApplicationCommands(
  commands: readonly LoadableCommand[]
): ApplicationCommandBody[] {
  return commands.map((entry) => {
    if (entry.kind === "user-menu" || entry.kind === "message-menu") {
      return {
        type: entry.kind === "user-menu" ? 2 : 3,
        name: entry.name,
        ...readMeta(entry.meta),
      };
    }

    const meta = readMeta(entry.meta);
    const branchNames = Object.keys(entry.subs);

    if (branchNames.length > 0) {
      const options = Object.entries(entry.subs).map(([name, branch]) =>
        toApplicationBranch(name, branch)
      );

      return {
        type: 1,
        name: entry.name,
        description: entry.description,
        options,
        ...meta,
      };
    }

    /* Discord requires required options before optional ones. */
    const options = Object.entries(entry.options)
      .sort((left, right) => Number(right[1].required) - Number(left[1].required))
      .map(([name, option]) => toApplicationOption(name, option));

    return {
      type: 1,
      name: entry.name,
      description: entry.description,
      ...(options.length > 0 ? { options } : {}),
      ...meta,
    };
  });
}

function toApplicationBranch(
  name: string,
  branch: StoredBranch
): ApplicationCommandOptionBody {
  if (branch.kind === "sub") {
    return toApplicationSub(name, branch);
  }

  return {
    type: 2,
    name,
    description: branch.description,
    ...(branch.locales ? { description_localizations: { ...branch.locales } } : {}),
    ...(branch.names ? { name_localizations: { ...branch.names } } : {}),
    options: Object.entries(branch.subs).map(([subName, sub]) =>
      toApplicationSub(subName, sub)
    ),
  };
}

function toApplicationSub(name: string, sub: StoredSub): ApplicationCommandOptionBody {
  const options = Object.entries(sub.options)
    .sort((left, right) => Number(right[1].required) - Number(left[1].required))
    .map(([optionName, option]) => toApplicationOption(optionName, option));

  return {
    type: 1,
    name,
    description: sub.description,
    ...(sub.locales ? { description_localizations: { ...sub.locales } } : {}),
    ...(sub.names ? { name_localizations: { ...sub.names } } : {}),
    ...(options.length > 0 ? { options } : {}),
  };
}

function toApplicationOption(
  name: string,
  option: StoredOption
): ApplicationCommandOptionBody {
  const base = {
    name,
    description: option.question,
    required: option.required,
    ...(option.locales ? { description_localizations: { ...option.locales } } : {}),
    ...(option.names ? { name_localizations: { ...option.names } } : {}),
  };

  switch (option.kind) {
    case "user":
      return { ...base, type: 6 };
    case "text":
      return {
        ...base,
        type: 3,
        ...(option.suggest ? { autocomplete: true } : {}),
        ...(option.min === undefined ? {} : { min_length: option.min }),
        ...(option.max === undefined ? {} : { max_length: option.max }),
      };
    case "number":
    case "decimal":
      return {
        ...base,
        type: option.kind === "decimal" ? 10 : 4,
        ...(option.suggest ? { autocomplete: true } : {}),
        ...(option.min === undefined ? {} : { min_value: option.min }),
        ...(option.max === undefined ? {} : { max_value: option.max }),
        ...(option.picks
          ? {
              choices: option.picks.map((item) => ({
                name: item.label,
                value: item.value,
                ...(item.locales ? { name_localizations: { ...item.locales } } : {}),
              })),
            }
          : {}),
      };
    case "choice":
      return {
        ...base,
        type: 3,
        choices: option.choices.map((item) => ({
          name: item.label,
          value: item.value,
          ...(item.locales ? { name_localizations: { ...item.locales } } : {}),
        })),
      };
    case "channel":
      return {
        ...base,
        type: 7,
        ...(option.kinds ? { channel_types: option.kinds.map(channelTypeOf) } : {}),
      };
    case "role":
      return { ...base, type: 8 };
    case "file":
      return { ...base, type: 11 };
    case "flag":
      return { ...base, type: 5 };
    case "mentionable":
      return { ...base, type: 9 };
  }
}

const channelTypeNumber: Record<ChannelKind, number> = {
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

function channelTypeOf(kind: ChannelKind): number {
  return channelTypeNumber[kind];
}

function assertGuildId(guildId: string | undefined): void {
  if (guildId !== undefined && !/^\d{1,20}$/.test(guildId)) {
    throw new Error("[Draeven] Guild id must be a Discord snowflake.");
  }
}
