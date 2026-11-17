/* Draeven Core: one bot process per project */

import { spawnSync } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { join, normalize, resolve } from "node:path";

const LOCK_NAME = ".draeven.pid";

export type AloneMode = boolean | "ask";

export interface AloneOptions {
  /** true = kill, false = skip, "ask" = prompt on a TTY (default). */
  mode?: AloneMode;
  /** Project root for the lock file. Defaults to process.cwd(). */
  root?: string;
  /** Main script path used to spot sibling node processes. */
  script?: string;
  /** Injected for tests. */
  ask?: (question: string) => Promise<boolean>;
  /** Injected for tests. */
  listPids?: (script: string) => Promise<number[]>;
}

export interface AloneLock {
  release(): Promise<void>;
}

interface LockFile {
  pid: number;
  script?: string;
}

/** Ensure this process is the only Draeven bot for the project, then hold a lock. */
export async function claimAlone(options: AloneOptions = {}): Promise<AloneLock> {
  const mode = options.mode ?? "ask";

  if (mode === false) {
    return { async release() {} };
  }

  const root = resolve(options.root ?? process.cwd());
  const script = resolve(options.script ?? process.argv[1] ?? "");
  const lockPath = join(root, LOCK_NAME);
  const listPids = options.listPids ?? listSiblingPids;
  const ask = options.ask ?? askConsole;

  const locked = await readLock(lockPath);
  const fromLock =
    locked && locked.pid !== process.pid && isAlive(locked.pid) ? [locked.pid] : [];
  const fromScan = script
    ? (await listPids(script)).filter((pid) => pid !== process.pid && isAlive(pid))
    : [];
  const others = [...new Set([...fromLock, ...fromScan])];

  if (others.length > 0) {
    const label = others.length === 1 ? `pid ${others[0]}` : `pids ${others.join(", ")}`;
    const question = `[Draeven] Another bot is already running (${label}). Stop it and continue? [y/N] `;

    const replace =
      mode === true
        ? true
        : process.stdin.isTTY || options.ask
          ? await ask(question)
          : false;

    if (!replace) {
      throw new Error(
        `[Draeven] Another bot is already running (${label}). Stop it, or pass alone: true.`
      );
    }

    for (const pid of others) {
      killPid(pid);
    }

    await waitUntilDead(others, 3_000);
  }

  await writeFile(
    lockPath,
    `${JSON.stringify({ pid: process.pid, ...(script ? { script } : {}) } satisfies LockFile)}\n`,
    "utf8"
  );

  return {
    async release() {
      const current = await readLock(lockPath);

      if (current?.pid === process.pid) {
        await unlink(lockPath).catch(() => undefined);
      }
    },
  };
}

export async function listSiblingPids(script: string): Promise<number[]> {
  const needle = normalize(resolve(script)).toLowerCase();

  if (!needle) {
    return [];
  }

  const rows =
    process.platform === "win32" ? await listWindowsNode() : await listUnixNode();
  const hits: number[] = [];

  for (const row of rows) {
    if (row.pid === process.pid) {
      continue;
    }

    const cmd = normalize(row.cmd).toLowerCase();

    if (cmd.includes(needle) || cmd.includes(needle.replaceAll("\\", "/"))) {
      hits.push(row.pid);
    }
  }

  return hits;
}

export function isAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function killPid(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* Already gone. */
  }
}

async function readLock(path: string): Promise<LockFile | undefined> {
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as unknown;

    if (
      typeof raw !== "object" ||
      raw === null ||
      !("pid" in raw) ||
      typeof raw.pid !== "number" ||
      !Number.isInteger(raw.pid)
    ) {
      return undefined;
    }

    const script =
      "script" in raw && typeof raw.script === "string" && raw.script
        ? raw.script
        : undefined;

    return { pid: raw.pid, ...(script ? { script } : {}) };
  } catch {
    return undefined;
  }
}

async function askConsole(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = await new Promise<string>((resolveAnswer) => {
      rl.question(question, resolveAnswer);
    });

    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    rl.close();
  }
}

async function waitUntilDead(pids: readonly number[], ms: number): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < ms) {
    if (pids.every((pid) => !isAlive(pid))) {
      return;
    }

    await new Promise((resolveWait) => {
      setTimeout(resolveWait, 100);
    });
  }
}

async function listWindowsNode(): Promise<Array<{ pid: number; cmd: string }>> {
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress",
    ],
    { encoding: "utf8", windowsHide: true }
  );

  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(result.stdout);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    const out: Array<{ pid: number; cmd: string }> = [];

    for (const row of rows) {
      if (
        typeof row !== "object" ||
        row === null ||
        !("ProcessId" in row) ||
        typeof row.ProcessId !== "number"
      ) {
        continue;
      }

      const cmd =
        "CommandLine" in row && typeof row.CommandLine === "string" ? row.CommandLine : "";
      out.push({ pid: row.ProcessId, cmd });
    }

    return out;
  } catch {
    return [];
  }
}

async function listUnixNode(): Promise<Array<{ pid: number; cmd: string }>> {
  const result = spawnSync("ps", ["-Ao", "pid=,args="], { encoding: "utf8" });

  if (result.status !== 0 || !result.stdout.trim()) {
    return [];
  }

  const out: Array<{ pid: number; cmd: string }> = [];

  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const match = /^(\d+)\s+(.*)$/.exec(trimmed);

    if (!match) {
      continue;
    }

    const cmd = match[2] ?? "";

    if (!/\bnode\b/.test(cmd)) {
      continue;
    }

    out.push({ pid: Number(match[1]), cmd });
  }

  return out;
}
