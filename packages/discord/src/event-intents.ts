/* Draeven Discord: intents required by gateway events */

import { intentBits, type IntentName } from "./intents.js";
import type { GatewayEventName } from "./gateway-events.js";

/** Intents each BotEvents name typically needs. Privileged intents are included where Discord requires them. */
export const eventIntents: Readonly<Record<GatewayEventName, readonly IntentName[]>> = {
  ready: [],
  resumed: [],
  guildJoin: ["guilds"],
  guildLeave: ["guilds"],
  guildUpdate: ["guilds"],
  channelCreate: ["guilds"],
  channelUpdate: ["guilds"],
  channelDelete: ["guilds"],
  threadCreate: ["guilds"],
  threadUpdate: ["guilds"],
  threadDelete: ["guilds"],
  roleCreate: ["guilds"],
  roleUpdate: ["guilds"],
  roleDelete: ["guilds"],
  memberJoin: ["guildMembers"],
  memberLeave: ["guildMembers"],
  memberUpdate: ["guildMembers"],
  memberBan: ["guildModeration"],
  memberUnban: ["guildModeration"],
  message: ["guildMessages", "directMessages", "messageContent"],
  messageEdit: ["guildMessages", "directMessages", "messageContent"],
  messageDelete: ["guildMessages", "directMessages"],
  messageBulkDelete: ["guildMessages"],
  reactionAdd: ["guildMessageReactions", "directMessageReactions"],
  reactionRemove: ["guildMessageReactions", "directMessageReactions"],
  reactionClear: ["guildMessageReactions", "directMessageReactions"],
  reactionClearEmoji: ["guildMessageReactions", "directMessageReactions"],
  voiceUpdate: ["guildVoiceStates"],
  inviteCreate: ["guildInvites"],
  inviteDelete: ["guildInvites"],
  typing: ["guildMessageTyping", "directMessageTyping"],
  presenceUpdate: ["guildPresences"],
  scheduleCreate: ["guildScheduledEvents"],
  scheduleUpdate: ["guildScheduledEvents"],
  scheduleDelete: ["guildScheduledEvents"],
  pollVoteAdd: ["guildMessagePolls", "directMessagePolls"],
  pollVoteRemove: ["guildMessagePolls", "directMessagePolls"],
};

/** Combine intents for one or more Draeven event names. */
export function intentsFor(...events: readonly GatewayEventName[]): number {
  if (events.length < 1) {
    throw new Error("[Draeven Discord] intentsFor() needs at least one event name.");
  }

  const names = new Set<IntentName>();

  for (const event of events) {
    const list = eventIntents[event];

    if (!list) {
      throw new Error(`[Draeven Discord] Unknown event ${String(event)}.`);
    }

    for (const name of list) {
      names.add(name);
    }
  }

  if (names.size < 1) {
    return 0;
  }

  return intentBits(...names);
}
