const STREAM_TIMEZONE = "America/New_York";
const TIMEZONE_LABEL = "EST";
const TWITCH_URL = "https://twitch.tv/zethnos";

const SCHEDULE = [
  { day: 1, time: "8:00", durationHours: 4 },
  { day: 3, time: "8:00", durationHours: 4 },
  { day: 4, time: "8:00", durationHours: 4 },
  { day: 5, time: "8:00", durationHours: 4 },
];

const scheduleList = document.getElementById("schedule-list");
const countdownEl = document.getElementById("countdown");
const nextStreamContainer = document.getElementById("next-stream");

// ---- Twitch embed container ----
let twitchEmbedContainer = document.createElement("div");
twitchEmbedContainer.id = "twitch-embed-container";
twitchEmbedContainer.style =
  "aspect-ratio:16/9; width:100%; margin-top:1rem; display:none;";
scheduleList.parentNode.appendChild(twitchEmbedContainer);

// ---- Twitch embed state ----
let twitchEmbedVisible = false;

// ---- EST helpers ----
function getNowEST() {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: STREAM_TIMEZONE })
  );
}

function formatTimeEST(date) {
  return (
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + ` ${TIMEZONE_LABEL}`
  );
}

// ---- Live detection (EST only) ----
function isCurrentlyLive() {
  const now = getNowEST();

  return SCHEDULE.some((stream) => {
    if (stream.day !== now.getDay()) return false;

    const [h, m] = stream.time.split(":").map(Number);
    const start = new Date(now);
    start.setHours(h, m, 0, 0);

    const end = new Date(start.getTime() + stream.durationHours * 3600000);
    return now >= start && now <= end;
  });
}

// ---- Next stream (EST only) ----
function getNextStream() {
  const now = getNowEST();

  for (let i = 0; i < 14; i++) {
    const testDate = new Date(now);
    testDate.setDate(now.getDate() + i);

    for (const stream of SCHEDULE) {
      if (testDate.getDay() !== stream.day) continue;

      const [h, m] = stream.time.split(":").map(Number);
      const streamDate = new Date(testDate);
      streamDate.setHours(h, m, 0, 0);

      if (streamDate > now) {
        return { stream, date: streamDate };
      }
    }
  }
  return null;
}

// ---- Countdown + live controller (EST only) ----
function updateCountdown() {
  const now = getNowEST();
  const live = isCurrentlyLive();

  if (live) {
    countdownEl.style.display = "none";
    nextStreamContainer.style.display = "none";
    showTwitchEmbed();
    return;
  }

  hideTwitchEmbed();
  countdownEl.style.display = "";
  nextStreamContainer.style.display = "";

  const next = getNextStream();
  if (!next) return;

  const diff = next.date - now;
  const hours = Math.floor(diff / 1000 / 60 / 60);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  countdownEl.textContent = `Starts in ${hours}h ${minutes}m ${seconds}s`;
}

// ---- Twitch embed controls ----
function showTwitchEmbed() {
  if (twitchEmbedVisible) return;

  twitchEmbedVisible = true;
  twitchEmbedContainer.style.display = "block";

  twitchEmbedContainer.innerHTML = `
    <iframe
      src="https://player.twitch.tv/?channel=zethnos&parent=zethnos.com&autoplay=true&muted=true"
      width="100%"
      height="100%"
      frameborder="0"
      allowfullscreen
    ></iframe>
  `;
}

function hideTwitchEmbed() {
  if (!twitchEmbedVisible) return;

  twitchEmbedVisible = false;
  twitchEmbedContainer.style.display = "none";
  twitchEmbedContainer.innerHTML = "";
}

// ---- Schedule rendering (EST only) ----
function renderSchedule() {
  scheduleList.innerHTML = "";
  const now = getNowEST();

  SCHEDULE.forEach((stream) => {
    const [h, m] = stream.time.split(":").map(Number);

    const streamDate = new Date(now);
    streamDate.setDate(now.getDate() + ((stream.day - now.getDay() + 7) % 7));
    streamDate.setHours(h, m, 0, 0);

    const end = new Date(streamDate.getTime() + stream.durationHours * 3600000);

    const li = document.createElement("li");
    li.className =
      "list-group-item d-flex justify-content-between align-items-center";

    const dayLabel = streamDate.toLocaleDateString("en-US", {
      weekday: "long",
    });

    const timeLabel = formatTimeEST(streamDate);

    if (now >= streamDate && now <= end) {
      li.classList.add("live");

      li.innerHTML = `
        <a href="${TWITCH_URL}" target="_blank"
           class="d-flex justify-content-between align-items-center w-100 text-decoration-none">
          <span>${dayLabel}</span>
          <span class="badge bg-danger">LIVE NOW</span>
        </a>
      `;
    } else {
      li.innerHTML = `
        <span>${dayLabel}</span>
        <span>${timeLabel}</span>
      `;
    }

    scheduleList.appendChild(li);
  });
}

// ---- Init ----
renderSchedule();
updateCountdown();

setInterval(updateCountdown, 1000);
setInterval(renderSchedule, 60 * 1000);
