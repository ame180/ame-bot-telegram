<?php

declare(strict_types=1);

namespace AmeBot\Services;

class GeminiConfig
{
    private const PROMPT_FILE = __ROOT__ . '/gemini_prompt.md';

    private const RESPONSES_FILE = __ROOT__ . '/gemini_responses.json';

    private static ?string $systemPrompt = null;

    /** @var array<string, string> */
    private static array $responses = [];

    public static function getSystemPrompt(): string
    {
        if (null !== self::$systemPrompt) {
            return self::$systemPrompt;
        }

        if (file_exists(self::PROMPT_FILE)) {
            $content = file_get_contents(self::PROMPT_FILE);
            if (false !== $content) {
                self::$systemPrompt = $content;

                echo 'Loaded Gemini system prompt from file.' . PHP_EOL;

                return self::$systemPrompt;
            }
        }

        self::$systemPrompt = 'You are Ame Bot. A helpful and friendly Telegram Bot created by Ame.';

        return self::$systemPrompt;
    }

    public static function getResponse(string $key, string $default): string
    {
        if (empty(self::$responses) && file_exists(self::RESPONSES_FILE)) {
            $content = file_get_contents(self::RESPONSES_FILE);
            if (false !== $content) {
                /** @var array<string, string>|null $decoded */
                $decoded = json_decode($content, true);
                if (is_array($decoded)) {
                    echo 'Loaded Gemini responses from file.' . PHP_EOL;

                    self::$responses = $decoded;
                }
            }
        }

        return self::$responses[$key] ?? $default;
    }
}
