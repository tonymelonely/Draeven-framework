/* Draeven Core: single-instance lock */

import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { claimAlone, isAlive } from "./alone.js";

test("claimAlone writes a lock and releases it", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-alone-"));
  const lock = await claimAlone({
    root,
    mode: true,
    script: join(root, "main.js"),
    listPids: async () => [],
  });

  const raw = JSON.parse(await readFile(join(root, ".draeven.pid"), "utf8")) as {
    pid: number;
  };
  expect(raw.pid).toBe(process.pid);

  await lock.release();
  await expect(readFile(join(root, ".draeven.pid"), "utf8")).rejects.toThrow();
});

test("claimAlone asks before replacing another live process", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-alone-"));
  /* A pid that isAlive: use this process, but claimAlone filters process.pid out of
     listPids — so seed the lock file with a different live-looking pid via isAlive
     on a child we control: write a lock pointing at a dead pid and inject listPids
     that returns a pid we mark live by... using mode ask with custom list that
     returns nothing alive unless we stub. Easiest path: lock file + pretend alive
     by using listPids empty and a lock pid we cannot kill — inject via writing
     lock with pid 1 on unix often alive, but brittle on Windows.
     Instead: custom listPids returns current pid; filter removes it — so force
     detection through lock by temporarily not filtering... We pass a lock with
     an injected "alive" check by using mode ask and listPids returning a pid
     that exists: spawn a short sleep child. */

  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  const childPid = child.pid;

  if (!childPid) {
    throw new Error("failed to spawn fixture process");
  }

  let asked = false;

  try {
    await expect(
      claimAlone({
        root,
        mode: "ask",
        script: join(root, "main.js"),
        listPids: async () => [childPid],
        ask: async () => {
          asked = true;
          return false;
        },
      })
    ).rejects.toThrow("Another bot is already running");

    expect(asked).toBe(true);
    expect(isAlive(childPid)).toBe(true);
  } finally {
    child.kill();
  }
});

test("claimAlone mode true stops a sibling and takes the lock", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-alone-"));
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
  const childPid = child.pid;

  if (!childPid) {
    throw new Error("failed to spawn fixture process");
  }

  try {
    const lock = await claimAlone({
      root,
      mode: true,
      script: join(root, "main.js"),
      listPids: async () => [childPid],
    });

    expect(isAlive(childPid)).toBe(false);
    const raw = JSON.parse(await readFile(join(root, ".draeven.pid"), "utf8")) as {
      pid: number;
    };
    expect(raw.pid).toBe(process.pid);
    await lock.release();
  } finally {
    try {
      child.kill();
    } catch {
      /* Already stopped. */
    }
  }
});

test("claimAlone mode false skips the check", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-alone-"));
  await mkdir(root, { recursive: true });
  const lock = await claimAlone({
    root,
    mode: false,
    listPids: async () => [12345],
  });

  await expect(readFile(join(root, ".draeven.pid"), "utf8")).rejects.toThrow();
  await lock.release();
});
