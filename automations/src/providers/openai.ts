import type { AiProvider } from './types.js';

/** Matches the model `followup/src/lib/integrations/openai.ts` already uses,
 *  so one OpenAI account and one cost line covers both products. */
const MODEL = 'gpt-4o-mini';

export class OpenAiDrafter implements AiProvider {
  constructor(private readonly apiKey: string) {}

  async draft(prompt: string, maxWords: number): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'You write short messages on behalf of a small business owner. ' +
              'Plain language, no marketing voice, no emoji, no subject line. ' +
              `Hard limit ${maxWords} words. Output the message text only.`,
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = json.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('OpenAI returned an empty draft');
    return clampWords(text, maxWords);
  }
}

/** The model treats the word limit as a suggestion often enough that an
 *  unclamped draft can turn one SMS segment into four. */
export function clampWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}...`;
}
