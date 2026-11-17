/* Draeven Core: pick a string for the caller's Discord locale */

export type LocaleMap = Readonly<Record<string, string>>;

/**
 * Pick a localized string.
 * Tries the full locale (`nl-NL`), then the language (`nl`), then `en`, then the first value.
 */
export function say(strings: LocaleMap, locale?: string): string {
  const entries = Object.entries(strings);

  if (entries.length < 1) {
    throw new Error("[Draeven] say() needs at least one locale string.");
  }

  for (const [key, value] of entries) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`[Draeven] Locale string for ${key} must be non-empty.`);
    }
  }

  if (locale) {
    const exact = strings[locale];

    if (exact !== undefined) {
      return exact;
    }

    const language = locale.split("-")[0];

    if (language) {
      const byLanguage = strings[language];

      if (byLanguage !== undefined) {
        return byLanguage;
      }
    }
  }

  if (strings.en !== undefined) {
    return strings.en;
  }

  if (strings["en-US"] !== undefined) {
    return strings["en-US"];
  }

  return entries[0]![1];
}

export interface CommandLocale {
  /** Localized command name. Must still match Discord's name rules if set. */
  name?: string;
  /** Localized command description. */
  description?: string;
}

export function readLocaleMap(
  value: Record<string, string> | undefined,
  label: string
): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  const out: Record<string, string> = {};

  for (const [locale, text] of Object.entries(value)) {
    const key = locale.trim();
    const trimmed = text.trim();

    if (!key || !/^[a-z]{2}(-[A-Z]{2})?$/.test(key)) {
      throw new Error(`[Draeven] Invalid locale ${locale} on ${label}.`);
    }

    if (!trimmed) {
      throw new Error(`[Draeven] Empty ${label} for locale ${key}.`);
    }

    out[key] = trimmed;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function readCommandLocales(
  value: Record<string, CommandLocale> | undefined
): {
  name_localizations?: Record<string, string>;
  description_localizations?: Record<string, string>;
} {
  if (!value) {
    return {};
  }

  const names: Record<string, string> = {};
  const descriptions: Record<string, string> = {};

  for (const [locale, entry] of Object.entries(value)) {
    const key = locale.trim();

    if (!key || !/^[a-z]{2}(-[A-Z]{2})?$/.test(key)) {
      throw new Error(`[Draeven] Invalid locale ${locale} on command.`);
    }

    if (entry.name !== undefined) {
      const name = entry.name.trim();

      if (!/^[a-z0-9-]{1,32}$/.test(name)) {
        throw new Error(
          `[Draeven] Localized command name for ${key} must be 1-32 characters: lowercase letters, numbers, or hyphens.`
        );
      }

      names[key] = name;
    }

    if (entry.description !== undefined) {
      const description = entry.description.trim();

      if (!description || description.length > 100) {
        throw new Error(
          `[Draeven] Localized command description for ${key} must be 1-100 characters.`
        );
      }

      descriptions[key] = description;
    }
  }

  return {
    ...(Object.keys(names).length > 0 ? { name_localizations: names } : {}),
    ...(Object.keys(descriptions).length > 0
      ? { description_localizations: descriptions }
      : {}),
  };
}
