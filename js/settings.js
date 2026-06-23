/* Interactive Iceberg — display settings, iceberg lock & entry drift.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

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
  syncChartBannerUi();
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
      recolorLockLottie(state.icebergLocked === true);
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

