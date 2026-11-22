#!/usr/bin/env node
/* Draeven: create a bot project with config + commands folder */

import { mkdir, writeFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";

const args = process.argv.slice(2);
const command = args[0] ?? "init";

if (command !== "init") {
  console.error(
    "[Draeven] Usage: draeven init [folder] [--commands <path>] [--events <path>] [--with-dashboard]"
  );
  process.exit(1);
}

const folderFlag = flagValue(args, "--commands") ?? "./src/commands";
const eventsFlag = flagValue(args, "--events") ?? "./src/events";
const withDashboard = args.includes("--with-dashboard");
const pathFlags = new Set(["--commands", "--events"]);
const targetArg = args.find(
  (arg, index) => index > 0 && !arg.startsWith("--") && !pathFlags.has(args[index - 1] ?? "")
);
const root = resolve(process.cwd(), targetArg ?? ".");

await initProject(root, folderFlag, eventsFlag, withDashboard);

async function initProject(
  root: string,
  commandsRel: string,
  eventsRel: string,
  withDashboard: boolean
): Promise<void> {
  await mkdir(root, { recursive: true });

  const commandsDir = resolve(root, commandsRel);
  const eventsDir = resolve(root, eventsRel);
  await mkdir(commandsDir, { recursive: true });
  await mkdir(eventsDir, { recursive: true });
  await mkdir(join(root, "src"), { recursive: true });

  const configPath = join(root, "draeven.config.js");
  const packagePath = join(root, "package.json");
  const mainPath = join(root, "src", "main.ts");
  const deskPath = join(root, "src", "desk-main.ts");
  const pingPath = join(commandsDir, "ping.ts");
  const laterPath = join(commandsDir, "later.ts");
  const lettersPath = join(commandsDir, "letters.ts");
  const readyPath = join(eventsDir, "ready.ts");
  const lettersUsePath = join(eventsDir, "letters.ts");
  const gitignorePath = join(root, ".gitignore");
  const envExamplePath = join(root, ".env.example");
  const readmePath = join(root, "README.md");
  const devScriptPath = join(root, "scripts", "dev.mjs");

  if (!(await exists(configPath))) {
    const commandsOut = toDistFolder(commandsRel, "./dist/commands");
    const eventsOut = toDistFolder(eventsRel, "./dist/events");

    await writeFile(
      configPath,
      `/* Draeven project config. Point at compiled folders (not TypeScript sources). */\n\nexport default {\n  commands: ${JSON.stringify(commandsOut)},\n  events: ${JSON.stringify(eventsOut)},\n};\n`
    );
  }

  if (!(await exists(packagePath))) {
    const dependencies: Record<string, string> = {
      "@draeven/core": "^0.1.9",
    };
    if (withDashboard) {
      dependencies["@draeven/bridge"] = "^0.1.0";
    }

    const scripts: Record<string, string> = {
      build: "tsc -p tsconfig.json",
      start: "pnpm build && node dist/main.js",
      watch: "tsc -p tsconfig.json -w",
      dev: "node scripts/dev.mjs",
    };
    if (withDashboard) {
      scripts.desk = "pnpm build && node dist/desk-main.js";
      scripts["dev:desk"] = "pnpm build && node dist/desk-main.js";
    }

    await writeFile(
      packagePath,
      `${JSON.stringify(
        {
          name: "draeven-bot",
          version: "0.1.0",
          private: true,
          type: "module",
          scripts,
          dependencies,
          devDependencies: {
            "@types/node": "^22.0.0",
            typescript: "^5.9.0",
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
    await writeFile(
      gitignorePath,
      "node_modules/\ndist/\n.env\n.draeven.pid\n.draeven/\n"
    );
  }

  if (!(await exists(envExamplePath))) {
    await writeFile(envExamplePath, withDashboard ? dashboardEnvExample() : basicEnvExample());
  }

  if (!(await exists(readmePath))) {
    await writeFile(readmePath, withDashboard ? dashboardReadme() : basicReadme());
  }

  if (!(await exists(mainPath))) {
    await writeFile(mainPath, withDashboard ? dashboardMainSource() : basicMainSource());
  }

  if (withDashboard && !(await exists(deskPath))) {
    await writeFile(deskPath, deskMainSource());
  }

  if (!(await exists(pingPath))) {
    await writeFile(
      pingPath,
      `import { command } from "@draeven/core";\n\nexport const ping = command(\n  "ping",\n  "Checks whether the bot is alive",\n  async (ctx) => {\n    const { reply } = ctx;\n    return reply("pong");\n  }\n);\n`
    );
  }

  if (!(await exists(laterPath))) {
    await writeFile(laterPath, laterCommandSource());
  }

  if (!(await exists(lettersPath))) {
    await writeFile(lettersPath, lettersCommandSource());
  }

  if (!(await exists(readyPath))) {
    await writeFile(
      readyPath,
      `export function ready() {\n  console.log("[Draeven] Gateway ready");\n}\n`
    );
  }

  if (!(await exists(lettersUsePath))) {
    await writeFile(lettersUsePath, lettersUseSource());
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
  console.log(`[Draeven] Events folder: ${eventsRel} (gateway + use() handlers)`);
  if (withDashboard) {
    console.log("[Draeven] Dashboard scaffold enabled (@draeven/bridge).");
  }
  console.log(
    "[Draeven] Next: copy .env.example to .env, set DISCORD_TOKEN, pnpm install, pnpm start"
  );
  console.log(
    "[Draeven] Dev: pnpm dev (tsc watch + bot, hot-reload when Start({ watch: true }))."
  );
}

function toDistFolder(sourceRel: string, fallback: string): string {
  if (sourceRel.includes("dist")) {
    return sourceRel;
  }

  if (sourceRel.startsWith("./src/")) {
    return sourceRel.replace("./src/", "./dist/");
  }

  if (sourceRel.startsWith("src/")) {
    return `./dist/${sourceRel.slice("src/".length)}`;
  }

  return fallback;
}

function laterCommandSource(): string {
  return `import { button, command, row } from "@draeven/core";

/* Simple press: logic lives on the button. Fine for short replies. */
export const later = command("later", "A button that answers itself", async (ctx) =>
  ctx.reply({
    text: "Press Yes. The press handler answers later.",
    rows: [
      row(
        button({
          id: "later-yes",
          label: "Yes",
          color: "green",
          press: (press) => press.reply("Yes."),
        })
      ),
    ],
  })
);
`;
}

function lettersCommandSource(): string {
  return `import { button, command, row } from "@draeven/core";

/* Bigger flows: buttons have no press. events/letters.ts owns hangman_* via use(). */
export const letters = command("letters", "Posts letter buttons handled in events/", async (ctx) =>
  ctx.reply({
    text: "Pick a letter. Handled by use() in the events folder.",
    rows: [
      row(
        button({ id: "hangman_A", label: "A" }),
        button({ id: "hangman_B", label: "B" }),
        button({ id: "hangman_C", label: "C" })
      ),
    ],
  })
);
`;
}

function lettersUseSource(): string {
  return `import { button, row, use } from "@draeven/core";

const picked = new Set();

/* Durable handler: survives restarts (loaded from the events folder). */
export const letters = use({
  ids: "hangman_*",
  run(ctx) {
    const letter = ctx.id.slice("hangman_".length);
    picked.add(letter);

    return ctx.reply({
      text: \`You picked **\${letter}**. Message \${ctx.messageId ?? "?"}.\`,
      rows: [
        row(
          button({ id: "hangman_A", label: "A", disabled: picked.has("A") }),
          button({ id: "hangman_B", label: "B", disabled: picked.has("B") }),
          button({ id: "hangman_C", label: "C", disabled: picked.has("C") })
        ),
      ],
    });
  },
});
`;
}

function basicEnvExample(): string {
  return `DISCORD_TOKEN=
# Optional: sync slash commands to one guild while developing
# DISCORD_GUILD_ID=
`;
}

function dashboardEnvExample(): string {
  return `DISCORD_TOKEN=
# Optional: sync slash commands to one guild while developing
# DISCORD_GUILD_ID=

# Dashboard mode:
#   embedded  = bot + UI in one process (default)
#   off       = bot only
#   bridge    = bot + API only (other host runs the UI)
#   desk      = UI only (use \`pnpm desk\`, needs BRIDGE_URL)
DASHBOARD=embedded

# Discord OAuth for the UI (embedded or desk)
# Developer Portal → OAuth2 → redirect: http://127.0.0.1:3847/auth/callback
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DASHBOARD_OWNER_IDS=
# DASHBOARD_PORT=3847
# DASHBOARD_HOST=127.0.0.1
# DASHBOARD_SESSION_SECRET=
# DISCORD_REDIRECT_URI=http://127.0.0.1:3847/auth/callback

# Split setup (bot host = bridge, other console = desk)
# BRIDGE_SECRET=change-me-to-a-long-random-string
# BRIDGE_PORT=3848
# BRIDGE_HOST=0.0.0.0
# BRIDGE_URL=http://127.0.0.1:3848
# BRIDGE_ALLOW_IPS=127.0.0.1,::1
# BRIDGE_TLS_CERT=./certs/fullchain.pem
# BRIDGE_TLS_KEY=./certs/privkey.pem
`;
}

function basicReadme(): string {
  return `# Draeven bot

\`\`\`bash
cp .env.example .env
# set DISCORD_TOKEN
pnpm install
pnpm start
\`\`\`

Dev with hot-reload: \`pnpm dev\`.

See [Draeven](https://github.com/tonymelonely/Draeven-framework) for docs.
`;
}

function dashboardReadme(): string {
  return `# Draeven bot

\`\`\`bash
cp .env.example .env
# set DISCORD_TOKEN (+ OAuth vars for the desk UI)
pnpm install
pnpm start
\`\`\`

Dashboard modes (\`DASHBOARD\`): \`embedded\` (default), \`off\`, \`bridge\`, or \`desk\` (\`pnpm desk\`).

Dev with hot-reload: \`pnpm dev\`.

See [@draeven/bridge](https://www.npmjs.com/package/@draeven/bridge) and the [framework README](https://github.com/tonymelonely/Draeven-framework).
`;
}

function loadEnvHelper(): string {
  return `/* Read KEY=value lines. Values already set in the environment stay as they are. */
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
`;
}

function basicMainSource(): string {
  return `import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Start, intentsFor } from "@draeven/core";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(root, ".env"));

const token = process.env.DISCORD_TOKEN?.trim() ?? "";

if (!token) {
  throw new Error("[Draeven] Set DISCORD_TOKEN in .env");
}

const bot = await Start({
  token,
  watch: true,
  // Match BotEvents you register (ready needs no extra intents).
  intents: intentsFor("ready"),
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

${loadEnvHelper()}`;
}

function dashboardMainSource(): string {
  return `import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Start, intentsFor } from "@draeven/core";
import {
  readBridgeSecret,
  readDashboardMode,
  startDashboard,
  type DashboardHandle,
} from "@draeven/bridge";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(root, ".env"));

const token = process.env.DISCORD_TOKEN?.trim() ?? "";

if (!token) {
  throw new Error("[Draeven] Set DISCORD_TOKEN in .env");
}

const mode = readDashboardMode();

if (mode === "desk") {
  throw new Error("[Draeven] DASHBOARD=desk is UI-only. Run \`pnpm desk\` instead.");
}

const bot = await Start({
  token,
  watch: true,
  intents: intentsFor("ready"),
  presence: {
    status: "online",
    activity: { kind: "watching", text: "slash commands" },
  },
  ...(process.env.DISCORD_GUILD_ID
    ? { guildId: process.env.DISCORD_GUILD_ID.trim() }
    : {}),
});

let dashboard: DashboardHandle | undefined;

if (mode === "embedded") {
  dashboard = await startDashboard({
    bot,
    root,
    botToken: token,
    kind: "embedded",
    ...(Number(process.env.DASHBOARD_PORT) > 0
      ? { port: Number(process.env.DASHBOARD_PORT) }
      : {}),
    ...(process.env.DISCORD_GUILD_ID
      ? { guildId: process.env.DISCORD_GUILD_ID.trim() }
      : {}),
  });
  console.log(\`[Draeven] Dashboard (embedded) \${dashboard.url}\`);
} else if (mode === "bridge") {
  dashboard = await startDashboard({
    bot,
    root,
    botToken: token,
    kind: "bridge",
    bridgeSecret: readBridgeSecret(),
    ...(process.env.BRIDGE_HOST?.trim() ? { host: process.env.BRIDGE_HOST.trim() } : {}),
    ...(Number(process.env.BRIDGE_PORT) > 0 ? { port: Number(process.env.BRIDGE_PORT) } : {}),
    ...(process.env.DISCORD_GUILD_ID
      ? { guildId: process.env.DISCORD_GUILD_ID.trim() }
      : {}),
  });
  console.log(\`[Draeven] Bridge API \${dashboard.url}\`);
} else {
  console.log("[Draeven] Dashboard off (DASHBOARD=off).");
}

console.log(\`[Draeven] Ready with \${bot.commands.length} commands.\`);

let stopping = false;

async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log("[Draeven] Stopping…");
  const force = setTimeout(() => process.exit(0), 4000);
  force.unref();
  try {
    await dashboard?.stop();
    await bot.stop();
  } finally {
    clearTimeout(force);
    process.exit(0);
  }
}

process.once("SIGINT", () => {
  void stop();
});
process.once("SIGTERM", () => {
  void stop();
});

${loadEnvHelper()}`;
}

function deskMainSource(): string {
  return `import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readBridgeSecret, readBridgeUrl, startDesk } from "@draeven/bridge";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv(join(root, ".env"));

const desk = await startDesk({
  root,
  bridgeUrl: readBridgeUrl(),
  bridgeSecret: readBridgeSecret(),
  ...(process.env.DASHBOARD_HOST?.trim()
    ? { host: process.env.DASHBOARD_HOST.trim() }
    : {}),
  ...(Number(process.env.DASHBOARD_PORT) > 0
    ? { port: Number(process.env.DASHBOARD_PORT) }
    : {}),
});

console.log(\`[Draeven] Desk UI \${desk.url}\`);

let stopping = false;

async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log("[Draeven] Stopping desk…");
  const force = setTimeout(() => process.exit(0), 4000);
  force.unref();
  try {
    await desk.stop();
  } finally {
    clearTimeout(force);
    process.exit(0);
  }
}

process.once("SIGINT", () => {
  void stop();
});
process.once("SIGTERM", () => {
  void stop();
});

${loadEnvHelper()}`;
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
