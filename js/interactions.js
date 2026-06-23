/* Interactive Iceberg — hover preview, selection box & header menus.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

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

// Logical "which header menu is open" — menu.open lingers during the close
// fade, so conditionals must not read it (same pattern as the sheet states).
let openHeaderMenuEl = null;

// Close every floating popup family except the named one. Every popup
// opener funnels through this so popups are always mutually exclusive.
function closeFloatingPopups(except = '') {
  if (except !== 'header') closeAppMenu();
  if (except !== 'console') closeConsolePopup();
  if (except !== 'tier') closeTierImageMenu();
  if (except !== 'banner') closeChartBannerMenu();
}

function closeAppMenu() {
  openHeaderMenuEl = null;
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
  closeAppMenu(); // sibling header menu — the family 'except' below skips these
  closeFloatingPopups('header');
  openHeaderMenuEl = menu;
  const panel = menu.querySelector('.app-menu-panel');
  menu.open = true;
  setHeaderMenuExpanded(menu, true);
  restartOpeningAnimation(panel);
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

