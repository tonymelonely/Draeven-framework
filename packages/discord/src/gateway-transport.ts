/* Draeven Discord: low-level WebSocket transport */

import WebSocket from "ws";

export interface GatewayTransportOptions {
  url: string;
}

export class GatewayTransport {
  private socket: WebSocket | null = null;
  private readonly messageHandlers = new Set<(message: string) => void>();
  private readonly errorHandlers = new Set<(error: Error) => void>();

  constructor(private readonly options: GatewayTransportOptions) {}

  /* Open a WebSocket connection */
  connect(): Promise<void> {
    if (this.socket) {
      throw new Error("[Draeven Discord] Transport is already initialized.");
    }

    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.options.url);
      this.socket = socket;

      const cleanup = () => {
        socket.off("open", onOpen);
        socket.off("error", onInitialError);
      };

      const onOpen = () => {
        cleanup();
        resolve();
      };

      const onInitialError = (error: Error) => {
        cleanup();
        this.socket = null;
        reject(error);
      };

      /* Register messages before the connection opens */
      socket.on("message", (data, isBinary) => {
        if (isBinary) {
          this.notifyError(
            new Error("[Draeven Discord] Binary Gateway messages are not supported yet.")
          );
          return;
        }

        this.notifyMessage(data.toString());
      });

      /* Forward later connection errors to registered handlers */
      socket.on("error", (error) => {
        this.notifyError(error);
      });

      socket.on("close", (code, reason) => {
        this.notifyError(
          new Error(
            `[Draeven Discord] Gateway closed (${code})${reason.length ? `: ${reason.toString()}` : "."}`
          )
        );
      });

      socket.once("open", onOpen);
      socket.once("error", onInitialError);
    });
  }

  /* Register a handler for incoming text messages */
  onMessage(handler: (message: string) => void): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /* Register a handler for transport errors */
  onError(handler: (error: Error) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /* Handle messages without letting callback errors escape */
  private notifyMessage(message: string): void {
    for (const handler of this.messageHandlers) {
      try {
        handler(message);
      } catch (error) {
        this.notifyError(
          error instanceof Error
            ? error
            : new Error("[Draeven Discord] Unknown message-handler error.")
        );
      }
    }
  }

  /* Notify every registered error handler */
  private notifyError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch {
        /* An error handler must not crash the transport. */
      }
    }
  }

  /* Send a text message over the WebSocket */
  send(message: string): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("[Draeven Discord] Transport is not connected.");
    }

    this.socket.send(message);
  }

  /* Close the connection cleanly */
  async close(): Promise<void> {
    const socket = this.socket;
    this.socket = null;

    if (!socket || socket.readyState === WebSocket.CLOSED) {
      return;
    }

    if (socket.readyState === WebSocket.CONNECTING) {
      socket.terminate();
      return;
    }

    await new Promise<void>((resolve) => {
      socket.once("close", () => resolve());
      socket.close();
    });
  }
}