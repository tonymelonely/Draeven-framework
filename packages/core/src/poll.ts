/* Draeven Core: polls a command can send with reply(poll(...)) */

const owned = new WeakSet<object>();

export interface PollAnswer {
  readonly text: string;
  readonly emoji?: string;
}

export interface Poll {
  readonly kind: "poll";
  readonly question: string;
  readonly answers: readonly PollAnswer[];
  /** Hours the poll stays open. Discord allows up to 768 (32 days). */
  readonly hours: number;
  readonly multi: boolean;
}

export interface PollOptions {
  question: string;
  answers: readonly (string | PollAnswer)[];
  /** Hours open. Defaults to 24. Max 768. */
  hours?: number;
  /** Allow picking more than one answer. */
  multi?: boolean;
}

export function poll(options: PollOptions): Poll {
  const question = options.question.trim();

  if (!question || question.length > 300) {
    throw new Error("[Draeven] A poll question must be 1-300 characters.");
  }

  if (!Array.isArray(options.answers) || options.answers.length < 2 || options.answers.length > 10) {
    throw new Error("[Draeven] A poll needs 2-10 answers.");
  }

  const answers = options.answers.map((entry, index) => readAnswer(entry, index));
  const hours = options.hours ?? 24;

  if (!Number.isInteger(hours) || hours < 1 || hours > 768) {
    throw new Error("[Draeven] Poll hours must be an integer from 1 to 768.");
  }

  return seal({
    kind: "poll",
    question,
    answers,
    hours,
    multi: options.multi === true,
  });
}

export function isPoll(value: unknown): value is Poll {
  return (
    typeof value === "object" &&
    value !== null &&
    owned.has(value) &&
    "kind" in value &&
    value.kind === "poll"
  );
}

export function discordPoll(entry: Poll): object {
  return {
    question: { text: entry.question },
    answers: entry.answers.map((answer) => ({
      poll_media: {
        text: answer.text,
        ...(answer.emoji ? { emoji: { name: answer.emoji } } : {}),
      },
    })),
    duration: entry.hours,
    allow_multiselect: entry.multi,
    layout_type: 1,
  };
}

function readAnswer(entry: string | PollAnswer, index: number): PollAnswer {
  if (typeof entry === "string") {
    const text = entry.trim();

    if (!text || text.length > 55) {
      throw new Error(`[Draeven] Poll answer ${index + 1} must be 1-55 characters.`);
    }

    return { text };
  }

  const text = entry.text.trim();

  if (!text || text.length > 55) {
    throw new Error(`[Draeven] Poll answer ${index + 1} must be 1-55 characters.`);
  }

  const emoji = entry.emoji?.trim();

  if (emoji !== undefined && !emoji) {
    throw new Error(`[Draeven] Poll answer ${index + 1} has an empty emoji.`);
  }

  return {
    text,
    ...(emoji ? { emoji } : {}),
  };
}

function seal<T extends object>(value: T): T {
  owned.add(value);
  return value;
}
