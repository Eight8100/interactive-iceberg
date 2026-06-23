/* Interactive Iceberg — event wiring (init* functions).
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

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
      <p class="console-confirm-warn">⚠ This will delete your autosave cache. Make sure you have a ZIP backup downloaded first.</p>
      <div class="console-confirm-row">
        <button class="btn primary console-confirm-download" type="button">Download ZIP</button>
        <button class="btn danger console-confirm-clear" type="button">Clear cache</button>
      </div>
    `;
    e.target.insertAdjacentElement('afterend', confirm);
    confirm.querySelector('.console-confirm-download').addEventListener('click', ev => { ev.stopPropagation(); saveZipState(); });
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
          copy: 'Browser autosave was removed. Manual ZIP backups are unchanged.',
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
    adjustChartTitleLayout();
  });
  window.addEventListener('resize', adjustChartTitleLayout);
  if (document.fonts?.ready) document.fonts.ready.then(adjustChartTitleLayout).catch(() => {});
  $('save-zip-btn')?.addEventListener('click', () => { closeAppMenu(); saveZipState(); });
  $('load-zip-btn')?.addEventListener('click', () => {
    closeAppMenu();
    els.file.click();
  });
  $('export-btn').addEventListener('click', () => { closeAppMenu(); exportImage(); });
  els.file.addEventListener('change', loadState);
  els.bannerImageFile?.addEventListener('change', e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) setChartBannerImage(file);
  });
  els.chartBannerMenuToggle?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    if (!chartBannerEditingAllowed()) return;
    if (!chartBannerMenuOpenState) closeFloatingPopups('banner');
    setChartBannerMenuOpen(!chartBannerMenuOpenState);
  });
  els.chartBannerAdd?.addEventListener('click', e => { e.stopPropagation(); openChartBannerPicker(); });
  els.chartBannerReplace?.addEventListener('click', e => { e.stopPropagation(); openChartBannerPicker(); });
  els.chartBannerRemove?.addEventListener('click', e => { e.stopPropagation(); removeChartBannerImage(); });
  document.addEventListener('click', e => {
    if (!e.target.closest?.('.chart-banner-menu-controls')) closeChartBannerMenu();
  });

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
    scheduleAutosave();
  });
  els.entryFont.addEventListener('change', e => {
    state.entryFontFamily = e.target.value;
    applyEntryFont();
    scheduleAutosave();
  });
  $('bg-blur')?.addEventListener('input', e => {
    state.bgBlur = Number(e.target.value);
    applyBgBlur();
    scheduleAutosave();
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
    const hadRandomHighlight = document.body.classList.contains('has-random-highlight');
    const randomHighlightId = hadRandomHighlight ? currentItemId : null;
    renderTiers();
    renderPool();
    if (currentItemId) renderDetailPanel();
    if (hadRandomHighlight && randomHighlightId) {
      const chip = document.querySelector(itemChipSelector(randomHighlightId, true));
      if (chip) {
        chip.classList.add('random-highlight');
        document.body.classList.add('has-random-highlight');
      }
    }
    triggerIcebergLockPulse(state.icebergLocked === true);
    scheduleAutosave();
  });
}

function initIcebergSearch() {
  if (els.icebergSearch) {
    els.icebergSearch.addEventListener('input', e => {
      icebergSearchTerm = e.target.value;
      els.icebergSearch.closest('.search-input-wrap')?.classList.toggle('search-active', !!e.target.value.trim());
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

function initCreatorLogoWaterMotion() {
  const sidebar = els.leftSidebar;
  const brand = sidebar?.querySelector('.sidebar-brand');
  const logo = brand?.querySelector('.sidebar-brand-img');
  if (!sidebar || !brand || !logo) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  let raf = 0;
  let pointer = null;
  const clear = () => {
    pointer = null;
    brand.style.setProperty('--creator-logo-drift-x', '0px');
    brand.style.setProperty('--creator-logo-drift-y', '0px');
    brand.style.setProperty('--creator-logo-drift-scale', '1');
  };
  const update = () => {
    raf = 0;
    if (!pointer || !document.body.contains(logo) || sidebar.classList.contains('collapsed')) {
      clear();
      return;
    }

    const rect = logo.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = pointer.x - cx;
    const dy = pointer.y - cy;
    const centerDist = Math.hypot(dx, dy);
    const nearestX = clamp(pointer.x, rect.left, rect.right);
    const nearestY = clamp(pointer.y, rect.top, rect.bottom);
    const edgeDist = Math.hypot(pointer.x - nearestX, pointer.y - nearestY);
    const softStrength = Math.exp(-Math.pow(edgeDist / 54, 2));
    const isInside = pointer.x >= rect.left && pointer.x <= rect.right && pointer.y >= rect.top && pointer.y <= rect.bottom;
    const insideDirectionFactor = isInside
      ? clamp(centerDist / Math.max(18, Math.min(rect.width, rect.height) * .7), 0, 1)
      : 1;
    const strength = softStrength * insideDirectionFactor;
    if (strength < .008 || centerDist < .75) {
      brand.style.setProperty('--creator-logo-drift-x', '0px');
      brand.style.setProperty('--creator-logo-drift-y', '0px');
      brand.style.setProperty('--creator-logo-drift-scale', '1');
      return;
    }

    const pull = strength * 4.2;
    brand.style.setProperty('--creator-logo-drift-x', `${(dx / centerDist * pull).toFixed(2)}px`);
    brand.style.setProperty('--creator-logo-drift-y', `${(dy / centerDist * pull).toFixed(2)}px`);
    brand.style.setProperty('--creator-logo-drift-scale', (1 + .006 * strength).toFixed(4));
  };
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  sidebar.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    schedule();
  }, { passive: true });
  sidebar.addEventListener('pointerleave', clear);
  sidebar.addEventListener('pointercancel', clear);
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
      const opening = activeTierImageMenuId !== tierId;
      if (opening) closeFloatingPopups('tier');
      setTierImageMoveMode(null);
      setTierImageMenuOpen(opening ? tierId : null);
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

    const chip = e.target.closest('.item-chip, .favourite-chip');
    if (!chip || e.target.closest('.chip-delete-btn') || entryPickMode) return;
    const previous = e.relatedTarget;
    if (previous && chip.contains(previous)) return;
    showHoverPreview(chip.dataset.itemId, e);
  });

  document.addEventListener('mousemove', e => {
    updateEntryPickLineFromPointer(e);
    if (hoveredInternalLinkEl && !entryPickMode && !mobileLayoutActive()) scheduleSearchLinesUpdate();
    if (e.target.closest('.item-chip, .favourite-chip') && !entryPickMode) moveHoverPreview(e);
    setDescriptionToolErrorPointFromEvent(e);
    if (els.entryLinkHint?.classList.contains('is-error')) positionDescriptionToolError(e.clientX, e.clientY);
  });

  document.addEventListener('mouseout', e => {
    const internalEntryLink = e.target.closest('.internal-entry-link');
    if (internalEntryLink) {
      const next = e.relatedTarget;
      if (!next || !internalEntryLink.contains(next)) clearInternalEntryLinkLine();
    }

    const chip = e.target.closest('.item-chip, .favourite-chip');
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
  els.detailFavourite?.addEventListener('click', toggleCurrentFavourite);
  els.favouritesPool?.addEventListener('click', e => {
    const row = e.target.closest('.favourite-chip');
    if (!row?.dataset.itemId) return;
    e.preventDefault();
    e.stopPropagation();
    openPlacedEntryShortcut(row.dataset.itemId);
  });
  els.favouritesPool?.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.favourite-chip');
    if (!row?.dataset.itemId) return;
    e.preventDefault();
    e.stopPropagation();
    openPlacedEntryShortcut(row.dataset.itemId);
  });
  els.favouritesPool?.addEventListener('scroll', updateFavouritesScrollHints, { passive: true });
  els.pool?.addEventListener('scroll', updateUnplacedScrollHints, { passive: true });
  window.addEventListener('resize', () => {
    requestAnimationFrame(updateFavouritesScrollHints);
    requestAnimationFrame(updateUnplacedScrollHints);
  });
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
    if (e.target && (e.target.closest?.('textarea, [contenteditable="true"]'))) return;
    e.preventDefault();
    showAdjacentImagePreview(e.key === 'ArrowLeft' ? -1 : 1);
  });

  els.imageModal?.addEventListener('click', e => {
    if (e.target === els.imageModal) closeImagePreview();
  });
}

function initAboutAndRandom() {
  // The info button is now a plain link to the GitHub README; no JS needed.
  $('search-random-btn')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const placed = state.items.filter(i => i.tierId);
    if (!placed.length) return;
    const searchWasOpen = mobileLayoutActive() && mobileSearchSheetOpen;
    const pick = placed[Math.floor(Math.random() * placed.length)];
    clearIcebergSearch();
    linkedEntryBackStack = [];
    if (!openPlacedEntryShortcut(pick.id)) return;
    if (!searchWasOpen) closeMobileSearchSheet();
    if (mobileLayoutActive()) setMobilePanel('details', { keepSearchOpen: searchWasOpen });
    if (searchWasOpen) updateMobileSearchSheetMetrics();
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
      if (openHeaderMenuEl === menu) {
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

// Logical open-state for the mobile bottom sheets. The DOM (hidden attr,
// classes) is write-only presentation; conditionals must read these vars.
// (A lingering class read during a close fade caused a real bug before.)
let mobileSearchSheetOpen = false;
let mobileFavouritesSheetOpen = false;

