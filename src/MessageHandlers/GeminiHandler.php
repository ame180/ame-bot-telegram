<?php

declare(strict_types=1);

namespace AmeBot\MessageHandlers;

use AmeBot\Services\GeminiConfig;
use Gemini;
use Gemini\Data\Content;
use Longman\TelegramBot\Entities\Message;
use Longman\TelegramBot\Entities\ServerResponse;
use Longman\TelegramBot\Request;

class GeminiHandler implements MessageHandlerInterface
{
    public function handle(Message $message): ?ServerResponse
    {
        $text = trim((string) $message->getText(true));

        if (0 !== stripos($text, 'hey ame')) {
            return null;
        }

        $userMessage = $this->extractMessageAfterTrigger($text);

        if (empty($userMessage)) {
            return Request::sendMessage([
                'chat_id' => $message->getChat()->getId(),
                'text' => GeminiConfig::getResponse('greeting', 'Hey! How can I help you?'),
            ]);
        }

        $apiKey = $_ENV['GEMINI_API_KEY'] ?? null;

        echo 'ApiKey: ' . $apiKey . PHP_EOL;

        if (empty($apiKey)) {
            return Request::sendMessage([
                'chat_id' => $message->getChat()->getId(),
                'text' => GeminiConfig::getResponse('missing_api_key', 'Please configure my Gemini API key to use this feature.'),
            ]);
        }

        try {
            $client = Gemini::client($apiKey);
            
            $model = $client
                ->generativeModel('gemini-3-flash-preview')
                ->withSystemInstruction(
                    Content::parse(GeminiConfig::getSystemPrompt())
                );

            $result = $model->generateContent($userMessage);
            $responseText = $result->text();

            return Request::sendMessage([
                'chat_id' => $message->getChat()->getId(),
                'text' => $responseText,
                'parse_mode' => 'MarkdownV2',
            ]);
        } catch (\Exception $e) {
            echo 'Gemini API error: ' . $e->getMessage() . PHP_EOL;
            
            return Request::sendMessage([
                'chat_id' => $message->getChat()->getId(),
                'text' => GeminiConfig::getResponse('error', 'Sorry, I encountered an error. Please check the logs for details.'),
            ]);
        }
    }

    private function extractMessageAfterTrigger(string $text): string
    {
        // Remove the trigger phrase "hey ame"
        $withoutTrigger = preg_replace('/^hey\s+ame/i', '', $text);
        
        // Remove any leading non-word characters (whitespace, punctuation, etc.)
        return preg_replace('/^[^\w]+/u', '', $withoutTrigger);
    }
}
