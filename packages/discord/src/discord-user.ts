/* Draeven Discord: the few user fields a command needs */

export interface DiscordProfile {
  id: string;
  name: string;
  bot: boolean;
  icon?: string;
}

export function readDiscordProfile(value: unknown): DiscordProfile | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (!("id" in value) || typeof value.id !== "string" || !value.id.trim()) {
    return undefined;
  }

  if (
    !("username" in value) ||
    typeof value.username !== "string" ||
    !value.username
  ) {
    return undefined;
  }

  const globalName =
    "global_name" in value && typeof value.global_name === "string"
      ? value.global_name.trim()
      : "";

  const avatar =
    "avatar" in value && typeof value.avatar === "string" && value.avatar
      ? value.avatar
      : undefined;

  return {
    id: value.id,
    name: globalName || value.username,
    bot: "bot" in value && value.bot === true,
    ...(avatar
      ? {
          icon: `https://cdn.discordapp.com/avatars/${value.id}/${avatar}.${avatar.startsWith("a_") ? "gif" : "png"}`,
        }
      : {}),
  };
}
