/* Interactive Iceberg — mobile layout, bottom sheets & scaling.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

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
    closeMobileFavouritesSheet();
    if (options.keepSearchOpen && detailsOpen) updateMobileSearchSheetMetrics();
    else closeMobileSearchSheet();
  }
}


function updateMobileSearchSheetMetrics() {
  const sheet = $('mobile-search-sheet');
  // Mobile vars live as inline styles on <body>: stylesheet defaults are
  // declared on body.mobile-layout-active, and inline beats stylesheet on
  // the same element (declared on <html> they would be shadowed by body).
  const root = document.body;
  const isOpen = mobileSearchSheetOpen && !!sheet && mobileLayoutActive();
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
  closeMobileFavouritesSheet();
  setMobilePanel('none');
  const sheet = $('mobile-search-sheet');
  const toggle = $('mobile-search-toggle');
  if (!sheet) return;
  mobileSearchSheetOpen = true;
  sheet.hidden = false;
  updateMobileSearchSheetMetrics();
  toggle?.classList.add('active');
  toggle?.setAttribute('aria-expanded', 'true');
  window.setTimeout(() => els.icebergSearch?.focus({ preventScroll: true }), 0);
}

function closeMobileSearchSheet() {
  mobileSearchSheetOpen = false;
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
  if (mobileSearchSheetOpen) closeMobileSearchSheet();
  else openMobileSearchSheet();
}

/* ── Mobile favourites sheet ── */
const mobileFavouritesPlacement = {
  initialized: false,
  panel: null,
  placeholder: null,
};

function syncMobileFavouritesPlacement() {
  const sheetContent = $('mobile-favourites-sheet-content');
  if (!sheetContent) return;

  if (!mobileFavouritesPlacement.initialized) {
    mobileFavouritesPlacement.panel = document.querySelector('.sidebar-favourites-panel');
    mobileFavouritesPlacement.placeholder = document.createComment('mobile favourites placeholder');
    mobileFavouritesPlacement.panel?.parentNode?.insertBefore(mobileFavouritesPlacement.placeholder, mobileFavouritesPlacement.panel);
    mobileFavouritesPlacement.initialized = true;
  }

  const { panel, placeholder } = mobileFavouritesPlacement;
  if (!panel || !placeholder?.parentNode) return;

  if (mobileLayoutActive()) {
    if (panel.parentNode !== sheetContent) sheetContent.appendChild(panel);
  } else {
    if (panel.parentNode !== placeholder.parentNode) placeholder.parentNode.insertBefore(panel, placeholder.nextSibling);
    closeMobileFavouritesSheet();
  }
}

function openMobileFavouritesSheet() {
  if (!mobileLayoutActive()) return;
  syncMobileFavouritesPlacement();
  closeMobileSearchSheet();
  setMobilePanel('none');
  const sheet = $('mobile-favourites-sheet');
  const toggle = $('mobile-favourites-toggle');
  if (!sheet) return;
  mobileFavouritesSheetOpen = true;
  sheet.hidden = false;
  toggle?.classList.add('active');
  toggle?.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(updateFavouritesScrollHints);
}

function closeMobileFavouritesSheet() {
  mobileFavouritesSheetOpen = false;
  const sheet = $('mobile-favourites-sheet');
  const toggle = $('mobile-favourites-toggle');
  if (sheet) sheet.hidden = true;
  toggle?.classList.remove('active');
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.blur?.();
}

function toggleMobileFavouritesSheet() {
  if (mobileFavouritesSheetOpen) closeMobileFavouritesSheet();
  else openMobileFavouritesSheet();
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
  const root = document.body; // see updateMobileSearchSheetMetrics note
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
    updateDesktopIcebergScale();
    return;
  }
  document.body.classList.remove('desktop-iceberg-scaled');
  root.style.removeProperty('--desktop-iceberg-scale');
  root.style.removeProperty('--desktop-canvas-display-h');

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
  const rootStyles = getComputedStyle(document.body);
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

// Desktop squeeze: when both sidebars are open on a narrow window, the
// fixed-width canvas (incl. the tier label rail) no longer fits the
// iceberg area and gets clipped — scale the whole wrapper to fit instead.
// Drag/drop placement is rect-based so percentages stay correct under the
// transform; only the drag ghost renders unscaled (cosmetic).
function updateDesktopIcebergScale() {
  // Desktop-only: on mobile this would add the desktop-iceberg-scaled class,
  // whose margin-left rule shoves the canvas far left. (updateMobileIcebergScale
  // owns mobile scaling and clears the desktop class.)
  if (mobileLayoutActive()) return;
  const root = document.body;
  const area = els.wrapper?.closest('.iceberg-area');
  if (!area) return;
  const styles = getComputedStyle(area);
  const padX = (parseFloat(styles.paddingLeft) || 0) + (parseFloat(styles.paddingRight) || 0);
  const available = Math.max(320, area.clientWidth - padX);
  const rootStyles = getComputedStyle(document.body);
  const canvasW = parseFloat(rootStyles.getPropertyValue('--canvas-w')) || 980;
  const canvasH = parseFloat(rootStyles.getPropertyValue('--canvas-h')) || 1752;
  const scale = Math.min(1, available / canvasW);
  if (scale < 0.999) {
    root.style.setProperty('--desktop-iceberg-scale', scale.toFixed(5));
    root.style.setProperty('--desktop-canvas-display-h', `${Math.ceil(canvasH * scale)}px`);
    root.classList.add('desktop-iceberg-scaled');
  } else {
    root.classList.remove('desktop-iceberg-scaled');
    root.style.removeProperty('--desktop-iceberg-scale');
    root.style.removeProperty('--desktop-canvas-display-h');
  }
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


function initBlueprintScrollSync() {
  // Static blueprint background: intentionally no scroll syncing.
}

function initMobileLayout() {
  const entriesBtn = $('mobile-nav-entries');
  const detailsBtn = $('mobile-nav-details');
  const entriesClose = $('mobile-entries-close');
  const detailsClose = $('mobile-details-close');
  const searchToggle = $('mobile-search-toggle');
  const searchClose = $('mobile-search-close');
  const favouritesToggle = $('mobile-favourites-toggle');
  const favouritesClose = $('mobile-favourites-close');

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
  favouritesToggle?.addEventListener('click', toggleMobileFavouritesSheet);
  favouritesClose?.addEventListener('click', closeMobileFavouritesSheet);
  els.linkedEntryBack?.addEventListener('click', goBackFromLinkedEntry);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !mobileLayoutActive()) return;
    if (mobileFavouritesSheetOpen) {
      closeMobileFavouritesSheet();
      return;
    }
    if (mobileSearchSheetOpen) {
      closeMobileSearchSheet();
      return;
    }
    if (els.leftSidebar?.classList.contains('mobile-panel-open') || els.detailSidebar?.classList.contains('mobile-panel-open')) {
      setMobilePanel('none');
    }
  });

  window.addEventListener('resize', () => { updateMobileIcebergScale(); updateMobileSearchSheetMetrics(); syncMobileFavouritesPlacement(); });
  window.addEventListener('orientationchange', () => window.setTimeout(() => { updateMobileIcebergScale(); updateMobileSearchSheetMetrics(); syncMobileFavouritesPlacement(); }, 80));
  updateMobileIcebergScale();
  syncMobileFavouritesPlacement();
}




// Resolve once the canvas background is decoded (capped so a slow decode
// can't stall the reveal). Without this the place-in animation runs while
// the webp is still decoding, so the iceberg pops in partway through the
// rise instead of riding it smoothly.
