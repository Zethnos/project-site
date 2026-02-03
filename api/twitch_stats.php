<?php
require_once "/home/layngijq/php/apps/twitch_config.php";

header("Content-Type: application/json");

// ------------------- DB CONNECTION -------------------
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed"]);
    exit;
}

// ------------------- HELPERS -------------------
function fetchValue(PDO $pdo, string $sql) {
    return $pdo->query($sql)->fetchColumn();
}

function fetchRow(PDO $pdo, string $sql) {
    return $pdo->query($sql)->fetch(PDO::FETCH_ASSOC);
}

function fetchAll(PDO $pdo, string $sql) {
    return $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);
}

// ------------------- DATE WINDOWS -------------------
$now      = date('Y-m-d H:i:s');
$days30   = date('Y-m-d H:i:s', strtotime('-30 days'));
$days90   = date('Y-m-d H:i:s', strtotime('-90 days'));
$days365  = date('Y-m-d H:i:s', strtotime('-365 days'));

// ------------------- BASIC VIEWER STATS -------------------

// Average viewers
$avg30 = fetchValue($pdo, "
    SELECT ROUND(AVG(viewers), 1)
    FROM layngijq_streamstats
    WHERE snapshot_time >= '$days30'
");

$avgAll = fetchValue($pdo, "
    SELECT ROUND(AVG(viewers), 1)
    FROM layngijq_streamstats
");

// Peak viewers
$peak30  = fetchValue($pdo, "SELECT MAX(viewers) FROM layngijq_streamstats WHERE snapshot_time >= '$days30'");
$peak90  = fetchValue($pdo, "SELECT MAX(viewers) FROM layngijq_streamstats WHERE snapshot_time >= '$days90'");
$peak365 = fetchValue($pdo, "SELECT MAX(viewers) FROM layngijq_streamstats WHERE snapshot_time >= '$days365'");

// ------------------- MEDIAN VIEWERS -------------------

// Median (30d)
$median30 = fetchValue($pdo, "
    SELECT AVG(viewers) FROM (
        SELECT viewers
        FROM layngijq_streamstats
        WHERE snapshot_time >= '$days30'
        ORDER BY viewers
        LIMIT 2 - (SELECT COUNT(*) FROM layngijq_streamstats WHERE snapshot_time >= '$days30') % 2
        OFFSET (SELECT (COUNT(*) - 1) / 2 FROM layngijq_streamstats WHERE snapshot_time >= '$days30')
    ) t
");

// Median (all-time)
$medianAll = fetchValue($pdo, "
    SELECT AVG(viewers) FROM (
        SELECT viewers
        FROM layngijq_streamstats
        ORDER BY viewers
        LIMIT 2 - (SELECT COUNT(*) FROM layngijq_streamstats) % 2
        OFFSET (SELECT (COUNT(*) - 1) / 2 FROM layngijq_streamstats)
    ) t
");

// ------------------- STREAM TIME CALCULATIONS -------------------
function totalHours(PDO $pdo, string $since) {
    $stmt = $pdo->query("
        SELECT
            SUM(TIMESTAMPDIFF(SECOND, MIN(snapshot_time), MAX(snapshot_time))) / 3600
        FROM layngijq_streamstats
        WHERE snapshot_time >= '$since'
        GROUP BY stream_id
    ");

    $hours = 0;
    foreach ($stmt as $row) {
        $hours += $row[0];
    }

    return round($hours, 1);
}

$hours30 = totalHours($pdo, $days30);
$hours90 = totalHours($pdo, $days90);

// Average stream length
$avgStreamLength = fetchValue($pdo, "
    SELECT ROUND(AVG(stream_seconds) / 3600, 2)
    FROM (
        SELECT
            TIMESTAMPDIFF(SECOND, MIN(snapshot_time), MAX(snapshot_time)) AS stream_seconds
        FROM layngijq_streamstats
        GROUP BY stream_id
    ) t
");

// ------------------- GROWTH CURVE (CHART DATA) -------------------
$growthCurve90d = fetchAll($pdo, "
    SELECT
        DATE(snapshot_time) AS date,
        ROUND(AVG(viewers), 1) AS avg_viewers
    FROM layngijq_streamstats
    WHERE snapshot_time >= '$days90'
    GROUP BY DATE(snapshot_time)
    ORDER BY date ASC
");

// ------------------- RETENTION / ENGAGEMENT -------------------

// Per-stream retention
$retentionRows = fetchAll($pdo, "
    SELECT
        stream_id,
        MAX(viewers) AS peak,
        ROUND(AVG(viewers), 1) AS avg_viewers
    FROM layngijq_streamstats
    GROUP BY stream_id
");

$retentionRates = [];

foreach ($retentionRows as $row) {
    if ($row["peak"] > 0) {
        $retentionRates[] = round(($row["avg_viewers"] / $row["peak"]) * 100, 1);
    }
}

$avgRetention = count($retentionRates)
    ? round(array_sum($retentionRates) / count($retentionRates), 1)
    : null;

// Engagement score (sponsor-friendly)
$engagementScore = null;
if ($avgRetention && $avg30 && $peak365) {
    $engagementScore = round(
        (($avg30 / $peak365) * 50) + ($avgRetention * 0.5),
        1
    );
}

// ------------------- CONTENT STATS -------------------

// Top category (30d)
$topCategory = fetchRow($pdo, "
    SELECT category, COUNT(*) AS samples
    FROM layngijq_streamstats
    WHERE snapshot_time >= '$days30'
    AND category != ''
    GROUP BY category
    ORDER BY samples DESC
    LIMIT 1
");

// Most recent stream
$lastStream = fetchRow($pdo, "
    SELECT title, category, start_time
    FROM layngijq_streamstats
    ORDER BY snapshot_time DESC
    LIMIT 1
");

// ------------------- FINAL OUTPUT -------------------
$data = [
    "viewer_stats" => [
        "average_viewers_30d" => (float) $avg30,
        "average_viewers_all_time" => (float) $avgAll,
        "median_viewers_30d" => (float) $median30,
        "median_viewers_all_time" => (float) $medianAll,
        "peak_viewers_30d" => (int) $peak30,
        "peak_viewers_90d" => (int) $peak90,
        "peak_viewers_365d" => (int) $peak365
    ],
    "streaming_time" => [
        "hours_streamed_30d" => (float) $hours30,
        "hours_streamed_90d" => (float) $hours90,
        "avg_stream_length_hours" => (float) $avgStreamLength
    ],
    "growth" => [
        "curve_90d" => $growthCurve90d
    ],
    "engagement" => [
        "avg_retention_percent" => $avgRetention,
        "engagement_score" => $engagementScore
    ],
    "content" => [
        "top_category_30d" => $topCategory["category"] ?? null,
        "last_stream" => $lastStream
    ],
    "generated_at" => $now
];

echo json_encode($data, JSON_PRETTY_PRINT);
