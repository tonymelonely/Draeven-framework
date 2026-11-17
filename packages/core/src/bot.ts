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
  type GatewayMember,
  type GatewayMessage,
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
  /** Typed gateway event handlers. */
  events?: {
    memberJoin?: (member: GatewayMember) => void | Promise<void>;
    memberLeave?: (member: GatewayMember) => void | Promise<void>;
    message?: (message: GatewayMessage) => void | Promise<void>;
  };
}

export type { Presence, PresenceActivity, PresenceStatus, ActivityKind } from "@draeven/discord";
export { intents, intentBits } from "@draeven/discord";

export interface Bot {
  readonly commands: readonly LoadableCommand[];
  stop(): Promise<void>;
  /** Post a message to a channel outside a slash reply. */
  send(
    channel: { id: string } | string,
    message: string | Message | Embed | Row | Canvas | Poll | Layout
  ): Promise<void>;
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

  const commands = await resolveStartCommands(options.commands);
  assertCommands(commands.filter(isCommand));
  assertGuildId(options.guildId);

  if (options.timeZone !== undefined) {
    resolveTimeZone(options.timeZone);
  }

  return startBot(
    new DiscordClient({
      token,
      ...(options.presence ? { presence: options.presence } : {}),
      ...(options.intents !== undefined ? { intents: options.intents } : {}),
    }),
    {
      commands,
      guildId: options.guildId,
      timeZone: options.timeZone,
      events: options.events,
    }
  );
}

async function resolveStartCommands(
  commands: StartOptions["commands"]
): Promise<LoadableCommand[]> {
  if (Array.isArray(commands)) {
    return [...commands];
  }

  if (typeof commands === "string" || commands instanceof URL) {
    const folder =
      typeof commands === "string" ? resolveCommandsFolder(commands) : commands;
    return loadCommands(folder);
  }

  const config = await readConfig();
  return loadCommands(config.commandsFolder);
}

/* Register commands and answer them. Tests can pass a fake connection. */
export async function startBot(
  client: BotConnection,
  options: {
    commands: readonly LoadableCommand[];
    guildId?: string;
    timeZone?: string;
    events?: StartOptions["events"];
  }
): Promise<Bot> {
  const commands = [...options.commands];
  const slash = commands.filter(isCommand);
  assertCommands(slash);
  assertGuildId(options.guildId);

  await client.start();
  const bot = client.readyUser();
  await client.registerCommands(toApplicationCommands(commands), options.guildId);

  const actions = new Map<string, Press>();
  const cooldowns = new CooldownBook();
  const collectors = new CollectorBook();
  const unsubEvents: Array<() => void> = [];

  if (options.events?.memberJoin && client.onMemberJoin) {
    unsubEvents.push(client.onMemberJoin(options.events.memberJoin));
  }

  if (options.events?.memberLeave && client.onMemberLeave) {
    unsubEvents.push(client.onMemberLeave(options.events.memberLeave));
  }

  if (options.events?.message && client.onMessage) {
    unsubEvents.push(client.onMessage(options.events.message));
  }

  client.onCommand((incoming) =>
    answerAndReply(client, slash, incoming, bot, actions, cooldowns, collectors, options.timeZone)
  );
  client.onMenu?.((incoming) =>
    answerMenuAndReply(client, commands.filter(isMenu), incoming, bot, actions)
  );
  client.onSuggest?.((incoming) => answerSuggest(client, slash, incoming, bot));
  client.onUse((use) => answerUse(client, actions, collectors, use, bot));

  return {
    commands,
    async stop() {
      for (const stop of unsubEvents) {
        stop();
      }

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
    onMemberJoin(handler) {
      if (!client.onMemberJoin) {
        throw new Error("[Draeven] This connection has no member join events.");
      }

      return client.onMemberJoin(handler);
    },
    onMemberLeave(handler) {
      if (!client.onMemberLeave) {
        throw new Error("[Draeven] This connection has no member leave events.");
      }

      return client.onMemberLeave(handler);
    },
    onMessage(handler) {
      if (!client.onMessage) {
        throw new Error("[Draeven] This connection has no message events.");
      }

      return client.onMessage(handler);
    },
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
  }
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
  menus: readonly MenuCommand[],
  incoming: IncomingMenu,
  bot: DiscordProfile & { applicationId: string },
  actions: Map<string, Press>
): Promise<void> {
  try {
    const entry = menus.find(
      (menu) => menu.kind === incoming.kind && menu.name === incoming.name
    );

    if (!entry) {
      return;
    }

    const guild = incoming.guildId ? await loadGuild(client, incoming.guildId) : undefined;
    const users = knownUsers(bot, incoming.users);
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
          });

    remember(actions, reply);
    await client.replyTo(incoming.id, incoming.token, toOutgoing(reply));
  } catch (error) {
    console.error("[Draeven] Menu failed.", error);

    try {
      await client.replyTo(incoming.id, incoming.token, {
        content: failureText(error),
      });
    } catch {
      /* The interaction may already have a reply. */
    }
  }
}

async function answerSuggest(
  client: BotConnection,
  commands: readonly Command[],
  incoming: IncomingSuggest,
  bot: DiscordProfile
): Promise<void> {
  try {
    const command = commands.find((entry) => entry.name === incoming.name);

    if (!command || !client.replyToSuggest) {
      await client.replyToSuggest?.(incoming.id, incoming.token, []);
      return;
    }

    const leaf = resolveLeaf(command, incoming.options);
    const option = leaf.options[incoming.focused.name];

    if (!option || (option.kind !== "text" && option.kind !== "number") || !option.suggest) {
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
  commands: readonly Command[],
  incoming: IncomingCommand,
  bot: DiscordProfile & { applicationId: string },
  actions: Map<string, Press>,
  cooldowns: CooldownBook,
  collectors: CollectorBook,
  timeZone?: string
): Promise<void> {
  let deferred = false;
  let removed = false;
  let posted = false;

  try {
    const command = commands.find((entry) => entry.name === incoming.name);
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
            content: `Wait ${left}s before using /${incoming.name} again.`,
            ...(cooling.private ? { flags: EPHEMERAL } : {}),
          });
          return;
        }
      }
    }

    const guild = incoming.guildId ? await loadGuild(client, incoming.guildId) : undefined;
    const transcript = async (options?: TranscriptOptions) => {
      const choice = readTranscriptChoice(options, timeZone);

      if (!incoming.channelId) {
        throw new Error("[Draeven] This command has no channel.");
      }

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
      commands,
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
          if (!deferred) {
            await client.defer(incoming.id, incoming.token, options);
            deferred = true;
          }
        },
        edit: async (message) => {
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
          remember(actions, message);
          const outgoing = toOutgoing(message);

          if (deferred || posted) {
            await client.editReply(bot.applicationId, incoming.token, outgoing);
          } else {
            await client.replyTo(incoming.id, incoming.token, outgoing);
            posted = true;
          }
        },
        collect: (options) =>
          collectors.wait({
            ...options,
            authorId: incoming.author.id,
          }),
      }
    );

    if (!reply) {
      return;
    }

    if (removed || reply.text === "Removed.") {
      return;
    }

    remember(actions, reply);
    const outgoing = toOutgoing(reply);

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
    console.error("[Draeven] Command failed.", error);
    const text = failureText(error);

    try {
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

async function answerUse(
  client: BotConnection,
  actions: Map<string, Press>,
  collectors: CollectorBook,
  use: IncomingUse,
  bot: DiscordProfile
): Promise<void> {
  const collected = collectors.take(use);

  if (collected) {
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

  const handler = actions.get(use.customId);

  try {
    const guild = use.guildId ? await loadGuild(client, use.guildId) : undefined;
    const people = use.users.some((person) => person.id === use.author.id)
      ? use.users
      : [use.author, ...use.users];
    const reply = handler
      ? await runPress(handler, {
          author: { id: use.author.id },
          values: use.values,
          fields: use.fields,
          users: knownUsers(bot, people),
          bot: { id: bot.id },
          ...(guild ? { guild } : {}),
        })
      : { text: "Received." };

    remember(actions, reply);
    const outgoing = toOutgoing(reply);

    if (use.kind === "press" && (reply.embed || reply.rows || reply.picture)) {
      outgoing.update = true;
    }

    await client.replyTo(use.id, use.token, outgoing);
  } catch (error) {
    console.error("[Draeven] Component failed.", error);

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

function failureText(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("[Draeven]") && error.message.length <= 180) {
    return error.message.replace(/^\[Draeven( Discord)?\]\s*/, "");
  }

  return "The command failed.";
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
      return {
        ...base,
        type: 4,
        ...(option.suggest ? { autocomplete: true } : {}),
        ...(option.min === undefined ? {} : { min_value: option.min }),
        ...(option.max === undefined ? {} : { max_value: option.max }),
      };
    case "choice":
      return {
        ...base,
        type: 3,
        choices: option.choices.map((item) => ({
          name: item.label,
          value: item.value,
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
