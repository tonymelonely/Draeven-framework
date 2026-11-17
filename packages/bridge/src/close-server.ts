/* Close an HTTP(S) server without hanging on keep-alive / SSE sockets. */

import type { Server as HttpServer } from "node:http";
import type { Server as HttpsServer } from "node:https";
import type { ServerResponse } from "node:http";

export async function closeHttpServer(
  server: HttpServer | HttpsServer,
  openResponses?: Iterable<ServerResponse>
): Promise<void> {
  if (openResponses) {
    for (const res of openResponses) {
      try {
        if (!res.writableEnded) {
          res.end();
        }
      } catch {
        /* already closed */
      }
    }
  }

  if (typeof server.closeAllConnections === "function") {
    server.closeAllConnections();
  }

  await Promise.race([
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
    new Promise<void>((resolve) => {
      setTimeout(resolve, 1500);
    }),
  ]);
}
