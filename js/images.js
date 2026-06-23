/* Interactive Iceberg — image modal, image files & youtube embeds.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

function showImageError(message = '') {
  if (els.detailImageError) els.detailImageError.textContent = message;
}

function detailEditorIsOpen() {
  return !!(
    els.detailCard?.classList.contains('description-editing') ||
    (els.detailDoneBtn && !els.detailDoneBtn.hidden)
  );
}

function detailImageEditingAllowed() {
  return detailEditorIsOpen() && !icebergEditingLocked();
}

function imageModalControlsAllowed() {
  return !!(
    currentImagePreviewId &&
    !icebergEditingLocked() &&
    getCurrentItem()
  );
}

function imageModalEditingAllowed() {
  return imageModalControlsAllowed() && imageModalLocalEditMode === true;
}

function ensureImageModalEditMode(focusTarget = null) {
  if (!imageModalControlsAllowed()) return false;

  imageModalLocalEditMode = true;
  syncImageModalEditingState();

  if (focusTarget) {
    requestAnimationFrame(() => focusTarget.focus?.());
  }
  return true;
}

function finishImageModalEdit() {
  if (!currentImagePreviewId) return;
  saveOpenImageCaption({ force: true });
  imageModalLocalEditMode = false;
  syncImageModalEditingState();
}

function sanitizeImageCaptionHtml(value = '') {
  const template = document.createElement('template');
  template.innerHTML = String(value || '');
  const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'CODE', 'A', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI']);
  const walk = node => {
    [...node.childNodes].forEach(child => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        if (!allowedTags.has(child.tagName)) {
          child.replaceWith(...child.childNodes);
          return;
        }
        [...child.attributes].forEach(attr => {
          if (child.tagName === 'A' && attr.name === 'href' && safeUrl(attr.value)) return;
          child.removeAttribute(attr.name);
        });
        if (child.tagName === 'A') {
          child.setAttribute('target', '_blank');
          child.setAttribute('rel', 'noopener noreferrer');
        }
        walk(child);
      }
    });
  };
  walk(template.content);
  return template.innerHTML.trim();
}

function setImageCaptionEditor(value = '') {
  if (!els.imageModalCaption) return;
  const clean = sanitizeImageCaptionHtml(value);
  els.imageModalCaption.innerHTML = clean;
}

function getImageCaptionEditorHtml() {
  if (!els.imageModalCaption) return '';
  return sanitizeImageCaptionHtml(els.imageModalCaption.innerHTML || '');
}

function syncImageModalEditingState() {
  if (!els.imageModalCaption) return;
  if (icebergEditingLocked()) imageModalLocalEditMode = false;
  const controlsAllowed = imageModalControlsAllowed();
  const canEdit = imageModalEditingAllowed();
  els.imageModal?.classList.toggle('image-modal-controls-available', controlsAllowed);
  els.imageModal?.classList.toggle('image-modal-can-edit', canEdit);
  if (els.imageModalTitle) {
    els.imageModalTitle.readOnly = !canEdit;
    els.imageModalTitle.setAttribute('aria-readonly', String(!canEdit));
  }
  els.imageModalCaption.contentEditable = canEdit ? 'true' : 'false';
  els.imageModalCaption.setAttribute('aria-readonly', String(!canEdit));
  els.imageModalCaption.dataset.placeholder = canEdit ? 'Add a description...' : 'No description yet.';
  els.imageModalCaption.classList.toggle('readonly', !canEdit);
  if (els.imageModalTools) els.imageModalTools.hidden = !canEdit;
  els.imageModalTools?.querySelectorAll('button').forEach(button => { button.disabled = !canEdit; });
  if (els.imageModalEditRow) els.imageModalEditRow.hidden = !controlsAllowed;
  if (els.imageModalEditBtn) els.imageModalEditBtn.hidden = !controlsAllowed || canEdit;
  if (els.imageModalDoneBtn) els.imageModalDoneBtn.hidden = !controlsAllowed || !canEdit;
}

function removeCurrentImage(imageId, options = {}) {
  const allowFromModal = options?.fromModal === true;
  if (allowFromModal ? !imageModalEditingAllowed() : !detailImageEditingAllowed()) return;
  const item = getCurrentItem();
  if (!item) return;
  item.images = (item.images || []).filter(image => image.id !== imageId);
  renderDescriptionImages(item);
  syncChipImageClass(item);
  if (currentImagePreviewId === imageId) closeImagePreview();
}

function updateImageMeta(imageId, changes = {}) {
  if (!imageModalEditingAllowed()) return;
  const item = getCurrentItem();
  if (!item) return;
  const image = (item.images || []).find(img => img.id === imageId);
  if (!image) return;
  if (Object.prototype.hasOwnProperty.call(changes, 'alt')) image.alt = String(changes.alt || '');
  if (Object.prototype.hasOwnProperty.call(changes, 'caption')) image.caption = sanitizeImageCaptionHtml(changes.caption || '');
  renderDescriptionImages(item);
}

function updateImageTitle(imageId, title) {
  updateImageMeta(imageId, { alt: title });
}

function saveOpenImageCaption(options = {}) {
  if (!currentImagePreviewId || !els.imageModalCaption) return;
  const force = options?.force === true;
  if (!force && !imageModalEditingAllowed()) return;
  const item = getCurrentItem();
  const image = (item?.images || []).find(img => img.id === currentImagePreviewId);
  if (!image) return;
  if (els.imageModalTitle) image.alt = String(els.imageModalTitle.value || '');
  image.caption = getImageCaptionEditorHtml();
  renderDescriptionImages(item);
  syncImageModalSlideshow();
}

function getCurrentImageList() {
  return getCurrentItem()?.images || [];
}

function getCurrentImageIndex() {
  return getCurrentImageList().findIndex(image => image.id === currentImagePreviewId);
}

function syncImageModalSlideshow() {
  const images = getCurrentImageList();
  const index = getCurrentImageIndex();
  const hasMultiple = images.length > 1 && index >= 0;
  if (els.imageModalControls) els.imageModalControls.hidden = !hasMultiple;
  if (els.imageModalPrev) els.imageModalPrev.hidden = !hasMultiple;
  if (els.imageModalNext) els.imageModalNext.hidden = !hasMultiple;
  if (els.imageModalCount) {
    els.imageModalCount.hidden = !hasMultiple;
    els.imageModalCount.textContent = hasMultiple ? `${index + 1} / ${images.length}` : '';
  }
}

function animateImageModalSlide(direction = 0) {
  if (!els.imageModalImg || !direction) return;
  const className = direction > 0 ? 'image-modal-slide-next' : 'image-modal-slide-prev';
  els.imageModalImg.classList.remove('image-modal-slide-next', 'image-modal-slide-prev');
  void els.imageModalImg.offsetWidth;
  els.imageModalImg.classList.add(className);
  window.setTimeout(() => {
    els.imageModalImg?.classList.remove(className);
  }, 260);
}

function loadImagePreviewContent(imageId, options = {}) {
  const item = getCurrentItem();
  const image = (item?.images || []).find(img => img.id === imageId);
  if (!image || !els.imageModalImg) return false;
  currentImagePreviewId = imageId;
  els.imageModalImg.src = image.url;
  els.imageModalImg.alt = image.alt || item.name || 'Description image';
  animateImageModalSlide(Number(options.slideDirection || 0));
  if (els.imageModalTitle) els.imageModalTitle.value = image.alt || '';
  setImageCaptionEditor(image.caption || '');
  if (options.preserveEditMode !== true) imageModalLocalEditMode = false;
  syncImageModalEditingState();
  syncImageModalSlideshow();
  return true;
}

function showAdjacentImagePreview(direction) {
  const images = getCurrentImageList();
  const index = getCurrentImageIndex();
  if (images.length < 2 || index < 0) return;
  saveOpenImageCaption({ force: true });
  const nextIndex = (index + direction + images.length) % images.length;
  const wasEditing = imageModalEditingAllowed();
  loadImagePreviewContent(images[nextIndex].id, { preserveEditMode: wasEditing, slideDirection: direction });
}

function openImagePreview(imageId) {
  if (!els.imageModal) return;
  imageModalLocalEditMode = false;
  if (!loadImagePreviewContent(imageId)) return;
  showElementWithFade(els.imageModal);
}

function closeImagePreview() {
  if (!els.imageModal) return;
  saveOpenImageCaption({ force: true });
  hideElementWithFade(els.imageModal, () => {
    currentImagePreviewId = null;
    imageModalLocalEditMode = false;
    els.imageModalImg.removeAttribute('src');
    syncImageModalSlideshow();
    if (els.imageModalTitle) els.imageModalTitle.value = '';
    setImageCaptionEditor('');
  });
}

function closeImagePreviewForItemChange() {
  if (!currentImagePreviewId) return;
  if (els.imageModal && !els.imageModal.hidden) closeImagePreview();
  else {
    currentImagePreviewId = null;
    imageModalLocalEditMode = false;
  }
}

function execImageModalCommand(command, value = null) {
  if (!currentImagePreviewId || !els.imageModalCaption || !ensureImageModalEditMode(els.imageModalCaption)) return;
  els.imageModalCaption.focus();
  document.execCommand(command, false, value);
  saveOpenImageCaption();
}

function applyImageModalCode() {
  if (!currentImagePreviewId || !els.imageModalCaption || !ensureImageModalEditMode(els.imageModalCaption)) return;
  els.imageModalCaption.focus();
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !els.imageModalCaption.contains(sel.anchorNode)) return;
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
  saveOpenImageCaption();
}

function applyImageModalLink() {
  if (!currentImagePreviewId || !els.imageModalCaption || !ensureImageModalEditMode(els.imageModalCaption)) return;
  els.imageModalCaption.focus();
  const url = window.prompt('Paste a URL');
  if (url === null) return;
  const clean = safeUrl(url);
  if (!clean) return;
  document.execCommand('createLink', false, clean);
  els.imageModalCaption.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  saveOpenImageCaption();
}

function imageFileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      reject(new Error('Drop an image file.'));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      reject(new Error('Image is too large. Use an image under 12MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read image.'));
    reader.onload = () => {
      const originalDataUrl = String(reader.result || '');
      if (!originalDataUrl) {
        reject(new Error('Could not read image.'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(originalDataUrl);
      img.onload = () => {
        try {
          const maxSide = 1400;
          const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((img.width || 1) * scale));
          canvas.height = Math.max(1, Math.round((img.height || 1) * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(originalDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.86) || originalDataUrl);
        } catch (err) {
          resolve(originalDataUrl);
        }
      };
      img.src = originalDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

async function addImageFiles(files) {
  if (!detailImageEditingAllowed()) return;
  const item = getCurrentItem();
  if (!item) return;
  const imageFiles = [...files].filter(file => file.type.startsWith('image/'));
  if (!imageFiles.length) {
    showImageError('Drop an image file.');
    return;
  }
  item.images = Array.isArray(item.images) ? item.images : [];
  try {
    for (const file of imageFiles) {
      const url = await imageFileToDataUrl(file);
      item.images.push({ id: uid(), url, alt: file.name.replace(/\.[^.]+$/, ''), caption: '' });
    }
    showImageError('');
    renderDescriptionImages(item);
    syncChipImageClass(item);
  } catch (err) {
    showImageError(err.message || 'Could not add image.');
  }
}

function syncChipImageClass(item) {
  const chip = document.querySelector(itemChipSelector(item.id, true));
  if (!chip) return;
  chip.classList.toggle('has-images', !!item.images?.length);
}

function extractYouTubeIds(text) {
  if (!text) return [];
  const seen = new Set();
  const ids = [];
  const re = /(?:youtube\.com\/(?:watch\?(?:[^#&\s]*&)*v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); ids.push(m[1]); }
  }
  return ids;
}

function renderYouTubeEmbeds(item) {
  const container = $('youtube-embeds');
  if (!container) return;
  const ids = extractYouTubeIds(item?.description || '');
  if (!ids.length) { container.hidden = true; container.innerHTML = ''; return; }
  container.innerHTML = '';
  ids.forEach(id => {
    const wrap = document.createElement('div');
    wrap.className = 'youtube-embed-wrap';

    const thumb = document.createElement('div');
    thumb.className = 'youtube-thumb';
    thumb.style.backgroundImage = `url(https://i.ytimg.com/vi/${id}/hqdefault.jpg)`;
    thumb.setAttribute('role', 'button');
    thumb.setAttribute('tabindex', '0');
    thumb.setAttribute('aria-label', 'Play video');

    const play = document.createElement('div');
    play.className = 'youtube-play-btn';
    play.innerHTML = `<svg viewBox="0 0 68 48" xmlns="http://www.w3.org/2000/svg"><path d="M66.5 7.4A8.5 8.5 0 0 0 60.6 1.5C55.3 0 34 0 34 0S12.7 0 7.4 1.5A8.5 8.5 0 0 0 1.5 7.4C0 12.7 0 24 0 24s0 11.3 1.5 16.6a8.5 8.5 0 0 0 5.9 5.9C12.7 48 34 48 34 48s21.3 0 26.6-1.5a8.5 8.5 0 0 0 5.9-5.9C68 35.3 68 24 68 24s0-11.3-1.5-16.6z" fill="#ff0000"/><path d="M27 34l18-10-18-10v20z" fill="#fff"/></svg>`;
    thumb.appendChild(play);

    const activate = () => {
      wrap.innerHTML = '';
      wrap.classList.add('is-playing');
      wrap.style.paddingBottom = '';
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;';
      wrap.appendChild(iframe);
    };
    thumb.addEventListener('click', e => { e.stopPropagation(); activate(); });
    thumb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); activate(); } });

    wrap.appendChild(thumb);
    container.appendChild(wrap);
  });
  container.hidden = false;
}


/* ── Selection, canvas geometry, and chip placement ── */

