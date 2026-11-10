/* Draeven Discord: creation time stored inside a Discord id */

const DISCORD_EPOCH_MS = 1_420_070_400_000n;

export function createdAtFromId(id: string): Date {
  if (!/^\d{1,20}$/.test(id)) {
    throw new Error("[Draeven Discord] Invalid Discord id.");
  }

  const milliseconds = Number((BigInt(id) >> 22n) + DISCORD_EPOCH_MS);

  if (!Number.isSafeInteger(milliseconds)) {
    throw new Error("[Draeven Discord] Invalid Discord id.");
  }

  return new Date(milliseconds);
}
