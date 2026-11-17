/* Dashboard run modes for bot-only, embedded, bridge, or remote desk. */

export type DashboardMode = "off" | "embedded" | "bridge" | "desk";

export function readDashboardMode(raw = process.env.DASHBOARD): DashboardMode {
  const value = (raw ?? "embedded").trim().toLowerCase();

  if (value === "off" || value === "0" || value === "false" || value === "no") {
    return "off";
  }

  if (value === "bridge" || value === "api") {
    return "bridge";
  }

  if (value === "desk" || value === "ui" || value === "remote") {
    return "desk";
  }

  return "embedded";
}

export function readBridgeSecret(): string {
  const secret = process.env.BRIDGE_SECRET?.trim() || process.env.DASHBOARD_TOKEN?.trim() || "";

  if (!secret || secret.length < 12) {
    throw new Error(
      "[Draeven] Bridge mode needs BRIDGE_SECRET (at least 12 characters) in .env."
    );
  }

  return secret;
}

export function readBridgeUrl(): string {
  const url = process.env.BRIDGE_URL?.trim();

  if (!url) {
    throw new Error(
      "[Draeven] Desk mode needs BRIDGE_URL (example: http://127.0.0.1:3848)."
    );
  }

  return url.replace(/\/$/, "");
}
