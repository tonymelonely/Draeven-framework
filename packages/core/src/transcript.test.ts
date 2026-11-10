/* Draeven Core: tests for a channel transcript */

import { expect, test } from "vitest";
import { renderTranscript } from "./transcript.js";
import type { ChannelHistory } from "@draeven/discord";

const history: ChannelHistory = {
  channel: { id: "11", name: "general", kind: "text", topic: "Hello", guildId: "42" },
  truncated: false,
  messages: [
    {
      id: "2",
      type: 0,
      content: "See <script>",
      timestamp: "2020-01-02T00:01:00.000Z",
      author: { id: "5", username: "tony", global_name: "Tony" },
      reactions: [{ count: 2, emoji: { name: "🔥" }, count_details: { burst: 1, normal: 1 } }],
      embeds: [{ title: "Card", description: "Hi", color: 0x5865f2 }],
      components: [{ type: 1, components: [{ type: 2, style: 1, label: "Yes" }] }],
    },
    {
      id: "1",
      type: 7,
      content: "",
      timestamp: "2020-01-02T00:00:00.000Z",
      author: { id: "5", username: "tony" },
    },
  ],
};

test("renders the channel oldest first and escapes text", () => {
  const page = renderTranscript(history, { guildName: "Home" });
  const html = new TextDecoder().decode(page.bytes);

  expect(page.name).toBe("general.html");
  expect(page.note).toBe("2 messages from #general.");
  expect(html.indexOf("joined")).toBeLessThan(html.indexOf("See"));
  expect(html).toContain("Home / #general");
  expect(html).toContain("See &lt;script&gt;");
  expect(html).not.toContain("See <script>");
  expect(html).toContain("Card");
  expect(html).toContain("Yes");
  expect(html).toContain("🔥");
  expect(html).toContain("tony joined.");
  expect(html).toContain("cursor: pointer");
  expect(html).toContain("article:hover");
});

test("colors a bot and a role, and keeps a markdown link and a local time", () => {
  const page = renderTranscript(
    {
      channel: { id: "11", name: "general", kind: "text", guildId: "42" },
      truncated: false,
      messages: [
        {
          id: "8",
          type: 0,
          content: "Hi <@&9> [Open transcript](https://example.com/a?x=1&y=2)",
          timestamp: "2020-01-02T00:00:00.000Z",
          author: { id: "5", username: "nexus", global_name: "Cloud Nexus", bot: true },
          member: { roles: ["9", "3"] },
        },
        {
          id: "7",
          type: 0,
          content: "hello",
          timestamp: "2020-01-02T00:00:01.000Z",
          author: { id: "6", username: "tony", global_name: "Tony", bot: false },
          member: { roles: ["9"] },
        },
      ],
    },
    {
      timeZone: "Europe/Amsterdam",
      link: "https://archive.example/{guild}/{channel}/{message}",
      roles: [
        { id: "3", name: "Member", color: 0, position: 1 },
        { id: "9", name: "Staff", color: 0xff0000, position: 5 },
      ],
      profiles: [{ id: "6", clan: "DEV", clanIcon: "https://cdn.example/clan.png" }],
    }
  );
  const html = new TextDecoder().decode(page.bytes);

  expect(html).toContain('class="app">APP</span>');
  expect(html).toContain("color:#ff0000");
  expect(html).toContain("@Staff");
  expect(html).toContain('class="clan"');
  expect(html).toContain("DEV");
  expect(html).toMatch(/class="name"[^>]*style="color:#ff0000"[^>]*>Tony</);
  expect(html).toContain(">Open transcript</a>");
  expect(html).not.toContain("[Open transcript]");
  expect(html).toContain('href="https://example.com/a?x=1&amp;y=2"');
  expect(html).toContain('href="https://archive.example/42/11/8"');
  expect(html).toContain("02 Jan 2020");
  expect(html).toContain("01:00");
  expect(html).toContain('data-user="5"');
});

test("keeps code fences, slash commands, gifs, and never marks people as apps", () => {
  const page = renderTranscript(
    {
      channel: { id: "11", name: "general", kind: "text", guildId: "42" },
      truncated: false,
      messages: [
        {
          id: "4",
          type: 20,
          content: "Saved the channel.",
          timestamp: "2020-01-02T00:03:00.000Z",
          author: { id: "9", username: "bot", global_name: "Helper", bot: true },
          interaction: { type: 2, name: "transcript", user: { id: "5", username: "tony", global_name: "Tony", bot: false } },
          embeds: [
            {
              type: "gifv",
              url: "https://tenor.com/view/x",
              video: { url: "https://cdn.example/a.mp4" },
              thumbnail: { url: "https://cdn.example/a.gif" },
            },
          ],
        },
        {
          id: "3",
          type: 20,
          content: "",
          timestamp: "2020-01-02T00:02:00.000Z",
          author: { id: "5", username: "tony", global_name: "Tony", bot: false },
          interaction_metadata: { type: 2, name: "transcript", user: { id: "5", username: "tony" } },
        },
        {
          id: "2",
          type: 0,
          content: "see 0 items and `inline` then\n```js\nconst n = 1;\n```",
          timestamp: "2020-01-02T00:01:00.000Z",
          author: { id: "5", username: "tony", global_name: "Tony", bot: false },
        },
      ],
    },
    { timeZone: "UTC" }
  );
  const html = new TextDecoder().decode(page.bytes);

  expect(html).toContain("<code>inline</code>");
  expect(html).toContain("<pre><code>const n = 1;</code></pre>");
  expect(html).toContain("see 0 items");
  expect(html).toContain('class="spine executed"');
  expect(html).toContain("has-spine");
  expect(html).toContain('class="contents"');
  expect(html).toContain('class="exec-cmd"');
  expect(html).toContain("transcript");
  expect(html).toContain("gifv");
  expect(html).toContain("https://cdn.example/a.mp4");
  expect(html).not.toContain("Soulora used");
  expect(html).not.toMatch(/data-user="5"[^>]*>Tony<\/button>\s*<span class="app">/);
  expect(html).toMatch(/data-user="9"[^>]*>Helper<\/button><span class="app">APP<\/span>/);
  expect(html).toContain('id="copy-user"');
  expect(html.match(/id="m-3"/g)).toBeNull();
});
