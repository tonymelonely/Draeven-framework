/* Thin Discord REST helpers for the bridge (bot token). */

export interface BotProfile {
  id: string;
  name: string;
  icon?: string;
}

export interface GuildRow {
  id: string;
  name: string;
  icon?: string;
}

export interface GuildMemberRow {
  id: string;
  name: string;
  nick?: string;
  bot: boolean;
  avatar?: string;
  joinedAt?: string;
  roles: string[];
}

export interface ChannelRow {
  id: string;
  name: string;
  type: number;
  parentId?: string;
}

export interface RoleRow {
  id: string;
  name: string;
  color: number;
  position: number;
}

export async function fetchBotProfile(token: string): Promise<BotProfile | undefined> {
  const data = await discordGet(token, "/users/@me");
  if (!data || typeof data.id !== "string" || typeof data.username !== "string") {
    return undefined;
  }

  return {
    id: data.id,
    name:
      typeof data.global_name === "string" && data.global_name.trim()
        ? data.global_name.trim()
        : data.username,
    ...(typeof data.avatar === "string" && data.avatar
      ? { icon: `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=128` }
      : {}),
  };
}

export async function fetchBotGuilds(token: string): Promise<GuildRow[]> {
  const data = await discordGet(token, "/users/@me/guilds?with_counts=false");
  if (!Array.isArray(data)) {
    return [];
  }

  const rows: GuildRow[] = [];
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null) continue;
    if (typeof entry.id !== "string" || typeof entry.name !== "string") continue;
    rows.push({
      id: entry.id,
      name: entry.name,
      ...(typeof entry.icon === "string" && entry.icon
        ? { icon: `https://cdn.discordapp.com/icons/${entry.id}/${entry.icon}.png?size=64` }
        : {}),
    });
  }
  return rows;
}

export async function fetchGuildMembers(
  token: string,
  guildId: string,
  limit = 100
): Promise<GuildMemberRow[]> {
  const data = await discordGet(
    token,
    `/guilds/${encodeURIComponent(guildId)}/members?limit=${Math.min(Math.max(limit, 1), 1000)}`
  );
  if (!Array.isArray(data)) return [];

  const rows: GuildMemberRow[] = [];
  for (const entry of data) {
    if (typeof entry !== "object" || entry === null || !("user" in entry)) continue;
    const user = entry.user as Record<string, unknown>;
    if (typeof user.id !== "string" || typeof user.username !== "string") continue;
    const nick = typeof entry.nick === "string" && entry.nick ? entry.nick : undefined;
    const avatarHash = typeof user.avatar === "string" && user.avatar ? user.avatar : undefined;
    rows.push({
      id: user.id,
      name:
        typeof user.global_name === "string" && user.global_name.trim()
          ? user.global_name.trim()
          : user.username,
      ...(nick ? { nick } : {}),
      bot: user.bot === true,
      ...(avatarHash
        ? { avatar: `https://cdn.discordapp.com/avatars/${user.id}/${avatarHash}.png?size=64` }
        : {}),
      ...(typeof entry.joined_at === "string" ? { joinedAt: entry.joined_at } : {}),
      roles: Array.isArray(entry.roles)
        ? entry.roles.filter((role: unknown): role is string => typeof role === "string")
        : [],
    });
  }
  return rows;
}

export async function fetchGuildChannels(token: string, guildId: string): Promise<ChannelRow[]> {
  const data = await discordGet(token, `/guilds/${encodeURIComponent(guildId)}/channels`);
  if (!Array.isArray(data)) return [];
  return data
    .filter((entry) => typeof entry === "object" && entry && typeof entry.id === "string")
    .map((entry) => ({
      id: entry.id as string,
      name: typeof entry.name === "string" ? entry.name : entry.id,
      type: typeof entry.type === "number" ? entry.type : 0,
      ...(typeof entry.parent_id === "string" ? { parentId: entry.parent_id } : {}),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function fetchGuildRoles(token: string, guildId: string): Promise<RoleRow[]> {
  const data = await discordGet(token, `/guilds/${encodeURIComponent(guildId)}/roles`);
  if (!Array.isArray(data)) return [];
  return data
    .filter((entry) => typeof entry === "object" && entry && typeof entry.id === "string")
    .map((entry) => ({
      id: entry.id as string,
      name: typeof entry.name === "string" ? entry.name : entry.id,
      color: typeof entry.color === "number" ? entry.color : 0,
      position: typeof entry.position === "number" ? entry.position : 0,
    }))
    .sort((a, b) => b.position - a.position);
}

export async function kickMember(token: string, guildId: string, userId: string, reason?: string) {
  await discordSend(token, `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    reason,
  });
}

export async function banMember(
  token: string,
  guildId: string,
  userId: string,
  options?: { seconds?: number; reason?: string }
) {
  await discordSend(token, `/guilds/${encodeURIComponent(guildId)}/bans/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: { delete_message_seconds: options?.seconds ?? 0 },
    reason: options?.reason,
  });
}

export async function timeoutMember(
  token: string,
  guildId: string,
  userId: string,
  seconds: number,
  reason?: string
) {
  const until = seconds <= 0 ? null : new Date(Date.now() + seconds * 1000).toISOString();
  await discordSend(token, `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: { communication_disabled_until: until },
    reason,
  });
}

export async function pinMessage(token: string, channelId: string, messageId: string) {
  await discordSend(
    token,
    `/channels/${encodeURIComponent(channelId)}/pins/${encodeURIComponent(messageId)}`,
    { method: "PUT" }
  );
}

export async function reactToMessage(
  token: string,
  channelId: string,
  messageId: string,
  emoji: string
) {
  const encoded = encodeURIComponent(normalizeEmoji(emoji));
  await discordSend(
    token,
    `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}/reactions/${encoded}/@me`,
    { method: "PUT" }
  );
}

export async function purgeMessages(
  token: string,
  channelId: string,
  messageIds: readonly string[]
) {
  if (messageIds.length < 2 || messageIds.length > 100) {
    throw new Error("Purge needs 2-100 message ids.");
  }
  await discordSend(token, `/channels/${encodeURIComponent(channelId)}/messages/bulk-delete`, {
    method: "POST",
    body: { messages: [...messageIds] },
  });
}

export async function listRecentMessageIds(
  token: string,
  channelId: string,
  limit: number
): Promise<string[]> {
  const data = await discordGet(
    token,
    `/channels/${encodeURIComponent(channelId)}/messages?limit=${Math.min(Math.max(limit, 1), 100)}`
  );
  if (!Array.isArray(data)) return [];
  return data
    .map((entry) => (typeof entry === "object" && entry && typeof entry.id === "string" ? entry.id : ""))
    .filter(Boolean);
}

function normalizeEmoji(emoji: string): string {
  const trimmed = emoji.trim();
  if (!trimmed) throw new Error("A reaction needs an emoji.");
  const wrapped = trimmed.match(/^<a?:([A-Za-z0-9_]{2,32}):(\d{17,20})>$/);
  if (wrapped) return `${wrapped[1]}:${wrapped[2]}`;
  if (/^[A-Za-z0-9_]{2,32}:\d{17,20}$/.test(trimmed)) return trimmed;
  return trimmed;
}

async function discordGet(token: string, path: string): Promise<any> {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (response.status === 204) return undefined;
  if (!response.ok) throw new Error(`Discord GET ${path} failed (${response.status}).`);
  return response.json();
}

async function discordSend(
  token: string,
  path: string,
  init: { method: string; body?: unknown; reason?: string }
): Promise<void> {
  const headers: Record<string, string> = { Authorization: `Bot ${token}` };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.reason) headers["X-Audit-Log-Reason"] = encodeURIComponent(init.reason.slice(0, 512));
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    method: init.method,
    headers,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) throw new Error(`Discord ${init.method} ${path} failed (${response.status}).`);
}
