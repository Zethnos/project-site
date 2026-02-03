/**
 * Twitch Viewer Growth Chart
 * Uses Chart.js
 * Reads growth data exposed by twitch_stats.php
 */

const TWITCH_STATS_API = "/api/twitch_stats.php";

let growthChart = null;

async function loadGrowthChart() {
  try {
    const res = await fetch(TWITCH_STATS_API, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load stats");

    const data = await res.json();
    const curve = data.growth?.curve_90d;

    if (!Array.isArray(curve) || curve.length === 0) {
      console.warn("No growth data available");
      return;
    }

    const labels = curve.map(point =>
      new Date(point.date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric"
      })
    );

    const viewers = curve.map(point => Number(point.avg_viewers));

    renderChart(labels, viewers);

  } catch (err) {
    console.error("Growth chart error:", err);
  }
}

function renderChart(labels, data) {
  const ctx = document
    .getElementById("viewer-growth-chart")
    .getContext("2d");

  if (growthChart) {
    growthChart.destroy();
  }

  growthChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Average Viewers",
          data,
          tension: 0.35,          // Curve smoothness
          borderWidth: 3,
          pointRadius: 0,         // Clean line (no dots)
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.parsed.y} viewers`
          }
        }
      },

      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

/* INIT */
document.addEventListener("DOMContentLoaded", loadGrowthChart);
