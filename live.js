/*************************************************
 * CONFIG
 *************************************************/

const TWITCH_API_URL = "/api/twitch.php"; // Your PHP endpoint
const TWITCH_CHANNEL_URL = "https://twitch.tv/zethnos";
const TIMEZONE_LABEL = "EST"; // Optional, just for display

/*************************************************
 * GLOBAL STATE
 *************************************************/

let TWITCH_STATE = {
  live: false,
  category: "",
  schedule: [], // Will hold Twitch schedule entries
  followers: 0,
  viewers: 0,
};

let countdownInterval = null;

/*************************************************
 * TWITCH API
 *************************************************/

async function loadTwitch() {
  try {
    const res = await fetch(TWITCH_API_URL);
    const data = await res.json();

    TWITCH_STATE = {
      live: data.live || false,
      category: data.category || "",
      schedule: Array.isArray(data.schedule) ? data.schedule : [],
      followers: data.followers || 0,
      viewers: data.viewers || 0,
    };

    updateUI();
  } catch (err) {
    console.error("Twitch API error:", err);
  }
}

/*************************************************
 * SCHEDULE LOGIC
 *************************************************/

function getCurrentWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday...
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
}

function getWeeklySchedule() {
  const { startOfWeek, endOfWeek } = getCurrentWeekRange();

  if (!TWITCH_STATE.schedule || !Array.isArray(TWITCH_STATE.schedule)) return [];

  return TWITCH_STATE.schedule
    .map(entry => ({ ...entry, startDate: new Date(entry.start_time) }))
    .filter(entry => entry.startDate.getTime() >= startOfWeek.getTime() &&
                     entry.startDate.getTime() <= endOfWeek.getTime())
    .sort((a, b) => a.startDate - b.startDate);
}

function getNextStream() {
  const now = new Date();
  return getWeeklySchedule().find(entry => entry.startDate > now) || null;
}

/*************************************************
 * UI UPDATE
 *************************************************/

function updateUI() {
  // Optional elements
  const nextStreamEl = document.getElementById("next-stream-time");
  const countdownEl = document.getElementById("countdown");
  const scheduleEl = document.getElementById("schedule-list");
  const followersEl = document.getElementById("followers");
  const statusEl = document.getElementById("status");

  // Update followers if element exists
  if (followersEl) {
    followersEl.textContent = TWITCH_STATE.followers.toLocaleString();
  }

  // Update live status if element exists
  if (statusEl) {
    statusEl.textContent = TWITCH_STATE.live
      ? `LIVE NOW 🔴 (${TWITCH_STATE.viewers} viewers)`
      : "Offline";
  }

  // Update schedule if element exists
  if (scheduleEl) {
    scheduleEl.innerHTML = "";

    const weeklySchedule = getWeeklySchedule();
    if (weeklySchedule.length === 0) {
      const li = document.createElement("li");
      li.className = "list-group-item";
      li.textContent = "No streams scheduled this week";
      scheduleEl.appendChild(li);
    } else {
      weeklySchedule.forEach(entry => {
        const li = document.createElement("li");
        li.className = "list-group-item";

        const startDate = entry.startDate;
        const dayName = startDate.toLocaleDateString("en-US", { weekday: "long" });
        const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

        li.innerHTML = `<a href="${TWITCH_CHANNEL_URL}" target="_blank">
          <span>${dayName}</span>  <span>${timeStr} ${TIMEZONE_LABEL}</span>
        </a>`;

        scheduleEl.appendChild(li);
      });
    }
  }

  // Update next stream & countdown if elements exist
  clearInterval(countdownInterval);

  const nextStream = getNextStream();

  if (nextStreamEl) {
    if (TWITCH_STATE.live) {
      nextStreamEl.textContent = "LIVE NOW 🔴";
    } else if (!nextStream) {
      nextStreamEl.textContent = "No upcoming streams this week";
    } else {
      nextStreamEl.textContent = `${nextStream.startDate.toLocaleString("en-US", {
        weekday: "long",
        hour: "numeric",
        minute: "2-digit"
      })} ${TIMEZONE_LABEL}`;
    }
  }

  if (countdownEl && nextStream && !TWITCH_STATE.live) {
    countdownInterval = setInterval(() => {
      const now = new Date();
      const diff = nextStream.startDate - now;

      if (diff <= 0) {
        clearInterval(countdownInterval);
        countdownEl.textContent = "Starting soon…";
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      countdownEl.textContent =
        `Starts in ${days > 0 ? days + "d " : ""}${hours}h ${minutes}m ${seconds}s`;
    }, 1000);
  }
}

/*************************************************
 * INIT
 *************************************************/

document.addEventListener("DOMContentLoaded", () => {
  loadTwitch();
  setInterval(loadTwitch, 60000); // Refresh every 60s
});
