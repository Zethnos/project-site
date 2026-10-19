<?php
// ------------------- ERROR REPORTING -------------------
ini_set('display_errors', 0);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

require_once "/home/layngijq/php/apps/twitch_config.php";

header("Content-Type: application/json");

// ------------------- DB CONNECTION -------------------
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => "Database connection failed: ".$e->getMessage()]);
    exit;
}

// ------------------- HELPERS -------------------
function fetchValue(PDO $pdo, string $sql) {
    try {
        $stmt = $pdo->query($sql);
        return $stmt ? $stmt->fetchColumn() : null;
    } catch (Throwable $e) {
        return null;
    }
}

function fetchRow(PDO $pdo, string $sql) {
    try {
        $stmt = $pdo->query($sql);
        return $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;
    } catch (Throwable $e) {
        return null;
    }
}

function fetchAll(PDO $pdo, string $sql) {
    try {
        $stmt = $pdo->query($sql);
        return $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
    } catch (Throwable $e) {
        return [];
    }
}

// ------------------- PHP MEDIAN FUNCTION -------------------
function median(array $numbers): ?float {
    $count = count($numbers);
    if ($count === 0) return null;

    sort($numbers, SORT_NUMERIC);
    $middle = floor($count / 2);

    if ($count % 2) {
        return (float) $numbers[$middle];
    } else {
        return (float) (($numbers[$middle - 1] + $numbers[$middle]) / 2);
    }
}

// ------------------- DATE WINDOWS -------------------
$now     = date('Y-m-d H:i:s');
$days30  = date('Y-m-d H:i:s', strtotime('-30 days'));
$days90  = date('Y-m-d H:i:s', strtotime('-90 days'));
$days365 = date('Y-m-d H:i:s', strtotime('-365 days'));

// ------------------- VIEWER STATS -------------------

// Average viewers
$avg30 = fetchValue($pdo, "SELECT ROUND(AVG(viewers), 1) FROM layngijq_streamstats WHERE snapshot_time >= '$days30'");
$avgAll = fetchValue($pdo, "SELECT ROUND(AVG(viewers), 1) FROM layngijq_streamstats");

// Peak viewers
$peak30  = fetchValue($pdo, "SELECT MAX(viewers) FROM layngijq_streamstats WHERE snapshot_time >= '$days30'");
$peak90  = fetchValue($pdo, "SELECT MAX(viewers) FROM layngijq_streamstats WHERE snapshot_time >= '$days90'");
$peak365 = fetchValue($pdo, "SELECT MAX(viewers) FROM layngijq_streamstats WHERE snapshot_time >= '$days365'");

// ------------------- MEDIAN VIEWERS (PHP) -------------------
// 30-day median
$viewers30 = fetchAll($pdo, "SELECT viewers FROM layngijq_streamstats WHERE snapshot_time >= '$days30'");
$viewers30 = array_column($viewers30, 'viewers');
$median30 = median($viewers30);

// All-time median
$viewersAll = fetchAll($pdo, "SELECT viewers FROM layngijq_streamstats");
$viewersAll = array_column($viewersAll, 'viewers');
$medianAll = median($viewersAll);

// ------------------- STREAM TIME (PHP) -------------------
function totalHoursPHP(PDO $pdo, string $since): ?float {
    $streams = fetchAll($pdo, "
        SELECT stream_id, MIN(snapshot_time) AS start_time, MAX(snapshot_time) AS end_time
        FROM layngijq_streamstats
        WHERE snapshot_time >= '$since'
        GROUP BY stream_id
    ");
    if (!$streams) return null;

    $hours = 0;
    foreach ($streams as $s) {
        $start = strtotime($s['start_time']);
        $end = strtotime($s['end_time']);
        $hours += max(0, ($end - $start) / 3600);
    }
    return round($hours, 1);
}

$hours30 = totalHoursPHP($pdo, $days30);
$hours90 = totalHoursPHP($pdo, $days90);

// Average stream length
$avgStreamLength = fetchValue($pdo, "
    SELECT ROUND(AVG(stream_seconds) / 3600, 2) FROM (
        SELECT TIMESTAMPDIFF(SECOND, MIN(snapshot_time), MAX(snapshot_time)) AS stream_seconds
        FROM layngijq_streamstats
        GROUP BY stream_id
    ) t
");

// ------------------- GROWTH CURVE -------------------
$growthCurve90d = fetchAll($pdo, "
    SELECT DATE(snapshot_time) AS date, ROUND(AVG(viewers), 1) AS avg_viewers
    FROM layngijq_streamstats
    WHERE snapshot_time >= '$days90'
    GROUP BY DATE(snapshot_time)
    ORDER BY date ASC
");

// ------------------- RETENTION / ENGAGEMENT -------------------
$retentionRows = fetchAll($pdo, "
    SELECT stream_id, MAX(viewers) AS peak, ROUND(AVG(viewers), 1) AS avg_viewers
    FROM layngijq_streamstats
    GROUP BY stream_id
");

$retentionRates = [];
foreach ($retentionRows as $row) {
    if (!empty($row["peak"]) && $row["peak"] > 0) {
        $retentionRates[] = round(($row["avg_viewers"] / $row["peak"]) * 100, 1);
    }
}
$avgRetention = count($retentionRates) ? round(array_sum($retentionRates) / count($retentionRates), 1) : null;

$engagementScore = null;
if ($avgRetention && $avg30 && $peak365) {
    $engagementScore = round((($avg30 / $peak365) * 50) + ($avgRetention * 0.5), 1);
}

// ------------------- CONTENT STATS -------------------
$topCategory = fetchRow($pdo, "
    SELECT category, COUNT(*) AS samples
    FROM layngijq_streamstats
    WHERE snapshot_time >= '$days30' AND category != ''
    GROUP BY category
    ORDER BY samples DESC
    LIMIT 1
");

$lastStream = fetchRow($pdo, "
    SELECT title, category, start_time
    FROM layngijq_streamstats
    ORDER BY snapshot_time DESC
    LIMIT 1
");

// ------------------- FINAL OUTPUT -------------------
$data = [
    "viewer_stats" => [
        "average_viewers_30d" => $avg30 !== null ? (float) $avg30 : null,
        "average_viewers_all_time" => $avgAll !== null ? (float) $avgAll : null,
        "median_viewers_30d" => $median30,
        "median_viewers_all_time" => $medianAll,
        "peak_viewers_30d" => $peak30 !== null ? (int) $peak30 : null,
        "peak_viewers_90d" => $peak90 !== null ? (int) $peak90 : null,
        "peak_viewers_365d" => $peak365 !== null ? (int) $peak365 : null
    ],
    "streaming_time" => [
        "hours_streamed_30d" => $hours30,
        "hours_streamed_90d" => $hours90,
        "avg_stream_length_hours" => $avgStreamLength
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
        "last_stream" => [
            "title" => $lastStream["title"] ?? null,
            "category" => $lastStream["category"] ?? null,
            "start_time" => $lastStream["start_time"] ?? null
        ]
    ],
    "generated_at" => $now
];

echo json_encode($data, JSON_PRETTY_PRINT);
