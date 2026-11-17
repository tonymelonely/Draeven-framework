/* Unit-test fixture command (not a live bot). Written the way a bot author would. */

import { command, user } from "../command.js";
import { formatDate, Netherlands } from "../format-date.js";
import type { User } from "../lookup.js";

function lines(person: User): string {
  return [
    `Name: ${person.name}`,
    `Id: ${person.id}`,
    `Created: ${formatDate(person.createdAt, Netherlands)}`,
    `Kind: ${person.bot ? "bot" : "human"}`,
  ].join("\n");
}

/* No user chosen: the command is about the caller. */
export const userinfo = command(
  "userinfo",
  "Shows who someone is",
  { user: user("About whom?") },
  async (ctx) => {
    const { user: chosen, author, getUser, reply } = ctx;
    const person = chosen ?? getUser(author);

    return reply(lines(person));
  }
);
