/* Draeven Core: thin moderation helpers on ctx */

import type { ChannelRef, UserRef } from "./lookup.js";

export interface ModActions {
  timeout(user: UserRef | string, seconds: number, reason?: string): Promise<void>;
  kick(user: UserRef | string, reason?: string): Promise<void>;
  ban(user: UserRef | string, options?: { seconds?: number; reason?: string }): Promise<void>;
  moveVoice(user: UserRef | string, channel: ChannelRef | string | null): Promise<void>;
  /** Delete up to 100 recent messages. Returns how many were requested. */
  purge(channel: ChannelRef | string, count: number): Promise<number>;
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
}

export function createActions(
  guildId: string | undefined,
  client: ActionConnection | undefined
): ModActions | undefined {
  if (!guildId || !client) {
    return undefined;
  }

  return {
    async timeout(user, seconds, reason) {
      if (!client.timeoutMember) {
        throw new Error("[Draeven] This connection cannot timeout members.");
      }

      await client.timeoutMember(guildId, idOf(user), seconds, reason);
    },
    async kick(user, reason) {
      if (!client.kickMember) {
        throw new Error("[Draeven] This connection cannot kick members.");
      }

      await client.kickMember(guildId, idOf(user), reason);
    },
    async ban(user, options) {
      if (!client.banMember) {
        throw new Error("[Draeven] This connection cannot ban members.");
      }

      await client.banMember(guildId, idOf(user), options);
    },
    async moveVoice(user, channel) {
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
  };
}

function idOf(value: UserRef | ChannelRef | string): string {
  const id = typeof value === "string" ? value.trim() : value.id.trim();

  if (!id) {
    throw new Error("[Draeven] An action needs an id.");
  }

  return id;
}
