
const CONFIG = {
  discordId: "444393598621057054",
  displayName: "kxx.z7",
  tagline: "Destiny called me",
  lanyardInvite: "https://discord.gg/lanyard"
};

const $ = (id) => document.getElementById(id);
const audio = $("siteMusic");
const PLAYLIST = [
  { src: "assets/song1.MP3", label: "TRACK 1 / 4", background: "assets/background1.gif" },
  { src: "assets/song2.MP3", label: "TRACK 2 / 4", background: "assets/background2.gif" },
  { src: "assets/song3.MP3", label: "TRACK 3 / 4", background: "assets/background3.gif" },
  { src: "assets/song4.MP3", label: "TRACK 4 / 4", background: "assets/background4.gif" }
];
let currentTrack = 0;
const enterScreen = $("enterScreen");
const toast = $("toast");
let toastTimer;
let heartbeatTimer;
let socket;
let lastPresence = null;
let discordProfileReady = false;
const enterStartedAt = Date.now();
const MIN_LOADING_MS = 1800;
const MAX_LOADING_MS = 10000;
let enterReadyTimer = null;

function finishProfileLoading() {
  if (discordProfileReady) return;
  discordProfileReady = true;
  const button = $("enterButton");
  const elapsed = Date.now() - enterStartedAt;
  const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
  clearTimeout(enterReadyTimer);
  setTimeout(() => {
    button.disabled = false;
    button.textContent = "click here to enter";
    button.setAttribute("aria-label", "Enter profile");
  }, remaining);
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setSoundIcon(playing) {
  $("soundIcon").innerHTML = playing
    ? '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'
    : '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>';
  $("soundToggle").setAttribute("aria-label", playing ? "Mute music" : "Play music");
}

function updateTrackLabel() {
  const label = $("trackLabel");
  if (label) label.textContent = PLAYLIST[currentTrack].label;

  document.documentElement.dataset.track = String(currentTrack + 1);
  const bg = document.querySelector(".bg-image");
  if (bg) {
    bg.style.backgroundImage = `linear-gradient(115deg,rgba(5,4,10,.22),rgba(3,2,7,.72)),url("${PLAYLIST[currentTrack].background}")`;
    bg.style.backgroundPosition = "center";
    bg.style.backgroundSize = "cover";
  }
}
async function playMusic() {
  try {
    if (!audio.src || !audio.src.endsWith(PLAYLIST[currentTrack].src)) {
      audio.src = PLAYLIST[currentTrack].src;
    }
    await audio.play();
    setSoundIcon(true);
  } catch {
    setSoundIcon(false);
    notify("Click play again to start the selected song.");
  }
}
function pauseMusic() { audio.pause(); setSoundIcon(false); }
async function changeTrack(step) {
  const wasPlaying = !audio.paused;
  currentTrack = (currentTrack + step + PLAYLIST.length) % PLAYLIST.length;
  audio.src = PLAYLIST[currentTrack].src;
  audio.load();
  updateTrackLabel();
  if (wasPlaying) await playMusic();
}
$("previousTrack").addEventListener("click", () => changeTrack(-1));
$("nextTrack").addEventListener("click", () => changeTrack(1));
audio.addEventListener("ended", () => changeTrack(1));
updateTrackLabel();

$("enterButton").addEventListener("click", async () => {
  if ($("enterButton").disabled) return;
  // Trigger the profile entrance choreography without the old purple ray burst.
  document.body.classList.remove("ui-awakening");
  void document.body.offsetWidth;
  document.body.classList.add("ui-awakening");
  enterScreen.classList.add("leaving");
  window.setTimeout(() => enterScreen.classList.add("hidden"), 420);
  await playMusic();
});
$("soundToggle").addEventListener("click", async () => {
  if (audio.paused) await playMusic(); else pauseMusic();
});
audio.addEventListener("play", () => setSoundIcon(true));
audio.addEventListener("pause", () => setSoundIcon(false));

// Subtle click ripples and glow feedback for the site's interactive UI.
document.addEventListener("click", (event) => {
  const target = event.target.closest("button, .presence-panel, .activity-card, .socials a");
  if (!target || target.id === "enterButton") return;
  const rect = target.getBoundingClientRect();
  const ripple = document.createElement("span");
  ripple.className = "ui-click-ripple";
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  target.appendChild(ripple);
  target.classList.add("ui-clicked");
  window.setTimeout(() => ripple.remove(), 750);
  window.setTimeout(() => target.classList.remove("ui-clicked"), 420);
}, { passive: true });

$("displayName").textContent = CONFIG.displayName;
$("discordName").textContent = CONFIG.displayName;
$("tagline").textContent = CONFIG.tagline;

function statusClass(status) {
  return ["online", "idle", "dnd"].includes(status) ? status : "";
}
function assetUrl(id, animated = false) {
  if (!id) return "";
  return `https://cdn.discordapp.com/app-assets/${id}.png`;
}
function setAvatar(url) {
  if (!url) return;
  $("heroAvatar").src = url;
  $("smallAvatar").src = url;
}
function showOffline(message = "Presence not available") {
  $("presenceStatus").textContent = message;
  $("presenceDetail").textContent = message === "Not tracked by Lanyard"
    ? "Join discord.gg/lanyard, then reload this page"
    : "Check your connection and Discord ID in script.js";
  const connectionLabel = $("connectionLabel");
  if (connectionLabel) connectionLabel.textContent = "PRESENCE UNAVAILABLE";
  $("statusDot").className = "status-dot";
}
function renderServerTag(user) {
  const tag = document.getElementById("serverTag");
  const text = document.getElementById("serverTagText");
  if (!tag || !text) return;

  // Some Discord profile payloads expose primary_guild; Lanyard may omit it.
  // Use live data when available and retain the site's existing REV fallback otherwise.
  const guild = user?.primary_guild || user?.primaryGuild || null;
  const enabled = guild && guild.identity_enabled !== false && guild.identityEnabled !== false;
  const guildTag = enabled && (guild.tag || guild.identity_tag || guild.identityTag);
  const guildId = guild?.identity_guild_id || guild?.id || guild?.guild_id;
  const badgeHash = guild?.badge || guild?.badge_hash || guild?.badgeHash;

  if (guildTag) {
    text.textContent = guildTag;
    tag.title = `Discord server tag ${guildTag}`;
    const icon = tag.querySelector(".server-tag-icon");
    if (icon && guildId && badgeHash) {
      const image = document.createElement("img");
      image.src = `https://cdn.discordapp.com/clan-badges/${encodeURIComponent(guildId)}/${encodeURIComponent(badgeHash)}.png?size=64`;
      image.alt = "";
      image.width = 14;
      image.height = 14;
      image.style.cssText = "width:14px;height:14px;object-fit:contain;display:block";
      image.onerror = () => { image.replaceWith(document.createTextNode("✦")); };
      icon.replaceChildren(image);
    } else if (icon) {
      icon.textContent = "✦";
    }
    tag.hidden = false;
  } else {
    // Preserve the configured badge instead of inventing a live tag when
    // the presence provider does not expose Discord's primary-guild fields.
    text.textContent = "REV";
    tag.title = "Discord server tag (fallback; live tag not provided by presence source)";
    const icon = tag.querySelector(".server-tag-icon");
    if (icon) icon.textContent = "✦";
  }
}

function renderPresence(p) {
  if (!p) return;
  finishProfileLoading();
  lastPresence = p;
  const user = p.discord_user || {};
  renderServerTag(user);
  // Keep the website identity linked to the Discord profile name.
  const name = user.global_name || user.display_name || user.username || CONFIG.displayName;
  $("displayName").textContent = name;
  $("discordName").textContent = name;
  document.title = `${name} — profile`;
  if (user.avatar && user.id) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    setAvatar(`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`);
  }
  // Discord avatar decorations are shown when the presence payload includes their asset ID.
  // The decoration is an overlay, so it doesn't replace or crop the profile avatar.
  const decoration = user.avatar_decoration_data?.asset || user.avatar_decoration;
  [$("heroDecoration"), $("smallDecoration")].forEach((node) => {
    if (!node) return;
    if (decoration) {
      node.src = `https://cdn.discordapp.com/avatar-decoration-presets/${encodeURIComponent(decoration)}.png?size=256`;
      node.hidden = false;
      node.onerror = () => { node.hidden = true; };
    } else {
      node.removeAttribute("src");
      node.hidden = true;
    }
  });
  const status = p.discord_status || "offline";
  $("presenceStatus").textContent = status === "dnd" ? "Do Not Disturb" : status.charAt(0).toUpperCase() + status.slice(1);
  $("statusDot").className = `status-dot ${statusClass(status)}`;
  const connectionLabel = $("connectionLabel");
  if (connectionLabel) connectionLabel.textContent = "LIVE LANYARD PRESENCE";

  const list = $("activityCard");
  const items = [];
  const esc = value => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
  // Lanyard provides Discord Rich Presence asset keys when the app shares them.
  // Prefer the activity's real image/logo; use the Spotify album cover for music.
  const activityImage = (activity) => {
    const assets = activity?.assets || {};
    const raw = assets.large_image || assets.small_image;
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    // Lanyard forwards externally hosted Rich Presence images as mp:external/... .
    if (raw.startsWith("mp:external/")) {
      const external = raw.slice("mp:external/".length);
      return `https://media.discordapp.net/external/${external}?width=256&height=256`;
    }
    if (raw.startsWith("mp:")) {
      const external = raw.slice(3).replace(/^\/+/, "");
      return `https://media.discordapp.net/${external}`;
    }
    // Spotify artwork is handled by the dedicated Spotify activity below.
    if (raw.startsWith("spotify:")) return "";
    if (activity.application_id) {
      const key = raw.replace(/^mp:/, "");
      return `https://cdn.discordapp.com/app-assets/${activity.application_id}/${encodeURIComponent(key)}.png?size=256`;
    }
    return "";
  };
  const durationText = (timestamps) => {
    const started = Number(timestamps?.start);
    if (!Number.isFinite(started) || started <= 0) return "";
    const seconds = Math.max(0, Math.floor(Date.now() / 1000 - started / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `Elapsed ${hours ? `${hours}h ` : ""}${minutes}m ${secs}s`;
  };
  const addItem = (icon, label, title, subtitle, imageUrl = "", smallImageUrl = "", extra = "") => {
    const iconContent = imageUrl
      ? `<img class="activity-logo" src="${esc(imageUrl)}" alt="${esc(title)} artwork" loading="lazy" onerror="this.remove();this.parentElement.classList.remove('has-logo');this.parentElement.textContent='${esc(icon)}';this.parentElement.classList.add('image-failed')">`
      : esc(icon);
    const smallContent = smallImageUrl
      ? `<img class="activity-small-logo" src="${esc(smallImageUrl)}" alt="Additional activity icon" loading="lazy" onerror="this.remove()">`
      : "";
    const safeSubtitle = subtitle ? `<div class="activity-subtitle">${esc(subtitle)}</div>` : "";
    const safeExtra = extra ? `<div class="activity-extra">${esc(extra)}</div>` : "";
    items.push(`<article class="activity-card${imageUrl ? " has-artwork" : ""}"><div class="activity-art${imageUrl ? " has-logo" : ""}">${iconContent}</div><div class="activity-copy"><div class="activity-label">${esc(label)}</div><div class="activity-title">${esc(title)}</div>${safeSubtitle}${safeExtra}</div>${smallContent}<span class="activity-pulse" aria-hidden="true"></span></article>`);
  };
  const spotify = p.spotify;
  if (spotify && p.listening_to_spotify) {
    addItem("♫", "LISTENING TO SPOTIFY", spotify.song || "Unknown track",
      [spotify.artist ? `Artist: ${spotify.artist}` : "", spotify.album ? `Album: ${spotify.album}` : ""].filter(Boolean).join(" · "), spotify.album_art_url || "", "", spotify.timestamps?.start ? durationText(spotify.timestamps) : "Live Spotify listening status");
  }
  const activities = (p.activities || []).filter(a => a.type !== 4 && !(p.listening_to_spotify && /spotify/i.test(a.name || "")));
  const labels = {0:"PLAYING",1:"STREAMING",2:"LISTENING",3:"WATCHING",5:"COMPETING"};
  const fallbackIcons = {0:"◈",1:"▣",2:"♫",3:"▣",5:"✦"};
  activities.forEach(activity => {
    const details = [activity.details, activity.state].filter(Boolean).join(" · ");
    const metadata = [
      durationText(activity.timestamps),
      activity.party?.size?.length === 2 ? `Party ${activity.party.size[0]}/${activity.party.size[1]}` : "",
      activity.type === 1 && activity.url ? "Live stream" : ""
    ].filter(Boolean).join(" · ");
    const largeImage = activityImage(activity);
    const smallImage = activity.assets?.small_image && activity.assets?.large_image
      ? activityImage({...activity, assets:{large_image:activity.assets.small_image, small_image:null}}) : "";
    addItem(fallbackIcons[activity.type] || "✦", labels[activity.type] || "ACTIVITY",
      activity.name || "Discord activity",
      details || "",
      largeImage, smallImage, metadata);
  });
  if (!items.length) addItem("✧", "CURRENT STATUS", "No activity right now", "No game or app is being shared");
  list.innerHTML = items.join("");
  $("presenceDetail").textContent = items.length ? `${items.length} active ${items.length === 1 ? "activity" : "activities"}` : "No active game or app";
}

function connectLanyard() {
  try {
    socket = new WebSocket("wss://api.lanyard.rest/socket");
  } catch {
    showOffline("Unable to connect");
    return;
  }
  socket.addEventListener("open", () => {
    $("presenceStatus").textContent = "Connected — syncing…";
  });
  socket.addEventListener("message", (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    if (msg.op === 1) {
      const interval = Number(msg.d?.heartbeat_interval) || 30000;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({op: 2, d: {subscribe_to_ids: [CONFIG.discordId]}}));
      }
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({op: 3}));
      }, interval);
    } else if (msg.op === 0 && msg.t === "INIT_STATE") {
      // Lanyard may send INIT_STATE as the presence object itself, or as a
      // map keyed by Discord ID depending on the gateway response shape.
      const data = msg.d;
      const p = data?.[CONFIG.discordId] ||
        (data?.discord_user?.id === CONFIG.discordId || data?.user_id === CONFIG.discordId ? data : null);
      if (p) {
        renderPresence(p);
      } else {
        showOffline("Not tracked by Lanyard");
        finishProfileLoading();
      }
    } else if (msg.op === 0 && msg.t === "PRESENCE_UPDATE") {
      const p = msg.d;
      if (p?.discord_user?.id === CONFIG.discordId || p?.user_id === CONFIG.discordId) renderPresence(p);
    }
  });
  socket.addEventListener("error", () => {
    $("presenceStatus").textContent = "Presence connection issue";
  });
  socket.addEventListener("close", () => {
    clearInterval(heartbeatTimer);
    if (navigator.onLine) {
      $("presenceStatus").textContent = "Reconnecting to Discord…";
      setTimeout(connectLanyard, 5000);
    }
  });
}
connectLanyard();

// REST fallback paints the current profile immediately while the live socket connects.
// The WebSocket remains responsible for real-time updates.
fetch(`https://api.lanyard.rest/v1/users/${CONFIG.discordId}`)
  .then(response => { if (!response.ok) throw new Error("Presence unavailable"); return response.json(); })
  .then(result => { if (result?.success && result?.data && !lastPresence) renderPresence(result.data); })
  .catch(() => { /* Socket connection can still succeed; keep the page usable offline. */ });

// Keep the intro visible while Discord presence has a chance to arrive.
// A hard timeout prevents the page from being blocked if Lanyard is unavailable.
const enterButton = $("enterButton");
enterButton.disabled = true;
enterButton.textContent = "SYNCING DISCORD...";
enterButton.setAttribute("aria-live", "polite");
enterReadyTimer = setTimeout(() => finishProfileLoading(), MAX_LOADING_MS);


// Lightweight ambient particles and audio-reactive-style visualizer animation.
(function initAmbientEffects() {
  const host = document.getElementById("particles");
  if (host && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (let i = 0; i < 28; i++) {
      const particle = document.createElement("span");
      particle.className = "particle";
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.top = `${Math.random() * 100}%`;
      particle.style.setProperty("--duration", `${9 + Math.random() * 13}s`);
      particle.style.setProperty("--delay", `${-Math.random() * 18}s`);
      host.appendChild(particle);
    }
  }
  const visualizer = document.getElementById("musicVisualizer");
  if (visualizer) {
    const update = () => visualizer.classList.toggle("playing", !audio.paused);
    audio.addEventListener("play", update);
    audio.addEventListener("pause", update);
    update();
  }
})();


// Basic deterrents against casual context-menu and shortcut inspection.
// These are not security controls; browser devtools can still be opened other ways.
document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  notify("NIGGA");
});
document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  const blocked = key === "f12" ||
    (event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key)) ||
    (event.ctrlKey && ["u", "s"].includes(key));
  if (blocked) {
    event.preventDefault();
    event.stopPropagation();
    notify("That shortcut is disabled on this page.");
  }
}, true);
