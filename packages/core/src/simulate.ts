/* Draeven Core: run a command without Discord */

import { runCommand, type Command, type Reply } from "./command.js";
import type { Channel, Guild, Member, User, UserRef } from "./lookup.js";

export interface SimulateInput {
  author: UserRef | User;
  opt?: Record<string, unknown>;
  locale?: string;
  users?: readonly User[];
  guild?: Guild;
  channel?: Channel;
  members?: Readonly<Record<string, Member>>;
}

/**
 * Run a command handler as if Discord delivered it.
 * Useful in tests — no gateway, no interaction tokens.
 */
export async function simulate(
  entry: Command,
  input: SimulateInput
): Promise<Reply> {
  if (!entry.run) {
    throw new Error("[Draeven] This command has no run function.");
  }

  const author = { id: input.author.id };
  const users = input.users ?? ("name" in input.author ? [input.author as User] : []);

  return runCommand(entry, {
    author,
    opt: (input.opt ?? {}) as never,
    ...(input.locale ? { locale: input.locale } : {}),
    ...(users.length > 0 ? { users } : {}),
    ...(input.guild ? { guild: input.guild } : {}),
    ...(input.channel ? { channel: input.channel } : {}),
    ...(input.members ? { members: input.members } : {}),
  });
}
