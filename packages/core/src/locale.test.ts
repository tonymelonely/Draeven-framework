/* Draeven Core: tests for locales */

import { expect, test } from "vitest";
import { command } from "./command.js";
import { readCommandLocales, say } from "./locale.js";
import { isMeta, readMeta } from "./meta.js";

test("say picks exact locale then language then en", () => {
  const strings = { en: "Hello", nl: "Hallo", "nl-NL": "Hoi" };

  expect(say(strings, "nl-NL")).toBe("Hoi");
  expect(say(strings, "nl-BE")).toBe("Hallo");
  expect(say(strings, "de")).toBe("Hello");
});

test("command meta keeps locales", () => {
  const ping = command(
    "ping",
    "Checks whether the bot is alive",
    (ctx) => ctx.reply(say({ en: "pong", nl: "pong" }, ctx.locale)),
    {
      locales: {
        nl: { description: "Checkt of de bot leeft" },
      },
    }
  );

  expect(isMeta(ping.meta!)).toBe(true);
  expect(readMeta(ping.meta)).toEqual({
    description_localizations: { nl: "Checkt of de bot leeft" },
  });
  expect(readCommandLocales(ping.meta?.locales)).toEqual({
    description_localizations: { nl: "Checkt of de bot leeft" },
  });
});
