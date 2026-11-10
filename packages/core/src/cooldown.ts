/* Draeven Core: per-command cooldowns */

export type CooldownScope = "user" | "guild" | "channel";

export type CommandCooldown =
  | number
  | {
      /** Wait this many seconds before the same key can run again. */
      seconds: number;
      /** Who shares the cooldown. Defaults to user. */
      scope?: CooldownScope;
      /** Reply privately when the command is cooling down. Defaults to true. */
      private?: boolean;
    };

export interface ResolvedCooldown {
  seconds: number;
  scope: CooldownScope;
  private: boolean;
}

export function readCooldown(value: CommandCooldown | undefined): ResolvedCooldown | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("[Draeven] Cooldown seconds must be a positive number.");
    }

    return { seconds: value, scope: "user", private: true };
  }

  if (!Number.isFinite(value.seconds) || value.seconds <= 0) {
    throw new Error("[Draeven] Cooldown seconds must be a positive number.");
  }

  return {
    seconds: value.seconds,
    scope: value.scope ?? "user",
    private: value.private !== false,
  };
}

export function cooldownKey(
  commandName: string,
  scope: CooldownScope,
  ids: { userId: string; guildId?: string; channelId?: string }
): string | undefined {
  if (scope === "user") {
    return `${commandName}:user:${ids.userId}`;
  }

  if (scope === "guild") {
    if (!ids.guildId) {
      return undefined;
    }

    return `${commandName}:guild:${ids.guildId}`;
  }

  if (!ids.channelId) {
    return undefined;
  }

  return `${commandName}:channel:${ids.channelId}`;
}

/** Tracks when a cooldown key may run again. */
export class CooldownBook {
  private readonly until = new Map<string, number>();

  /**
   * Returns remaining seconds if still cooling down.
   * Otherwise records a fresh window and returns 0.
   */
  take(key: string, seconds: number, now = Date.now()): number {
    const expires = this.until.get(key);

    if (expires !== undefined && expires > now) {
      return Math.max(1, Math.ceil((expires - now) / 1000));
    }

    this.until.set(key, now + seconds * 1000);
    return 0;
  }
}
