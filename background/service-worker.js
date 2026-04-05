import { AnthropicProvider } from '../lib/providers/anthropic.js';
import { OpenAIProvider } from '../lib/providers/openai.js';
import { GeminiProvider } from '../lib/providers/gemini.js';
import { getApiKey, getPreferences } from '../lib/storage.js';

// Open side panel on icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Track active streaming abort controllers
const activeStreams = new Map();

// Provider factory
function createProvider(providerName, apiKey) {
  switch (providerName) {
    case 'anthropic': return new AnthropicProvider(apiKey);
    case 'openai': return new OpenAIProvider(apiKey);
    case 'gemini': return new GeminiProvider(apiKey);
    default: throw new Error(`Unknown provider: ${providerName}`);
  }
}

// Handle long-lived connections from side panel
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'adler-chat') return;

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'CHAT_REQUEST') {
      await handleChatRequest(port, msg);
    } else if (msg.type === 'STOP_GENERATION') {
      const controller = activeStreams.get(port);
      if (controller) {
        controller.abort();
        activeStreams.delete(port);
      }
    } else if (msg.type === 'GET_PAGE_CONTENT') {
      await handleGetPageContent(port, msg);
    }
  });

  port.onDisconnect.addListener(() => {
    const controller = activeStreams.get(port);
    if (controller) {
      controller.abort();
      activeStreams.delete(port);
    }
  });
});

async function handleChatRequest(port, msg) {
  const { messages, model, provider: providerName } = msg;

  try {
    const apiKey = await getApiKey(providerName);
    if (!apiKey) {
      port.postMessage({ type: 'ERROR', error: `No API key set for ${providerName}. Open settings to add one.` });
      return;
    }

    const provider = createProvider(providerName, apiKey);
    const controller = new AbortController();
    activeStreams.set(port, controller);

    for await (const chunk of provider.streamChat(messages, model, controller.signal)) {
      port.postMessage({ type: 'CHUNK', text: chunk });
    }

    port.postMessage({ type: 'STREAM_DONE' });
  } catch (err) {
    if (err.name === 'AbortError') {
      port.postMessage({ type: 'STREAM_DONE', aborted: true });
    } else {
      port.postMessage({ type: 'ERROR', error: err.message });
    }
  } finally {
    activeStreams.delete(port);
  }
}

async function handleGetPageContent(port, msg) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith('chrome://')) {
      port.postMessage({ type: 'PAGE_CONTENT', content: null, error: 'Cannot read this page.' });
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
    port.postMessage({ type: 'PAGE_CONTENT', content: response });
  } catch (err) {
    port.postMessage({ type: 'PAGE_CONTENT', content: null, error: 'Could not extract page content.' });
  }
}
