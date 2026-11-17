/* Draeven Core: public entry of the framework core */

export const version = "0.1.6";
export { CooldownBook, cooldownKey, readCooldown } from "./cooldown.js";
export type { CommandCooldown, CooldownScope, ResolvedCooldown } from "./cooldown.js";
export { CollectorBook } from "./collect.js";
export type { CollectKind, CollectOptions, Collected } from "./collect.js";
export { say } from "./locale.js";
export type { CommandLocale, LocaleMap } from "./locale.js";
export { guard, isGuard, formatUptime } from "./guard.js";
export type { Guard, GuardKind, GuardOf, GuardOptions, GuardVia } from "./guard.js";
export { loadEvents } from "./load-events.js";
export type { BotEvents } from "./load-events.js";
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
} from "@draeven/discord";

export { Start, startBot, answerCommand, intents, intentBits } from "./bot.js";
export { simulate } from "./simulate.js";
export type { SimulateInput } from "./simulate.js";
export { checkGates } from "./gates.js";
export type { GateContext, GateFail, GateWorld } from "./gates.js";
export { frame } from "./strings.js";
export type { FrameworkStringKey } from "./strings.js";
export { hasPermissions, permissionBitfield } from "./meta.js";
export type {
  ActivityKind,
  AloneMode,
  Bot,
  BotConnection,
  Presence,
  PresenceActivity,
  PresenceStatus,
  StartOptions,
} from "./bot.js";
export { claimAlone, isAlive, killPid, listSiblingPids } from "./alone.js";
export type { AloneLock, AloneOptions } from "./alone.js";
export {
  album,
  beside,
  channel,
  choice,
  command,
  COMPONENTS_V2,
  divide,
  file,
  flag,
  group,
  isCommand,
  isLayout,
  isMenu,
  isPoll,
  layout,
  mentionable,
  messageMenu,
  number,
  pack,
  poll,
  role,
  show,
  showFile,
  sub,
  text,
  thumb,
  user,
  userMenu,
  withLocales,
  decimal,
} from "./command.js";
export { canvas } from "./canvas.js";
export type {
  Canvas,
  CanvasBox,
  CanvasDot,
  CanvasPixel,
  CanvasSize,
  CanvasText,
} from "./canvas.js";
export { breakline, colors, embed, time } from "./embed.js";
export type {
  Color,
  ColorName,
  Embed,
  EmbedAuthor,
  EmbedFieldInput,
  EmbedFooter,
  EmbedHeader,
  EmbedOptions,
  TimeStyle,
} from "./embed.js";
export {
  button,
  buttonColors,
  channelKinds,
  channels,
  fieldStyles,
  form,
  link,
  mentions,
  menu,
  people,
  roles,
  row,
  sku,
} from "./pieces.js";
export type {
  Button,
  ButtonColor,
  ButtonOptions,
  ChannelKind,
  ChannelOptions,
  Channels,
  FieldStyle,
  Form,
  FormField,
  FormOptions,
  Link,
  LinkOptions,
  Menu,
  MenuChoice,
  MenuOptions,
  Mentions,
  Message,
  People,
  PickerOptions,
  Press,
  PressContext,
  ReplyOptions,
  Roles,
  Row,
  Sku,
  SkuOptions,
} from "./pieces.js";
export type {
  Album,
  AlbumItem,
  Beside,
  ChannelOption,
  ChoiceItem,
  ChoiceOption,
  Command,
  CommandContext,
  CommandInstall,
  CommandMeta,
  CommandPlace,
  Divide,
  FileOption,
  FlagOption,
  Layout,
  LayoutPart,
  Mentionable,
  MentionableOption,
  MenuCommand,
  MessageMenu,
  MessageRef,
  NumberOption,
  Pack,
  PermissionName,
  Poll,
  PollAnswer,
  PollOptions,
  Reply,
  RoleOption,
  Show,
  ShowFile,
  StoredBranch,
  StoredGroup,
  StoredOption,
  StoredSub,
  TextOption,
  Thumb,
  UserMenu,
  UserOption,
} from "./command.js";
export type {
  Channel,
  ChannelRef,
  File,
  FileRef,
  Guild,
  Lookups,
  Member,
  Role,
  RoleRef,
  User,
  UserRef,
} from "./lookup.js";
export { readConfig, resolveCommandsFolder } from "./config.js";
export type { DraevenConfig, ResolvedConfig } from "./config.js";
export { loadCommands } from "./load-commands.js";
export type { LoadableCommand } from "./load-commands.js";
export { renderTranscript, isTranscript } from "./transcript.js";
export type {
  TranscriptFile,
  TranscriptOptions,
  TranscriptPage,
  TranscriptProfile,
  TranscriptRole,
} from "./transcript.js";
export * from "./format-date.js";
