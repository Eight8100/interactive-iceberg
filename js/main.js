/* Interactive Iceberg — loader reveal & bootstrap (entry point).
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

function ensureIcebergBgDecoded(capMs = 900) {
  if (ensureIcebergBgDecoded.done) return Promise.resolve();
  const img = new Image();
  img.src = 'images/iceberg-bg.webp';
  const decode = (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
  const cap = new Promise(resolve => window.setTimeout(resolve, capMs));
  return Promise.race([decode, cap]).then(() => { ensureIcebergBgDecoded.done = true; });
}

function revealIcebergFromBlueprint(options = {}) {
  const delay = Math.max(0, Number(options.delay) || 0);
  ensureIcebergBgDecoded().then(() => window.setTimeout(() => {
    document.body.classList.remove('app-waiting-for-save');
    document.body.classList.remove('app-iceberg-revealing');
    // Restart the placement animation when a ZIP/autosave is loaded after boot.
    void document.body.offsetWidth;
    document.body.classList.add('app-iceberg-revealing');
    window.setTimeout(() => {
      document.body.classList.remove('app-iceberg-revealing');
    }, 980);
  }, delay));
}

function appWaitingForSaveChoice() {
  return document.body.classList.contains('app-waiting-for-save');
}

function finishAppLoader() {
  const loader = document.getElementById('app-loader');
  if (!loader) return;
  const minimumVisibleMs = 1550;
  const startedAt = Number(window.__interactiveIcebergLoaderStartedAt || 0);
  const elapsed = startedAt ? performance.now() - startedAt : 0;
  const wait = Math.max(0, minimumVisibleMs - elapsed);
  window.setTimeout(() => {
    loader.classList.add('is-done');
    window.setTimeout(() => {
      const autosaveModal = $('autosave-modal');
      const shouldRevealAutosave = !!(autosaveModal && !autosaveModal.hidden);
      if (shouldRevealAutosave) {
        document.body.classList.add('app-waiting-for-save');
        autosaveModal.classList.add('boot-delayed');
      }
      document.body.classList.add('app-revealing');
      document.body.classList.remove('app-booting');
      if (shouldRevealAutosave) {
        window.setTimeout(() => {
          autosaveModal.classList.remove('boot-delayed', 'is-opening', 'is-closing');
          void autosaveModal.offsetWidth;
          autosaveModal.classList.add('is-opening');
        }, 300);
      } else {
        revealIcebergFromBlueprint({ delay: 120 });
      }
      window.setTimeout(() => {
        document.body.classList.add('app-loaded');
        document.body.classList.remove('app-revealing');
        loader.remove();
      }, 720);
    }, 340);
  }, wait);
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
initCreatorLogoWaterMotion();
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
initBlueprintScrollSync();
initMobileLayout();
render();
renderDetailPanel();
updateMobileIcebergScale();
scheduleSearchLinesUpdate();
finishAppLoader();
