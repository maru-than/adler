// Content script: extracts page text when requested

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_PAGE_CONTENT') {
    sendResponse(extractPageContent());
  }
  return false;
});

function extractPageContent() {
  const maxLength = 12000;

  // Gather metadata
  const meta = getMetadata();

  // Extract main content text
  let text = extractText();

  // Clean whitespace
  text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();

  // If extraction is too thin, fall back to full body
  if (text.length < 100) {
    text = document.body.innerText || '';
    text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim();
  }

  // Truncate at sentence boundary
  if (text.length > maxLength) {
    const cut = text.slice(0, maxLength);
    const lastBreak = Math.max(
      cut.lastIndexOf('. '),
      cut.lastIndexOf('.\n'),
      cut.lastIndexOf('? '),
      cut.lastIndexOf('! ')
    );
    text = lastBreak > maxLength * 0.7
      ? cut.slice(0, lastBreak + 1) + '\n\n[Truncated]'
      : cut + '\n\n[Truncated]';
  }

  // Prepend metadata summary if available
  let header = '';
  if (meta.description) header += `Description: ${meta.description}\n`;
  if (meta.author) header += `Author: ${meta.author}\n`;
  if (meta.published) header += `Published: ${meta.published}\n`;
  if (header) text = header + '\n' + text;

  return {
    url: location.href,
    title: document.title,
    text,
  };
}

function extractText() {
  // Priority order: specific content containers → semantic elements → role-based → body
  const selectors = [
    'article',
    '[role="article"]',
    'main',
    '[role="main"]',
    '.post-content',
    '.article-content',
    '.entry-content',
    '.content-body',
    '.story-body',
    '#content',
    '#main-content',
    '.markdown-body',      // GitHub
    '.post',
    '.blog-post',
    '.page-content',
  ];

  for (const sel of selectors) {
    const els = document.querySelectorAll(sel);
    if (els.length > 0) {
      // Combine all matching elements (handles pages with multiple articles)
      const combined = Array.from(els)
        .map((el) => cleanElement(el))
        .filter((t) => t.length > 50)
        .join('\n\n');
      if (combined.length > 100) return combined;
    }
  }

  // Fallback: grab body but strip noise
  return cleanElement(document.body);
}

function cleanElement(el) {
  // Work on a clone to avoid mutating the page
  const clone = el.cloneNode(true);

  // Remove noise elements
  const noiseSelectors = [
    'script', 'style', 'noscript', 'iframe', 'svg',
    'nav', 'footer', 'header', 'aside',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="complementary"]', '[role="search"]',
    '.sidebar', '.nav', '.navigation', '.menu', '.footer',
    '.header', '.ad', '.ads', '.advertisement', '.social-share',
    '.comments', '.comment-section', '#comments',
    '.cookie-banner', '.popup', '.modal', '.overlay',
    '.related-posts', '.recommended', '.newsletter-signup',
    '.breadcrumb', '.pagination', '.toc',
  ];

  clone.querySelectorAll(noiseSelectors.join(', ')).forEach((n) => n.remove());

  // Remove hidden elements
  clone.querySelectorAll('[aria-hidden="true"], [hidden], [style*="display:none"], [style*="display: none"]').forEach((n) => n.remove());

  return clone.innerText || clone.textContent || '';
}

function getMetadata() {
  const meta = {};

  // Description
  meta.description = getMeta('description') || getMeta('og:description') || getMeta('twitter:description') || '';

  // Author
  meta.author = getMeta('author') || getMeta('article:author') || '';

  // Published date
  meta.published = getMeta('article:published_time') || getMeta('date') || getMeta('publishedDate') || '';

  // Trim long descriptions
  if (meta.description.length > 300) {
    meta.description = meta.description.slice(0, 300) + '...';
  }

  return meta;
}

function getMeta(name) {
  const el =
    document.querySelector(`meta[name="${name}"]`) ||
    document.querySelector(`meta[property="${name}"]`) ||
    document.querySelector(`meta[itemprop="${name}"]`);
  return el?.getAttribute('content')?.trim() || '';
}
