/*
 * Draeven Core: one lookup for each Discord thing a command can ask about.
 *
 * user()/channel()/role()/file() options already resolve to full objects.
 * Lookups are for the caller, the bot, and ids that are not options:
 *
 * getUser(author) -> User
 * getMember(author) -> Member in a guild, or undefined in a DM
 * getBot() -> User
 * getGuild() -> Guild, or undefined in a direct message
 * getChannel() -> Channel, or undefined when there is no channel
 * getRoles(author) -> Role[]
 */

import type { ChannelKind } from "./pieces.js";

export interface UserRef {
  readonly id: string;
}

export interface ChannelRef {
  readonly id: string;
}

export interface RoleRef {
  readonly id: string;
}

export interface FileRef {
  readonly id: string;
}

export interface User {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly bot: boolean;
  /** Profile picture, when Discord has one. */
  readonly icon?: string;
}

/** Guild-side view of a user: nick, join date, and roles. */
export interface Member {
  readonly id: string;
  readonly nick?: string;
  readonly joinedAt?: Date;
  readonly roles: readonly Role[];
}

export interface Guild {
  readonly id: string;
  readonly name: string;
  readonly members?: number;
  readonly online?: number;
  readonly icon?: string;
}

export interface Channel {
  readonly id: string;
  readonly name: string;
  readonly kind?: ChannelKind;
}

export interface Role {
  readonly id: string;
  readonly name: string;
  /** 0 or missing means the role has no color. */
  readonly color?: number;
  readonly position?: number;
}

export interface File {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly size?: number;
  readonly type?: string;
}

export interface Lookups {
  getUser(target: UserRef): User;
  getMember(target: UserRef): Member | undefined;
  getBot(): User;
  getGuild(): Guild | undefined;
  getChannel(): Channel | undefined;
  getChannel(target: ChannelRef): Channel;
  getRole(target: RoleRef): Role;
  getRoles(target: UserRef): readonly Role[];
  getFile(target: FileRef): File;
}

/* The known Discord records for one command run. */
export interface CommandWorld {
  readonly users?: readonly User[];
  readonly members?: Readonly<Record<string, Member>>;
  readonly bot?: UserRef;
  readonly guild?: Guild;
  readonly channel?: Channel;
  /** Channels from options (and resolved Discord data). */
  readonly channels?: readonly Channel[];
  /** Roles from options (and resolved Discord data). */
  readonly knownRoles?: readonly Role[];
  readonly roles?: Readonly<Record<string, readonly Role[]>>;
  readonly files?: readonly File[];
}

/* Build the lookups for one command run. */
export function createLookups(world: CommandWorld): Lookups {
  const users = indexById(world.users ?? []);
  const channels = indexById([
    ...(world.channel ? [world.channel] : []),
    ...(world.channels ?? []),
  ]);
  const roles = indexById(world.knownRoles ?? []);
  const files = indexById(world.files ?? []);

  function getUser(target: UserRef): User {
    if (!target || typeof target.id !== "string" || !target.id.trim()) {
      throw new Error("[Draeven] A user lookup needs a user.");
    }

    const found = users.get(target.id);

    if (!found) {
      throw new Error(`[Draeven] Unknown user ${target.id}.`);
    }

    return found;
  }

  function getChannel(): Channel | undefined;
  function getChannel(target: ChannelRef): Channel;
  function getChannel(target?: ChannelRef): Channel | undefined {
    if (target === undefined) {
      return world.channel;
    }

    if (!target || typeof target.id !== "string" || !target.id.trim()) {
      throw new Error("[Draeven] A channel lookup needs a channel.");
    }

    const found = channels.get(target.id);

    if (!found) {
      throw new Error(`[Draeven] Unknown channel ${target.id}.`);
    }

    return found;
  }

  function getRole(target: RoleRef): Role {
    if (!target || typeof target.id !== "string" || !target.id.trim()) {
      throw new Error("[Draeven] A role lookup needs a role.");
    }

    const found = roles.get(target.id);

    if (!found) {
      throw new Error(`[Draeven] Unknown role ${target.id}.`);
    }

    return found;
  }

  function getFile(target: FileRef): File {
    if (!target || typeof target.id !== "string" || !target.id.trim()) {
      throw new Error("[Draeven] A file lookup needs a file.");
    }

    const found = files.get(target.id);

    if (!found) {
      throw new Error(`[Draeven] Unknown file ${target.id}.`);
    }

    return found;
  }

  return {
    getUser,
    getMember(target: UserRef) {
      getUser(target);
      return world.members?.[target.id];
    },
    getBot() {
      if (!world.bot) {
        throw new Error("[Draeven] This command has no bot.");
      }

      return getUser(world.bot);
    },
    getGuild() {
      return world.guild;
    },
    getChannel,
    getRole,
    getRoles(target: UserRef) {
      getUser(target);
      return world.roles?.[target.id] ?? world.members?.[target.id]?.roles ?? [];
    },
    getFile,
  };
}

function indexById<T extends { id: string }>(entries: readonly T[]): Map<string, T> {
  const byId = new Map<string, T>();

  for (const entry of entries) {
    byId.set(entry.id, entry);
  }

  return byId;
}
