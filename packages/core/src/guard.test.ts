/* Draeven Core: tests for guard() */

import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { formatUptime, guard, isGuard } from "./guard.js";

test("guard validates via and of", () => {
  expect(() => guard({ via: "channel", of: "all" })).toThrow(/channel/);
  expect(() => guard({ via: "file", of: "all" })).toThrow(/file/);
  expect(isGuard(guard({ via: "console", of: "commands" }))).toBe(true);
});

test("guard reports only selected sources", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-guard-"));
  const file = join(root, "bot.log");
  const g = guard({ via: ["console", "file"], of: ["commands"], file, uptime: true });

  g.attach({ startedAt: Date.now() - 5_000 });
  g.report("commands", new Error("boom"));
  g.report("events", new Error("ignored"));

  await new Promise((resolve) => setTimeout(resolve, 30));
  const text = await readFile(file, "utf8");
  expect(text).toContain("commands error");
  expect(text).toContain("boom");
  expect(text).toContain("uptime");
  expect(text).not.toContain("events error");
  g.dispose();
});

test("formatUptime renders short durations", () => {
  expect(formatUptime(1_000)).toBe("1s");
  expect(formatUptime(65_000)).toBe("1m 5s");
  expect(formatUptime(3_726_000)).toBe("1h 2m");
});
