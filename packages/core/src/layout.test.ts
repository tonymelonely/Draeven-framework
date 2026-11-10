/* Draeven Core: tests for Components V2 layout() */

import { expect, test } from "vitest";
import { command, layout, runCommand, show, divide, pack, album, thumb, beside } from "./command.js";
import { colors } from "./embed.js";
import { COMPONENTS_V2, discordLayout } from "./layout.js";

test("layout encodes Discord Components V2 parts", () => {
  const entry = layout(
    show("Hello"),
    divide({ size: "lg", line: true }),
    pack({ color: colors.blurple }, show("Inside")),
    beside({ text: "Side", with: thumb("https://cdn.discordapp.com/embed/avatars/0.png") }),
    album("https://cdn.discordapp.com/embed/avatars/1.png")
  );

  expect(COMPONENTS_V2).toBe(32768);
  expect(discordLayout(entry)).toEqual([
    { type: 10, content: "Hello" },
    { type: 14, divider: true, spacing: 2 },
    {
      type: 17,
      accent_color: 0x5865f2,
      spoiler: false,
      components: [{ type: 10, content: "Inside" }],
    },
    {
      type: 9,
      components: [{ type: 10, content: "Side" }],
      accessory: {
        type: 11,
        media: { url: "https://cdn.discordapp.com/embed/avatars/0.png" },
      },
    },
    {
      type: 12,
      items: [
        {
          media: { url: "https://cdn.discordapp.com/embed/avatars/1.png" },
          spoiler: false,
        },
      ],
    },
  ]);
});

test("a command can reply with a layout", async () => {
  const panel = command("panel", "Shows a layout", async (ctx) => {
    const { reply } = ctx;
    return reply(layout(show("Draeven")));
  });

  const sent = await runCommand(panel, {
    author: { id: "1" },
    users: [
      {
        id: "1",
        name: "Tony",
        createdAt: new Date(),
        bot: false,
      },
    ],
    opt: {},
  });

  expect(sent.layout?.parts).toHaveLength(1);
});
