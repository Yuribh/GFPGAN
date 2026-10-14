// Claude adapter for the advisor. Takes an Anthropic SDK client (npm:@anthropic-ai/sdk in the Edge Function) so the
// tests can pass a fake one. Model and request shape follow the claude-api guidance:
// - Claude Opus 5.5 with effort "low" (short chat answers; thinking is always on for this model and is not shown)
// - server-side fallback "default": a declined request is retried by the API on the recommended fallback model
// - the stable system prompt carries a cache marker (it only caches once the prefix reaches the model's minimum size)
import type { CallModel } from './advisor.ts';

export const ADVISOR_MODEL = 'claude-opus-5-5';

interface Block { type: string; text?: string }
interface BetaMessagesClient {
  beta: { messages: { create(params: Record<string, unknown>): Promise<{ stop_reason: string | null; content: Block[] }> } };
}

export function createClaudeCaller(client: BetaMessagesClient, opts: { model?: string; maxTokens?: number } = {}): CallModel {
  return async ({ system, messages }) => {
    const res = await client.beta.messages.create({
      model: opts.model ?? ADVISOR_MODEL,
      max_tokens: opts.maxTokens ?? 4096,           // short answers; this caps the cost of one reply
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages,
    });
    // check the stop reason before reading the content
    if (res.stop_reason === 'refusal') return { text: '', refused: true, truncated: false };
    const text = res.content.filter(b => b.type === 'text').map(b => b.text ?? '').join('');
    return { text, refused: false, truncated: res.stop_reason === 'max_tokens' };
  };
}
