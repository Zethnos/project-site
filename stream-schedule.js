const STREAM_TIMEZONE = "America/New_York";
const TWITCH_URL = "https://twitch.tv/zethnos";

const SCHEDULE = [
  { day: 1, time: "8:00", durationHours: 4 },
  { day: 2, time: "8:00", durationHours: 4 },
  { day: 3, time: "8:00", durationHours: 4 },
  { day: 4, time: "8:00", durationHours: 4 },
  { day: 5, time: "8:00", durationHours: 4 },
];

const scheduleList = document.getElementById("schedule-list");
const countdownEl = document.getElementById("countdown");
const nextStreamTimeEl = document.getElementById("next-stream-time");
const nextStreamContainer = document.getElementById("next-stream");

// Twitch embed container (created but hidden initially)
let twitchEmbedContainer = document.createElement("div");
twitchEmbedContainer.id = "twitch-embed-container";
twitchEmbedContainer.style =
  "aspect-ratio:16/9; max-width:none; min-width:100%!important; margin-top:1rem; display:none;";
scheduleList.parentNode.appendChild(twitchEmbedContainer);

function isCurrentlyLive() {
  const now = new Date();
  return SCHEDULE.some((stream) => {
    if (stream.day !== now.getDay()) return false;

    const [h, m] = stream.time.split(":").map(Number);
    const start = new Date(now);
    start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + stream.durationHours * 3600000);
    return now >= start && now <= end;
  });
}

function getNextStream() {
  const now = new Date();

  for (let i = 0; i < 14; i++) {
    const testDate = new Date(now);
    testDate.setDate(now.getDate() + i);

    for (const stream of SCHEDULE) {
      if (testDate.getDay() !== stream.day) continue;

      const [h, m] = stream.time.split(":").map(Number);
      const streamDate = new Date(
        testDate.toLocaleString("en-US", { timeZone: STREAM_TIMEZONE })
      );
      streamDate.setHours(h, m, 0, 0);

      const localStreamDate = new Date(
        streamDate.toLocaleString("en-US", {
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
      );

      if (localStreamDate > now) {
        return { stream, date: localStreamDate };
      }
    }
  }
  return null;
}

function updateCountdown() {
  if (isCurrentlyLive()) {
    countdownEl.style.display = "none";
    nextStreamContainer.style.display = "none";
    showTwitchEmbed();
  } else {
    countdownEl.style.display = "";
    nextStreamContainer.style.display = "";
    hideTwitchEmbed();

    const next = getNextStream();
    if (!next) return;

    const diff = next.date - new Date();
    const hours = Math.floor(diff / 1000 / 60 / 60);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    countdownEl.textContent = `Starts in ${hours}h ${minutes}m ${seconds}s`;
  }
}

function showTwitchEmbed() {
  twitchEmbedContainer.style.display = "block"; // only show when live
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
  twitchEmbedContainer.style.display = "none"; // hide when not live
  twitchEmbedContainer.innerHTML = "";
}

function renderSchedule() {
  scheduleList.innerHTML = "";
  const now = new Date();

  SCHEDULE.forEach((stream) => {
    const [h, m] = stream.time.split(":").map(Number);

    const tempDate = new Date();
    tempDate.setDate(now.getDate() + ((stream.day - now.getDay() + 7) % 7));
    tempDate.setHours(h, m, 0, 0);

    const end = new Date(tempDate.getTime() + stream.durationHours * 3600000);

    const li = document.createElement("li");
    li.className =
      "list-group-item d-flex justify-content-between align-items-center";

    const dayLabel = tempDate.toLocaleDateString(undefined, {
      weekday: "long",
    });
    const timeLabel = tempDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    if (now >= tempDate && now <= end) {
      li.classList.add("live");

      li.innerHTML = `
        <a href="${TWITCH_URL}" target="_blank"
           class="d-flex justify-content-between align-items-center w-100 text-decoration-none">
          <span>${dayLabel}</span>
          <span class="d-flex align-items-center gap-2">
            <span class="badge bg-danger">LIVE NOW</span>
          </span>
        </a>
      `;
      showTwitchEmbed();
    } else {
      li.innerHTML = `
        <span>${dayLabel}</span>
        <span class="d-flex align-items-center gap-2">${timeLabel}</span>
      `;
    }

    scheduleList.appendChild(li);
  });
}

// Initial render & countdown
renderSchedule();
updateCountdown();
setInterval(updateCountdown, 1000);
setInterval(renderSchedule, 60 * 1000); // Refresh schedule every minute
