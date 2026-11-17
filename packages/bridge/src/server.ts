/* Draeven bridge/desk HTTP server (embedded or bridge API). */

import type { IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { Bot, BotSyncState, GatewayEventName, LoadableCommand } from "@draeven/core";
import { isCommand } from "@draeven/core";
import {
  beginOAuth,
  clearSessionCookie,
  createSession,
  currentUser,
  destroySession,
  finishOAuth,
  readAuthConfig,
  setSessionCookie,
  type AuthConfig,
  type AuthUser,
} from "./auth.js";
import { appendAudit, readAudit } from "./audit.js";
import {
  banMember,
  fetchBotGuilds,
  fetchBotProfile,
  fetchGuildChannels,
  fetchGuildMembers,
  fetchGuildRoles,
  kickMember,
  listRecentMessageIds,
  pinMessage,
  purgeMessages,
  reactToMessage,
  timeoutMember,
  type BotProfile,
  type GuildRow,
} from "./discord-api.js";
import {
  clientIp,
  createHardenedServer,
  ipAllowed,
  readAllowIps,
} from "./hardening.js";
import { closeHttpServer } from "./close-server.js";
import { bridgePublicDir } from "./paths.js";
import { loadSettings, saveSettings, type DashboardSettings } from "./store.js";

export type ServeKind = "embedded" | "bridge";

export interface DashboardOptions {
  bot: Bot;
  root: string;
  botToken: string;
  kind?: ServeKind;
  guildId?: string;
  logChannelId?: string;
  host?: string;
  port?: number;
  bridgeSecret?: string;
  allowIps?: readonly string[];
  tlsCertPath?: string;
  tlsKeyPath?: string;
}

export interface DashboardHandle {
  readonly url: string;
  readonly kind: ServeKind;
  readonly settings: DashboardSettings;
  stop(): Promise<void>;
}

interface LiveEvent {
  id: number;
  at: string;
  name: string;
  summary: string;
  detail?: unknown;
}

interface LogLine {
  id: number;
  at: string;
  level: "info" | "warn" | "error" | "action";
  source: string;
  message: string;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const FEED_EVENTS: GatewayEventName[] = [
  "ready", "resumed", "guildJoin", "guildLeave", "guildUpdate",
  "channelCreate", "channelUpdate", "channelDelete",
  "threadCreate", "threadUpdate", "threadDelete",
  "roleCreate", "roleUpdate", "roleDelete",
  "memberJoin", "memberLeave", "memberUpdate", "memberBan", "memberUnban",
  "message", "messageEdit", "messageDelete", "messageBulkDelete",
  "reactionAdd", "reactionRemove", "reactionClear", "reactionClearEmoji",
  "voiceUpdate", "inviteCreate", "inviteDelete", "typing", "presenceUpdate",
  "scheduleCreate", "scheduleUpdate", "scheduleDelete", "pollVoteAdd", "pollVoteRemove",
];

export async function startDashboard(options: DashboardOptions): Promise<DashboardHandle> {
  const kind = options.kind ?? "embedded";
  const host =
    options.host ??
    (kind === "bridge" ? process.env.BRIDGE_HOST?.trim() || "0.0.0.0" : "127.0.0.1");
  const port =
    options.port ??
    Number(kind === "bridge" ? process.env.BRIDGE_PORT ?? "3848" : process.env.DASHBOARD_PORT ?? "3847");
  const publicDir = bridgePublicDir();
  const startedAt = Date.now();
  const auth = kind === "embedded" ? readAuthConfig() : undefined;
  const bridgeSecret = kind === "bridge" ? options.bridgeSecret?.trim() : undefined;
  const allowIps = options.allowIps ?? readAllowIps();
  const scheme = options.tlsCertPath && options.tlsKeyPath ? "https" : "http";

  if (kind === "bridge" && (!bridgeSecret || bridgeSecret.length < 12)) {
    throw new Error("[Draeven Bridge] Bridge mode needs bridgeSecret (12+ chars).");
  }

  let settings = await loadSettings(options.root);
  const events: LiveEvent[] = [];
  const logs: LogLine[] = [];
  const listeners = new Set<(event: LiveEvent) => void>();
  const openStreams = new Set<ServerResponse>();
  let nextEventId = 1;
  let nextLogId = 1;
  let botProfile: BotProfile | undefined;
  let guilds: GuildRow[] = [];
  let sync: BotSyncState = options.bot.syncState();

  try {
    botProfile = await fetchBotProfile(options.botToken);
  } catch (error) {
    console.warn("[Draeven Bridge] Could not load bot profile.", error);
  }

  try {
    guilds = await fetchBotGuilds(options.botToken);
  } catch {
    guilds = [];
  }

  const activeGuildId = () =>
    settings.selectedGuildId?.trim() || options.guildId?.trim() || undefined;

  const pushEvent = (name: string, summary: string, detail?: unknown) => {
    const event: LiveEvent = {
      id: nextEventId++,
      at: new Date().toISOString(),
      name,
      summary,
      ...(detail === undefined ? {} : { detail }),
    };
    events.unshift(event);
    if (events.length > settings.feedLimit) events.length = settings.feedLimit;
    for (const listener of listeners) listener(event);
  };

  const pushLog = (level: LogLine["level"], source: string, message: string) => {
    logs.unshift({ id: nextLogId++, at: new Date().toISOString(), level, source, message });
    if (logs.length > 500) logs.length = 500;
  };

  const audit = async (user: AuthUser, action: string, detail?: string) => {
    const entry = await appendAudit(options.root, {
      actorId: user.id,
      actorName: user.name,
      action,
      ...(detail ? { detail } : {}),
    });
    pushLog("action", action, `${user.name}: ${detail ?? action}`);
    pushEvent("audit", `${user.name} · ${action}`);
    return entry;
  };

  const unsubs = [
    ...FEED_EVENTS.map((name) => {
      try {
        return options.bot.onEvent(name, (value) => {
          if (
            name === "message" &&
            !settings.showBotMessagesInFeed &&
            value &&
            typeof value === "object" &&
            "author" in value &&
            (value as { author?: { bot?: boolean } }).author?.bot
          ) {
            return;
          }
          pushEvent(name, summarizeEvent(name, value), value);
        });
      } catch {
        return () => undefined;
      }
    }),
    options.bot.onSync((state) => {
      sync = state;
      pushEvent("sync", `Commands ${state.commandCount}${state.lastCommandsReloadAt ? " · reloaded" : ""}`);
    }),
  ];

  pushEvent(kind, kind === "bridge" ? "Bridge online." : "Local desk online.");
  pushLog("info", kind, "Started.");

  const server = await createHardenedServer(
    {
      allowIps,
      ...(options.tlsCertPath ? { tlsCertPath: options.tlsCertPath } : {}),
      ...(options.tlsKeyPath ? { tlsKeyPath: options.tlsKeyPath } : {}),
    },
    (req, res) => {
      void handleRequest(req, res).catch((error) => {
        console.error("[Draeven Bridge] Request failed.", error);
        pushLog("error", kind, error instanceof Error ? error.message : String(error));
        if (!res.headersSent) json(res, 500, { error: "Internal error." });
      });
    }
  );

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!ipAllowed(clientIp(req), allowIps)) {
      json(res, 403, { error: "IP not allowed." });
      return;
    }

    const url = new URL(req.url ?? "/", `${scheme}://${host}:${port}`);
    const path = url.pathname;

    if (kind === "embedded") {
      if (path === "/auth/login" && req.method === "GET") {
        if (!auth) {
          json(res, 503, { error: "Discord OAuth is not configured." });
          return;
        }
        res.writeHead(302, { Location: beginOAuth(auth).url });
        res.end();
        return;
      }

      if (path === "/auth/callback" && req.method === "GET") {
        if (!auth) {
          res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("OAuth is not configured.");
          return;
        }
        try {
          const user = await finishOAuth(auth, url.searchParams.get("code") ?? "", url.searchParams.get("state") ?? "");
          setSessionCookie(res, createSession(auth, user));
          await audit(user, "login");
          res.writeHead(302, { Location: "/" });
          res.end();
        } catch (error) {
          res.writeHead(302, {
            Location: `/?authError=${encodeURIComponent(error instanceof Error ? error.message : "Login failed")}`,
          });
          res.end();
        }
        return;
      }

      if (path === "/auth/logout" && req.method === "POST") {
        if (auth) {
          const user = currentUser(req, auth);
          destroySession(req, auth);
          if (user) await audit(user, "logout");
        }
        clearSessionCookie(res);
        json(res, 200, { ok: true });
        return;
      }

      if (path === "/api/session" && req.method === "GET") {
        json(res, 200, {
          oauthConfigured: Boolean(auth),
          user: auth ? currentUser(req, auth) ?? null : null,
          mode: kind,
        });
        return;
      }
    }

    if (kind === "bridge" && path === "/api/health" && req.method === "GET") {
      json(res, 200, { ok: true, mode: "bridge", commandCount: options.bot.commands.length, sync });
      return;
    }

    if (path.startsWith("/api/")) {
      const user = requireAccess(req, res, kind, auth, bridgeSecret);
      if (!user) return;

      if (path === "/api/status" && req.method === "GET") {
        json(res, 200, {
          user: botProfile ?? null,
          session: user,
          startedAt,
          uptimeMs: Date.now() - startedAt,
          commandCount: options.bot.commands.length,
          guildId: activeGuildId() ?? null,
          logChannelId: options.logChannelId ?? null,
          settings,
          sync,
          mode: kind,
        });
        return;
      }

      if (path === "/api/sync" && req.method === "GET") {
        json(res, 200, { sync: options.bot.syncState() });
        return;
      }

      if (path === "/api/commands" && req.method === "GET") {
        json(res, 200, { commands: serializeCommands(options.bot.commands) });
        return;
      }

      if (path === "/api/guilds" && req.method === "GET") {
        try {
          guilds = await fetchBotGuilds(options.botToken);
        } catch {
          /* keep cache */
        }
        json(res, 200, { guilds, selectedGuildId: activeGuildId() ?? null });
        return;
      }

      if (path === "/api/members" && req.method === "GET") {
        const guildId = activeGuildId();
        if (!guildId) {
          json(res, 400, { error: "Select a guild first." });
          return;
        }
        json(res, 200, { members: await fetchGuildMembers(options.botToken, guildId) });
        return;
      }

      if (path === "/api/channels" && req.method === "GET") {
        const guildId = activeGuildId();
        if (!guildId) {
          json(res, 400, { error: "Select a guild first." });
          return;
        }
        json(res, 200, { channels: await fetchGuildChannels(options.botToken, guildId) });
        return;
      }

      if (path === "/api/roles" && req.method === "GET") {
        const guildId = activeGuildId();
        if (!guildId) {
          json(res, 400, { error: "Select a guild first." });
          return;
        }
        json(res, 200, { roles: await fetchGuildRoles(options.botToken, guildId) });
        return;
      }

      if (path === "/api/logs" && req.method === "GET") {
        json(res, 200, { logs: logs.slice(0, 200) });
        return;
      }

      if (path === "/api/audit" && req.method === "GET") {
        json(res, 200, { audit: await readAudit(options.root, 200) });
        return;
      }

      if (path === "/api/settings" && req.method === "GET") {
        json(res, 200, { settings });
        return;
      }

      if (path === "/api/settings" && req.method === "PUT") {
        const body = await readJson(req);
        settings = {
          language: body.language === "en" ? "en" : "nl",
          prefix: typeof body.prefix === "string" ? body.prefix.slice(0, 8) : settings.prefix,
          presenceText:
            typeof body.presenceText === "string" && body.presenceText.trim()
              ? body.presenceText.trim().slice(0, 64)
              : settings.presenceText,
          presenceStatus:
            body.presenceStatus === "idle" ||
            body.presenceStatus === "dnd" ||
            body.presenceStatus === "invisible"
              ? body.presenceStatus
              : "online",
          showBotMessagesInFeed: body.showBotMessagesInFeed === true,
          feedLimit:
            typeof body.feedLimit === "number" && body.feedLimit >= 50 && body.feedLimit <= 1000
              ? Math.floor(body.feedLimit)
              : settings.feedLimit,
          ...(typeof body.selectedGuildId === "string" && body.selectedGuildId.trim()
            ? { selectedGuildId: body.selectedGuildId.trim() }
            : body.selectedGuildId === null || body.selectedGuildId === ""
              ? {}
              : settings.selectedGuildId
                ? { selectedGuildId: settings.selectedGuildId }
                : {}),
        };
        await saveSettings(options.root, settings);

        try {
          options.bot.setPresence({
            status: settings.presenceStatus,
            activity: { kind: "watching", text: settings.presenceText },
          });
        } catch (error) {
          pushLog("warn", "presence", error instanceof Error ? error.message : String(error));
        }

        await audit(user, "settings", `guild=${settings.selectedGuildId ?? "-"}`);
        json(res, 200, { settings });
        return;
      }

      if (path === "/api/actions/send" && req.method === "POST") {
        const body = await readJson(req);
        const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!channelId || !text || text.length > 2000) {
          json(res, 400, { error: "Need channelId and text (1-2000 chars)." });
          return;
        }
        await options.bot.send(channelId, text);
        await audit(user, "send", channelId);
        json(res, 200, { ok: true });
        return;
      }

      if (path === "/api/actions/kick" && req.method === "POST") {
        const guildId = activeGuildId();
        const body = await readJson(req);
        const userId = typeof body.userId === "string" ? body.userId.trim() : "";
        if (!guildId || !userId) {
          json(res, 400, { error: "Need guild + userId." });
          return;
        }
        await kickMember(options.botToken, guildId, userId, asString(body.reason));
        await audit(user, "kick", userId);
        json(res, 200, { ok: true });
        return;
      }

      if (path === "/api/actions/ban" && req.method === "POST") {
        const guildId = activeGuildId();
        const body = await readJson(req);
        const userId = typeof body.userId === "string" ? body.userId.trim() : "";
        if (!guildId || !userId) {
          json(res, 400, { error: "Need guild + userId." });
          return;
        }
        await banMember(options.botToken, guildId, userId, { reason: asString(body.reason) });
        await audit(user, "ban", userId);
        json(res, 200, { ok: true });
        return;
      }

      if (path === "/api/actions/timeout" && req.method === "POST") {
        const guildId = activeGuildId();
        const body = await readJson(req);
        const userId = typeof body.userId === "string" ? body.userId.trim() : "";
        const seconds = typeof body.seconds === "number" ? body.seconds : Number(body.seconds);
        if (!guildId || !userId || !Number.isFinite(seconds) || seconds < 0) {
          json(res, 400, { error: "Need guild, userId, seconds." });
          return;
        }
        await timeoutMember(options.botToken, guildId, userId, seconds, asString(body.reason));
        await audit(user, "timeout", `${userId} ${seconds}s`);
        json(res, 200, { ok: true });
        return;
      }

      if (path === "/api/actions/pin" && req.method === "POST") {
        const body = await readJson(req);
        const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
        const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
        if (!channelId || !messageId) {
          json(res, 400, { error: "Need channelId and messageId." });
          return;
        }
        await pinMessage(options.botToken, channelId, messageId);
        await audit(user, "pin", `${channelId}/${messageId}`);
        json(res, 200, { ok: true });
        return;
      }

      if (path === "/api/actions/react" && req.method === "POST") {
        const body = await readJson(req);
        const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
        const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
        const emoji = typeof body.emoji === "string" ? body.emoji : "";
        if (!channelId || !messageId || !emoji.trim()) {
          json(res, 400, { error: "Need channelId, messageId, emoji." });
          return;
        }
        await reactToMessage(options.botToken, channelId, messageId, emoji);
        await audit(user, "react", `${channelId}/${messageId} ${emoji}`);
        json(res, 200, { ok: true });
        return;
      }

      if (path === "/api/actions/purge" && req.method === "POST") {
        const body = await readJson(req);
        const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
        const count = typeof body.count === "number" ? body.count : Number(body.count);
        if (!channelId || !Number.isInteger(count) || count < 2 || count > 100) {
          json(res, 400, { error: "Need channelId and count 2-100." });
          return;
        }
        const ids = await listRecentMessageIds(options.botToken, channelId, count);
        if (ids.length >= 2) {
          await purgeMessages(options.botToken, channelId, ids.slice(0, 100));
        }
        await audit(user, "purge", `${channelId} x${Math.min(ids.length, 100)}`);
        json(res, 200, { ok: true, deleted: Math.min(ids.length, 100) });
        return;
      }

      if (path === "/api/events" && req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });
        openStreams.add(res);
        res.write(`data: ${JSON.stringify({ type: "snapshot", events: events.slice(0, 80), sync })}\n\n`);
        const onEvent = (event: LiveEvent) => {
          if (!res.writableEnded) {
            res.write(`data: ${JSON.stringify({ type: "event", event, sync: options.bot.syncState() })}\n\n`);
          }
        };
        listeners.add(onEvent);
        const cleanup = () => {
          listeners.delete(onEvent);
          openStreams.delete(res);
        };
        req.on("close", cleanup);
        res.on("close", cleanup);
        return;
      }

      json(res, 404, { error: "Unknown API route." });
      return;
    }

    if (kind === "bridge") {
      json(res, 404, { error: "Bridge has no UI. Use desk mode against BRIDGE_URL." });
      return;
    }

    if (req.method === "GET") {
      const filePath =
        path === "/" || !extname(path)
          ? join(publicDir, "index.html")
          : join(publicDir, path.replace(/^\/+/, ""));
      if (!filePath.startsWith(publicDir)) {
        json(res, 403, { error: "Forbidden." });
        return;
      }
      try {
        const bytes = await readFile(filePath);
        res.writeHead(200, {
          "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
          "Cache-Control": "no-store",
        });
        res.end(bytes);
      } catch {
        const fallback = await readFile(join(publicDir, "index.html"));
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        res.end(fallback);
      }
      return;
    }

    json(res, 405, { error: "Method not allowed." });
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve());
  });

  const publicHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  return {
    url: `${scheme}://${publicHost}:${port}/`,
    kind,
    get settings() {
      return settings;
    },
    async stop() {
      for (const stop of unsubs) stop();
      listeners.clear();
      await closeHttpServer(server, openStreams);
      openStreams.clear();
    },
  };
}

function requireAccess(
  req: IncomingMessage,
  res: ServerResponse,
  kind: ServeKind,
  auth: AuthConfig | undefined,
  bridgeSecret: string | undefined
): AuthUser | undefined {
  if (kind === "bridge") {
    const header = req.headers.authorization;
    const bearer =
      typeof header === "string" && header.startsWith("Bearer ")
        ? header.slice("Bearer ".length).trim()
        : "";
    if (!bridgeSecret || bearer !== bridgeSecret) {
      json(res, 401, { error: "Invalid bridge secret." });
      return undefined;
    }
    return {
      id:
        typeof req.headers["x-draeven-actor-id"] === "string"
          ? req.headers["x-draeven-actor-id"]
          : "bridge",
      name:
        typeof req.headers["x-draeven-actor"] === "string"
          ? req.headers["x-draeven-actor"]
          : "Bridge",
    };
  }

  if (!auth) {
    json(res, 503, { error: "Discord OAuth is not configured." });
    return undefined;
  }
  const user = currentUser(req, auth);
  if (!user) {
    json(res, 401, { error: "Sign in with Discord first." });
    return undefined;
  }
  return user;
}

function serializeCommands(commands: readonly LoadableCommand[]) {
  return commands.map((entry) => {
    if (isCommand(entry)) {
      return {
        kind: "slash" as const,
        name: entry.name,
        description: entry.description,
        options: Object.keys(entry.options),
        subs: Object.keys(entry.subs),
      };
    }
    return {
      kind: entry.kind,
      name: entry.name,
      description: entry.kind === "user-menu" ? "User context menu" : "Message context menu",
      options: [] as string[],
      subs: [] as string[],
    };
  });
}

function summarizeEvent(name: string, value: unknown): string {
  if (!value || typeof value !== "object") return name;
  const row = value as Record<string, unknown>;
  if (name === "message" || name === "messageEdit") {
    const author = row.author as { name?: string } | undefined;
    const content = typeof row.content === "string" ? row.content.slice(0, 100) : "";
    return `${author?.name ?? "user"}: ${content || "(empty)"}`;
  }
  if (name === "memberJoin" || name === "memberLeave" || name === "memberUpdate") {
    return `${String(row.name ?? row.id ?? "member")} · ${String(row.guildId ?? "")}`;
  }
  if (name === "ready") {
    const user = row.user as { name?: string } | undefined;
    const guildIds = row.guildIds as unknown[] | undefined;
    return `${user?.name ?? "bot"} · ${guildIds?.length ?? 0} guilds`;
  }
  if (typeof row.id === "string") return row.id;
  if (typeof row.name === "string") return row.name;
  return name;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length < 1) return {};
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
