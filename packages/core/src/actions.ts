/* Draeven Core: thin moderation + message helpers on ctx */

import type { ChannelRef, UserRef } from "./lookup.js";

export interface ModActions {
  timeout(user: UserRef | string, seconds: number, reason?: string): Promise<void>;
  kick(user: UserRef | string, reason?: string): Promise<void>;
  ban(user: UserRef | string, options?: { seconds?: number; reason?: string }): Promise<void>;
  moveVoice(user: UserRef | string, channel: ChannelRef | string | null): Promise<void>;
  /** Delete up to 100 recent messages. Returns how many were requested. */
  purge(channel: ChannelRef | string, count: number): Promise<number>;
  pin(channel: ChannelRef | string, messageId: string): Promise<void>;
  unpin(channel: ChannelRef | string, messageId: string): Promise<void>;
  react(channel: ChannelRef | string, messageId: string, emoji: string): Promise<void>;
  /** Replace a channel message's text (bot-owned messages only). */
  editMessage(channel: ChannelRef | string, messageId: string, text: string): Promise<void>;
  deleteMessage(channel: ChannelRef | string, messageId: string, reason?: string): Promise<void>;
}

export interface ActionConnection {
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
    reply: { content: string }
  ): Promise<void>;
  deleteChannelMessage?(channelId: string, messageId: string, reason?: string): Promise<void>;
}

export function createActions(
  guildId: string | undefined,
  client: ActionConnection | undefined
): ModActions | undefined {
  if (!client) {
    return undefined;
  }

  return {
    async timeout(user, seconds, reason) {
      needGuild(guildId, "timeout members");

      if (!client.timeoutMember) {
        throw new Error("[Draeven] This connection cannot timeout members.");
      }

      await client.timeoutMember(guildId, idOf(user), seconds, reason);
    },
    async kick(user, reason) {
      needGuild(guildId, "kick members");

      if (!client.kickMember) {
        throw new Error("[Draeven] This connection cannot kick members.");
      }

      await client.kickMember(guildId, idOf(user), reason);
    },
    async ban(user, options) {
      needGuild(guildId, "ban members");

      if (!client.banMember) {
        throw new Error("[Draeven] This connection cannot ban members.");
      }

      await client.banMember(guildId, idOf(user), options);
    },
    async moveVoice(user, channel) {
      needGuild(guildId, "move voice members");

      if (!client.moveMemberVoice) {
        throw new Error("[Draeven] This connection cannot move voice members.");
      }

      const channelId = channel === null ? null : idOf(channel);
      await client.moveMemberVoice(guildId, idOf(user), channelId);
    },
    async purge(channel, count) {
      if (!client.listRecentMessageIds || !client.purgeMessages) {
        throw new Error("[Draeven] This connection cannot purge messages.");
      }

      if (!Number.isInteger(count) || count < 2 || count > 100) {
        throw new Error("[Draeven] purge() needs a count from 2 to 100.");
      }

      const channelId = idOf(channel);
      const ids = await client.listRecentMessageIds(channelId, count);

      if (ids.length < 2) {
        return 0;
      }

      await client.purgeMessages(channelId, ids.slice(0, 100));
      return Math.min(ids.length, 100);
    },
    async pin(channel, messageId) {
      if (!client.pinMessage) {
        throw new Error("[Draeven] This connection cannot pin messages.");
      }

      await client.pinMessage(idOf(channel), idOf(messageId));
    },
    async unpin(channel, messageId) {
      if (!client.unpinMessage) {
        throw new Error("[Draeven] This connection cannot unpin messages.");
      }

      await client.unpinMessage(idOf(channel), idOf(messageId));
    },
    async react(channel, messageId, emoji) {
      if (!client.reactToMessage) {
        throw new Error("[Draeven] This connection cannot react to messages.");
      }

      await client.reactToMessage(idOf(channel), idOf(messageId), emoji);
    },
    async editMessage(channel, messageId, text) {
      if (!client.editChannelMessage) {
        throw new Error("[Draeven] This connection cannot edit channel messages.");
      }

      const content = text.trim();

      if (!content || content.length > 2000) {
        throw new Error("[Draeven] editMessage() needs 1-2000 characters.");
      }

      await client.editChannelMessage(idOf(channel), idOf(messageId), { content });
    },
    async deleteMessage(channel, messageId, reason) {
      if (!client.deleteChannelMessage) {
        throw new Error("[Draeven] This connection cannot delete channel messages.");
      }

      await client.deleteChannelMessage(idOf(channel), idOf(messageId), reason);
    },
  };
}

function needGuild(guildId: string | undefined, action: string): asserts guildId is string {
  if (!guildId) {
    throw new Error(`[Draeven] A guild is required to ${action}.`);
  }
}

function idOf(value: UserRef | ChannelRef | string): string {
  const id = typeof value === "string" ? value.trim() : value.id.trim();

  if (!id) {
    throw new Error("[Draeven] An action needs an id.");
  }

  return id;
}
