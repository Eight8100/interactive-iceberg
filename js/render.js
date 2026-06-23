/* Interactive Iceberg — render(), tiers, pool, chips, tier images, drag.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

function chartBannerEditingAllowed() {
  return !icebergEditingLocked();
}

let chartBannerMenuOpenState = false;

function setChartBannerMenuOpen(open = false) {
  const titleRow = document.querySelector('.sidebar-chart-title-row');
  const menu = els.chartBannerMenu;
  const isOpen = !!open && chartBannerEditingAllowed();
  els.chartBannerMenuToggle?.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  if (!titleRow) return;
  const wasOpen = chartBannerMenuOpenState;
  chartBannerMenuOpenState = isOpen;
  if (isOpen === wasOpen) {
    // Reopened while the close fade was still pending — cancel it.
    if (isOpen && menu?.classList.contains('is-closing')) {
      clearElementFadeTimer(menu);
      menu.classList.remove('is-closing');
    }
    return;
  }
  if (isOpen) {
    if (menu) {
      clearElementFadeTimer(menu);
      menu.classList.remove('is-closing');
    }
    titleRow.classList.add('chart-banner-menu-open');
  } else if (menu) {
    playClosingAnimation(menu, () => titleRow.classList.remove('chart-banner-menu-open'));
  } else {
    titleRow.classList.remove('chart-banner-menu-open');
  }
}

function closeChartBannerMenu() {
  setChartBannerMenuOpen(false);
}

function syncChartBannerUi() {
  const hasBanner = !!safeUrl(state.bannerImage || '');
  const editingAllowed = chartBannerEditingAllowed();
  const titleRow = document.querySelector('.sidebar-chart-title-row');
  titleRow?.classList.toggle('has-chart-banner', hasBanner);
  if (els.chartBannerWrap) els.chartBannerWrap.hidden = !hasBanner;
  if (els.chartBannerImg) {
    if (hasBanner) els.chartBannerImg.src = state.bannerImage;
    else els.chartBannerImg.removeAttribute('src');
  }
  if (els.chartBannerMenuToggle) els.chartBannerMenuToggle.disabled = !editingAllowed;
  if (els.chartBannerAdd) {
    els.chartBannerAdd.hidden = hasBanner || !editingAllowed;
    els.chartBannerAdd.disabled = !editingAllowed;
  }
  if (els.chartBannerReplace) {
    els.chartBannerReplace.hidden = !hasBanner || !editingAllowed;
    els.chartBannerReplace.disabled = !editingAllowed;
  }
  if (els.chartBannerRemove) {
    els.chartBannerRemove.hidden = !hasBanner || !editingAllowed;
    els.chartBannerRemove.disabled = !editingAllowed;
  }
  if (!editingAllowed) closeChartBannerMenu();
  adjustChartTitleLayout();
}

function measureChartTitleWidth(text, fontSize, fontFamily, fontWeight) {
  const canvas = measureChartTitleWidth.canvas || (measureChartTitleWidth.canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = `${fontWeight || 400} ${fontSize}px ${fontFamily || "'Casino Flat', 'Trebuchet MS', Arial, sans-serif"}`;
  return ctx.measureText(String(text || '')).width;
}

function adjustChartTitleLayout() {
  if (!els.title) return;
  const computed = getComputedStyle(els.title);
  const width = els.title.clientWidth
    - (parseFloat(computed.paddingLeft) || 0)
    - (parseFloat(computed.paddingRight) || 0);
  const availableWidth = Math.max(60, width);
  const family = computed.fontFamily || "'Trebuchet MS', Arial, sans-serif";
  const weight = computed.fontWeight || '900';
  const maxSize = 31;
  const minSize = 16;
  const lines = String(els.title.value || state.title || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const longestWidth = Math.max(0, ...lines.map(line => measureChartTitleWidth(line, maxSize, family, weight)));
  const fittedSize = longestWidth > availableWidth
    ? clamp(Math.floor(maxSize * (availableWidth / longestWidth)), minSize, maxSize)
    : maxSize;
  els.title.style.setProperty('--chart-title-size', `${fittedSize}px`);
  els.title.style.height = 'auto';
  els.title.style.height = `${els.title.scrollHeight}px`;
}

function openChartBannerPicker() {
  if (!chartBannerEditingAllowed()) return;
  closeChartBannerMenu();
  els.bannerImageFile?.click();
}

async function setChartBannerImage(file) {
  if (!file || !chartBannerEditingAllowed()) return;
  try {
    state.bannerImage = await imageFileToDataUrl(file);
    syncChartBannerUi();
    scheduleAutosave();
  } catch (err) {
    setSidebarStatus(`Could not add banner image — ${err.message || 'unknown error'}`, true);
  }
}

function removeChartBannerImage() {
  if (!chartBannerEditingAllowed()) return;
  closeChartBannerMenu();
  state.bannerImage = '';
  syncChartBannerUi();
  scheduleAutosave();
}

/* ── Render loop ── */
function render() {
  normalizeState();
  els.title.value = state.title;
  syncChartBannerUi();
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
    const wasOpen = cell.classList.contains('tier-image-menu-open');
    const toggle = cell.querySelector('.tier-image-menu-toggle');
    if (toggle) toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    const menu = cell.querySelector('.tier-image-menu');
    if (isOpen === wasOpen) {
      // Reopened while the close fade was still pending — cancel it.
      if (isOpen && menu?.classList.contains('is-closing')) {
        clearElementFadeTimer(menu);
        menu.classList.remove('is-closing');
      }
      return;
    }
    if (isOpen) {
      if (menu) {
        clearElementFadeTimer(menu);
        menu.classList.remove('is-closing');
      }
      cell.classList.add('tier-image-menu-open');
    } else if (menu) {
      playClosingAnimation(menu, () => cell.classList.remove('tier-image-menu-open'));
    } else {
      cell.classList.remove('tier-image-menu-open');
    }
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
      tone: 'error'
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
    menuToggle.innerHTML = '<svg class="btn-glyph btn-glyph-dots" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="19" r="1.7" fill="currentColor"/></svg>';
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

    const title = document.createElement('div');
    title.className = 'unplaced-empty-title';
    title.textContent = 'No unplaced items.';
    empty.appendChild(title);

    const copy = document.createElement('div');
    copy.className = 'unplaced-empty-copy';
    if (icebergEditingLocked()) {
      copy.textContent = 'Unlock editing to add entries.';
    } else if (state.items.length) {
      copy.textContent = 'Everything has been placed on the iceberg.';
    } else {
      copy.textContent = 'Add a new entry above, or load a ZIP backup.';
    }
    empty.appendChild(copy);
    fragment.appendChild(empty);
  } else {
    unplaced.forEach(item => fragment.appendChild(makeChip(item)));
  }
  els.pool.appendChild(fragment);
  requestAnimationFrame(updateUnplacedScrollHints);
  renderFavourites();
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
  state.items.push({ id: uid(), name, description: '', images: [], needsVerification: false, favourite: false, tierId: null });
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

  // Where did the pointer come up? Three outcomes:
  //   • over the iceberg canvas  → move the chip(s) there
  //   • over the entry tray      → send the chip(s) back to Unplaced
  //   • anywhere else            → snap back to where they started
  const wrapperRect = els.wrapper?.getBoundingClientRect?.();
  const releasedOverCanvas = !!wrapperRect && clientX != null && clientY != null
    && clientX >= wrapperRect.left && clientX <= wrapperRect.right
    && clientY >= wrapperRect.top && clientY <= wrapperRect.bottom;
  const dropTarget = (clientX != null && clientY != null) ? document.elementFromPoint(clientX, clientY) : null;
  const releasedOverPool = !releasedOverCanvas && !!dropTarget?.closest?.('.unplaced-pool');

  if (commit && movedEnough && releasedOverCanvas) {
    drag.entries.forEach(entry => {
      const item = getItemById(entry.id);
      if (item) applyItemCanvasPosition(item, entry.start.x + drag.dx, entry.start.y + drag.dy, entry.width, entry.height);
    });
    selectionMoved = true;
    selectedItemIds.clear();
    render();
  } else if (commit && movedEnough && releasedOverPool) {
    drag.entries.forEach(entry => {
      const item = getItemById(entry.id);
      if (item) removeItemToPool(item);
    });
    selectionMoved = true;
    selectedItemIds.clear();
    render();
  } else {
    // Removing the drag offsets above already returns each chip to its stored
    // position; suppress the click that would otherwise follow a real drag.
    if (commit && movedEnough) selectionMoved = true;
    renderSelection();
  }
}

// A fluid-dragging chip is position:fixed. When the desktop canvas is scaled,
// .iceberg-wrapper carries a CSS transform, which makes that fixed chip resolve
// against the wrapper's scaled box rather than the viewport — so raw screen
// coords drift (worse toward the right). Convert the screen point into the
// wrapper's local space here so the chip tracks the cursor. transform-origin is
// top-center, but the x-origin term cancels, leaving a simple divide-by-scale.
// Returns viewport coords unchanged when nothing is scaled.
// A fluid-dragging chip is position:fixed inside .iceberg-wrapper. When the
// canvas is scaled, the wrapper carries a CSS transform, so the relationship
// between the chip's CSS left/top (--drag-left/--drag-top) and where it actually
// lands on screen is warped by scale, transform-origin and page scroll in ways
// that are fiddly to derive. Instead of predicting it, we MEASURE it once at
// drag start: sample the chip at two known left/top values, read where it really
// renders, and store the linear inverse. Exact regardless of the transform.
function calibrateDragMapping(chip) {
  const prevLeft = chip.style.getPropertyValue('--drag-left');
  const prevTop = chip.style.getPropertyValue('--drag-top');
  const cx = () => { const r = chip.getBoundingClientRect(); return r.left + r.width / 2; };
  const cy = () => { const r = chip.getBoundingClientRect(); return r.top + r.height / 2; };
  chip.style.setProperty('--drag-left', '0px');
  chip.style.setProperty('--drag-top', '0px');
  const x0 = cx(), y0 = cy();
  chip.style.setProperty('--drag-left', '200px');
  chip.style.setProperty('--drag-top', '200px');
  const x1 = cx(), y1 = cy();
  if (prevLeft) chip.style.setProperty('--drag-left', prevLeft); else chip.style.removeProperty('--drag-left');
  if (prevTop) chip.style.setProperty('--drag-top', prevTop); else chip.style.removeProperty('--drag-top');
  const slopeX = (x1 - x0) / 200 || 1;
  const slopeY = (y1 - y0) / 200 || 1;
  return { x0, y0, slopeX, slopeY };
}

// Convert a target screen point into the --drag-left/--drag-top values that put
// the chip's centre there, using the mapping measured for this drag.
function dragChipPoint(screenX, screenY) {
  const m = fluidDrag && fluidDrag.map;
  if (!m) return { left: screenX, top: screenY };
  return { left: (screenX - m.x0) / m.slopeX, top: (screenY - m.y0) / m.slopeY };
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
    const pt = dragChipPoint(entry.startClientCenterX + fluidDrag.renderedDx, entry.startClientCenterY + fluidDrag.renderedDy);
    entry.chip.style.setProperty('--drag-left', `${pt.left.toFixed(2)}px`);
    entry.chip.style.setProperty('--drag-top', `${pt.top.toFixed(2)}px`);
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
      // offsetWidth is the UNSCALED layout width; getBoundingClientRect().width
      // is shrunk by the canvas scale, which would lock the text too narrow and
      // wrap a long single line. Use the unscaled width plus a 2px safety margin.
      textWidth: Math.ceil(textEl?.offsetWidth || textRect?.width || dragChip.offsetWidth || rect.width || 120) + 2,
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
    entry.chip.style.setProperty('--drag-width', `${Math.ceil(entry.width)}px`);
    entry.chip.style.setProperty('--drag-text-width', `${Math.ceil(entry.textWidth)}px`);
    entry.chip.style.setProperty('--drag-scale', '1.04');
    entry.chip.classList.add('fluid-dragging');
  });

  // Now that the chips are position:fixed, measure the coordinate mapping, then
  // place each chip under its starting point.
  fluidDrag.map = calibrateDragMapping(entries[0].chip);
  entries.forEach(entry => {
    const startPt = dragChipPoint(entry.startClientCenterX, entry.startClientCenterY);
    entry.chip.style.setProperty('--drag-left', `${startPt.left.toFixed(2)}px`);
    entry.chip.style.setProperty('--drag-top', `${startPt.top.toFixed(2)}px`);
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
    fontFamily: textStyles.fontFamily || chipStyles.fontFamily,
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
  const showTierImageBadge = !!tier?.labelImage && mobileLayoutActive();
  els.detailTier.classList.toggle('has-tier-image', showTierImageBadge);

  if (tier) {
    if (showTierImageBadge) {
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
    syncFavouriteToggle(null);
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

  if (els.detailImages) els.detailImages.innerHTML = '';
  els.imageManager?.classList.remove('has-entry-images');
  els.imageDropZone?.classList.remove('has-images');
  const ytEl = $('youtube-embeds');
  if (ytEl) { ytEl.hidden = true; ytEl.innerHTML = ''; }

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
  syncFavouriteToggle(item);
  const editingLocked = icebergEditingLocked();
  if (els.detailEditRow) els.detailEditRow.hidden = editingLocked;
  if (els.detailEditBtn) els.detailEditBtn.hidden = editingLocked;
  if (els.detailDoneBtn) els.detailDoneBtn.hidden = true;
  clearDeleteConfirm();
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
  updateDesktopIcebergScale();
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
  renderFavourites();
  renderDetailPanel();
  clearRandomHighlight();
}

function hideDetailSidebar(clearCurrent = false) {
  els.detailSidebar?.classList.add('collapsed');
  updateDesktopIcebergScale();
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
  updateDesktopIcebergScale();
  if (els.leftCollapse) {
    els.leftCollapse.textContent = '‹';
    els.leftCollapse.setAttribute('aria-expanded', 'true');
    els.leftCollapse.title = 'Hide entry tray';
  }
}

function hideLeftSidebar() {
  els.leftSidebar?.classList.add('collapsed');
  updateDesktopIcebergScale();
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
  renderFavourites();
  showDetailSidebar();
  if (mobileLayoutActive()) {
    const keepSearchOpen = mobileSearchSheetOpen;
    setMobilePanel('details', { keepSearchOpen });
  }
  return true;
}
