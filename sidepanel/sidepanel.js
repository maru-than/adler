import { renderMarkdown, attachCopyHandlers } from '../lib/markdown.js';
import { generateId } from '../lib/utils.js';

// State
let messages = [];
let currentProvider = 'openai';
let currentModel = 'gpt-4o';
let isStreaming = false;
let port = null;

// DOM elements
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const btnSend = document.getElementById('btn-send');
const btnStop = document.getElementById('btn-stop');
const btnSettings = document.getElementById('btn-settings');
const modelSelector = document.getElementById('model-selector');
const errorBanner = document.getElementById('error-banner');
const errorText = document.getElementById('error-text');
const errorDismiss = document.getElementById('error-dismiss');

// ── Init ──

function init() {
  setupEventListeners();
  messageInput.focus();
}

// ── Event listeners ──

function setupEventListeners() {
  messageInput.addEventListener('input', () => {
    autoResize();
    btnSend.disabled = messageInput.value.trim() === '' || isStreaming;
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!btnSend.disabled) sendMessage();
    }
  });

  btnSend.addEventListener('click', sendMessage);
  btnStop.addEventListener('click', stopGeneration);
  btnSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());
  errorDismiss.addEventListener('click', hideError);

  modelSelector.addEventListener('change', () => {
    const [provider, model] = modelSelector.value.split(':');
    currentProvider = provider;
    currentModel = model;
  });
}

function autoResize() {
  messageInput.style.height = '40px';
  const scrollH = messageInput.scrollHeight;
  const maxH = 120;
  messageInput.style.height = Math.min(scrollH, maxH) + 'px';
  messageInput.style.overflowY = scrollH > maxH ? 'auto' : 'hidden';
}

// ── Chat ──

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || isStreaming) return;

  // Clear empty state
  const emptyState = chatMessages.querySelector('.empty-state');
  if (emptyState) emptyState.remove();

  // Always include page context
  let contextPrefix = '';
  const content = await getPageContent();
  if (content?.text) {
    contextPrefix = `[Page context — ${content.title} (${content.url})]\n\n${content.text}\n\n---\n\n`;
  }

  // Add user message
  const userMessage = {
    role: 'user',
    content: contextPrefix + text,
    displayContent: text,
  };
  messages.push(userMessage);
  renderMessage(userMessage, true);

  // Clear input
  messageInput.value = '';
  messageInput.style.height = 'auto';
  btnSend.disabled = true;

  // Start streaming
  setStreaming(true);
  const assistantEl = createAssistantBubble();
  let assistantText = '';

  // Open port
  port = chrome.runtime.connect({ name: 'adler-chat' });

  port.onMessage.addListener((msg) => {
    if (msg.type === 'CHUNK') {
      assistantText += msg.text;
      updateAssistantBubble(assistantEl, assistantText);
      scrollToBottom();
    } else if (msg.type === 'STREAM_DONE') {
      messages.push({ role: 'assistant', content: assistantText });
      finishStreaming(assistantEl, assistantText);
    } else if (msg.type === 'ERROR') {
      showError(msg.error);
      if (!assistantText) assistantEl.remove();
      setStreaming(false);
    }
  });

  port.onDisconnect.addListener(() => {
    if (isStreaming) {
      messages.push({ role: 'assistant', content: assistantText });
      finishStreaming(assistantEl, assistantText);
    }
  });

  // Build API messages with system prompt
  const systemPrompt = {
    role: 'system',
    content: 'Be direct and concise. Short answers, no filler. Use plain language. Skip greetings, disclaimers, and repetition. If the user shares page context, reference it naturally without restating it.',
  };
  const apiMessages = [
    systemPrompt,
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  port.postMessage({
    type: 'CHAT_REQUEST',
    messages: apiMessages,
    model: currentModel,
    provider: currentProvider,
  });
}

function stopGeneration() {
  if (port) {
    port.postMessage({ type: 'STOP_GENERATION' });
  }
}

async function getPageContent() {
  return new Promise((resolve) => {
    const p = chrome.runtime.connect({ name: 'adler-chat' });
    p.onMessage.addListener((msg) => {
      if (msg.type === 'PAGE_CONTENT') {
        resolve(msg.content);
        p.disconnect();
      }
    });
    p.postMessage({ type: 'GET_PAGE_CONTENT' });
    setTimeout(() => {
      resolve(null);
      try { p.disconnect(); } catch {}
    }, 3000);
  });
}

// ── Rendering ──

function renderMessage(msg, animate) {
  const el = document.createElement('div');
  el.className = `message ${msg.role}`;
  if (!animate) el.style.animation = 'none';

  const displayText = msg.displayContent || msg.content;

  el.innerHTML = `
    <div class="message-content">${msg.role === 'assistant' ? renderMarkdown(displayText) : escapeHtml(displayText)}</div>
  `;

  chatMessages.appendChild(el);
  if (msg.role === 'assistant') attachCopyHandlers(el);
  scrollToBottom();
}

function createAssistantBubble() {
  const el = document.createElement('div');
  el.className = 'message assistant';
  el.innerHTML = `
    <div class="message-content">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>
  `;
  chatMessages.appendChild(el);
  scrollToBottom();
  return el;
}

function updateAssistantBubble(el, text) {
  const content = el.querySelector('.message-content');
  content.innerHTML = renderMarkdown(text);
  attachCopyHandlers(el);
}

function finishStreaming(el, text) {
  updateAssistantBubble(el, text);
  setStreaming(false);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

// ── UI State ──

function setStreaming(streaming) {
  isStreaming = streaming;
  btnSend.classList.toggle('hidden', streaming);
  btnStop.classList.toggle('hidden', !streaming);
  messageInput.disabled = streaming;
  modelSelector.disabled = streaming;
}

function showError(message) {
  errorText.textContent = message;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
}

// ── Start ──
init();
