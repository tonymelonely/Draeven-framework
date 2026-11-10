import { mkdtemp, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";

test("draeven init writes config and ping command", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-init-"));
  const cli = fileURLToPath(new URL("./cli.js", import.meta.url));
  const result = spawnSync(process.execPath, [cli, "init", root], {
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  const config = await readFile(join(root, "draeven.config.js"), "utf8");
  assert.match(config, /dist\/commands/);
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  assert.match(pkg.dependencies["@draeven/core"], /\^0\.1/);
  assert.ok(pkg.devDependencies["@types/node"]);
  assert.match(pkg.scripts.start, /--env-file=\.env/);
  const tsconfig = JSON.parse(await readFile(join(root, "tsconfig.json"), "utf8")) as {
    compilerOptions: { types?: string[] };
  };
  assert.deepEqual(tsconfig.compilerOptions.types, ["node"]);
  const ping = await readFile(join(root, "src", "commands", "ping.ts"), "utf8");
  assert.match(ping, /command\(\s*"ping"/);
  await access(join(root, ".gitignore"));
  await access(join(root, ".env.example"));

  await assert.rejects(access(join(root, "commands")));
});

test("draeven init respects --commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "draeven-init-"));
  const cli = fileURLToPath(new URL("./cli.js", import.meta.url));
  const result = spawnSync(
    process.execPath,
    [cli, "init", root, "--commands", "./src/commands"],
    { encoding: "utf8" }
  );

  assert.equal(result.status, 0, result.stderr);
  const ping = await readFile(join(root, "src", "commands", "ping.ts"), "utf8");
  assert.match(ping, /command\(\s*"ping"/);
});
