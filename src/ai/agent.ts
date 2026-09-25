import { generateText, type LanguageModel } from 'ai';

const FORMATTING_INSTRUCTIONS = `Your reply is sent to Telegram with parse_mode HTML.
Only use these tags: <b>, <i>, <u>, <s>, <code>, <pre>, <a href="...">, <blockquote>, <tg-spoiler>.
Never use <p>, <br>, <ul>, <li>, headings or Markdown. Use plain line breaks and "•" for lists.
Escape literal <, > and & as &lt;, &gt; and &amp;.`;

export interface AgentOptions {
  model: LanguageModel;
  systemPrompt: string;
}

export interface AgentRequest {
  question: string;
}

export class Agent {
  constructor(private readonly options: AgentOptions) {}

  async reply(request: AgentRequest): Promise<string> {
    const result = await generateText({
      model: this.options.model,
      instructions: `${this.options.systemPrompt}\n\n${FORMATTING_INSTRUCTIONS}`,
      prompt: request.question,
    });

    return result.text.trim();
  }
}
