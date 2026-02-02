<?php
require_once "../../php/apps/twitch_config.php";

header("Content-Type: application/json");

// File paths
$tokenFile = "../../php/apps/twitch_token.json";
$cacheFile = "../../php/apps/twitch_cache.json";

// ---------- HELPERS ----------
function fetchJson($url, $headers = [], $method = "GET", $postFields = null) {
  $opts = [
    "http" => [
      "method" => $method,
      "header" => $headers,
    ]
  ];

  if ($postFields) {
    $opts["http"]["content"] = http_build_query($postFields);
  }

  return json_decode(
    file_get_contents($url, false, stream_context_create($opts)),
    true
  );
}

// ---------- TOKEN ----------
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

  $data["expires_at"] = time() + $data["expires_in"];
  file_put_contents($tokenFile, json_encode($data));

  return $data["access_token"];
}

// ---------- CACHE ----------
if (file_exists($cacheFile)) {
  $cache = json_decode(file_get_contents($cacheFile), true);
  if (!empty($cache["timestamp"]) &&
      time() - $cache["timestamp"] < STATS_CACHE_TTL) {
    echo json_encode($cache["data"]);
    exit;
  }
}

// ---------- API CALLS ----------
$token = getTwitchToken($tokenFile);

$headers = [
  "Client-ID: " . TWITCH_CLIENT_ID,
  "Authorization: Bearer $token"
];

// User ID
$user = fetchJson(
  "https://api.twitch.tv/helix/users?login=" . TWITCH_USERNAME,
  $headers
)["data"][0];

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

// Final data
$data = [
  "followers" => $follows["total"],
  "live" => count($stream["data"]) > 0,
  "viewers" => $stream["data"][0]["viewer_count"] ?? 0
];

// Save cache
file_put_contents($cacheFile, json_encode([
  "timestamp" => time(),
  "data" => $data
]));

echo json_encode($data);
