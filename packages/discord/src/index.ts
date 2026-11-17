/* Draeven Discord: public entry of our own Discord client */

import { GatewayConnection } from "./gateway-connection.js";
import { GatewaySession, type ReadyGateway } from "./gateway-session.js";
import {
  readIncomingCommand,
  readIncomingMenu,
  readIncomingSuggest,
  readIncomingUse,
  type IncomingCommand,
  type IncomingMenu,
  type IncomingSuggest,
  type IncomingUse,
} from "./interaction.js";
import {
  DiscordRestClient,
  type ApplicationCommandBody,
  type DiscordGuild,
  type DiscordRole,
  type DiscordUserCard,
  type InteractionReply,
} from "./rest-client.js";
import { collectMessages, describeChannel, type ChannelHistory } from "./history.js";
import type { GatewayPayload, Presence } from "./gateway-protocol.js";
import {
  gatewayEventNames,
  gatewayEventReaders,
  type GatewayEventName,
  type GatewayEvents,
  type GatewayMember,
  type GatewayMessage,
} from "./gateway-events.js";

export const version = "0.1.4";

export { createdAtFromId } from "./snowflake.js";
export type {
  ApplicationCommandBody,
  ApplicationCommandChoiceBody,
  ApplicationCommandOptionBody,
  DiscordEmbed,
  DiscordGuild,
  DiscordRole,
  DiscordUserCard,
  InteractionReply,
} from "./rest-client.js";
export { EPHEMERAL } from "./rest-client.js";
export type { DiscordProfile } from "./discord-user.js";
export type {
  IncomingChannel,
  IncomingCommand,
  IncomingFile,
  IncomingMember,
  IncomingMenu,
  IncomingOption,
  IncomingRole,
  IncomingSuggest,
  IncomingUse,
} from "./interaction.js";
export { readIncomingMenu, readIncomingSuggest } from "./interaction.js";
export type { ChannelHistory } from "./history.js";
export type {
  ActivityKind,
  Presence,
  PresenceActivity,
  PresenceStatus,
} from "./gateway-protocol.js";
export type { GatewayPayload } from "./gateway-protocol.js";
export { intents, intentBits } from "./intents.js";
export type { IntentName } from "./intents.js";
export type {
  GatewayBan,
  GatewayChannel,
  GatewayEventName,
  GatewayEvents,
  GatewayGuild,
  GatewayInvite,
  GatewayMember,
  GatewayMessage,
  GatewayMessageBulkDelete,
  GatewayMessageDelete,
  GatewayPollVote,
  GatewayPresence,
  GatewayReaction,
  GatewayReactionClear,
  GatewayReactionClearEmoji,
  GatewayReady,
  GatewayRole,
  GatewaySchedule,
  GatewayTyping,
  GatewayVoice,
} from "./gateway-events.js";
export { gatewayEventNames, gatewayEventReaders } from "./gateway-events.js";

/* Configuration for the Discord client */
export interface DiscordClientOptions {
  token: string;
  /** Status and activity shown next to the bot. */
  presence?: Presence;
  /** Gateway intents bitmask. Slash commands alone need 0. */
  intents?: number;
  gatewayUrlOverride?: string;
  allowInsecureForTests?: boolean;
}

export type DiscordClientStatus =
  | "stopped"
  | "connecting"
  | "ready"
  | "recovering"
  | "failed";

type CommandHandler = (command: IncomingCommand) => void | Promise<void>;
type MenuHandler = (menu: IncomingMenu) => void | Promise<void>;
type SuggestHandler = (suggest: IncomingSuggest) => void | Promise<void>;
type UseHandler = (use: IncomingUse) => void | Promise<void>;
type DispatchHandler = (payload: GatewayPayload) => void | Promise<void>;
type MemberHandler = (member: GatewayMember) => void | Promise<void>;
type MessageHandler = (message: GatewayMessage) => void | Promise<void>;
type EventHandler<K extends GatewayEventName> = (
  value: GatewayEvents[K]
) => void | Promise<void>;

/* Our Discord client. Slash commands do not need gateway intents. */
export class DiscordClient {
  private status: DiscordClientStatus = "stopped";
  private starting = false;
  private session: GatewaySession | null = null;
  private readyState: ReadyGateway | null = null;
  private rest: DiscordRestClient | undefined;
  private readonly commandHandlers = new Set<CommandHandler>();
  private readonly menuHandlers = new Set<MenuHandler>();
  private readonly suggestHandlers = new Set<SuggestHandler>();
  private readonly useHandlers = new Set<UseHandler>();
  private readonly dispatchHandlers = new Set<DispatchHandler>();
  private readonly eventHandlers = new Map<GatewayEventName, Set<EventHandler<GatewayEventName>>>();

  constructor(private readonly options: DiscordClientOptions) {}

  getStatus(): DiscordClientStatus {
    return this.status;
  }

  /* Start the gateway and wait until Discord is ready. */
  async start(): Promise<void> {
    if (this.starting || this.status === "connecting" || this.status === "ready") {
      throw new Error("[Draeven Discord] The client is already starting or running.");
    }

    if (!this.options.token.trim()) {
      this.status = "failed";
      throw new Error("[Draeven Discord] A token is required.");
    }

    this.starting = true;
    this.status = "connecting";

    const connection = new GatewayConnection({
      token: this.options.token.trim(),
      gatewayUrlOverride: this.options.gatewayUrlOverride,
      allowInsecureForTests: this.options.allowInsecureForTests,
    });
    const session = new GatewaySession(
      connection,
      this.options.token.trim(),
      this.options.intents ?? 0,
      this.options.presence
    );
    this.session = session;
    session.onDispatch((payload) => {
      this.dispatch(payload);
    });

    try {
      this.readyState = await session.run();
      this.status = "ready";
    } catch (error) {
      this.status = "failed";
      this.session = null;
      throw error;
    } finally {
      this.starting = false;
    }
  }

  /* Stop the client and close the gateway. */
  async stop(): Promise<void> {
    if (this.starting) {
      throw new Error("[Draeven Discord] Cannot stop while startup is in progress.");
    }

    const session = this.session;
    this.session = null;
    this.readyState = null;
    this.status = "stopped";

    if (session) {
      await session.close();
    }
  }

  readyUser(): ReadyGateway["user"] & { applicationId: string } {
    if (!this.readyState) {
      throw new Error("[Draeven Discord] The client is not ready.");
    }

    return {
      ...this.readyState.user,
      applicationId: this.readyState.applicationId,
    };
  }

  /* Change status or activity while the gateway is running. */
  setPresence(presence: Presence): void {
    if (!this.session || this.status !== "ready") {
      throw new Error("[Draeven Discord] The client is not ready.");
    }

    this.session.setPresence(presence);
  }

  async registerCommands(
    commands: readonly ApplicationCommandBody[],
    guildId?: string
  ): Promise<void> {
    const ready = this.readyUser();
    await this.restClient().replaceCommands(ready.applicationId, commands, guildId);
  }

  onCommand(handler: CommandHandler): () => void {
    this.commandHandlers.add(handler);
    return () => this.commandHandlers.delete(handler);
  }

  onMenu(handler: MenuHandler): () => void {
    this.menuHandlers.add(handler);
    return () => this.menuHandlers.delete(handler);
  }

  onSuggest(handler: SuggestHandler): () => void {
    this.suggestHandlers.add(handler);
    return () => this.suggestHandlers.delete(handler);
  }

  onUse(handler: UseHandler): () => void {
    this.useHandlers.add(handler);
    return () => this.useHandlers.delete(handler);
  }

  onDispatch(handler: DispatchHandler): () => void {
    this.dispatchHandlers.add(handler);
    return () => this.dispatchHandlers.delete(handler);
  }

  onEvent<K extends GatewayEventName>(name: K, handler: EventHandler<K>): () => void {
    const bucket =
      this.eventHandlers.get(name) ?? new Set<EventHandler<GatewayEventName>>();
    bucket.add(handler as EventHandler<GatewayEventName>);
    this.eventHandlers.set(name, bucket);
    return () => bucket.delete(handler as EventHandler<GatewayEventName>);
  }

  onMemberJoin(handler: MemberHandler): () => void {
    return this.onEvent("memberJoin", handler);
  }

  onMemberLeave(handler: MemberHandler): () => void {
    return this.onEvent("memberLeave", handler);
  }

  onMessage(handler: MessageHandler): () => void {
    return this.onEvent("message", handler);
  }

  async replyToSuggest(
    interactionId: string,
    interactionToken: string,
    choices: readonly { name: string; value: string | number }[]
  ): Promise<void> {
    await this.restClient().replyToSuggest(interactionId, interactionToken, choices);
  }

  async readGuild(guildId: string): Promise<DiscordGuild | undefined> {
    return this.restClient().getGuild(guildId);
  }

  async readRoles(guildId: string): Promise<DiscordRole[]> {
    return this.restClient().getRoles(guildId);
  }

  async readUser(userId: string): Promise<DiscordUserCard | undefined> {
    return this.restClient().getUser(userId);
  }

  async defer(
    interactionId: string,
    interactionToken: string,
    options?: { private?: boolean }
  ): Promise<void> {
    await this.restClient().deferInteraction(interactionId, interactionToken, options);
  }

  async deferUpdate(interactionId: string, interactionToken: string): Promise<void> {
    await this.restClient().deferUpdateInteraction(interactionId, interactionToken);
  }

  async editReply(
    applicationId: string,
    interactionToken: string,
    reply: InteractionReply
  ): Promise<string | undefined> {
    return this.restClient().editInteraction(applicationId, interactionToken, reply);
  }

  async readHistory(channelId: string): Promise<ChannelHistory> {
    const raw = await this.restClient().getChannel(channelId);
    const collected = await collectMessages((before) =>
      this.restClient().listMessages(channelId, before)
    );

    return {
      channel: describeChannel(raw, channelId),
      messages: collected.messages,
      truncated: collected.truncated,
    };
  }

  async replyTo(
    interactionId: string,
    interactionToken: string,
    reply: InteractionReply
  ): Promise<void> {
    await this.restClient().replyToInteraction(
      interactionId,
      interactionToken,
      reply
    );
  }

  async followUp(
    applicationId: string,
    interactionToken: string,
    reply: InteractionReply
  ): Promise<void> {
    await this.restClient().followUpInteraction(
      applicationId,
      interactionToken,
      reply
    );
  }

  async sendMessage(channelId: string, reply: InteractionReply): Promise<void> {
    await this.restClient().createMessage(channelId, reply);
  }

  async timeoutMember(
    guildId: string,
    userId: string,
    seconds: number,
    reason?: string
  ): Promise<void> {
    await this.restClient().timeoutMember(guildId, userId, seconds, reason);
  }

  async kickMember(guildId: string, userId: string, reason?: string): Promise<void> {
    await this.restClient().kickMember(guildId, userId, reason);
  }

  async banMember(
    guildId: string,
    userId: string,
    options?: { seconds?: number; reason?: string }
  ): Promise<void> {
    await this.restClient().banMember(guildId, userId, options);
  }

  async moveMemberVoice(
    guildId: string,
    userId: string,
    channelId: string | null
  ): Promise<void> {
    await this.restClient().moveMemberVoice(guildId, userId, channelId);
  }

  async listRecentMessageIds(channelId: string, limit: number): Promise<string[]> {
    const page = await this.restClient().listMessages(channelId);
    const ids: string[] = [];
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

    for (const entry of page) {
      if (ids.length >= limit) {
        break;
      }

      if (typeof entry !== "object" || entry === null || !("id" in entry)) {
        continue;
      }

      const id = typeof entry.id === "string" ? entry.id : undefined;

      if (!id) {
        continue;
      }

      if ("timestamp" in entry && typeof entry.timestamp === "string") {
        const at = Date.parse(entry.timestamp);

        if (Number.isFinite(at) && at < cutoff) {
          continue;
        }
      }

      ids.push(id);
    }

    return ids;
  }

  async purgeMessages(channelId: string, messageIds: readonly string[]): Promise<void> {
    await this.restClient().purgeMessages(channelId, messageIds);
  }

  async deleteReply(
    applicationId: string,
    interactionToken: string,
    messageId?: string
  ): Promise<void> {
    await this.restClient().deleteWebhookMessage(
      applicationId,
      interactionToken,
      messageId ?? "@original"
    );
  }

  async editFollowUp(
    applicationId: string,
    interactionToken: string,
    messageId: string,
    reply: InteractionReply
  ): Promise<void> {
    await this.restClient().editWebhookMessage(
      applicationId,
      interactionToken,
      messageId,
      reply
    );
  }

  private restClient(): DiscordRestClient {
    if (!this.rest) {
      this.rest = new DiscordRestClient(this.options.token.trim());
    }

    return this.rest;
  }

  private dispatch(payload: GatewayPayload): void {
    for (const handler of this.dispatchHandlers) {
      void Promise.resolve(handler(payload)).catch((error: unknown) => {
        console.error("[Draeven Discord] Dispatch handler failed.", error);
      });
    }

    if (typeof payload.t === "string") {
      for (const name of gatewayEventNames) {
        const entry = gatewayEventReaders[name];

        if (entry.t !== payload.t) {
          continue;
        }

        const value = entry.read(payload.d);

        if (value !== undefined) {
          const handlers = this.eventHandlers.get(name);

          if (handlers) {
            for (const handler of handlers) {
              void Promise.resolve(handler(value as GatewayEvents[GatewayEventName])).catch(
                (error: unknown) => {
                  console.error(`[Draeven Discord] ${name} handler failed.`, error);
                }
              );
            }
          }
        }
      }
    }

    if (payload.t !== "INTERACTION_CREATE") {
      return;
    }

    const command = readIncomingCommand(payload.d);

    if (command) {
      for (const handler of this.commandHandlers) {
        void Promise.resolve(handler(command)).catch((error: unknown) => {
          console.error("[Draeven Discord] Command handler failed.", error);
        });
      }

      return;
    }

    const menu = readIncomingMenu(payload.d);

    if (menu) {
      for (const handler of this.menuHandlers) {
        void Promise.resolve(handler(menu)).catch((error: unknown) => {
          console.error("[Draeven Discord] Menu handler failed.", error);
        });
      }

      return;
    }

    const suggest = readIncomingSuggest(payload.d);

    if (suggest) {
      for (const handler of this.suggestHandlers) {
        void Promise.resolve(handler(suggest)).catch((error: unknown) => {
          console.error("[Draeven Discord] Suggest handler failed.", error);
        });
      }

      return;
    }

    const use = readIncomingUse(payload.d);

    if (!use) {
      return;
    }

    for (const handler of this.useHandlers) {
      void Promise.resolve(handler(use)).catch((error: unknown) => {
        console.error("[Draeven Discord] Component handler failed.", error);
      });
    }
  }
}
