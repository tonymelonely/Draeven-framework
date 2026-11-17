#!/usr/bin/env node
/* Run tsc -w and the bot together for Draeven hot-reload. */

import { spawn } from "node:child_process";
import { once } from "node:events";

const shell = process.platform === "win32";

function run(command) {
  return spawn(command, { stdio: "inherit", shell });
}

const build = run("pnpm build");
const [buildCode] = await once(build, "exit");

if (buildCode !== 0) {
  process.exit(buildCode ?? 1);
}

const watch = run("pnpm exec tsc -p tsconfig.json -w --preserveWatchOutput");
const bot = spawn(process.execPath, ["dist/main.js"], { stdio: "inherit" });

function stop(code = 0) {
  watch.kill();
  bot.kill();
  process.exit(code);
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

const [botCode] = await once(bot, "exit");
stop(botCode ?? 0);
