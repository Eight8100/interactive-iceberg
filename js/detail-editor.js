/* Interactive Iceberg — title/description editor, links, favourites.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

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

function syncFavouriteToggle(item) {
  const btn = els.detailFavourite;
  if (!btn) return;
  const on = !!(item && item.favourite);
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.classList.toggle('is-favourite', on);
  const label = on ? 'Remove from favourites' : 'Add to favourites';
  btn.setAttribute('aria-label', label);
  btn.title = label;
  btn.disabled = !item;
}

function toggleCurrentFavourite() {
  const item = getCurrentItem();
  if (!item) return;
  item.favourite = !item.favourite;
  syncFavouriteToggle(item);
  renderFavourites();
  scheduleAutosave();
}

function updateListScrollHints(pool) {
  if (!pool) return;
  const overflow = pool.scrollHeight - pool.clientHeight > 2;
  const atTop = pool.scrollTop <= 1;
  const atBottom = pool.scrollTop + pool.clientHeight >= pool.scrollHeight - 1;
  pool.classList.toggle('has-overflow', overflow);
  pool.classList.toggle('fade-top', overflow && !atTop);
  pool.classList.toggle('fade-bottom', overflow && !atBottom);
}

function updateFavouritesScrollHints() {
  updateListScrollHints(els.favouritesPool);
}

function updateUnplacedScrollHints() {
  updateListScrollHints(els.pool);
}

function flashPlacedEntry(itemId) {
  window.clearTimeout(randomHighlightTimer);
  randomHighlightTimer = window.setTimeout(() => {
    if (currentItemId !== itemId) return;
    const chip = document.querySelector(itemChipSelector(itemId, true));
    if (!chip) return;
    chip.scrollIntoView({ behavior: 'smooth', block: 'center' });
    chip.classList.add('random-highlight');
    document.body.classList.add('has-random-highlight');
    randomHighlightTimer = 0;
  }, 50);
}

function openPlacedEntryShortcut(itemId) {
  const item = getItemById(itemId);
  if (!item || !item.tierId) return false;
  selectedItemIds = new Set([item.id]);
  if (!openModal(item.id)) return false;
  selectedItemIds = new Set([item.id]);
  renderSelection();
  renderFavourites();
  flashPlacedEntry(item.id);
  return true;
}

function renderFavourites() {
  if (!els.favouritesPool) return;
  els.favouritesPool.innerHTML = '';
  // Favourites lists placed entries only — a quick-jump shortlist.
  const favourites = state.items
    .filter(item => item.favourite && item.tierId)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base', numeric: true }));
  if (!favourites.length) {
    const empty = document.createElement('div');
    empty.className = 'favourites-empty';
    empty.textContent = 'Star a placed entry to pin it here.';
    els.favouritesPool.appendChild(empty);
    requestAnimationFrame(updateFavouritesScrollHints);
    return;
  }
  const fragment = document.createDocumentFragment();
  favourites.forEach(item => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'favourite-chip';
    row.dataset.itemId = item.id;
    if (item.id === currentItemId) row.classList.add('is-current');
    const tier = getTierById(item.tierId);

    const star = document.createElement('span');
    star.className = 'favourite-chip-star';
    star.setAttribute('aria-hidden', 'true');
    star.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.97l-5.8 3.05 1.11-6.46-4.7-4.58 6.49-.94z"/></svg>';

    const name = document.createElement('span');
    name.className = 'favourite-chip-name';
    name.textContent = item.name;

    row.appendChild(star);
    row.appendChild(name);
    if (tier?.label) {
      const tierTag = document.createElement('span');
      tierTag.className = 'favourite-chip-tier';
      tierTag.textContent = tier.label;
      row.appendChild(tierTag);
    }
    row.setAttribute('aria-label', `${item.name}${tier?.label ? `, ${tier.label}` : ''}`);
    fragment.appendChild(row);
  });
  els.favouritesPool.appendChild(fragment);
  requestAnimationFrame(updateFavouritesScrollHints);
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
    return;
  }
  // Deleting an unplaced entry is destructive, so confirm first. window.confirm
  // is unreliable — it silently returns false (no prompt) in some in-app and
  // unfocused browser contexts, which made the button look broken — so use an
  // inline two-step confirm on the button itself instead.
  const btn = els.detailRemoveDelete;
  if (!btn) { deleteItem(item.id); currentItemId = null; clearRandomHighlight(); renderDetailPanel(); return; }
  if (btn.dataset.confirmId === item.id) {
    clearDeleteConfirm();
    deleteItem(item.id);
    currentItemId = null;
    clearRandomHighlight();
    renderDetailPanel();
    return;
  }
  // First click: arm confirmation.
  btn.dataset.confirmId = item.id;
  btn.dataset.confirmLabel = btn.textContent;
  btn.textContent = 'Click again to delete';
  btn.classList.add('is-confirming');
  clearTimeout(deleteConfirmTimer);
  deleteConfirmTimer = setTimeout(clearDeleteConfirm, 4000);
}

let deleteConfirmTimer = null;

function clearDeleteConfirm() {
  clearTimeout(deleteConfirmTimer);
  const btn = els.detailRemoveDelete;
  if (!btn || !btn.dataset.confirmId) return;
  if (btn.dataset.confirmLabel) btn.textContent = btn.dataset.confirmLabel;
  btn.classList.remove('is-confirming');
  delete btn.dataset.confirmId;
  delete btn.dataset.confirmLabel;
}

/* ── Autosave ── */
