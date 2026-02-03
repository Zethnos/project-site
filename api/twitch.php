<?php
require_once "../../php/apps/twitch_config.php";

header("Content-Type: application/json");

// ------------------- FILE PATHS -------------------
$tokenFile = "../../php/apps/twitch_token.json";
$cacheFile = "../../php/apps/twitch_cache.json";

// ------------------- ENV DETECTION -------------------
// If run from cron / CLI, php_sapi_name() === 'cli'
$isCron = (php_sapi_name() === 'cli');

// ------------------- HELPERS -------------------
function fetchJson($url, $headers = [], $method = "GET", $postFields = null) {
    $opts = [
        "http" => [
            "method" => $method,
            "header" => implode("\r\n", $headers),
            "timeout" => 10
        ]
    ];

    if ($postFields) {
        $opts["http"]["content"] = http_build_query($postFields);
    }

    $result = file_get_contents($url, false, stream_context_create($opts));
    return $result ? json_decode($result, true) : null;
}

function getTwitchToken($tokenFile) {
    if (file_exists($tokenFile)) {
        $token = json_decode(file_get_contents($tokenFile), true);
        if (!empty($token["access_token"]) && time() < $token["expires_at"]) {
            return $token["access_token"];
        }
    }

    $data = fetchJson(
        "https://id.twitch.tv/oauth2/token",
        ["Content-Type: application/x-www-form-urlencoded"],
        "POST",
        [
            "client_id" => TWITCH_CLIENT_ID,
            "client_secret" => TWITCH_CLIENT_SECRET,
            "grant_type" => "client_credentials"
        ]
    );

    if (!$data || empty($data["access_token"])) {
        throw new Exception("Failed to obtain Twitch OAuth token");
    }

    $data["expires_at"] = time() + $data["expires_in"];
    file_put_contents($tokenFile, json_encode($data));

    return $data["access_token"];
}

// ------------------- CACHE CHECK (browser only) -------------------
if (!$isCron && file_exists($cacheFile)) {
    $cache = json_decode(file_get_contents($cacheFile), true);
    if (!empty($cache["timestamp"]) && time() - $cache["timestamp"] < STATS_CACHE_TTL) {
        echo json_encode($cache["data"]);
        exit;
    }
}

// ------------------- API CALLS -------------------
$token = getTwitchToken($tokenFile);

$headers = [
    "Client-ID: " . TWITCH_CLIENT_ID,
    "Authorization: Bearer $token"
];

// User info
$userData = fetchJson(
    "https://api.twitch.tv/helix/users?login=" . TWITCH_USERNAME,
    $headers
);

$user = $userData["data"][0] ?? null;
if (!$user) {
    echo json_encode(["error" => "User not found"]);
    exit;
}

// Followers
$follows = fetchJson(
    "https://api.twitch.tv/helix/channels/followers?broadcaster_id=" . $user["id"],
    $headers
);

// Stream
$stream = fetchJson(
    "https://api.twitch.tv/helix/streams?user_id=" . $user["id"],
    $headers
);

$isLive = !empty($stream["data"]);
$streamData = $stream["data"][0] ?? null;

// Schedule
$scheduleRaw = fetchJson(
    "https://api.twitch.tv/helix/schedule?broadcaster_id=" . $user["id"],
    $headers
);

$schedule = [];
if (!empty($scheduleRaw["data"]["segments"])) {
    foreach ($scheduleRaw["data"]["segments"] as $seg) {
        $schedule[] = [
            "title" => $seg["title"],
            "start_time" => $seg["start_time"],
            "category" => $seg["category"]["name"] ?? ""
        ];
    }
}

// ------------------- DATABASE INSERT (cron + browser) -------------------
try {
    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);

    $stmt = $pdo->prepare("
        INSERT INTO twitch_viewer_log
        (stream_id, start_time, snapshot_time, viewers, title, category)
        VALUES (?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $streamData["id"] ?? null,
        $streamData["started_at"] ?? null,
        date('Y-m-d H:i:s'),
        $streamData["viewer_count"] ?? 0,
        $streamData["title"] ?? "",
        $streamData["game_name"] ?? ""
    ]);

} catch (Exception $e) {
    error_log("DB Insert Error: " . $e->getMessage());
}

// ------------------- FINAL JSON -------------------
$data = [
    "followers" => $follows["total"] ?? 0,
    "live" => $isLive,
    "viewers" => $streamData["viewer_count"] ?? 0,
    "category" => $streamData["game_name"] ?? "",
    "schedule" => $schedule
];

// Save cache (browser use)
if (!$isCron) {
    file_put_contents($cacheFile, json_encode([
        "timestamp" => time(),
        "data" => $data
    ]));
}

echo json_encode($data);
