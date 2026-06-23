/* Interactive Iceberg — global state, DOM refs, hoisted helpers.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

// Apply mobile layout class before first paint (relocated from constants).
// Mobile styling keys entirely off body.mobile-layout-active (no media
// queries) — apply it immediately at script eval so the first paint after
// the loader is already correct. mobileLayoutActive() is hoisted.
if (mobileLayoutActive()) document.body.classList.add('mobile-layout-active');


let state = {
  version: STATE_VERSION,
  title: 'My Iceberg',
  entryFontSize: 14,
  entryFontFamily: 'Georgia, serif',
  bgBlur: 0,
  showTierTitles: true,
  showPips: true,
  entryDrift: true,
  bannerImage: '',
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
let mobileDetailsReturnPanel = 'none';
let linkedEntryBackStack = [];

const $ = id => document.getElementById(id);

const els = {
  title: $('chart-title'),
  file: $('file-input'),
  tierImageFile: $('tier-image-file'),
  bannerImageFile: $('banner-image-file'),
  pool: $('unplaced-pool'),
  favouritesPool: $('favourites-pool'),
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
  chartBannerWrap: $('chart-banner-wrap'),
  chartBannerImg: $('chart-banner-img'),
  chartBannerMenuToggle: $('chart-banner-menu-toggle'),
  chartBannerMenu: $('chart-banner-menu'),
  chartBannerAdd: $('chart-banner-add-btn'),
  chartBannerReplace: $('chart-banner-replace-btn'),
  chartBannerRemove: $('chart-banner-remove-btn'),
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
  detailFavourite: $('detail-favourite-toggle'),
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
  fileMenu: $('file-menu'),
  displayMenu: $('display-menu')
};

/* ── Utilities and helpers ── */


// ── Hoisted helpers needed during this file's top-level eval ──
function uid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function mobileLayoutActive() {
  const vvWidth = window.visualViewport?.width || Infinity;
  const coarseMobile = window.matchMedia?.('(pointer: coarse) and (max-width: 1100px)').matches;
  return window.matchMedia?.('(max-width: 760px)').matches || window.innerWidth <= 760 || vvWidth <= 760 || coarseMobile;
}

