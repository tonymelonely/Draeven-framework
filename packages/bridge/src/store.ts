/* Persist local dashboard settings on disk. */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export type DashboardLanguage = "nl" | "en";

export interface DashboardSettings {
  language: DashboardLanguage;
  /** Optional message-command prefix (slash commands stay the primary API). */
  prefix: string;
  presenceText: string;
  presenceStatus: "online" | "idle" | "dnd" | "invisible";
  showBotMessagesInFeed: boolean;
  feedLimit: number;
  /** Selected guild for members/actions (overrides env default when set). */
  selectedGuildId?: string;
}

const defaults: DashboardSettings = {
  language: "nl",
  prefix: "!",
  presenceText: "slash commands",
  presenceStatus: "online",
  showBotMessagesInFeed: false,
  feedLimit: 300,
};

export async function loadSettings(root: string): Promise<DashboardSettings> {
  const path = settingsPath(root);

  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<DashboardSettings>;
    return {
      ...defaults,
      ...parsed,
      language: parsed.language === "en" ? "en" : "nl",
      prefix: typeof parsed.prefix === "string" ? parsed.prefix.slice(0, 8) : defaults.prefix,
      presenceText:
        typeof parsed.presenceText === "string" && parsed.presenceText.trim()
          ? parsed.presenceText.trim().slice(0, 64)
          : defaults.presenceText,
      presenceStatus: isStatus(parsed.presenceStatus) ? parsed.presenceStatus : defaults.presenceStatus,
      showBotMessagesInFeed: parsed.showBotMessagesInFeed === true,
      feedLimit:
        typeof parsed.feedLimit === "number" && parsed.feedLimit >= 50 && parsed.feedLimit <= 1000
          ? Math.floor(parsed.feedLimit)
          : defaults.feedLimit,
      ...(typeof parsed.selectedGuildId === "string" && parsed.selectedGuildId.trim()
        ? { selectedGuildId: parsed.selectedGuildId.trim() }
        : {}),
    };
  } catch {
    return { ...defaults };
  }
}

export async function saveSettings(root: string, next: DashboardSettings): Promise<void> {
  const path = settingsPath(root);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function isStatus(value: unknown): value is DashboardSettings["presenceStatus"] {
  return value === "online" || value === "idle" || value === "dnd" || value === "invisible";
}

function settingsPath(root: string): string {
  return join(root, ".draeven", "dashboard-settings.json");
}
