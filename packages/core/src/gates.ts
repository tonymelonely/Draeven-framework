/* Draeven Core: runtime command gates */

import { createLookups, type CommandWorld, type UserRef } from "./lookup.js";
import {
  hasPermissions,
  permissionBitfield,
  type CommandMeta,
  type PermissionName,
} from "./meta.js";

export type GateFail = "need" | "when" | "owner";

export interface GateContext extends ReturnType<typeof createLookups> {
  author: UserRef;
  locale?: string;
}

export interface GateWorld extends CommandWorld {
  author: UserRef;
  locale?: string;
  /** Discord member permission bitfield string from the interaction. */
  memberPermissions?: string | bigint;
  /** Guild owner id, when known. */
  ownerId?: string;
}

/** Returns which gate blocked the run, or undefined when allowed. */
export async function checkGates(
  meta: CommandMeta | undefined,
  world: GateWorld
): Promise<GateFail | undefined> {
  if (!meta) {
    return undefined;
  }

  if (meta.ownerOnly) {
    if (!world.ownerId || world.author.id !== world.ownerId) {
      return "owner";
    }
  }

  if (meta.need !== undefined) {
    const need = permissionBitfield(meta.need);
    const have =
      world.memberPermissions === undefined
        ? 0n
        : typeof world.memberPermissions === "bigint"
          ? world.memberPermissions
          : BigInt(world.memberPermissions);

    if (!hasPermissions(have, need)) {
      return "need";
    }
  }

  if (meta.when) {
    const ctx: GateContext = {
      ...createLookups(world),
      author: world.author,
      ...(world.locale ? { locale: world.locale } : {}),
    };
    const ok = await meta.when(ctx);

    if (!ok) {
      return "when";
    }
  }

  return undefined;
}

export type { PermissionName };
