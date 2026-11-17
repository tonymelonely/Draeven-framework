import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { appendAudit, readAudit } from "./audit.js";

test("appendAudit and readAudit round-trip newest first", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-audit-"));

  try {
    expect(await readAudit(root)).toEqual([]);

    await appendAudit(root, {
      actorId: "1",
      actorName: "Ada",
      action: "kick",
      detail: "spam",
    });
    await appendAudit(root, {
      actorId: "2",
      actorName: "Bob",
      action: "ban",
    });

    const entries = await readAudit(root, 10);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.action).toBe("ban");
    expect(entries[1]?.action).toBe("kick");
    expect(entries[1]?.detail).toBe("spam");
    expect(entries[0]?.at).toMatch(/^\d{4}-/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
