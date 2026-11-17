import { t } from "./i18n.js";

const app = document.querySelector("#app");
const routes = [
  "overview",
  "commands",
  "members",
  "browse",
  "logs",
  "audit",
  "actions",
  "feed",
  "settings",
];

let lang = localStorage.getItem("draeven.lang") === "en" ? "en" : "nl";
let sessionUser = null;
let oauthConfigured = false;
let eventSource;
let statusCache = null;
let uptimeTimer;
let syncState = null;

boot();

async function boot() {
  const session = await api("/api/session").catch(() => ({ oauthConfigured: false, user: null }));
  oauthConfigured = session.oauthConfigured === true;
  sessionUser = session.user;
  const authError = new URLSearchParams(location.search).get("authError");
  if (!sessionUser) {
    renderLogin(authError);
    return;
  }
  if (authError) history.replaceState({}, "", location.pathname);
  try {
    statusCache = await api("/api/status");
    syncState = statusCache.sync ?? null;
    lang = statusCache.settings?.language === "en" ? "en" : "nl";
    localStorage.setItem("draeven.lang", lang);
  } catch {
    statusCache = null;
  }
  route();
  window.addEventListener("hashchange", route);
}

function route() {
  const page = (location.hash.replace(/^#\/?/, "") || "overview").split("?")[0];
  const active = routes.includes(page) ? page : "overview";
  renderShell(active);
}

function renderLogin(authError) {
  app.innerHTML = `
    <main class="login">
      <section class="login-card">
        <p class="brand-sub">${escapeHtml(t(lang, "brandSub"))}</p>
        <h1>${escapeHtml(t(lang, "brand"))}</h1>
        ${authError ? `<p class="error-banner">${escapeHtml(authError)}</p>` : ""}
        <p>${escapeHtml(oauthConfigured ? t(lang, "loginBody") : t(lang, "oauthMissing"))}</p>
        ${
          oauthConfigured
            ? `<p class="row"><a class="btn primary" href="/auth/login">${escapeHtml(t(lang, "loginCta"))}</a></p>`
            : ""
        }
      </section>
    </main>
  `;
}

function renderShell(page) {
  closeFeed();
  app.innerHTML = `
    <div class="layout">
      <aside class="side">
        <div>
          <p class="brand-mark">${escapeHtml(t(lang, "brand"))}</p>
          <p class="brand-sub">${escapeHtml(t(lang, "brandSub"))}</p>
          <p id="sync-pill" class="pill ${syncState?.watch ? "ok" : "warn"}">${escapeHtml(syncLabel())}</p>
        </div>
        <nav class="nav">
          ${routes
            .map((name) => {
              const key = `nav${name[0].toUpperCase()}${name.slice(1)}`;
              return `<a href="#/${name}" class="${name === page ? "active" : ""}">${escapeHtml(t(lang, key))}</a>`;
            })
            .join("")}
        </nav>
        <div class="side-user">
          <div class="who">
            ${sessionUser?.avatar ? `<img src="${escapeHtml(sessionUser.avatar)}" alt="" />` : ""}
            <div>
              <div>${escapeHtml(sessionUser?.name ?? "—")}</div>
              <div class="mono muted">${escapeHtml(sessionUser?.id ?? "")}</div>
            </div>
          </div>
          <button type="button" class="btn" id="logout">${escapeHtml(t(lang, "logout"))}</button>
        </div>
      </aside>
      <main class="content" id="page"></main>
    </div>
  `;
  document.querySelector("#logout")?.addEventListener("click", async () => {
    await api("/auth/logout", { method: "POST" });
    location.href = "/";
  });
  const mount = document.querySelector("#page");
  if (page === "overview") return void renderOverview(mount);
  if (page === "commands") return void renderCommands(mount);
  if (page === "members") return void renderMembers(mount);
  if (page === "browse") return void renderBrowse(mount);
  if (page === "logs") return void renderLogs(mount);
  if (page === "audit") return void renderAudit(mount);
  if (page === "actions") return void renderActions(mount);
  if (page === "feed") return void renderFeed(mount);
  if (page === "settings") return void renderSettings(mount);
}

function syncLabel() {
  if (!syncState) return t(lang, "sync");
  const watch = syncState.watch ? t(lang, "watchOn") : t(lang, "watchOff");
  const when = syncState.lastCommandsReloadAt
    ? new Date(syncState.lastCommandsReloadAt).toLocaleTimeString()
    : "—";
  return `${watch} · ${syncState.commandCount} · ${when}`;
}

async function renderOverview(mount) {
  const status = await api("/api/status");
  statusCache = status;
  syncState = status.sync ?? syncState;
  updateSyncPill();
  clearInterval(uptimeTimer);
  mount.innerHTML = `
    ${pageTitle(t(lang, "navOverview"))}
    <section class="panel">
      <div class="identity">
        ${status.user?.icon ? `<img src="${escapeHtml(status.user.icon)}" alt="" />` : ""}
        <div>
          <p class="name">${escapeHtml(status.user?.name ?? "—")}</p>
          <p class="mono muted">${escapeHtml(status.user?.id ?? "—")}</p>
        </div>
      </div>
      <dl class="metrics">
        <div><dt>${escapeHtml(t(lang, "uptime"))}</dt><dd id="uptime">—</dd></div>
        <div><dt>${escapeHtml(t(lang, "commands"))}</dt><dd>${escapeHtml(String(status.commandCount ?? 0))}</dd></div>
        <div><dt>${escapeHtml(t(lang, "guild"))}</dt><dd class="mono">${escapeHtml(status.guildId ?? "—")}</dd></div>
        <div><dt>${escapeHtml(t(lang, "sync"))}</dt><dd>${escapeHtml(syncLabel())}</dd></div>
      </dl>
    </section>
  `;
  const tick = () => {
    const el = document.querySelector("#uptime");
    if (el) el.textContent = formatUptime(Date.now() - (status.startedAt ?? Date.now()));
  };
  tick();
  uptimeTimer = setInterval(tick, 1000);
}

async function renderCommands(mount) {
  const data = await api("/api/commands");
  const list = data.commands ?? [];
  mount.innerHTML = `${pageTitle(t(lang, "navCommands"))}<section class="panel"><div class="list" id="box"></div></section>`;
  const box = document.querySelector("#box");
  if (!list.length) {
    box.innerHTML = `<p class="muted">${escapeHtml(t(lang, "emptyCommands"))}</p>`;
    return;
  }
  for (const entry of list) {
    const item = document.createElement("article");
    item.className = "list-item";
    const extras = [...(entry.options ?? []).map((n) => `opt:${n}`), ...(entry.subs ?? []).map((n) => `sub:${n}`)]
      .slice(0, 8)
      .join(" · ");
    item.innerHTML = `
      <div><span class="tag">${escapeHtml(entry.kind)}</span><strong>/${escapeHtml(entry.name)}</strong></div>
      <div class="muted">${escapeHtml(entry.description || "")}</div>
      ${extras ? `<div class="mono muted">${escapeHtml(extras)}</div>` : ""}
    `;
    box.append(item);
  }
}

async function renderMembers(mount) {
  mount.innerHTML = `${pageTitle(t(lang, "navMembers"), t(lang, "refresh"))}<section class="panel"><div class="list" id="box"></div></section>`;
  const load = async () => {
    const box = document.querySelector("#box");
    try {
      const data = await api("/api/members");
      const members = data.members ?? [];
      box.innerHTML = "";
      if (!members.length) {
        box.innerHTML = `<p class="muted">${escapeHtml(t(lang, "emptyMembers"))}</p>`;
        return;
      }
      for (const member of members) {
        const item = document.createElement("article");
        item.className = "list-item";
        item.innerHTML = `
          <div class="row">
            ${member.avatar ? `<img src="${escapeHtml(member.avatar)}" width="28" height="28" style="border-radius:8px" alt="" />` : ""}
            <strong>${escapeHtml(member.nick || member.name)}</strong>
            ${member.bot ? `<span class="tag">bot</span>` : ""}
          </div>
          <div class="mono muted">${escapeHtml(member.id)}</div>
        `;
        box.append(item);
      }
    } catch (error) {
      box.innerHTML = `<p class="muted">${escapeHtml(error.message || t(lang, "needGuild"))}</p>`;
    }
  };
  mount.querySelector("[data-action=refresh]")?.addEventListener("click", () => void load());
  await load();
}

async function renderBrowse(mount) {
  mount.innerHTML = `
    ${pageTitle(t(lang, "navBrowse"), t(lang, "refresh"))}
    <div class="grid two">
      <section class="panel"><h2>Channels</h2><div class="list" id="channels"></div></section>
      <section class="panel"><h2>Roles</h2><div class="list" id="roles"></div></section>
    </div>
  `;
  const load = async () => {
    try {
      const [channels, roles] = await Promise.all([api("/api/channels"), api("/api/roles")]);
      fillSimpleList("#channels", channels.channels ?? [], (c) => `#${c.name}`, (c) => `${c.id} · type ${c.type}`);
      fillSimpleList("#roles", roles.roles ?? [], (r) => r.name, (r) => r.id);
    } catch (error) {
      document.querySelector("#channels").innerHTML = `<p class="muted">${escapeHtml(error.message || t(lang, "emptyBrowse"))}</p>`;
      document.querySelector("#roles").innerHTML = "";
    }
  };
  mount.querySelector("[data-action=refresh]")?.addEventListener("click", () => void load());
  await load();
}

function fillSimpleList(selector, rows, title, sub) {
  const box = document.querySelector(selector);
  box.innerHTML = "";
  if (!rows.length) {
    box.innerHTML = `<p class="muted">${escapeHtml(t(lang, "emptyBrowse"))}</p>`;
    return;
  }
  for (const row of rows) {
    const item = document.createElement("article");
    item.className = "list-item";
    item.innerHTML = `<div><strong>${escapeHtml(title(row))}</strong></div><div class="mono muted">${escapeHtml(sub(row))}</div>`;
    box.append(item);
  }
}

async function renderLogs(mount) {
  mount.innerHTML = `${pageTitle(t(lang, "navLogs"), t(lang, "refresh"))}<section class="panel"><div class="list" id="box"></div></section>`;
  const load = async () => {
    const data = await api("/api/logs");
    const box = document.querySelector("#box");
    box.innerHTML = "";
    const logs = data.logs ?? [];
    if (!logs.length) {
      box.innerHTML = `<p class="muted">${escapeHtml(t(lang, "emptyLogs"))}</p>`;
      return;
    }
    for (const line of logs) {
      const item = document.createElement("article");
      item.className = "list-item";
      item.innerHTML = `
        <div><span class="tag ${escapeHtml(line.level)}">${escapeHtml(line.level)}</span><strong>${escapeHtml(line.source)}</strong> · <span class="mono muted">${escapeHtml(new Date(line.at).toLocaleString())}</span></div>
        <div>${escapeHtml(line.message)}</div>
      `;
      box.append(item);
    }
  };
  mount.querySelector("[data-action=refresh]")?.addEventListener("click", () => void load());
  await load();
}

async function renderAudit(mount) {
  mount.innerHTML = `${pageTitle(t(lang, "navAudit"), t(lang, "refresh"))}<section class="panel"><div class="list" id="box"></div></section>`;
  const load = async () => {
    const data = await api("/api/audit");
    const box = document.querySelector("#box");
    box.innerHTML = "";
    const rows = data.audit ?? [];
    if (!rows.length) {
      box.innerHTML = `<p class="muted">${escapeHtml(t(lang, "emptyAudit"))}</p>`;
      return;
    }
    for (const row of rows) {
      const item = document.createElement("article");
      item.className = "list-item";
      item.innerHTML = `
        <div><span class="tag action">${escapeHtml(row.action)}</span><strong>${escapeHtml(row.actorName)}</strong> · <span class="mono muted">${escapeHtml(new Date(row.at).toLocaleString())}</span></div>
        <div class="mono muted">${escapeHtml(row.detail || row.actorId)}</div>
      `;
      box.append(item);
    }
  };
  mount.querySelector("[data-action=refresh]")?.addEventListener("click", () => void load());
  await load();
}

async function renderActions(mount) {
  mount.innerHTML = `
    ${pageTitle(t(lang, "navActions"))}
    <div class="grid two">
      <section class="panel">
        <h2>${escapeHtml(t(lang, "send"))}</h2>
        <form class="form" id="send-form">
          <label><span>${escapeHtml(t(lang, "channelId"))}</span><input name="channelId" required /></label>
          <label><span>${escapeHtml(t(lang, "message"))}</span><textarea name="text" rows="3" maxlength="2000" required></textarea></label>
          <div class="row"><button class="btn primary" type="submit">${escapeHtml(t(lang, "send"))}</button><p class="status" data-status></p></div>
        </form>
      </section>
      <section class="panel">
        <h2>${escapeHtml(t(lang, "kick"))} / ${escapeHtml(t(lang, "ban"))} / ${escapeHtml(t(lang, "timeout"))}</h2>
        <form class="form" id="mod-form">
          <label><span>${escapeHtml(t(lang, "userId"))}</span><input name="userId" required /></label>
          <label><span>${escapeHtml(t(lang, "reason"))}</span><input name="reason" /></label>
          <label><span>${escapeHtml(t(lang, "seconds"))}</span><input name="seconds" type="number" min="0" value="600" /></label>
          <div class="row">
            <button class="btn" type="button" data-action="kick">${escapeHtml(t(lang, "kick"))}</button>
            <button class="btn danger" type="button" data-action="ban">${escapeHtml(t(lang, "ban"))}</button>
            <button class="btn" type="button" data-action="timeout">${escapeHtml(t(lang, "timeout"))}</button>
          </div>
          <p class="status" data-status></p>
        </form>
      </section>
      <section class="panel">
        <h2>${escapeHtml(t(lang, "pin"))} / ${escapeHtml(t(lang, "react"))}</h2>
        <form class="form" id="msg-form">
          <label><span>${escapeHtml(t(lang, "channelId"))}</span><input name="channelId" required /></label>
          <label><span>${escapeHtml(t(lang, "messageId"))}</span><input name="messageId" required /></label>
          <label><span>${escapeHtml(t(lang, "emoji"))}</span><input name="emoji" value="👍" /></label>
          <div class="row">
            <button class="btn" type="button" data-action="pin">${escapeHtml(t(lang, "pin"))}</button>
            <button class="btn" type="button" data-action="react">${escapeHtml(t(lang, "react"))}</button>
          </div>
          <p class="status" data-status></p>
        </form>
      </section>
      <section class="panel">
        <h2>${escapeHtml(t(lang, "purge"))}</h2>
        <form class="form" id="purge-form">
          <label><span>${escapeHtml(t(lang, "channelId"))}</span><input name="channelId" required /></label>
          <label><span>${escapeHtml(t(lang, "count"))}</span><input name="count" type="number" min="2" max="100" value="10" /></label>
          <div class="row"><button class="btn danger" type="submit">${escapeHtml(t(lang, "purge"))}</button><p class="status" data-status></p></div>
        </form>
      </section>
    </div>
  `;

  bindForm("#send-form", async (data) =>
    api("/api/actions/send", { method: "POST", body: JSON.stringify({ channelId: data.channelId, text: data.text }) })
  );
  document.querySelector("#mod-form")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const form = new FormData(document.querySelector("#mod-form"));
    const status = document.querySelector("#mod-form [data-status]");
    const action = button.getAttribute("data-action");
    status.textContent = "…";
    try {
      const payload = { userId: String(form.get("userId") || ""), reason: String(form.get("reason") || "") || undefined };
      if (action === "timeout") {
        payload.seconds = Number(form.get("seconds") || 0);
        await api("/api/actions/timeout", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api(`/api/actions/${action}`, { method: "POST", body: JSON.stringify(payload) });
      }
      status.textContent = "OK";
    } catch (error) {
      status.textContent = error.message;
    }
  });
  document.querySelector("#msg-form")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const form = new FormData(document.querySelector("#msg-form"));
    const status = document.querySelector("#msg-form [data-status]");
    const action = button.getAttribute("data-action");
    status.textContent = "…";
    try {
      await api(`/api/actions/${action}`, {
        method: "POST",
        body: JSON.stringify({
          channelId: String(form.get("channelId") || ""),
          messageId: String(form.get("messageId") || ""),
          emoji: String(form.get("emoji") || ""),
        }),
      });
      status.textContent = "OK";
    } catch (error) {
      status.textContent = error.message;
    }
  });
  bindForm("#purge-form", async (data) =>
    api("/api/actions/purge", {
      method: "POST",
      body: JSON.stringify({ channelId: data.channelId, count: Number(data.count) }),
    })
  );
}

function bindForm(selector, run) {
  document.querySelector(selector)?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const status = event.target.querySelector("[data-status]");
    status.textContent = "…";
    try {
      const data = Object.fromEntries(form.entries());
      await run(data);
      status.textContent = "OK";
      event.target.reset();
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

function renderFeed(mount) {
  mount.innerHTML = `${pageTitle(t(lang, "navFeed"))}<section class="panel"><div class="list" id="feed-body"><p class="muted">${escapeHtml(t(lang, "emptyFeed"))}</p></div></section>`;
  const box = document.querySelector("#feed-body");
  eventSource = new EventSource("/api/events");
  eventSource.onmessage = (message) => {
    try {
      const payload = JSON.parse(message.data);
      if (payload.sync) {
        syncState = payload.sync;
        updateSyncPill();
      }
      if (payload.type === "snapshot") {
        box.innerHTML = "";
        for (const event of [...(payload.events ?? [])].reverse()) prependFeed(box, event);
        if (!box.children.length) box.innerHTML = `<p class="muted">${escapeHtml(t(lang, "emptyFeed"))}</p>`;
        return;
      }
      if (payload.type === "event" && payload.event) {
        if (box.querySelector(".muted")) box.innerHTML = "";
        prependFeed(box, payload.event);
      }
    } catch {
      /* ignore */
    }
  };
}

function prependFeed(box, event) {
  const item = document.createElement("article");
  item.className = "list-item";
  item.innerHTML = `
    <div><span class="tag">${escapeHtml(event.name)}</span><strong class="mono muted">${escapeHtml(new Date(event.at).toLocaleTimeString())}</strong></div>
    <div>${escapeHtml(event.summary)}</div>
  `;
  box.prepend(item);
  while (box.children.length > 120) box.lastElementChild?.remove();
}

async function renderSettings(mount) {
  const status = statusCache ?? (await api("/api/status"));
  const settings = status.settings ?? {};
  let guilds = [];
  try {
    guilds = (await api("/api/guilds")).guilds ?? [];
  } catch {
    guilds = [];
  }

  mount.innerHTML = `
    ${pageTitle(t(lang, "navSettings"))}
    <section class="panel">
      <form class="form" id="settings-form">
        <label>
          <span>${escapeHtml(t(lang, "language"))}</span>
          <select name="language">
            <option value="nl" ${settings.language !== "en" ? "selected" : ""}>Nederlands</option>
            <option value="en" ${settings.language === "en" ? "selected" : ""}>English</option>
          </select>
        </label>
        <label>
          <span>${escapeHtml(t(lang, "selectedGuild"))}</span>
          <select name="selectedGuildId">
            <option value="">—</option>
            ${guilds
              .map(
                (guild) =>
                  `<option value="${escapeHtml(guild.id)}" ${
                    (settings.selectedGuildId || status.guildId) === guild.id ? "selected" : ""
                  }>${escapeHtml(guild.name)}</option>`
              )
              .join("")}
          </select>
        </label>
        <label>
          <span>${escapeHtml(t(lang, "prefix"))}</span>
          <input name="prefix" value="${escapeHtml(settings.prefix ?? "!")}" maxlength="8" />
          <span class="hint">${escapeHtml(t(lang, "prefixHint"))}</span>
        </label>
        <label>
          <span>${escapeHtml(t(lang, "presenceText"))}</span>
          <input name="presenceText" value="${escapeHtml(settings.presenceText ?? "")}" maxlength="64" />
        </label>
        <label>
          <span>${escapeHtml(t(lang, "presenceStatus"))}</span>
          <select name="presenceStatus">
            ${["online", "idle", "dnd", "invisible"]
              .map(
                (value) =>
                  `<option value="${value}" ${settings.presenceStatus === value ? "selected" : ""}>${value}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="row">
          <input name="showBotMessagesInFeed" type="checkbox" ${settings.showBotMessagesInFeed ? "checked" : ""} />
          <span>${escapeHtml(t(lang, "showBots"))}</span>
        </label>
        <label>
          <span>${escapeHtml(t(lang, "feedLimit"))}</span>
          <input name="feedLimit" type="number" min="50" max="1000" value="${escapeHtml(String(settings.feedLimit ?? 300))}" />
        </label>
        <div class="row">
          <button class="btn primary" type="submit">${escapeHtml(t(lang, "save"))}</button>
          <p class="status" id="settings-status"></p>
        </div>
      </form>
    </section>
  `;

  document.querySelector("#settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const payload = {
      language: String(form.get("language") || "nl"),
      prefix: String(form.get("prefix") || "!"),
      presenceText: String(form.get("presenceText") || ""),
      presenceStatus: String(form.get("presenceStatus") || "online"),
      showBotMessagesInFeed: form.get("showBotMessagesInFeed") === "on",
      feedLimit: Number(form.get("feedLimit") || 300),
      selectedGuildId: String(form.get("selectedGuildId") || "") || null,
    };
    const statusEl = document.querySelector("#settings-status");
    statusEl.textContent = "…";
    try {
      const result = await api("/api/settings", { method: "PUT", body: JSON.stringify(payload) });
      lang = result.settings?.language === "en" ? "en" : "nl";
      localStorage.setItem("draeven.lang", lang);
      statusCache = { ...(statusCache ?? {}), settings: result.settings, guildId: result.settings?.selectedGuildId };
      statusEl.textContent = t(lang, "saved");
      route();
    } catch (error) {
      statusEl.textContent = error.message;
    }
  });
}

function pageTitle(title, refreshLabel) {
  return `
    <div class="page-head">
      <div><h1>${escapeHtml(title)}</h1></div>
      ${refreshLabel ? `<button type="button" class="btn" data-action="refresh">${escapeHtml(refreshLabel)}</button>` : ""}
    </div>
  `;
}

function updateSyncPill() {
  const pill = document.querySelector("#sync-pill");
  if (!pill) return;
  pill.textContent = syncLabel();
  pill.className = `pill ${syncState?.watch ? "ok" : "warn"}`;
}

function closeFeed() {
  if (eventSource) {
    eventSource.close();
    eventSource = undefined;
  }
}

async function api(path, init = {}) {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (response.status === 401) {
    location.href = "/";
    throw new Error("Unauthorized");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
  return body;
}

function formatUptime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

window.addEventListener("beforeunload", closeFeed);
