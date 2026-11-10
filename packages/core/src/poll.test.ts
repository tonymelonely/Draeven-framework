/* Draeven Core: tests for poll() */

import { expect, test } from "vitest";
import { command, poll, runCommand } from "./command.js";
import { discordPoll } from "./poll.js";

test("poll stores question and answers", () => {
  const entry = poll({
    question: "Ship it?",
    answers: ["Yes", { text: "Later", emoji: "⏳" }],
    hours: 48,
    multi: true,
  });

  expect(entry.question).toBe("Ship it?");
  expect(entry.answers).toEqual([
    { text: "Yes" },
    { text: "Later", emoji: "⏳" },
  ]);
  expect(entry.hours).toBe(48);
  expect(entry.multi).toBe(true);
  expect(discordPoll(entry)).toEqual({
    question: { text: "Ship it?" },
    answers: [
      { poll_media: { text: "Yes" } },
      { poll_media: { text: "Later", emoji: { name: "⏳" } } },
    ],
    duration: 48,
    allow_multiselect: true,
    layout_type: 1,
  });
});

test("a command can reply with a poll", async () => {
  const vote = command("vote", "Starts a poll", async (ctx) => {
    const { reply } = ctx;
    return reply(
      poll({
        question: "Favorite shade?",
        answers: ["Blurple", "Green"],
      })
    );
  });

  const sent = await runCommand(vote, {
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

  expect(sent.poll?.question).toBe("Favorite shade?");
});
