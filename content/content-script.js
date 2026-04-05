// Content script: extracts page text when requested

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_PAGE_CONTENT') {
    sendResponse(extractPageContent());
  }
  return false;
});

function extractPageContent() {
  const maxLength = 12000;

  // Try semantic elements first
  const article = document.querySelector('article');
  const main = document.querySelector('main');
  const target = article || main || document.body;

  // Clone and strip noise
  const clone = target.cloneNode(true);
  clone.querySelectorAll('script, style, nav, footer, header, aside, iframe, noscript, [role="navigation"], [role="banner"], [role="contentinfo"]').forEach((el) => el.remove());

  let text = clone.innerText || clone.textContent || '';

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();

  // Truncate
  if (text.length > maxLength) {
    const cut = text.slice(0, maxLength);
    const lastSentence = cut.lastIndexOf('. ');
    text = lastSentence > maxLength * 0.8
      ? cut.slice(0, lastSentence + 1) + '\n\n[Content truncated]'
      : cut + '\n\n[Content truncated]';
  }

  return {
    url: location.href,
    title: document.title,
    text,
  };
}
