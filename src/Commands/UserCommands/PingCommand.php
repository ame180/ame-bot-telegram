<?php

namespace AmeBot\Commands\UserCommands;

use Longman\TelegramBot\Commands\UserCommand;
use Longman\TelegramBot\Entities\ServerResponse;
use Longman\TelegramBot\Request;

class PingCommand extends UserCommand
{
    /** @var string */
    protected $name = 'ping';

    /** @var string */
    protected $description = 'A simple ping command';

    /** @var string */
    protected $usage = '/ping';

    public function execute(): ServerResponse
    {
        $message = $this->getMessage();
        $chatId = $message->getChat()->getId();

        return Request::sendMessage([
            'chat_id' => $chatId,
            'text' => 'Pong!',
        ]);
    }
}
