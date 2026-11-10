/* Draeven Core: userinfo as a test of the command API */

import { expect, expectTypeOf, test } from "vitest";
import { command, runCommand, user } from "../command.js";
import type { User } from "../lookup.js";
import { userinfo } from "./userinfo.js";

const tony: User = {
  id: "1",
  name: "Tony",
  createdAt: new Date(Date.UTC(2020, 0, 2)),
  bot: false,
};

const draeven: User = {
  id: "2",
  name: "Draeven",
  createdAt: new Date(Date.UTC(2024, 4, 6)),
  bot: true,
};

test("userinfo asks for an optional user", () => {
  expect(userinfo.name).toBe("userinfo");
  expect(userinfo.description).toBe("Shows who someone is");
  expect(userinfo.options.user).toEqual({
    kind: "user",
    question: "About whom?",
    required: false,
  });
});

test("without a user, userinfo is about the caller", async () => {
  const reply = await runCommand(userinfo, {
    author: { id: tony.id },
    users: [tony, draeven],
    opt: { user: undefined },
  });

  expect(reply.text).toBe(
    ["Name: Tony", "Id: 1", "Created: 02-01-2020", "Kind: human"].join("\n")
  );
});

test("with a user, userinfo shows that user", async () => {
  const reply = await runCommand(userinfo, {
    author: { id: tony.id },
    users: [tony, draeven],
    opt: { user: draeven },
  });

  expect(reply.text).toBe(
    ["Name: Draeven", "Id: 2", "Created: 06-05-2024", "Kind: bot"].join("\n")
  );
});

test("an empty user option is the full user or undefined", () => {
  command(
    "userinfo",
    "Shows who someone is",
    { user: user("About whom?") },
    (ctx) => {
      expectTypeOf(ctx.user).toEqualTypeOf<User | undefined>();
      return ctx.reply("ok");
    }
  );
});

