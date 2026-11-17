/* Draeven Core: registration metadata for slash and menu commands */

import type { CommandCooldown } from "./cooldown.js";
import { readCommandLocales, type CommandLocale } from "./locale.js";

export type CommandPlace = "guild" | "bot dm" | "private";
export type CommandInstall = "guild" | "user";
export type { CommandCooldown, CooldownScope } from "./cooldown.js";
export type { CommandLocale } from "./locale.js";

export type PermissionName =
  | "CreateInstantInvite"
  | "KickMembers"
  | "BanMembers"
  | "Administrator"
  | "ManageChannels"
  | "ManageGuild"
  | "AddReactions"
  | "ViewAuditLog"
  | "PrioritySpeaker"
  | "Stream"
  | "ViewChannel"
  | "SendMessages"
  | "SendTTSMessages"
  | "ManageMessages"
  | "EmbedLinks"
  | "AttachFiles"
  | "ReadMessageHistory"
  | "MentionEveryone"
  | "UseExternalEmojis"
  | "ViewGuildInsights"
  | "Connect"
  | "Speak"
  | "MuteMembers"
  | "DeafenMembers"
  | "MoveMembers"
  | "UseVAD"
  | "ChangeNickname"
  | "ManageNicknames"
  | "ManageRoles"
  | "ManageWebhooks"
  | "ManageEmojisAndStickers"
  | "ManageGuildExpressions"
  | "UseApplicationCommands"
  | "RequestToSpeak"
  | "ManageEvents"
  | "ManageThreads"
  | "CreatePublicThreads"
  | "CreatePrivateThreads"
  | "UseExternalStickers"
  | "SendMessagesInThreads"
  | "UseEmbeddedActivities"
  | "ModerateMembers"
  | "ViewCreatorMonetizationAnalytics"
  | "UseSoundboard"
  | "CreateGuildExpressions"
  | "CreateEvents"
  | "UseExternalSounds"
  | "SendVoiceMessages"
  | "SendPolls"
  | "UseExternalApps";

export interface CommandMeta {
  /** Discord permission names, or a raw bitfield string. */
  permissions?: PermissionName | readonly PermissionName[] | string | bigint;
  /** Only usable in age-restricted channels. */
  nsfw?: boolean;
  /** Where the command may be used. Defaults to Discord's defaults. */
  places?: readonly CommandPlace[];
  /** How the app may be installed. Defaults to Discord's defaults. */
  install?: readonly CommandInstall[];
  /** Framework-side wait before the same user/guild/channel can run again. */
  cooldown?: CommandCooldown;
  /** Localized command names and descriptions keyed by Discord locale. */
  locales?: Readonly<Record<string, CommandLocale>>;
}

const permissionBits: Record<PermissionName, bigint> = {
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewAuditLog: 1n << 7n,
  PrioritySpeaker: 1n << 8n,
  Stream: 1n << 9n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  SendTTSMessages: 1n << 12n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  MentionEveryone: 1n << 17n,
  UseExternalEmojis: 1n << 18n,
  ViewGuildInsights: 1n << 19n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  MuteMembers: 1n << 22n,
  DeafenMembers: 1n << 23n,
  MoveMembers: 1n << 24n,
  UseVAD: 1n << 25n,
  ChangeNickname: 1n << 26n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
  ManageWebhooks: 1n << 29n,
  ManageEmojisAndStickers: 1n << 30n,
  ManageGuildExpressions: 1n << 30n,
  UseApplicationCommands: 1n << 31n,
  RequestToSpeak: 1n << 32n,
  ManageEvents: 1n << 33n,
  ManageThreads: 1n << 34n,
  CreatePublicThreads: 1n << 35n,
  CreatePrivateThreads: 1n << 36n,
  UseExternalStickers: 1n << 37n,
  SendMessagesInThreads: 1n << 38n,
  UseEmbeddedActivities: 1n << 39n,
  ModerateMembers: 1n << 40n,
  ViewCreatorMonetizationAnalytics: 1n << 41n,
  UseSoundboard: 1n << 42n,
  CreateGuildExpressions: 1n << 43n,
  CreateEvents: 1n << 44n,
  UseExternalSounds: 1n << 45n,
  SendVoiceMessages: 1n << 46n,
  SendPolls: 1n << 49n,
  UseExternalApps: 1n << 50n,
};

const placeNumber: Record<CommandPlace, number> = {
  guild: 0,
  "bot dm": 1,
  private: 2,
};

const installNumber: Record<CommandInstall, number> = {
  guild: 0,
  user: 1,
};

export interface DiscordCommandMeta {
  default_member_permissions?: string | null;
  nsfw?: boolean;
  contexts?: number[];
  integration_types?: number[];
  name_localizations?: Record<string, string>;
  description_localizations?: Record<string, string>;
}

export function readMeta(meta: CommandMeta | undefined): DiscordCommandMeta {
  if (!meta) {
    return {};
  }

  return {
    ...(meta.permissions === undefined
      ? {}
      : { default_member_permissions: permissionString(meta.permissions) }),
    ...(meta.nsfw === undefined ? {} : { nsfw: Boolean(meta.nsfw) }),
    ...(meta.places ? { contexts: meta.places.map(placeOf) } : {}),
    ...(meta.install ? { integration_types: meta.install.map(installOf) } : {}),
    ...readCommandLocales(meta.locales as Record<string, CommandLocale> | undefined),
  };
}

function permissionString(
  value: PermissionName | readonly PermissionName[] | string | bigint
): string {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "string") {
    if (/^\d+$/.test(value)) {
      return value;
    }

    if (value in permissionBits) {
      return permissionBits[value as PermissionName].toString();
    }

    throw new Error(`[Draeven] Unknown permission ${value}.`);
  }

  let bits = 0n;

  for (const name of value) {
    if (!(name in permissionBits)) {
      throw new Error(`[Draeven] Unknown permission ${name}.`);
    }

    bits |= permissionBits[name];
  }

  return bits.toString();
}

function placeOf(place: CommandPlace): number {
  if (!(place in placeNumber)) {
    throw new Error("[Draeven] A place is guild, bot dm, or private.");
  }

  return placeNumber[place];
}

function installOf(install: CommandInstall): number {
  if (!(install in installNumber)) {
    throw new Error("[Draeven] An install target is guild or user.");
  }

  return installNumber[install];
}

export function isMeta(value: unknown): value is CommandMeta {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length < 1) {
    return false;
  }

  return keys.every(
    (key) =>
      key === "permissions" ||
      key === "nsfw" ||
      key === "places" ||
      key === "install" ||
      key === "cooldown" ||
      key === "locales"
  );
}
