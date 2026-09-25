import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../../src/ai/agent.js';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

describe('Agent', () => {
  it('sends the system prompt and question, and returns trimmed text', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: async () => ({
        content: [{ type: 'text', text: '  Hello!  ' }],
        finishReason: { unified: 'stop', raw: undefined },
        usage,
        warnings: [],
      }),
    });
    const agent = new Agent({ model, systemPrompt: 'You are Ame Bot.' });

    const reply = await agent.reply({ question: 'hi there' });

    expect(reply).toBe('Hello!');
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain('You are Ame Bot.');
    expect(prompt).toContain('hi there');
  });
});
