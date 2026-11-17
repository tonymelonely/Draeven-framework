/* Discord OAuth2 login + signed cookie sessions for the local desk. */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export interface AuthUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface AuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  ownerIds: readonly string[];
  sessionSecret: string;
}

interface SessionRecord {
  user: AuthUser;
  expiresAt: number;
}

const sessions = new Map<string, SessionRecord>();
const oauthStates = new Map<string, number>();

export function readAuthConfig(): AuthConfig | undefined {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim() ?? "";
  const redirectUri =
    process.env.DISCORD_REDIRECT_URI?.trim() ||
    `http://127.0.0.1:${process.env.DASHBOARD_PORT?.trim() || "3847"}/auth/callback`;
  const ownerIds = (process.env.DASHBOARD_OWNER_IDS ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const sessionSecret =
    process.env.DASHBOARD_SESSION_SECRET?.trim() ||
    process.env.DASHBOARD_TOKEN?.trim() ||
    randomBytes(24).toString("hex");

  if (!clientId || !clientSecret || ownerIds.length < 1) {
    return undefined;
  }

  return { clientId, clientSecret, redirectUri, ownerIds, sessionSecret };
}

export function beginOAuth(config: AuthConfig): { url: string; state: string } {
  const state = randomBytes(16).toString("hex");
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  pruneMaps();

  const url = new URL("https://discord.com/api/oauth2/authorize");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "identify");
  url.searchParams.set("state", state);

  return { url: url.toString(), state };
}

export async function finishOAuth(
  config: AuthConfig,
  code: string,
  state: string
): Promise<AuthUser> {
  const expires = oauthStates.get(state);
  oauthStates.delete(state);

  if (!expires || expires < Date.now()) {
    throw new Error("Invalid or expired OAuth state.");
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!tokenResponse.ok) {
    throw new Error(`OAuth token exchange failed (${tokenResponse.status}).`);
  }

  const tokenJson = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("OAuth token missing.");
  }

  const meResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });

  if (!meResponse.ok) {
    throw new Error(`OAuth profile failed (${meResponse.status}).`);
  }

  const me = (await meResponse.json()) as {
    id?: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
  };

  if (!me.id || !me.username) {
    throw new Error("OAuth profile incomplete.");
  }

  if (!config.ownerIds.includes(me.id)) {
    throw new Error("This Discord account is not allowed on this dashboard.");
  }

  return {
    id: me.id,
    name: (me.global_name && me.global_name.trim()) || me.username,
    ...(me.avatar
      ? { avatar: `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128` }
      : {}),
  };
}

export function createSession(config: AuthConfig, user: AuthUser): string {
  const id = randomBytes(24).toString("hex");
  sessions.set(id, { user, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  pruneMaps();
  return signSession(config.sessionSecret, id);
}

export function destroySession(req: IncomingMessage, config: AuthConfig): void {
  const id = readSessionId(req, config.sessionSecret);
  if (id) {
    sessions.delete(id);
  }
}

export function currentUser(req: IncomingMessage, config: AuthConfig): AuthUser | undefined {
  const id = readSessionId(req, config.sessionSecret);
  if (!id) {
    return undefined;
  }

  const record = sessions.get(id);
  if (!record || record.expiresAt < Date.now()) {
    sessions.delete(id);
    return undefined;
  }

  return record.user;
}

export function setSessionCookie(res: ServerResponse, signed: string): void {
  res.setHeader(
    "Set-Cookie",
    `draeven_session=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
  );
}

export function clearSessionCookie(res: ServerResponse): void {
  res.setHeader("Set-Cookie", "draeven_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

function readSessionId(req: IncomingMessage, secret: string): string | undefined {
  const cookie = req.headers.cookie;
  if (!cookie) {
    return undefined;
  }

  const match = cookie.match(/(?:^|;\s*)draeven_session=([^;]+)/);
  if (!match?.[1]) {
    return undefined;
  }

  return verifySession(secret, decodeURIComponent(match[1]));
}

function signSession(secret: string, id: string): string {
  const sig = createHmac("sha256", secret).update(id).digest("base64url");
  return `${id}.${sig}`;
}

function verifySession(secret: string, value: string): string | undefined {
  const [id, sig] = value.split(".");
  if (!id || !sig) {
    return undefined;
  }

  const expected = createHmac("sha256", secret).update(id).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return undefined;
  }

  return id;
}

function pruneMaps(): void {
  const now = Date.now();

  for (const [key, expires] of oauthStates) {
    if (expires < now) {
      oauthStates.delete(key);
    }
  }

  for (const [key, record] of sessions) {
    if (record.expiresAt < now) {
      sessions.delete(key);
    }
  }
}
