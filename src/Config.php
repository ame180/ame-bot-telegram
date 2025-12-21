<?php

declare(strict_types=1);

namespace AmeBot;

class Config
{
    /**
     * @param int[] $adminIds
     */
    public function __construct(
        protected string $botApiToken,
        protected string $botUsername,
        protected array $adminIds = [],
        protected int $updateTimeoutSeconds,
    ) {
    }

    public function getBotApiToken(): string
    {
        return $this->botApiToken;
    }

    public function getBotUsername(): string
    {
        return $this->botUsername;
    }

    /** @return int[] */
    public function getAdminIds(): array
    {
        return $this->adminIds;
    }

    public function getUpdateTimeoutSeconds(): int
    {
        return $this->updateTimeoutSeconds;
    }
}
