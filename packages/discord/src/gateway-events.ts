/* Draeven Discord: typed Gateway event payloads */

import { readDiscordProfile } from "./discord-user.js";

export interface GatewayMember {
  readonly id: string;
  readonly name: string;
  readonly bot: boolean;
  readonly guildId: string;
  readonly nick?: string;
  readonly joinedAt?: Date;
  readonly icon?: string;
  readonly roleIds?: readonly string[];
}

export interface GatewayMessage {
  readonly id: string;
  readonly channelId: string;
  readonly guildId?: string;
  readonly content: string;
  readonly author: {
    readonly id: string;
    readonly name: string;
    readonly bot: boolean;
    readonly icon?: string;
  };
}

export interface GatewayReady {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly bot: boolean;
    readonly icon?: string;
  };
  readonly guildIds: readonly string[];
}

export interface GatewayGuild {
  readonly id: string;
  readonly name?: string;
  readonly unavailable?: boolean;
}

export interface GatewayChannel {
  readonly id: string;
  readonly guildId?: string;
  readonly name?: string;
  readonly type?: number;
  readonly parentId?: string;
}

export interface GatewayRole {
  readonly id: string;
  readonly guildId: string;
  readonly name: string;
  readonly color?: number;
  readonly position?: number;
}

export interface GatewayBan {
  readonly guildId: string;
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly bot: boolean;
    readonly icon?: string;
  };
}

export interface GatewayMessageDelete {
  readonly id: string;
  readonly channelId: string;
  readonly guildId?: string;
}

export interface GatewayMessageBulkDelete {
  readonly ids: readonly string[];
  readonly channelId: string;
  readonly guildId?: string;
}

export interface GatewayReaction {
  readonly messageId: string;
  readonly channelId: string;
  readonly guildId?: string;
  readonly userId: string;
  readonly emoji: { readonly id?: string; readonly name?: string };
}

export interface GatewayReactionClear {
  readonly messageId: string;
  readonly channelId: string;
  readonly guildId?: string;
}

export interface GatewayReactionClearEmoji extends GatewayReactionClear {
  readonly emoji: { readonly id?: string; readonly name?: string };
}

export interface GatewayVoice {
  readonly guildId: string;
  readonly userId: string;
  readonly channelId?: string;
  readonly sessionId?: string;
  readonly deaf?: boolean;
  readonly mute?: boolean;
  readonly selfDeaf?: boolean;
  readonly selfMute?: boolean;
}

export interface GatewayInvite {
  readonly code: string;
  readonly guildId?: string;
  readonly channelId?: string;
}

export interface GatewayTyping {
  readonly channelId: string;
  readonly userId: string;
  readonly guildId?: string;
}

export interface GatewayPresence {
  readonly guildId?: string;
  readonly userId: string;
  readonly status?: string;
}

export interface GatewaySchedule {
  readonly id: string;
  readonly guildId: string;
  readonly name?: string;
  readonly status?: number;
}

export interface GatewayPollVote {
  readonly userId: string;
  readonly channelId: string;
  readonly messageId: string;
  readonly guildId?: string;
  readonly answerId: number;
}

export type GatewayEvents = {
  ready: GatewayReady;
  resumed: Record<string, never>;
  guildJoin: GatewayGuild;
  guildLeave: GatewayGuild;
  guildUpdate: GatewayGuild;
  channelCreate: GatewayChannel;
  channelUpdate: GatewayChannel;
  channelDelete: GatewayChannel;
  threadCreate: GatewayChannel;
  threadUpdate: GatewayChannel;
  threadDelete: GatewayChannel;
  roleCreate: GatewayRole;
  roleUpdate: GatewayRole;
  roleDelete: GatewayRole;
  memberJoin: GatewayMember;
  memberLeave: GatewayMember;
  memberUpdate: GatewayMember;
  memberBan: GatewayBan;
  memberUnban: GatewayBan;
  message: GatewayMessage;
  messageEdit: GatewayMessage;
  messageDelete: GatewayMessageDelete;
  messageBulkDelete: GatewayMessageBulkDelete;
  reactionAdd: GatewayReaction;
  reactionRemove: GatewayReaction;
  reactionClear: GatewayReactionClear;
  reactionClearEmoji: GatewayReactionClearEmoji;
  voiceUpdate: GatewayVoice;
  inviteCreate: GatewayInvite;
  inviteDelete: GatewayInvite;
  typing: GatewayTyping;
  presenceUpdate: GatewayPresence;
  scheduleCreate: GatewaySchedule;
  scheduleUpdate: GatewaySchedule;
  scheduleDelete: GatewaySchedule;
  pollVoteAdd: GatewayPollVote;
  pollVoteRemove: GatewayPollVote;
};

export type GatewayEventName = keyof GatewayEvents;

type Reader<K extends GatewayEventName> = (data: unknown) => GatewayEvents[K] | undefined;

export const gatewayEventReaders: {
  readonly [K in GatewayEventName]: { readonly t: string; readonly read: Reader<K> };
} = {
  ready: { t: "READY", read: readReadyEvent },
  resumed: { t: "RESUMED", read: () => ({}) },
  guildJoin: { t: "GUILD_CREATE", read: readGuild },
  guildLeave: { t: "GUILD_DELETE", read: readGuild },
  guildUpdate: { t: "GUILD_UPDATE", read: readGuild },
  channelCreate: { t: "CHANNEL_CREATE", read: readChannel },
  channelUpdate: { t: "CHANNEL_UPDATE", read: readChannel },
  channelDelete: { t: "CHANNEL_DELETE", read: readChannel },
  threadCreate: { t: "THREAD_CREATE", read: readChannel },
  threadUpdate: { t: "THREAD_UPDATE", read: readChannel },
  threadDelete: { t: "THREAD_DELETE", read: readChannel },
  roleCreate: { t: "GUILD_ROLE_CREATE", read: readRoleCreate },
  roleUpdate: { t: "GUILD_ROLE_UPDATE", read: readRoleCreate },
  roleDelete: { t: "GUILD_ROLE_DELETE", read: readRoleDelete },
  memberJoin: { t: "GUILD_MEMBER_ADD", read: readMemberJoin },
  memberLeave: { t: "GUILD_MEMBER_REMOVE", read: readMemberLeave },
  memberUpdate: { t: "GUILD_MEMBER_UPDATE", read: readMemberUpdate },
  memberBan: { t: "GUILD_BAN_ADD", read: readBan },
  memberUnban: { t: "GUILD_BAN_REMOVE", read: readBan },
  message: { t: "MESSAGE_CREATE", read: readGatewayMessage },
  messageEdit: { t: "MESSAGE_UPDATE", read: readGatewayMessage },
  messageDelete: { t: "MESSAGE_DELETE", read: readMessageDelete },
  messageBulkDelete: { t: "MESSAGE_DELETE_BULK", read: readMessageBulkDelete },
  reactionAdd: { t: "MESSAGE_REACTION_ADD", read: readReaction },
  reactionRemove: { t: "MESSAGE_REACTION_REMOVE", read: readReaction },
  reactionClear: { t: "MESSAGE_REACTION_REMOVE_ALL", read: readReactionClear },
  reactionClearEmoji: { t: "MESSAGE_REACTION_REMOVE_EMOJI", read: readReactionClearEmoji },
  voiceUpdate: { t: "VOICE_STATE_UPDATE", read: readVoice },
  inviteCreate: { t: "INVITE_CREATE", read: readInvite },
  inviteDelete: { t: "INVITE_DELETE", read: readInvite },
  typing: { t: "TYPING_START", read: readTyping },
  presenceUpdate: { t: "PRESENCE_UPDATE", read: readPresence },
  scheduleCreate: { t: "GUILD_SCHEDULED_EVENT_CREATE", read: readSchedule },
  scheduleUpdate: { t: "GUILD_SCHEDULED_EVENT_UPDATE", read: readSchedule },
  scheduleDelete: { t: "GUILD_SCHEDULED_EVENT_DELETE", read: readSchedule },
  pollVoteAdd: { t: "MESSAGE_POLL_VOTE_ADD", read: readPollVote },
  pollVoteRemove: { t: "MESSAGE_POLL_VOTE_REMOVE", read: readPollVote },
};

export const gatewayEventNames = Object.keys(gatewayEventReaders) as GatewayEventName[];

export function readMemberJoin(data: unknown): GatewayMember | undefined {
  return readMemberEvent(data);
}

export function readMemberLeave(data: unknown): GatewayMember | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const guildId = stringField(data, "guild_id");
  const user = "user" in data ? readDiscordProfile(data.user) : undefined;

  if (!guildId || !user) {
    return undefined;
  }

  return {
    id: user.id,
    name: user.name,
    bot: user.bot,
    guildId,
    ...(user.icon ? { icon: user.icon } : {}),
  };
}

export function readGatewayMessage(data: unknown): GatewayMessage | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const id = stringField(data, "id");
  const channelId = stringField(data, "channel_id");
  const content = "content" in data && typeof data.content === "string" ? data.content : "";
  const author = "author" in data ? readDiscordProfile(data.author) : undefined;

  if (!id || !channelId || !author) {
    return undefined;
  }

  return {
    id,
    channelId,
    content,
    author: {
      id: author.id,
      name: author.name,
      bot: author.bot,
      ...(author.icon ? { icon: author.icon } : {}),
    },
    ...(stringField(data, "guild_id") ? { guildId: stringField(data, "guild_id") } : {}),
  };
}

function readReadyEvent(data: unknown): GatewayReady | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const user = "user" in data ? readDiscordProfile(data.user) : undefined;

  if (!user) {
    return undefined;
  }

  const guildIds: string[] = [];

  if ("guilds" in data && Array.isArray(data.guilds)) {
    for (const entry of data.guilds) {
      const id =
        typeof entry === "object" && entry !== null ? stringField(entry, "id") : undefined;
      if (id) {
        guildIds.push(id);
      }
    }
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      bot: user.bot,
      ...(user.icon ? { icon: user.icon } : {}),
    },
    guildIds,
  };
}

function readGuild(data: unknown): GatewayGuild | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const id = stringField(data, "id");

  if (!id) {
    return undefined;
  }

  return {
    id,
    ...(stringField(data, "name") ? { name: stringField(data, "name") } : {}),
    ...("unavailable" in data && typeof data.unavailable === "boolean"
      ? { unavailable: data.unavailable }
      : {}),
  };
}

function readChannel(data: unknown): GatewayChannel | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const id = stringField(data, "id");

  if (!id) {
    return undefined;
  }

  const type = "type" in data && typeof data.type === "number" ? data.type : undefined;

  return {
    id,
    ...(stringField(data, "guild_id") ? { guildId: stringField(data, "guild_id") } : {}),
    ...(stringField(data, "name") ? { name: stringField(data, "name") } : {}),
    ...(type === undefined ? {} : { type }),
    ...(stringField(data, "parent_id") ? { parentId: stringField(data, "parent_id") } : {}),
  };
}

function readRoleCreate(data: unknown): GatewayRole | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const guildId = stringField(data, "guild_id");
  const role =
    "role" in data && typeof data.role === "object" && data.role !== null ? data.role : undefined;
  const id = role ? stringField(role, "id") : undefined;
  const name = role ? stringField(role, "name") : undefined;

  if (!guildId || !id || !name) {
    return undefined;
  }

  const color = role && "color" in role && typeof role.color === "number" ? role.color : undefined;
  const position =
    role && "position" in role && typeof role.position === "number" ? role.position : undefined;

  return {
    id,
    guildId,
    name,
    ...(color === undefined ? {} : { color }),
    ...(position === undefined ? {} : { position }),
  };
}

function readRoleDelete(data: unknown): GatewayRole | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const guildId = stringField(data, "guild_id");
  const id = stringField(data, "role_id");

  if (!guildId || !id) {
    return undefined;
  }

  return { id, guildId, name: "" };
}

function readMemberUpdate(data: unknown): GatewayMember | undefined {
  return readMemberEvent(data);
}

function readBan(data: unknown): GatewayBan | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const guildId = stringField(data, "guild_id");
  const user = "user" in data ? readDiscordProfile(data.user) : undefined;

  if (!guildId || !user) {
    return undefined;
  }

  return {
    guildId,
    user: {
      id: user.id,
      name: user.name,
      bot: user.bot,
      ...(user.icon ? { icon: user.icon } : {}),
    },
  };
}

function readMessageDelete(data: unknown): GatewayMessageDelete | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const id = stringField(data, "id");
  const channelId = stringField(data, "channel_id");

  if (!id || !channelId) {
    return undefined;
  }

  return {
    id,
    channelId,
    ...(stringField(data, "guild_id") ? { guildId: stringField(data, "guild_id") } : {}),
  };
}

function readMessageBulkDelete(data: unknown): GatewayMessageBulkDelete | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const channelId = stringField(data, "channel_id");

  if (!channelId || !("ids" in data) || !Array.isArray(data.ids)) {
    return undefined;
  }

  const ids = data.ids.filter((entry): entry is string => typeof entry === "string" && !!entry);

  if (ids.length < 1) {
    return undefined;
  }

  return {
    ids,
    channelId,
    ...(stringField(data, "guild_id") ? { guildId: stringField(data, "guild_id") } : {}),
  };
}

function readReaction(data: unknown): GatewayReaction | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const messageId = stringField(data, "message_id");
  const channelId = stringField(data, "channel_id");
  const userId = stringField(data, "user_id");
  const emoji =
    "emoji" in data && typeof data.emoji === "object" && data.emoji !== null
      ? {
          ...(stringField(data.emoji, "id") ? { id: stringField(data.emoji, "id") } : {}),
          ...(stringField(data.emoji, "name") ? { name: stringField(data.emoji, "name") } : {}),
        }
      : undefined;

  if (!messageId || !channelId || !userId || !emoji) {
    return undefined;
  }

  return {
    messageId,
    channelId,
    userId,
    emoji,
    ...(stringField(data, "guild_id") ? { guildId: stringField(data, "guild_id") } : {}),
  };
}

function readReactionClear(data: unknown): GatewayReactionClear | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const messageId = stringField(data, "message_id");
  const channelId = stringField(data, "channel_id");

  if (!messageId || !channelId) {
    return undefined;
  }

  return {
    messageId,
    channelId,
    ...(stringField(data, "guild_id") ? { guildId: stringField(data, "guild_id") } : {}),
  };
}

function readReactionClearEmoji(data: unknown): GatewayReactionClearEmoji | undefined {
  const base = readReactionClear(data);

  if (!base || typeof data !== "object" || data === null) {
    return undefined;
  }

  const emoji =
    "emoji" in data && typeof data.emoji === "object" && data.emoji !== null
      ? {
          ...(stringField(data.emoji, "id") ? { id: stringField(data.emoji, "id") } : {}),
          ...(stringField(data.emoji, "name") ? { name: stringField(data.emoji, "name") } : {}),
        }
      : undefined;

  if (!emoji) {
    return undefined;
  }

  return { ...base, emoji };
}

function readVoice(data: unknown): GatewayVoice | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const guildId = stringField(data, "guild_id");
  const userId = stringField(data, "user_id");

  if (!guildId || !userId) {
    return undefined;
  }

  return {
    guildId,
    userId,
    ...(stringField(data, "channel_id") ? { channelId: stringField(data, "channel_id") } : {}),
    ...(stringField(data, "session_id") ? { sessionId: stringField(data, "session_id") } : {}),
    ...("deaf" in data && typeof data.deaf === "boolean" ? { deaf: data.deaf } : {}),
    ...("mute" in data && typeof data.mute === "boolean" ? { mute: data.mute } : {}),
    ...("self_deaf" in data && typeof data.self_deaf === "boolean"
      ? { selfDeaf: data.self_deaf }
      : {}),
    ...("self_mute" in data && typeof data.self_mute === "boolean"
      ? { selfMute: data.self_mute }
      : {}),
  };
}

function readInvite(data: unknown): GatewayInvite | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const code = stringField(data, "code");

  if (!code) {
    return undefined;
  }

  return {
    code,
    ...(stringField(data, "guild_id") ? { guildId: stringField(data, "guild_id") } : {}),
    ...(stringField(data, "channel_id") ? { channelId: stringField(data, "channel_id") } : {}),
  };
}

function readTyping(data: unknown): GatewayTyping | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const channelId = stringField(data, "channel_id");
  const userId = stringField(data, "user_id");

  if (!channelId || !userId) {
    return undefined;
  }

  return {
    channelId,
    userId,
    ...(stringField(data, "guild_id") ? { guildId: stringField(data, "guild_id") } : {}),
  };
}

function readPresence(data: unknown): GatewayPresence | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const userId =
    "user" in data && typeof data.user === "object" && data.user !== null
      ? stringField(data.user, "id")
      : undefined;

  if (!userId) {
    return undefined;
  }

  return {
    userId,
    ...(stringField(data, "guild_id") ? { guildId: stringField(data, "guild_id") } : {}),
    ...(stringField(data, "status") ? { status: stringField(data, "status") } : {}),
  };
}

function readSchedule(data: unknown): GatewaySchedule | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const id = stringField(data, "id");
  const guildId = stringField(data, "guild_id");

  if (!id || !guildId) {
    return undefined;
  }

  return {
    id,
    guildId,
    ...(stringField(data, "name") ? { name: stringField(data, "name") } : {}),
    ...("status" in data && typeof data.status === "number" ? { status: data.status } : {}),
  };
}

function readPollVote(data: unknown): GatewayPollVote | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const userId = stringField(data, "user_id");
  const channelId = stringField(data, "channel_id");
  const messageId = stringField(data, "message_id");
  const answerId = "answer_id" in data && typeof data.answer_id === "number" ? data.answer_id : undefined;

  if (!userId || !channelId || !messageId || answerId === undefined) {
    return undefined;
  }

  return {
    userId,
    channelId,
    messageId,
    answerId,
    ...(stringField(data, "guild_id") ? { guildId: stringField(data, "guild_id") } : {}),
  };
}

function readMemberEvent(data: unknown): GatewayMember | undefined {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }

  const guildId = stringField(data, "guild_id");
  const user = "user" in data ? readDiscordProfile(data.user) : undefined;

  if (!guildId || !user) {
    return undefined;
  }

  const nick =
    "nick" in data && typeof data.nick === "string" && data.nick.trim()
      ? data.nick.trim()
      : undefined;
  const joined =
    "joined_at" in data && typeof data.joined_at === "string"
      ? Date.parse(data.joined_at)
      : Number.NaN;
  const roleIds =
    "roles" in data && Array.isArray(data.roles)
      ? data.roles.filter((entry): entry is string => typeof entry === "string" && !!entry)
      : undefined;

  return {
    id: user.id,
    name: user.name,
    bot: user.bot,
    guildId,
    ...(user.icon ? { icon: user.icon } : {}),
    ...(nick ? { nick } : {}),
    ...(Number.isFinite(joined) ? { joinedAt: new Date(joined) } : {}),
    ...(roleIds && roleIds.length > 0 ? { roleIds } : {}),
  };
}

function stringField(value: object, key: string): string | undefined {
  if (!(key in value) || typeof value[key as keyof typeof value] !== "string") {
    return undefined;
  }

  const text = value[key as keyof typeof value] as string;
  return text ? text : undefined;
}
