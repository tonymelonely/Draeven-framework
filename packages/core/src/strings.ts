/* Draeven Core: localized framework messages */

import { say, type LocaleMap } from "./locale.js";

export type FrameworkStringKey =
  | "cooldown"
  | "need"
  | "when"
  | "owner"
  | "failed";

const defaults: Record<FrameworkStringKey, LocaleMap> = {
  cooldown: {
    en: "Wait {seconds}s before using /{name} again.",
    nl: "Wacht {seconds}s voor je /{name} opnieuw gebruikt.",
  },
  need: {
    en: "You need permission to use this.",
    nl: "Je hebt geen toestemming om dit te gebruiken.",
  },
  when: {
    en: "You cannot use this right now.",
    nl: "Je kunt dit nu niet gebruiken.",
  },
  owner: {
    en: "Only the server owner can use this.",
    nl: "Alleen de servereigenaar kan dit gebruiken.",
  },
  failed: {
    en: "The command failed.",
    nl: "Het command is mislukt.",
  },
};

/** Pick a framework string and fill `{name}` / `{seconds}` placeholders. */
export function frame(
  key: FrameworkStringKey,
  locale: string | undefined,
  vars?: { name?: string; seconds?: number }
): string {
  let text = say(defaults[key], locale);

  if (vars?.name !== undefined) {
    text = text.replaceAll("{name}", vars.name);
  }

  if (vars?.seconds !== undefined) {
    text = text.replaceAll("{seconds}", String(vars.seconds));
  }

  return text;
}
