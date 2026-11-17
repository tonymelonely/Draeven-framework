/* Persistent dashboard audit log (JSONL). */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface AuditEntry {
  at: string;
  actorId: string;
  actorName: string;
  action: string;
  detail?: string;
}

export async function appendAudit(root: string, entry: Omit<AuditEntry, "at">): Promise<AuditEntry> {
  const full: AuditEntry = { at: new Date().toISOString(), ...entry };
  const path = auditPath(root);
  await mkdir(dirname(path), { recursive: true });
  await appendFile(path, `${JSON.stringify(full)}\n`, "utf8");
  return full;
}

export async function readAudit(root: string, limit = 200): Promise<AuditEntry[]> {
  const path = auditPath(root);

  try {
    const text = await readFile(path, "utf8");
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const parsed: AuditEntry[] = [];

    for (const line of lines.slice(-Math.max(limit, 1))) {
      try {
        parsed.push(JSON.parse(line) as AuditEntry);
      } catch {
        /* skip bad lines */
      }
    }

    return parsed.reverse();
  } catch {
    return [];
  }
}

function auditPath(root: string): string {
  return join(root, ".draeven", "audit.jsonl");
}
