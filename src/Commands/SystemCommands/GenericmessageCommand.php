<?php

namespace AmeBot\Commands\SystemCommands;

use AmeBot\MessageHandlers\GeminiHandler;
use AmeBot\MessageHandlers\MessageHandlerInterface;
use Longman\TelegramBot\Commands\SystemCommand;
use Longman\TelegramBot\Entities\ServerResponse;
use Longman\TelegramBot\Entities\Update;
use Longman\TelegramBot\Request;
use Longman\TelegramBot\Telegram;

class GenericmessageCommand extends SystemCommand
{
    /** @var string */
    protected $name = Telegram::GENERIC_MESSAGE_COMMAND;

    /** @var MessageHandlerInterface[] */
    private array $handlers = [];

    public function __construct(Telegram $telegram, ?Update $update = null)
    {
        $this->handlers[] = new GeminiHandler();

        parent::__construct($telegram, $update);
    }

    public function execute(): ServerResponse
    {
        $message = $this->getMessage();

        foreach ($this->handlers as $handler) {
            $response = $handler->handle($message);
            if ($response instanceof ServerResponse) {
                return $response;
            }
        }

        return Request::emptyResponse();
    }
}
