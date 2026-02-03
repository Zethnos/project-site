/**
 * Twitch Historical Stats Loader
 * Pulls data from twitch_stats.php and injects text into HTML IDs
 * Elements are optional — safe on any page
 */

const TWITCH_STATS_API = "/api/twitch_stats.php";

/* ---------------- HELPERS ---------------- */

function setText(id, value, fallback = "—") {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent =
    value !== null && value !== undefined && value !== ""
      ? value
      : fallback;
}

function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return null;
  return Number(num).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/* ---------------- MAIN LOADER ---------------- */

async function loadTwitchStats() {
  try {
    const res = await fetch(TWITCH_STATS_API, { cache: "no-store" });
    if (!res.ok) throw new Error("Stats API request failed");

    const data = await res.json();

    /* ---------------- VIEWERSHIP ---------------- */

    setText(
      "avg-viewers-30d",
      formatNumber(data.viewer_stats?.average_viewers_30d, 1)
    );

    setText(
      "median-viewers-30d",
      formatNumber(data.viewer_stats?.median_viewers_30d, 1)
    );

    setText(
      "peak-viewers-30d",
      formatNumber(data.viewer_stats?.peak_viewers_30d)
    );

    /* ---------------- STREAMING TIME ---------------- */

    setText(
      "hours-streamed-30d",
      formatNumber(data.streaming_time?.hours_streamed_30d, 1)
    );

    setText(
      "avg-stream-length",
      formatNumber(data.streaming_time?.avg_stream_length_hours, 2) + "h"
    );

    /* ---------------- GROWTH CURVE (FOR CHARTS) ---------------- */

    // Expose globally so charts can read it
    window.TWITCH_GROWTH_CURVE_90D =
      Array.isArray(data.growth?.curve_90d)
        ? data.growth.curve_90d.map(d => ({
            date: d.date,
            avgViewers: Number(d.avg_viewers)
          }))
        : [];

  } catch (err) {
    console.error("Twitch stats load error:", err);
  }
}

/* ---------------- INIT ---------------- */

document.addEventListener("DOMContentLoaded", loadTwitchStats);
