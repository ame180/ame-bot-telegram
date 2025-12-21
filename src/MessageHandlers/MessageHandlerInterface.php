<?php

declare(strict_types=1);

namespace AmeBot\MessageHandlers;

use Longman\TelegramBot\Entities\Message;
use Longman\TelegramBot\Entities\ServerResponse;

interface MessageHandlerInterface
{
    public function handle(Message $message): ?ServerResponse;
}
