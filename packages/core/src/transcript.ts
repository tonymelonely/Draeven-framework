/*
 * Draeven Core: one HTML page of a Discord channel.
 *
 * Messages come back newest first. The page shows them oldest first,
 * with the text, files, embeds, reactions, stickers, polls, buttons, and system lines.
 */

import { createdAtFromId, type ChannelHistory } from "@draeven/discord";

const TRANSCRIPT = Symbol("draeven.transcript");

export interface TranscriptFile {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly type: "text/html";
  /** The short line sent above the file. */
  readonly note: string;
}

/** What a command can pass to transcript(). The start config fills in what you leave out. */
export interface TranscriptOptions {
  /** IANA time zone, such as Europe/Amsterdam. Overrides the one from Start. */
  timeZone?: string;
  /**
   * Address behind each message.
   * {guild}, {channel}, and {message} are filled in.
   * Without this, the address is the message on Discord.
   */
  link?: string;
}

export interface TranscriptPage extends TranscriptOptions {
  guildName?: string;
  roles?: readonly TranscriptRole[];
  profiles?: readonly TranscriptProfile[];
}

export interface TranscriptRole {
  id: string;
  name: string;
  /** 0 means the role has no color. */
  color: number;
  position: number;
  emoji?: string;
  icon?: string;
}

export interface TranscriptProfile {
  id: string;
  banner?: string;
  accent?: number;
  flags?: number;
  decoration?: string;
  clan?: string;
  clanIcon?: string;
}

interface RoleInfo {
  id: string;
  name: string;
  color: number;
  position: number;
  emoji?: string;
  icon?: string;
}

interface Person {
  id: string;
  name: string;
  username: string;
  avatar: string;
  banner: string;
  accent: string;
  decoration: string;
  bot: boolean;
  color: string;
  clan: string;
  clanIcon: string;
  badges: { name: string; mark: string; color: string; icon?: string }[];
  roles: { name: string; color: string; emoji: string; icon: string }[];
  created: string;
  joined: string;
  boosting: string;
  meta: string;
}

interface Page {
  timeZone: string;
  link?: string;
  roles: Map<string, RoleInfo>;
  people: Map<string, Person>;
  channel: ChannelHistory["channel"];
  guildName?: string;
}

interface TextContext {
  page: Page;
  users: Map<string, string>;
  channels: Map<string, string>;
}

const SYSTEM = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 21, 22, 24, 25, 26, 27, 28, 29,
  31, 32, 36, 37, 38, 39, 44, 46,
]);

/* A blank zone falls through. An unknown name is refused. */
export function resolveTimeZone(zone?: string, fallback?: string): string {
  const chosen = zone?.trim() || fallback?.trim() || "UTC";

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: chosen }).format(new Date());
  } catch {
    throw new Error("[Draeven] A time zone must be a name like Europe/Amsterdam.");
  }

  return chosen;
}

export function assertTranscriptLink(link: string): void {
  if (!/^https?:\/\/\S+$/.test(link) || link.length > 500) {
    throw new Error("[Draeven] A transcript link must start with http:// or https://.");
  }
}

export function readTranscriptChoice(
  options?: TranscriptOptions,
  fallbackZone?: string
): { timeZone: string; link?: string } {
  const timeZone = resolveTimeZone(options?.timeZone, fallbackZone);
  const link = options?.link?.trim();

  if (link) {
    assertTranscriptLink(link);
  }

  return link ? { timeZone, link } : { timeZone };
}

/* Build the page. history.messages is newest first, as Discord sends them. */
export function renderTranscript(history: ChannelHistory, options: TranscriptPage = {}): TranscriptFile {
  const choice = readTranscriptChoice(options);
  
  /* Drop earlier transcript deliveries so a new page does not include itself. */
  const filteredMessages = history.messages.filter((msg) => {
    if (!isRecord(msg) || !isRecord(msg.author) || msg.author.bot !== true) {
      return true;
    }

    const content = typeof msg.content === "string" ? msg.content : "";
    const looksLikeNote = /\bmessages? from #/.test(content) || content.startsWith("No messages in #");
    const files = Array.isArray(msg.attachments)
      ? msg.attachments.some(
          (file) =>
            isRecord(file) &&
            typeof file.filename === "string" &&
            file.filename.endsWith(".html")
        )
      : false;

    return !(looksLikeNote && files);
  });

  const ordered = [...filteredMessages].reverse();
  const roles = roleMap(options.roles);
  const profiles = profileMap(options.profiles);
  const people = new Map<string, Person>();

  for (const message of ordered) {
    remember(people, message, roles, profiles, choice.timeZone);
    rememberInteraction(people, message, roles, profiles, choice.timeZone);
  }

  const page: Page = {
    timeZone: choice.timeZone,
    ...(choice.link ? { link: choice.link } : {}),
    roles,
    people,
    channel: history.channel,
    ...(options.guildName ? { guildName: options.guildName } : {}),
  };
  const html = document(history, ordered, page);
  const bytes = new TextEncoder().encode(html);

  if (bytes.length > 10_000_000) {
    throw new Error("[Draeven] The transcript is too large to send.");
  }

  const file: TranscriptFile = {
    name: fileName(history.channel.name),
    bytes,
    type: "text/html",
    note: note(history, ordered.length),
  };
  Object.defineProperty(file, TRANSCRIPT, { value: true });
  return file;
}

export function isTranscript(value: unknown): value is TranscriptFile {
  return typeof value === "object" && value !== null && TRANSCRIPT in value;
}

function note(history: ChannelHistory, count: number): string {
  const where = history.channel.name;
  const line =
    count === 0
      ? `No messages in #${where}.`
      : history.truncated
        ? `${count} messages from #${where}. Older messages were left out.`
        : `${count} message${count === 1 ? "" : "s"} from #${where}.`;

  return line.length > 2000 ? line.slice(0, 2000) : line;
}

function fileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return `${slug || "channel"}.html`;
}

function profileMap(profiles?: readonly TranscriptProfile[]): Map<string, TranscriptProfile> {
  const map = new Map<string, TranscriptProfile>();
  for (const p of profiles ?? []) {
    if (p.id) {
      map.set(p.id, p);
    }
  }
  return map;
}

function document(history: ChannelHistory, messages: readonly unknown[], page: Page): string {
  const channel = history.channel;
  const empty = messages.every((message) => !hasWords(message));
  const body = messages.map((message, index) => renderMessage(message, messages[index - 1], page)).join("");
  const title = page.guildName ? `${page.guildName} / #${channel.name}` : `#${channel.name}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(channel.name)}</title>
<style>
  :root {
    --bg-primary: #313338;
    --bg-secondary: #2b2d31;
    --bg-tertiary: #1e1f22;
    --bg-floating: #111214;
    --bg-modifier-hover: rgba(255, 255, 255, 0.05);
    --bg-modifier-active: rgba(255, 255, 255, 0.07);
    
    --text-normal: #dbdee1;
    --text-muted: #949ba4;
    --text-link: #00a8fc;
    --channels-default: #949ba4;
    --header-primary: #f2f3f5;
    --header-secondary: #b5bac1;
    
    --interactive-normal: #b5bac1;
    --interactive-hover: #dbdee1;
    --interactive-active: #fff;
    --interactive-muted: #4e5058;
    
    --background-mentioned: rgba(250, 166, 26, 0.08);
    --background-mentioned-hover: rgba(250, 166, 26, 0.14);
    
    --brand: #5865f2;
    --brand-hover: #4752c4;
    --green: #248046;
    --green-hover: #1a6334;
    --red: #da373c;
    --red-hover: #a12828;
    
    --border-subtle: #3f4147;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg-tertiary); color: var(--text-normal); font: 16px/1.375 "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif; text-rendering: optimizeLegibility; }
  .stage { min-height: 100vh; background: var(--bg-primary); display: flex; flex-direction: column; }
  header { position: sticky; top: 0; z-index: 3; height: 48px; display: flex; align-items: center; gap: 8px; padding: 0 16px; background: var(--bg-primary); box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 1px 0 rgba(4,4,5,.06); border-bottom: 1px solid var(--border-subtle); }
  .hash { color: var(--channels-default); font-size: 24px; font-weight: 500; line-height: 1; }
  .ch { font-weight: 600; color: var(--header-primary); font-size: 16px; white-space: nowrap; }
  .topic { color: var(--text-muted); font-size: 14px; border-left: 1px solid var(--border-subtle); padding-left: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .count { margin-left: auto; color: var(--text-muted); font-size: 12px; white-space: nowrap; font-weight: 500; }
  main { padding: 16px 0 64px; }
  /* Cozy message: same DOM order as Discord (spine, then contents with avatar). */
  article {
    position: relative;
    padding: 2px 48px 2px 0;
    min-height: 44px;
    margin-top: 1.0625rem;
    transition: background .1s ease;
  }
  article:hover { background: var(--bg-modifier-hover); }
  article.compact { margin-top: 0; min-height: 0; padding-top: 0; padding-bottom: 0; }
  article.system { margin-top: 8px; min-height: 0; color: var(--text-muted); font-size: 14px; padding: 8px 48px 8px 72px; }
  button.avatar, button.name, .button, .choice, a { cursor: pointer; }
  button.avatar, button.name { border: 0; background: none; padding: 0; font: inherit; text-align: left; }
  button.name,
  .who .name {
    font-size: 16px;
    font-weight: 500;
    line-height: 1.375rem;
    color: var(--header-primary);
  }
  button.name:hover,
  .who .name:hover { text-decoration: underline; }
  .clan {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 15px;
    max-height: 15px;
    padding: 0 4px;
    border-radius: 4px;
    background: #2b2d31;
    color: var(--text-normal);
    font-size: 10px;
    font-weight: 600;
    line-height: 15px;
    flex: none;
    vertical-align: middle;
    box-sizing: border-box;
  }
  .clan img { width: 12px; height: 12px; max-width: 12px; max-height: 12px; object-fit: contain; display: block; }
  .contents {
    position: relative;
    padding-left: 72px;
    min-height: 44px;
    min-width: 0;
  }
  .contents > button.avatar,
  .contents > img.avatar {
    position: absolute;
    left: 16px;
    top: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
  .contents > button.avatar:hover { box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--text-link); }
  img.avatar { width: 40px; height: 40px; border-radius: 50%; display: block; object-fit: cover; }
  .who { display: flex; align-items: baseline; min-width: 0; line-height: 1.375rem; gap: 6px; }
  .app { display: inline-flex; align-items: center; margin-left: 4px; padding: 0 4px; border-radius: 3px; background: var(--brand); color: #fff; font-size: 10px; font-weight: 600; line-height: 15px; height: 15px; vertical-align: text-bottom; }
  .time, time, .tag { color: var(--text-muted); font-size: 12px; font-weight: 500; margin-left: 4px; text-decoration: none; }
  .time:hover { color: var(--text-link); text-decoration: underline; }
  .jump { margin-left: 6px; color: var(--text-muted); font-size: 12px; text-decoration: none; }
  .jump:hover { color: var(--text-link); text-decoration: underline; }
  .gutter {
    display: none;
    position: absolute;
    left: 0;
    top: 0;
    width: 62px;
    text-align: right;
    font-size: 11px;
    line-height: 1.375rem;
    color: var(--text-muted);
    text-decoration: none;
  }
  article.compact:hover .gutter { display: block; }
  .text { white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-normal); font-size: 1rem; line-height: 1.375rem; }
  .mention { border-radius: 3px; padding: 0 2px; font-weight: 500; background: rgba(88,101,242,.3); color: #c9cdfb; transition: background .15s; }
  .mention:hover { background: rgba(88,101,242,.5); color: #fff; }
  /*
   * Discord cozy spine:
   * repliedMessage is indented to the content column (72px).
   * ::before draws the L from mid-line down toward the big avatar.
   */
  .spine {
    position: relative;
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    gap: 0.25rem;
    margin: 0 0 4px 72px;
    padding-right: 16px;
    max-width: calc(100% - 72px);
    box-sizing: border-box;
    color: var(--header-secondary);
    font-size: 0.875rem;
    line-height: 1.125rem;
    white-space: nowrap;
  }
  /* L from the big avatar up into the small-avatar row (Discord messageSpine). */
  .spine::before {
    content: "";
    position: absolute;
    left: -36px;
    top: 8px;
    width: 36px;
    height: 18px;
    box-sizing: border-box;
    border-left: 2px solid #4e5058;
    border-top: 2px solid #4e5058;
    border-top-left-radius: 6px;
    pointer-events: none;
  }
  .spine .exec-avatar,
  .spine .reply-avatar {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  .spine .exec-name,
  .spine .rname {
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    font-weight: 500;
    color: var(--header-primary);
    cursor: pointer;
    flex: none;
  }
  .spine .exec-name:hover,
  .spine .rname:hover { text-decoration: underline; }
  .spine .clan {
    height: 14px;
    max-height: 14px;
    font-size: 10px;
    line-height: 14px;
    padding: 0 3px;
  }
  .spine .clan img { width: 10px; height: 10px; max-width: 10px; max-height: 10px; }
  .spine .rtext {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-muted);
    min-width: 0;
  }
  .spine .exec-cmd {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    color: var(--header-secondary);
    flex: none;
  }
  .spine .exec-cmd svg { width: 10px; height: 10px; flex: none; }
  .forward { margin-top: 6px; border-left: 4px solid var(--border-subtle); padding-left: 12px; color: var(--header-secondary); }
  .quote { margin: 4px 0; border-left: 4px solid var(--border-subtle); padding: 0 8px 0 12px; }
  .spoiler { background: #111; color: transparent; border-radius: 3px; cursor: pointer; transition: background .15s, color .15s; }
  .spoiler:hover { background: var(--bg-secondary); color: var(--text-normal); }
  .embed { position: relative; max-width: 520px; margin-top: 8px; background: var(--bg-secondary); border: 1px solid rgba(0,0,0,.3); border-radius: 4px; overflow: hidden; display: flex; }
  .embed .bar { width: 4px; flex: none; }
  .embed .body { padding: 12px 16px; flex: 1; min-width: 0; }
  .embed-author { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 14px; font-weight: 600; color: var(--header-primary); }
  .embed-author img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
  .embed-title { margin: 0 0 8px; font-size: 16px; font-weight: 600; color: var(--header-primary); }
  .embed-title a { color: var(--text-link); text-decoration: none; }
  .embed-title a:hover { text-decoration: underline; }
  .embed-desc { margin-bottom: 8px; font-size: 14px; line-height: 1.25rem; color: var(--text-normal); white-space: pre-wrap; overflow-wrap: anywhere; }
  .fields { display: grid; gap: 8px; margin-top: 8px; }
  .field { min-width: 0; }
  .field b { display: block; font-size: 14px; font-weight: 600; color: var(--header-primary); margin-bottom: 2px; }
  .field div { font-size: 14px; line-height: 1.25rem; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--text-normal); }
  .thumb { width: 80px; height: 80px; object-fit: cover; border-radius: 4px; float: right; margin: 0 0 8px 16px; }
  .embed-image, .shot { display: block; max-width: 400px; max-height: 300px; border-radius: 8px; margin-top: 8px; object-fit: contain; background: #000; }
  .embed-footer { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 12px; font-weight: 500; color: var(--text-muted); }
  .embed-footer img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
  .button, .choice { height: 32px; min-height: 32px; padding: 0 16px; border: 0; border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #4e5058; color: #fff; font: 500 14px/1 "gg sans", sans-serif; text-decoration: none; transition: background .17s ease; }
  .button:hover, .choice:hover { background: #6d6f78; }
  .button.blurple { background: var(--brand); }
  .button.blurple:hover { background: var(--brand-hover); }
  .button.green { background: var(--green); }
  .button.green:hover { background: var(--green-hover); }
  .button.red { background: var(--red); }
  .button.red:hover { background: var(--red-hover); }
  .button.off { opacity: .5; cursor: not-allowed; }
  a.button { color: #fff; }
  .react { display: inline-flex; align-items: center; gap: 6px; height: 26px; margin: 4px 4px 0 0; padding: 0 8px; border-radius: 8px; background: var(--bg-secondary); border: 1px solid transparent; color: var(--header-secondary); font-size: 14px; transition: background .15s, border-color .15s; }
  .react:hover { background: rgba(255,255,255,.05); border-color: var(--border-subtle); }
  .react img { width: 16px; height: 16px; object-fit: contain; }
  a { color: var(--text-link); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code { background: var(--bg-secondary); padding: .2em .4em; border-radius: 4px; font-size: .85em; font-family: Consolas, "Andale Mono WT", "Andale Mono", Lucida Console, Lucida Sans Typewriter, Monaco, "Courier New", monospace; }
  pre { background: var(--bg-secondary); border: 1px solid rgba(0,0,0,.2); border-radius: 4px; padding: 12px; margin: 6px 0; overflow: auto; }
  pre code { background: none; padding: 0; }
  .note { color: var(--text-muted); font-size: 14px; padding: 16px 72px; }
  .filecard { display: flex; align-items: center; gap: 12px; max-width: 432px; margin-top: 8px; padding: 12px; background: var(--bg-secondary); border: 1px solid rgba(0,0,0,.2); border-radius: 8px; }
  .filemark { width: 36px; height: 44px; border-radius: 4px; background: var(--bg-tertiary); color: var(--header-secondary); display: grid; place-items: center; font-size: 11px; font-weight: 700; flex: none; }
  .filecard a { font-weight: 500; text-decoration: none; }
  .filecard a:hover { text-decoration: underline; }
  .size { color: var(--text-muted); font-size: 12px; }
  .sticker, .poll { margin-top: 8px; }
  .poll { background: var(--bg-secondary); border: 1px solid rgba(0,0,0,.2); border-radius: 8px; padding: 16px; max-width: 432px; }
  .poll ul { margin: 8px 0 0; padding: 0; list-style: none; }
  .poll li { background: var(--bg-primary); border-radius: 4px; padding: 8px 12px; margin-top: 8px; }
  .gallery { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
  .gallery img { width: 160px; height: 120px; object-fit: cover; border-radius: 4px; margin: 0; }
  .gif { margin-top: 8px; max-width: 400px; }
  .gif .shot, video.gifv { display: block; max-width: 400px; max-height: 300px; border-radius: 8px; background: #000; }
  .app, .bot-tag { display: inline-flex; }
  .app[hidden], .bot-tag[hidden], #card-app[hidden] { display: none !important; }
  .copy-row { display: flex; align-items: center; gap: 8px; }
  .copy-row .copy {
    border: 0;
    border-radius: 4px;
    background: #2b2d31;
    color: var(--header-secondary);
    font: 600 11px/1 "gg sans", sans-serif;
    padding: 4px 8px;
    cursor: pointer;
  }
  .copy-row .copy:hover { color: #fff; background: #3f4147; }
  
  /* Profile card */
  #card {
    position: fixed;
    z-index: 1000;
    width: 340px;
    max-height: calc(100vh - 24px);
    overflow: auto;
    background: #111214;
    border-radius: 8px;
    box-shadow: 0 0 0 1px rgba(0,0,0,.3), 0 8px 32px rgba(0, 0, 0, 0.5);
    color: var(--text-normal);
    font-family: "gg sans", "Noto Sans", sans-serif;
    user-select: text;
    -webkit-user-select: text;
  }
  #card[hidden] { display: none; }
  #banner {
    height: 120px;
    background-color: var(--brand);
    background-size: cover;
    background-position: center;
    position: relative;
  }
  .profile-body {
    position: relative;
    padding: 0 16px 16px;
    background: #111214;
  }
  .avatar-wrap {
    width: 92px;
    height: 92px;
    margin-top: -46px;
    border-radius: 50%;
    background: #111214;
    padding: 4px;
    position: relative;
    box-sizing: border-box;
  }
  .avatar-wrap .photo {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: block;
    object-fit: cover;
  }
  .avatar-wrap .deco {
    position: absolute;
    width: 120px;
    height: 120px;
    left: -14px;
    top: -14px;
    pointer-events: none;
  }
  #card-badges {
    position: absolute;
    right: 16px;
    top: -42px;
    display: flex;
    gap: 4px;
    background: #111214;
    border-radius: 8px;
    padding: 4px 6px;
    box-shadow: 0 2px 10px rgba(0,0,0,.3);
    align-items: center;
    max-width: 200px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  .badge-icon {
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }
  .badge-icon img {
    width: 18px;
    height: 18px;
    object-fit: contain;
  }
  .card-inner-box {
    background: #232428;
    border-radius: 8px;
    padding: 12px;
    margin-top: 12px;
    border: 1px solid rgba(255, 255, 255, 0.04);
  }
  .card-head {
    margin-top: 12px;
  }
  #card-name {
    font-size: 20px;
    font-weight: 700;
    line-height: 1.2;
    color: #f2f3f5;
    display: block;
    word-break: break-word;
  }
  .clan-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #2b2d31;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 12px;
    font-weight: 600;
    color: #dbdee1;
    margin-right: 6px;
    vertical-align: middle;
  }
  .clan-tag img { width: 14px; height: 14px; object-fit: contain; }
  #card-user {
    color: #b5bac1;
    font-size: 14px;
    margin-top: 2px;
    font-weight: 400;
  }
  .section-label {
    margin: 14px 0 6px;
    font-size: 12px;
    font-weight: 700;
    color: #949ba4;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  .about-row {
    font-size: 13px;
    line-height: 1.4;
    margin-top: 8px;
    color: #dbdee1;
  }
  .about-row b {
    display: block;
    font-size: 11px;
    color: #949ba4;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 2px;
  }
  #card-roles {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-height: 120px;
    overflow-y: auto;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 22px;
    padding: 0 8px;
    border-radius: 4px;
    background: #2b2d31;
    font-size: 12px;
    font-weight: 500;
    color: #dbdee1;
  }
  .pill img { width: 14px; height: 14px; object-fit: contain; }
  .pill-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex: none;
  }
  .bot-tag {
    display: inline-flex;
    align-items: center;
    background: var(--brand);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    padding: 0 4px;
    border-radius: 3px;
    height: 15px;
    vertical-align: middle;
    margin-left: 4px;
  }
</style>
</head>
<body>
<div class="stage">
<header>
  <div class="hash">#</div>
  <div class="ch">${esc(channel.name)}</div>
  ${channel.topic ? `<div class="topic">${esc(channel.topic)}</div>` : ""}
  <div class="count">${esc(title)} · ${messages.length}${history.truncated ? "+" : ""} · ${esc(page.timeZone)}</div>
</header>
${empty && messages.length > 0 ? `<p class="note">Message text was empty. Enable Message Content for this bot in the Discord developer portal.</p>` : ""}
<main>
${body || `<p class="note">This channel has no messages.</p>`}
</main>
</div>
<div id="card" hidden>
  <div id="banner"></div>
  <div class="profile-body">
    <div class="avatar-wrap">
      <img id="card-avatar" class="photo" alt="">
      <img id="card-deco" class="deco" alt="" hidden>
    </div>
    <div id="card-badges"></div>
    <div class="card-head">
      <div>
        <span id="card-clan" class="clan-tag" hidden></span>
        <strong id="card-name"></strong>
        <span id="card-app" class="bot-tag" hidden>APP</span>
      </div>
      <div class="copy-row">
        <div id="card-user"></div>
        <button type="button" class="copy" id="copy-user" hidden>Copy</button>
      </div>
    </div>
    <div class="card-inner-box">
      <div id="roles-label" class="section-label" style="margin-top:0;">Roles</div>
      <div id="card-roles"></div>
      <div id="about-label" class="section-label">Member Info</div>
      <div id="card-about"></div>
    </div>
  </div>
</div>
<script type="application/json" id="people">${safeJson([...page.people.values()])}</script>
<script>
const people = new Map(JSON.parse(document.getElementById("people").textContent).map((person) => [person.id, person]));
const card = document.getElementById("card");
let keepCard = false;

function line(label, value) {
  const row = document.createElement("div");
  row.className = "about-row";
  const title = document.createElement("b");
  title.textContent = label;
  const text = document.createElement("div");
  text.textContent = value;
  row.append(title, text);
  return row;
}

function fillCard(person) {
  card.dataset.user = person.id;
  const banner = document.getElementById("banner");
  banner.style.backgroundColor = person.accent || person.color || "#5865f2";
  banner.style.backgroundImage = person.banner ? "url(" + JSON.stringify(person.banner) + ")" : "none";
  const photo = document.getElementById("card-avatar");
  photo.src = person.avatar;
  photo.alt = person.name;
  const deco = document.getElementById("card-deco");
  deco.hidden = !person.decoration;
  if (person.decoration) deco.src = person.decoration;
  const name = document.getElementById("card-name");
  name.textContent = person.name;
  name.style.color = person.color || "#f2f3f5";
  const clan = document.getElementById("card-clan");
  clan.hidden = !person.clan;
  clan.replaceChildren();
  if (person.clanIcon) {
    const icon = document.createElement("img");
    icon.src = person.clanIcon;
    icon.alt = "";
    clan.append(icon);
  }
  if (person.clan) clan.append(document.createTextNode(person.clan));
  const appTag = document.getElementById("card-app");
  if (person.bot === true) appTag.removeAttribute("hidden");
  else appTag.setAttribute("hidden", "");
  const userLine = document.getElementById("card-user");
  userLine.textContent = person.username ? "@" + person.username : "";
  const copyUser = document.getElementById("copy-user");
  copyUser.hidden = !person.username;
  copyUser.onclick = () => {
    navigator.clipboard.writeText(person.username || "").then(() => {
      copyUser.textContent = "Copied";
      setTimeout(() => { copyUser.textContent = "Copy"; }, 1200);
    });
  };
  const badges = document.getElementById("card-badges");
  badges.replaceChildren();
  if (person.badges && person.badges.length > 0) {
    badges.hidden = false;
    for (const badge of person.badges) {
      const wrap = document.createElement("div");
      wrap.className = "badge-icon";
      wrap.title = badge.name || "";
      if (badge.icon) {
        const img = document.createElement("img");
        img.src = badge.icon;
        img.alt = badge.name || "";
        wrap.append(img);
      } else {
        wrap.textContent = badge.mark || "★";
        wrap.style.background = badge.color || "#5865f2";
        wrap.style.color = "#fff";
        wrap.style.fontSize = "11px";
        wrap.style.fontWeight = "700";
      }
      badges.append(wrap);
    }
  } else {
    badges.hidden = true;
  }
  const roles = document.getElementById("card-roles");
  roles.replaceChildren();
  const hasRoles = person.roles && person.roles.length > 0;
  document.getElementById("roles-label").hidden = !hasRoles;
  roles.hidden = !hasRoles;
  if (hasRoles) {
    for (const role of person.roles) {
      const pill = document.createElement("span");
      pill.className = "pill";
      if (role.color) {
        const dot = document.createElement("span");
        dot.className = "pill-dot";
        dot.style.background = role.color;
        pill.append(dot);
      }
      if (role.icon) {
        const icon = document.createElement("img");
        icon.src = role.icon;
        icon.alt = "";
        pill.append(icon);
      }
      pill.append(document.createTextNode((role.emoji ? role.emoji + " " : "") + role.name));
      roles.append(pill);
    }
  }
  const about = document.getElementById("card-about");
  about.replaceChildren();
  if (person.created) about.append(line("Member Since", person.created));
  if (person.joined) about.append(line("Joined Server", person.joined));
  if (person.boosting) about.append(line("Boosting Since", person.boosting));
  const idRow = line("User ID", person.id);
  const copyId = document.createElement("button");
  copyId.type = "button";
  copyId.className = "copy";
  copyId.textContent = "Copy";
  copyId.onclick = () => {
    navigator.clipboard.writeText(person.id).then(() => {
      copyId.textContent = "Copied";
      setTimeout(() => { copyId.textContent = "Copy"; }, 1200);
    });
  };
  const wrap = document.createElement("div");
  wrap.className = "copy-row";
  wrap.append(idRow, copyId);
  about.append(wrap);
  document.getElementById("about-label").hidden = about.childNodes.length === 0;
}

function placeCard(around) {
  card.hidden = false;
  const box = around.getBoundingClientRect();
  const gap = 8;
  let top = box.bottom + gap;
  let left = box.left;
  if (top + card.offsetHeight > window.innerHeight - gap) {
    top = Math.max(gap, box.top - card.offsetHeight - gap);
  }
  if (left + card.offsetWidth > window.innerWidth - gap) {
    left = Math.max(gap, window.innerWidth - card.offsetWidth - gap);
  }
  card.style.top = top + "px";
  card.style.left = left + "px";
}

card.addEventListener("pointerdown", () => { keepCard = true; });
card.addEventListener("click", (event) => { event.stopPropagation(); });
document.addEventListener("click", (event) => {
  if (keepCard) {
    keepCard = false;
    return;
  }
  const opener = event.target.closest("[data-user]");
  if (!opener) {
    if (!card.contains(event.target)) card.hidden = true;
    return;
  }
  const person = people.get(opener.getAttribute("data-user"));
  if (!person) return;
  if (card.dataset.user === person.id && !card.hidden) {
    card.hidden = true;
    return;
  }
  fillCard(person);
  placeCard(opener);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") card.hidden = true;
});
document.addEventListener("copy", () => { keepCard = true; });
</script>
</body>
</html>`;
}

function hasWords(value: unknown): boolean {
  return isRecord(value) && typeof value.content === "string" && value.content.trim().length > 0;
}

function renderMessage(value: unknown, previous: unknown, page: Page): string {
  if (!isRecord(value)) {
    return "";
  }

  const author = isRecord(value.author) ? value.author : {};
  const name = displayName(value, author);
  const when = typeof value.timestamp === "string" ? value.timestamp : "";
  const type = typeof value.type === "number" ? value.type : 0;
  const text = textOf(value, page);
  const id = typeof value.id === "string" ? value.id : "";
  const raw = typeof value.content === "string" ? value.content : "";
  const extras = extra(value, text);
  const command = commandLabel(value);
  const used = command ? interactionBar(value, command, page) : "";
  const quote = replyQuote(value, page);
  const body = raw ? `<div class="text">${formatContent(raw, text)}</div>` : "";

  if (SYSTEM.has(type)) {
    const content = raw ? `<div class="text">${formatContent(raw, text)}</div>` : "";
    return `<article class="system" id="m-${esc(id)}"><div>${esc(systemLine(type, name))}</div>${content}${extras}</article>`;
  }

  /* Empty slash husks have nothing to show; the reply carries the command bar. */
  if (!body && !extras && !quote) {
    return "";
  }

  const compact = sameGroup(value, previous) && !used && !quote;
  const authorId = typeof author.id === "string" ? author.id : "";
  const person = authorId ? page.people.get(authorId) : undefined;
  const app = isAppAuthor(author, value) ? `<span class="app">APP</span>` : "";
  const face = authorId
    ? `<button type="button" class="avatar" data-user="${esc(authorId)}" aria-label="${esc(name)}"><img class="avatar" alt="" src="${esc(avatar(author))}"></button>`
    : `<img class="avatar" alt="" src="${esc(avatar(author))}">`;
  const who = authorName(name, authorId, person);
  const clock = formatWhen(when, page.timeZone);

  const spine = used || quote;
  const classes = [compact ? "compact" : "group", spine ? "has-spine" : ""].filter(Boolean).join(" ");

  return `<article class="${classes}" id="m-${esc(id)}">
  ${spine}
  <div class="contents">
    ${compact ? `<a class="gutter" href="#m-${esc(id)}">${esc(clock.slice(-5))}</a>` : face}
    ${compact ? "" : `<div class="who">${who}${clanTag(person)}${app}${jump(page, id)}<time datetime="${esc(when)}" class="time">${esc(clock)}</time>${badges(value)}</div>`}
    ${body}
    ${extras}
  </div>
</article>`;
}

function authorName(label: string, id: string, person: Person | undefined, kind: "name" | "exec-name" | "rname" = "name"): string {
  const color = person?.color ? ` style="color:${esc(person.color)}"` : "";
  if (id) {
    return `<button type="button" class="${kind}" data-user="${esc(id)}"${color}>${esc(label)}</button>`;
  }
  return `<span class="${kind}"${color}>${esc(label)}</span>`;
}

function clanTag(person: Person | undefined): string {
  if (!person?.clan) {
    return "";
  }

  return `<span class="clan">${person.clanIcon ? `<img alt="" src="${esc(person.clanIcon)}">` : ""}${esc(person.clan)}</span>`;
}

function isAppAuthor(author: Record<string, unknown>, message: Record<string, unknown>): boolean {
  if (author.bot === true) {
    return true;
  }

  return typeof message.webhook_id === "string" && message.webhook_id.length > 0;
}

function commandLabel(value: Record<string, unknown>): string {
  const meta = isRecord(value.interaction_metadata)
    ? value.interaction_metadata
    : isRecord(value.interaction)
      ? value.interaction
      : undefined;

  if (!meta || typeof meta.name !== "string" || !meta.name) {
    return "";
  }

  const type = typeof value.type === "number" ? value.type : 0;
  const kind = typeof meta.type === "number" ? meta.type : type === 23 ? 3 : 2;
  return kind === 3 || type === 23 ? meta.name : `/${meta.name}`;
}

function interactionBar(value: Record<string, unknown>, command: string, page: Page): string {
  const meta = isRecord(value.interaction_metadata)
    ? value.interaction_metadata
    : isRecord(value.interaction)
      ? value.interaction
      : undefined;
  const user = meta && isRecord(meta.user) ? meta.user : {};
  const id = typeof user.id === "string" ? user.id : "";
  const who =
    (typeof user.global_name === "string" && user.global_name) ||
    (typeof user.username === "string" && user.username) ||
    "Someone";
  const person = id ? page.people.get(id) : undefined;
  const face = `<img class="exec-avatar" alt="" src="${esc(avatar(user))}">`;
  const label = command.startsWith("/") ? command.slice(1) : command;
  const icon = `<svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M2.06 7.61c-.25.95.31 1.92 1.26 2.18l4.3 1.15c.94.25 1.91-.31 2.17-1.26l1.15-4.3c.25-.94-.31-1.91-1.26-2.17l-4.3-1.15c-.94-.25-1.91.31-2.17 1.26l-1.15 4.3ZM12.98 7.87a2 2 0 0 0 1.75 2.95H20a2 2 0 0 0 1.76-2.95l-2.63-4.83a2 2 0 0 0-3.51 0l-2.63 4.83ZM5.86 13.27a.89.89 0 0 1 1.28 0l.75.77a.9.9 0 0 0 .54.26l1.06.12c.5.06.85.52.8 1.02l-.13 1.08c-.02.2.03.42.14.6l.56.92c.27.43.14 1-.28 1.26l-.9.58a.92.92 0 0 0-.37.48l-.36 1.02a.9.9 0 0 1-1.15.57l-1-.36a.89.89 0 0 0-.6 0l-1 .36a.9.9 0 0 1-1.15-.57l-.36-1.02a.92.92 0 0 0-.37-.48l-.9-.58a.93.93 0 0 1-.28-1.26l.56-.93c.11-.17.16-.38.14-.59l-.12-1.08c-.06-.5.3-.96.8-1.02l1.05-.12a.9.9 0 0 0 .54-.26l.75-.77ZM18.52 13.71a1.1 1.1 0 0 0-2.04 0l-.46 1.24c-.19.5-.57.88-1.07 1.07l-1.24.46a1.1 1.1 0 0 0 0 2.04l1.24.46c.5.19.88.57 1.07 1.07l.46 1.24c.35.95 1.7.95 2.04 0l.46-1.24c.19-.5.57-.88 1.07-1.07l1.24-.46a1.1 1.1 0 0 0 0-2.04l-1.24-.46a1.8 1.8 0 0 1-1.07-1.07l-.46-1.24Z"></path></svg>`;

  return `<div class="spine executed" aria-hidden="true">${face}${authorName(who, id, person, "exec-name")}${clanTag(person)}<span> used </span><span class="exec-cmd">${icon}${esc(label)}</span></div>`;
}

function extra(value: Record<string, unknown>, text: TextContext): string {
  return [
    attachments(value.attachments),
    embeds(value.embeds, text),
    stickers(value.sticker_items),
    reactions(value.reactions),
    poll(value.poll),
    components(value.components, text),
    snapshots(value.message_snapshots, text.page),
    thread(value.thread),
  ].join("");
}

function sameGroup(value: Record<string, unknown>, previous: unknown): boolean {
  if (!isRecord(previous)) {
    return false;
  }

  const type = typeof value.type === "number" ? value.type : 0;
  const previousType = typeof previous.type === "number" ? previous.type : 0;

  if (
    SYSTEM.has(type) ||
    SYSTEM.has(previousType) ||
    type === 20 ||
    type === 23 ||
    previousType === 20 ||
    previousType === 23 ||
    value.message_reference ||
    value.interaction ||
    value.interaction_metadata
  ) {
    return false;
  }

  const author = isRecord(value.author) ? value.author.id : undefined;
  const before = isRecord(previous.author) ? previous.author.id : undefined;

  if (!author || author !== before) {
    return false;
  }

  const left = Date.parse(typeof previous.timestamp === "string" ? previous.timestamp : "");
  const right = Date.parse(typeof value.timestamp === "string" ? value.timestamp : "");
  return Number.isFinite(left) && Number.isFinite(right) && right - left < 7 * 60 * 1000 && right >= left;
}

function systemLine(type: number, name: string): string {
  const lines: Record<number, string> = {
    1: `${name} added someone to the group.`,
    2: `${name} removed someone from the group.`,
    3: `${name} started a call.`,
    4: `${name} changed the channel name.`,
    5: `${name} changed the channel icon.`,
    6: `${name} pinned a message.`,
    7: `${name} joined.`,
    8: `${name} boosted the server.`,
    9: `${name} boosted the server to level 1.`,
    10: `${name} boosted the server to level 2.`,
    11: `${name} boosted the server to level 3.`,
    12: `${name} followed a channel.`,
    14: "This server was removed from discovery.",
    15: "This server was returned to discovery.",
    16: "Discovery grace period started.",
    17: "Discovery grace period is ending.",
    18: `${name} started a thread.`,
    21: "Thread starter.",
    22: "Invite friends to this server.",
    24: "AutoMod took an action.",
    25: `${name} bought a role subscription.`,
    26: "A premium upsell was shown.",
    27: `${name} started a stage.`,
    28: `${name} ended a stage.`,
    29: `${name} is speaking.`,
    31: `${name} changed the stage topic.`,
    32: `${name} subscribed.`,
    36: "Safety alerts were enabled.",
    37: "Safety alerts were disabled.",
    38: "A raid was reported.",
    39: "The raid report was a false alarm.",
    44: `${name} bought something.`,
    46: "A poll ended.",
  };

  return lines[type] ?? `System message ${type}.`;
}

function badges(value: Record<string, unknown>): string {
  const flags = typeof value.flags === "number" ? value.flags : 0;
  const parts = [
    value.edited_timestamp ? "edited" : "",
    value.pinned === true ? "pinned" : "",
    value.tts === true ? "tts" : "",
    flags & (1 << 13) ? "voice" : "",
    flags & (1 << 1) ? "crosspost" : "",
    flags & (1 << 14) ? "forward" : "",
  ].filter(Boolean);

  return parts.length > 0 ? `<span class="tag">${esc(parts.join(" · "))}</span>` : "";
}

function jump(page: Page, id: string): string {
  if (!id) {
    return "";
  }

  const pattern = page.link || "https://discord.com/channels/{guild}/{channel}/{message}";
  const href = pattern
    .replaceAll("{guild}", page.channel.guildId || "@me")
    .replaceAll("{channel}", page.channel.id)
    .replaceAll("{message}", id);

  return ` <a class="jump" href="${esc(href)}" target="_blank" rel="noreferrer">link</a>`;
}

function replyQuote(value: Record<string, unknown>, page: Page): string {
  if (!isRecord(value.message_reference) && !isRecord(value.referenced_message)) {
    return "";
  }

  if (!isRecord(value.referenced_message)) {
    return `<div class="spine reply" aria-hidden="true"><span class="rtext">Replying to a message that was deleted.</span></div>`;
  }

  const author = isRecord(value.referenced_message.author) ? value.referenced_message.author : {};
  const content = typeof value.referenced_message.content === "string" ? value.referenced_message.content : "";
  const name = displayName(value.referenced_message, author);
  const id = typeof author.id === "string" ? author.id : "";
  const person = id ? page.people.get(id) : undefined;
  const face = `<img class="reply-avatar" alt="" src="${esc(avatar(author))}">`;
  return `<div class="spine reply" aria-hidden="true">${face}${authorName(name, id, person, "rname")}${clanTag(person)}<span class="rtext">${esc(content.slice(0, 180) || "Click to see attachment")}</span></div>`;
}

function attachments(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (!isRecord(item) || typeof item.url !== "string") {
        return "";
      }

      const name = typeof item.filename === "string" ? item.filename : "file";
      const kind = typeof item.content_type === "string" ? item.content_type : "";
      const url = item.url;
      const lower = name.toLowerCase();

      if (kind.startsWith("image/") || /\.(gif|png|jpe?g|webp|avif)$/i.test(lower)) {
        return `<div class="file"><img class="shot" alt="${esc(name)}" src="${esc(url)}"></div>`;
      }

      if (kind.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(lower)) {
        return `<div class="file"><video controls playsinline src="${esc(url)}"></video></div>`;
      }

      if (kind.startsWith("audio/") || typeof item.duration_secs === "number") {
        return `<div class="file"><audio controls src="${esc(url)}"></audio> ${esc(name)}</div>`;
      }

      const size = typeof item.size === "number" ? ` (${item.size} bytes)` : "";
      return `<div class="file"><a href="${esc(url)}">${esc(name)}</a>${esc(size)}</div>`;
    })
    .join("");
}

function embeds(value: unknown, text: TextContext): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return "";
      }

      const title = typeof item.title === "string" ? item.title : "";
      const titleUrl = typeof item.url === "string" ? item.url : "";
      const description = typeof item.description === "string" ? item.description : "";
      const color = typeof item.color === "number" ? `#${item.color.toString(16).padStart(6, "0")}` : "#5865f2";
      const image = isRecord(item.image) && typeof item.image.url === "string" ? item.image.url : "";
      const thumb = isRecord(item.thumbnail) && typeof item.thumbnail.url === "string" ? item.thumbnail.url : "";
      const video = isRecord(item.video) && typeof item.video.url === "string" ? item.video.url : "";
      const kind = typeof item.type === "string" ? item.type : "";
      const fields = Array.isArray(item.fields)
        ? `<div class="fields">${item.fields
            .map((field) =>
              isRecord(field)
                ? `<div class="field"><b>${esc(String(field.name ?? ""))}</b><div>${formatContent(String(field.value ?? ""), text)}</div></div>`
                : ""
            )
            .join("")}</div>`
        : "";
      const author = isRecord(item.author) && typeof item.author.name === "string" ? `<div class="embed-author">${isRecord(item.author) && typeof item.author.icon_url === "string" ? `<img src="${esc(item.author.icon_url)}" alt="">` : ""}${esc(item.author.name)}</div>` : "";
      const footer = isRecord(item.footer) && typeof item.footer.text === "string" ? `<div class="embed-footer">${isRecord(item.footer) && typeof item.footer.icon_url === "string" ? `<img src="${esc(item.footer.icon_url)}" alt="">` : ""}<span>${esc(item.footer.text)}</span></div>` : "";
      const heading = title
        ? titleUrl
          ? `<div class="embed-title"><a href="${esc(titleUrl)}" target="_blank" rel="noreferrer">${esc(title)}</a></div>`
          : `<div class="embed-title">${esc(title)}</div>`
        : "";

      if (kind === "gifv" || (video && (kind === "rich" || kind === "image" || !title && !description))) {
        const media = video
          ? `<video class="shot gifv" autoplay loop muted playsinline poster="${esc(thumb || image || "")}" src="${esc(video)}"></video>`
          : thumb || image
            ? `<img class="shot" alt="" src="${esc(thumb || image)}">`
            : "";
        const open = titleUrl ? `<a class="gif-link" href="${esc(titleUrl)}" target="_blank" rel="noreferrer">${media}</a>` : media;
        return `<div class="gif">${open}</div>`;
      }

      return `<div class="embed"><div class="bar" style="background:${esc(color)}"></div><div class="body">${author}${heading}${description ? `<div class="embed-desc">${formatContent(description, text)}</div>` : ""}${thumb ? `<img class="thumb" alt="" src="${esc(thumb)}">` : ""}${fields}${image ? `<img class="embed-image" alt="" src="${esc(image)}">` : ""}${video ? `<video class="shot" controls playsinline src="${esc(video)}"></video>` : ""}${footer}</div></div>`;
    })
    .join("");
}

function stickers(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (!isRecord(item) || typeof item.id !== "string") {
        return "";
      }

      const name = typeof item.name === "string" ? item.name : "sticker";
      const format = item.format_type;
      const ext = format === 4 ? "gif" : "png";

      if (format === 3) {
        return `<div class="sticker">${esc(name)}</div>`;
      }

      return `<div class="sticker"><img class="shot" alt="${esc(name)}" src="https://cdn.discordapp.com/stickers/${esc(item.id)}.${ext}"></div>`;
    })
    .join("");
}

function reactions(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (!isRecord(item) || !isRecord(item.emoji)) {
        return "";
      }

      const name = typeof item.emoji.name === "string" ? item.emoji.name : "emoji";
      const count = typeof item.count === "number" ? item.count : 0;
      const burst =
        isRecord(item.count_details) && typeof item.count_details.burst === "number" && item.count_details.burst > 0
          ? ` · ${item.count_details.burst} burst`
          : "";
      const icon =
        typeof item.emoji.id === "string"
          ? `<img alt="${esc(name)}" src="https://cdn.discordapp.com/emojis/${esc(item.emoji.id)}.png" width="18" height="18">`
          : esc(name);

      return `<span class="react">${icon} ${count}${esc(burst)}</span>`;
    })
    .join("");
}

function poll(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }

  const question = mediaText(value.question);
  const counts = new Map<number, number>();

  if (isRecord(value.results) && Array.isArray(value.results.answer_counts)) {
    for (const row of value.results.answer_counts) {
      if (isRecord(row) && typeof row.id === "number" && typeof row.count === "number") {
        counts.set(row.id, row.count);
      }
    }
  }

  const answers = Array.isArray(value.answers)
    ? value.answers
        .map((answer) => {
          if (!isRecord(answer)) {
            return "";
          }

          const id = typeof answer.answer_id === "number" ? answer.answer_id : -1;
          const votes = counts.get(id);
          return `<li>${esc(mediaText(answer.poll_media))}${votes === undefined ? "" : ` · ${votes}`}</li>`;
        })
        .join("")
    : "";

  return `<div class="poll"><strong>${esc(question || "Poll")}</strong><ul>${answers}</ul></div>`;
}

function components(value: unknown, text: TextContext): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value.map((item) => component(item, text)).join("");
}

function component(value: unknown, text: TextContext): string {
  if (!isRecord(value) || typeof value.type !== "number") {
    return "";
  }

  if (value.type === 1 || value.type === 17) {
    const inner = components(value.components, text);
    return value.type === 17 ? `<div class="embed"><div class="bar"></div><div class="body">${inner}</div></div>` : `<div class="row">${inner}</div>`;
  }

  if (value.type === 2) {
    const label = typeof value.label === "string" ? value.label : "Button";
    const style = value.style === 3 ? "green" : value.style === 4 ? "red" : value.style === 1 ? "blurple" : "";
    const url = typeof value.url === "string" ? value.url : "";

    if (url) {
      return `<a class="button ${style}" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`;
    }

    return `<span class="button ${style}">${esc(label)}</span>`;
  }

  if (value.type === 3 || value.type === 5 || value.type === 6 || value.type === 7 || value.type === 8) {
    const placeholder = typeof value.placeholder === "string" ? value.placeholder : "Choose";
    const options = Array.isArray(value.options)
      ? value.options
          .map((option) => (isRecord(option) && typeof option.label === "string" ? `<span class="choice">${esc(option.label)}</span>` : ""))
          .join("")
      : "";
    return `<div class="row"><span class="choice">${esc(placeholder)}</span>${options}</div>`;
  }

  if (value.type === 9) {
    return `<div>${components(value.components, text)}${component(value.accessory, text)}</div>`;
  }

  if (value.type === 10) {
    return `<div class="text">${formatContent(typeof value.content === "string" ? value.content : "", text)}</div>`;
  }

  if (value.type === 11 && isRecord(value.media) && typeof value.media.url === "string") {
    return `<img class="shot" alt="" src="${esc(value.media.url)}">`;
  }

  if (value.type === 12 && Array.isArray(value.items)) {
    return `<div class="gallery">${value.items
      .map((item) =>
        isRecord(item) && isRecord(item.media) && typeof item.media.url === "string"
          ? `<img alt="" src="${esc(item.media.url)}">`
          : ""
      )
      .join("")}</div>`;
  }

  if (value.type === 13 && isRecord(value.file) && typeof value.file.url === "string") {
    return `<div class="file"><a href="${esc(value.file.url)}">File</a></div>`;
  }

  if (value.type === 14) {
    return "<hr>";
  }

  return "";
}

function snapshots(value: unknown, page: Page): string {
  if (!Array.isArray(value)) {
    return "";
  }

  return value
    .map((item) => {
      if (!isRecord(item) || !isRecord(item.message)) {
        return "";
      }

      const text = textOf(item.message, page);
      const content = typeof item.message.content === "string" ? item.message.content : "";
      return `<div class="forward">Forwarded<br>${formatContent(content, text)}${attachments(item.message.attachments)}${embeds(item.message.embeds, text)}${components(item.message.components, text)}</div>`;
    })
    .join("");
}

function thread(value: unknown): string {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name) {
    return "";
  }

  return `<div class="reply">Thread: ${esc(value.name)}</div>`;
}

function formatContent(value: string, text: TextContext): string {
  const held: string[] = [];
  const keep = (html: string) => {
    const token = `\uE000${held.length}\uE001`;
    held.push(html);
    return token;
  };
  const link = (href: string, label: string) =>
    keep(`<a href="${href}" target="_blank" rel="noreferrer">${label}</a>`);

  const body = esc(value)
    .replace(/```(?:([a-zA-Z0-9_+-]+)\r?\n)?([\s\S]*?)```/g, (_match, _lang: string | undefined, code: string) =>
      keep(`<pre><code>${code.replace(/^\r?\n/, "").replace(/\r?\n$/, "")}</code></pre>`)
    )
    .replace(/`([^`\n]+)`/g, (_match, code: string) => keep(`<code>${code}</code>`))
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, label: string, url: string) => link(url, label))
    .replace(/&lt;(https?:\/\/.+?)&gt;/g, (_match, url: string) => link(url, url))
    .replace(/https?:\/\/[^\s<\uE000\uE001]+/g, (url) => {
      const clean = url.replace(/[),.;!?]+$/g, "");
      return link(clean, clean) + url.slice(clean.length);
    })
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, "$1<em>$2</em>")
    .replace(/&lt;t:(\d+)(?::[tTdDfFR])?&gt;/g, (_match, seconds: string) => {
      const date = new Date(Number(seconds) * 1000);
      return Number.isNaN(date.getTime()) ? _match : esc(formatWhen(date.toISOString(), text.page.timeZone));
    })
    .replace(/&lt;@!?(\d+)&gt;/g, (_match, id: string) => mentionUser(id, text))
    .replace(/&lt;@&amp;(\d+)&gt;/g, (_match, id: string) => mentionRole(id, text.page))
    .replace(/&lt;#(\d+)&gt;/g, (_match, id: string) => {
      const name = text.channels.get(id);
      return `<span class="mention">#${esc(name || "channel")}</span>`;
    })
    .replace(/&lt;(a?):([A-Za-z0-9_]+):(\d+)&gt;/g, (_match, animated: string, name: string, id: string) => {
      const ext = animated === "a" ? "gif" : "png";
      return `<img alt="${esc(name)}" src="https://cdn.discordapp.com/emojis/${esc(id)}.${ext}" width="22" height="22" style="vertical-align:bottom">`;
    });

  return body.replace(/\uE000(\d+)\uE001/g, (_match, index: string) => held[Number(index)] ?? "");
}

function mentionUser(id: string, text: TextContext): string {
  const person = text.page.people.get(id);
  const name = person?.name || text.users.get(id) || "user";
  return pillUser(`@${name}`, person?.color || undefined);
}

function mentionRole(id: string, page: Page): string {
  const role = page.roles.get(id);

  if (!role) {
    return pillUser("@role");
  }

  return pillUser(`@${role.name}`, role.color ? hex(role.color) : undefined);
}

function pillUser(label: string, color?: string): string {
  const style = color ? ` style="color:${color};background:${color}22"` : "";
  return `<span class="mention"${style}>${esc(label)}</span>`;
}

function textOf(message: Record<string, unknown>, page: Page): TextContext {
  return { page, users: mentionNames(message), channels: mentionChannels(message) };
}

function mentionNames(message: Record<string, unknown>): Map<string, string> {
  const names = new Map<string, string>();

  if (!Array.isArray(message.mentions)) {
    return names;
  }

  for (const item of message.mentions) {
    if (!isRecord(item) || typeof item.id !== "string") {
      continue;
    }

    const globalName = typeof item.global_name === "string" ? item.global_name : "";
    const username = typeof item.username === "string" ? item.username : "";
    const name = globalName || username;

    if (name) {
      names.set(item.id, name);
    }
  }

  return names;
}

function mentionChannels(message: Record<string, unknown>): Map<string, string> {
  const names = new Map<string, string>();

  if (!Array.isArray(message.mention_channels)) {
    return names;
  }

  for (const item of message.mention_channels) {
    if (isRecord(item) && typeof item.id === "string" && typeof item.name === "string" && item.name) {
      names.set(item.id, item.name);
    }
  }

  return names;
}

function displayName(message: Record<string, unknown>, author: Record<string, unknown>): string {
  const member = isRecord(message.member) && typeof message.member.nick === "string" ? message.member.nick : "";
  const globalName = typeof author.global_name === "string" ? author.global_name : "";
  const username = typeof author.username === "string" ? author.username : "";
  return member || globalName || username || "Unknown";
}

function avatar(author: Record<string, unknown>): string {
  const id = typeof author.id === "string" ? author.id : "0";

  if (typeof author.avatar === "string" && author.avatar) {
    const ext = author.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${id}/${author.avatar}.${ext}`;
  }

  const index = /^\d+$/.test(id) ? Number((BigInt(id) >> 22n) % 6n) : 0;
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

function rememberInteraction(
  people: Map<string, Person>,
  message: unknown,
  roles: Map<string, RoleInfo>,
  profiles: Map<string, TranscriptProfile>,
  timeZone: string
): void {
  if (!isRecord(message)) {
    return;
  }

  const meta = isRecord(message.interaction_metadata)
    ? message.interaction_metadata
    : isRecord(message.interaction)
      ? message.interaction
      : undefined;
  const user = meta && isRecord(meta.user) ? meta.user : undefined;

  if (!user) {
    return;
  }

  remember(
    people,
    {
      author: { ...user, bot: false },
      member: isRecord(meta) && isRecord(meta.member) ? meta.member : undefined,
      timestamp: typeof message.timestamp === "string" ? message.timestamp : "",
    },
    roles,
    profiles,
    timeZone
  );
}

function remember(
  people: Map<string, Person>,
  message: unknown,
  roles: Map<string, RoleInfo>,
  profiles: Map<string, TranscriptProfile>,
  timeZone: string
): void {
  if (!isRecord(message) || !isRecord(message.author)) {
    return;
  }

  const author = message.author;
  const id = typeof author.id === "string" ? author.id : "";

  /* Humans never get APP. Only an explicit Discord bot flag counts. */
  const isBot = author.bot === true;

  if (people.has(id)) {
    const existing = people.get(id);

    if (!existing) {
      return;
    }

    if (existing.bot !== isBot) {
      existing.bot = existing.bot && isBot;
    }

    const ids = roleIds(message);

    if (ids.length > 0) {
      const next = nameColor(ids, roles);
      if (next) {
        existing.color = next;
      }
      if (existing.roles.length === 0) {
        existing.roles = rolePills(ids, roles);
      }
      existing.joined = joinedLabel(message, timeZone) || existing.joined;
      existing.boosting = boostingLabel(message, timeZone) || existing.boosting;
    }

    const profile = profiles.get(id);
    if (profile?.clan && !existing.clan) {
      existing.clan = profile.clan;
      existing.clanIcon = profile.clanIcon ?? "";
    }

    return;
  }

  const ids = roleIds(message);
  const profile = profiles.get(id);
  const accent = profile?.accent ? hex(profile.accent) : "";
  const banner = profile?.banner
    ? profile.banner.startsWith("http")
      ? profile.banner
      : `https://cdn.discordapp.com/banners/${id}/${profile.banner}.${profile.banner.startsWith("a_") ? "gif" : "png"}?size=600`
    : "";
  const decoration = profile?.decoration
    ? profile.decoration.startsWith("http")
      ? profile.decoration
      : `https://cdn.discordapp.com/avatar-decoration-presets/${profile.decoration}.png?size=240`
    : "";
  const clan = profile?.clan ?? "";
  const clanIcon = profile?.clanIcon ?? "";

  people.set(id, {
    id,
    name: displayName(message, author),
    username: typeof author.username === "string" ? author.username : "",
    avatar: avatar(author),
    banner,
    accent,
    decoration,
    bot: isBot,
    color: nameColor(ids, roles) ?? "",
    clan,
    clanIcon,
    badges: userBadges(author, profile),
    roles: rolePills(ids, roles),
    created: createdLabel(id, timeZone),
    joined: joinedLabel(message, timeZone),
    boosting: boostingLabel(message, timeZone),
    meta: personMeta(id, message, timeZone),
  });
}

function roleIds(message: Record<string, unknown>): string[] {
  const member = isRecord(message.member) ? message.member : undefined;

  if (!member || !Array.isArray(member.roles)) {
    return [];
  }

  return member.roles.filter((id): id is string => typeof id === "string");
}

function nameColor(ids: readonly string[], roles: Map<string, RoleInfo>): string | undefined {
  let best: RoleInfo | undefined;

  for (const id of ids) {
    const role = roles.get(id);

    if (!role?.color) {
      continue;
    }

    if (!best || role.position > best.position) {
      best = role;
    }
  }

  return best ? hex(best.color) : undefined;
}

function rolePills(ids: readonly string[], roles: Map<string, RoleInfo>): { name: string; color: string; emoji: string; icon: string }[] {
  return ids
    .map((id) => roles.get(id))
    .filter((role): role is RoleInfo => !!role && role.name !== "@everyone")
    .sort((left, right) => right.position - left.position)
    .map((role) => ({
      name: role.name,
      color: role.color ? hex(role.color) : "",
      emoji: role.emoji ?? "",
      icon: role.icon ?? "",
    }));
}

function userBadges(author: Record<string, unknown>, profile?: TranscriptProfile): { name: string; mark: string; color: string; icon?: string }[] {
  const list: { name: string; mark: string; color: string; icon?: string }[] = [];
  const flags = typeof author.public_flags === "number" ? author.public_flags : 0;
  const profileFlags = profile?.flags ?? 0;
  const combined = flags | profileFlags;

  if (combined & (1 << 0)) list.push({ name: "Discord Staff", mark: "S", color: "#5865f2" });
  if (combined & (1 << 1)) list.push({ name: "Discord Partner", mark: "P", color: "#5865f2" });
  if (combined & (1 << 2)) list.push({ name: "HypeSquad Events", mark: "HE", color: "#fEE75C" });
  if (combined & (1 << 3)) list.push({ name: "Bug Hunter Level 1", mark: "B1", color: "#23a55a" });
  if (combined & (1 << 6)) list.push({ name: "HypeSquad Bravery", mark: "Br", color: "#9b59b6" });
  if (combined & (1 << 7)) list.push({ name: "HypeSquad Brilliance", mark: "Bl", color: "#f1c40f" });
  if (combined & (1 << 8)) list.push({ name: "HypeSquad Balance", mark: "Ba", color: "#2ecc71" });
  if (combined & (1 << 9)) list.push({ name: "Early Supporter", mark: "ES", color: "#e67e22" });
  if (combined & (1 << 14)) list.push({ name: "Bug Hunter Level 2", mark: "B2", color: "#23a55a" });
  if (combined & (1 << 17)) list.push({ name: "Early Verified Bot Developer", mark: "Dev", color: "#e91e63" });
  if (combined & (1 << 18)) list.push({ name: "Moderator Programs Alumni", mark: "Mod", color: "#5865f2" });
  if (combined & (1 << 22)) list.push({ name: "Active Developer", mark: "AD", color: "#5865f2" });

  return list;
}

function personMeta(id: string, message: Record<string, unknown>, timeZone: string): string {
  const lines = [`Id ${id}`];
  const created = createdLabel(id, timeZone);

  if (created) {
    lines.push(`Created ${created}`);
  }

  const joined = joinedLabel(message, timeZone);

  if (joined) {
    lines.push(`Joined ${joined}`);
  }

  const boosting = boostingLabel(message, timeZone);
  if (boosting) {
    lines.push(`Boosting ${boosting}`);
  }

  return lines.join("\n");
}

function createdLabel(id: string, timeZone: string): string {
  if (!/^\d{1,20}$/.test(id)) {
    return "";
  }

  try {
    return formatWhen(createdAtFromId(id).toISOString(), timeZone);
  } catch {
    return "";
  }
}

function joinedLabel(message: unknown, timeZone: string): string {
  if (!isRecord(message) || !isRecord(message.member)) return "";
  const joined = message.member.joined_at;
  return typeof joined === "string" ? formatWhen(joined, timeZone) : "";
}

function boostingLabel(message: unknown, timeZone: string): string {
  if (!isRecord(message) || !isRecord(message.member)) return "";
  const boosting = message.member.premium_since;
  return typeof boosting === "string" ? formatWhen(boosting, timeZone) : "";
}

function roleMap(roles: readonly TranscriptRole[] | undefined): Map<string, RoleInfo> {
  const map = new Map<string, RoleInfo>();

  for (const role of roles ?? []) {
    if (role.id && role.name) {
      map.set(role.id, role);
    }
  }

  return map;
}

function formatWhen(value: string, timeZone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function hex(color: number): string {
  return `#${(color >>> 0).toString(16).padStart(6, "0").slice(-6)}`;
}

function mediaText(value: unknown): string {
  if (!isRecord(value)) {
    return "";
  }

  if (typeof value.text === "string") {
    return value.text;
  }

  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll("<", "\u003c");
}