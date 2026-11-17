/* Draeven Discord: intentsFor helper */

import { expect, test } from "vitest";
import { eventIntents, intentsFor } from "./event-intents.js";
import { gatewayEventNames } from "./gateway-events.js";
import { intents } from "./intents.js";

test("eventIntents covers every gateway event name", () => {
  for (const name of gatewayEventNames) {
    expect(eventIntents[name]).toBeDefined();
  }
});

test("intentsFor combines unique intent bits", () => {
  expect(intentsFor("ready")).toBe(0);
  expect(intentsFor("memberJoin")).toBe(intents.guildMembers);
  expect(intentsFor("message")).toBe(
    intents.guildMessages | intents.directMessages | intents.messageContent
  );
  expect(intentsFor("memberJoin", "message", "memberJoin")).toBe(
    intents.guildMembers | intents.guildMessages | intents.directMessages | intents.messageContent
  );
});

test("intentsFor rejects an empty list", () => {
  const none: [] = [];
  expect(() => (intentsFor as (...events: readonly string[]) => number)(...none)).toThrow(
    "needs at least one event name"
  );
});
