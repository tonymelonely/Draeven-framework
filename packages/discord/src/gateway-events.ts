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
    ...(stringField(data, "guild_id")
      ? { guildId: stringField(data, "guild_id") }
      : {}),
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

  return {
    id: user.id,
    name: user.name,
    bot: user.bot,
    guildId,
    ...(user.icon ? { icon: user.icon } : {}),
    ...(nick ? { nick } : {}),
    ...(Number.isFinite(joined) ? { joinedAt: new Date(joined) } : {}),
  };
}

function stringField(value: object, key: string): string | undefined {
  if (!(key in value) || typeof value[key as keyof typeof value] !== "string") {
    return undefined;
  }

  const text = value[key as keyof typeof value] as string;
  return text ? text : undefined;
}
