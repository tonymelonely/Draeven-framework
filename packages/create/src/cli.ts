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
          },
          dependencies: {
            "@draeven/core": "^0.1.0",
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
    await writeFile(gitignorePath, "node_modules/\ndist/\n.env\n");
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
      `import { Start } from "@draeven/core";\n\nconst token = process.env.DISCORD_TOKEN?.trim() ?? "";\n\nif (!token) {\n  throw new Error("[Draeven] Set DISCORD_TOKEN.");\n}\n\nconst bot = await Start({\n  token,\n  presence: {\n    status: "online",\n    activity: { kind: "watching", text: "slash commands" },\n  },\n  ...(process.env.DISCORD_GUILD_ID\n    ? { guildId: process.env.DISCORD_GUILD_ID.trim() }\n    : {}),\n});\n\nconsole.log(\`[Draeven] Ready with \${bot.commands.length} commands.\`);\n`
    );
  }

  if (!(await exists(pingPath))) {
    await writeFile(
      pingPath,
      `import { command } from "@draeven/core";\n\nexport const ping = command(\n  "ping",\n  "Checks whether the bot is alive",\n  async (ctx) => {\n    const { reply } = ctx;\n    return reply("pong");\n  }\n);\n`
    );
  }

  console.log(`[Draeven] Project ready in ${root}`);
  console.log(`[Draeven] Commands folder: ${commandsRel} (config points at compiled output)`);
  console.log("[Draeven] Next: set DISCORD_TOKEN, pnpm install, pnpm start");
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
