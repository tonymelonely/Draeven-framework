/* @draeven/bridge — bot↔dashboard bridge */

export const version = "0.1.0";

export { startDashboard } from "./server.js";
export type { DashboardHandle, DashboardOptions, ServeKind } from "./server.js";

export { startDesk } from "./desk.js";
export type { DeskHandle, DeskOptions } from "./desk.js";

export { readDashboardMode, readBridgeSecret, readBridgeUrl } from "./mode.js";
export type { DashboardMode } from "./mode.js";

export { loadSettings, saveSettings } from "./store.js";
export type { DashboardLanguage, DashboardSettings } from "./store.js";

export { appendAudit, readAudit } from "./audit.js";
export type { AuditEntry } from "./audit.js";

export { readAllowIps, clientIp, ipAllowed } from "./hardening.js";
export { bridgePublicDir } from "./paths.js";
