/*************************************************
 * CONFIG
 *************************************************/

const TWITCH_API_URL = "/api/twitch.php";
const TWITCH_CHANNEL_URL = "https://twitch.tv/zethnos";

const STREAM_TIMEZONE = "America/New_York";
const TIMEZONE_LABEL = "EST";

/*************************************************
 * SCHEDULE (STATIC, YOUR CONTROL)
 * 0 = Sunday, 6 = Saturday
 *************************************************/

const SCHEDULE = [
  { day: 1, time: "8:00", durationHours: 4 }, // Monday
  { day: 3, time: "8:00", durationHours: 4 }, // Wednesday
  { day: 5, time: "8:00", durationHours: 4 }  // Friday
];

/*************************************************
 * GLOBAL STATE
 *************************************************/

let TWITCH_STATE = {
  live: false,
  followers: 0,
  started_at: null
};

let countdownInterval = null;

/*************************************************
 * TWITCH API
 *************************************************/

async function loadTwitch() {
  try {
    const res = await fetch(TWITCH_API_URL);
    const data = await res.json();

    TWITCH_STATE = data;

    updateTwitchUI();
    updateScheduleUI();
  } catch (err) {
    console.error("Twitch API error:", err);
  }
}

function updateTwitchUI() {
  const followersEl = document.getElementById("followers");
  const statusEl = document.getElementById("status");

  if (followersEl && TWITCH_STATE.followers != null) {
    followersEl.textContent = TWITCH_STATE.followers.toLocaleString();
  }

  if (statusEl) {
    statusEl.textContent = TWITCH_STATE.live ? "LIVE 🔴" : "Offline";
  }
}

/*************************************************
 * SCHEDULE LOGIC
 *************************************************/

function getNextStreamDate(now = new Date()) {
  for (let i = 0; i < 7; i++) {
    const check = new Date(now);
    check.setDate(now.getDate() + i);

    const daySchedule = SCHEDULE.find(
      s => s.day === check.getDay()
    );

    if (!daySchedule) continue;

    const [hour, minute] = daySchedule.time.split(":").map(Number);
    const streamDate = new Date(check);
    streamDate.setHours(hour, minute, 0, 0);

    if (streamDate > now) {
      return streamDate;
    }
  }
  return null;
}

function updateScheduleUI() {
  const listEl = document.getElementById("schedule-list");
  const nextStreamEl = document.getElementById("next-stream-time");
  const countdownEl = document.getElementById("countdown");

  if (!listEl) return;

  listEl.innerHTML = "";

  const now = new Date();
  const today = now.getDay();
  const isLive = TWITCH_STATE.live === true;

  SCHEDULE.forEach(entry => {
    const li = document.createElement("li");
    li.className = "list-group-item";

    const dayName = new Date(2024, 0, entry.day + 7)
      .toLocaleDateString("en-US", { weekday: "long" });

    const link = document.createElement("a");
    link.href = TWITCH_CHANNEL_URL;
    link.target = "_blank";

    link.innerHTML = `
      <span>${dayName}</span>
      <span>${entry.time} ${TIMEZONE_LABEL}</span>
    `;

    if (entry.day === today && isLive) {
      li.classList.add("live");

      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "LIVE";
      link.appendChild(badge);
    }

    li.appendChild(link);
    listEl.appendChild(li);
  });

  // NEXT STREAM / LIVE OVERRIDE
  if (isLive) {
    if (nextStreamEl) nextStreamEl.textContent = "Happening now 🔴";
    if (countdownEl) countdownEl.textContent = "Live on Twitch";
    clearInterval(countdownInterval);
    return;
  }

  const nextStream = getNextStreamDate(now);

  if (nextStream && nextStreamEl) {
    nextStreamEl.textContent =
      nextStream.toLocaleString("en-US", {
        weekday: "long",
        hour: "numeric",
        minute: "2-digit"
      }) + ` ${TIMEZONE_LABEL}`;

    startCountdown(nextStream);
  } else {
    if (nextStreamEl) nextStreamEl.textContent = "No upcoming streams";
    if (countdownEl) countdownEl.textContent = "";
  }
}

/*************************************************
 * COUNTDOWN
 *************************************************/

function startCountdown(targetDate) {
  const countdownEl = document.getElementById("countdown");
  if (!countdownEl) return;

  clearInterval(countdownInterval);

  countdownInterval = setInterval(() => {
    const now = new Date();
    const diff = targetDate - now;

    if (diff <= 0) {
      clearInterval(countdownInterval);
      countdownEl.textContent = "Starting soon…";
      return;
    }

    const hours = Math.floor(diff / 36e5);
    const minutes = Math.floor((diff % 36e5) / 6e4);

    countdownEl.textContent =
      `Starts in ${hours}h ${minutes}m`;
  }, 1000);
}

/*************************************************
 * INIT
 *************************************************/

document.addEventListener("DOMContentLoaded", () => {
  loadTwitch();
  setInterval(loadTwitch, 60000);
});