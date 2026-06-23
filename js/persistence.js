/* Interactive Iceberg — autosave, console log & zip import/export.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

function updateAutosaveStatus(message = '', isWarning = false) {
  const status = $('autosave-status');
  if (!status) return;
  status.textContent = message;
  status.classList.toggle('warn', !!isWarning);
}

function getSerializableState() {
  if (els.title) state.title = els.title.value;
  state.version = STATE_VERSION;
  normalizeState();
  return JSON.parse(JSON.stringify(state));
}

function isMeaningfulSavedState(saved) {
  if (!saved || !Array.isArray(saved.items) || !Array.isArray(saved.tiers)) return false;
  if (saved.items.length) return true;
  if (String(saved.title || '').trim() && String(saved.title || '').trim() !== 'My Iceberg') return true;
  if (Number(saved.entryFontSize) && Number(saved.entryFontSize) !== 14) return true;
  if (Number(saved.bgBlur)) return true;
  if (saved.showTierTitles === false) return true;
  if (saved.showPips === false) return true;
  if (saved.entryDrift === false) return true;
  if (saved.icebergLocked === true) return true;
  if (saved.entryFontFamily && saved.entryFontFamily !== 'Georgia, serif') return true;
  if (safeUrl(saved.bannerImage || '')) return true;
  return saved.tiers.some((tier, index) => String(tier?.label || '') !== String(DEFAULT_TIERS[index]?.[0] || '') || !!tier?.labelImage);
}

function isMeaningfulAutosave(payload) {
  return isMeaningfulSavedState(payload?.state);
}

function readAutosavePayload() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !payload.state || !Array.isArray(payload.state.items) || !Array.isArray(payload.state.tiers)) return null;
    return payload;
  } catch (err) {
    console.warn('Could not read autosave.', err);
    return null;
  }
}

function formatAutosaveTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  if (Number.isNaN(date.getTime())) return 'Saved time unknown';
  const dateText = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const timeText = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${dateText}, ${timeText}`;
}

function setSidebarStatus(message, isError = false) {
  setAutosaveIndicator(isError ? 'error' : 'saved', message);
  if (!isError) {
    clearTimeout(setSidebarStatus._timer);
    setSidebarStatus._timer = setTimeout(() => {
      const time = new Date().toLocaleTimeString([], { timeStyle: 'short' });
      setAutosaveIndicator('saved', `Autosaved ${time}`);
    }, 5000);
  }
}

function updateConsolePopupAnchor() {
  const popup = $('console-popup');
  const indicator = $('autosave-indicator');
  if (!popup || !indicator) return;
  const indicatorRect = indicator.getBoundingClientRect();
  if (!indicatorRect.width) return;
  // Aim the pointer at the centre of the indicator using viewport rects so
  // the math holds for both the desktop (absolute) and mobile (fixed)
  // popup positions, clamped inside the popup so long status messages
  // can't push it off the edge.
  const popupRect = popup.getBoundingClientRect();
  const popupWidth = popupRect.width || popup.clientWidth || 280;
  const popupRight = popupRect.width ? popupRect.right : indicatorRect.right;
  const anchorX = indicatorRect.left + indicatorRect.width / 2;
  const maxRight = Math.max(13, popupWidth - 20);
  const pointerRight = clamp(Math.round(popupRight - anchorX - 6), 13, maxRight);
  popup.style.setProperty('--log-pointer-right', `${pointerRight}px`);
}

function toggleConsolePopup() {
  const popup = $('console-popup');
  const indicator = $('autosave-indicator');
  if (!popup) return;
  if (!popup.hidden) {
    closeConsolePopup();
    return;
  }
  closeFloatingPopups('console');
  showElementWithFade(popup);
  updateConsolePopupAnchor();
  indicator?.setAttribute('aria-expanded', 'true');
}

function closeConsolePopup() {
  const popup = $('console-popup');
  if (!popup || popup.hidden) return;
  hideElementWithFade(popup, () => $('console-clear-confirm')?.remove());
  $('autosave-indicator')?.setAttribute('aria-expanded', 'false');
}

function setAutosaveIndicator(indicatorState, text) {
  const el = $('autosave-indicator');
  const textEl = $('autosave-indicator-text');
  if (!el) return;
  el.classList.remove('saving', 'saved', 'error');
  if (indicatorState) el.classList.add(indicatorState);
  el.classList.add('visible');
  if (textEl) textEl.textContent = text;
}

function getAutosaveState() {
  const full = getSerializableState();
  full.items = (full.items || []).map(item => {
    if (!item.images?.length) return item;
    const { images, ...rest } = item;
    return rest;
  });
  return full;
}

function writeAutosaveNow() {
  if (!autosaveReady || autosaveWriteFailed) return;
  try {
    const autosaveState = getAutosaveState();
    if (!isMeaningfulSavedState(autosaveState)) return;
    const payload = { savedAt: Date.now(), state: autosaveState };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
    updateAutosaveStatus('');
    const time = new Date(payload.savedAt).toLocaleTimeString([], { timeStyle: 'short' });
    setAutosaveIndicator('saved', `Autosaved ${time}`);
  } catch (err) {
    autosaveWriteFailed = true;
    setAutosaveIndicator('error', 'Autosave failed');
    setSidebarStatus('Autosave failed — storage full. Use Save ZIP to preserve your iceberg.', true);
    updateAutosaveStatus('');
    console.warn('Autosave failed.', err);
  }
}

function scheduleAutosave() {
  if (!autosaveReady || autosaveWriteFailed) return;
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(writeAutosaveNow, 60000);
}

function clearAutosaveStorage() {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch (err) {
    console.warn('Could not clear autosave.', err);
  }
}

function hideAutosavePrompt() {
  const modal = $('autosave-modal');
  if (modal) hideElementWithFade(modal);
}

function getSavedIcebergTitle(savedState) {
  const title = String(savedState?.title || '').trim();
  return title || 'Untitled iceberg';
}

function showAutosavePrompt(payload) {
  pendingAutosavePayload = payload;
  const modal = $('autosave-modal');
  const meta = $('autosave-meta');
  const titleSubheading = $('autosave-title-subheading');
  if (!modal) return false;
  const itemCount = payload?.state?.items?.length || 0;
  const title = getSavedIcebergTitle(payload?.state);
  if (titleSubheading) titleSubheading.textContent = title;
  if (meta) meta.textContent = `${formatAutosaveTime(payload?.savedAt)} · ${itemCount} entries`;
  showElementWithFade(modal);
  return true;
}

function restoreAutosave() {
  if (!pendingAutosavePayload?.state) return;
  closeImagePreviewForItemChange();
  state = pendingAutosavePayload.state;
  // Autosaves deliberately exclude entry images. If an older/bad autosave contains
  // image data on entries, strip it so tier images cannot bleed into detail cards.
  (state.items || []).forEach(item => { delete item.images; });
  normalizeState();
  currentItemId = null;
  selectedItemIds.clear();
  hideAutosavePrompt();
  autosaveReady = true;
  entryLoadAnimationPending = true;
  render();
  renderDetailPanel();
  revealIcebergFromBlueprint({ delay: 120 });
  writeAutosaveNow();
  setSidebarStatus('Autosave restored. Tier images included, entry images require a ZIP export.');
}

function startFreshAutosave() {
  pendingAutosavePayload = null;
  hideAutosavePrompt();
  autosaveReady = true;
  revealIcebergFromBlueprint({ delay: 120 });
  setAutosaveIndicator('saved', 'Started blank');
}

function loadLocalSaveFromAutosave() {
  if (els.file) els.file.accept = '.json,application/json,.zip,application/zip,application/x-zip-compressed';
  els.file?.click();
}

function initAutosave() {
  const payload = readAutosavePayload();
  if (isMeaningfulAutosave(payload)) return showAutosavePrompt(payload);
  autosaveReady = true;
  return false;
}

/* ── Save and load ZIP ── */
function triggerDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

const ZIP_TEXT_ENCODER = new TextEncoder();
const ZIP_TEXT_DECODER = new TextDecoder();
let zipCrcTable = null;

function getZipCrcTable() {
  if (zipCrcTable) return zipCrcTable;
  zipCrcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    zipCrcTable[n] = c >>> 0;
  }
  return zipCrcTable;
}

function crc32(bytes) {
  const table = getZipCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dataUrlToAsset(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+)(;base64)?,(.*)$/);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const isBase64 = !!match[2];
  const body = match[3] || '';
  let bytes;
  try {
    if (isBase64) {
      const binary = atob(body);
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    } else {
      bytes = ZIP_TEXT_ENCODER.encode(decodeURIComponent(body));
    }
  } catch {
    return null;
  }
  const ext = mime.includes('png') ? 'png'
    : mime.includes('webp') ? 'webp'
    : mime.includes('gif') ? 'gif'
    : mime.includes('svg') ? 'svg'
    : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg'
    : 'bin';
  return { mime, bytes, ext };
}

function bytesToDataUrl(bytes, mime = 'application/octet-stream') {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function mimeFromPath(path) {
  const lower = String(path || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function safeAssetName(value, fallback = 'asset') {
  const clean = String(value || fallback)
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return clean || fallback;
}

function buildZipAssetState() {
  const zipState = JSON.parse(JSON.stringify(getSerializableState()));
  const assets = [];

  (zipState.items || []).forEach(item => {
    const entryFolder = `assets/entries/entry-${safeAssetName(item.id)}`;
    (item.images || []).forEach((image, index) => {
      const asset = dataUrlToAsset(image.url);
      if (!asset) return;
      const imageName = safeAssetName(image.id || `image-${index + 1}`, `image-${index + 1}`);
      const path = `${entryFolder}/${imageName}.${asset.ext}`;
      assets.push({ path, bytes: asset.bytes });
      image.url = path;
      image.assetPath = path;
      image.mime = asset.mime;
    });
  });

  if (zipState.bannerImage) {
    const asset = dataUrlToAsset(zipState.bannerImage);
    if (asset) {
      const path = `assets/banner/chart-banner.${asset.ext}`;
      assets.push({ path, bytes: asset.bytes });
      zipState.bannerImage = path;
      zipState.bannerImageMime = asset.mime;
    }
  }

  (zipState.tiers || []).forEach(tier => {
    const asset = dataUrlToAsset(tier.labelImage);
    if (!asset) return;
    const path = `assets/tiers/tier-${safeAssetName(tier.id)}.${asset.ext}`;
    assets.push({ path, bytes: asset.bytes });
    tier.labelImage = path;
    tier.labelImageMime = asset.mime;
  });

  zipState.assetMode = 'zip-paths-v1';
  return { zipState, assets };
}

function dateToDosParts(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function pushU16(out, value) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushU32(out, value) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function createStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const { time, day } = dateToDosParts();

  files.forEach(file => {
    const nameBytes = ZIP_TEXT_ENCODER.encode(file.path);
    const data = file.bytes instanceof Uint8Array ? file.bytes : ZIP_TEXT_ENCODER.encode(String(file.bytes || ''));
    const crc = crc32(data);
    const local = [];
    pushU32(local, 0x04034b50);
    pushU16(local, 20);
    pushU16(local, 0x0800);
    pushU16(local, 0);
    pushU16(local, time);
    pushU16(local, day);
    pushU32(local, crc);
    pushU32(local, data.length);
    pushU32(local, data.length);
    pushU16(local, nameBytes.length);
    pushU16(local, 0);
    localParts.push(new Uint8Array(local), nameBytes, data);

    const central = [];
    pushU32(central, 0x02014b50);
    pushU16(central, 20);
    pushU16(central, 20);
    pushU16(central, 0x0800);
    pushU16(central, 0);
    pushU16(central, time);
    pushU16(central, day);
    pushU32(central, crc);
    pushU32(central, data.length);
    pushU32(central, data.length);
    pushU16(central, nameBytes.length);
    pushU16(central, 0);
    pushU16(central, 0);
    pushU16(central, 0);
    pushU16(central, 0);
    pushU32(central, 0);
    pushU32(central, offset);
    centralParts.push(new Uint8Array(central), nameBytes);

    offset += local.length + nameBytes.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = [];
  pushU32(end, 0x06054b50);
  pushU16(end, 0);
  pushU16(end, 0);
  pushU16(end, files.length);
  pushU16(end, files.length);
  pushU32(end, centralSize);
  pushU32(end, offset);
  pushU16(end, 0);

  return new Blob([...localParts, ...centralParts, new Uint8Array(end)], { type: 'application/zip' });
}

async function saveZipState() {
  try {
    const { zipState, assets } = buildZipAssetState();
    const files = [
      { path: 'iceberg.json', bytes: ZIP_TEXT_ENCODER.encode(JSON.stringify(zipState, null, 2)) },
      ...assets
    ];
    const zipBlob = createStoredZip(files);
    triggerDownload(zipBlob, `${sanitizeDownloadFilename(zipState.title, 'iceberg')}.zip`);
    setSidebarStatus(`Full ZIP saved manually. ${assets.length} image asset${assets.length === 1 ? '' : 's'} bundled.`);
  } catch (err) {
    setSidebarStatus(`Could not save ZIP — ${err.message || 'unknown error'}`, true);
  }
}

function readU16(view, offset) {
  return view.getUint16(offset, true);
}

function readU32(view, offset) {
  return view.getUint32(offset, true);
}

function findEndOfCentralDirectory(bytes) {
  const min = Math.max(0, bytes.length - 0xffff - 22);
  for (let i = bytes.length - 22; i >= min; i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
  }
  return -1;
}

function readStoredZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(bytes);
  if (eocd < 0) throw new Error('This ZIP could not be read.');
  const entriesCount = readU16(view, eocd + 10);
  let centralOffset = readU32(view, eocd + 16);
  const files = new Map();

  for (let i = 0; i < entriesCount; i += 1) {
    if (readU32(view, centralOffset) !== 0x02014b50) throw new Error('This ZIP has an invalid directory.');
    const flags = readU16(view, centralOffset + 8);
    const method = readU16(view, centralOffset + 10);
    const compressedSize = readU32(view, centralOffset + 20);
    const uncompressedSize = readU32(view, centralOffset + 24);
    const nameLen = readU16(view, centralOffset + 28);
    const extraLen = readU16(view, centralOffset + 30);
    const commentLen = readU16(view, centralOffset + 32);
    const localOffset = readU32(view, centralOffset + 42);
    const nameBytes = bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLen);
    const name = ZIP_TEXT_DECODER.decode(nameBytes).replace(/^\/+/, '');
    centralOffset += 46 + nameLen + extraLen + commentLen;
    if (!name || name.endsWith('/')) continue;
    if (method !== 0) throw new Error('This ZIP uses compression this build cannot read. Save ZIPs made by this app use stored files.');
    if (flags & 0x0001) throw new Error('Password-protected ZIPs are not supported.');
    if (readU32(view, localOffset) !== 0x04034b50) throw new Error('This ZIP has a damaged file entry.');
    const localNameLen = readU16(view, localOffset + 26);
    const localExtraLen = readU16(view, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    const data = bytes.slice(dataStart, dataEnd);
    if (data.length !== uncompressedSize) throw new Error('This ZIP has a damaged file size.');
    files.set(name, data);
  }
  return files;
}

function expectedEntryAssetPrefix(item) {
  return `assets/entries/entry-${safeAssetName(item?.id)}/`;
}

function getZipImageReference(image) {
  return String(image?.url || image?.assetPath || image?.src || '').replace(/^\/+/, '');
}

async function parseZipImport(file) {
  const files = readStoredZip(await file.arrayBuffer());
  const jsonBytes = files.get('iceberg.json') || files.get('state.json') || files.get('save.json');
  if (!jsonBytes) throw new Error('This ZIP is missing iceberg.json.');
  let loaded;
  try {
    loaded = JSON.parse(ZIP_TEXT_DECODER.decode(jsonBytes));
  } catch {
    throw new Error('The iceberg.json inside this ZIP is not valid JSON.');
  }

  const loadedItems = loaded.items || loaded.entries || [];
  loadedItems.forEach(item => {
    const expectedPrefix = expectedEntryAssetPrefix(item);
    item.images = (item.images || []).filter(image => {
      const path = getZipImageReference(image);
      if (!path || /^(https?:|data:image\/)/i.test(path)) return true;
      if (!path.startsWith(expectedPrefix)) return false;
      const bytes = files.get(path);
      if (!bytes) return false;
      image.url = bytesToDataUrl(bytes, image.mime || mimeFromPath(path));
      delete image.src;
      delete image.assetPath;
      delete image.mime;
      return true;
    });
  });

  if (loaded.bannerImage && !/^(https?:|data:image\/)/i.test(String(loaded.bannerImage))) {
    const bannerPath = String(loaded.bannerImage || '').replace(/^\/+/, '');
    const bannerBytes = files.get(bannerPath);
    loaded.bannerImage = bannerBytes ? bytesToDataUrl(bannerBytes, loaded.bannerImageMime || mimeFromPath(bannerPath)) : '';
    delete loaded.bannerImageMime;
  }

  (loaded.tiers || []).forEach(tier => {
    const path = String(tier.labelImage || '').replace(/^\/+/, '');
    if (!path || /^(https?:|data:image\/)/i.test(path)) return;
    const bytes = files.get(path);
    if (!bytes) {
      tier.labelImage = '';
      return;
    }
    tier.labelImage = bytesToDataUrl(bytes, tier.labelImageMime || mimeFromPath(path));
    delete tier.labelImageMime;
  });

  const result = parseAndValidateImport(JSON.stringify(loaded), file.name);
  result.report.title = result.report.title.replace(/^JSON loaded/, 'ZIP loaded');
  result.report.copy = `Loaded ${file.name} safely.`;
  return result;
}

function countImportImageCandidates(items = []) {
  return items.reduce((sum, item) => {
    const attached = Array.isArray(item?.images) ? item.images.length : 0;
    const markdown = String(item?.description || '').match(/!\[[^\]]*\]\([^)]+\)/g)?.length || 0;
    return sum + attached + markdown;
  }, 0);
}

function countImportImages(items = []) {
  return items.reduce((sum, item) => sum + (Array.isArray(item?.images) ? item.images.length : 0), 0);
}

function buildImportReport(rawLoaded, normalizedState, fileName = '') {
  const rawItems = Array.isArray(rawLoaded?.items) ? rawLoaded.items : [];
  const loadedItems = Array.isArray(normalizedState?.items) ? normalizedState.items : [];
  const imageCandidates = countImportImageCandidates(rawItems);
  const restoredImages = countImportImages(loadedItems);
  const invalidImages = Math.max(0, imageCandidates - restoredImages);
  const placedCount = loadedItems.filter(item => item.tierId).length;
  const unplacedCount = loadedItems.length - placedCount;
  const loadedVersion = Number(rawLoaded?.version) || 0;
  const repairedItems = rawItems.filter(item => !item || !String(item.id || '').trim() || !String(item.name || '').trim() || typeof item.description !== 'string' || typeof item.needsVerification !== 'boolean').length;
  const rawTiers = Array.isArray(rawLoaded?.tiers) ? rawLoaded.tiers : [];
  const rawTierIds = rawTiers.map(tier => String(tier?.id || '').trim()).filter(Boolean);
  const duplicateTierIds = rawTierIds.length - new Set(rawTierIds).size;
  const repairedTiers = !Array.isArray(rawLoaded?.tiers) || rawLoaded.tiers.length !== FIXED_TIER_COUNT || duplicateTierIds > 0;

  const lines = [
    `${loadedItems.length} entries loaded`,
    `${placedCount} placed · ${unplacedCount} unplaced`,
    `${restoredImages} images restored`
  ];

  if (invalidImages) lines.push(`${invalidImages} invalid image${invalidImages === 1 ? '' : 's'} skipped`);
  if (loadedVersion && loadedVersion !== STATE_VERSION) lines.push(`version ${loadedVersion} normalized for this build`);
  if (!loadedVersion) lines.push('legacy save normalized for this build');
  if (duplicateTierIds) lines.push(`${duplicateTierIds} duplicate tier ID${duplicateTierIds === 1 ? '' : 's'} repaired`);
  if (repairedItems || repairedTiers) lines.push('missing or old fields were repaired');

  const hasNotes = invalidImages || repairedItems || repairedTiers || (loadedVersion && loadedVersion !== STATE_VERSION) || !loadedVersion;
  return {
    title: hasNotes ? 'JSON loaded with notes' : 'JSON loaded',
    copy: fileName ? `Loaded ${fileName} safely.` : 'Loaded JSON safely.',
    tone: invalidImages || repairedItems || repairedTiers ? 'warn' : 'success',
    lines
  };
}

function renderConsoleLog() {
  const list = $('console-log-list');
  if (!list) return;
  list.innerHTML = '';
  if (!consoleLogEntries.length) {
    const empty = document.createElement('p');
    empty.className = 'console-log-empty';
    empty.textContent = 'No recent log entries.';
    list.appendChild(empty);
    return;
  }
  consoleLogEntries.forEach(entry => {
    const item = document.createElement('article');
    item.className = `console-log-entry ${entry.tone || 'success'}`;

    const title = document.createElement('div');
    title.className = 'console-log-title';
    title.textContent = entry.title || 'Log entry';
    item.appendChild(title);

    if (entry.copy) {
      const copy = document.createElement('p');
      copy.className = 'console-log-copy';
      copy.textContent = entry.copy;
      item.appendChild(copy);
    }

    if (entry.lines?.length) {
      const lines = document.createElement('ul');
      lines.className = 'console-log-lines';
      entry.lines.forEach(line => {
        const li = document.createElement('li');
        li.textContent = line;
        lines.appendChild(li);
      });
      item.appendChild(lines);
    }

    const time = document.createElement('div');
    time.className = 'console-log-time';
    time.textContent = entry.timeText;
    item.appendChild(time);

    list.appendChild(item);
  });
}

function addConsoleLogEntry({ title = 'Log entry', copy = '', lines = [], tone = 'success' } = {}) {
  const timeText = new Date().toLocaleTimeString([], { timeStyle: 'short' });
  consoleLogEntries.unshift({ title, copy, lines: Array.isArray(lines) ? lines : [], tone, timeText });
  consoleLogEntries.splice(MAX_CONSOLE_LOG_ENTRIES);
  renderConsoleLog();
}

function showLoadNotice({ title = 'ZIP loaded', copy = '', lines = [], tone = 'success' } = {}) {
  addConsoleLogEntry({ title, copy, lines, tone });
}

function parseAndValidateImport(text, fileName = '') {
  let loaded;
  try {
    loaded = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON. Your current iceberg was not changed.');
  }
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
    throw new Error('This JSON does not look like an iceberg save. Your current iceberg was not changed.');
  }
  if (!Array.isArray(loaded.items) && Array.isArray(loaded.entries)) loaded.items = loaded.entries;
  if (!Array.isArray(loaded.items)) {
    throw new Error('This JSON is missing an entries list. Your current iceberg was not changed.');
  }
  if (!Array.isArray(loaded.tiers)) loaded.tiers = [];

  const previousState = state;
  const importedState = JSON.parse(JSON.stringify(loaded));
  try {
    state = importedState;
    normalizeState();
    state.version = STATE_VERSION;
    const normalizedState = JSON.parse(JSON.stringify(state));
    const report = buildImportReport(loaded, normalizedState, fileName);
    state = previousState;
    return { state: normalizedState, report };
  } catch (err) {
    state = previousState;
    throw new Error('This JSON could not be repaired safely. Your current iceberg was not changed.');
  }
}

async function loadState(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const lowerName = String(file.name || '').toLowerCase();
    if (!lowerName.endsWith('.zip')) throw new Error('Only ZIP saves are supported.');
    const result = await parseZipImport(file);
    pendingAutosavePayload = null;
    hideAutosavePrompt();
    autosaveReady = true;
    closeImagePreviewForItemChange();
    state = result.state;
    currentItemId = null;
    selectedItemIds.clear();
    entryLoadAnimationPending = true;
    render();
    renderDetailPanel();
    revealIcebergFromBlueprint({ delay: 80 });
    writeAutosaveNow();
    const r = result.report;
    showLoadNotice(r);
    const summary = `${r.title} — ${r.lines[0] || ''}${r.lines[1] ? ', ' + r.lines[1] : ''}`;
    setSidebarStatus(summary, r.tone === 'error');
  } catch (err) {
    const isZip = String(file.name || '').toLowerCase().endsWith('.zip');
    const message = err.message || 'The file could not be loaded.';
    showLoadNotice({
      title: 'Could not load ZIP',
      copy: message,
      lines: ['Your current iceberg was not changed.'],
      tone: 'error'
    });
    setSidebarStatus(`Could not load file — ${message}`, true);
  } finally {
    event.target.value = '';
  }
}


/* ── Export to PNG ── */
