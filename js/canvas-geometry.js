/* Interactive Iceberg — canvas position math, selection prims, normalize.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

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
  state.version = Number(state.version) || STATE_VERSION;
  const oldTiers = Array.isArray(state.tiers) ? state.tiers : [];
  state.title = typeof state.title === 'string' ? state.title : 'My Iceberg';
  state.entryFontSize = clamp(Number(state.entryFontSize) || 14, 10, 24);
  state.bgBlur = clamp(Number(state.bgBlur) || 0, 0, 2);
  state.showTierTitles = state.showTierTitles !== false;
  state.showPips = state.showPips !== false;
  state.entryDrift = state.entryDrift !== false;
  state.bannerImage = safeUrl(state.bannerImage || state.chartBannerImage || '');
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
    item.favourite = item.favourite === true || item.favourite === 'true';
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

