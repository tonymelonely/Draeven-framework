/* Draeven Discord: Gateway discovery and connection */

import { DiscordRestClient } from "./rest-client.js";
import {
    buildGatewayUrl,
    parseGatewayHello,
    parseGatewayPayload,
    type GatewayHelloData,
} from "./gateway-protocol.js";
import { GatewayTransport } from "./gateway-transport.js";

export interface GatewayConnectionOptions {
    token: string;
    gatewayUrlOverride?: string;
    allowInsecureForTests?: boolean;
    helloTimeoutMs?: number;
}

export class GatewayConnection {
    private readonly rest: DiscordRestClient;
    private transport: GatewayTransport | null = null;
    /* Handlers for messages that arrive after Hello */
    private readonly messageHandlers = new Set<(message: string) => void>();
    private readonly errorHandlers = new Set<(error: Error) => void>();

    constructor(private readonly options: GatewayConnectionOptions) {
        this.rest = new DiscordRestClient(options.token);
    }

    /* Open the Gateway and wait for a valid Hello message. */
    async connect(resumeUrl?: string): Promise<GatewayHelloData> {
        if (this.transport) {
            throw new Error("[Draeven Discord] Gateway is already initialized.");
        }

        const discovered =
            this.options.gatewayUrlOverride ??
            (await this.rest.getGatewayBot()).url;
        const gatewayUrl = resumeUrl ?? discovered;
        const url = this.options.gatewayUrlOverride && !resumeUrl
            ? this.validateGatewayUrl(gatewayUrl)
            : resumeUrl && this.options.allowInsecureForTests
              ? this.validateGatewayUrl(gatewayUrl)
              : buildGatewayUrl(gatewayUrl);

        const transport = new GatewayTransport({ url });

        let resolveHello!: (hello: GatewayHelloData) => void;
        let rejectHello!: (error: Error) => void;

        /* Wait at most 10 seconds for a valid Hello message */
        const timeoutMs = this.options.helloTimeoutMs ?? 10_000;

        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
            throw new Error("[Draeven Discord] Hello timeout must be positive.");
        }

        const helloPromise = new Promise<GatewayHelloData>((resolve, reject) => {
            resolveHello = resolve;
            rejectHello = reject;
        });

        let helloReceived = false;
        /* Handle Hello and forward Gateway messages */
        const removeMessageHandler = transport.onMessage((message) => {
            try {
                const payload = parseGatewayPayload(message);

                /* During startup we wait for Hello */
                if (!helloReceived) {
                    if (payload.op !== 10) return;

                    const hello = parseGatewayHello(payload);
                    helloReceived = true;
                    resolveHello(hello);
                    return;
                }

                /* Later Gateway messages are handled here */
                this.notifyMessage(message);
            } catch (error) {
                if (!helloReceived) {
                    rejectHello(
                        error instanceof Error
                            ? error
                            : new Error("[Draeven Discord] Failed to process Gateway Hello.")
                    );
                }
            }
        });

        const removeErrorHandler = transport.onError((error) => {
            if (!helloReceived) {
                rejectHello(error);
                return;
            }

            this.notifyError(error);
        });

        let timeout: ReturnType<typeof setTimeout> | undefined;

        try {
            await transport.connect();
            this.transport = transport;

            timeout = setTimeout(() => {
                rejectHello(
                    new Error("[Draeven Discord] Timed out waiting for Gateway Hello.")
                );
            }, timeoutMs);

            return await helloPromise;
        } catch (error) {
            removeMessageHandler();
            removeErrorHandler();

            if (this.transport === transport) {
                this.transport = null;
            }

            await transport.close();
            throw error;
        } finally {
            if (timeout !== undefined) clearTimeout(timeout);
        }
    }

    /* Send a Gateway message. The socket must already be open. */
    send(message: string): void {
        if (!this.transport) {
            throw new Error("[Draeven Discord] Gateway is not connected.");
        }

        this.transport.send(message);
    }

    /* Register a handler for Gateway errors after Hello */
    onError(handler: (error: Error) => void): () => void {
        this.errorHandlers.add(handler);
        return () => this.errorHandlers.delete(handler);
    }

    private notifyError(error: Error): void {
        for (const handler of this.errorHandlers) {
            try {
                handler(error);
            } catch {
                /* An error handler must not crash the connection. */
            }
        }
    }

    /* Forward Gateway messages to registered handlers */
    private notifyMessage(message: string): void {
        for (const handler of this.messageHandlers) {
            try {
                handler(message);
            } catch (error) {
                console.error("[Draeven Discord] Gateway message handler failed.", error);
            }
        }
    }

    /* Validate the Gateway URL before connecting */
    private validateGatewayUrl(value: string): string {
        let url: URL;

        try {
            url = new URL(value);
        } catch {
            throw new Error("[Draeven Discord] Invalid Gateway URL.");
        }

        if (url.protocol !== "wss:") {
            const isLocalHost =
                url.hostname === "localhost" ||
                url.hostname === "127.0.0.1" ||
                url.hostname === "[::1]";

            if (
                url.protocol !== "ws:" ||
                !isLocalHost ||
                this.options.allowInsecureForTests !== true
            ) {
                throw new Error(
                    "[Draeven Discord] Insecure Gateway URLs are only allowed for local tests."
                );
            }
        }

        return url.toString();
    }

    /* Register a handler for Gateway messages */
    onMessage(handler: (message: string) => void): () => void {
        this.messageHandlers.add(handler);
        return () => this.messageHandlers.delete(handler);
    }

    /* Close the Gateway connection */
    async close(): Promise<void> {
        const transport = this.transport;
        this.transport = null;

        if (transport) {
            await transport.close();
        }
    }
}