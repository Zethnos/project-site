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
      schedule: data.schedule || [],
    };

    updateUI();
  } catch (err) {
    console.error("Twitch API error:", err);
  }
}

/*************************************************
 * SCHEDULE LOGIC
 *************************************************/

// Get the start and end of the current week (Sunday–Saturday)
function getCurrentWeekRange() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ...
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return { startOfWeek, endOfWeek };
}

// Filter schedule to this week only
function getWeeklySchedule() {
  const { startOfWeek, endOfWeek } = getCurrentWeekRange();
  return TWITCH_STATE.schedule
    .map(entry => ({ ...entry, startDate: new Date(entry.start_time) }))
    .filter(entry => entry.startDate >= startOfWeek && entry.startDate <= endOfWeek)
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
  const nextStreamEl = document.getElementById("next-stream-time");
  const countdownEl = document.getElementById("countdown");
  const scheduleEl = document.getElementById("schedule-list");

  if (!nextStreamEl || !countdownEl || !scheduleEl) return;

  // Clear schedule
  scheduleEl.innerHTML = "";

  // Populate schedule from this week only
  const weeklySchedule = getWeeklySchedule();
  weeklySchedule.forEach(entry => {
    const li = document.createElement("li");
    li.className = "list-group-item";

    const startDate = entry.startDate;
    const dayName = startDate.toLocaleDateString("en-US", { weekday: "long" });
    const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    li.innerHTML = `<a href="${TWITCH_CHANNEL_URL}" target="_blank">
      <span>${dayName}</span> - <span>${timeStr} ${TIMEZONE_LABEL}</span>
    </a>`;

    scheduleEl.appendChild(li);
  });

  // Live vs next stream
  clearInterval(countdownInterval);

  if (TWITCH_STATE.live) {
    nextStreamEl.textContent = "LIVE NOW 🔴";
    countdownEl.textContent = TWITCH_STATE.category
      ? `Streaming: ${TWITCH_STATE.category}`
      : "Live on Twitch";
    return;
  }

  const nextStream = getNextStream();
  if (!nextStream) {
    nextStreamEl.textContent = "No upcoming streams this week";
    countdownEl.textContent = "";
    return;
  }

  nextStreamEl.textContent = `Next Stream: ${nextStream.startDate.toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit"
  })} ${TIMEZONE_LABEL}`;

  // Countdown
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

/*************************************************
 * INIT
 *************************************************/

document.addEventListener("DOMContentLoaded", () => {
  loadTwitch();
  setInterval(loadTwitch, 60000); // Refresh every 60s
});
