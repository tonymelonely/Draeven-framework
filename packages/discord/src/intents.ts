/* Draeven Discord: Gateway intent bit flags */

export const intents = {
  guilds: 1 << 0,
  guildMembers: 1 << 1,
  guildModeration: 1 << 2,
  guildExpressions: 1 << 3,
  guildIntegrations: 1 << 4,
  guildWebhooks: 1 << 5,
  guildInvites: 1 << 6,
  guildVoiceStates: 1 << 7,
  guildPresences: 1 << 8,
  guildMessages: 1 << 9,
  guildMessageReactions: 1 << 10,
  guildMessageTyping: 1 << 11,
  directMessages: 1 << 12,
  directMessageReactions: 1 << 13,
  directMessageTyping: 1 << 14,
  messageContent: 1 << 15,
  guildScheduledEvents: 1 << 16,
  autoModerationConfiguration: 1 << 20,
  autoModerationExecution: 1 << 21,
  guildMessagePolls: 1 << 24,
  directMessagePolls: 1 << 25,
} as const;

export type IntentName = keyof typeof intents;

/** Combine named intents into one bitmask. */
export function intentBits(...names: readonly IntentName[]): number {
  let bits = 0;

  for (const name of names) {
    const bit = intents[name];

    if (bit === undefined) {
      throw new Error(`[Draeven Discord] Unknown intent ${String(name)}.`);
    }

    bits |= bit;
  }

  return bits;
}
