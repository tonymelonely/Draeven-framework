/* Draeven Discord: base for Discord REST requests */

const DISCORD_API_BASE_URL = "https://discord.com/api/v10";

export interface GatewayBotResponse {
  url: string;
  shards: number;
  session_start_limit: {
    total: number;
    remaining: number;
    reset_after: number;
    max_concurrency: number;
  };
}

export class DiscordRestClient {
  constructor(private readonly token: string) {
    if (!token.trim()) {
      throw new Error("[Draeven Discord] A token is required.");
    }
  }

  /* Fetch Discord's Gateway information */
  async getGatewayBot(): Promise<GatewayBotResponse> {
    const response = await fetch(`${DISCORD_API_BASE_URL}/gateway/bot`, {
      headers: {
        Authorization: `Bot ${this.token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `[Draeven Discord] Gateway discovery failed with HTTP ${response.status}.`
      );
    }

    const data: unknown = await response.json();

    if (
      typeof data !== "object" ||
      data === null ||
      !("url" in data) ||
      typeof data.url !== "string" ||
      !data.url.startsWith("wss://") ||
      !("shards" in data) ||
      typeof data.shards !== "number" ||
      !("session_start_limit" in data) ||
      typeof data.session_start_limit !== "object" ||
      data.session_start_limit === null
    ) {
      throw new Error(
        "[Draeven Discord] Discord returned an invalid Gateway response."
      );
    }

        /* Validate the session start limits */
    const limits = data.session_start_limit;

    if (
      !("total" in limits) ||
      typeof limits.total !== "number" ||
      !Number.isInteger(limits.total) ||
      limits.total < 0 ||
      !("remaining" in limits) ||
      typeof limits.remaining !== "number" ||
      !Number.isInteger(limits.remaining) ||
      limits.remaining < 0 ||
      limits.remaining > limits.total ||
      !("reset_after" in limits) ||
      typeof limits.reset_after !== "number" ||
      !Number.isFinite(limits.reset_after) ||
      limits.reset_after < 0 ||
      !("max_concurrency" in limits) ||
      typeof limits.max_concurrency !== "number" ||
      !Number.isInteger(limits.max_concurrency) ||
      limits.max_concurrency < 1
    ) {
      throw new Error(
        "[Draeven Discord] Discord returned invalid Gateway session limits."
      );
    }

    return data as GatewayBotResponse;
  }

  /* Name, icon, and member counts for one server. Undefined when Discord refuses. */
  async getGuild(guildId: string): Promise<DiscordGuild | undefined> {
    if (!/^\d{1,20}$/.test(guildId)) {
      return undefined;
    }

    const response = await fetch(
      `${DISCORD_API_BASE_URL}/guilds/${encodeURIComponent(guildId)}?with_counts=true`,
      {
        headers: {
          Authorization: `Bot ${this.token}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      return undefined;
    }

    const data: unknown = await response.json();

    if (typeof data !== "object" || data === null || !("name" in data) || typeof data.name !== "string" || !data.name) {
      return undefined;
    }

    const id = "id" in data && typeof data.id === "string" && data.id ? data.id : guildId;
    const members = countField(data, "approximate_member_count");
    const online = countField(data, "approximate_presence_count");
    const icon = "icon" in data ? guildIcon(id, data.icon) : undefined;

    const ownerId =
      "owner_id" in data && typeof data.owner_id === "string" && data.owner_id
        ? data.owner_id
        : undefined;

    return {
      id,
      name: data.name,
      ...(members === undefined ? {} : { members }),
      ...(online === undefined ? {} : { online }),
      ...(icon === undefined ? {} : { icon }),
      ...(ownerId ? { ownerId } : {}),
    };
  }

  /* Role names and colors. Empty when Discord refuses. */
  async getRoles(guildId: string): Promise<DiscordRole[]> {
    if (!/^\d{1,20}$/.test(guildId)) {
      return [];
    }

    const data = await this.getJson(`/guilds/${encodeURIComponent(guildId)}/roles`);

    if (!Array.isArray(data)) {
      return [];
    }

    const roles: DiscordRole[] = [];

    for (const item of data) {
      if (typeof item !== "object" || item === null) {
        continue;
      }

      const id = "id" in item && typeof item.id === "string" ? item.id : "";
      const name = "name" in item && typeof item.name === "string" ? item.name : "";

      if (!id || !name) {
        continue;
      }

      const emoji = "unicode_emoji" in item && typeof item.unicode_emoji === "string" ? item.unicode_emoji : "";
      const icon = "icon" in item && typeof item.icon === "string" ? item.icon : "";
      roles.push({
        id,
        name,
        color: "color" in item && typeof item.color === "number" ? item.color : 0,
        position: "position" in item && typeof item.position === "number" ? item.position : 0,
        ...(emoji ? { emoji } : {}),
        ...(icon ? { icon: `https://cdn.discordapp.com/role-icons/${id}/${icon}.png` } : {}),
      });
    }

    return roles;
  }

  /* Banner, accent, and badges. Undefined when Discord refuses. */
  async getUser(userId: string): Promise<DiscordUserCard | undefined> {
    if (!/^\d{1,20}$/.test(userId)) {
      return undefined;
    }

    const data = await this.getJson(`/users/${encodeURIComponent(userId)}`);

    if (typeof data !== "object" || data === null) {
      return undefined;
    }

    const banner = "banner" in data && typeof data.banner === "string" ? data.banner : "";
    const accent = "accent_color" in data && typeof data.accent_color === "number" ? data.accent_color : undefined;
    const flags = "public_flags" in data && typeof data.public_flags === "number" ? data.public_flags : undefined;
    const decoration =
      "avatar_decoration_data" in data &&
      typeof data.avatar_decoration_data === "object" &&
      data.avatar_decoration_data !== null &&
      "asset" in data.avatar_decoration_data &&
      typeof data.avatar_decoration_data.asset === "string"
        ? data.avatar_decoration_data.asset
        : "";
    const clan = readClan(data);

    return {
      id: userId,
      ...(banner ? { banner: bannerUrl(userId, banner) } : {}),
      ...(accent === undefined ? {} : { accent }),
      ...(flags === undefined ? {} : { flags }),
      ...(decoration
        ? { decoration: `https://cdn.discordapp.com/avatar-decoration-presets/${decoration}.png` }
        : {}),
      ...(clan ? clan : {}),
    };
  }

  /* The channel a transcript is about. Undefined when the bot cannot see it. */
  async getChannel(channelId: string): Promise<unknown> {
    if (!/^\d{1,20}$/.test(channelId)) {
      return undefined;
    }

    return this.getJson(`/channels/${encodeURIComponent(channelId)}`);
  }

  /* One page of messages, newest first. before walks toward older messages. */
  async listMessages(channelId: string, before?: string): Promise<unknown[]> {
    if (!/^\d{1,20}$/.test(channelId)) {
      throw new Error("[Draeven Discord] The bot cannot read this channel's history.");
    }

    const query = new URLSearchParams({ limit: "100" });

    if (before) {
      query.set("before", before);
    }

    const data = await this.getJson(
      `/channels/${encodeURIComponent(channelId)}/messages?${query.toString()}`
    );

    if (data === undefined) {
      throw new Error("[Draeven Discord] The bot cannot read this channel's history.");
    }

    if (!Array.isArray(data)) {
      throw new Error("[Draeven Discord] Discord returned an invalid message list.");
    }

    return data;
  }

  /* Tell Discord the command is still working. The real answer is edited in later. */
  async deferInteraction(
    interactionId: string,
    interactionToken: string,
    options?: { private?: boolean }
  ): Promise<void> {
    await this.send(
      `/interactions/${encodeURIComponent(interactionId)}/${encodeURIComponent(interactionToken)}/callback`,
      {
        method: "POST",
        authorize: false,
        body: JSON.stringify({
          type: 5,
          ...(options?.private ? { data: { flags: 1 << 6 } } : {}),
        }),
      }
    );
  }

  /* Acknowledge a button or menu without changing the message yet. */
  async deferUpdateInteraction(
    interactionId: string,
    interactionToken: string
  ): Promise<void> {
    await this.send(
      `/interactions/${encodeURIComponent(interactionId)}/${encodeURIComponent(interactionToken)}/callback`,
      {
        method: "POST",
        authorize: false,
        body: JSON.stringify({ type: 6 }),
      }
    );
  }

  async editWebhookMessage(
    applicationId: string,
    interactionToken: string,
    messageId: string,
    reply: InteractionReply
  ): Promise<void> {
    const callback = interactionCallback(reply);
    const packed =
      callback.files === undefined ? undefined : packForm(callback.payload.data, callback.files);
    const path = `/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}/messages/${encodeURIComponent(messageId)}`;

    await this.send(
      path,
      packed === undefined
        ? {
            method: "PATCH",
            authorize: false,
            body: JSON.stringify(callback.payload.data),
          }
        : {
            method: "PATCH",
            authorize: false,
            body: packed.body,
            contentType: packed.contentType,
          }
    );
  }

  async deleteWebhookMessage(
    applicationId: string,
    interactionToken: string,
    messageId: string
  ): Promise<void> {
    await this.send(
      `/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}/messages/${encodeURIComponent(messageId)}`,
      {
        method: "DELETE",
        authorize: false,
      }
    );
  }

  /* Replace the deferred answer. The credential is the interaction token. */
  async editInteraction(
    applicationId: string,
    interactionToken: string,
    reply: InteractionReply
  ): Promise<string | undefined> {
    const callback = interactionCallback(reply);
    const packed =
      callback.files === undefined ? undefined : packForm(callback.payload.data, callback.files);

    const data = await this.send(
      `/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}/messages/@original`,
      packed === undefined
        ? {
            method: "PATCH",
            authorize: false,
            body: JSON.stringify(callback.payload.data),
          }
        : {
            method: "PATCH",
            authorize: false,
            body: packed.body,
            contentType: packed.contentType,
          }
    );

    return attachmentUrl(data);
  }

  private async getJson(path: string): Promise<unknown> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
        headers: {
          Authorization: `Bot ${this.token}`,
          Accept: "application/json",
        },
      });

      if (response.status === 429) {
        const retry = Number(response.headers.get("retry-after") ?? "1");
        const ms = Number.isFinite(retry) ? Math.min(Math.max(retry, 0.1), 10) * 1000 : 1000;
        await new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
        continue;
      }

      if (response.status === 403 || response.status === 404) {
        return undefined;
      }

      if (!response.ok) {
        throw new Error(
          `[Draeven Discord] Discord request failed with HTTP ${response.status}.`
        );
      }

      return response.json() as Promise<unknown>;
    }

    throw new Error("[Draeven Discord] Discord rate limited the request.");
  }

  /* Replace the bot's slash commands. A guild id updates that server immediately. */
  async replaceCommands(
    applicationId: string,
    commands: readonly ApplicationCommandBody[],
    guildId?: string
  ): Promise<void> {
    const path = guildId
      ? `/applications/${encodeURIComponent(applicationId)}/guilds/${encodeURIComponent(guildId)}/commands`
      : `/applications/${encodeURIComponent(applicationId)}/commands`;

    await this.send(path, {
      method: "PUT",
      authorize: true,
      body: JSON.stringify(commands),
    });
  }

  /* Answer an interaction. The credential is the interaction token, not the bot token. */
  async replyToInteraction(
    interactionId: string,
    interactionToken: string,
    reply: InteractionReply
  ): Promise<void> {
    const callback = interactionCallback(reply);
    const packed =
      callback.files === undefined ? undefined : packForm(callback.payload, callback.files);

    await this.send(
      `/interactions/${encodeURIComponent(interactionId)}/${encodeURIComponent(interactionToken)}/callback`,
      packed === undefined
        ? {
            method: "POST",
            authorize: false,
            body: JSON.stringify(callback.payload),
          }
        : {
            method: "POST",
            authorize: false,
            body: packed.body,
            contentType: packed.contentType,
          }
    );
  }

  /* Extra message after the first interaction reply. */
  async followUpInteraction(
    applicationId: string,
    interactionToken: string,
    reply: InteractionReply
  ): Promise<void> {
    const callback = interactionCallback(reply);
    const packed =
      callback.files === undefined ? undefined : packForm(callback.payload.data, callback.files);

    await this.send(
      `/webhooks/${encodeURIComponent(applicationId)}/${encodeURIComponent(interactionToken)}`,
      packed === undefined
        ? {
            method: "POST",
            authorize: false,
            body: JSON.stringify(callback.payload.data),
          }
        : {
            method: "POST",
            authorize: false,
            body: packed.body,
            contentType: packed.contentType,
          }
    );
  }

  /* Timeout a member. Pass seconds 0 to clear. */
  async timeoutMember(
    guildId: string,
    userId: string,
    seconds: number,
    reason?: string
  ): Promise<void> {
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error("[Draeven Discord] Timeout seconds must be 0 or more.");
    }

    const until =
      seconds === 0 ? null : new Date(Date.now() + seconds * 1000).toISOString();

    await this.send(`/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      authorize: true,
      body: JSON.stringify({ communication_disabled_until: until }),
      ...(reason ? { reason } : {}),
    });
  }

  async kickMember(guildId: string, userId: string, reason?: string): Promise<void> {
    await this.send(`/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`, {
      method: "DELETE",
      authorize: true,
      ...(reason ? { reason } : {}),
    });
  }

  async banMember(
    guildId: string,
    userId: string,
    options?: { seconds?: number; reason?: string }
  ): Promise<void> {
    const deleteSeconds = options?.seconds ?? 0;

    if (!Number.isInteger(deleteSeconds) || deleteSeconds < 0 || deleteSeconds > 604_800) {
      throw new Error("[Draeven Discord] Ban delete seconds must be 0-604800.");
    }

    await this.send(`/guilds/${encodeURIComponent(guildId)}/bans/${encodeURIComponent(userId)}`, {
      method: "PUT",
      authorize: true,
      body: JSON.stringify({ delete_message_seconds: deleteSeconds }),
      ...(options?.reason ? { reason: options.reason } : {}),
    });
  }

  async moveMemberVoice(
    guildId: string,
    userId: string,
    channelId: string | null
  ): Promise<void> {
    await this.send(`/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      authorize: true,
      body: JSON.stringify({ channel_id: channelId }),
    });
  }

  /* Bulk-delete 2-100 message ids younger than 14 days. */
  async purgeMessages(channelId: string, messageIds: readonly string[]): Promise<void> {
    if (messageIds.length < 2 || messageIds.length > 100) {
      throw new Error("[Draeven Discord] Purge needs 2-100 message ids.");
    }

    await this.send(`/channels/${encodeURIComponent(channelId)}/messages/bulk-delete`, {
      method: "POST",
      authorize: true,
      body: JSON.stringify({ messages: [...messageIds] }),
    });
  }

  /* Post a message to a channel outside an interaction. */
  async createMessage(channelId: string, reply: InteractionReply): Promise<void> {
    if (reply.modal || reply.update) {
      throw new Error("[Draeven Discord] Channel messages cannot use forms or updates.");
    }

    const callback = interactionCallback(reply);
    const packed =
      callback.files === undefined ? undefined : packForm(callback.payload.data, callback.files);

    await this.send(
      `/channels/${encodeURIComponent(channelId)}/messages`,
      packed === undefined
        ? {
            method: "POST",
            authorize: true,
            body: JSON.stringify(callback.payload.data),
          }
        : {
            method: "POST",
            authorize: true,
            body: packed.body,
            contentType: packed.contentType,
          }
    );
  }

  /* Answer an autocomplete interaction with up to 25 choices. */
  async replyToSuggest(
    interactionId: string,
    interactionToken: string,
    choices: readonly ApplicationCommandChoiceBody[]
  ): Promise<void> {
    await this.send(
      `/interactions/${encodeURIComponent(interactionId)}/${encodeURIComponent(interactionToken)}/callback`,
      {
        method: "POST",
        authorize: false,
        body: JSON.stringify({
          type: 8,
          data: { choices },
        }),
      }
    );
  }

  private async send(
    path: string,
    init: {
      method: string;
      authorize: boolean;
      body?: string | Uint8Array;
      contentType?: string;
      reason?: string;
    }
  ): Promise<unknown> {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const headers: Record<string, string> = {
        Accept: "application/json",
      };

      if (init.body !== undefined) {
        headers["Content-Type"] = init.contentType ?? "application/json";
      }

      if (init.authorize) {
        headers.Authorization = `Bot ${this.token}`;
      }

      if (init.reason) {
        headers["X-Audit-Log-Reason"] = encodeURIComponent(init.reason.slice(0, 512));
      }

      const response = await fetch(`${DISCORD_API_BASE_URL}${path}`, {
        method: init.method,
        headers,
        body: init.body as BodyInit | undefined,
      });

      if (response.status === 429) {
        const retry = Number(response.headers.get("retry-after") ?? "1");
        const ms = Number.isFinite(retry) ? Math.min(Math.max(retry, 0.1), 10) * 1000 : 1000;
        await new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
        continue;
      }

      if (!response.ok) {
        const detail = (await response.text()).trim();
        throw new Error(
          detail
            ? `[Draeven Discord] Discord request failed with HTTP ${response.status}: ${detail}`
            : `[Draeven Discord] Discord request failed with HTTP ${response.status}.`
        );
      }

      if (response.status === 204) {
        return undefined;
      }

      const text = await response.text();

      if (!text) {
        return undefined;
      }

      try {
        return JSON.parse(text) as unknown;
      } catch {
        return undefined;
      }
    }

    throw new Error("[Draeven Discord] Discord rate limited the request.");
  }
}

export interface ApplicationCommandBody {
  name: string;
  description?: string;
  type?: number;
  options?: ApplicationCommandOptionBody[];
  name_localizations?: Record<string, string>;
  description_localizations?: Record<string, string>;
  default_member_permissions?: string | null;
  nsfw?: boolean;
  contexts?: number[];
  integration_types?: number[];
}

export interface ApplicationCommandOptionBody {
  type: number;
  name: string;
  description: string;
  required?: boolean;
  autocomplete?: boolean;
  choices?: ApplicationCommandChoiceBody[];
  channel_types?: number[];
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  options?: ApplicationCommandOptionBody[];
  name_localizations?: Record<string, string>;
  description_localizations?: Record<string, string>;
}

export interface ApplicationCommandChoiceBody {
  name: string;
  value: string | number;
  name_localizations?: Record<string, string>;
}

export interface DiscordGuild {
  id: string;
  name: string;
  members?: number;
  online?: number;
  icon?: string;
  ownerId?: string;
}

export interface DiscordRole {
  id: string;
  name: string;
  /** 0 means the role has no color. */
  color: number;
  position: number;
  emoji?: string;
  icon?: string;
}

export interface DiscordUserCard {
  id: string;
  banner?: string;
  accent?: number;
  flags?: number;
  decoration?: string;
  clan?: string;
  clanIcon?: string;
}

/* What an interaction answer may send. */
export interface InteractionReply {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: readonly object[];
  files?: readonly DiscordFile[];
  poll?: object;
  modal?: DiscordModal;
  /** Replace the message the button or menu sits on. */
  update?: boolean;
  /** Message flags. 4 hides link previews. 64 is private. 32768 is Components V2. */
  flags?: number;
}

/** Only the caller can see the interaction reply. */
export const EPHEMERAL = 1 << 6;

export interface DiscordFile {
  filename: string;
  bytes: Uint8Array;
  type?: string;
}

export interface DiscordModal {
  custom_id: string;
  title: string;
  components: readonly object[];
}

/* Discord's embed body. Core turns its own card into this shape. */
export interface DiscordEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  author?: {
    name: string;
    url?: string;
    icon_url?: string;
  };
  footer?: {
    text: string;
    icon_url?: string;
  };
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: DiscordEmbedField[];
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline: boolean;
}

function interactionCallback(reply: InteractionReply): {
  payload: { type: number; data: object };
  files?: readonly DiscordFile[];
} {
  if (reply.modal) {
    if (
      reply.content !== undefined ||
      (reply.embeds?.length ?? 0) > 0 ||
      (reply.components?.length ?? 0) > 0 ||
      (reply.files?.length ?? 0) > 0 ||
      reply.poll !== undefined
    ) {
      throw new Error("[Draeven Discord] A form is the whole reply.");
    }

    if (!reply.modal.custom_id || !reply.modal.title || reply.modal.components.length < 1) {
      throw new Error("[Draeven Discord] A form needs a title and a field.");
    }

    return { payload: { type: 9, data: reply.modal } };
  }

  const content = reply.content;
  const embeds = reply.embeds?.filter((embed) => embed !== undefined) ?? [];
  const components = reply.components ?? [];
  const files = reply.files ?? [];
  const poll = reply.poll;
  const componentsV2 = ((reply.flags ?? 0) & (1 << 15)) !== 0;

  if (content !== undefined && (!content.trim() || content.length > 2000)) {
    throw new Error("[Draeven Discord] A reply must be 1-2000 characters.");
  }

  if (embeds.length > 10) {
    throw new Error("[Draeven Discord] A reply can have 10 embeds.");
  }

  if (componentsV2) {
    if (components.length > 40) {
      throw new Error("[Draeven Discord] A Components V2 reply can have 40 parts.");
    }

    if (content !== undefined || embeds.length > 0 || poll !== undefined) {
      throw new Error(
        "[Draeven Discord] Components V2 cannot mix with content, embeds, or polls."
      );
    }
  } else if (components.length > 5) {
    throw new Error("[Draeven Discord] A reply can have 5 rows.");
  }

  if (files.length > 10) {
    throw new Error("[Draeven Discord] A reply can have 10 files.");
  }

  for (const file of files) {
    if (!/^[\w.-]{1,64}$/.test(file.filename) || file.bytes.length < 1) {
      throw new Error("[Draeven Discord] A file needs a simple name and some bytes.");
    }
  }

  if (
    content === undefined &&
    embeds.length === 0 &&
    components.length === 0 &&
    files.length === 0 &&
    poll === undefined
  ) {
    throw new Error(
      "[Draeven Discord] A reply needs text, an embed, components, a poll, or a file."
    );
  }

  return {
    payload: {
      type: reply.update ? 7 : 4,
      data: {
        ...(content !== undefined ? { content } : {}),
        ...(embeds.length > 0 ? { embeds } : {}),
        ...(components.length > 0 ? { components } : {}),
        ...(poll !== undefined ? { poll } : {}),
        ...(files.length > 0
          ? { attachments: files.map((file, id) => ({ id, filename: file.filename })) }
          : {}),
        ...(reply.flags !== undefined ? { flags: reply.flags } : {}),
      },
    },
    ...(files.length > 0 ? { files } : {}),
  };
}

function attachmentUrl(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("attachments" in data) || !Array.isArray(data.attachments)) {
    return undefined;
  }

  const first = data.attachments[0];

  if (
    typeof first === "object" &&
    first !== null &&
    "url" in first &&
    typeof first.url === "string" &&
    first.url.startsWith("https://")
  ) {
    return first.url;
  }

  return undefined;
}

function bannerUrl(id: string, hash: string): string {
  const ext = hash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/banners/${id}/${hash}.${ext}?size=480`;
}

function readClan(data: object): { clan?: string; clanIcon?: string } | undefined {
  if (!("primary_guild" in data) || typeof data.primary_guild !== "object" || data.primary_guild === null) {
    return undefined;
  }

  const clan = data.primary_guild;

  if (!("tag" in clan) || typeof clan.tag !== "string" || !clan.tag) {
    return undefined;
  }

  if ("identity_enabled" in clan && clan.identity_enabled === false) {
    return undefined;
  }

  const guildId = "identity_guild_id" in clan && typeof clan.identity_guild_id === "string" ? clan.identity_guild_id : "";
  const badge = "badge" in clan && typeof clan.badge === "string" ? clan.badge : "";

  return {
    clan: clan.tag,
    ...(guildId && badge ? { clanIcon: `https://cdn.discordapp.com/clan-badges/${guildId}/${badge}.png` } : {}),
  };
}

function countField(value: object, key: string): number | undefined {
  if (!(key in value)) {
    return undefined;
  }

  const count = value[key as keyof typeof value];
  return typeof count === "number" && Number.isInteger(count) && count >= 0 ? count : undefined;
}

function guildIcon(id: string, icon: unknown): string | undefined {
  if (typeof icon !== "string" || !icon) {
    return undefined;
  }

  const extension = icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${id}/${icon}.${extension}`;
}

function packForm(
  payload: object,
  files: readonly DiscordFile[]
): { body: Uint8Array; contentType: string } {
  const boundary = `Draeven${crypto.randomUUID().replaceAll("-", "")}`;
  const parts: Uint8Array[] = [];
  const encoder = new TextEncoder();

  parts.push(
    encoder.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload)}\r\n`
    )
  );

  files.forEach((file, index) => {
    parts.push(
      encoder.encode(
        `--${boundary}\r\nContent-Disposition: form-data; name="files[${index}]"; filename="${file.filename}"\r\nContent-Type: ${file.type ?? "application/octet-stream"}\r\n\r\n`
      )
    );
    parts.push(file.bytes);
    parts.push(encoder.encode("\r\n"));
  });

  parts.push(encoder.encode(`--${boundary}--\r\n`));

  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const body = new Uint8Array(size);
  let offset = 0;

  for (const part of parts) {
    body.set(part, offset);
    offset += part.length;
  }

  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}