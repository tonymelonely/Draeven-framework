/* Draeven Discord: read a slash-command interaction */

import { readDiscordProfile, type DiscordProfile } from "./discord-user.js";

export type IncomingOption =
  | { name: string; kind: "user"; userId: string }
  | { name: string; kind: "channel"; channelId: string }
  | { name: string; kind: "role"; roleId: string }
  | { name: string; kind: "mentionable"; id: string }
  | { name: string; kind: "file"; fileId: string }
  | { name: string; kind: "string"; value: string }
  | { name: string; kind: "integer"; value: number }
  | { name: string; kind: "number"; value: number }
  | { name: string; kind: "flag"; value: boolean }
  | { name: string; kind: "sub"; options: IncomingOption[] }
  | { name: string; kind: "group"; options: IncomingOption[] };

export interface IncomingChannel {
  id: string;
  name: string;
  /** Discord channel type number, when Discord sent one. */
  type?: number;
}

export interface IncomingRole {
  id: string;
  name: string;
  /** 0 means the role has no color. */
  color?: number;
  position?: number;
}

export interface IncomingMember {
  nick?: string;
  joinedAt?: Date;
  roleIds: string[];
  /** Guild permission bitfield Discord sent on the interaction member. */
  permissions?: string;
}

export interface IncomingFile {
  id: string;
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface IncomingCommand {
  id: string;
  token: string;
  name: string;
  author: DiscordProfile;
  /** Guild member fields for the caller, when the command ran in a server. */
  member?: IncomingMember;
  /** Resolved guild members keyed by user id (option picks and more). */
  members?: Record<string, IncomingMember>;
  options: IncomingOption[];
  users: DiscordProfile[];
  channels: IncomingChannel[];
  roles: IncomingRole[];
  files: IncomingFile[];
  guildId?: string;
  channelId?: string;
  /** Discord locale of the user who ran the command, e.g. "nl" or "en-US". */
  locale?: string;
}

export interface IncomingSuggest {
  id: string;
  token: string;
  name: string;
  author: DiscordProfile;
  focused: { name: string; typed: string };
  options: IncomingOption[];
  users: DiscordProfile[];
  channels: IncomingChannel[];
  roles: IncomingRole[];
  files: IncomingFile[];
  guildId?: string;
  channelId?: string;
}

export interface IncomingMenu {
  id: string;
  token: string;
  name: string;
  kind: "user-menu" | "message-menu";
  targetId: string;
  author: DiscordProfile;
  users: DiscordProfile[];
  message?: { id: string; content: string; authorId: string };
  guildId?: string;
  channelId?: string;
  locale?: string;
}

/* Return undefined when the payload is not a slash command we can run. */
export function readIncomingCommand(value: unknown): IncomingCommand | undefined {
  const base = readInteractionBase(value, 2);

  if (!base) {
    return undefined;
  }

  const commandType = numberField(base.data, "type");

  if (commandType === 2 || commandType === 3) {
    return undefined;
  }

  const { data, ...incoming } = base;

  return {
    ...incoming,
    options: readOptions(data),
  };
}

/* User or message context menu. */
export function readIncomingMenu(value: unknown): IncomingMenu | undefined {
  const base = readInteractionBase(value, 2);

  if (!base) {
    return undefined;
  }

  const commandType = numberField(base.data, "type");

  if (commandType !== 2 && commandType !== 3) {
    return undefined;
  }

  const targetId = stringField(base.data, "target_id");

  if (!targetId) {
    return undefined;
  }

  const { data, ...incoming } = base;
  const message =
    commandType === 3 ? readTargetMessage(data, targetId) : undefined;

  return {
    id: incoming.id,
    token: incoming.token,
    name: incoming.name,
    kind: commandType === 2 ? "user-menu" : "message-menu",
    targetId,
    author: incoming.author,
    users: incoming.users,
    ...(message ? { message } : {}),
    ...(incoming.guildId ? { guildId: incoming.guildId } : {}),
    ...(incoming.channelId ? { channelId: incoming.channelId } : {}),
    ...(incoming.locale ? { locale: incoming.locale } : {}),
  };
}

/* Autocomplete while the caller types into an option. */
export function readIncomingSuggest(value: unknown): IncomingSuggest | undefined {
  const base = readInteractionBase(value, 4);

  if (!base) {
    return undefined;
  }

  const focused = findFocused(base.data);

  if (!focused) {
    return undefined;
  }

  const { data, ...incoming } = base;

  return {
    ...incoming,
    options: readOptions(data),
    focused,
  };
}

function readInteractionBase(
  value: unknown,
  type: number
):
  | {
      id: string;
      token: string;
      name: string;
      author: DiscordProfile;
      member?: IncomingMember;
      members: Record<string, IncomingMember>;
      users: DiscordProfile[];
      channels: IncomingChannel[];
      roles: IncomingRole[];
      files: IncomingFile[];
      guildId?: string;
      channelId?: string;
      locale?: string;
      data: object;
    }
  | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (!("type" in value) || value.type !== type) {
    return undefined;
  }

  if (!("id" in value) || typeof value.id !== "string" || !value.id) {
    return undefined;
  }

  if (!("token" in value) || typeof value.token !== "string" || !value.token) {
    return undefined;
  }

  if (
    !("data" in value) ||
    typeof value.data !== "object" ||
    value.data === null ||
    !("name" in value.data) ||
    typeof value.data.name !== "string" ||
    !value.data.name
  ) {
    return undefined;
  }

  const author = readDiscordProfile(authorSource(value));

  if (!author) {
    return undefined;
  }

  const users = readResolvedUsers(value.data);

  if (!users.some((user) => user.id === author.id)) {
    users.unshift(author);
  }

  const member = readIncomingMember(value);
  const members = readResolvedMembers(value.data);

  if (member && !members[author.id]) {
    members[author.id] = member;
  }

  const roles = uniqueById([
    ...readResolvedRoles(value.data),
    ...rolesFromMembers(members),
  ]);

  const locale = stringField(value, "locale");

  return {
    id: value.id,
    token: value.token,
    name: value.data.name,
    author,
    ...(member ? { member } : {}),
    members,
    users,
    channels: readResolvedChannels(value.data),
    roles,
    files: readResolvedFiles(value.data),
    guildId: stringField(value, "guild_id"),
    channelId: stringField(value, "channel_id"),
    ...(locale ? { locale } : {}),
    data: value.data,
  };
}

function readIncomingMember(value: object): IncomingMember | undefined {
  if (
    !("member" in value) ||
    typeof value.member !== "object" ||
    value.member === null
  ) {
    return undefined;
  }

  const member = value.member;
  const roleIds =
    "roles" in member && Array.isArray(member.roles)
      ? member.roles.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
  const nick =
    "nick" in member && typeof member.nick === "string" && member.nick.trim()
      ? member.nick.trim()
      : undefined;
  const joined =
    "joined_at" in member && typeof member.joined_at === "string"
      ? Date.parse(member.joined_at)
      : Number.NaN;
  const permissions =
    "permissions" in member && typeof member.permissions === "string" && member.permissions
      ? member.permissions
      : undefined;

  if (!nick && !Number.isFinite(joined) && roleIds.length === 0 && !permissions) {
    return undefined;
  }

  return {
    roleIds,
    ...(nick ? { nick } : {}),
    ...(Number.isFinite(joined) ? { joinedAt: new Date(joined) } : {}),
    ...(permissions ? { permissions } : {}),
  };
}

function readResolvedMembers(data: object): Record<string, IncomingMember> {
  const bag = resolvedBag(data, "members");

  if (!bag) {
    return {};
  }

  const members: Record<string, IncomingMember> = {};

  for (const [id, value] of Object.entries(bag)) {
    if (!id || typeof value !== "object" || value === null) {
      continue;
    }

    const roleIds =
      "roles" in value && Array.isArray(value.roles)
        ? value.roles.filter((roleId): roleId is string => typeof roleId === "string" && roleId.length > 0)
        : [];
    const nick =
      "nick" in value && typeof value.nick === "string" && value.nick.trim()
        ? value.nick.trim()
        : undefined;
    const joined =
      "joined_at" in value && typeof value.joined_at === "string"
        ? Date.parse(value.joined_at)
        : Number.NaN;

    if (!nick && !Number.isFinite(joined) && roleIds.length === 0) {
      continue;
    }

    members[id] = {
      roleIds,
      ...(nick ? { nick } : {}),
      ...(Number.isFinite(joined) ? { joinedAt: new Date(joined) } : {}),
    };
  }

  return members;
}

function rolesFromMembers(members: Record<string, IncomingMember>): IncomingRole[] {
  const roles: IncomingRole[] = [];

  for (const member of Object.values(members)) {
    for (const id of member.roleIds) {
      roles.push({ id, name: id });
    }
  }

  return roles;
}

function uniqueById<T extends { id: string }>(entries: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];

  for (const entry of entries) {
    if (seen.has(entry.id)) {
      continue;
    }

    seen.add(entry.id);
    out.push(entry);
  }

  return out;
}

export interface IncomingUse {
  id: string;
  token: string;
  customId: string;
  kind: "press" | "submit";
  author: DiscordProfile;
  values: string[];
  fields: Record<string, string>;
  users: DiscordProfile[];
  guildId?: string;
  channelId?: string;
  /** Host message id when Discord attached `message` (component presses). */
  messageId?: string;
  locale?: string;
}

/* A button, a menu, or a submitted form. Undefined for anything else. */
export function readIncomingUse(value: unknown): IncomingUse | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (!("type" in value) || (value.type !== 3 && value.type !== 5)) {
    return undefined;
  }

  if (!("id" in value) || typeof value.id !== "string" || !value.id) {
    return undefined;
  }

  if (!("token" in value) || typeof value.token !== "string" || !value.token) {
    return undefined;
  }

  if (
    !("data" in value) ||
    typeof value.data !== "object" ||
    value.data === null ||
    !("custom_id" in value.data) ||
    typeof value.data.custom_id !== "string" ||
    !value.data.custom_id
  ) {
    return undefined;
  }

  const author = readDiscordProfile(authorSource(value));

  if (!author) {
    return undefined;
  }

  const users = readResolvedUsers(value.data);

  if (!users.some((user) => user.id === author.id)) {
    users.unshift(author);
  }

  const guildId = stringField(value, "guild_id");
  const channelId = stringField(value, "channel_id");
  const messageId = readAttachedMessageId(value);

  const locale = stringField(value, "locale");

  return {
    id: value.id,
    token: value.token,
    customId: value.data.custom_id,
    kind: value.type === 5 ? "submit" : "press",
    author,
    values: readValues(value.data),
    fields: value.type === 5 ? readFields(value.data) : {},
    users,
    ...(guildId ? { guildId } : {}),
    ...(channelId ? { channelId } : {}),
    ...(messageId ? { messageId } : {}),
    ...(locale ? { locale } : {}),
  };
}

function readAttachedMessageId(value: object): string | undefined {
  if (!("message" in value) || typeof value.message !== "object" || value.message === null) {
    return undefined;
  }

  return stringField(value.message, "id");
}

function readValues(data: object): string[] {
  if (!("values" in data) || !Array.isArray(data.values)) {
    return [];
  }

  return data.values.filter((item): item is string => typeof item === "string");
}

function readFields(data: object): Record<string, string> {
  const fields: Record<string, string> = {};

  if (!("components" in data) || !Array.isArray(data.components)) {
    return fields;
  }

  for (const row of data.components) {
    if (
      typeof row !== "object" ||
      row === null ||
      !("components" in row) ||
      !Array.isArray(row.components)
    ) {
      continue;
    }

    for (const field of row.components) {
      if (typeof field !== "object" || field === null) {
        continue;
      }

      if (
        !("custom_id" in field) ||
        typeof field.custom_id !== "string" ||
        !("value" in field) ||
        typeof field.value !== "string"
      ) {
        continue;
      }

      fields[field.custom_id] = field.value;
    }
  }

  return fields;
}

function authorSource(value: object): unknown {
  if (
    "member" in value &&
    typeof value.member === "object" &&
    value.member !== null &&
    "user" in value.member
  ) {
    return value.member.user;
  }

  if ("user" in value) {
    return value.user;
  }

  return undefined;
}

function readOptions(data: object): IncomingOption[] {
  if (!("options" in data) || !Array.isArray(data.options)) {
    return [];
  }

  const options: IncomingOption[] = [];

  for (const option of data.options) {
    const read = readOneOption(option);

    if (read) {
      options.push(read);
    }
  }

  return options;
}

function readOneOption(option: unknown): IncomingOption | undefined {
  if (typeof option !== "object" || option === null) {
    return undefined;
  }

  if (!("type" in option) || typeof option.type !== "number") {
    return undefined;
  }

  if (!("name" in option) || typeof option.name !== "string" || !option.name) {
    return undefined;
  }

  const name = option.name;

  if (option.type === 1 || option.type === 2) {
    const nested =
      "options" in option && Array.isArray(option.options)
        ? option.options
            .map((item) => readOneOption(item))
            .filter((item): item is IncomingOption => item !== undefined)
        : [];

    return {
      name,
      kind: option.type === 1 ? "sub" : "group",
      options: nested,
    };
  }

  if (!("value" in option)) {
    return undefined;
  }

  switch (option.type) {
    case 3:
      return typeof option.value === "string"
        ? { name, kind: "string", value: option.value }
        : undefined;
    case 4:
      return typeof option.value === "number" && Number.isFinite(option.value)
        ? { name, kind: "integer", value: option.value }
        : undefined;
    case 5:
      return typeof option.value === "boolean"
        ? { name, kind: "flag", value: option.value }
        : undefined;
    case 6:
      return typeof option.value === "string"
        ? { name, kind: "user", userId: option.value }
        : undefined;
    case 7:
      return typeof option.value === "string"
        ? { name, kind: "channel", channelId: option.value }
        : undefined;
    case 8:
      return typeof option.value === "string"
        ? { name, kind: "role", roleId: option.value }
        : undefined;
    case 9:
      return typeof option.value === "string"
        ? { name, kind: "mentionable", id: option.value }
        : undefined;
    case 10:
      return typeof option.value === "number" && Number.isFinite(option.value)
        ? { name, kind: "number", value: option.value }
        : undefined;
    case 11:
      return typeof option.value === "string"
        ? { name, kind: "file", fileId: option.value }
        : undefined;
    default:
      return undefined;
  }
}

function findFocused(data: object): { name: string; typed: string } | undefined {
  if (!("options" in data) || !Array.isArray(data.options)) {
    return undefined;
  }

  return walkFocusedRaw(data.options);
}

/* Discord sets focused:true on the active option. */
function walkFocusedRaw(options: unknown[]): { name: string; typed: string } | undefined {
  for (const option of options) {
    if (typeof option !== "object" || option === null) {
      continue;
    }

    if (
      "options" in option &&
      Array.isArray(option.options) &&
      ("type" in option) &&
      (option.type === 1 || option.type === 2)
    ) {
      const nested = walkFocusedRaw(option.options);

      if (nested) {
        return nested;
      }

      continue;
    }

    if (!("focused" in option) || option.focused !== true) {
      continue;
    }

    if (!("name" in option) || typeof option.name !== "string" || !option.name) {
      continue;
    }

    const typed =
      "value" in option
        ? typeof option.value === "string"
          ? option.value
          : typeof option.value === "number" && Number.isFinite(option.value)
            ? String(option.value)
            : ""
        : "";

    return { name: option.name, typed };
  }

  return undefined;
}

function readResolvedUsers(data: object): DiscordProfile[] {
  const bag = resolvedBag(data, "users");

  if (!bag) {
    return [];
  }

  const users: DiscordProfile[] = [];

  for (const value of Object.values(bag)) {
    const profile = readDiscordProfile(value);

    if (profile) {
      users.push(profile);
    }
  }

  return users;
}

function readResolvedChannels(data: object): IncomingChannel[] {
  const bag = resolvedBag(data, "channels");

  if (!bag) {
    return [];
  }

  const channels: IncomingChannel[] = [];

  for (const value of Object.values(bag)) {
    if (typeof value !== "object" || value === null) {
      continue;
    }

    if (!("id" in value) || typeof value.id !== "string" || !value.id) {
      continue;
    }

    const name =
      "name" in value && typeof value.name === "string" && value.name
        ? value.name
        : value.id;
    const type =
      "type" in value && typeof value.type === "number" && Number.isInteger(value.type)
        ? value.type
        : undefined;

    channels.push({
      id: value.id,
      name,
      ...(type === undefined ? {} : { type }),
    });
  }

  return channels;
}

function readResolvedRoles(data: object): IncomingRole[] {
  const bag = resolvedBag(data, "roles");

  if (!bag) {
    return [];
  }

  const roles: IncomingRole[] = [];

  for (const value of Object.values(bag)) {
    if (typeof value !== "object" || value === null) {
      continue;
    }

    if (!("id" in value) || typeof value.id !== "string" || !value.id) {
      continue;
    }

    const name =
      "name" in value && typeof value.name === "string" && value.name
        ? value.name
        : value.id;
    const color =
      "color" in value && typeof value.color === "number" ? value.color : undefined;
    const position =
      "position" in value && typeof value.position === "number"
        ? value.position
        : undefined;

    roles.push({
      id: value.id,
      name,
      ...(color === undefined ? {} : { color }),
      ...(position === undefined ? {} : { position }),
    });
  }

  return roles;
}

function readResolvedFiles(data: object): IncomingFile[] {
  const bag = resolvedBag(data, "attachments");

  if (!bag) {
    return [];
  }

  const files: IncomingFile[] = [];

  for (const value of Object.values(bag)) {
    if (typeof value !== "object" || value === null) {
      continue;
    }

    if (!("id" in value) || typeof value.id !== "string" || !value.id) {
      continue;
    }

    if (!("filename" in value) || typeof value.filename !== "string" || !value.filename) {
      continue;
    }

    if (!("url" in value) || typeof value.url !== "string" || !value.url) {
      continue;
    }

    files.push({
      id: value.id,
      name: value.filename,
      url: value.url,
      ...("size" in value && typeof value.size === "number" ? { size: value.size } : {}),
      ...("content_type" in value && typeof value.content_type === "string"
        ? { type: value.content_type }
        : {}),
    });
  }

  return files;
}

function resolvedBag(data: object, key: string): Record<string, unknown> | undefined {
  if (
    !("resolved" in data) ||
    typeof data.resolved !== "object" ||
    data.resolved === null ||
    !(key in data.resolved)
  ) {
    return undefined;
  }

  const bag = data.resolved[key as keyof typeof data.resolved];

  if (typeof bag !== "object" || bag === null) {
    return undefined;
  }

  return bag as Record<string, unknown>;
}

function stringField(value: object, key: string): string | undefined {
  if (!(key in value)) {
    return undefined;
  }

  const field = value[key as keyof typeof value];
  return typeof field === "string" && field ? field : undefined;
}

function numberField(value: object, key: string): number | undefined {
  if (!(key in value)) {
    return undefined;
  }

  const field = value[key as keyof typeof value];
  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
}

function readTargetMessage(
  data: object,
  targetId: string
): { id: string; content: string; authorId: string } | undefined {
  const bag = resolvedBag(data, "messages");

  if (!bag || !(targetId in bag)) {
    return undefined;
  }

  const value = bag[targetId];

  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const content =
    "content" in value && typeof value.content === "string" ? value.content : "";
  const author =
    "author" in value && typeof value.author === "object" && value.author !== null
      ? value.author
      : undefined;
  const authorId =
    author && "id" in author && typeof author.id === "string" ? author.id : "";

  if (!authorId) {
    return undefined;
  }

  return { id: targetId, content, authorId };
}
