/* Draeven Discord: read a channel and every message it still holds. */

export interface ChannelHistory {
  channel: {
    id: string;
    name: string;
    topic?: string;
    kind: string;
    guildId?: string;
  };
  messages: readonly unknown[];
  truncated: boolean;
}

const CHANNEL_KINDS: Record<number, string> = {
  0: "text",
  2: "voice",
  4: "category",
  5: "announcement",
  10: "announcement thread",
  11: "thread",
  12: "private thread",
  13: "stage",
  15: "forum",
  16: "media",
};

/* Turn Discord's channel body into the few fields a transcript shows. */
export function describeChannel(value: unknown, fallbackId: string): ChannelHistory["channel"] {
  if (typeof value !== "object" || value === null) {
    return { id: fallbackId, name: "channel", kind: "text" };
  }

  const kindValue = "type" in value && typeof value.type === "number" ? value.type : 0;

  return {
    id: textField(value, "id") ?? fallbackId,
    name: textField(value, "name") ?? "channel",
    kind: CHANNEL_KINDS[kindValue] ?? "text",
    ...(textField(value, "topic") ? { topic: textField(value, "topic") } : {}),
    ...(textField(value, "guild_id") ? { guildId: textField(value, "guild_id") } : {}),
  };
}

/*
 * Discord returns the newest page first. Each full page is followed from its oldest id.
 * maxPages of 100 is 10,000 messages. pauseMs keeps the request under Discord's limit.
 */
export async function collectMessages(
  load: (before?: string) => Promise<readonly unknown[]>,
  options?: { maxPages?: number; pauseMs?: number }
): Promise<{ messages: unknown[]; truncated: boolean }> {
  const maxPages = options?.maxPages ?? 100;
  const pauseMs = options?.pauseMs ?? 1000;
  const messages: unknown[] = [];
  let before: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    if (page > 0 && pauseMs > 0) {
      await wait(pauseMs);
    }

    const batch = [...(await load(before))];

    if (batch.length === 0) {
      return { messages, truncated: false };
    }

    messages.push(...batch);

    if (batch.length < 100) {
      return { messages, truncated: false };
    }

    const oldest = messageId(batch[batch.length - 1]);

    if (!oldest || oldest === before) {
      return { messages, truncated: true };
    }

    before = oldest;
  }

  return { messages, truncated: true };
}

function messageId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("id" in value)) {
    return undefined;
  }

  return typeof value.id === "string" && value.id ? value.id : undefined;
}

function textField(value: object, key: string): string | undefined {
  if (!(key in value)) {
    return undefined;
  }

  const field = value[key as keyof typeof value];
  return typeof field === "string" && field ? field : undefined;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
