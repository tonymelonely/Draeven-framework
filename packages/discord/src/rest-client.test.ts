/* Draeven Discord: tests for DiscordRestClient */

import { afterEach, expect, test, vi } from "vitest";
import { DiscordRestClient } from "./rest-client.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("requests Gateway information with bot authorization", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        url: "wss://gateway.discord.gg",
        shards: 1,
        session_start_limit: {
          total: 1000,
          remaining: 999,
          reset_after: 86400000,
          max_concurrency: 1,
        },
      }),
      { status: 200 }
    )
  );

  vi.stubGlobal("fetch", fetchMock);

  const client = new DiscordRestClient("test-token");
  const result = await client.getGatewayBot();

  expect(result.url).toBe("wss://gateway.discord.gg");
  expect(result.shards).toBe(1);
  expect(fetchMock).toHaveBeenCalledWith(
    "https://discord.com/api/v10/gateway/bot",
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: "Bot test-token",
      }),
    })
  );
});

test("rejects unsuccessful HTTP responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
  );

  const client = new DiscordRestClient("invalid-token");

  await expect(client.getGatewayBot()).rejects.toThrow(
    "Gateway discovery failed with HTTP 401."
  );
});

test("retries rate-limited REST sends", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(null, {
        status: 429,
        headers: { "retry-after": "0.01" },
      })
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }));

  vi.stubGlobal("fetch", fetchMock);

  const client = new DiscordRestClient("test-token");
  await client.replaceCommands("100", [], "42");

  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test("rejects invalid Gateway responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "http://invalid.example" }), {
        status: 200,
      })
    )
  );

  const client = new DiscordRestClient("test-token");

  await expect(client.getGatewayBot()).rejects.toThrow(
    "invalid Gateway response."
  );
});

test("rejects an empty token", () => {
  expect(() => new DiscordRestClient("  ")).toThrow(
    "A token is required."
  );
});

test("replaces guild commands and answers an interaction", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);

  const client = new DiscordRestClient("test-token");

  await client.replaceCommands(
    "100",
    [
      {
        name: "userinfo",
        description: "Shows who someone is",
        options: [
          {
            type: 6,
            name: "user",
            description: "About whom?",
            required: false,
          },
        ],
      },
    ],
    "42"
  );

  await client.replyToInteraction("interaction", "token", { content: "hello" });

  expect(fetchMock).toHaveBeenNthCalledWith(
    1,
    "https://discord.com/api/v10/applications/100/guilds/42/commands",
    expect.objectContaining({
      method: "PUT",
      headers: expect.objectContaining({
        Authorization: "Bot test-token",
      }),
    })
  );

  const reply = fetchMock.mock.calls[1] as [string, { method: string; headers: Record<string, string>; body: string }];

  expect(reply[0]).toBe(
    "https://discord.com/api/v10/interactions/interaction/token/callback"
  );
  expect(reply[1].method).toBe("POST");
  expect(reply[1].headers.Authorization).toBeUndefined();
  expect(JSON.parse(reply[1].body)).toEqual({
    type: 4,
    data: { content: "hello" },
  });
});

test("sends an embed without the bot token", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);

  const client = new DiscordRestClient("test-token");
  await client.replyToInteraction("interaction", "token", {
    embeds: [{ title: "Server information", color: 0x5865f2 }],
  });

  const reply = fetchMock.mock.calls[0] as [string, { headers: Record<string, string>; body: string }];

  expect(reply[1].headers.Authorization).toBeUndefined();
  expect(JSON.parse(reply[1].body)).toEqual({
    type: 4,
    data: {
      embeds: [{ title: "Server information", color: 0x5865f2 }],
    },
  });
});

test("rejects a reply with nothing to send", async () => {
  const client = new DiscordRestClient("test-token");

  await expect(
    client.replyToInteraction("interaction", "token", {})
  ).rejects.toThrow("A reply needs text, an embed, components, a poll, or a file.");
});

test("sends a button row and a picture without the bot token", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);

  const client = new DiscordRestClient("test-token");
  await client.replyToInteraction("interaction", "token", {
    components: [{ type: 1, components: [{ type: 2, style: 1, label: "Yes", custom_id: "yes" }] }],
    files: [{ filename: "picture.png", bytes: Uint8Array.of(1, 2, 3) }],
  });

  const reply = fetchMock.mock.calls[0] as [
    string,
    { headers: Record<string, string>; body: Uint8Array },
  ];

  expect(reply[1].headers.Authorization).toBeUndefined();
  expect(reply[1].headers["Content-Type"]).toContain("multipart/form-data");
  const body = new TextDecoder().decode(reply[1].body);
  expect(body).toContain("picture.png");
  expect(body).toContain("\"custom_id\":\"yes\"");
});

/* Reject invalid session start limits */
test("reads a guild and can replace the message", async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "10",
        name: "Home",
        icon: "abc",
        approximate_member_count: 12,
        approximate_presence_count: 3,
      }),
      { status: 200 }
    )
  );
  vi.stubGlobal("fetch", fetchMock);

  const client = new DiscordRestClient("test-token");
  await expect(client.getGuild("10")).resolves.toEqual({
    id: "10",
    name: "Home",
    members: 12,
    online: 3,
    icon: "https://cdn.discordapp.com/icons/10/abc.png",
  });

  fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
  await expect(client.getGuild("11")).resolves.toBeUndefined();

  fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  await client.replyToInteraction("interaction", "token", {
    content: "Server",
    update: true,
  });

  const update = fetchMock.mock.calls.at(-1) as [string, { body: string }];
  expect(JSON.parse(update[1].body)).toEqual({
    type: 7,
    data: { content: "Server" },
  });
});

test("rejects invalid Gateway session limits", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          url: "wss://gateway.discord.gg",
          shards: 1,
          session_start_limit: {
            total: 1000,
            remaining: 1001,
            reset_after: 86400000,
            max_concurrency: 1,
          },
        }),
        { status: 200 }
      )
    )
  );

  const client = new DiscordRestClient("test-token");

  await expect(client.getGatewayBot()).rejects.toThrow(
    "invalid Gateway session limits."
  );
});