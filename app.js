const TIER_BOUNDARIES = [0, 195, 391, 621.5, 827.5, 1037.5, 1224.5, 1425.5, 1626.5, 1843.5, 2048];
const DEFAULT_TIERS = [
  ['Sky', '#13a9e8'],
  ['Surface', '#0051ff'],
  ['Shallow', '#0531e7'],
  ['Depths', '#0611b8'],
  ['Deep', '#04007c'],
  ['Abyss', '#02004d'],
  ['Lower Abyss', '#01002d'],
  ['Hadopelagic', '#000019'],
  ['Void', '#00000d'],
  ['Blackout', '#000000'],
];
const FIXED_TIER_COUNT = DEFAULT_TIERS.length;
const STATE_VERSION = 6;
const AUTOSAVE_KEY = 'interactiveIceberg.autosave.v1';
// Match `--quick-pop` in CSS (.12s = 120ms).
const QUICK_POP_MS = 120;
// Slow-fade-back transition after dismissing an entry-link hover.
const ENTRY_LINK_FADE_RETURN_MS = 2050;
const BG_BLUR_LABELS = ['none', 'some', 'more'];
const LOCK_LOTTIE_PATH = 'Lock.json';
const LOCK_LOTTIE_CLOSED_FRAME = 5;
const LOCK_LOTTIE_OPEN_FRAME = 26;
const LOCK_LOTTIE_LOCK_START_FRAME = 34;
const LOCK_LOTTIE_LOCK_END_FRAME = 50;
const LOCK_LOTTIE_UNLOCK_START_FRAME = 5;
const LOCK_LOTTIE_UNLOCK_END_FRAME = 18;

let state = {
  version: STATE_VERSION,
  title: 'My Iceberg',
  entryFontSize: 14,
  entryFontFamily: 'Georgia, serif',
  bgBlur: 0,
  showTierTitles: true,
  showPips: true,
  entryDrift: true,
  tiers: DEFAULT_TIERS.map(([label, color]) => ({ id: uid(), label, color })),
  items: []
};

let currentItemId = null;
let dragItemId = null;
let dragGhost = null;
let fluidDrag = null;
let selectedItemIds = new Set();
let selectionBox = null;
let selectionStart = null;
let selectionMoved = false;
let icebergSearchTerm = '';
let currentImagePreviewId = null;
let imageModalLocalEditMode = false;
let hoveredPreviewItemId = null;
let hoverPreviewTimer = null;
let hoverPreviewHideTimer = 0;
let randomHighlightTimer = 0;
let hoverPreviewPoint = { x: 0, y: 0 };
let searchLinesRaf = 0;
let pendingEntryLinkSelection = null;
let descriptionToolErrorTimer = null;
let descriptionToolErrorPoint = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let switchingDescriptionMode = false;
let entryPickMode = false;
let entryPickLinePoint = null;
let entryPickLineTargetId = null;
let entryPickLineRaf = 0;
let entryPickOpacityRaf = 0;
let entryPickDrawTargetId = null;
let entryPickDrawStartedAt = 0;
let internalLinkDrawTargetId = null;
let internalLinkDrawStartedAt = 0;
let descriptionEditItemId = null;
let hoveredInternalLinkEl = null;
let hoveredInternalLinkTargetId = null;
let autosaveReady = false;
let autosaveTimer = 0;
let autosaveWriteFailed = false;
let pendingAutosavePayload = null;
const consoleLogEntries = [];
const MAX_CONSOLE_LOG_ENTRIES = 8;
const elementFadeTimers = new WeakMap();
let entryLoadAnimationPending = true;
let internalLinkFadeReturnTimer = 0;
let lockPulseTimer = 0;
let lockLottieAnim = null;
let lockLottieReady = false;
let lockLottieColorLocked = null;
let internalLinkExitConnector = null;
let internalLinkScrollSourceChip = null;
let internalLinkExitStartedAt = 0;
let internalLinkExitRaf = 0;
let pendingTierImageId = null;
let activeTierImageMenuId = null;
let tierImageMoveModeId = null;
let tierImageDrag = null;
let entryDriftPointer = null;
let entryDriftRaf = 0;

const $ = id => document.getElementById(id);

const els = {
  title: $('chart-title'),
  file: $('file-input'),
  tierImageFile: $('tier-image-file'),
  pool: $('unplaced-pool'),
  tiers: $('tiers-container'),
  wrapper: $('iceberg-wrapper'),
  icebergSearch: $('iceberg-search'),
  icebergSearchCount: $('iceberg-search-count'),
  searchLines: $('search-lines'),
  entrySize: $('entry-size'),
  entrySizeValue: $('entry-size-value'),
  entryFont: $('entry-font'),
  showTierTitles: $('show-tier-titles'),
  showPips: $('show-pips'),
  entryDrift: $('entry-drift'),
  icebergLockToggle: $('iceberg-lock-toggle'),
  lockLottie: $('lock-lottie'),
  lockFallbackIcon: $('lock-fallback-icon'),
  leftSidebar: document.querySelector('.sidebar'),
  leftCollapse: $('sidebar-collapse-toggle'),
  detailSidebar: $('detail-sidebar'),
  detailCollapse: $('detail-collapse-toggle'),
  newName: $('new-item-name'),
  addError: $('add-item-error'),
  detailCard: $('detail-card'),
  detailPlaceholder: $('detail-placeholder'),
  detailHeading: $('detail-heading'),
  linkedEntryBack: $('mobile-linked-entry-back'),
  detailTitleDisplay: $('detail-title-display'),
  detailTitleEdit: $('detail-title-edit'),
  detailTitleError: $('detail-title-error'),
  detailTier: $('detail-tier'),
  detailNeedsVerification: $('detail-needs-verification'),
  detailVerificationStatic: $('detail-verification-static'),
  detailEditRow: $('detail-edit-row'),
  detailEditBtn: $('detail-edit-btn'),
  detailDoneBtn: $('detail-done-btn'),
  entryPreview: $('entry-preview'),
  detailDescDisplay: $('detail-description-display'),
  detailDescRichEdit: $('detail-description-rich-edit'),
  detailDescEdit: $('detail-description-edit'),
  formatBold: $('format-bold-btn'),
  formatItalic: $('format-italic-btn'),
  formatCode: $('format-code-btn'),
  detailLinkUrl: $('detail-link-url-btn'),
  descriptionSyntaxToggle: $('description-syntax-toggle'),
  detailPickEntry: $('detail-pick-entry-btn'),
  entryLinkPicker: $('entry-link-picker'),
  entryLinkSearch: $('entry-link-search'),
  entryLinkList: $('entry-link-list'),
  entryLinkHint: $('entry-link-hint'),
  detailImages: $('description-images'),
  detailImageFile: $('detail-image-file'),
  detailImageError: $('detail-image-error'),
  imageManager: $('image-manager'),
  imageDropZone: $('image-drop-zone'),
  imageModal: $('image-modal'),
  imageModalImg: $('image-modal-img'),
  imageModalPrev: $('image-modal-prev'),
  imageModalNext: $('image-modal-next'),
  imageModalCount: $('image-modal-count'),
  imageModalControls: $('image-modal-controls'),
  imageModalTitle: $('image-modal-title'),
  imageModalCaption: $('image-modal-caption'),
  imageModalTools: $('image-modal-tools'),
  imageModalBold: $('image-modal-bold-btn'),
  imageModalItalic: $('image-modal-italic-btn'),
  imageModalCode: $('image-modal-code-btn'),
  imageModalLink: $('image-modal-link-btn'),
  imageModalEditRow: $('image-modal-edit-row'),
  imageModalEditBtn: $('image-modal-edit-btn'),
  imageModalDoneBtn: $('image-modal-done-btn'),
  detailRemoveDelete: $('detail-remove-delete-btn'),
  aboutModal: $('about-modal'),
  aboutBtn: $('about-btn'),
  fileMenu: $('file-menu'),
  displayMenu: $('display-menu')
};

/* ── Utilities and helpers ── */

function uid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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
    els.detailDescDisplay.textContent = 'No description yet.';
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

function showImageError(message = '') {
  if (els.detailImageError) els.detailImageError.textContent = message;
}

function detailEditorIsOpen() {
  return !!(
    els.detailCard?.classList.contains('description-editing') ||
    (els.detailDoneBtn && !els.detailDoneBtn.hidden)
  );
}

function detailImageEditingAllowed() {
  return detailEditorIsOpen() && !icebergEditingLocked();
}

function imageModalControlsAllowed() {
  return !!(
    currentImagePreviewId &&
    !icebergEditingLocked() &&
    getCurrentItem()
  );
}

function imageModalEditingAllowed() {
  return imageModalControlsAllowed() && imageModalLocalEditMode === true;
}

function ensureImageModalEditMode(focusTarget = null) {
  if (!imageModalControlsAllowed()) return false;

  imageModalLocalEditMode = true;
  syncImageModalEditingState();

  if (focusTarget) {
    requestAnimationFrame(() => focusTarget.focus?.());
  }
  return true;
}

function finishImageModalEdit() {
  if (!currentImagePreviewId) return;
  saveOpenImageCaption({ force: true });
  imageModalLocalEditMode = false;
  syncImageModalEditingState();
}

function sanitizeImageCaptionHtml(value = '') {
  const template = document.createElement('template');
  template.innerHTML = String(value || '');
  const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'CODE', 'A', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI']);
  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
          return;
        }
        [...child.attributes].forEach(attr => {
          if (child.tagName === 'A' && attr.name === 'href' && safeUrl(attr.value)) return;
          child.removeAttribute(attr.name);
        });
        if (child.tagName === 'A') {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        }
        walk(child);
      }
    });
  };
  walk(template.content);
  return template.innerHTML.trim();
}

function setImageCaptionEditor(value = '') {
  if (!els.imageModalCaption) return;
  const clean = sanitizeImageCaptionHtml(value);
  els.imageModalCaption.innerHTML = clean;
}

function getImageCaptionEditorHtml() {
  if (!els.imageModalCaption) return '';
  return sanitizeImageCaptionHtml(els.imageModalCaption.innerHTML || '');
}

function syncImageModalEditingState() {
  if (!els.imageModalCaption) return;
  if (icebergEditingLocked()) imageModalLocalEditMode = false;
  const controlsAllowed = imageModalControlsAllowed();
  const canEdit = imageModalEditingAllowed();
  els.imageModal?.classList.toggle('image-modal-controls-available', controlsAllowed);
  els.imageModal?.classList.toggle('image-modal-can-edit', canEdit);
  if (els.imageModalTitle) {
    els.imageModalTitle.readOnly = !canEdit;
    els.imageModalTitle.setAttribute('aria-readonly', String(!canEdit));
  }
  els.imageModalCaption.contentEditable = canEdit ? 'true' : 'false';
  els.imageModalCaption.setAttribute('aria-readonly', String(!canEdit));
  els.imageModalCaption.dataset.placeholder = canEdit ? 'Add a description...' : 'No description yet.';
  els.imageModalCaption.classList.toggle('readonly', !canEdit);
  if (els.imageModalTools) els.imageModalTools.hidden = !canEdit;
  els.imageModalTools?.querySelectorAll('button').forEach(button => { button.disabled = !canEdit; });
  if (els.imageModalEditRow) els.imageModalEditRow.hidden = !controlsAllowed;
  if (els.imageModalEditBtn) els.imageModalEditBtn.hidden = !controlsAllowed || canEdit;
  if (els.imageModalDoneBtn) els.imageModalDoneBtn.hidden = !controlsAllowed || !canEdit;
}

function removeCurrentImage(imageId, options = {}) {
  const allowFromModal = options?.fromModal === true;
  if (allowFromModal ? !imageModalEditingAllowed() : !detailImageEditingAllowed()) return;
  const item = getCurrentItem();
  if (!item) return;
  item.images = (item.images || []).filter(image => image.id !== imageId);
  renderDescriptionImages(item);
  syncChipImageClass(item);
  if (currentImagePreviewId === imageId) closeImagePreview();
}

function updateImageMeta(imageId, changes = {}) {
  if (!imageModalEditingAllowed()) return;
  const item = getCurrentItem();
  if (!item) return;
  const image = (item.images || []).find(img => img.id === imageId);
  if (!image) return;
  if (Object.prototype.hasOwnProperty.call(changes, 'alt')) image.alt = String(changes.alt || '');
  if (Object.prototype.hasOwnProperty.call(changes, 'caption')) image.caption = sanitizeImageCaptionHtml(changes.caption || '');
  renderDescriptionImages(item);
}

function updateImageTitle(imageId, title) {
  updateImageMeta(imageId, { alt: title });
}

function saveOpenImageCaption(options = {}) {
  if (!currentImagePreviewId || !els.imageModalCaption) return;
  const force = options?.force === true;
  if (!force && !imageModalEditingAllowed()) return;
  const item = getCurrentItem();
  const image = (item?.images || []).find(img => img.id === currentImagePreviewId);
  if (!image) return;
  if (els.imageModalTitle) image.alt = String(els.imageModalTitle.value || '');
  image.caption = getImageCaptionEditorHtml();
  renderDescriptionImages(item);
  syncImageModalSlideshow();
}

function getCurrentImageList() {
  return getCurrentItem()?.images || [];
}

function getCurrentImageIndex() {
  return getCurrentImageList().findIndex(image => image.id === currentImagePreviewId);
}

function syncImageModalSlideshow() {
  const images = getCurrentImageList();
  const index = getCurrentImageIndex();
  const hasMultiple = images.length > 1 && index >= 0;
  if (els.imageModalControls) els.imageModalControls.hidden = !hasMultiple;
  if (els.imageModalPrev) els.imageModalPrev.hidden = !hasMultiple;
  if (els.imageModalNext) els.imageModalNext.hidden = !hasMultiple;
  if (els.imageModalCount) {
    els.imageModalCount.hidden = !hasMultiple;
    els.imageModalCount.textContent = hasMultiple ? `${index + 1} / ${images.length}` : '';
  }
}

function animateImageModalSlide(direction = 0) {
  if (!els.imageModalImg || !direction) return;
  const className = direction > 0 ? 'image-modal-slide-next' : 'image-modal-slide-prev';
  els.imageModalImg.classList.remove('image-modal-slide-next', 'image-modal-slide-prev');
  void els.imageModalImg.offsetWidth;
  els.imageModalImg.classList.add(className);
  window.setTimeout(() => {
    els.imageModalImg?.classList.remove(className);
  }, 260);
}

function loadImagePreviewContent(imageId, options = {}) {
  const item = getCurrentItem();
  const image = (item?.images || []).find(img => img.id === imageId);
  if (!image || !els.imageModalImg) return false;
  currentImagePreviewId = imageId;
  els.imageModalImg.src = image.url;
  els.imageModalImg.alt = image.alt || item.name || 'Description image';
  animateImageModalSlide(Number(options.slideDirection || 0));
  if (els.imageModalTitle) els.imageModalTitle.value = image.alt || '';
  setImageCaptionEditor(image.caption || '');
  if (options.preserveEditMode !== true) imageModalLocalEditMode = false;
  syncImageModalEditingState();
  syncImageModalSlideshow();
  return true;
}

function showAdjacentImagePreview(direction) {
  const images = getCurrentImageList();
  const index = getCurrentImageIndex();
  if (images.length < 2 || index < 0) return;
  saveOpenImageCaption({ force: true });
  const nextIndex = (index + direction + images.length) % images.length;
  const wasEditing = imageModalEditingAllowed();
  loadImagePreviewContent(images[nextIndex].id, { preserveEditMode: wasEditing, slideDirection: direction });
}

function openImagePreview(imageId) {
  if (!els.imageModal) return;
  imageModalLocalEditMode = false;
  if (!loadImagePreviewContent(imageId)) return;
  showElementWithFade(els.imageModal);
}

function closeImagePreview() {
  if (!els.imageModal) return;
  saveOpenImageCaption({ force: true });
  hideElementWithFade(els.imageModal, () => {
    currentImagePreviewId = null;
    imageModalLocalEditMode = false;
    els.imageModalImg.removeAttribute('src');
    syncImageModalSlideshow();
    if (els.imageModalTitle) els.imageModalTitle.value = '';
    setImageCaptionEditor('');
  });
}

function closeImagePreviewForItemChange() {
  if (!currentImagePreviewId) return;
  if (els.imageModal && !els.imageModal.hidden) closeImagePreview();
  else {
    currentImagePreviewId = null;
    imageModalLocalEditMode = false;
  }
}

function execImageModalCommand(command, value = null) {
  if (!currentImagePreviewId || !els.imageModalCaption || !ensureImageModalEditMode(els.imageModalCaption)) return;
  els.imageModalCaption.focus();
  document.execCommand(command, false, value);
  saveOpenImageCaption();
}

function applyImageModalCode() {
  if (!currentImagePreviewId || !els.imageModalCaption || !ensureImageModalEditMode(els.imageModalCaption)) return;
  els.imageModalCaption.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !els.imageModalCaption.contains(sel.anchorNode)) return;
  const range = sel.getRangeAt(0);
  const code = document.createElement('code');
  if (range.collapsed) {
    code.textContent = 'code';
    range.insertNode(code);
    range.selectNodeContents(code);
  } else {
    try {
      code.appendChild(range.extractContents());
      range.insertNode(code);
      range.selectNodeContents(code);
    } catch {
      document.execCommand('insertText', false, '`' + sel.toString() + '`');
    }
  }
  sel.removeAllRanges();
  sel.addRange(range);
  saveOpenImageCaption();
}

function applyImageModalLink() {
  if (!currentImagePreviewId || !els.imageModalCaption || !ensureImageModalEditMode(els.imageModalCaption)) return;
  els.imageModalCaption.focus();
  const url = window.prompt('Paste a URL');
  if (url === null) return;
  const clean = safeUrl(url);
  if (!clean) return;
  document.execCommand('createLink', false, clean);
  els.imageModalCaption.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  saveOpenImageCaption();
}

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Drop an image file.'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Image is too large. Use an image under 12MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.onload = () => {
      const originalDataUrl = String(reader.result || '');
      if (!originalDataUrl) {
        reject(new Error('Could not read image.'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(originalDataUrl);
      img.onload = () => {
        try {
          const maxSide = 1400;
          const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
          canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(originalDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.86) || originalDataUrl);
        } catch (err) {
          resolve(originalDataUrl);
        }
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

async function addImageFiles(files) {
  if (!detailImageEditingAllowed()) return;
  const item = getCurrentItem();
  if (!item) return;
  const imageFiles = [...files].filter(file => file.type.startsWith('image/'));
  if (!imageFiles.length) {
    showImageError('Drop an image file.');
    return;
  }
  item.images = Array.isArray(item.images) ? item.images : [];
  try {
    for (const file of imageFiles) {
      const url = await imageFileToDataUrl(file);
      item.images.push({ id: uid(), url, alt: file.name.replace(/\.[^.]+$/, ''), caption: '' });
    }
    showImageError('');
    renderDescriptionImages(item);
    syncChipImageClass(item);
  } catch (err) {
    showImageError(err.message || 'Could not add image.');
  }
}

function syncChipImageClass(item) {
  const chip = document.querySelector(itemChipSelector(item.id, true));
  if (!chip) return;
  chip.classList.toggle('has-images', !!item.images?.length);
}

function extractYouTubeIds(text) {
  if (!text) return [];
  const seen = new Set();
  const ids = [];
  const re = /(?:youtube\.com\/(?:watch\?(?:[^#&\s]*&)*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); ids.push(m[1]); }
  }
  return ids;
}

function renderYouTubeEmbeds(item) {
  const container = $('youtube-embeds');
  if (!container) return;
  const ids = extractYouTubeIds(item?.description || '');
  if (!ids.length) { container.hidden = true; container.innerHTML = ''; return; }
  container.innerHTML = '';
  ids.forEach(id => {
    const wrap = document.createElement('div');
    wrap.className = 'youtube-embed-wrap';

    const thumb = document.createElement('div');
    thumb.className = 'youtube-thumb';
    thumb.style.backgroundImage = `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)`;
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('tabindex', '0');
    thumb.setAttribute('aria-label', 'Play video');

    const play = document.createElement('div');
    play.className = 'youtube-play-btn';
    play.innerHTML = `<svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg"><path d="M66.5 7.4A8.5 8.5 0 0 0 60.6 1.5C55.3 0 34 0 34 0S12.7 0 7.4 1.5A8.5 8.5 0 0 0 1.5 7.4C0 12.7 0 24 0 24s0 11.3 1.5 16.6a8.5 8.5 0 0 0 5.9 5.9C12.7 48 34 48 34 48s21.3 0 26.6-1.5a8.5 8.5 0 0 0 5.9-5.9C68 35.3 68 24 68 24s0-11.3-1.5-16.6z" fill="#ff0000"/><path d="M27 34l18-10-18-10v20z" fill="#fff"/></svg>`;
    thumb.appendChild(play);

    const activate = () => {
      wrap.innerHTML = '';
      wrap.classList.add('is-playing');
      wrap.style.paddingBottom = '';
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
      wrap.appendChild(iframe);
    };
    thumb.addEventListener('click', e => { e.stopPropagation(); activate(); });
    thumb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); activate(); } });

    wrap.appendChild(thumb);
    container.appendChild(wrap);
  });
  container.hidden = false;
}


/* ── Selection, canvas geometry, and chip placement ── */

function findDuplicateName(name, excludeId = null) {
  const normalized = normalizeName(name);
  return state.items.find(item => item.id !== excludeId && normalizeName(item.name) === normalized);
}

function showAddError(message = '') {
  els.addError.textContent = message;
}

function clearDragGhost() {
  if (dragGhost) dragGhost.remove();
  dragGhost = null;
}

function renderSelection() {
  document.querySelectorAll('.tier-items-cell .item-chip').forEach(chip => {
    chip.classList.toggle('selected', selectedItemIds.has(chip.dataset.itemId));
  });
  if (entryPickMode) scheduleEntryPickOpacityUpdate();
}

function clearSelection() {
  selectedItemIds.clear();
  renderSelection();
}

function clearDragOverHighlights() {
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function canvasPointFromClient(clientX, clientY) {
  const rect = els.wrapper.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function getTierCell(tierId) {
  return document.querySelector(tierItemsCellSelector(tierId));
}

function getItemCanvasPosition(item) {
  if (!item?.tierId) return null;
  const cell = getTierCell(item.tierId);
  if (!cell) return null;
  const cellRect = cell.getBoundingClientRect();
  const wrapperRect = els.wrapper.getBoundingClientRect();
  return {
    x: cellRect.left - wrapperRect.left + (Number(item.xPct) || 50) / 100 * cellRect.width,
    y: cellRect.top - wrapperRect.top + (Number(item.yPct) || 50) / 100 * cellRect.height,
    tierId: item.tierId
  };
}

function getTierCellAtCanvasY(canvasY) {
  const wrapperRect = els.wrapper.getBoundingClientRect();
  let fallback = null;
  for (const cell of document.querySelectorAll('.tier-items-cell')) {
    const rect = cell.getBoundingClientRect();
    const top = rect.top - wrapperRect.top;
    const bottom = rect.bottom - wrapperRect.top;
    fallback = cell;
    if (canvasY >= top && canvasY <= bottom) return cell;
  }
  return fallback;
}

function applyItemCanvasPosition(item, canvasX, canvasY, width = 120, height = 28) {
  const wrapperRect = els.wrapper.getBoundingClientRect();
  const cell = getTierCellAtCanvasY(canvasY);
  if (!cell) return;
  const rect = cell.getBoundingClientRect();
  const left = rect.left - wrapperRect.left;
  const top = rect.top - wrapperRect.top;
  const localX = clamp(canvasX - left, width / 2, Math.max(width / 2, rect.width - width / 2));
  const localY = clamp(canvasY - top, height / 2, Math.max(height / 2, rect.height - height / 2));
  item.tierId = cell.dataset.tierId;
  els.detailPlaceholder?.classList.remove('active');

  const tier = getTierById(item.tierId);
  item.lastTierId = item.tierId;
  item.lastTierLabel = tier?.label || '';
  item.xPct = rect.width ? localX / rect.width * 100 : 50;
  item.yPct = rect.height ? localY / rect.height * 100 : 50;
  item.positionMode = 'center';
}

function tierGridTemplate() {
  const total = TIER_BOUNDARIES[TIER_BOUNDARIES.length - 1];
  return TIER_BOUNDARIES.slice(1).map((boundary, i) => `${((boundary - TIER_BOUNDARIES[i]) / total * 100).toFixed(4)}fr`).join(' ');
}

/* ── State normalization ── */

function normalizeState() {
  state.version = Number(state.version) || 4;
  const oldTiers = Array.isArray(state.tiers) ? state.tiers : [];
  state.title = typeof state.title === 'string' ? state.title : 'My Iceberg';
  state.entryFontSize = clamp(Number(state.entryFontSize) || 14, 10, 24);
  state.bgBlur = clamp(Number(state.bgBlur) || 0, 0, 2);
  state.showTierTitles = state.showTierTitles !== false;
  state.showPips = state.showPips !== false;
  state.entryDrift = state.entryDrift !== false;
  state.icebergLocked = state.icebergLocked === true;
  const allowedFonts = new Set([
    'Georgia, serif',
    'Arial Black, Arial, sans-serif',
    'Verdana, Geneva, sans-serif',
    'Trebuchet MS, Arial, sans-serif',
    'Courier New, monospace',
    'Impact, Haettenschweiler, sans-serif'
  ]);
  state.entryFontFamily = allowedFonts.has(state.entryFontFamily) ? state.entryFontFamily : 'Georgia, serif';
  const seenTierIds = new Set();
  const tierIdMap = new Map();
  state.tiers = DEFAULT_TIERS.map(([label, color], i) => {
    const rawTier = oldTiers[i] || {};
    const rawId = String(rawTier.id || '').trim();
    const id = rawId && !seenTierIds.has(rawId) ? rawId : uid();
    seenTierIds.add(id);
    if (rawId && !tierIdMap.has(rawId)) tierIdMap.set(rawId, id);
    return {
      id,
      label: String(rawTier.label || label).trim() || label,
      color: rawTier.color || color,
      labelImage: safeUrl(rawTier.labelImage || rawTier.image || ''),
      labelImageX: normalizeTierImagePosition(rawTier.labelImageX),
      labelImageY: normalizeTierImagePosition(rawTier.labelImageY),
      labelImageW: Math.max(0, Number(rawTier.labelImageW) || 0),
      labelImageH: Math.max(0, Number(rawTier.labelImageH) || 0)
    };
  });
  const validTierIds = new Set(state.tiers.map(t => t.id));
  state.items = Array.isArray(state.items) ? state.items : [];
  const seenItemIds = new Set();
  state.items.forEach(item => {
    const normalizedId = String(item.id || '').trim();
    item.id = normalizedId && !seenItemIds.has(normalizedId) ? normalizedId : uid();
    seenItemIds.add(item.id);
    item.name = String(item.name || '').trim() || 'Untitled';
    item.description = String(item.description || '');
    item.needsVerification = item.needsVerification === true || item.needsVerification === 'true';
    normalizeItemImages(item);
    if (/!\[[^\]]*\]\([^)]+\)/.test(item.description)) {
      const extracted = extractMarkdownImages(item.description);
      item.description = extracted.cleaned;
      item.images.push(...extracted.images);
    }
    const rawTierId = String(item.tierId || '').trim();
    const mappedTierId = rawTierId ? (tierIdMap.get(rawTierId) || rawTierId) : '';
    if (mappedTierId && validTierIds.has(mappedTierId)) {
      item.tierId = mappedTierId;
    } else {
      item.tierId = null;
      delete item.xPct;
      delete item.yPct;
    }
  });
}

/* ── Display settings (font, size, blur, pip visibility) ── */

function syncRangeFill(input) {
  if (!input) return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || 0);
  const pct = max > min ? clamp(((value - min) / (max - min)) * 100, 0, 100) : 0;
  input.style.setProperty('--range-fill', `${pct}%`);
}

function applyEntrySize() {
  document.documentElement.style.setProperty('--entry-size', `${state.entryFontSize}px`);
  els.entrySize.value = state.entryFontSize;
  els.entrySizeValue.textContent = `${state.entryFontSize}px`;
  syncRangeFill(els.entrySize);
}

function applyEntryFont() {
  document.documentElement.style.setProperty('--entry-font', state.entryFontFamily || 'Georgia, serif');
  if (els.entryFont) els.entryFont.value = state.entryFontFamily || 'Georgia, serif';
}

function applyBgBlur() {
  const v = clamp(Number(state.bgBlur) || 0, 0, 2);
  state.bgBlur = v;
  document.documentElement.style.setProperty('--bg-blur', `${v}px`);
  const slider = $('bg-blur');
  const label = $('bg-blur-value');
  if (slider) {
    slider.value = v;
    syncRangeFill(slider);
  }
  if (label) label.textContent = BG_BLUR_LABELS[v] || 'none';
}

function applyTierTitleVisibility() {
  const show = state.showTierTitles !== false;
  document.body.classList.toggle('hide-tier-titles', !show);
  if (els.showTierTitles) els.showTierTitles.checked = show;
}

function applyPipVisibility() {
  const show = state.showPips !== false;
  document.body.classList.toggle('hide-entry-pips', !show);
  if (els.showPips) els.showPips.checked = show;
}

function applyEntryDriftSetting() {
  const enabled = state.entryDrift === true;
  document.body.classList.toggle('entry-drift-enabled', enabled);
  if (els.entryDrift) els.entryDrift.checked = enabled;
  if (!enabled) clearEntryDriftOffsets();
}

/* ── Iceberg lock (read-only toggle + Lottie) ── */

function applyIcebergLockSetting(options = {}) {
  const { syncAnimation = true } = options;
  const locked = state.icebergLocked === true;
  document.body.classList.toggle('iceberg-locked', locked);
  if (locked) {
    clearDragOverHighlights();
    closeTierImageMenu();
    setTierImageMoveMode(null);
    closeEntryLinkPicker();
    stopEntryPickMode();
    els.imageManager?.classList.remove('drag-over');
    tierImageDrag = null;
  }
  if (!els.icebergLockToggle) return;
  const label = locked ? 'Unlock iceberg editing' : 'Lock iceberg editing';
  els.icebergLockToggle.classList.toggle('is-locked', locked);
  els.icebergLockToggle.setAttribute('aria-pressed', locked ? 'true' : 'false');
  els.icebergLockToggle.setAttribute('aria-label', label);
  els.icebergLockToggle.removeAttribute('title');
  delete els.icebergLockToggle.dataset.tooltip;
  const sr = document.getElementById('lock-sr-label');
  if (sr) sr.textContent = label;
  if (els.lockFallbackIcon) els.lockFallbackIcon.textContent = locked ? '🔐' : '🔓';
  if (els.title) {
    els.title.readOnly = locked;
    els.title.setAttribute('aria-readonly', locked ? 'true' : 'false');
  }
  if (locked && els.imageModal && !els.imageModal.hidden) syncImageModalEditingState();
  if (els.newName) els.newName.disabled = locked;
  const addButton = $('add-item-btn');
  if (addButton) addButton.disabled = locked;
  if (syncAnimation) setLockLottieState(locked, false);
}


function initLockLottie() {
  if (!els.lockLottie || typeof window.lottie === 'undefined') return;
  try {
    lockLottieAnim = window.lottie.loadAnimation({
      container: els.lockLottie,
      renderer: 'svg',
      loop: false,
      autoplay: false,
      path: LOCK_LOTTIE_PATH,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
        progressiveLoad: true
      }
    });
    lockLottieAnim.addEventListener('DOMLoaded', () => {
      lockLottieReady = true;
      lockLottieAnim.setSpeed?.(1);
      document.body.classList.add('has-lock-lottie');
      setLockLottieState(state.icebergLocked === true, false);
    });
    lockLottieAnim.addEventListener('enterFrame', () => {
      if (lockLottieColorLocked !== state.icebergLocked) recolorLockLottie(state.icebergLocked === true);
      else recolorLockLottie(state.icebergLocked === true);
    });
    lockLottieAnim.addEventListener('data_failed', () => {
      lockLottieReady = false;
      document.body.classList.remove('has-lock-lottie');
    });
  } catch (err) {
    lockLottieAnim = null;
    lockLottieReady = false;
    document.body.classList.remove('has-lock-lottie');
  }
}

function lockHoverActive() {
  return !!els.icebergLockToggle && (
    els.icebergLockToggle.matches(':hover') ||
    document.activeElement === els.icebergLockToggle
  );
}

function recolorLockLottie(locked = state.icebergLocked === true) {
  if (!els.lockLottie) return;
  const svg = els.lockLottie.querySelector('svg');
  if (!svg) return;
  const paths = [...svg.querySelectorAll('path')].filter(path => {
    const fill = String(path.getAttribute('fill') || path.style.fill || '').toLowerCase();
    return fill !== 'none';
  });
  if (!paths.length) return;
  const hover = lockHoverActive();
  const bodyColor = hover ? '#ffe76a' : locked ? '#d6ad24' : '#e8eef8';
  const keyholeColor = (hover || locked) ? '#5b2600' : '#0a0e1a';
  paths.forEach((path, index) => {
    path.style.fill = index === 1 ? keyholeColor : bodyColor;
    path.setAttribute('fill', index === 1 ? keyholeColor : bodyColor);
  });
  lockLottieColorLocked = locked;
}

function scheduleLockLottieRecolor(locked) {
  requestAnimationFrame(() => recolorLockLottie(locked));
}

function setLockLottieState(locked, animate = false) {
  if (!lockLottieAnim || !lockLottieReady) return;
  try {
    if (!animate) {
      lockLottieAnim.goToAndStop(locked ? LOCK_LOTTIE_CLOSED_FRAME : LOCK_LOTTIE_OPEN_FRAME, true);
      scheduleLockLottieRecolor(locked);
      return;
    }
    if (locked) {
      lockLottieAnim.playSegments([LOCK_LOTTIE_LOCK_START_FRAME, LOCK_LOTTIE_LOCK_END_FRAME], true);
    } else {
      lockLottieAnim.playSegments([LOCK_LOTTIE_UNLOCK_START_FRAME, LOCK_LOTTIE_UNLOCK_END_FRAME], true);
    }
    scheduleLockLottieRecolor(locked);
  } catch (err) {
    lockLottieAnim = null;
    lockLottieReady = false;
    document.body.classList.remove('has-lock-lottie');
  }
}

function triggerIcebergLockPulse(locked) {
  if (!els.wrapper) return;
  window.clearTimeout(lockPulseTimer);
  els.wrapper.classList.remove('lock-state-pulse', 'is-locking', 'is-unlocking');
  void els.wrapper.offsetWidth;
  els.wrapper.classList.add('lock-state-pulse', locked ? 'is-locking' : 'is-unlocking');
  lockPulseTimer = window.setTimeout(() => {
    els.wrapper?.classList.remove('lock-state-pulse', 'is-locking', 'is-unlocking');
    lockPulseTimer = 0;
  }, 1130);
}



function icebergEditingLocked() {
  return state.icebergLocked === true;
}

/* ── Entry drift (water effect) ── */

function clearEntryDriftOffsets() {
  if (entryDriftRaf) {
    cancelAnimationFrame(entryDriftRaf);
    entryDriftRaf = 0;
  }
  entryDriftPointer = null;
  document.querySelectorAll('.tier-items-cell .item-chip').forEach(chip => {
    chip.style.removeProperty('--drift-x');
    chip.style.removeProperty('--drift-y');
    chip.style.removeProperty('--drift-scale');
  });
}

function entryDriftShouldPause() {
  return state.entryDrift === false
    || dragItemId
    || fluidDrag
    || selectionBox
    || entryPickMode
    || tierImageDrag
    || document.body.classList.contains('entry-link-hover-line')
    || document.body.classList.contains('entry-link-exit-line');
}

function scheduleEntryDriftUpdate() {
  if (entryDriftRaf) return;
  entryDriftRaf = requestAnimationFrame(updateEntryDrift);
}

function updateEntryDrift() {
  entryDriftRaf = 0;
  if (!entryDriftPointer || entryDriftShouldPause()) {
    clearEntryDriftOffsets();
    return;
  }

  const falloffSpread = 38;
  const strengthFloor = 0.008;
  const maxDrift = 3.0;
  const maxScale = 1.005;
  const pointerX = entryDriftPointer.x;
  const pointerY = entryDriftPointer.y;
  document.querySelectorAll('.tier-items-cell .item-chip').forEach(chip => {
    if (chip.classList.contains('fluid-dragging') || chip.classList.contains('entry-load-in')) return;

    const rect = chip.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const fromCenterX = pointerX - cx;
    const fromCenterY = pointerY - cy;
    const centerDist = Math.hypot(fromCenterX, fromCenterY);

    // Measure proximity from the chip's box rather than only from its centre,
    // so hovering near any part of a word still gives it a gentle pull.
    const nearestX = clamp(pointerX, rect.left, rect.right);
    const nearestY = clamp(pointerY, rect.top, rect.bottom);
    const edgeDist = Math.hypot(pointerX - nearestX, pointerY - nearestY);

    // Use a Gaussian-style falloff instead of a linear radius cutoff.
    // This removes the visible hard edge while still keeping the pull local.
    const softStrength = Math.exp(-Math.pow(edgeDist / falloffSpread, 2));
    const isInsideChip = pointerX >= rect.left && pointerX <= rect.right && pointerY >= rect.top && pointerY <= rect.bottom;
    const insideDirectionFactor = isInsideChip
      ? clamp(centerDist / Math.max(12, Math.min(rect.width, rect.height) * 0.72), 0, 1)
      : 1;
    const strength = softStrength * insideDirectionFactor;
    if (strength < strengthFloor || centerDist < 0.75) {
      chip.style.setProperty('--drift-x', '0px');
      chip.style.setProperty('--drift-y', '0px');
      chip.style.setProperty('--drift-scale', '1');
      return;
    }
    const pull = strength * maxDrift;

    chip.style.setProperty('--drift-x', `${(fromCenterX / centerDist * pull).toFixed(2)}px`);
    chip.style.setProperty('--drift-y', `${(fromCenterY / centerDist * pull).toFixed(2)}px`);
    chip.style.setProperty('--drift-scale', (1 + (maxScale - 1) * strength).toFixed(4));
  });
}

/* ── Iceberg search ── */

function itemMatchesIcebergSearch(item) {
  const query = icebergSearchTerm.trim().toLowerCase();
  if (!query || !item.tierId) return false;
  const haystack = `${item.name || ''} ${item.description || ''}`.toLowerCase();
  return haystack.includes(query);
}

function updateIcebergSearchCount() {
  if (!els.icebergSearchCount) return;
  const query = icebergSearchTerm.trim();
  if (!query) {
    els.icebergSearchCount.textContent = '';
    els.icebergSearchCount.classList.remove('has-results');
    return;
  }
  const count = state.items.filter(itemMatchesIcebergSearch).length;
  els.icebergSearchCount.textContent = count === 1 ? '1 iceberg match' : `${count} iceberg matches`;
  els.icebergSearchCount.classList.toggle('has-results', count > 0);
}

function applyIcebergSearchVisuals() {
  const hasSearch = !!icebergSearchTerm.trim();
  document.querySelectorAll('.tier-items-cell').forEach(cell => {
    cell.classList.toggle('search-active', hasSearch);
  });
  document.querySelectorAll('.item-chip').forEach(chip => {
    const item = getItemById(chip.dataset.itemId);
    chip.classList.toggle('search-match', !!item && itemMatchesIcebergSearch(item));
  });
  scheduleSearchLinesUpdate();
}

function clearIcebergSearch({ clearInput = true } = {}) {
  icebergSearchTerm = '';
  if (clearInput && els.icebergSearch) els.icebergSearch.value = '';
  updateIcebergSearchCount();
  applyIcebergSearchVisuals();
}

/* ── Connector line rendering (entry-link hover and pick-mode pickwhip) ── */
function updateSearchLines() {
  const canvas = els.searchLines;
  if (!canvas) return;
  if (mobileLayoutActive()) {
    if (entryPickLineRaf) { cancelAnimationFrame(entryPickLineRaf); entryPickLineRaf = 0; }
    if (internalLinkExitRaf) { cancelAnimationFrame(internalLinkExitRaf); internalLinkExitRaf = 0; }
    const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (ctx) ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
    canvas.hidden = true;
    return;
  }
  if (entryPickMode) {
    drawEntryPickLine();
    return;
  }
  if (hoveredInternalLinkEl && hoveredInternalLinkTargetId) {
    drawInternalEntryLinkLine();
    return;
  }
  if (internalLinkExitConnector || internalLinkExitRaf) {
    if (!internalLinkExitRaf) tickInternalEntryLinkExitLine();
    return;
  }
  if (typeof canvas.getContext === 'function') {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
  }
  canvas.hidden = true;
}

function getPickLineStartPoint() {
  const sel = window.getSelection?.();
  if (sel && sel.rangeCount > 0 && sel.toString().trim()) {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect?.();
    if (rect && rect.width > 0) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  const source = (!els.detailDescRichEdit?.hidden && els.detailDescRichEdit) ||
    (!els.detailDescEdit?.hidden && els.detailDescEdit) ||
    $('description-editor-wrap') ||
    els.detailCard ||
    els.detailPickEntry;
  const rect = source?.getBoundingClientRect?.();
  if (!rect) return { x: window.innerWidth - 40, y: window.innerHeight / 2 };
  return { x: rect.left + rect.width, y: rect.top + rect.height / 2 };
}

function getPickLineEndPoint() {
  if (entryPickLineTargetId) {
    const chip = document.querySelector(itemChipSelector(entryPickLineTargetId));
    const rect = chip?.getBoundingClientRect?.();
    if (rect) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return entryPickLinePoint || getPickLineStartPoint();
}

function clearEntryPickLine() {
  if (entryPickLineRaf) cancelAnimationFrame(entryPickLineRaf);
  entryPickLineRaf = 0;
  entryPickLinePoint = null;
  entryPickLineTargetId = null;
  document.querySelectorAll('.item-chip.pick-target').forEach(chip => chip.classList.remove('pick-target'));
  const canvas = els.searchLines;
  if (!canvas) return;
  const ctx = canvas.getContext?.('2d');
  if (ctx) ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
  canvas.hidden = true;
}

function applyEntryPickOpacity(targetId = entryPickLineTargetId || null) {
  if (!entryPickMode) return;
  document.querySelectorAll('.tier-items-cell').forEach(cell => {
    cell.classList.add('search-active', 'entry-pick-dim-cell');
  });
  els.pool?.classList.add('entry-pick-dim-cell');
  document.querySelectorAll('.item-chip').forEach(chip => {
    const isTarget = !!targetId && chip.dataset.itemId === targetId;
    chip.classList.toggle('entry-pick-muted', !isTarget);
    chip.classList.toggle('entry-pick-active-target', isTarget);
    chip.classList.toggle('search-match', isTarget);
    chip.style.removeProperty('opacity');
    chip.style.removeProperty('filter');
  });
}

function scheduleEntryPickOpacityUpdate() {
  if (!entryPickMode || entryPickOpacityRaf) return;
  entryPickOpacityRaf = requestAnimationFrame(() => {
    entryPickOpacityRaf = 0;
    applyEntryPickOpacity(entryPickLineTargetId || null);
  });
}

function clearEntryPickOpacity() {
  if (entryPickOpacityRaf) cancelAnimationFrame(entryPickOpacityRaf);
  entryPickOpacityRaf = 0;
  const hasSearch = !!icebergSearchTerm.trim();
  document.querySelectorAll('.tier-items-cell').forEach(cell => {
    cell.classList.remove('entry-pick-dim-cell');
    cell.classList.toggle('search-active', hasSearch);
  });
  els.pool?.classList.remove('entry-pick-dim-cell');
  document.querySelectorAll('.item-chip').forEach(chip => {
    const item = getItemById(chip.dataset.itemId);
    chip.classList.remove('entry-pick-muted', 'entry-pick-active-target', 'pick-target');
    chip.classList.toggle('search-match', !!item && itemMatchesIcebergSearch(item));
    chip.style.removeProperty('opacity');
    chip.style.removeProperty('filter');
  });
}

function scheduleEntryPickLineUpdate() {
  if (entryPickLineRaf) cancelAnimationFrame(entryPickLineRaf);
  entryPickLineRaf = requestAnimationFrame(() => {
    entryPickLineRaf = 0;
    drawEntryPickLine();
  });
}

function drawEntryPickLine() {
  const canvas = els.searchLines;
  if (!canvas || !entryPickMode) return;
  applyEntryPickOpacity(entryPickLineTargetId || null);
  const start = getPickLineStartPoint();
  const end = getPickLineEndPoint();

  let progress = 1;
  if (entryPickLineTargetId) {
    if (entryPickDrawTargetId !== entryPickLineTargetId) {
      entryPickDrawTargetId = entryPickLineTargetId;
      entryPickDrawStartedAt = performance.now();
    }
    progress = clamp((performance.now() - entryPickDrawStartedAt) / 150, 0, 1);
  } else {
    entryPickDrawTargetId = null;
    entryPickDrawStartedAt = 0;
  }

  drawDottedConnector(start, end, {
    lineWidth: 2,
    dash: [7, 7],
    stroke: 'rgba(255,231,106,.82)',
    shadow: 'rgba(255,231,106,.45)',
    shadowBlur: 7,
    dotRadius: entryPickLineTargetId ? 4 : 3,
    progress
  });

  if (progress < 1) scheduleEntryPickLineUpdate();
}

function getChipFromPoint(clientX, clientY, fallbackTarget = null) {
  const direct = fallbackTarget?.closest?.('.item-chip');
  if (direct) return direct;
  const stack = document.elementsFromPoint ? document.elementsFromPoint(clientX, clientY) : [];
  for (const el of stack) {
    const chip = el.closest?.('.item-chip');
    if (chip) return chip;
  }
  return null;
}

function updateEntryPickLineFromPointer(e) {
  if (!entryPickMode) return;
  entryPickLinePoint = { x: e.clientX, y: e.clientY };
  const chip = getChipFromPoint(e.clientX, e.clientY, e.target);
  const nextTargetId = chip?.dataset?.itemId || null;
  if (nextTargetId !== entryPickLineTargetId) {
    document.querySelectorAll('.item-chip.pick-target').forEach(el => {
      if (el !== chip) el.classList.remove('pick-target');
    });
    if (chip) chip.classList.add('pick-target');
    entryPickLineTargetId = nextTargetId;
    entryPickDrawTargetId = null;
    entryPickDrawStartedAt = performance.now();
  }
  applyEntryPickOpacity(entryPickLineTargetId || null);
  scheduleEntryPickLineUpdate();
}

function getCanvasLineContext() {
  const canvas = els.searchLines;
  if (!canvas) return null;
  const ratio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const targetWidth = Math.max(1, Math.floor(width * ratio));
  const targetHeight = Math.max(1, Math.floor(height * ratio));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.hidden = false;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}

function bezierPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
    y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y
  };
}

function drawDottedConnector(start, end, options = {}) {
  const canvasContext = getCanvasLineContext();
  if (!canvasContext) return;
  const { ctx } = canvasContext;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const controlOffset = clamp(Math.abs(dx) * .42, 70, 220);
  const c1 = { x: start.x + Math.sign(dx || 1) * controlOffset, y: start.y + dy * .08 };
  const c2 = { x: end.x - Math.sign(dx || 1) * controlOffset * .55, y: end.y - dy * .08 };
  const progress = clamp(options.progress ?? 1, 0, 1);
  const startProgress = clamp(options.startProgress ?? 0, 0, progress);
  const steps = 42;
  const startStep = Math.floor(steps * startProgress);
  const drawnSteps = Math.max(startStep + 1, Math.ceil(steps * progress));
  const points = [];
  for (let i = startStep; i <= drawnSteps; i++) {
    const t = clamp(i / steps, startProgress, progress);
    points.push(bezierPoint(start, c1, c2, end, t));
  }
  if (!points.length) points.push(bezierPoint(start, c1, c2, end, progress));
  const tip = points[points.length - 1] || end;

  ctx.save();
  ctx.globalAlpha = clamp(options.opacity ?? 1, 0, 1);
  ctx.lineWidth = options.lineWidth || 1.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(options.dash || [5, 7]);
  ctx.strokeStyle = options.stroke || 'rgba(255,231,106,.74)';
  ctx.shadowColor = options.shadow || 'rgba(255,231,106,.38)';
  ctx.shadowBlur = options.shadowBlur ?? 6;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.shadowBlur = 7;
  ctx.fillStyle = options.dot || 'rgba(255,231,106,.9)';
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, options.dotRadius || 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function getInternalEntryLinkConnectorPoints() {
  if (!hoveredInternalLinkEl || !hoveredInternalLinkTargetId) return null;
  const targetChip = document.querySelector(itemChipSelector(hoveredInternalLinkTargetId, true));
  const sourceRect = hoveredInternalLinkEl.getBoundingClientRect?.();
  const targetRect = targetChip?.getBoundingClientRect?.();
  if (!sourceRect || !targetRect || sourceRect.width <= 0 || targetRect.width <= 0) return null;
  return {
    start: { x: sourceRect.left + sourceRect.width / 2, y: sourceRect.top + sourceRect.height / 2 },
    end: { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 }
  };
}

function startInternalEntryLinkExitLine(connector) {
  if (!connector) {
    updateSearchLines();
    return;
  }
  if (internalLinkExitRaf) cancelAnimationFrame(internalLinkExitRaf);
  internalLinkExitConnector = connector;
  internalLinkExitStartedAt = performance.now();
  document.body.classList.add('entry-link-exit-line');
  tickInternalEntryLinkExitLine();
}

function tickInternalEntryLinkExitLine() {
  if (!internalLinkExitConnector) return;
  drawInternalEntryLinkExitLine();
  if (internalLinkExitConnector) {
    internalLinkExitRaf = requestAnimationFrame(() => {
      internalLinkExitRaf = 0;
      tickInternalEntryLinkExitLine();
    });
  }
}

function drawInternalEntryLinkExitLine() {
  if (!internalLinkExitConnector) return;
  const elapsed = performance.now() - internalLinkExitStartedAt;
  const DURATION = 260;
  const t = clamp(elapsed / DURATION, 0, 1);
  const startProgress = t;
  const opacity = t > 0.65 ? clamp(1 - (t - 0.65) / 0.35, 0, 1) : 1;
  drawDottedConnector(internalLinkExitConnector.start, internalLinkExitConnector.end, {
    lineWidth: 1.7,
    dash: [4, 7],
    stroke: 'rgba(255,231,106,.72)',
    shadow: 'rgba(255,231,106,.38)',
    shadowBlur: 5,
    dotRadius: 3.2,
    startProgress,
    progress: 1,
    opacity
  });
  if (t >= 1) {
    internalLinkExitConnector = null;
    internalLinkExitStartedAt = 0;
    internalLinkExitRaf = 0;
    document.body.classList.remove('entry-link-exit-line');
    updateSearchLines();
  }
}

function clearInternalEntryLinkLine() {
  if (mobileLayoutActive()) {
    hoveredInternalLinkEl = null;
    hoveredInternalLinkTargetId = null;
    internalLinkDrawStartedAt = 0;
    internalLinkDrawTargetId = null;
    internalLinkExitConnector = null;
    internalLinkExitStartedAt = 0;
    if (internalLinkExitRaf) { cancelAnimationFrame(internalLinkExitRaf); internalLinkExitRaf = 0; }
    document.body.classList.remove('entry-link-hover-line', 'entry-link-exit-line', 'entry-link-fade-return');
    document.querySelectorAll('.item-chip').forEach(chip => chip.classList.remove('entry-link-muted', 'entry-link-active-target', 'entry-link-source'));
    const canvas = els.searchLines;
    const ctx = canvas?.getContext?.('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width || 0, canvas.height || 0);
    if (canvas) canvas.hidden = true;
    return;
  }
  const exitConnector = getInternalEntryLinkConnectorPoints();
  hoveredInternalLinkEl = null;
  hoveredInternalLinkTargetId = null;
  internalLinkDrawStartedAt = 0;
  internalLinkDrawTargetId = null;
  if (entryPickMode) return;

  if (internalLinkScrollSourceChip) {
    const src = internalLinkScrollSourceChip;
    internalLinkScrollSourceChip = null;
    setTimeout(() => src.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }), 320);
  }

  if (internalLinkFadeReturnTimer) clearTimeout(internalLinkFadeReturnTimer);

  // Put the slow-return transition in place before removing the dimmed hover state.
  document.body.classList.add('entry-link-fade-return');
  requestAnimationFrame(() => {
    document.body.classList.remove('entry-link-hover-line');
    const hasSearch = !!icebergSearchTerm.trim();
    document.querySelectorAll('.tier-items-cell').forEach(cell => {
      cell.classList.remove('entry-pick-dim-cell');
      cell.classList.toggle('search-active', hasSearch);
    });
    els.pool?.classList.remove('entry-pick-dim-cell');
    document.querySelectorAll('.item-chip').forEach(chip => {
      const item = getItemById(chip.dataset.itemId);
      chip.classList.remove('entry-link-muted', 'entry-link-active-target', 'entry-pick-muted', 'entry-pick-active-target', 'entry-link-source');
      chip.classList.toggle('search-match', !!item && itemMatchesIcebergSearch(item));
    });
  });

  internalLinkFadeReturnTimer = setTimeout(() => {
    document.body.classList.remove('entry-link-fade-return');
    internalLinkFadeReturnTimer = 0;
  }, ENTRY_LINK_FADE_RETURN_MS);

  startInternalEntryLinkExitLine(exitConnector);
}

function drawInternalEntryLinkLine() {
  if (!hoveredInternalLinkEl || !hoveredInternalLinkTargetId || entryPickMode) return;
  const connector = getInternalEntryLinkConnectorPoints();
  if (!connector) {
    clearInternalEntryLinkLine();
    return;
  }
  const progress = clamp((performance.now() - internalLinkDrawStartedAt) / 260, 0, 1);
  drawDottedConnector(connector.start, connector.end, {
    lineWidth: 1.7,
    dash: [4, 7],
    stroke: 'rgba(255,231,106,.68)',
    shadow: 'rgba(255,231,106,.34)',
    shadowBlur: 5,
    dotRadius: 3.2,
    progress
  });
  if (progress < 1) scheduleSearchLinesUpdate();
}

function showInternalEntryLinkLine(link) {
  if (mobileLayoutActive()) return;
  const target = link?.dataset?.entryId || link?.dataset?.entryTarget;
  const item = findItemByEntryLinkTarget(target);
  if (!item?.tierId) return;
  if (internalLinkExitRaf) cancelAnimationFrame(internalLinkExitRaf);
  internalLinkExitRaf = 0;
  internalLinkExitConnector = null;
  internalLinkExitStartedAt = 0;
  document.body.classList.remove('entry-link-fade-return');
  hoveredInternalLinkEl = link;
  hoveredInternalLinkTargetId = item.id;
  internalLinkDrawTargetId = item.id;
  internalLinkDrawStartedAt = performance.now();
  document.body.classList.add('entry-link-hover-line');

  const targetChip = document.querySelector(itemChipSelector(item.id, true));
  const sourceChip = currentItemId ? document.querySelector(itemChipSelector(currentItemId, true)) : null;
  if (sourceChip) sourceChip.classList.add('entry-link-source');
  if (targetChip) {
    internalLinkScrollSourceChip = sourceChip || null;
    targetChip.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  document.querySelectorAll('.item-chip').forEach(chip => {
    const isTarget = chip.dataset.itemId === item.id;
    chip.classList.toggle('entry-link-muted', !isTarget);
    chip.classList.toggle('entry-link-active-target', isTarget);
    chip.classList.toggle('entry-pick-active-target', isTarget);
    const linkedItem = getItemById(chip.dataset.itemId);
    chip.classList.toggle('search-match', !!linkedItem && itemMatchesIcebergSearch(linkedItem));
  });
  scheduleSearchLinesUpdate();
}

function scheduleSearchLinesUpdate() {
  if (searchLinesRaf) cancelAnimationFrame(searchLinesRaf);
  searchLinesRaf = requestAnimationFrame(() => {
    searchLinesRaf = 0;
    updateSearchLines();
  });
}

/* ── Render loop ── */
function render() {
  normalizeState();
  els.title.value = state.title;
  els.title.style.height = 'auto';
  els.title.style.height = els.title.scrollHeight + 'px';
  applyEntrySize();
  applyEntryFont();
  applyBgBlur();
  applyTierTitleVisibility();
  applyPipVisibility();
  applyEntryDriftSetting();
  applyIcebergLockSetting();
  const animateEntries = entryLoadAnimationPending;
  renderTiers(animateEntries);
  renderPool();
  entryLoadAnimationPending = false;
  updateIcebergSearchCount();
  scheduleSearchLinesUpdate();
  if (currentItemId) renderDetailPanel();
  scheduleAutosave();
}


function normalizeTierImagePosition(value) {
  const num = Number(value);
  return Number.isFinite(num) ? clamp(num, 0, 100) : 50;
}

function setTierImageMenuOpen(tierId = null) {
  activeTierImageMenuId = tierId;
  document.querySelectorAll('.tier-label-cell').forEach(cell => {
    const isOpen = !!tierId && cell.dataset.tierId === tierId;
    cell.classList.toggle('tier-image-menu-open', isOpen);
    const toggle = cell.querySelector('.tier-image-menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}

function closeTierImageMenu() {
  setTierImageMenuOpen(null);
}

function setTierImageMoveMode(tierId) {
  if (tierId && icebergEditingLocked()) return;
  tierImageMoveModeId = tierId || null;
  document.querySelectorAll('.tier-label-cell.tier-image-move-mode').forEach(cell => cell.classList.remove('tier-image-move-mode'));
  if (!tierImageMoveModeId) return;
  const cell = document.querySelector(tierLabelCellSelector(tierImageMoveModeId));
  if (cell) cell.classList.add('tier-image-move-mode');
}

function loadImageNaturalSize(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = src;
  });
}

function getTierImageRanges(tier, cell, img) {
  const rect = cell?.getBoundingClientRect?.();
  const boxW = Math.max(1, rect?.width || 1);
  const boxH = Math.max(1, rect?.height || 1);
  const imageW = Math.max(1, Number(tier?.labelImageW) || img?.naturalWidth || 1);
  const imageH = Math.max(1, Number(tier?.labelImageH) || img?.naturalHeight || 1);
  const imageAspect = imageW / imageH;
  const boxAspect = boxW / boxH;
  const wider = imageAspect > boxAspect + 0.001;
  const taller = imageAspect < boxAspect - 0.001;
  return {
    xMovable: wider,
    yMovable: taller,
    extraX: wider ? Math.max(1, boxH * imageAspect - boxW) : 1,
    extraY: taller ? Math.max(1, boxW / imageAspect - boxH) : 1
  };
}

function applyTierImagePosition(tierId) {
  const tier = getTierById(tierId);
  const cell = document.querySelector(tierLabelCellSelector(tierId || ''));
  if (!tier || !cell) return;
  cell.style.setProperty('--tier-image-x', `${normalizeTierImagePosition(tier.labelImageX)}%`);
  cell.style.setProperty('--tier-image-y', `${normalizeTierImagePosition(tier.labelImageY)}%`);
}

function beginTierImageMove(e) {
  if (icebergEditingLocked()) return;
  if (!tierImageMoveModeId) return;
  const cell = e.target.closest?.('.tier-label-cell');
  if (!cell || cell.dataset.tierId !== tierImageMoveModeId) return;
  const tier = getTierById(tierImageMoveModeId);
  if (!tier?.labelImage) return;
  const img = cell.querySelector('.tier-label-image');
  const ranges = getTierImageRanges(tier, cell, img);
  e.preventDefault();
  e.stopPropagation();
  closeTierImageMenu();
  cell.classList.add('tier-image-moving');
  cell.setPointerCapture?.(e.pointerId);
  tierImageDrag = {
    tierId: tier.id,
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    baseX: normalizeTierImagePosition(tier.labelImageX),
    baseY: normalizeTierImagePosition(tier.labelImageY),
    ranges
  };
}

function updateTierImageMove(e) {
  if (!tierImageDrag || e.pointerId !== tierImageDrag.pointerId) return;
  const tier = getTierById(tierImageDrag.tierId);
  if (!tier) return;
  const dx = e.clientX - tierImageDrag.startX;
  const dy = e.clientY - tierImageDrag.startY;
  const { ranges } = tierImageDrag;
  if (ranges.xMovable) tier.labelImageX = clamp(tierImageDrag.baseX - (dx / ranges.extraX * 100), 0, 100);
  else tier.labelImageX = 50;
  if (ranges.yMovable) tier.labelImageY = clamp(tierImageDrag.baseY - (dy / ranges.extraY * 100), 0, 100);
  else tier.labelImageY = 50;
  applyTierImagePosition(tier.id);
}

function endTierImageMove(e) {
  if (!tierImageDrag || (e?.pointerId != null && e.pointerId !== tierImageDrag.pointerId)) return;
  const cell = document.querySelector(tierLabelCellSelector(tierImageDrag.tierId));
  cell?.classList.remove('tier-image-moving');
  tierImageDrag = null;
  setTierImageMoveMode(null);
  scheduleAutosave();
}


async function setTierLabelImage(tierId, file) {
  if (icebergEditingLocked()) return;
  const tier = getTierById(tierId);
  if (!tier || !file) return;
  try {
    tier.labelImage = await imageFileToDataUrl(file);
    const size = await loadImageNaturalSize(tier.labelImage);
    tier.labelImageW = size.width;
    tier.labelImageH = size.height;
    tier.labelImageX = 50;
    tier.labelImageY = 50;
    renderTiers();
    scheduleAutosave();
  } catch (err) {
    showLoadNotice({
      title: 'Could not add layer image',
      copy: err?.message || 'Use a valid image file.',
      lines: [],
      tone: 'error',
      autoHide: true
    });
  }
}

function clearTierLabelImage(tierId) {
  if (icebergEditingLocked()) return;
  const tier = getTierById(tierId);
  if (!tier) return;
  tier.labelImage = '';
  tier.labelImageX = 50;
  tier.labelImageY = 50;
  tier.labelImageW = 0;
  tier.labelImageH = 0;
  if (tierImageMoveModeId === tierId) setTierImageMoveMode(null);
  renderTiers();
  scheduleAutosave();
}

function renderTiers(animateEntries = false) {
  const fragment = document.createDocumentFragment();
  const entryLoadOrder = new Map();
  els.tiers.innerHTML = '';
  els.tiers.style.gridTemplateRows = tierGridTemplate();

  if (animateEntries) {
    const tierIndexById = new Map(state.tiers.map((tier, index) => [tier.id, index]));
    state.items
      .filter(item => item.tierId)
      .sort((a, b) => {
        const ay = (tierIndexById.get(a.tierId) ?? 999) * 1000 + (Number(a.yPct) || 0);
        const by = (tierIndexById.get(b.tierId) ?? 999) * 1000 + (Number(b.yPct) || 0);
        if (ay !== by) return ay - by;
        return (Number(a.xPct) || 0) - (Number(b.xPct) || 0);
      })
      .forEach((item, rank) => entryLoadOrder.set(item.id, rank));
  }

  state.tiers.forEach((tier, index) => {
    const row = document.createElement('div');
    row.className = 'tier-row';
    row.dataset.tierId = tier.id;

    const itemsCell = document.createElement('div');
    itemsCell.className = 'tier-items-cell';
    if (icebergSearchTerm.trim()) itemsCell.classList.add('search-active');
    itemsCell.dataset.tierId = tier.id;

    state.items.filter(item => item.tierId === tier.id).forEach((item, itemIndex) => {
      itemsCell.appendChild(makeChip(item, itemIndex, entryLoadOrder.get(item.id)));
    });

    const labelCell = document.createElement('div');
    labelCell.className = 'tier-label-cell';
    labelCell.dataset.tierId = tier.id;
    labelCell.style.setProperty('--tier-color', tier.color || 'transparent');

    if (tier.labelImage) {
      labelCell.classList.add('has-tier-image');
      const labelImage = document.createElement('img');
      labelImage.className = 'tier-label-image';
      labelImage.src = tier.labelImage;
      labelImage.alt = '';
      labelImage.loading = 'lazy';
      labelCell.style.setProperty('--tier-image-x', `${normalizeTierImagePosition(tier.labelImageX)}%`);
      labelCell.style.setProperty('--tier-image-y', `${normalizeTierImagePosition(tier.labelImageY)}%`);
      labelCell.appendChild(labelImage);
    }

    const labelTitle = document.createElement('textarea');
    labelTitle.className = 'tier-label-input';
    labelTitle.value = tier.label;
    labelTitle.rows = 1;
    labelTitle.spellcheck = false;
    labelTitle.dataset.tierId = tier.id;
    labelTitle.dataset.tierIndex = index;
    labelTitle.setAttribute('aria-label', 'Tier name');
    if (icebergEditingLocked()) {
      labelTitle.readOnly = true;
      labelTitle.setAttribute('aria-readonly', 'true');
      labelTitle.tabIndex = -1;
    }
    labelCell.appendChild(labelTitle);
    labelTitle.style.height = 'auto';
    labelTitle.style.height = Math.max(labelTitle.scrollHeight + 14, 58) + 'px';

    const imageControls = document.createElement('div');
    imageControls.className = 'tier-label-image-controls';

    const menuToggle = document.createElement('button');
    menuToggle.type = 'button';
    menuToggle.className = 'tier-image-menu-toggle';
    menuToggle.dataset.tierId = tier.id;
    menuToggle.setAttribute('aria-label', `Layer image options for ${tier.label || 'layer'}`);
    menuToggle.setAttribute('aria-expanded', activeTierImageMenuId === tier.id ? 'true' : 'false');
    menuToggle.textContent = '⋮';
    imageControls.appendChild(menuToggle);

    const menu = document.createElement('div');
    menu.className = 'tier-image-menu app-menu-panel';

    const addAction = document.createElement('button');
    addAction.type = 'button';
    addAction.className = 'tier-image-action menu-item';
    addAction.dataset.action = 'image';
    addAction.dataset.tierId = tier.id;
    addAction.textContent = tier.labelImage ? 'Replace image' : 'Add image';
    menu.appendChild(addAction);

    if (tier.labelImage) {
      const moveAction = document.createElement('button');
      moveAction.type = 'button';
      moveAction.className = 'tier-image-action menu-item';
      moveAction.dataset.action = 'move';
      moveAction.dataset.tierId = tier.id;
      moveAction.textContent = 'Move';
      menu.appendChild(moveAction);
    }

    if (tier.labelImage) {
      const removeAction = document.createElement('button');
      removeAction.type = 'button';
      removeAction.className = 'tier-image-action menu-item danger';
      removeAction.dataset.action = 'remove';
      removeAction.dataset.tierId = tier.id;
      removeAction.textContent = 'Remove image';
      menu.appendChild(removeAction);
    }

    imageControls.appendChild(menu);
    if (activeTierImageMenuId === tier.id) labelCell.classList.add('tier-image-menu-open');
    if (tierImageMoveModeId === tier.id) labelCell.classList.add('tier-image-move-mode');
    if (!icebergEditingLocked()) labelCell.appendChild(imageControls);

    row.append(itemsCell, labelCell);
    fragment.appendChild(row);
  });

  els.tiers.appendChild(fragment);
  renderSelection();
}

function renderPool() {
  const fragment = document.createDocumentFragment();
  els.pool.innerHTML = '';
  const unplaced = state.items.filter(item => !item.tierId);
  if (!unplaced.length) {
    const empty = document.createElement('div');
    empty.className = 'unplaced-empty';
    empty.textContent = 'No unplaced items.';
    fragment.appendChild(empty);
  } else {
    unplaced.forEach(item => fragment.appendChild(makeChip(item)));
  }
  els.pool.appendChild(fragment);
}

function makeChip(item, itemIndex = 0, entryLoadRank = null) {
  const chip = document.createElement('div');
  chip.className = 'item-chip';
  if (item.needsVerification) chip.classList.add('needs-verification');
  if (item.images?.length) chip.classList.add('has-images');
  chip.draggable = !item.tierId && !icebergEditingLocked();
  chip.dataset.itemId = item.id;

  if (item.tierId) {
    const defaultX = 2 + (itemIndex % 4) * 23;
    const defaultY = 8 + Math.floor(itemIndex / 4) * 16;
    chip.style.left = `${item.xPct ?? defaultX}%`;
    chip.style.top = `${item.yPct ?? defaultY}%`;
    if (entryLoadRank != null) {
      chip.classList.add('entry-load-in');
      chip.style.animationDelay = `${entryLoadRank * 8}ms`;
      const delay = entryLoadRank * 8 + 200;
      setTimeout(() => chip.classList.remove('entry-load-in'), delay);
    }
    if (itemMatchesIcebergSearch(item)) chip.classList.add('search-match');
  }

  const text = document.createElement('span');
  text.className = 'item-chip-text';
  text.textContent = item.name;

  const pips = [];
  if (item.needsVerification) pips.push('verify');
  if (!hasItemDescription(item)) pips.push('missing-description');

  if (pips.length) {
    const pipWrap = document.createElement('span');
    pipWrap.className = 'chip-pips';
    pips.forEach(type => {
      const pip = document.createElement('span');
      pip.className = `chip-pip chip-pip--${type}`;
      pipWrap.appendChild(pip);
    });
    text.appendChild(pipWrap);
    const hints = [];
    if (item.needsVerification) hints.push('needs verified');
    if (!hasItemDescription(item)) hints.push('no description');
    if (hints.length) chip.setAttribute('aria-label', `${item.name} (${hints.join(', ')})`);
  } else {
    chip.setAttribute('aria-label', item.name);
  }

  chip.appendChild(text);

  if (!item.tierId) {
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'chip-delete-btn';
    del.dataset.itemId = item.id;
    del.setAttribute('aria-label', `Delete ${item.name}`);
    del.textContent = '×';
    if (icebergEditingLocked()) {
      del.disabled = true;
      del.tabIndex = -1;
      del.setAttribute('aria-hidden', 'true');
    }
    chip.appendChild(del);
  }

  return chip;
}

function addItem() {
  if (icebergEditingLocked()) return;
  const name = els.newName.value.trim();
  if (!name) {
    showAddError('');
    els.newName.focus();
    return;
  }
  if (findDuplicateName(name)) {
    showAddError(`${name} already exists!`);
    els.newName.focus();
    els.newName.select();
    return;
  }
  state.items.push({ id: uid(), name, description: '', images: [], needsVerification: false, tierId: null });
  els.newName.value = '';
  showAddError('');
  els.newName.focus();
  renderPool();
  scheduleAutosave();
}

function removeItemToPool(item) {
  if (item.tierId) {
    const tier = getTierById(item.tierId);
    item.lastTierId = item.tierId;
    item.lastTierLabel = tier?.label || '';
  }
  item.tierId = null;
  delete item.xPct;
  delete item.yPct;
}

function deleteItem(id) {
  selectedItemIds.delete(id);
  linkedEntryBackStack = linkedEntryBackStack.filter(entryId => entryId !== id);
  if (currentItemId === id) closeImagePreviewForItemChange();
  state.items = state.items.filter(item => item.id !== id);
  if (currentItemId === id) currentItemId = null;
  if (hoveredPreviewItemId === id) hideHoverPreview();
  render();
  renderDetailPanel();
}

/* ── Drag handling (HTML5 native + fluid pointer drag) ── */
function endFluidDrag(commit = true, clientX = null, clientY = null) {
  if (!fluidDrag) return;

  const drag = fluidDrag;
  fluidDrag = null;
  document.querySelector('.layout')?.classList.remove('fluid-drag-active');
  cancelAnimationFrame(drag.raf);

  drag.entries.forEach(entry => {
    entry.chip.classList.remove('fluid-dragging');
    entry.chip.style.removeProperty('--drag-x');
    entry.chip.style.removeProperty('--drag-y');
    entry.chip.style.removeProperty('--drag-left');
    entry.chip.style.removeProperty('--drag-top');
    entry.chip.style.removeProperty('--drag-width');
    entry.chip.style.removeProperty('--drag-text-width');
    entry.chip.style.removeProperty('--drag-scale');
  });

  const movedEnough = Math.abs(drag.dx) > 3 || Math.abs(drag.dy) > 3;

  if (commit && movedEnough) {
    const dropTarget = clientX != null && clientY != null ? document.elementFromPoint(clientX, clientY) : null;
    const droppedOnPool = dropTarget?.closest?.('.unplaced-pool');

    if (droppedOnPool) {
      drag.entries.forEach(entry => {
        const item = getItemById(entry.id);
        if (item) removeItemToPool(item);
      });
    } else {
      drag.entries.forEach(entry => {
        const item = getItemById(entry.id);
        if (item) applyItemCanvasPosition(item, entry.start.x + drag.dx, entry.start.y + drag.dy, entry.width, entry.height);
      });
    }

    selectionMoved = true;
    selectedItemIds.clear();
    render();
  } else {
    renderSelection();
  }
}

function renderFluidDragFrame() {
  if (!fluidDrag) return;
  fluidDrag.raf = 0;

  const ease = 0.34;
  fluidDrag.renderedDx += (fluidDrag.dx - fluidDrag.renderedDx) * ease;
  fluidDrag.renderedDy += (fluidDrag.dy - fluidDrag.renderedDy) * ease;

  if (Math.abs(fluidDrag.dx - fluidDrag.renderedDx) < 0.35) fluidDrag.renderedDx = fluidDrag.dx;
  if (Math.abs(fluidDrag.dy - fluidDrag.renderedDy) < 0.35) fluidDrag.renderedDy = fluidDrag.dy;

  fluidDrag.entries.forEach(entry => {
    const left = `${(entry.startClientCenterX + fluidDrag.renderedDx).toFixed(2)}px`;
    const top = `${(entry.startClientCenterY + fluidDrag.renderedDy).toFixed(2)}px`;
    entry.chip.style.setProperty('--drag-left', left);
    entry.chip.style.setProperty('--drag-top', top);
  });

  if (fluidDrag.renderedDx !== fluidDrag.dx || fluidDrag.renderedDy !== fluidDrag.dy) {
    fluidDrag.raf = requestAnimationFrame(renderFluidDragFrame);
  }
}

function updateFluidDrag(e) {
  if (!fluidDrag) return;
  fluidDrag.dx = e.clientX - fluidDrag.startClientX;
  fluidDrag.dy = e.clientY - fluidDrag.startClientY;
  if (!fluidDrag.raf) fluidDrag.raf = requestAnimationFrame(renderFluidDragFrame);
}

function beginFluidDrag(e) {
  if (icebergEditingLocked() || mobileLayoutActive()) return;
  if (e.button !== 0 || e.target.closest('.chip-delete-btn')) return;
  const chip = e.target.closest('.tier-items-cell .item-chip');
  if (!chip) return;

  const item = getItemById(chip.dataset.itemId);
  if (!item?.tierId) return;

  e.preventDefault();
  e.stopPropagation();
  hideHoverPreview();
  endFluidDrag(false);

  if (!selectedItemIds.has(item.id)) {
    selectedItemIds = new Set([item.id]);
    renderSelection();
  }

  const ids = [...selectedItemIds].filter(id => state.items.some(i => i.id === id && i.tierId));
  const entries = ids.map(id => {
    const dragItem = getItemById(id);
    const dragChip = document.querySelector(itemChipSelector(id, true));
    const start = getItemCanvasPosition(dragItem);
    if (!dragItem || !dragChip || !start) return null;
    const rect = dragChip.getBoundingClientRect();
    const textEl = dragChip.querySelector('.item-chip-text');
    const textRect = textEl?.getBoundingClientRect();
    return {
      id,
      chip: dragChip,
      start,
      width: dragChip.offsetWidth || rect.width || 120,
      height: dragChip.offsetHeight || rect.height || 28,
      textWidth: Math.ceil(textRect?.width || textEl?.offsetWidth || dragChip.offsetWidth || rect.width || 120),
      startClientCenterX: rect.left + rect.width / 2,
      startClientCenterY: rect.top + rect.height / 2
    };
  }).filter(Boolean);

  if (!entries.length) return;

  document.querySelector('.layout')?.classList.add('fluid-drag-active');

  fluidDrag = {
    pointerId: e.pointerId,
    startClientX: e.clientX,
    startClientY: e.clientY,
    dx: 0,
    dy: 0,
    renderedDx: 0,
    renderedDy: 0,
    raf: 0,
    entries
  };

  entries.forEach(entry => {
    entry.chip.style.setProperty('--drag-left', `${entry.startClientCenterX.toFixed(2)}px`);
    entry.chip.style.setProperty('--drag-top', `${entry.startClientCenterY.toFixed(2)}px`);
    entry.chip.style.setProperty('--drag-width', `${Math.ceil(entry.width)}px`);
    entry.chip.style.setProperty('--drag-text-width', `${Math.ceil(entry.textWidth)}px`);
    entry.chip.style.setProperty('--drag-scale', '1.04');
    entry.chip.classList.add('fluid-dragging');
  });

  chip.setPointerCapture?.(e.pointerId);
}

function makeDragGhost(chip, item) {
  clearDragGhost();

  const chipStyles = getComputedStyle(chip);
  const textEl = chip.querySelector('.item-chip-text');
  const textStyles = getComputedStyle(textEl || chip);
  const textRect = (textEl || chip).getBoundingClientRect();
  const lockedWidth = Math.ceil(textRect.width || textEl?.offsetWidth || chip.offsetWidth || 120);

  dragGhost = document.createElement('div');
  dragGhost.className = 'drag-ghost';
  dragGhost.textContent = item?.name || textEl?.textContent || chip.textContent.trim();

  Object.assign(dragGhost.style, {
    fontFamily: chipStyles.fontFamily,
    fontSize: textStyles.fontSize,
    fontWeight: chipStyles.fontWeight,
    letterSpacing: chipStyles.letterSpacing,
    lineHeight: chipStyles.lineHeight,
    textAlign: item?.tierId ? 'center' : 'left',
    whiteSpace: item?.tierId ? textStyles.whiteSpace : 'nowrap',
    overflowWrap: textStyles.overflowWrap,
    wordBreak: textStyles.wordBreak,
    width: item?.tierId ? `${lockedWidth}px` : 'auto',
    minWidth: item?.tierId ? `${lockedWidth}px` : '0',
    maxWidth: item?.tierId ? `${lockedWidth}px` : 'none',
    padding: '0',
    margin: '0',
    background: 'transparent',
    border: '0',
    boxShadow: 'none',
    boxSizing: 'border-box'
  });

  document.body.appendChild(dragGhost);
  return dragGhost;
}

function setDragItemFromEvent(e) {
  if (icebergEditingLocked()) {
    e.preventDefault();
    return null;
  }
  if (e.target.closest('.chip-delete-btn')) {
    e.preventDefault();
    return null;
  }
  const chip = e.target.closest('.item-chip');
  if (!chip) return null;

  dragItemId = chip.dataset.itemId;
  const item = getItemById(dragItemId);
  if (!item) return null;

  if (item.tierId) {
    e.preventDefault();
    dragItemId = null;
    clearDragGhost();
    return null;
  }


  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragItemId);

  const ghost = makeDragGhost(chip, item);
  e.dataTransfer.setDragImage?.(ghost, Math.round((ghost.offsetWidth || chip.offsetWidth) / 2), Math.round((ghost.offsetHeight || chip.offsetHeight) / 2));


  setTimeout(() => chip.classList.add('dragging'), 0);
  return chip;
}

function dropOnTier(e, tierId) {
  e.preventDefault();
  clearDragOverHighlights();
  if (icebergEditingLocked()) return;
  const cell = e.target.closest('.tier-items-cell');
  if (!cell) return;
  if (!dragItemId) return;

  const item = getItemById(dragItemId);
  if (!item || item.tierId) return;

  const rect = cell.getBoundingClientRect();
  const chip = document.querySelector(itemChipSelector(dragItemId));
  const chipWidth = chip?.offsetWidth || dragGhost?.offsetWidth || 120;
  const chipHeight = chip?.offsetHeight || dragGhost?.offsetHeight || 28;
  const centerX = clamp(e.clientX - rect.left, chipWidth / 2, Math.max(chipWidth / 2, rect.width - chipWidth / 2));
  const centerY = clamp(e.clientY - rect.top, chipHeight / 2, Math.max(chipHeight / 2, rect.height - chipHeight / 2));

  item.tierId = tierId;
  const tier = getTierById(tierId);
  item.lastTierId = tierId;
  item.lastTierLabel = tier?.label || '';
  item.xPct = rect.width ? centerX / rect.width * 100 : 50;
  item.yPct = rect.height ? centerY / rect.height * 100 : 50;
  item.positionMode = 'center';

  dragItemId = null;
  clearDragGhost();
  clearSelection();
  render();
}

function dropOnPool(e) {
  e.preventDefault();
  clearDragOverHighlights();
  if (icebergEditingLocked()) return;
  if (!dragItemId) return;
  const item = getItemById(dragItemId);
  if (item) removeItemToPool(item);
  dragItemId = null;
  clearDragGhost();
  render();
}

/* ── Detail panel ── */
function showDetailTitleError(message = '') {
  els.detailTitleError.textContent = message;
}

function renderDetailTierBadge(tier, fallbackLabel = 'Unplaced') {
  if (!els.detailTier) return;
  els.detailTier.textContent = '';
  els.detailTier.classList.toggle('has-tier-image', !!tier?.labelImage);

  if (tier) {
    const swatch = document.createElement('span');
    swatch.className = 'detail-tier-swatch';
    swatch.style.background = tier.color || 'transparent';
    swatch.setAttribute('aria-hidden', 'true');
    els.detailTier.appendChild(swatch);

    if (tier.labelImage) {
      const img = document.createElement('img');
      img.className = 'detail-tier-image-thumb';
      img.src = tier.labelImage;
      img.alt = '';
      img.loading = 'lazy';
      els.detailTier.appendChild(img);
    }

    const label = document.createElement('span');
    label.className = 'detail-tier-label-text';
    label.textContent = tier.label || 'Untitled tier';
    els.detailTier.appendChild(label);
    return;
  }

  const label = document.createElement('span');
  label.className = 'detail-tier-label-text';
  label.textContent = fallbackLabel || 'Unplaced';
  els.detailTier.appendChild(label);
}

function renderDetailPanel() {
  const item = getCurrentItem();
  if (!item) {
    els.detailCard.classList.remove('active');
    els.detailHeading.hidden = true;
    els.detailPlaceholder?.classList.add('active');
    if (els.detailImages) els.detailImages.innerHTML = '';
    const ytEl = $('youtube-embeds'); if (ytEl) { ytEl.hidden = true; ytEl.innerHTML = ''; }
    els.imageDropZone?.classList.remove('has-images');
    showImageError('');
    showDetailTitleError('');
    if (els.detailNeedsVerification) els.detailNeedsVerification.checked = false;
    if (els.detailVerificationStatic) els.detailVerificationStatic.hidden = true;
    if (els.detailEditRow) els.detailEditRow.hidden = true;
    if (els.detailEditBtn) els.detailEditBtn.hidden = true;
    if (els.detailDoneBtn) els.detailDoneBtn.hidden = true;
    if (els.detailRemoveDelete) els.detailRemoveDelete.hidden = true;
    closeEntryLinkPicker();
    stopEntryPickMode();
    descriptionEditItemId = null;
    syncLinkedEntryBackButton();
    return;
  }

  const tier = getTierById(item.tierId);
  const lastTier = item.lastTierId ? getTierById(item.lastTierId) : null;
  const lastTierLabel = lastTier?.label || item.lastTierLabel;

  els.detailPlaceholder?.classList.remove('active');
  els.detailHeading.hidden = false;
  els.detailTitleDisplay.textContent = item.name;
  els.detailTitleDisplay.setAttribute('title', 'Click Edit before changing the title');
  els.detailTitleDisplay.setAttribute('aria-disabled', 'true');
  els.detailTitleEdit.value = item.name;
  const description = item.description || '';
  setDescriptionDisplay(description);
  renderDescriptionImages(item);
  renderYouTubeEmbeds(item);
  els.detailDescEdit.value = description;
  els.detailTitleDisplay.hidden = false;
  els.detailTitleEdit.hidden = true;
  els.detailDescDisplay.hidden = false;
  if (els.detailDescRichEdit) els.detailDescRichEdit.hidden = true;
  els.detailDescEdit.hidden = true;
  els.detailCard.classList.remove('description-editing');
  descriptionEditItemId = null;
  renderDetailTierBadge(tier, lastTierLabel ? lastTierLabel : 'Unplaced');
  if (els.detailNeedsVerification) els.detailNeedsVerification.checked = !!item.needsVerification;
  if (els.detailVerificationStatic) els.detailVerificationStatic.hidden = !item.needsVerification;
  const editingLocked = icebergEditingLocked();
  if (els.detailEditRow) els.detailEditRow.hidden = editingLocked;
  if (els.detailEditBtn) els.detailEditBtn.hidden = editingLocked;
  if (els.detailDoneBtn) els.detailDoneBtn.hidden = true;
  els.detailRemoveDelete.textContent = item.tierId ? 'Remove' : 'Delete';
  els.detailRemoveDelete.className = item.tierId ? 'btn detail-remove-top' : 'btn detail-remove-top danger';
  els.detailRemoveDelete.hidden = true;
  showDetailTitleError('');
  els.detailCard.classList.remove('active');
  void els.detailCard.offsetWidth;
  els.detailCard.classList.add('active');
  syncLinkedEntryBackButton();
}

function showDetailSidebar() {
  els.detailSidebar?.classList.remove('collapsed');
  scheduleSearchLinesUpdate();
  if (els.detailCollapse) {
    els.detailCollapse.textContent = '›';
    els.detailCollapse.setAttribute('aria-expanded', 'true');
    els.detailCollapse.title = 'Hide details';
  }
}

function clearDetailSelection() {
  closeImagePreviewForItemChange();
  currentItemId = null;
  linkedEntryBackStack = [];
  selectedItemIds.clear();
  renderSelection();
  renderDetailPanel();
  clearRandomHighlight();
}

function hideDetailSidebar(clearCurrent = false) {
  els.detailSidebar?.classList.add('collapsed');
  scheduleSearchLinesUpdate();
  if (els.detailCollapse) {
    els.detailCollapse.textContent = '‹';
    els.detailCollapse.setAttribute('aria-expanded', 'false');
    els.detailCollapse.title = 'Show details';
  }
  if (clearCurrent) clearDetailSelection();
}

function showLeftSidebar() {
  els.leftSidebar?.classList.remove('collapsed');
  if (els.leftCollapse) {
    els.leftCollapse.textContent = '‹';
    els.leftCollapse.setAttribute('aria-expanded', 'true');
    els.leftCollapse.title = 'Hide entry tray';
  }
}

function hideLeftSidebar() {
  els.leftSidebar?.classList.add('collapsed');
  if (els.leftCollapse) {
    els.leftCollapse.textContent = '›';
    els.leftCollapse.setAttribute('aria-expanded', 'false');
    els.leftCollapse.title = 'Show entry tray';
  }
}

function clearRandomHighlight() {
  window.clearTimeout(randomHighlightTimer);
  randomHighlightTimer = 0;
  document.querySelectorAll('.item-chip.random-highlight').forEach(c => c.classList.remove('random-highlight'));
  document.body.classList.remove('has-random-highlight');
}

function openModal(itemId) {
  const item = getItemById(itemId);
  if (!item) return false;
  clearRandomHighlight();
  const isSwitchingItem = item.id !== currentItemId;
  if (isSwitchingItem && els.detailCard?.classList.contains('description-editing')) {
    if (!commitTitleEditIfOpen()) return false;
    closeImagePreviewForItemChange();
    finishDescriptionEdit();
  } else if (isSwitchingItem) {
    closeImagePreviewForItemChange();
  }
  currentItemId = item.id;
  renderSelection();
  renderDetailPanel();
  showDetailSidebar();
  if (mobileLayoutActive()) {
    const keepSearchOpen = !$('mobile-search-sheet')?.hidden;
    setMobilePanel('details', { keepSearchOpen });
  }
  return true;
}
function beginTitleEdit() {
  if (icebergEditingLocked()) return;
  const item = getCurrentItem();
  if (!item || !els.detailCard?.classList.contains('description-editing')) return;
  els.detailTitleEdit.value = item.name;
  els.detailTitleDisplay.hidden = true;
  els.detailTitleEdit.hidden = false;
  els.detailTitleEdit.focus();
  els.detailTitleEdit.select();
}

function finishTitleEdit() {
  const item = getCurrentItem();
  if (!item) return false;
  const name = els.detailTitleEdit.value.trim();
  if (!name) {
    showDetailTitleError('Title cannot be blank.');
    els.detailTitleEdit.focus();
    return false;
  }
  const duplicate = findDuplicateName(name, item.id);
  if (duplicate) {
    showDetailTitleError(`${name} already exists!`);
    els.detailTitleEdit.focus();
    return false;
  }
  showDetailTitleError('');
  item.name = name;
  els.detailTitleDisplay.textContent = item.name;
  els.detailTitleDisplay.hidden = false;
  els.detailTitleEdit.hidden = true;
  // Re-render so the chip text and autosave both stay in sync.
  renderTiers();
  renderPool();
  scheduleAutosave();
  return true;
}

function commitTitleEditIfOpen() {
  if (!els.detailTitleEdit || els.detailTitleEdit.hidden) return true;
  return finishTitleEdit();
}

/* ── Rich-text / markdown editor ── */
function getRichEditorMarkdown() {
  if (els.detailCard?.classList.contains('syntax-editing') && els.detailDescEdit && !els.detailDescEdit.hidden) {
    return els.detailDescEdit.value || '';
  }
  if (!els.detailDescRichEdit) return els.detailDescEdit?.value || '';
  return richHtmlToMarkdown(els.detailDescRichEdit).trim();
}

function richHtmlToMarkdown(root) {
  const walk = node => {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName.toLowerCase();
    const children = [...node.childNodes].map(walk).join('');
    if (tag === 'br') return '\n';
    if (tag === 'strong' || tag === 'b') return children ? `**${children}**` : '';
    if (tag === 'em' || tag === 'i') return children ? `*${children}*` : '';
    if (tag === 'code') return children ? '`' + children.replace(/`/g, '') + '`' : '';
    if (tag === 'a') {
      const label = children || node.textContent || 'link';
      const entryId = node.dataset?.entryId;
      const entryTarget = node.dataset?.entryTarget;
      const href = node.getAttribute('href') || '';
      if (entryId || entryTarget) return `[${escapeMarkdownLabel(label)}](@entry:${encodeEntryTarget(entryId || entryTarget)})`;
      if (/^https?:\/\//i.test(href)) return `[${escapeMarkdownLabel(label)}](${href})`;
      return label;
    }
    if (tag === 'li') return `- ${children.trim()}\n`;
    if (tag === 'ul' || tag === 'ol') return [...node.children].map(walk).join('').replace(/\n+$/, '') + '\n\n';
    if (tag === 'div' || tag === 'p') return children.trim() ? `${children.trim()}\n\n` : '\n';
    return children;
  };
  return [...root.childNodes].map(walk).join('').replace(/\n{3,}/g, '\n\n').trim();
}

function setRichEditorFromDescription(markdown) {
  if (!els.detailDescRichEdit) return;
  const html = renderMarkdown(markdown || '');
  els.detailDescRichEdit.innerHTML = html || '';
}

function selectionInsideRichEditor() {
  const sel = window.getSelection?.();
  if (!sel || !sel.rangeCount || !els.detailDescRichEdit) return false;
  const range = sel.getRangeAt(0);
  return els.detailDescRichEdit.contains(range.commonAncestorContainer);
}

function saveDescriptionSelection() {
  if (els.detailDescRichEdit && !els.detailDescRichEdit.hidden) {
    const sel = window.getSelection?.();
    if (sel && sel.rangeCount && selectionInsideRichEditor()) {
      const range = sel.getRangeAt(0).cloneRange();
      pendingEntryLinkSelection = { kind: 'rich', range, text: sel.toString() };
      return pendingEntryLinkSelection;
    }
    return pendingEntryLinkSelection;
  }
  if (!els.detailDescEdit || els.detailDescEdit.hidden) return pendingEntryLinkSelection;
  const start = els.detailDescEdit.selectionStart ?? 0;
  const end = els.detailDescEdit.selectionEnd ?? start;
  pendingEntryLinkSelection = {
    kind: 'textarea',
    start,
    end,
    text: els.detailDescEdit.value.slice(start, end)
  };
  return pendingEntryLinkSelection;
}

function restoreDescriptionSelection(selection = pendingEntryLinkSelection) {
  if (els.detailDescRichEdit && !els.detailDescRichEdit.hidden) {
    const range = selection instanceof Range ? selection : selection?.range;
    if (!range) return;
    els.detailDescRichEdit.focus();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return;
  }
  if (!els.detailDescEdit || !selection || selection instanceof Range || selection.kind === 'rich') return;
  const valueLength = els.detailDescEdit.value.length;
  const start = clamp(selection.start ?? 0, 0, valueLength);
  const end = clamp(selection.end ?? start, start, valueLength);
  els.detailDescEdit.focus();
  els.detailDescEdit.setSelectionRange(start, end);
}

function getSavedDescriptionSelectionText(selection = pendingEntryLinkSelection) {
  return String(selection?.text || '').trim();
}

function setDescriptionToolErrorPointFromEvent(e) {
  if (!e || typeof e.clientX !== 'number' || typeof e.clientY !== 'number') return;
  descriptionToolErrorPoint = { x: e.clientX, y: e.clientY };
}

function positionDescriptionToolError(clientX = descriptionToolErrorPoint.x, clientY = descriptionToolErrorPoint.y) {
  if (!els.entryLinkHint || !els.entryLinkHint.classList.contains('is-error')) return;
  const bubble = els.entryLinkHint;
  const pad = 14;
  const offset = 16;
  const rect = bubble.getBoundingClientRect();
  let left = clientX + offset;
  let top = clientY + offset;
  if (left + rect.width + pad > window.innerWidth) left = clientX - rect.width - offset;
  if (top + rect.height + pad > window.innerHeight) top = clientY - rect.height - offset;
  left = clamp(left, pad, Math.max(pad, window.innerWidth - rect.width - pad));
  top = clamp(top, pad, Math.max(pad, window.innerHeight - rect.height - pad));
  bubble.style.left = `${left}px`;
  bubble.style.top = `${top}px`;
}

function showDescriptionToolError(message = '', e = null) {
  if (!els.entryLinkHint) return;
  setDescriptionToolErrorPointFromEvent(e);
  clearTimeout(descriptionToolErrorTimer);
  els.entryLinkHint.textContent = message;
  els.entryLinkHint.classList.toggle('is-error', !!message);
  if (message) {
    requestAnimationFrame(() => positionDescriptionToolError());
    descriptionToolErrorTimer = setTimeout(() => showDescriptionToolError(''), 2600);
  } else {
    els.entryLinkHint.style.removeProperty('left');
    els.entryLinkHint.style.removeProperty('top');
  }
}

function setSyntaxToggleState(isSyntaxMode) {
  // Update aria-pressed only — child spans drive the visual segmented look.
  // Setting textContent here would destroy them.
  if (!els.descriptionSyntaxToggle) return;
  els.descriptionSyntaxToggle.setAttribute('aria-pressed', isSyntaxMode ? 'true' : 'false');
  els.descriptionSyntaxToggle.title = isSyntaxMode ? 'Switch to rich text editor' : 'Switch to syntax editor';
}

function switchDescriptionEditorMode(forceSyntax = null) {
  if (icebergEditingLocked()) return;
  if (!els.detailDescRichEdit || !els.detailDescEdit || !els.detailCard) return;
  switchingDescriptionMode = true;
  window.setTimeout(() => { switchingDescriptionMode = false; }, 150);
  if (!els.detailCard.classList.contains('description-editing')) beginDescriptionEdit();
  const currentlySyntax = els.detailCard.classList.contains('syntax-editing');
  const useSyntax = forceSyntax == null ? !currentlySyntax : !!forceSyntax;

  if (useSyntax) {
    els.detailDescEdit.value = richHtmlToMarkdown(els.detailDescRichEdit).trim();
    els.detailCard.classList.add('syntax-editing');
    els.detailDescRichEdit.hidden = true;
    els.detailDescEdit.hidden = false;
    setSyntaxToggleState(true);
    requestAnimationFrame(() => els.detailDescEdit.focus());
  } else {
    setRichEditorFromDescription(els.detailDescEdit.value || '');
    els.detailCard.classList.remove('syntax-editing');
    els.detailDescEdit.hidden = true;
    els.detailDescRichEdit.hidden = false;
    setSyntaxToggleState(false);
    requestAnimationFrame(() => els.detailDescRichEdit.focus());
  }
  syncDescriptionDraft();
  showDescriptionToolError('');
}

function applySyntaxFormat(command) {
  if (icebergEditingLocked()) return;
  if (!els.detailDescEdit) return;
  const textarea = els.detailDescEdit;
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? start;
  const selected = textarea.value.slice(start, end);
  if (!selected.trim()) {
    showDescriptionToolError('Please highlight text first!');
    textarea.focus();
    return;
  }
  let replacement = selected;
  if (command === 'bold') replacement = `**${selected}**`;
  else if (command === 'italic') replacement = `*${selected}*`;
  else if (command === 'code') replacement = '`' + selected.replace(/`/g, '') + '`';
  else if (command === 'insertUnorderedList') {
    replacement = selected.split(/\r?\n/).map(line => line.trim() ? `- ${line.replace(/^[-*]\s+/, '')}` : line).join('\n');
  }
  textarea.setRangeText(replacement, start, end, 'select');
  syncDescriptionDraft();
  saveDescriptionSelection();
  textarea.focus();
}

function normalizeRichEditorLinks() {
  if (!els.detailDescRichEdit) return;
  els.detailDescRichEdit.querySelectorAll('a').forEach(a => {
    if (a.classList.contains('internal-entry-link')) return;
    const href = a.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

function execRichCommand(command, value = null) {
  if (icebergEditingLocked()) return;
  if (!els.detailDescRichEdit) return;
  if (els.detailCard?.classList.contains('syntax-editing')) {
    applySyntaxFormat(command);
    return;
  }
  if (els.detailDescRichEdit.hidden) beginDescriptionEdit();
  restoreDescriptionSelection();
  document.execCommand(command, false, value);
  normalizeRichEditorLinks();
  syncDescriptionDraft();
  saveDescriptionSelection();
  els.detailDescRichEdit.focus();
}

function applyRichCode() {
  if (icebergEditingLocked()) return;
  if (!els.detailDescRichEdit) return;
  if (els.detailCard?.classList.contains('syntax-editing')) {
    applySyntaxFormat('code');
    return;
  }
  if (els.detailDescRichEdit.hidden) beginDescriptionEdit();
  restoreDescriptionSelection();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !selectionInsideRichEditor()) return;
  const range = sel.getRangeAt(0);
  const code = document.createElement('code');
  if (range.collapsed) {
    code.textContent = 'code';
    range.insertNode(code);
    range.selectNodeContents(code);
  } else {
    try {
      code.appendChild(range.extractContents());
      range.insertNode(code);
      range.selectNodeContents(code);
    } catch {
      document.execCommand('insertText', false, '`' + sel.toString() + '`');
    }
  }
  sel.removeAllRanges();
  sel.addRange(range);
  syncDescriptionDraft();
  saveDescriptionSelection();
}

function applyUrlLink() {
  if (icebergEditingLocked()) return;
  if (!els.detailDescRichEdit) return;
  if (els.detailDescRichEdit.hidden && !els.detailCard?.classList.contains('syntax-editing')) beginDescriptionEdit();

  if (els.detailCard?.classList.contains('syntax-editing')) {
    const start = els.detailDescEdit.selectionStart ?? 0;
    const end = els.detailDescEdit.selectionEnd ?? start;
    const selected = els.detailDescEdit.value.slice(start, end);
    if (!selected.trim()) {
      showDescriptionToolError('Please highlight text first!');
      els.detailDescEdit.focus();
      return;
    }
    const url = window.prompt('Paste a web URL to link this text to:', 'https://');
    if (!url) return;
    const clean = String(url).trim();
    if (!/^https?:\/\//i.test(clean)) {
      showDescriptionToolError('Use a URL starting with http:// or https://');
      return;
    }
    const replacement = `[${selected.replace(/\]/g, '\\]')}](${clean})`;
    els.detailDescEdit.setRangeText(replacement, start, end, 'end');
    syncDescriptionDraft();
    els.detailDescEdit.focus();
    return;
  }

  restoreDescriptionSelection();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !selectionInsideRichEditor() || sel.isCollapsed || !sel.toString().trim()) {
    showDescriptionToolError('Please highlight text first!');
    els.detailDescRichEdit.focus();
    return;
  }
  const url = window.prompt('Paste a web URL to link this text to:', 'https://');
  if (!url) return;
  const clean = String(url).trim();
  if (!/^https?:\/\//i.test(clean)) {
    showDescriptionToolError('Use a URL starting with http:// or https://');
    return;
  }
  document.execCommand('createLink', false, clean);
  normalizeRichEditorLinks();
  syncDescriptionDraft();
  saveDescriptionSelection();
  els.detailDescRichEdit.focus();
}

function getTextNodeBeforeCaret(range) {
  if (!range || !range.collapsed) return null;
  let node = range.startContainer;
  let offset = range.startOffset;
  if (node.nodeType === Node.TEXT_NODE) return { node, offset };
  if (node.nodeType !== Node.ELEMENT_NODE || offset === 0) return null;
  let candidate = node.childNodes[offset - 1];
  while (candidate && candidate.lastChild) candidate = candidate.lastChild;
  if (candidate?.nodeType === Node.TEXT_NODE) return { node: candidate, offset: candidate.nodeValue.length };
  return null;
}

function handleRichAutoList(e) {
  if (icebergEditingLocked()) return false;
  if (e.key !== ' ' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
  if (!els.detailDescRichEdit || els.detailDescRichEdit.hidden || els.detailCard?.classList.contains('syntax-editing')) return false;
  const sel = window.getSelection?.();
  if (!sel || !sel.rangeCount || !selectionInsideRichEditor()) return false;
  const range = sel.getRangeAt(0);
  const textPoint = getTextNodeBeforeCaret(range);
  if (!textPoint) return false;
  const before = textPoint.node.nodeValue.slice(0, textPoint.offset);
  const match = before.match(/(^|\n)(\s*)-$/);
  if (!match) return false;

  e.preventDefault();
  const dashStart = textPoint.offset - 1;
  const deleteRange = document.createRange();
  deleteRange.setStart(textPoint.node, dashStart);
  deleteRange.setEnd(textPoint.node, textPoint.offset);
  deleteRange.deleteContents();
  sel.removeAllRanges();
  sel.addRange(deleteRange);
  document.execCommand('insertUnorderedList', false, null);
  normalizeRichEditorLinks();
  syncDescriptionDraft();
  saveDescriptionSelection();
  return true;
}

function handleDescriptionShortcut(e) {
  if (handleRichAutoList(e)) return;
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const key = String(e.key || '').toLowerCase();
  if (key === 'z') {
    setTimeout(() => {
      syncDescriptionDraft();
      saveDescriptionSelection();
    }, 0);
    return;
  }
  if (key === 'b') {
    e.preventDefault();
    execRichCommand('bold');
  } else if (key === 'i') {
    e.preventDefault();
    execRichCommand('italic');
  } else if (key === 'k') {
    e.preventDefault();
    applyUrlLink();
  } else if (key === '`') {
    e.preventDefault();
    applyRichCode();
  }
}

function beginDescriptionEdit() {
  if (icebergEditingLocked()) return;
  const item = getCurrentItem();
  if (!item) return;
  descriptionEditItemId = item.id;
  setRichEditorFromDescription(item.description || '');
  if (els.detailDescEdit) els.detailDescEdit.value = item.description || '';
  els.detailCard.classList.add('description-editing');
  els.detailTitleDisplay.setAttribute('title', 'Click to edit title');
  els.detailTitleDisplay.removeAttribute('aria-disabled');
  els.detailCard.classList.remove('syntax-editing');
  if (els.detailEditRow) els.detailEditRow.hidden = false;
  if (els.detailEditBtn) els.detailEditBtn.hidden = true;
  if (els.detailDoneBtn) els.detailDoneBtn.hidden = false;
  if (els.detailRemoveDelete) els.detailRemoveDelete.hidden = false;
  setSyntaxToggleState(false);
  showDescriptionToolError('');
  els.detailDescDisplay.hidden = true;
  if (els.detailDescRichEdit) {
    els.detailDescRichEdit.hidden = false;
    requestAnimationFrame(() => els.detailDescRichEdit.focus());
  }
  if (els.imageModal && !els.imageModal.hidden) syncImageModalEditingState();
}

function finishDescriptionEdit() {
  if (!els.detailCard?.classList.contains('description-editing')) return;
  const itemId = descriptionEditItemId || currentItemId;
  const item = getItemById(itemId);
  if (!item) {
    descriptionEditItemId = null;
    return;
  }
  syncDescriptionDraft(itemId);
  const description = item.description || '';
  if (itemId === currentItemId) {
    setDescriptionDisplay(description);
    renderDescriptionImages(item);
  }
  els.detailDescDisplay.hidden = false;
  if (els.detailDescRichEdit) els.detailDescRichEdit.hidden = true;
  if (els.detailDescEdit) els.detailDescEdit.hidden = true;
  els.detailCard.classList.remove('description-editing');
  els.detailTitleDisplay.setAttribute('title', 'Click Edit before changing the title');
  els.detailTitleDisplay.setAttribute('aria-disabled', 'true');
  els.detailCard.classList.remove('syntax-editing');
  const locked = icebergEditingLocked();
  if (els.detailEditRow) els.detailEditRow.hidden = locked;
  if (els.detailEditBtn) els.detailEditBtn.hidden = locked;
  if (els.detailDoneBtn) els.detailDoneBtn.hidden = true;
  if (els.detailRemoveDelete) els.detailRemoveDelete.hidden = true;
  if (itemId === currentItemId && els.detailVerificationStatic) els.detailVerificationStatic.hidden = !item.needsVerification;
  renderTiers(false);
  renderPool();
  showDescriptionToolError('');
  closeEntryLinkPicker();
  stopEntryPickMode();
  descriptionEditItemId = null;
  if (els.imageModal && !els.imageModal.hidden) syncImageModalEditingState();
}

function syncDescriptionDraft(itemId = descriptionEditItemId || currentItemId) {
  if (!itemId) return;
  const item = getItemById(itemId);
  if (!item) return;
  item.description = getRichEditorMarkdown();
  if (els.detailDescEdit) els.detailDescEdit.value = item.description;
  renderYouTubeEmbeds(item);
}

function getEntryLinkCandidates(query = '') {
  const q = String(query || '').trim().toLowerCase();
  return state.items
    .filter(item => item.id !== currentItemId)
    .filter(item => !q || `${item.name || ''} ${getItemTierLabel(item)}`.toLowerCase().includes(q))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
    .slice(0, 40);
}

function renderEntryLinkPicker(query = '') {
  if (!els.entryLinkList) return;
  const candidates = getEntryLinkCandidates(query);
  els.entryLinkList.innerHTML = '';
  if (!candidates.length) {
    const empty = document.createElement('div');
    empty.className = 'entry-link-empty';
    empty.textContent = 'No matching entries.';
    els.entryLinkList.appendChild(empty);
    return;
  }
  candidates.forEach(item => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'entry-link-option';
    btn.dataset.entryId = item.id;
    const name = document.createElement('span');
    name.textContent = item.name;
    const tier = document.createElement('small');
    tier.textContent = getItemTierLabel(item);
    btn.append(name, tier);
    els.entryLinkList.appendChild(btn);
  });
}

function closeEntryLinkPicker() {
  if (els.entryLinkPicker) els.entryLinkPicker.hidden = true;
  showDescriptionToolError('');
}

function startEntryPickMode() {
  if (icebergEditingLocked()) return;
  clearInternalEntryLinkLine();
  const item = getCurrentItem();
  if (!item) return;
  if (els.detailDescRichEdit?.hidden && !els.detailCard?.classList.contains('syntax-editing')) beginDescriptionEdit();
  const saved = saveDescriptionSelection();
  if (!getSavedDescriptionSelectionText(saved)) {
    showDescriptionToolError('Please highlight text first!');
    if (els.detailCard?.classList.contains('syntax-editing')) els.detailDescEdit?.focus();
    else els.detailDescRichEdit?.focus();
    return;
  }
  entryPickMode = true;
  closeEntryLinkPicker();
  document.documentElement.classList.add('entry-pick-mode');
  document.body.classList.add('entry-pick-mode');
  document.body.dataset.entryPickMode = 'true';
  els.wrapper?.classList.add('entry-pick-mode');
  els.pool?.classList.add('entry-pick-mode');
  entryPickLinePoint = getPickLineStartPoint();
  entryPickLineTargetId = null;
  applyEntryPickOpacity(null);
  drawEntryPickLine();
  scheduleEntryPickOpacityUpdate();
  showDescriptionToolError('');
}

function stopEntryPickMode() {
  entryPickMode = false;
  document.documentElement.classList.remove('entry-pick-mode');
  document.body.classList.remove('entry-pick-mode');
  delete document.body.dataset.entryPickMode;
  els.wrapper?.classList.remove('entry-pick-mode');
  els.pool?.classList.remove('entry-pick-mode');
  clearEntryPickLine();
  clearEntryPickOpacity();
  showDescriptionToolError('');
}

function insertEntryLink(targetItemId) {
  if (icebergEditingLocked()) return;
  const target = getItemById(targetItemId);
  const item = getCurrentItem();
  if (!target || !item) return;
  if (els.detailDescRichEdit?.hidden && !els.detailCard?.classList.contains('syntax-editing')) beginDescriptionEdit();

  const saved = pendingEntryLinkSelection || saveDescriptionSelection();
  if (!getSavedDescriptionSelectionText(saved)) {
    showDescriptionToolError('Please highlight text first!');
    stopEntryPickMode();
    return;
  }

  if (saved.kind === 'textarea' || els.detailCard?.classList.contains('syntax-editing')) {
    const textarea = els.detailDescEdit;
    if (!textarea) return;
    const start = clamp(saved.start ?? 0, 0, textarea.value.length);
    const end = clamp(saved.end ?? start, start, textarea.value.length);
    const selectedText = textarea.value.slice(start, end);
    if (!selectedText.trim()) {
      showDescriptionToolError('Please highlight text first!');
      stopEntryPickMode();
      return;
    }
    const replacement = `[${selectedText.replace(/\]/g, '\\]')}](@entry:${target.id})`;
    textarea.focus();
    textarea.setRangeText(replacement, start, end, 'end');
    syncDescriptionDraft();
    stopEntryPickMode();
    pendingEntryLinkSelection = null;
    return;
  }

  if (!els.detailDescRichEdit) return;
  restoreDescriptionSelection(saved);
  els.detailDescRichEdit.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !selectionInsideRichEditor() || sel.isCollapsed || !sel.toString().trim()) {
    showDescriptionToolError('Please highlight text first!');
    stopEntryPickMode();
    return;
  }

  const selectedText = sel.toString();
  const linkHtml = `<a href="#" class="internal-entry-link" data-entry-id="${escapeHtml(target.id)}">${escapeHtml(selectedText)}</a>`;
  document.execCommand('insertHTML', false, linkHtml);

  normalizeRichEditorLinks();
  syncDescriptionDraft();
  saveDescriptionSelection();
  stopEntryPickMode();
  pendingEntryLinkSelection = null;
  els.detailDescRichEdit.focus();
}

function openInternalEntryLink(link) {
  clearInternalEntryLinkLine();
  const target = link?.dataset?.entryId || link?.dataset?.entryTarget;
  const item = findItemByEntryLinkTarget(target);
  if (!item) return;
  const previousId = currentItemId;
  if (els.detailCard?.classList.contains('description-editing')) {
    if (!commitTitleEditIfOpen()) return;
    finishDescriptionEdit();
  }
  if (mobileLayoutActive() && previousId && previousId !== item.id) {
    const lastBackId = linkedEntryBackStack[linkedEntryBackStack.length - 1];
    if (lastBackId !== previousId) linkedEntryBackStack.push(previousId);
  }
  selectedItemIds = item.tierId ? new Set([item.id]) : new Set();
  renderSelection();
  hideHoverPreview();
  openModal(item.id);
  syncLinkedEntryBackButton();
}

function toggleCurrentVerification() {
  if (icebergEditingLocked()) return;
  const item = getCurrentItem();
  if (!item || !els.detailNeedsVerification) return;
  item.needsVerification = els.detailNeedsVerification.checked;
  if (els.detailVerificationStatic) els.detailVerificationStatic.hidden = !item.needsVerification;
  renderTiers();
  renderPool();
  updateIcebergSearchCount();
  scheduleSearchLinesUpdate();
  if (hoveredPreviewItemId === item.id && els.entryPreview && !els.entryPreview.hidden) {
    renderEntryPreview(item.id, hoverPreviewPoint.x, hoverPreviewPoint.y);
  }
}

function removeOrDeleteCurrentItem() {
  if (icebergEditingLocked()) return;
  const item = getCurrentItem();
  if (!item) return;
  if (els.detailCard?.classList.contains('description-editing')) {
    syncDescriptionDraft(item.id);
  }
  if (item.tierId) {
    removeItemToPool(item);
    render();
    renderDetailPanel();
  } else {
    const confirmed = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
    if (!confirmed) return;
    deleteItem(item.id);
    currentItemId = null;
    clearRandomHighlight();
    renderDetailPanel();
  }
}

/* ── Autosave ── */
function updateAutosaveStatus(message = '', isWarning = false) {
  const status = $('autosave-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('warn', !!isWarning);
}

function getSerializableState() {
  if (els.title) state.title = els.title.value;
  state.version = STATE_VERSION;
  normalizeState();
  return JSON.parse(JSON.stringify(state));
}

function isMeaningfulSavedState(saved) {
  if (!saved || !Array.isArray(saved.items) || !Array.isArray(saved.tiers)) return false;
  if (saved.items.length) return true;
  if (String(saved.title || '').trim() && String(saved.title || '').trim() !== 'My Iceberg') return true;
  if (Number(saved.entryFontSize) && Number(saved.entryFontSize) !== 14) return true;
  if (Number(saved.bgBlur)) return true;
  if (saved.showTierTitles === false) return true;
  if (saved.showPips === false) return true;
  if (saved.entryDrift === false) return true;
  if (saved.icebergLocked === true) return true;
  if (saved.entryFontFamily && saved.entryFontFamily !== 'Georgia, serif') return true;
  return saved.tiers.some((tier, index) => String(tier?.label || '') !== String(DEFAULT_TIERS[index]?.[0] || '') || !!tier?.labelImage);
}

function isMeaningfulAutosave(payload) {
  return isMeaningfulSavedState(payload?.state);
}

function readAutosavePayload() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !payload.state || !Array.isArray(payload.state.items) || !Array.isArray(payload.state.tiers)) return null;
    return payload;
  } catch (err) {
    console.warn('Could not read autosave.', err);
    return null;
  }
}

function formatAutosaveTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  if (Number.isNaN(date.getTime())) return 'Saved time unknown';
  const dateText = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const timeText = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dateText}, ${timeText}`;
}

function setSidebarStatus(message, isError = false) {
  setAutosaveIndicator(isError ? 'error' : 'saved', message);
  if (!isError) {
    clearTimeout(setSidebarStatus._timer);
    setSidebarStatus._timer = setTimeout(() => {
      const time = new Date().toLocaleTimeString([], { timeStyle: 'short' });
      setAutosaveIndicator('saved', `Autosaved ${time}`);
    }, 5000);
  }
}

function updateConsolePopupAnchor() {
  const popup = $('console-popup');
  const indicator = $('autosave-indicator');
  if (!popup || !indicator) return;
  const indicatorRect = indicator.getBoundingClientRect();
  if (!indicatorRect.width) return;
  const pointerRight = Math.max(13, Math.round(indicatorRect.width / 2 - 6));
  popup.style.setProperty('--log-pointer-right', `${pointerRight}px`);
}

function toggleConsolePopup() {
  const popup = $('console-popup');
  const indicator = $('autosave-indicator');
  if (!popup) return;
  if (!popup.hidden) {
    closeConsolePopup();
    return;
  }
  closeAppMenu();
  closeAboutModal();
  updateConsolePopupAnchor();
  showElementWithFade(popup);
  indicator?.setAttribute('aria-expanded', 'true');
}

function closeConsolePopup() {
  const popup = $('console-popup');
  if (!popup || popup.hidden) return;
  hideElementWithFade(popup, () => $('console-clear-confirm')?.remove());
  $('autosave-indicator')?.setAttribute('aria-expanded', 'false');
}

function setAutosaveIndicator(indicatorState, text) {
  const el = $('autosave-indicator');
  const textEl = $('autosave-indicator-text');
  if (!el) return;
  el.classList.remove('saving', 'saved', 'error');
  if (indicatorState) el.classList.add(indicatorState);
  el.classList.add('visible');
  if (textEl) textEl.textContent = text;
}

function getAutosaveState() {
  const full = getSerializableState();
  full.items = (full.items || []).map(item => {
    if (!item.images?.length) return item;
    const { images, ...rest } = item;
    return rest;
  });
  return full;
}

function writeAutosaveNow() {
  if (!autosaveReady || autosaveWriteFailed) return;
  try {
    const autosaveState = getAutosaveState();
    if (!isMeaningfulSavedState(autosaveState)) return;
    const payload = { savedAt: Date.now(), state: autosaveState };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
    updateAutosaveStatus('');
    const time = new Date(payload.savedAt).toLocaleTimeString([], { timeStyle: 'short' });
    setAutosaveIndicator('saved', `Autosaved ${time}`);
  } catch (err) {
    autosaveWriteFailed = true;
    setAutosaveIndicator('error', 'Autosave failed');
    setSidebarStatus('Autosave failed — storage full. Use Save JSON to preserve your iceberg.', true);
    updateAutosaveStatus('');
    console.warn('Autosave failed.', err);
  }
}

function scheduleAutosave() {
  if (!autosaveReady || autosaveWriteFailed) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(writeAutosaveNow, 60000);
}

function clearAutosaveStorage() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch (err) {
    console.warn('Could not clear autosave.', err);
  }
}

function hideAutosavePrompt() {
  const modal = $('autosave-modal');
  if (modal) hideElementWithFade(modal);
}

function getSavedIcebergTitle(savedState) {
  const title = String(savedState?.title || '').trim();
  return title || 'Untitled iceberg';
}

function showAutosavePrompt(payload) {
  pendingAutosavePayload = payload;
  const modal = $('autosave-modal');
  const meta = $('autosave-meta');
  const titleSubheading = $('autosave-title-subheading');
  if (!modal) return false;
  const itemCount = payload?.state?.items?.length || 0;
  const title = getSavedIcebergTitle(payload?.state);
  if (titleSubheading) titleSubheading.textContent = title;
  if (meta) meta.textContent = `${formatAutosaveTime(payload?.savedAt)} · ${itemCount} entries`;
  showElementWithFade(modal);
  return true;
}

function restoreAutosave() {
  if (!pendingAutosavePayload?.state) return;
  closeImagePreviewForItemChange();
  state = pendingAutosavePayload.state;
  normalizeState();
  currentItemId = null;
  selectedItemIds.clear();
  hideAutosavePrompt();
  autosaveReady = true;
  entryLoadAnimationPending = true;
  render();
  renderDetailPanel();
  writeAutosaveNow();
  setSidebarStatus('Autosave restored. Tier images included, entry images require JSON backup.');
}

function startFreshAutosave() {
  pendingAutosavePayload = null;
  hideAutosavePrompt();
  autosaveReady = true;
  setAutosaveIndicator('saved', 'Started blank');
}

function loadLocalSaveFromAutosave() {
  els.file?.click();
}

function initAutosave() {
  const payload = readAutosavePayload();
  if (isMeaningfulAutosave(payload)) return showAutosavePrompt(payload);
  autosaveReady = true;
  return false;
}

/* ── Save / load JSON ── */
function saveState() {
  const savedState = getSerializableState();
  const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(savedState, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${sanitizeDownloadFilename(savedState.title, 'iceberg')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
  setSidebarStatus('JSON saved manually. Entry images included.');
}

function countImportImageCandidates(items = []) {
  return items.reduce((sum, item) => {
    const attached = Array.isArray(item?.images) ? item.images.length : 0;
    const markdown = String(item?.description || '').match(/!\[[^\]]*\]\([^)]+\)/g)?.length || 0;
    return sum + attached + markdown;
  }, 0);
}

function countImportImages(items = []) {
  return items.reduce((sum, item) => sum + (Array.isArray(item?.images) ? item.images.length : 0), 0);
}

function buildImportReport(rawLoaded, normalizedState, fileName = '') {
  const rawItems = Array.isArray(rawLoaded?.items) ? rawLoaded.items : [];
  const loadedItems = Array.isArray(normalizedState?.items) ? normalizedState.items : [];
  const imageCandidates = countImportImageCandidates(rawItems);
  const restoredImages = countImportImages(loadedItems);
  const invalidImages = Math.max(0, imageCandidates - restoredImages);
  const placedCount = loadedItems.filter(item => item.tierId).length;
  const unplacedCount = loadedItems.length - placedCount;
  const loadedVersion = Number(rawLoaded?.version) || 0;
  const repairedItems = rawItems.filter(item => !item || !String(item.id || '').trim() || !String(item.name || '').trim() || typeof item.description !== 'string' || typeof item.needsVerification !== 'boolean').length;
  const rawTiers = Array.isArray(rawLoaded?.tiers) ? rawLoaded.tiers : [];
  const rawTierIds = rawTiers.map(tier => String(tier?.id || '').trim()).filter(Boolean);
  const duplicateTierIds = rawTierIds.length - new Set(rawTierIds).size;
  const repairedTiers = !Array.isArray(rawLoaded?.tiers) || rawLoaded.tiers.length !== FIXED_TIER_COUNT || duplicateTierIds > 0;

  const lines = [
    `${loadedItems.length} entries loaded`,
    `${placedCount} placed · ${unplacedCount} unplaced`,
    `${restoredImages} images restored`
  ];

  if (invalidImages) lines.push(`${invalidImages} invalid image${invalidImages === 1 ? '' : 's'} skipped`);
  if (loadedVersion && loadedVersion !== STATE_VERSION) lines.push(`version ${loadedVersion} normalized for this build`);
  if (!loadedVersion) lines.push('legacy JSON normalized for this build');
  if (duplicateTierIds) lines.push(`${duplicateTierIds} duplicate tier ID${duplicateTierIds === 1 ? '' : 's'} repaired`);
  if (repairedItems || repairedTiers) lines.push('missing or old fields were repaired');

  const hasNotes = invalidImages || repairedItems || repairedTiers || (loadedVersion && loadedVersion !== STATE_VERSION) || !loadedVersion;
  return {
    title: hasNotes ? 'JSON loaded with notes' : 'JSON loaded',
    copy: fileName ? `Loaded ${fileName} safely.` : 'Loaded JSON safely.',
    tone: invalidImages || repairedItems || repairedTiers ? 'warn' : 'success',
    lines
  };
}

function renderConsoleLog() {
  const list = $('console-log-list');
  if (!list) return;
  list.innerHTML = '';
  if (!consoleLogEntries.length) {
    const empty = document.createElement('p');
    empty.className = 'console-log-empty';
    empty.textContent = 'No recent log entries.';
    list.appendChild(empty);
    return;
  }
  consoleLogEntries.forEach(entry => {
    const item = document.createElement('article');
    item.className = `console-log-entry ${entry.tone || 'success'}`;

    const title = document.createElement('div');
    title.className = 'console-log-title';
    title.textContent = entry.title || 'Log entry';
    item.appendChild(title);

    if (entry.copy) {
      const copy = document.createElement('p');
      copy.className = 'console-log-copy';
      copy.textContent = entry.copy;
      item.appendChild(copy);
    }

    if (entry.lines?.length) {
      const lines = document.createElement('ul');
      lines.className = 'console-log-lines';
      entry.lines.forEach(line => {
        const li = document.createElement('li');
        li.textContent = line;
        lines.appendChild(li);
      });
      item.appendChild(lines);
    }

    const time = document.createElement('div');
    time.className = 'console-log-time';
    time.textContent = entry.timeText;
    item.appendChild(time);

    list.appendChild(item);
  });
}

function addConsoleLogEntry({ title = 'Log entry', copy = '', lines = [], tone = 'success' } = {}) {
  const timeText = new Date().toLocaleTimeString([], { timeStyle: 'short' });
  consoleLogEntries.unshift({ title, copy, lines: Array.isArray(lines) ? lines : [], tone, timeText });
  consoleLogEntries.splice(MAX_CONSOLE_LOG_ENTRIES);
  renderConsoleLog();
}

function showLoadNotice({ title = 'JSON loaded', copy = '', lines = [], tone = 'success' } = {}) {
  addConsoleLogEntry({ title, copy, lines, tone });
}

function parseAndValidateImport(text, fileName = '') {
  let loaded;
  try {
    loaded = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON. Your current iceberg was not changed.');
  }
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
    throw new Error('This JSON does not look like an iceberg save. Your current iceberg was not changed.');
  }
  if (!Array.isArray(loaded.items) && Array.isArray(loaded.entries)) loaded.items = loaded.entries;
  if (!Array.isArray(loaded.items)) {
    throw new Error('This JSON is missing an entries list. Your current iceberg was not changed.');
  }
  if (!Array.isArray(loaded.tiers)) loaded.tiers = [];

  const previousState = state;
  const importedState = JSON.parse(JSON.stringify(loaded));
  try {
    state = importedState;
    normalizeState();
    state.version = STATE_VERSION;
    const normalizedState = JSON.parse(JSON.stringify(state));
    const report = buildImportReport(loaded, normalizedState, fileName);
    state = previousState;
    return { state: normalizedState, report };
  } catch (err) {
    state = previousState;
    throw new Error('This JSON could not be repaired safely. Your current iceberg was not changed.');
  }
}

function loadState(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const result = parseAndValidateImport(e.target.result, file.name);
      pendingAutosavePayload = null;
      hideAutosavePrompt();
      autosaveReady = true;
      closeImagePreviewForItemChange();
      state = result.state;
      currentItemId = null;
      selectedItemIds.clear();
      entryLoadAnimationPending = true;
      render();
      renderDetailPanel();
      writeAutosaveNow();
      const r = result.report;
      showLoadNotice(r);
      const summary = `${r.title} — ${r.lines[0] || ''}${r.lines[1] ? ', ' + r.lines[1] : ''}`;
      setSidebarStatus(summary, r.tone === 'error');
    } catch (err) {
      const message = err.message || 'The file could not be loaded.';
      showLoadNotice({
        title: 'Could not load JSON',
        copy: message,
        lines: ['Your current iceberg was not changed.'],
        tone: 'error',
        autoHide: false
      });
      setSidebarStatus(`Could not load JSON — ${message}`, true);
    }
  };
  reader.onerror = () => {
    showLoadNotice({
      title: 'Could not read file',
      copy: 'Your current iceberg was not changed.',
      lines: [],
      tone: 'error',
      autoHide: false
    });
    setSidebarStatus('Could not read file — your current iceberg was not changed.', true);
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* ── Export to PNG ── */
function waitForFonts() {
  return document.fonts?.ready || Promise.resolve();
}


function getCssPx(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function parseCanvasColor(color, fallback = '#000') {
  return color || fallback;
}

function loadExportImage(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function downloadCanvas(canvas) {
  return new Promise((resolve, reject) => {
    const filename = `${sanitizeDownloadFilename(state.title, 'iceberg')}.png`;
    const finish = href => {
      const a = document.createElement('a');
      a.download = filename;
      a.href = href;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => {
        if (href.startsWith('blob:')) URL.revokeObjectURL(href);
      }, 1000);
      resolve();
    };

    try {
      if (canvas.toBlob) {
        canvas.toBlob(blob => {
          if (blob) finish(URL.createObjectURL(blob));
          else reject(new Error('Canvas export returned an empty image.'));
        }, 'image/png');
        return;
      }
      finish(canvas.toDataURL('image/png'));
    } catch (err) {
      reject(err);
    }
  });
}

function wrapCanvasText(ctx, text, maxWidth) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  if (!source) return [];
  const lines = [];
  const words = source.split(' ');
  let line = '';

  const pushBrokenWord = word => {
    let part = '';
    [...word].forEach(char => {
      const test = part + char;
      if (part && ctx.measureText(test).width > maxWidth) {
        lines.push(part);
        part = char;
      } else {
        part = test;
      }
    });
    line = part;
  };

  words.forEach(word => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      return;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width > maxWidth) pushBrokenWord(word);
    else line = word;
  });
  if (line) lines.push(line);
  return lines;
}

function drawOutlinedText(ctx, text, x, y, options = {}) {
  const fontSize = options.fontSize || 14;
  const fontFamily = options.fontFamily || 'Georgia, serif';
  const maxWidth = options.maxWidth || 220;
  const lineHeight = options.lineHeight || fontSize * 1.16;
  const weight = options.weight || 900;
  const fill = options.fill || '#fff';
  const stroke = options.stroke || '#000';
  const strokeWidth = options.strokeWidth ?? 4;
  const align = options.align || 'center';
  const maxLines = options.maxLines || 6;

  ctx.save();
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  let lines = wrapCanvasText(ctx, text, maxWidth).slice(0, maxLines);
  if (!lines.length) { ctx.restore(); return { width: 0, height: 0, lines: [] }; }
  const height = lines.length * lineHeight;
  const startY = y - height / 2 + lineHeight / 2;
  const widest = Math.max(...lines.map(line => ctx.measureText(line).width));

  ctx.shadowColor = 'rgba(0,0,0,.88)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = fill;
  lines.forEach((line, index) => ctx.fillText(line, x, startY + index * lineHeight));

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  lines.forEach((line, index) => ctx.strokeText(line, x, startY + index * lineHeight));
  ctx.fillStyle = fill;
  lines.forEach((line, index) => ctx.fillText(line, x, startY + index * lineHeight));
  ctx.restore();
  return { width: widest, height, lines };
}

function getExportRows(canvasH) {
  const total = TIER_BOUNDARIES[TIER_BOUNDARIES.length - 1] || 1;
  return TIER_BOUNDARIES.slice(1).map((boundary, index) => {
    const y = TIER_BOUNDARIES[index] / total * canvasH;
    const h = (boundary - TIER_BOUNDARIES[index]) / total * canvasH;
    return { y, h };
  });
}

function drawCoverImage(ctx, img, x, y, w, h, posX = 50, posY = 50) {
  if (!img) return;
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x - Math.max(0, dw - w) * (normalizeTierImagePosition(posX) / 100);
  const dy = y - Math.max(0, dh - h) * (normalizeTierImagePosition(posY) / 100);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

async function exportImageWithCanvasRenderer() {
  await waitForFonts();

  const canvasW = getCssPx('--canvas-w', 980);
  const canvasH = getCssPx('--canvas-h', 1752);
  const labelW = getCssPx('--label-w', 185);
  const itemW = canvasW - labelW;
  const rows = getExportRows(canvasH);
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(canvasW * scale);
  canvas.height = Math.round(canvasH * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.scale(scale, scale);

  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const bg = await loadExportImage('iceberg-bg.webp');
  if (bg) {
    ctx.save();
    const blur = clamp(Number(state.bgBlur) || 0, 0, 2);
    if (blur > 0 && 'filter' in ctx) ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(bg, 0, 0, canvasW, canvasH);
    ctx.restore();
  }

  // Match the subtle de-vignette overlay used on the first image band.
  if (rows[0]) {
    const gradX = ctx.createLinearGradient(0, 0, itemW, 0);
    gradX.addColorStop(0, 'rgba(18,145,220,.34)');
    gradX.addColorStop(.18, 'rgba(18,145,220,0)');
    gradX.addColorStop(.82, 'rgba(18,145,220,0)');
    gradX.addColorStop(1, 'rgba(18,145,220,.22)');
    ctx.fillStyle = gradX;
    ctx.fillRect(0, rows[0].y, itemW, rows[0].h);
    const gradY = ctx.createLinearGradient(0, rows[0].y, 0, rows[0].y + rows[0].h);
    gradY.addColorStop(0, 'rgba(18,145,220,.22)');
    gradY.addColorStop(.55, 'rgba(18,145,220,0)');
    ctx.fillStyle = gradY;
    ctx.fillRect(0, rows[0].y, itemW, rows[0].h);
  }

  for (let index = 0; index < state.tiers.length; index += 1) {
    const tier = state.tiers[index];
    const row = rows[index];
    if (!tier || !row) continue;
    const labelX = itemW;
    ctx.fillStyle = parseCanvasColor(tier.color, 'transparent');
    ctx.fillRect(labelX, row.y, labelW, row.h);

    if (tier.labelImage) {
      const img = await loadExportImage(tier.labelImage);
      drawCoverImage(ctx, img, labelX, row.y, labelW, row.h, tier.labelImageX, tier.labelImageY);
      const overlay = ctx.createLinearGradient(0, row.y, 0, row.y + row.h);
      overlay.addColorStop(0, 'rgba(0,0,0,.18)');
      overlay.addColorStop(1, 'rgba(0,0,0,.28)');
      ctx.fillStyle = overlay;
      ctx.fillRect(labelX, row.y, labelW, row.h);
    }

    if (state.showTierTitles !== false) {
      drawOutlinedText(ctx, tier.label, labelX + labelW / 2, row.y + row.h / 2, {
        fontSize: 22,
        fontFamily: 'Georgia, serif',
        maxWidth: labelW - 22,
        lineHeight: 27,
        strokeWidth: 5,
        maxLines: 4
      });
    }
  }

  const tierIndexById = new Map(state.tiers.map((tier, index) => [tier.id, index]));
  state.items.filter(item => item.tierId).forEach(item => {
    const tierIndex = tierIndexById.get(item.tierId);
    const row = rows[tierIndex];
    if (!row) return;
    const x = (Number(item.xPct) || 50) / 100 * itemW;
    const y = row.y + (Number(item.yPct) || 50) / 100 * row.h;
    drawOutlinedText(ctx, item.name, x, y, {
      fontSize: clamp(Number(state.entryFontSize) || 14, 10, 24),
      fontFamily: state.entryFontFamily || 'Georgia, serif',
      maxWidth: 210,
      lineHeight: clamp(Number(state.entryFontSize) || 14, 10, 24) * 1.12,
      strokeWidth: 4,
      maxLines: 4
    });
  });

  const separator = getComputedStyle(document.documentElement).getPropertyValue('--tier-separator').trim() || 'rgba(112, 36, 68, .86)';
  ctx.fillStyle = separator;
  ctx.fillRect(itemW - 1.5, 0, 3, canvasH);
  rows.slice(0, -1).forEach(row => {
    ctx.fillRect(0, row.y + row.h - 1.5, canvasW, 3);
  });

  await downloadCanvas(canvas);
}

function exportImage() {
  state.title = els.title.value;
  endFluidDrag(false);
  selectedItemIds.clear();
  renderSelection();

  const reportExportError = (err) => {
    console.warn('Export failed.', err);
    showLoadNotice({
      title: 'Could not export PNG',
      copy: 'The browser could not generate the PNG. Your iceberg was not changed.',
      lines: [err?.message ? `Reason: ${err.message}` : 'Try refreshing the page, then export again.'],
      tone: 'error',
      autoHide: false
    });
  };

  exportImageWithCanvasRenderer().catch(reportExportError);
}

/* ── Hover preview ── */
function getItemTierLabel(item) {
  const tier = getTierById(item?.tierId);
  if (tier) return tier.label;
  const lastTier = item?.lastTierId ? getTierById(item.lastTierId) : null;
  return lastTier?.label || item?.lastTierLabel || 'Unplaced';
}

function positionEntryPreview(clientX, clientY) {
  if (!els.entryPreview || els.entryPreview.hidden) return;
  const pad = 14;
  const offset = 16;
  const rect = els.entryPreview.getBoundingClientRect();
  let left = clientX + offset;
  let top = clientY + offset;
  if (left + rect.width + pad > window.innerWidth) left = clientX - rect.width - offset;
  if (top + rect.height + pad > window.innerHeight) top = clientY - rect.height - offset;
  left = clamp(left, pad, Math.max(pad, window.innerWidth - rect.width - pad));
  top = clamp(top, pad, Math.max(pad, window.innerHeight - rect.height - pad));
  els.entryPreview.style.left = `${left}px`;
  els.entryPreview.style.top = `${top}px`;
}

function renderEntryPreview(itemId, clientX = 0, clientY = 0) {
  clearTimeout(hoverPreviewHideTimer);
  hoverPreviewHideTimer = 0;
  const item = getItemById(itemId);
  if (!item || !els.entryPreview) return;
  const desc = String(item.description || '').trim();
  const images = (item.images || []).slice(0, 6);
  els.entryPreview.innerHTML = `
    <div class="entry-preview-title">${escapeHtml(item.name)}</div>
    ${item.needsVerification ? '<div class="entry-preview-verify">Needs verified</div>' : ''}
    <div class="entry-preview-copy${desc ? '' : ' empty'}">${desc ? renderMarkdown(desc) : 'No description yet.'}</div>
    ${images.length ? `<div class="entry-preview-images">${images.map(image => `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt || image.caption || item.name || 'Entry image')}">`).join('')}</div>` : ''}
  `;
  els.entryPreview.hidden = false;
  els.entryPreview.classList.remove('is-visible');
  requestAnimationFrame(() => {
    positionEntryPreview(clientX, clientY);
    els.entryPreview.classList.add('is-visible');
  });
}

function showHoverPreview(itemId, e) {
  if (fluidDrag || mobileLayoutActive()) {
    hideHoverPreview();
    return;
  }
  clearTimeout(hoverPreviewHideTimer);
  hoverPreviewHideTimer = 0;
  hoveredPreviewItemId = itemId;
  hoverPreviewPoint = { x: e.clientX, y: e.clientY };
  clearTimeout(hoverPreviewTimer);
  hoverPreviewTimer = setTimeout(() => {
    if (hoveredPreviewItemId === itemId && !fluidDrag) {
      renderEntryPreview(itemId, hoverPreviewPoint.x, hoverPreviewPoint.y);
    }
  }, 500);
}

function moveHoverPreview(e) {
  if (mobileLayoutActive()) {
    hideHoverPreview();
    return;
  }
  if (!hoveredPreviewItemId) return;
  hoverPreviewPoint = { x: e.clientX, y: e.clientY };
  if (els.entryPreview && !els.entryPreview.hidden) positionEntryPreview(e.clientX, e.clientY);
}

function hideHoverPreview(itemId = null) {
  if (itemId && hoveredPreviewItemId !== itemId) return;
  hoveredPreviewItemId = null;
  clearTimeout(hoverPreviewTimer);
  hoverPreviewTimer = null;
  if (els.entryPreview) {
    els.entryPreview.classList.remove('is-visible');
    clearTimeout(hoverPreviewHideTimer);
    hoverPreviewHideTimer = window.setTimeout(() => {
      hoverPreviewHideTimer = 0;
      if (!hoveredPreviewItemId && els.entryPreview && !els.entryPreview.classList.contains('is-visible')) {
        els.entryPreview.hidden = true;
      }
    }, 150);
  }
}

/* ── Selection box ── */
function beginSelection(e) {
  if (icebergEditingLocked() || mobileLayoutActive()) return;
  if (e.button !== 0 || e.target.closest('.item-chip') || e.target.closest('.tier-label-title, .tier-label-input')) return;
  const cell = e.target.closest('.tier-items-cell');
  if (!cell) return;
  e.preventDefault();
  clearSelection();
  selectionMoved = false;
  selectionStart = canvasPointFromClient(e.clientX, e.clientY);
  selectionBox = document.createElement('div');
  selectionBox.className = 'selection-box';
  els.wrapper.appendChild(selectionBox);
  updateSelectionBox(e);
}

function updateSelectionBox(e) {
  if (!selectionBox || !selectionStart) return;
  const current = canvasPointFromClient(e.clientX, e.clientY);
  const left = Math.min(selectionStart.x, current.x);
  const top = Math.min(selectionStart.y, current.y);
  const width = Math.abs(selectionStart.x - current.x);
  const height = Math.abs(selectionStart.y - current.y);
  if (width > 4 || height > 4) selectionMoved = true;
  Object.assign(selectionBox.style, {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
  });

  const boxRect = selectionBox.getBoundingClientRect();
  selectedItemIds.clear();
  if (selectionMoved) {
    document.querySelectorAll('.tier-items-cell .item-chip').forEach(chip => {
      const r = chip.getBoundingClientRect();
      const intersects = !(r.right < boxRect.left || r.left > boxRect.right || r.bottom < boxRect.top || r.top > boxRect.bottom);
      if (intersects) selectedItemIds.add(chip.dataset.itemId);
    });
  }
  renderSelection();
}

function endSelection() {
  if (!selectionBox) return;
  selectionBox.remove();
  selectionBox = null;
  selectionStart = null;
}


/* ── Header menus ── */
function headerMenus() {
  return [els.fileMenu, els.displayMenu].filter(Boolean);
}

function setHeaderMenuExpanded(menu, expanded) {
  menu?.querySelector('summary')?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
}

function closeAppMenu() {
  headerMenus().forEach(menu => {
    if (!menu.open) return;
    const summary = menu.querySelector('summary');
    const panel = menu.querySelector('.app-menu-panel');
    setHeaderMenuExpanded(menu, false);
    summary?.blur?.();
    summary?.classList.remove('is-tap-active');
    if (panel) playClosingAnimation(panel, () => {
      menu.open = false;
      setHeaderMenuExpanded(menu, false);
      summary?.blur?.();
    });
    else {
      menu.open = false;
      setHeaderMenuExpanded(menu, false);
      summary?.blur?.();
    }
  });
}

function openMenu(menu) {
  closeConsolePopup();
  closeAboutModal();
  closeAppMenu();
  const panel = menu.querySelector('.app-menu-panel');
  menu.open = true;
  setHeaderMenuExpanded(menu, true);
  restartOpeningAnimation(panel);
}

function openAboutModal() {
  closeConsolePopup();
  closeAppMenu();
  showElementWithFade(els.aboutModal);
  els.aboutBtn?.setAttribute('aria-expanded', 'true');
}

function closeAboutModal() {
  hideElementWithFade(els.aboutModal);
  els.aboutBtn?.setAttribute('aria-expanded', 'false');
}


/* ──────────────────────────────────────────────────────────────
   Event wiring
   Each init function below attaches listeners for one feature
   area. They are invoked in dependency-free order from the boot
   block at the bottom of this file. Listeners that previously
   sat at top level have been gathered here to make the wiring
   surface scannable; attachment order within a single
   element/event is preserved.
   ────────────────────────────────────────────────────────────── */

function initAutosaveUi() {
  window.addEventListener('resize', () => {
    const popup = $('console-popup');
    if (popup && !popup.hidden) updateConsolePopupAnchor();
  });

  $('autosave-restore-btn')?.addEventListener('click', e => { e.stopPropagation(); restoreAutosave(); });
  $('autosave-load-local-btn')?.addEventListener('click', e => { e.stopPropagation(); loadLocalSaveFromAutosave(); });
  $('autosave-fresh-btn')?.addEventListener('click', e => { e.stopPropagation(); startFreshAutosave(); });
  $('autosave-indicator')?.addEventListener('click', e => { e.stopPropagation(); toggleConsolePopup(); });
  $('autosave-indicator')?.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleConsolePopup(); } });
  document.addEventListener('click', e => {
    if (!$('console-popup')?.hidden && !e.target.closest('#console-popup') && !e.target.closest('#autosave-indicator')) closeConsolePopup();
  });

  $('console-clear-cache-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    // Show inline confirmation
    const existing = $('console-clear-confirm');
    if (existing) { existing.remove(); return; }
    const confirm = document.createElement('div');
    confirm.id = 'console-clear-confirm';
    confirm.className = 'console-clear-confirm';
    confirm.innerHTML = `
      <p class="console-confirm-warn">⚠ This will delete your autosave cache. Make sure you have your JSON downloaded first!</p>
      <div class="console-confirm-row">
        <button class="btn primary console-confirm-download" type="button">Download JSON</button>
        <button class="btn danger console-confirm-clear" type="button">Clear cache</button>
      </div>
    `;
    e.target.insertAdjacentElement('afterend', confirm);
    confirm.querySelector('.console-confirm-download').addEventListener('click', ev => { ev.stopPropagation(); saveState(); });
    confirm.querySelector('.console-confirm-clear').addEventListener('click', ev => {
      ev.stopPropagation();
      const clearBtn = ev.currentTarget;
      const downloadBtn = confirm.querySelector('.console-confirm-download');
      if (clearBtn.classList.contains('is-clearing')) return;
      clearBtn.classList.add('is-clearing');
      clearBtn.disabled = true;
      if (downloadBtn) downloadBtn.disabled = true;
      clearBtn.innerHTML = '<span class="btn-spinner" aria-hidden="true"></span><span>Clearing...</span>';
      setTimeout(() => {
        clearAutosaveStorage();
        autosaveReady = true;
        autosaveWriteFailed = false;
        setAutosaveIndicator('saved', 'Autosave cache cleared');
        addConsoleLogEntry({
          title: 'Autosave cache cleared',
          copy: 'Browser autosave was removed. Manual JSON saves are unchanged.',
          lines: [],
          tone: 'warn'
        });
        confirm.remove();
        closeConsolePopup();
      }, 1000);
    });
  });

  // Autosave triggers — broad, intentionally. Skip events from notification UI.
  ['input', 'change'].forEach(type => {
    document.addEventListener(type, e => {
      if (e.target.closest?.('.autosave-modal')) return;
      scheduleAutosave();
    });
  });
  ['click', 'drop', 'pointerup'].forEach(type => {
    document.addEventListener(type, e => {
      if (e.target.closest?.('.autosave-modal')) return;
      setTimeout(scheduleAutosave, 0);
    });
  });
}

function initFileMenuAndEntryInput() {
  els.title.addEventListener('input', e => {
    if (icebergEditingLocked()) {
      e.target.value = state.title || '';
      return;
    }
    state.title = e.target.value;
    e.target.style.height = 'auto';
    e.target.style.height = e.target.scrollHeight + 'px';
  });
  $('save-btn').addEventListener('click', () => { closeAppMenu(); saveState(); });
  $('load-btn').addEventListener('click', () => { closeAppMenu(); els.file.click(); });
  $('export-btn').addEventListener('click', () => { closeAppMenu(); exportImage(); });
  els.file.addEventListener('change', loadState);
  els.tierImageFile?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    const tierId = pendingTierImageId;
    pendingTierImageId = null;
    e.target.value = '';
    if (file && tierId) setTierLabelImage(tierId, file);
  });
  $('add-item-btn').addEventListener('click', addItem);
  els.newName.addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); });
  els.newName.addEventListener('input', () => showAddError(''));
}

function initDisplaySettings() {
  els.entrySize.addEventListener('input', e => {
    state.entryFontSize = Number(e.target.value);
    applyEntrySize();
  });
  els.entryFont.addEventListener('change', e => {
    state.entryFontFamily = e.target.value;
    applyEntryFont();
  });
  $('bg-blur')?.addEventListener('input', e => {
    state.bgBlur = Number(e.target.value);
    applyBgBlur();
  });
  els.showTierTitles?.addEventListener('change', e => {
    state.showTierTitles = !!e.target.checked;
    applyTierTitleVisibility();
    scheduleAutosave();
  });

  els.showPips?.addEventListener('change', e => {
    state.showPips = !!e.target.checked;
    applyPipVisibility();
    scheduleAutosave();
  });

  els.entryDrift?.addEventListener('change', e => {
    state.entryDrift = !!e.target.checked;
    applyEntryDriftSetting();
    scheduleAutosave();
  });
}

function initIcebergLock() {
  ['mouseenter', 'mouseleave', 'focus', 'blur'].forEach(eventName => {
    els.icebergLockToggle?.addEventListener(eventName, () => {
      scheduleLockLottieRecolor(state.icebergLocked === true);
    });
  });

  els.icebergLockToggle?.addEventListener('click', e => {
    e.preventDefault();
    e.currentTarget?.blur?.();
    state.icebergLocked = !state.icebergLocked;
    if (state.icebergLocked) {
      endFluidDrag(false);
      clearSelection();
      closeTierImageMenu();
      setTierImageMoveMode(null);
      if (els.detailCard?.classList.contains('description-editing')) {
        if (!commitTitleEditIfOpen()) {
          state.icebergLocked = false;
          return;
        }
        saveOpenImageCaption({ force: true });
        finishDescriptionEdit();
      }
      if (els.detailTitleEdit && !els.detailTitleEdit.hidden) {
        els.detailTitleEdit.hidden = true;
        els.detailTitleDisplay.hidden = false;
        showDetailTitleError('');
      }
    }
    applyIcebergLockSetting({ syncAnimation: false });
    setLockLottieState(state.icebergLocked === true, true);
    renderTiers();
    renderPool();
    if (currentItemId) renderDetailPanel();
    triggerIcebergLockPulse(state.icebergLocked === true);
    scheduleAutosave();
  });
}

function initIcebergSearch() {
  if (els.icebergSearch) {
    els.icebergSearch.addEventListener('input', e => {
      icebergSearchTerm = e.target.value;
      renderTiers();
      updateIcebergSearchCount();
      applyIcebergSearchVisuals();
    });
  }
}

function initEntryDriftHover() {
  els.wrapper?.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    entryDriftPointer = { x: e.clientX, y: e.clientY };
    scheduleEntryDriftUpdate();
  });
  els.wrapper?.addEventListener('pointerleave', () => clearEntryDriftOffsets());
  els.wrapper?.addEventListener('pointercancel', () => clearEntryDriftOffsets());
}

function initSidebarCollapse() {
  els.detailCollapse.addEventListener('click', e => {
    e.stopPropagation();
    const isCollapsed = els.detailSidebar.classList.contains('collapsed');
    if (isCollapsed) showDetailSidebar();
    else hideDetailSidebar(false);
  });

  els.leftCollapse?.addEventListener('click', e => {
    e.stopPropagation();
    const isCollapsed = els.leftSidebar?.classList.contains('collapsed');
    if (isCollapsed) showLeftSidebar();
    else hideLeftSidebar();
  });
}

function initTierInteraction() {
  els.tiers.addEventListener('click', e => {
    const menuToggle = e.target.closest?.('.tier-image-menu-toggle');
    if (menuToggle && icebergEditingLocked()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (menuToggle) {
      e.preventDefault();
      e.stopPropagation();
      const tierId = menuToggle.dataset.tierId || null;
      setTierImageMoveMode(null);
      setTierImageMenuOpen(activeTierImageMenuId === tierId ? null : tierId);
      return;
    }
    const action = e.target.closest?.('.tier-image-action');
    if (action && icebergEditingLocked()) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (action) {
      e.preventDefault();
      e.stopPropagation();
      const tierId = action.dataset.tierId || null;
      const actionName = action.dataset.action;
      closeTierImageMenu();
      if (actionName === 'image') {
        pendingTierImageId = tierId;
        els.tierImageFile?.click();
        return;
      }
      if (actionName === 'move') {
        setTierImageMoveMode(tierId);
        return;
      }
      if (actionName === 'remove') {
        clearTierLabelImage(tierId);
      }
    }
  });

  els.tiers.addEventListener('input', e => {
    if (icebergEditingLocked()) return;
    const labelInput = e.target.closest?.('.tier-label-input');
    if (!labelInput) return;
    const tier = getTierById(labelInput.dataset.tierId);
    if (!tier) return;
    tier.label = labelInput.value;
    labelInput.style.height = 'auto';
    labelInput.style.height = Math.max(labelInput.scrollHeight + 14, 58) + 'px';
    state.items.forEach(item => {
      if (item.tierId === tier.id || item.lastTierId === tier.id) item.lastTierLabel = tier.label;
    });
    if (currentItemId) renderDetailPanel();
  });

  els.tiers.addEventListener('blur', e => {
    if (icebergEditingLocked()) return;
    const labelInput = e.target.closest?.('.tier-label-input');
    if (!labelInput) return;
    const tier = getTierById(labelInput.dataset.tierId);
    if (!tier) return;
    const label = String(labelInput.value || '').trim() || 'Untitled';
    tier.label = label;
    labelInput.value = label;
    state.items.forEach(item => {
      if (item.tierId === tier.id || item.lastTierId === tier.id) item.lastTierLabel = label;
    });
    renderTiers();
    if (currentItemId) renderDetailPanel();
    scheduleAutosave();
  }, true);

  document.addEventListener('click', e => {
    if (!e.target.closest?.('.tier-label-image-controls')) closeTierImageMenu();
    if (tierImageMoveModeId && !e.target.closest?.(tierLabelCellSelector(tierImageMoveModeId))) setTierImageMoveMode(null);
  });

  els.tiers.addEventListener('pointerdown', beginTierImageMove, true);
  document.addEventListener('pointermove', updateTierImageMove, true);
  document.addEventListener('pointerup', endTierImageMove, true);
  document.addEventListener('pointercancel', endTierImageMove, true);
}

function initSelectionAndDrag() {
  els.tiers.addEventListener('mousedown', beginSelection);
  document.addEventListener('mousemove', updateSelectionBox);
  document.addEventListener('mouseup', endSelection);

  els.tiers.addEventListener('pointerdown', beginFluidDrag);
  document.addEventListener('pointermove', updateFluidDrag);
  document.addEventListener('pointerup', e => endFluidDrag(true, e.clientX, e.clientY));
  document.addEventListener('pointercancel', () => endFluidDrag(false));

  document.addEventListener('dragstart', e => { setDragItemFromEvent(e); });
  document.addEventListener('dragend', e => {
    e.target.closest('.item-chip')?.classList.remove('dragging');
    clearDragOverHighlights();
    dragItemId = null;
    clearDragGhost();
    endFluidDrag(false);
  });
}

function initChipAndInternalLinkInteraction() {
  document.addEventListener('pointerdown', e => {
    if (!mobileLayoutActive()) return;
    const internalEntryLink = e.target.closest?.('.internal-entry-link');
    if (!internalEntryLink) return;
    e.preventDefault();
    e.stopPropagation();
    openInternalEntryLink(internalEntryLink);
  }, { capture: true });

  document.addEventListener('mouseover', e => {
    const internalEntryLink = e.target.closest('.internal-entry-link');
    if (internalEntryLink && !entryPickMode && !mobileLayoutActive()) {
      const previous = e.relatedTarget;
      if (!previous || !internalEntryLink.contains(previous)) showInternalEntryLinkLine(internalEntryLink);
    }

    const chip = e.target.closest('.item-chip');
    if (!chip || e.target.closest('.chip-delete-btn') || entryPickMode) return;
    const previous = e.relatedTarget;
    if (previous && chip.contains(previous)) return;
    showHoverPreview(chip.dataset.itemId, e);
  });

  document.addEventListener('mousemove', e => {
    updateEntryPickLineFromPointer(e);
    if (hoveredInternalLinkEl && !entryPickMode && !mobileLayoutActive()) scheduleSearchLinesUpdate();
    if (e.target.closest('.item-chip') && !entryPickMode) moveHoverPreview(e);
    setDescriptionToolErrorPointFromEvent(e);
    if (els.entryLinkHint?.classList.contains('is-error')) positionDescriptionToolError(e.clientX, e.clientY);
  });

  document.addEventListener('mouseout', e => {
    const internalEntryLink = e.target.closest('.internal-entry-link');
    if (internalEntryLink) {
      const next = e.relatedTarget;
      if (!next || !internalEntryLink.contains(next)) clearInternalEntryLinkLine();
    }

    const chip = e.target.closest('.item-chip');
    if (!chip) return;
    const next = e.relatedTarget;
    if (next && chip.contains(next)) return;
    hideHoverPreview(chip.dataset.itemId);
  });

  document.addEventListener('click', e => {
    const internalEntryLink = e.target.closest('.internal-entry-link');
    if (internalEntryLink) {
      e.preventDefault();
      e.stopPropagation();
      openInternalEntryLink(internalEntryLink);
      return;
    }

    if (selectionMoved) {
      selectionMoved = false;
      return;
    }

    const deleteButton = e.target.closest('.chip-delete-btn');
    if (deleteButton && icebergEditingLocked()) {
      e.stopPropagation();
      return;
    }
    if (deleteButton) {
      e.stopPropagation();
      deleteItem(deleteButton.dataset.itemId);
      return;
    }

    const chip = e.target.closest('.item-chip');
    if (chip) {
      e.stopPropagation();
      if (entryPickMode) {
        insertEntryLink(chip.dataset.itemId);
        return;
      }
      selectedItemIds = new Set([chip.dataset.itemId]);
      renderSelection();
      hideHoverPreview(chip.dataset.itemId);
      clearRandomHighlight();
      if (mobileLayoutActive()) {
        linkedEntryBackStack = [];
        syncLinkedEntryBackButton();
        const tappedItem = getItemById(chip.dataset.itemId);
        mobileDetailsReturnPanel = (!tappedItem?.tierId && els.leftSidebar?.classList.contains('mobile-panel-open')) ? 'entries' : 'none';
      }
      openModal(chip.dataset.itemId);
      return;
    }

    if (e.target.closest('.detail-sidebar') || e.target.closest('.image-modal') || e.target.closest('.about-modal') || e.target.closest('header')) return;
    hideHoverPreview();
    if (els.detailCard?.classList.contains('description-editing')) return;
    clearDetailSelection();
  });
}

function initDropZones() {
  els.tiers.addEventListener('dragover', e => {
    if (icebergEditingLocked()) return;
    const labelCell = e.target.closest('.tier-label-cell');
    if (labelCell && e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
      labelCell.classList.add('drag-over');
      return;
    }
    const cell = e.target.closest('.tier-items-cell');
    if (!cell) return;
    e.preventDefault();
    cell.classList.add('drag-over');
  });
  els.tiers.addEventListener('dragleave', e => {
    const labelCell = e.target.closest('.tier-label-cell');
    if (labelCell && !labelCell.contains(e.relatedTarget)) labelCell.classList.remove('drag-over');
    const cell = e.target.closest('.tier-items-cell');
    if (cell && !cell.contains(e.relatedTarget)) cell.classList.remove('drag-over');
  });
  els.tiers.addEventListener('drop', e => {
    if (icebergEditingLocked()) { clearDragOverHighlights(); return; }
    const labelCell = e.target.closest('.tier-label-cell');
    if (labelCell && e.dataTransfer?.files?.length) {
      e.preventDefault();
      labelCell.classList.remove('drag-over');
      setTierLabelImage(labelCell.dataset.tierId, e.dataTransfer.files[0]);
      return;
    }
    const cell = e.target.closest('.tier-items-cell');
    if (cell) dropOnTier(e, cell.dataset.tierId);
  });
  els.pool.addEventListener('dragover', e => { if (icebergEditingLocked()) { els.pool.classList.remove('drag-over'); return; } e.preventDefault(); els.pool.classList.add('drag-over'); });
  els.pool.addEventListener('dragleave', () => els.pool.classList.remove('drag-over'));
  els.pool.addEventListener('drop', dropOnPool);
}

function initDetailSidebar() {
  els.detailTitleDisplay.addEventListener('click', beginTitleEdit);
  els.detailTitleDisplay.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); beginTitleEdit(); }
  });
  els.detailTitleEdit.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishTitleEdit(); }
  });

  [els.formatBold, els.formatItalic, els.formatCode, els.detailLinkUrl, els.descriptionSyntaxToggle, els.detailPickEntry].forEach(button => {
    button?.addEventListener('mousedown', e => {
      setDescriptionToolErrorPointFromEvent(e);
      e.preventDefault();
      saveDescriptionSelection();
      if (button === els.descriptionSyntaxToggle) switchingDescriptionMode = true;
    });
  });
  els.formatBold?.addEventListener('click', () => execRichCommand('bold'));
  els.formatItalic?.addEventListener('click', () => execRichCommand('italic'));
  els.formatCode?.addEventListener('click', applyRichCode);
  els.detailLinkUrl?.addEventListener('click', applyUrlLink);
  els.descriptionSyntaxToggle?.addEventListener('click', () => switchDescriptionEditorMode());
  els.detailPickEntry?.addEventListener('click', () => startEntryPickMode());
  els.entryLinkSearch?.addEventListener('input', e => renderEntryLinkPicker(e.target.value));
  els.entryLinkList?.addEventListener('click', e => {
    const option = e.target.closest('.entry-link-option');
    if (!option) return;
    e.preventDefault();
    insertEntryLink(option.dataset.entryId);
  });

  els.detailDescRichEdit?.addEventListener('keyup', saveDescriptionSelection);
  els.detailDescRichEdit?.addEventListener('mouseup', saveDescriptionSelection);
  els.detailDescRichEdit?.addEventListener('input', () => syncDescriptionDraft());
  els.detailDescRichEdit?.addEventListener('keydown', handleDescriptionShortcut);
  els.detailDescEdit?.addEventListener('input', () => syncDescriptionDraft());
  els.detailDescEdit?.addEventListener('keyup', saveDescriptionSelection);
  els.detailDescEdit?.addEventListener('mouseup', saveDescriptionSelection);
  els.detailDescEdit?.addEventListener('keydown', handleDescriptionShortcut);

  document.addEventListener('selectionchange', () => {
    if (!els.detailDescRichEdit || els.detailDescRichEdit.hidden) return;
    if (selectionInsideRichEditor()) saveDescriptionSelection();
  });

  els.detailEditBtn?.addEventListener('click', beginDescriptionEdit);
  els.detailDoneBtn?.addEventListener('click', () => {
    if (!commitTitleEditIfOpen()) return;
    finishDescriptionEdit();
  });

  els.detailNeedsVerification?.addEventListener('change', toggleCurrentVerification);
  els.detailRemoveDelete?.addEventListener('click', removeOrDeleteCurrentItem);
}

function initImageManager() {
  els.imageDropZone?.addEventListener('click', e => {
    if (!detailImageEditingAllowed()) return;
    if (e.target.closest('.description-image-thumb')) return;
    els.detailImageFile?.click();
  });
  els.imageDropZone?.addEventListener('keydown', e => {
    if (!detailImageEditingAllowed()) return;
    if (e.target.closest?.('.description-image-thumb, .description-image-remove')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.detailImageFile?.click();
    }
  });
  els.detailImageFile?.addEventListener('change', e => {
    if (icebergEditingLocked()) {
      e.target.value = '';
      return;
    }
    addImageFiles(e.target.files);
    e.target.value = '';
  });
  els.detailImages?.addEventListener('click', e => {
    const remove = e.target.closest('.description-image-remove');
    if (remove) {
      e.preventDefault();
      e.stopPropagation();
      if (detailImageEditingAllowed()) removeCurrentImage(remove.dataset.imageId);
      return;
    }
    const thumb = e.target.closest('.description-image-thumb');
    if (!thumb) return;
    e.stopPropagation();
    openImagePreview(thumb.dataset.imageId);
  });
  els.detailImages?.addEventListener('keydown', e => {
    const thumb = e.target.closest('.description-image-thumb');
    if (!thumb || e.target.closest('.description-image-remove')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      openImagePreview(thumb.dataset.imageId);
    }
  });
  els.imageManager?.addEventListener('dragover', e => {
    if (!detailImageEditingAllowed()) {
      els.imageManager.classList.remove('drag-over');
      return;
    }
    if (![...e.dataTransfer.items || []].some(item => item.kind === 'file')) return;
    e.preventDefault();
    els.imageManager.classList.add('drag-over');
  });
  els.imageManager?.addEventListener('dragleave', e => {
    if (!els.imageManager.contains(e.relatedTarget)) els.imageManager.classList.remove('drag-over');
  });
  els.imageManager?.addEventListener('drop', e => {
    if (!detailImageEditingAllowed()) {
      els.imageManager.classList.remove('drag-over');
      return;
    }
    e.preventDefault();
    els.imageManager.classList.remove('drag-over');
    addImageFiles(e.dataTransfer.files);
  });
}

function initImageModal() {
  els.imageModalTitle?.addEventListener('pointerdown', e => {
    if (!imageModalEditingAllowed()) e.preventDefault();
  });
  els.imageModalTitle?.addEventListener('input', e => {
    if (currentImagePreviewId && imageModalEditingAllowed()) {
      updateImageTitle(currentImagePreviewId, e.target.value);
    }
  });
  els.imageModalTitle?.addEventListener('change', saveOpenImageCaption);
  els.imageModalTitle?.addEventListener('blur', saveOpenImageCaption);
  els.imageModalCaption?.addEventListener('pointerdown', e => {
    if (!imageModalEditingAllowed()) e.preventDefault();
  });
  els.imageModalCaption?.addEventListener('input', () => {
    if (currentImagePreviewId && imageModalEditingAllowed()) saveOpenImageCaption();
  });
  els.imageModalCaption?.addEventListener('blur', saveOpenImageCaption);
  [els.imageModalBold, els.imageModalItalic, els.imageModalCode, els.imageModalLink].forEach(button => {
    button?.addEventListener('mousedown', e => e.preventDefault());
  });
  els.imageModalBold?.addEventListener('click', () => execImageModalCommand('bold'));
  els.imageModalItalic?.addEventListener('click', () => execImageModalCommand('italic'));
  els.imageModalCode?.addEventListener('click', applyImageModalCode);
  els.imageModalLink?.addEventListener('click', applyImageModalLink);
  els.imageModalEditBtn?.addEventListener('click', () => {
    ensureImageModalEditMode(els.imageModalCaption || els.imageModalTitle);
  });
  els.imageModalDoneBtn?.addEventListener('click', finishImageModalEdit);
  els.imageModalPrev?.addEventListener('click', () => showAdjacentImagePreview(-1));
  els.imageModalNext?.addEventListener('click', () => showAdjacentImagePreview(1));
  els.imageModal?.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.target && (e.target.closest?.('textarea, [contenteditable="true"'))) return;
    e.preventDefault();
    showAdjacentImagePreview(e.key === 'ArrowLeft' ? -1 : 1);
  });

  els.imageModal?.addEventListener('click', e => {
    if (e.target === els.imageModal) closeImagePreview();
  });
}

function initAboutAndRandom() {
  els.aboutBtn?.addEventListener('click', e => {
    e.stopPropagation();
    if (els.aboutModal?.hidden === false) closeAboutModal();
    else openAboutModal();
  });
  document.addEventListener('click', e => {
    if (els.aboutModal && !els.aboutModal.hidden && !e.target.closest('#about-modal') && !e.target.closest('#about-btn')) closeAboutModal();
  });

  $('search-random-btn')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const placed = state.items.filter(i => i.tierId);
    if (!placed.length) return;
    const searchWasOpen = mobileLayoutActive() && !$('mobile-search-sheet')?.hidden;
    const pick = placed[Math.floor(Math.random() * placed.length)];
    clearIcebergSearch();
    linkedEntryBackStack = [];
    selectedItemIds = new Set([pick.id]);
    if (!openModal(pick.id)) return;
    if (!searchWasOpen) closeMobileSearchSheet();
    if (mobileLayoutActive()) setMobilePanel('details', { keepSearchOpen: searchWasOpen });
    if (searchWasOpen) updateMobileSearchSheetMetrics();
    window.clearTimeout(randomHighlightTimer);
    randomHighlightTimer = window.setTimeout(() => {
      if (currentItemId !== pick.id) return;
      const chip = document.querySelector(itemChipSelector(pick.id, true));
      if (!chip) return;
      chip.scrollIntoView({ behavior: 'smooth', block: 'center' });
      chip.classList.add('random-highlight');
      document.body.classList.add('has-random-highlight');
      randomHighlightTimer = 0;
    }, 50);
  });
  els.aboutModal?.addEventListener('click', e => {
    if (e.target === els.aboutModal) closeAboutModal();
  });
}

function initHeaderMenusAndGlobalKeys() {
  document.addEventListener('click', e => {
    if (headerMenus().some(menu => menu.open) && !e.target.closest('.header-menu')) closeAppMenu();
  });

  headerMenus().forEach(menu => {
    const summary = menu.querySelector('summary');
    summary?.addEventListener('mousedown', e => { e.preventDefault(); });
    summary?.addEventListener('pointerup', () => window.setTimeout(() => summary.blur?.(), 0));
    summary?.addEventListener('click', e => {
      e.preventDefault();
      if (menu.open) {
        closeAppMenu();
        window.setTimeout(() => summary.blur?.(), 0);
      } else {
        openMenu(menu);
      }
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (headerMenus().some(menu => menu.open)) { closeAppMenu(); return; }
    if (els.aboutModal && !els.aboutModal.hidden) { closeAboutModal(); return; }
    if (entryPickMode) { stopEntryPickMode(); return; }
    if (els.entryLinkPicker && !els.entryLinkPicker.hidden) { closeEntryLinkPicker(); return; }
    if (els.imageModal && !els.imageModal.hidden) { closeImagePreview(); return; }
    if (!els.detailTitleEdit.hidden) {
      els.detailTitleEdit.hidden = true;
      els.detailTitleDisplay.hidden = false;
      showDetailTitleError('');
      return;
    }
    hideHoverPreview();
    if (els.detailCard?.classList.contains('description-editing')) return;
    clearDetailSelection();
  });
}

function initScrollWatchers() {
  els.wrapper?.closest('.iceberg-area')?.addEventListener('scroll', () => {
    scheduleSearchLinesUpdate();
    if (entryPickMode) scheduleEntryPickLineUpdate();
  }, { passive: true });
  els.detailSidebar?.addEventListener('scroll', () => {
    scheduleSearchLinesUpdate();
    if (entryPickMode) scheduleEntryPickLineUpdate();
  }, { passive: true });
  window.addEventListener('resize', () => {
    scheduleSearchLinesUpdate();
    if (entryPickMode) scheduleEntryPickLineUpdate();
  });
  window.addEventListener('scroll', () => {
    scheduleSearchLinesUpdate();
    if (entryPickMode) scheduleEntryPickLineUpdate();
  }, { passive: true });

  // Avoid sticky focus highlight on sidebar retract buttons.
  [els.leftCollapse, els.detailCollapse].filter(Boolean).forEach(btn => {
    btn.addEventListener('click', () => setTimeout(() => btn.blur(), 0));
  });
}


/* ── Mobile layout ── */
const mobileSearchPlacement = {
  initialized: false,
  titleRow: null,
  searchPanel: null,
  titlePlaceholder: null,
  searchPlaceholder: null,
};
let mobileDetailsReturnPanel = 'none';
let linkedEntryBackStack = [];

function mobileLayoutActive() {
  const vvWidth = window.visualViewport?.width || Infinity;
  const coarseMobile = window.matchMedia?.('(pointer: coarse) and (max-width: 1100px)').matches;
  return window.matchMedia?.('(max-width: 760px)').matches || window.innerWidth <= 760 || vvWidth <= 760 || coarseMobile;
}

function syncMobileSearchPlacement() {
  const sheetContent = $('mobile-search-sheet-content');
  const detailSidebar = els.detailSidebar;
  if (!sheetContent || !detailSidebar) return;

  if (!mobileSearchPlacement.initialized) {
    mobileSearchPlacement.titleRow = detailSidebar.querySelector('.sidebar-chart-title-row');
    mobileSearchPlacement.searchPanel = detailSidebar.querySelector('.detail-search-panel');
    mobileSearchPlacement.titlePlaceholder = document.createComment('mobile title placeholder');
    mobileSearchPlacement.searchPlaceholder = document.createComment('mobile search placeholder');
    mobileSearchPlacement.titleRow?.parentNode?.insertBefore(mobileSearchPlacement.titlePlaceholder, mobileSearchPlacement.titleRow);
    mobileSearchPlacement.searchPanel?.parentNode?.insertBefore(mobileSearchPlacement.searchPlaceholder, mobileSearchPlacement.searchPanel);
    mobileSearchPlacement.initialized = true;
  }

  const { titleRow, searchPanel, titlePlaceholder, searchPlaceholder } = mobileSearchPlacement;
  if (!titleRow || !searchPanel) return;

  if (mobileLayoutActive()) {
    const titleParent = titlePlaceholder?.parentNode;
    if (titleParent && titleRow.parentNode !== titleParent) titleParent.insertBefore(titleRow, titlePlaceholder.nextSibling);
    if (searchPanel.parentNode !== sheetContent) sheetContent.appendChild(searchPanel);
  } else {
    const titleParent = titlePlaceholder?.parentNode;
    const searchParent = searchPlaceholder?.parentNode;
    if (titleParent && titleRow.parentNode !== titleParent) titleParent.insertBefore(titleRow, titlePlaceholder.nextSibling);
    if (searchParent && searchPanel.parentNode !== searchParent) searchParent.insertBefore(searchPanel, searchPlaceholder.nextSibling);
    closeMobileSearchSheet();
  }
}

function setMobilePanel(panelName = 'none', options = {}) {
  const entriesOpen = panelName === 'entries';
  const detailsOpen = panelName === 'details';
  if (mobileLayoutActive()) {
    els.leftSidebar?.classList.remove('collapsed');
    els.detailSidebar?.classList.remove('collapsed');
  }
  els.leftSidebar?.classList.toggle('mobile-panel-open', entriesOpen);
  els.detailSidebar?.classList.toggle('mobile-panel-open', detailsOpen);
  document.body.classList.toggle('mobile-panel-open-body', entriesOpen || detailsOpen);

  if (mobileLayoutActive() && !detailsOpen && selectedItemIds.size) {
    selectedItemIds.clear();
    renderSelection();
  }

  const entriesBtn = $('mobile-nav-entries');
  const detailsBtn = $('mobile-nav-details');
  entriesBtn?.classList.toggle('active', entriesOpen);
  detailsBtn?.classList.toggle('active', detailsOpen);
  entriesBtn?.setAttribute('aria-expanded', String(entriesOpen));
  detailsBtn?.setAttribute('aria-expanded', String(detailsOpen));
  if (entriesOpen || detailsOpen) {
    if (options.keepSearchOpen && detailsOpen) updateMobileSearchSheetMetrics();
    else closeMobileSearchSheet();
  }
}


function updateMobileSearchSheetMetrics() {
  const sheet = $('mobile-search-sheet');
  const root = document.documentElement;
  const isOpen = !!sheet && !sheet.hidden && mobileLayoutActive();
  document.body.classList.toggle('mobile-search-open', isOpen);
  if (!isOpen || !sheet) {
    root.style.removeProperty('--mobile-search-sheet-h');
    return;
  }
  const height = Math.ceil(sheet.getBoundingClientRect().height || sheet.offsetHeight || 0);
  if (height > 0) root.style.setProperty('--mobile-search-sheet-h', `${height}px`);
}

function openMobileSearchSheet() {
  if (!mobileLayoutActive()) return;
  syncMobileSearchPlacement();
  setMobilePanel('none');
  const sheet = $('mobile-search-sheet');
  const toggle = $('mobile-search-toggle');
  if (!sheet) return;
  sheet.hidden = false;
  updateMobileSearchSheetMetrics();
  toggle?.classList.add('active');
  toggle?.setAttribute('aria-expanded', 'true');
  window.setTimeout(() => els.icebergSearch?.focus({ preventScroll: true }), 0);
}

function closeMobileSearchSheet() {
  const sheet = $('mobile-search-sheet');
  const toggle = $('mobile-search-toggle');
  if (sheet) sheet.hidden = true;
  updateMobileSearchSheetMetrics();
  toggle?.classList.remove('active');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.blur?.();
  if (mobileLayoutActive()) clearIcebergSearch();
}

function toggleMobileSearchSheet() {
  const sheet = $('mobile-search-sheet');
  if (!sheet || sheet.hidden) openMobileSearchSheet();
  else closeMobileSearchSheet();
}

function syncLinkedEntryBackButton() {
  if (!els.linkedEntryBack) return;
  const canGoBack = mobileLayoutActive() && currentItemId && linkedEntryBackStack.some(id => !!getItemById(id));
  els.linkedEntryBack.hidden = !canGoBack;
}

function goBackFromLinkedEntry() {
  while (linkedEntryBackStack.length) {
    const previousId = linkedEntryBackStack.pop();
    const previousItem = getItemById(previousId);
    if (!previousItem || previousId === currentItemId) continue;
    selectedItemIds = previousItem.tierId ? new Set([previousItem.id]) : new Set();
    renderSelection();
    openModal(previousItem.id);
    syncLinkedEntryBackButton();
    return;
  }
  syncLinkedEntryBackButton();
}

function updateMobileIcebergScale() {
  const root = document.documentElement;
  if (!els.wrapper) return;

  syncMobileSearchPlacement();

  if (!mobileLayoutActive()) {
    root.style.removeProperty('--mobile-iceberg-scale');
    root.style.removeProperty('--mobile-canvas-logical-w');
    root.style.removeProperty('--mobile-canvas-display-w');
    root.style.removeProperty('--mobile-canvas-display-h');
    document.body.classList.remove('mobile-layout-active', 'mobile-panel-open-body');
    els.leftSidebar?.classList.remove('mobile-panel-open');
    els.detailSidebar?.classList.remove('mobile-panel-open');
    return;
  }

  document.body.classList.add('mobile-layout-active');
  hideHoverPreview();
  const area = els.wrapper.closest('.iceberg-area');
  const viewportWidth = Math.min(
    window.innerWidth || Infinity,
    window.visualViewport?.width || Infinity,
    document.documentElement.clientWidth || Infinity
  );
  const rawAreaWidth = area?.clientWidth || viewportWidth || window.innerWidth || 1;
  const areaWidth = Math.max(1, Math.min(rawAreaWidth, viewportWidth || rawAreaWidth));
  const styles = getComputedStyle(area || document.documentElement);
  const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  const availableWidth = Math.max(240, areaWidth - padX);
  const rootStyles = getComputedStyle(document.documentElement);
  const canvasWidth = parseFloat(rootStyles.getPropertyValue('--canvas-w')) || 980;
  const canvasHeight = parseFloat(rootStyles.getPropertyValue('--canvas-h')) || 1752;
  const desktopLabelWidth = parseFloat(rootStyles.getPropertyValue('--label-w')) || 185;
  const mobileRailWidth = parseFloat(rootStyles.getPropertyValue('--mobile-tier-rail-w')) || 8;
  const logicalWidth = Math.max(320, canvasWidth - desktopLabelWidth + mobileRailWidth);
  const scale = Math.min(1, availableWidth / logicalWidth);

  root.style.setProperty('--mobile-canvas-logical-w', `${Math.ceil(logicalWidth)}px`);
  root.style.setProperty('--mobile-iceberg-scale', scale.toFixed(5));
  root.style.setProperty('--mobile-canvas-display-w', `${Math.ceil(logicalWidth * scale)}px`);
  root.style.setProperty('--mobile-canvas-display-h', `${Math.ceil(canvasHeight * scale)}px`);
  syncLinkedEntryBackButton();
  scheduleSearchLinesUpdate();
}


function initHeaderMenuFocusCleanup() {
  document.querySelectorAll('.header-menu > summary').forEach(summary => {
    const details = summary.parentElement;
    if (!details) return;
    summary.addEventListener('click', () => {
      const wasOpen = details.open;
      if (wasOpen) window.setTimeout(() => summary.blur(), 0);
    });
    details.addEventListener('toggle', () => {
      if (!details.open) window.setTimeout(() => summary.blur(), 0);
    });
  });
}

function initMobileLayout() {
  const entriesBtn = $('mobile-nav-entries');
  const detailsBtn = $('mobile-nav-details');
  const entriesClose = $('mobile-entries-close');
  const detailsClose = $('mobile-details-close');
  const searchToggle = $('mobile-search-toggle');
  const searchClose = $('mobile-search-close');

  entriesBtn?.addEventListener('click', () => { mobileDetailsReturnPanel = 'none'; setMobilePanel('entries'); });
  detailsBtn?.addEventListener('click', () => { mobileDetailsReturnPanel = 'none'; setMobilePanel('details'); });
  entriesClose?.addEventListener('click', () => setMobilePanel('none'));
  detailsClose?.addEventListener('click', () => {
    const targetPanel = mobileDetailsReturnPanel === 'entries' ? 'entries' : 'none';
    mobileDetailsReturnPanel = 'none';
    setMobilePanel(targetPanel);
  });
  searchToggle?.addEventListener('click', toggleMobileSearchSheet);
  searchClose?.addEventListener('click', closeMobileSearchSheet);
  els.linkedEntryBack?.addEventListener('click', goBackFromLinkedEntry);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !mobileLayoutActive()) return;
    if (!$('mobile-search-sheet')?.hidden) {
      closeMobileSearchSheet();
      return;
    }
    if (els.leftSidebar?.classList.contains('mobile-panel-open') || els.detailSidebar?.classList.contains('mobile-panel-open')) {
      setMobilePanel('none');
    }
  });

  window.addEventListener('resize', () => { updateMobileIcebergScale(); updateMobileSearchSheetMetrics(); });
  window.addEventListener('orientationchange', () => window.setTimeout(() => { updateMobileIcebergScale(); updateMobileSearchSheetMetrics(); }, 80));
  updateMobileIcebergScale();
}

/* ── Init ── */
showDetailSidebar();
initLockLottie();
initAutosaveUi();
initFileMenuAndEntryInput();
initDisplaySettings();
initIcebergLock();
initIcebergSearch();
initEntryDriftHover();
initSidebarCollapse();
initTierInteraction();
initSelectionAndDrag();
initChipAndInternalLinkInteraction();
initDropZones();
initDetailSidebar();
initImageManager();
initImageModal();
initAboutAndRandom();
initHeaderMenusAndGlobalKeys();
initScrollWatchers();
initAutosave();
initHeaderMenuFocusCleanup();
initMobileLayout();
render();
renderDetailPanel();
updateMobileIcebergScale();
scheduleSearchLinesUpdate();
