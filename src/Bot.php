<?php

declare(strict_types=1);

namespace AmeBot;

use Longman\TelegramBot\Entities\Update;
use Longman\TelegramBot\Exception\TelegramException;
use Longman\TelegramBot\Request;
use Longman\TelegramBot\Telegram;

class Bot
{
    private Telegram $telegram;

    private Config $config;

    public function __construct(Config $config)
    {
        $this->config = $config;

        try {
            $this->telegram = new Telegram(
                $this->config->getBotApiToken(),
                $this->config->getBotUsername()
            );
            $this->telegram->useGetUpdatesWithoutDatabase();

            foreach ($this->config->getAdminIds() as $adminId) {
                $this->telegram->enableAdmin($adminId);
            }

            $this->telegram->addCommandsPath(__ROOT__ . '/src/Commands');
        } catch (TelegramException $e) {
            echo 'Error setting up Telegram Bot: ' . $e->getMessage() . PHP_EOL;
            exit(1);
        }
    }

    public function run(): never
    {
        echo 'Bot is running via getUpdates...' . PHP_EOL;
        $offset = null;

        // @phpstan-ignore while.alwaysTrue
        while (true) {
            $updates = $this->fetchUpdates($offset);

            if (empty($updates)) {
                sleep(2);

                continue;
            }

            $offset = $this->processUpdates($updates, $offset);
            sleep(2);
        }
    }

    /**
     * @return Update[]
     */
    private function fetchUpdates(?int $offset): array
    {
        $response = Request::getUpdates([
            'offset' => $offset,
            'timeout' => 30,
        ]);

        if (!$response->isOk()) {
            echo 'Failed to fetch updates: ' . $response->getDescription() . PHP_EOL;

            return [];
        }

        return $response->getResult();
    }

    /**
     * @param Update[] $updates
     */
    private function processUpdates(array $updates, ?int $offset): ?int
    {
        $processedCount = 0;
        $discardedCount = 0;
        $errorCount = 0;
        $currentTime = time();
        $timeoutSeconds = $this->config->getUpdateTimeoutSeconds();

        foreach ($updates as $update) {
            $updateId = $update->getUpdateId();

            // Get timestamp from various update types (they are nullable, the PHPDoc in the library is incorrect), fallback to current time
            $updateDate = $update->getMessage()?->getDate() // @phpstan-ignore nullsafe.neverNull
                ?? $update->getEditedMessage()?->getDate()  // @phpstan-ignore nullsafe.neverNull
                ?? $update->getChannelPost()?->getDate() // @phpstan-ignore nullsafe.neverNull
                ?? $update->getEditedChannelPost()?->getDate() // @phpstan-ignore nullsafe.neverNull
                ?? $currentTime;

            $updateAge = $currentTime - $updateDate;

            if ($updateAge > $timeoutSeconds) {
                ++$discardedCount;
                echo "Discarded update {$updateId} (age: {$updateAge}s > {$timeoutSeconds}s)" . PHP_EOL;
            } else {
                try {
                    $this->telegram->processUpdate($update);
                    ++$processedCount;
                } catch (TelegramException $e) {
                    ++$errorCount;
                    echo "Error processing update {$updateId}: {$e->getMessage()}" . PHP_EOL;
                }
            }

            $offset = $updateId + 1;
        }

        if ($processedCount > 0 || $discardedCount > 0 || $errorCount > 0) {
            echo "Processed {$processedCount} updates, discarded {$discardedCount} old updates, {$errorCount} errors." . PHP_EOL;
        }

        return $offset;
    }

    public function getTelegram(): Telegram
    {
        return $this->telegram;
    }
}
