/* Draeven Core: runtime gates */

import { expect, test } from "vitest";
import { checkGates } from "./gates.js";
import { permissionBitfield } from "./meta.js";

test("ownerOnly blocks non-owners", async () => {
  await expect(
    checkGates(
      { ownerOnly: true },
      { author: { id: "1" }, ownerId: "2" }
    )
  ).resolves.toBe("owner");

  await expect(
    checkGates(
      { ownerOnly: true },
      { author: { id: "2" }, ownerId: "2" }
    )
  ).resolves.toBeUndefined();
});

test("need checks the member permission bitfield", async () => {
  const need = permissionBitfield("KickMembers");

  await expect(
    checkGates(
      { need: "KickMembers" },
      { author: { id: "1" }, memberPermissions: "0" }
    )
  ).resolves.toBe("need");

  await expect(
    checkGates(
      { need: "KickMembers" },
      { author: { id: "1" }, memberPermissions: need.toString() }
    )
  ).resolves.toBeUndefined();

  await expect(
    checkGates(
      { need: "KickMembers" },
      { author: { id: "1" }, memberPermissions: permissionBitfield("Administrator").toString() }
    )
  ).resolves.toBeUndefined();
});

test("when can block a run", async () => {
  await expect(
    checkGates(
      { when: () => false },
      { author: { id: "1" } }
    )
  ).resolves.toBe("when");
});
