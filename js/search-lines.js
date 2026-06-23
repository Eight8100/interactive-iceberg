/* Interactive Iceberg — iceberg search + pick/connector line drawing.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

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
    els.icebergSearchCount.classList.remove('has-results', 'no-results');
    return;
  }
  const count = state.items.filter(itemMatchesIcebergSearch).length;
  if (count === 0) {
    els.icebergSearchCount.textContent = `No matches for “${query}”`;
  } else {
    els.icebergSearchCount.textContent = count === 1 ? '1 iceberg match' : `${count} iceberg matches`;
  }
  els.icebergSearchCount.classList.toggle('has-results', count > 0);
  els.icebergSearchCount.classList.toggle('no-results', count === 0);
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
  els.icebergSearch?.closest('.search-input-wrap')?.classList.remove('search-active');
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


/* ── Chart banner image ── */
