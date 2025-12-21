<?php

declare(strict_types=1);

define('__ROOT__', __DIR__);

error_reporting(error_reporting() ^ E_DEPRECATED);

require __ROOT__ . '/vendor/autoload.php';

use AmeBot\Bot;
use AmeBot\Config;
use Symfony\Component\Dotenv\Dotenv;

$dotenv = new Dotenv();
$dotenv->load(__ROOT__ . '/.env');

$botToken = $_ENV['BOT_TOKEN'] ?? null;
$botUsername = $_ENV['BOT_USERNAME'] ?? null;
$adminIds = isset($_ENV['ADMIN_IDS']) ? explode(',', $_ENV['ADMIN_IDS']) : [];
$adminIds = array_map('intval', $adminIds);
$updateTimeoutSeconds = isset($_ENV['UPDATE_TIMEOUT_SECONDS']) ? (int) $_ENV['UPDATE_TIMEOUT_SECONDS'] : null;

if (empty($botToken) || empty($botUsername)) {
    echo 'Please configure BOT_TOKEN and BOT_USERNAME in .env' . PHP_EOL;
    exit(1);
}

if ($updateTimeoutSeconds === null) {
    echo 'Please configure UPDATE_TIMEOUT_SECONDS in .env' . PHP_EOL;
    exit(1);
}

$config = new Config($botToken, $botUsername, $adminIds, $updateTimeoutSeconds);
$bot = new Bot($config);

$bot->run();
