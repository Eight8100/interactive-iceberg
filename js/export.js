/* Interactive Iceberg — PNG canvas export.
   @module-split  Former single app.js, divided into ordered classic scripts.
   Load order is set in index.html; this file shares global scope with the rest. */

function waitForFonts() {
  return document.fonts?.ready || Promise.resolve();
}


function getCssPx(name, fallback) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

function parseCanvasColor(color, fallback = '#000') {
  return color || fallback;
}

function loadExportImage(src) {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    // Anything that isn't an inline data:/blob: source gets CORS mode so it
    // can never taint the canvas. Same-origin loads are unaffected; sources
    // that can't satisfy CORS (e.g. running from file://) fail to load and
    // resolve null, letting the export fall back instead of throwing
    // "Tainted canvases may not be exported" at toBlob time.
    if (!/^(data|blob):/i.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function downloadCanvas(canvas) {
  return new Promise((resolve, reject) => {
    const filename = `${sanitizeDownloadFilename(state.title, 'iceberg')}.png`;
    const finish = href => {
      const a = document.createElement('a');
      a.download = filename;
      a.href = href;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => {
        if (href.startsWith('blob:')) URL.revokeObjectURL(href);
      }, 1000);
      resolve();
    };

    try {
      if (canvas.toBlob) {
        canvas.toBlob(blob => {
          if (blob) finish(URL.createObjectURL(blob));
          else reject(new Error('Canvas export returned an empty image.'));
        }, 'image/png');
        return;
      }
      finish(canvas.toDataURL('image/png'));
    } catch (err) {
      reject(err);
    }
  });
}

function wrapCanvasText(ctx, text, maxWidth) {
  const source = String(text || '').replace(/\s+/g, ' ').trim();
  if (!source) return [];
  const lines = [];
  const words = source.split(' ');
  let line = '';

  const pushBrokenWord = word => {
    let part = '';
    [...word].forEach(char => {
      const test = part + char;
      if (part && ctx.measureText(test).width > maxWidth) {
        lines.push(part);
        part = char;
      } else {
        part = test;
      }
    });
    line = part;
  };

  words.forEach(word => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      return;
    }
    if (line) lines.push(line);
    if (ctx.measureText(word).width > maxWidth) pushBrokenWord(word);
    else line = word;
  });
  if (line) lines.push(line);
  return lines;
}

function drawOutlinedText(ctx, text, x, y, options = {}) {
  const fontSize = options.fontSize || 14;
  const fontFamily = options.fontFamily || 'Georgia, serif';
  const maxWidth = options.maxWidth || 220;
  const lineHeight = options.lineHeight || fontSize * 1.16;
  const weight = options.weight || 900;
  const fill = options.fill || '#fff';
  const stroke = options.stroke || '#000';
  const strokeWidth = options.strokeWidth ?? 4;
  const align = options.align || 'center';
  const maxLines = options.maxLines || 6;

  ctx.save();
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  let lines = wrapCanvasText(ctx, text, maxWidth).slice(0, maxLines);
  if (!lines.length) { ctx.restore(); return { width: 0, height: 0, lines: [] }; }
  const height = lines.length * lineHeight;
  const startY = y - height / 2 + lineHeight / 2;
  const widest = Math.max(...lines.map(line => ctx.measureText(line).width));

  ctx.shadowColor = 'rgba(0,0,0,.88)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = fill;
  lines.forEach((line, index) => ctx.fillText(line, x, startY + index * lineHeight));

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  lines.forEach((line, index) => ctx.strokeText(line, x, startY + index * lineHeight));
  ctx.fillStyle = fill;
  lines.forEach((line, index) => ctx.fillText(line, x, startY + index * lineHeight));
  ctx.restore();
  return { width: widest, height, lines };
}

function getExportRows(canvasH) {
  const total = TIER_BOUNDARIES[TIER_BOUNDARIES.length - 1] || 1;
  return TIER_BOUNDARIES.slice(1).map((boundary, index) => {
    const y = TIER_BOUNDARIES[index] / total * canvasH;
    const h = (boundary - TIER_BOUNDARIES[index]) / total * canvasH;
    return { y, h };
  });
}

function drawCoverImage(ctx, img, x, y, w, h, posX = 50, posY = 50) {
  if (!img) return;
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = x - Math.max(0, dw - w) * (normalizeTierImagePosition(posX) / 100);
  const dy = y - Math.max(0, dh - h) * (normalizeTierImagePosition(posY) / 100);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

async function exportImageWithCanvasRenderer() {
  await waitForFonts();

  const canvasW = getCssPx('--canvas-w', 980);
  const canvasH = getCssPx('--canvas-h', 1752);
  const labelW = getCssPx('--label-w', 185);
  const itemW = canvasW - labelW;
  const rows = getExportRows(canvasH);
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(canvasW * scale);
  canvas.height = Math.round(canvasH * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.scale(scale, scale);

  ctx.fillStyle = '#0a0e1a';
  ctx.fillRect(0, 0, canvasW, canvasH);

  const bg = await loadExportImage('images/iceberg-bg.webp');
  if (bg) {
    ctx.save();
    const blur = clamp(Number(state.bgBlur) || 0, 0, 2);
    if (blur > 0 && 'filter' in ctx) ctx.filter = `blur(${blur}px)`;
    ctx.drawImage(bg, 0, 0, canvasW, canvasH);
    ctx.restore();
  } else {
    // Background image unavailable (e.g. opened via file://): approximate
    // the ocean with a vertical gradient through the tier colours so the
    // export still reads as an iceberg chart.
    const grad = ctx.createLinearGradient(0, 0, 0, canvasH);
    const tiers = state.tiers?.length ? state.tiers : [];
    if (tiers.length > 1) {
      tiers.forEach((tier, i) => grad.addColorStop(i / (tiers.length - 1), parseCanvasColor(tier.color, '#0a0e1a')));
    } else {
      grad.addColorStop(0, '#13a9e8');
      grad.addColorStop(1, '#000000');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }

  // Match the subtle de-vignette overlay used on the first image band.
  if (rows[0]) {
    const gradX = ctx.createLinearGradient(0, 0, itemW, 0);
    gradX.addColorStop(0, 'rgba(18,145,220,.34)');
    gradX.addColorStop(.18, 'rgba(18,145,220,0)');
    gradX.addColorStop(.82, 'rgba(18,145,220,0)');
    gradX.addColorStop(1, 'rgba(18,145,220,.22)');
    ctx.fillStyle = gradX;
    ctx.fillRect(0, rows[0].y, itemW, rows[0].h);
    const gradY = ctx.createLinearGradient(0, rows[0].y, 0, rows[0].y + rows[0].h);
    gradY.addColorStop(0, 'rgba(18,145,220,.22)');
    gradY.addColorStop(.55, 'rgba(18,145,220,0)');
    ctx.fillStyle = gradY;
    ctx.fillRect(0, rows[0].y, itemW, rows[0].h);
  }

  for (let index = 0; index < state.tiers.length; index += 1) {
    const tier = state.tiers[index];
    const row = rows[index];
    if (!tier || !row) continue;
    const labelX = itemW;
    ctx.fillStyle = parseCanvasColor(tier.color, 'transparent');
    ctx.fillRect(labelX, row.y, labelW, row.h);

    if (tier.labelImage) {
      const img = await loadExportImage(tier.labelImage);
      drawCoverImage(ctx, img, labelX, row.y, labelW, row.h, tier.labelImageX, tier.labelImageY);
      const overlay = ctx.createLinearGradient(0, row.y, 0, row.y + row.h);
      overlay.addColorStop(0, 'rgba(0,0,0,.18)');
      overlay.addColorStop(1, 'rgba(0,0,0,.28)');
      ctx.fillStyle = overlay;
      ctx.fillRect(labelX, row.y, labelW, row.h);
    }

    if (state.showTierTitles !== false) {
      drawOutlinedText(ctx, tier.label, labelX + labelW / 2, row.y + row.h / 2, {
        fontSize: 22,
        fontFamily: 'Georgia, serif',
        maxWidth: labelW - 22,
        lineHeight: 27,
        strokeWidth: 5,
        maxLines: 4
      });
    }
  }

  const tierIndexById = new Map(state.tiers.map((tier, index) => [tier.id, index]));
  state.items.filter(item => item.tierId).forEach(item => {
    const tierIndex = tierIndexById.get(item.tierId);
    const row = rows[tierIndex];
    if (!row) return;
    const x = (Number(item.xPct) || 50) / 100 * itemW;
    const y = row.y + (Number(item.yPct) || 50) / 100 * row.h;
    drawOutlinedText(ctx, item.name, x, y, {
      fontSize: clamp(Number(state.entryFontSize) || 14, 10, 24),
      fontFamily: state.entryFontFamily || 'Georgia, serif',
      maxWidth: 210,
      lineHeight: clamp(Number(state.entryFontSize) || 14, 10, 24) * 1.12,
      strokeWidth: 4,
      maxLines: 4
    });
  });

  const separator = getComputedStyle(document.documentElement).getPropertyValue('--tier-separator').trim() || 'rgba(112, 36, 68, .86)';
  ctx.fillStyle = separator;
  ctx.fillRect(itemW - 1.5, 0, 3, canvasH);
  rows.slice(0, -1).forEach(row => {
    ctx.fillRect(0, row.y + row.h - 1.5, canvasW, 3);
  });

  await downloadCanvas(canvas);
}

function exportImage() {
  state.title = els.title.value;
  endFluidDrag(false);
  selectedItemIds.clear();
  renderSelection();

  const reportExportError = (err) => {
    console.warn('Export failed.', err);
    showLoadNotice({
      title: 'Could not export PNG',
      copy: 'The browser could not generate the PNG. Your iceberg was not changed.',
      lines: [err?.message ? `Reason: ${err.message}` : 'Try refreshing the page, then export again.'],
      tone: 'error'
    });
  };

  exportImageWithCanvasRenderer().catch(reportExportError);
}

/* ── Hover preview ── */
