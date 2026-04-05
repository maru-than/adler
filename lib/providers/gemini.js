import { BaseProvider } from './base-provider.js';
import { parseSSEStream } from '../utils.js';

export class GeminiProvider extends BaseProvider {
  get models() {
    return [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    ];
  }

  async *streamChat(messages, model, signal) {
    // Convert messages to Gemini format
    const contents = [];
    for (const msg of messages) {
      if (msg.role === 'system') {
        // Gemini handles system as first user message
        contents.push({ role: 'user', parts: [{ text: msg.content }] });
        contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
      signal,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${err}`);
    }

    for await (const data of parseSSEStream(response, signal)) {
      try {
        const parsed = JSON.parse(data);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch {
        // skip
      }
    }
  }
}
