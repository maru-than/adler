import { BaseProvider } from './base-provider.js';
import { parseSSEStream } from '../utils.js';

export class AnthropicProvider extends BaseProvider {
  get models() {
    return [
      { id: 'claude-sonnet-4-5-20250514', name: 'Claude Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20250514', name: 'Claude Haiku 4.5' },
    ];
  }

  async *streamChat(messages, model, signal) {
    // Anthropic requires separating system message
    let system = undefined;
    const apiMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else {
        apiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    const body = {
      model,
      max_tokens: 4096,
      messages: apiMessages,
      stream: true,
    };
    if (system) body.system = system;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${err}`);
    }

    // Anthropic SSE has event types — we need content_block_delta
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        if (signal?.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7);
          } else if (trimmed.startsWith('data: ') && currentEvent === 'content_block_delta') {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              const text = parsed.delta?.text;
              if (text) yield text;
            } catch {
              // skip
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
