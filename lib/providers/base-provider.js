export class BaseProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  /** @returns {{ id: string, name: string }[]} */
  get models() {
    return [];
  }

  /**
   * Stream a chat completion.
   * @param {{ role: string, content: string }[]} messages
   * @param {string} model
   * @param {AbortSignal} signal
   * @yields {string} text chunks
   */
  async *streamChat(messages, model, signal) {
    throw new Error('streamChat() must be implemented by subclass');
  }
}
