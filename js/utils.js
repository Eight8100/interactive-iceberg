/* Interactive Iceberg — text, markdown, selectors & fade helpers.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase();
}

function hasItemDescription(item) {
  return !!String(item?.description || '').trim();
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function stripHtml(value = '') {
  const div = document.createElement('div');
  div.innerHTML = String(value || '');
  return div.textContent || '';
}


function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function decodeEntryTarget(value) {
  const entityDecoded = decodeHtmlEntities(value);
  try {
    return decodeURIComponent(entityDecoded);
  } catch {
    return entityDecoded;
  }
}

function encodeEntryTarget(value) {
  return encodeURIComponent(String(value || ''));
}

function escapeMarkdownLabel(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/]/g, '\\]');
}

function safeUrl(url) {
  const value = String(url || '').trim();
  if (/^(https?:|data:image\/)/i.test(value)) return value;
  return '';
}

function sanitizeDownloadFilename(value, fallback = 'iceberg') {
  const base = String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, 80);
  return base || fallback;
}

function findItemByEntryLinkTarget(target) {
  const value = String(target || '').trim();
  if (!value) return null;
  return getItemById(value)
    || state.items.find(item => normalizeName(item.name) === normalizeName(value))
    || null;
}

function getItemById(itemId) {
  return state.items.find(item => item.id === itemId) || null;
}

function getCurrentItem() {
  return getItemById(currentItemId);
}

function getTierById(tierId) {
  return state.tiers.find(tier => tier.id === tierId) || null;
}

function cssEscapeValue(value) {
  const raw = String(value ?? '');
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(raw);
  return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function dataAttrSelector(attr, value) {
  return `[${attr}="${cssEscapeValue(value)}"]`;
}

function itemChipSelector(itemId, placedOnly = false) {
  return `${placedOnly ? '.tier-items-cell ' : ''}.item-chip${dataAttrSelector('data-item-id', itemId)}`;
}

function tierItemsCellSelector(tierId) {
  return `.tier-items-cell${dataAttrSelector('data-tier-id', tierId)}`;
}

function tierLabelCellSelector(tierId) {
  return `.tier-label-cell${dataAttrSelector('data-tier-id', tierId)}`;
}

/* ── Markdown rendering ── */

function makeInternalEntryLink(label, target) {
  const decodedTarget = decodeEntryTarget(target);
  const item = findItemByEntryLinkTarget(decodedTarget);
  const safeLabel = label || escapeHtml(decodedTarget);
  if (!item) {
    return `<a href="#" class="internal-entry-link broken" data-entry-target="${escapeHtml(decodedTarget)}">${safeLabel}</a>`;
  }
  return `<a href="#" class="internal-entry-link" data-entry-id="${escapeHtml(item.id)}">${safeLabel}</a>`;
}
function renderInlineMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/\[([^\]]+)\]\(@entry:([^)]+)\)/g, (_, label, target) => makeInternalEntryLink(label, target));
  html = html.replace(/\[\[([^\]]+)\]\]/g, (_, target) => makeInternalEntryLink(target, target));
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html;
}

function renderMarkdown(markdown) {
  const source = String(markdown || '').trim();
  if (!source) return '';
  const lines = source.split(/\r?\n/);
  const chunks = [];
  let paragraph = [];
  let list = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    chunks.push(`<p>${renderInlineMarkdown(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list.length) return;
    chunks.push(`<ul>${list.map(item => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
    list = [];
  };

  lines.forEach(line => {
    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      return;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }
    flushList();
    paragraph.push(line);
  });
  flushParagraph();
  flushList();
  return chunks.join('');
}

function setDescriptionDisplay(markdown) {
  const description = String(markdown || '');
  if (description.trim()) {
    els.detailDescDisplay.innerHTML = renderMarkdown(description);
    els.detailDescDisplay.classList.remove('empty');
  } else {
    const hint = icebergEditingLocked() ? '' : '<span class="empty-state-hint">Click Edit to add one.</span>';
    els.detailDescDisplay.innerHTML = `<span class="empty-state-title">No description yet.</span>${hint}`;
    els.detailDescDisplay.classList.add('empty');
  }
}

function extractMarkdownImages(description) {
  const images = [];
  const cleaned = String(description || '').replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const cleanUrl = safeUrl(url);
    if (cleanUrl) images.push({ id: uid(), url: cleanUrl, alt: String(alt || '').trim() });
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  return { cleaned, images };
}

function normalizeItemImages(item) {
  item.images = Array.isArray(item.images) ? item.images : [];
  item.images = item.images
    .map(image => typeof image === 'string' ? { id: uid(), url: image, alt: '' } : image)
    .filter(image => image && safeUrl(image.url))
    .map(image => ({
      id: image.id || uid(),
      url: safeUrl(image.url),
      alt: String(image.alt || ''),
      caption: String(image.caption || '')
    }));
}

function renderDescriptionImages(item) {
  if (!els.detailImages) return;
  const images = item?.images || [];
  els.detailImages.innerHTML = '';
  els.imageManager?.classList.toggle('has-entry-images', images.length > 0);
  els.imageDropZone?.classList.toggle('has-images', images.length > 0);
  images.forEach(image => {
    const thumb = document.createElement('div');
    thumb.className = 'description-image-thumb';
    thumb.dataset.imageId = image.id;
    thumb.setAttribute('role', 'button');
    thumb.tabIndex = 0;
    thumb.setAttribute('aria-label', image.caption ? `Open image: ${stripHtml(image.caption)}` : 'Open image');

    const img = document.createElement('img');
    img.src = image.url;
    img.alt = image.alt || stripHtml(image.caption) || item.name || 'Description image';
    img.loading = 'lazy';
    thumb.appendChild(img);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'description-image-remove';
    remove.dataset.imageId = image.id;
    remove.setAttribute('aria-label', 'Remove image');
    remove.textContent = '×';
    thumb.appendChild(remove);

    els.detailImages.appendChild(thumb);
  });
}

/* ── Element fade animations ── */

function clearElementFadeTimer(el) {
  const timer = elementFadeTimers.get(el);
  if (!timer) return;
  window.clearTimeout(timer);
  elementFadeTimers.delete(el);
}

function restartOpeningAnimation(el) {
  if (!el) return;
  clearElementFadeTimer(el);
  el.classList.remove('is-closing', 'is-opening');
  // Restart the entrance animation every time the element is shown.
  void el.offsetWidth;
  el.classList.add('is-opening');
  const timer = window.setTimeout(() => {
    el.classList.remove('is-opening');
    elementFadeTimers.delete(el);
  }, QUICK_POP_MS + 100);
  elementFadeTimers.set(el, timer);
}

function playClosingAnimation(el, afterClose = null) {
  if (!el) {
    if (typeof afterClose === 'function') afterClose();
    return;
  }
  clearElementFadeTimer(el);
  el.classList.remove('is-opening');
  el.classList.add('is-closing');
  const timer = window.setTimeout(() => {
    el.classList.remove('is-closing');
    elementFadeTimers.delete(el);
    if (typeof afterClose === 'function') afterClose();
  }, QUICK_POP_MS + 70);
  elementFadeTimers.set(el, timer);
}

function hideElementWithFade(el, afterHide = null) {
  if (!el || el.hidden) {
    if (typeof afterHide === 'function') afterHide();
    return;
  }
  playClosingAnimation(el, () => {
    el.hidden = true;
    if (typeof afterHide === 'function') afterHide();
  });
}

function showElementWithFade(el) {
  if (!el) return;
  el.hidden = false;
  restartOpeningAnimation(el);
}

/* ── Image modal and description images ── */

