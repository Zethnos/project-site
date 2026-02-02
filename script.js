function updateUI() {
  const nextStreamEl = document.getElementById("next-stream-time");
  const countdownEl = document.getElementById("countdown");
  const scheduleEl = document.getElementById("schedule-list");

  if (!nextStreamEl || !countdownEl || !scheduleEl) return;

  scheduleEl.innerHTML = "";

  if (!TWITCH_STATE.schedule || !TWITCH_STATE.schedule.length) {
    nextStreamEl.textContent = "No upcoming streams";
    countdownEl.textContent = "";
    scheduleEl.innerHTML = "<li class='list-group-item'>No upcoming streams</li>";
    return;
  }

  // Populate schedule
  TWITCH_STATE.schedule.forEach(entry => {
    if (!entry.start_time) return; // skip invalid entries
    const li = document.createElement("li");
    li.className = "list-group-item";

    const startDate = new Date(entry.start_time);
    if (isNaN(startDate)) return;

    const dayName = startDate.toLocaleDateString("en-US", { weekday: "long" });
    const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

    li.innerHTML = `<a href="${TWITCH_CHANNEL_URL}" target="_blank">
      <span>${dayName}</span> - <span>${timeStr} ${TIMEZONE_LABEL}</span>
    </a>`;

    scheduleEl.appendChild(li);
  });

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
    nextStreamEl.textContent = "No upcoming streams";
    countdownEl.textContent = "";
    return;
  }

  nextStreamEl.textContent = `Next Stream: ${nextStream.startDate.toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit"
  })} ${TIMEZONE_LABEL}`;

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