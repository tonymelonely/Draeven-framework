#!/usr/bin/env node
/* Draeven: create a bot project with config + commands folder */

import { mkdir, writeFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const command = args[0] ?? "init";

if (command !== "init") {
  console.error("[Draeven] Usage: draeven init [folder] [--commands <path>]");
  process.exit(1);
}

const folderFlag = flagValue(args, "--commands") ?? "./src/commands";
const targetArg = args.find((arg, index) => index > 0 && !arg.startsWith("--") && args[index - 1] !== "--commands");
const root = resolve(process.cwd(), targetArg ?? ".");

await initProject(root, folderFlag);

async function initProject(root: string, commandsRel: string): Promise<void> {
  await mkdir(root, { recursive: true });

  const commandsDir = resolve(root, commandsRel);
  await mkdir(commandsDir, { recursive: true });
  await mkdir(join(root, "src"), { recursive: true });

  const configPath = join(root, "draeven.config.js");
  const packagePath = join(root, "package.json");
  const mainPath = join(root, "src", "main.ts");
  const pingPath = join(commandsDir, "ping.ts");
  const gitignorePath = join(root, ".gitignore");
  const envExamplePath = join(root, ".env.example");
  const devScriptPath = join(root, "scripts", "dev.mjs");

  if (!(await exists(configPath))) {
    const runtimeFolder = commandsRel.includes("dist")
      ? commandsRel
      : commandsRel.startsWith("./src/")
        ? commandsRel.replace("./src/", "./dist/")
        : commandsRel.startsWith("src/")
          ? `./dist/${commandsRel.slice("src/".length)}`
          : "./dist/commands";

    await writeFile(
      configPath,
      `/* Draeven project config. Change commands to point at your compiled command folder. */\n\nexport default {\n  commands: ${JSON.stringify(runtimeFolder)},\n};\n`
    );
  }

  if (!(await exists(packagePath))) {
    await writeFile(
      packagePath,
      `${JSON.stringify(
        {
          name: "draeven-bot",
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            build: "tsc -p tsconfig.json",
            start: "pnpm build && node dist/main.js",
            watch: "tsc -p tsconfig.json -w",
            dev: "node scripts/dev.mjs",
          },
          dependencies: {
            "@draeven/core": "^0.1.5",
          },
          devDependencies: {
            "@types/node": "^22.0.0",
            typescript: "^5.6.0",
          },
        },
        null,
        2
      )}\n`
    );
  }

  if (!(await exists(join(root, "tsconfig.json")))) {
    await writeFile(
      join(root, "tsconfig.json"),
      `${JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            outDir: "dist",
            rootDir: "src",
            skipLibCheck: true,
            types: ["node"],
          },
          include: ["src/**/*.ts"],
        },
        null,
        2
      )}\n`
    );
  }

  if (!(await exists(gitignorePath))) {
    await writeFile(gitignorePath, "node_modules/\ndist/\n.env\n.draeven.pid\n");
  }

  if (!(await exists(envExamplePath))) {
    await writeFile(
      envExamplePath,
      "DISCORD_TOKEN=\n# Optional: sync slash commands to one guild while developing\n# DISCORD_GUILD_ID=\n"
    );
  }

  if (!(await exists(mainPath))) {
    await writeFile(
      mainPath,
      `import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Start } from "@draeven/core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(root, ".env"));

const token = process.env.DISCORD_TOKEN?.trim() ?? "";

if (!token) {
  throw new Error("[Draeven] Set DISCORD_TOKEN in .env");
}

const bot = await Start({
  token,
  watch: true,
  presence: {
    status: "online",
    activity: { kind: "watching", text: "slash commands" },
  },
  // Optional: import { guard } from "@draeven/core" and pass guard({ via: "console", of: "all", uptime: true })
  ...(process.env.DISCORD_GUILD_ID
    ? { guildId: process.env.DISCORD_GUILD_ID.trim() }
    : {}),
});

console.log(\`[Draeven] Ready with \${bot.commands.length} commands.\`);

/* Read KEY=value lines. Values already set in the environment stay as they are. */
function loadEnv(path: string): void {
  if (!existsSync(path)) {
    return;
  }

  const text = readFileSync(path, "utf8").replace(/^\\uFEFF/, "");

  for (const line of text.split(/\\r?\\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");

    if (separator === -1) {
      continue;
    }

    let key = trimmed.slice(0, separator).trim();

    if (key.startsWith("export ")) {
      key = key.slice("export ".length).trim();
    }

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separator + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}
`
    );
  }

  if (!(await exists(pingPath))) {
    await writeFile(
      pingPath,
      `import { command } from "@draeven/core";\n\nexport const ping = command(\n  "ping",\n  "Checks whether the bot is alive",\n  async (ctx) => {\n    const { reply } = ctx;\n    return reply("pong");\n  }\n);\n`
    );
  }

  if (!(await exists(devScriptPath))) {
    await mkdir(join(root, "scripts"), { recursive: true });
    await writeFile(
      devScriptPath,
      `#!/usr/bin/env node\n/* Run tsc -w and the bot together for Draeven hot-reload. */\n\nimport { spawn } from "node:child_process";\nimport { once } from "node:events";\n\nconst shell = process.platform === "win32";\n\nfunction run(command) {\n  return spawn(command, { stdio: "inherit", shell });\n}\n\nconst build = run("pnpm build");\nconst [buildCode] = await once(build, "exit");\n\nif (buildCode !== 0) {\n  process.exit(buildCode ?? 1);\n}\n\nconst watch = run("pnpm exec tsc -p tsconfig.json -w --preserveWatchOutput");\nconst bot = spawn(process.execPath, ["dist/main.js"], { stdio: "inherit" });\n\nfunction stop(code = 0) {\n  watch.kill();\n  bot.kill();\n  process.exit(code);\n}\n\nprocess.once("SIGINT", () => stop(0));\nprocess.once("SIGTERM", () => stop(0));\n\nconst [botCode] = await once(bot, "exit");\nstop(botCode ?? 0);\n`
    );
  }

  console.log(`[Draeven] Project ready in ${root}`);
  console.log(`[Draeven] Commands folder: ${commandsRel} (config points at compiled output)`);
  console.log("[Draeven] Next: copy .env.example to .env, set DISCORD_TOKEN, pnpm install, pnpm start");
  console.log("[Draeven] Dev: pnpm dev (tsc watch + bot, hot-reload when Start({ watch: true })).");
}

function flagValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
