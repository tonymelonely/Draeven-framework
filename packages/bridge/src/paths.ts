/* Resolve packaged public assets. */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function bridgePublicDir(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..", "public");
}
