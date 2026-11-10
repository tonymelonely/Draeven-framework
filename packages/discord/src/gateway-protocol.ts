/* Draeven Discord: base parser for Gateway messages */

export interface GatewayPayload {
    op: number;
    d?: unknown;
    s?: number | null;
    t?: string | null;
}

/* Parse and validate an incoming JSON message */
export function parseGatewayPayload(raw: string): GatewayPayload {
    let parsed: unknown;

    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error("[Draeven Discord] Invalid Gateway JSON.");
    }

    if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("op" in parsed) ||
        typeof parsed.op !== "number" ||
        !Number.isInteger(parsed.op)
    ) {
        throw new Error("[Draeven Discord] Invalid Gateway payload.");
    }

    return parsed as GatewayPayload;
}

/* Draeven Discord: prepare the Gateway URL */
export function buildGatewayUrl(baseUrl: string): string {
    let url: URL;

    try {
        url = new URL(baseUrl);
    } catch {
        throw new Error("[Draeven Discord] Invalid Gateway URL.");
    }

    if (url.protocol !== "wss:") {
        throw new Error("[Draeven Discord] Gateway URL must use WSS.");
    }

    url.searchParams.set("v", "10");
    url.searchParams.set("encoding", "json");

    return url.toString();
}

/* Data from Discord's Hello message */
export interface GatewayHelloData {
    heartbeat_interval: number;
}

/* Validate and read the heartbeat interval */
export function parseGatewayHello(
    payload: GatewayPayload
): GatewayHelloData {
    if (
        payload.op !== 10 ||
        typeof payload.d !== "object" ||
        payload.d === null ||
        !("heartbeat_interval" in payload.d) ||
        typeof payload.d.heartbeat_interval !== "number" ||
        !Number.isFinite(payload.d.heartbeat_interval) ||
        payload.d.heartbeat_interval <= 0
    ) {
        throw new Error("[Draeven Discord] Invalid Gateway Hello payload.");
    }

    return {
        heartbeat_interval: payload.d.heartbeat_interval,
    };
}

/* Build a Gateway heartbeat payload */
export function createHeartbeatPayload(
    sequence: number | null
): GatewayPayload {
    if (
        sequence !== null &&
        (!Number.isSafeInteger(sequence) || sequence < 0)
    ) {
        throw new Error("[Draeven Discord] Invalid Gateway sequence number.");
    }

    return {
        op: 1,
        d: sequence,
    };
}

export type PresenceStatus = "online" | "idle" | "dnd" | "invisible";

export type ActivityKind =
    | "playing"
    | "streaming"
    | "listening"
    | "watching"
    | "custom"
    | "competing";

export interface PresenceActivity {
    kind: ActivityKind;
    text: string;
    /** Required when kind is streaming. */
    url?: string;
}

/** Bot status shown in the member list. */
export interface Presence {
    status?: PresenceStatus;
    activity?: PresenceActivity;
    afk?: boolean;
}

const activityType: Record<ActivityKind, number> = {
    playing: 0,
    streaming: 1,
    listening: 2,
    watching: 3,
    custom: 4,
    competing: 5,
};

/* Build the Gateway Identify payload */
export function createIdentifyPayload(
    token: string,
    intents: number,
    presence?: Presence
): GatewayPayload {
    if (!token.trim()) {
        throw new Error("[Draeven Discord] Identify requires a token.");
    }

    if (!Number.isSafeInteger(intents) || intents < 0) {
        throw new Error("[Draeven Discord] Invalid Gateway intents.");
    }

    return {
        op: 2,
        d: {
            token,
            intents,
            properties: {
                os: process.platform,
                browser: "draeven",
                device: "draeven",
            },
            ...(presence ? { presence: toGatewayPresence(presence) } : {}),
        },
    };
}

/* Build a Gateway Presence Update payload (op 3). */
export function createPresencePayload(presence: Presence): GatewayPayload {
    return {
        op: 3,
        d: toGatewayPresence(presence),
    };
}

export function toGatewayPresence(presence: Presence): {
    since: null;
    activities: object[];
    status: PresenceStatus;
    afk: boolean;
} {
    const status = presence.status ?? "online";

    if (
        status !== "online" &&
        status !== "idle" &&
        status !== "dnd" &&
        status !== "invisible"
    ) {
        throw new Error(
            "[Draeven Discord] Presence status is online, idle, dnd, or invisible."
        );
    }

    return {
        since: null,
        activities: presence.activity ? [toGatewayActivity(presence.activity)] : [],
        status,
        afk: presence.afk === true,
    };
}

function toGatewayActivity(activity: PresenceActivity): object {
    const text = activity.text.trim();

    if (!text || text.length > 128) {
        throw new Error(
            "[Draeven Discord] An activity needs 1-128 characters of text."
        );
    }

    if (!(activity.kind in activityType)) {
        throw new Error(
            "[Draeven Discord] Activity kind is playing, streaming, listening, watching, custom, or competing."
        );
    }

    if (activity.kind === "custom") {
        return {
            name: "Custom Status",
            type: 4,
            state: text,
        };
    }

    if (activity.kind === "streaming") {
        const url = activity.url?.trim() ?? "";

        if (!/^https:\/\/(www\.)?(twitch\.tv|youtube\.com)\//i.test(url)) {
            throw new Error(
                "[Draeven Discord] Streaming activity needs a Twitch or YouTube url."
            );
        }

        return {
            name: text,
            type: 1,
            url,
        };
    }

    return {
        name: text,
        type: activityType[activity.kind],
    };
}

/* Build the Gateway Resume payload */
export function createResumePayload(
    token: string,
    sessionId: string,
    sequence: number | null
): GatewayPayload {
    if (!token.trim()) {
        throw new Error("[Draeven Discord] Resume requires a token.");
    }

    if (!sessionId.trim()) {
        throw new Error("[Draeven Discord] Resume requires a session id.");
    }

    if (
        sequence !== null &&
        (!Number.isSafeInteger(sequence) || sequence < 0)
    ) {
        throw new Error("[Draeven Discord] Invalid Gateway sequence number.");
    }

    return {
        op: 6,
        d: {
            token,
            session_id: sessionId,
            seq: sequence,
        },
    };
}

/* Recognize a heartbeat ACK from Discord */
export function isHeartbeatAck(payload: GatewayPayload): boolean {
    return payload.op === 11;
}