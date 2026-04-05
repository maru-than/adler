// SSE line parser for streaming API responses
export async function* parseSSEStream(response, signal) {
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

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6);
          if (data === '[DONE]') return;
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Generate a simple unique ID
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Truncate text to a max character count, trying to break at sentence boundaries
export function truncateText(text, maxLength = 12000) {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSentence = truncated.lastIndexOf('. ');
  if (lastSentence > maxLength * 0.8) {
    return truncated.slice(0, lastSentence + 1) + '\n\n[Content truncated]';
  }
  return truncated + '\n\n[Content truncated]';
}
