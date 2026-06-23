/**
 * Affine / Projective Transformation Visualizer
 * Interactive 2D coordinate geometry tool using Canvas.
 */

/* ═══════════════════════════════════════════
   MATRIX MATH (3×3 homogeneous)
   ═══════════════════════════════════════════ */

function matIdentity() {
  return [1,0,0, 0,1,0, 0,0,1];
}

function matMul(A, B) {
  // A, B are flat 9-element arrays (row-major)
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        r[i*3+j] += A[i*3+k] * B[k*3+j];
  return r;
}

function matInv(M) {
  // Inverse of 3x3 matrix
  const [a,b,c, d,e,f, g,h,i] = M;
  const det = a*(e*i - f*h) - b*(d*i - f*g) + c*(d*h - e*g);
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  return [
    (e*i - f*h) * invDet, (c*h - b*i) * invDet, (b*f - c*e) * invDet,
    (f*g - d*i) * invDet, (a*i - c*g) * invDet, (c*d - a*f) * invDet,
    (d*h - e*g) * invDet, (b*g - a*h) * invDet, (a*e - b*d) * invDet
  ];
}

function applyTransform(M, x, y) {
  // Apply homogeneous 3x3 matrix M to point (x,y)
  const [a,b,tx, c,d,ty, g,h,w] = M;
  const denom = g*x + h*y + w;
  return {
    x: (a*x + b*y + tx) / denom,
    y: (c*x + d*y + ty) / denom
  };
}

/* ═══════════════════════════════════════════
   PRESET TRANSFORMATIONS
   ═══════════════════════════════════════════ */

function makeTranslate(tx, ty) {
  return [1,0,tx, 0,1,ty, 0,0,1];
}

function makeRotate(deg) {
  const r = deg * Math.PI / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return [c,-s,0, s,c,0, 0,0,1];
}

function makeScale(sx, sy) {
  return [sx,0,0, 0,sy,0, 0,0,1];
}

function makeShear(shx, shy) {
  return [1,shx,0, shy,1,0, 0,0,1];
}

function makeReflect(axis) {
  if (axis === 'x') return [1,0,0, 0,-1,0, 0,0,1];
  if (axis === 'y') return [-1,0,0, 0,1,0, 0,0,1];
  return matIdentity();
}

const PRESETS = [
  { name: '恒等变换',    mat: matIdentity() },
  { name: '平移 (2, 1)', mat: makeTranslate(2, 1) },
  { name: '旋转 90°',   mat: makeRotate(90) },
  { name: '旋转 45°',   mat: makeRotate(45) },
  { name: '缩放 ×2',    mat: makeScale(2, 2) },
  { name: '缩放 ×½',    mat: makeScale(0.5, 0.5) },
  { name: 'X 轴反射',   mat: makeReflect('x') },
  { name: 'Y 轴反射',   mat: makeReflect('y') },
  { name: '剪切 X',     mat: makeShear(1, 0) },
  { name: '剪切 Y',     mat: makeShear(0, 1) },
  { name: '压缩 X',     mat: makeScale(0.3, 1) },
];

/* ═══════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════ */

// Default shape: a right triangle + extra vertex to make a kite-like shape
// that clearly shows rotation/reflection
const defaultShape = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 1 },
  { x: 1, y: 2 },
];

let shapeVertices = defaultShape.map(v => ({...v}));
let transformMatrix = makeRotate(45); // default: 45° rotation

// View state: { cx, cy, scale } — canvas pixel coords to world coords
let viewLeft  = { cx: 0, cy: 0, scale: 1 };
let viewRight = { cx: 0, cy: 0, scale: 1 };

// Interaction state
let dragging = null;       // { side: 'left'|'right', idx: vertex index }
let panning = null;        // { side, startX, startY, startCx, startCy, startClientX, startClientY }
let hoveredVertex = null;  // { side, idx }

// Canvas & layout
let canvas, ctx;
let leftRect = null;       // { x, y, w, h } — left viewport in canvas pixels
let rightRect = null;
const DIVIDER_WIDTH = 3;

// g, h projective params (hidden by default, toggled)
let projectiveMode = false;
let projectiveG = 0;
let projectiveH = 0;

/* ═══════════════════════════════════════════
   COORDINATE CONVERSION
   ═══════════════════════════════════════════ */

function worldToCanvas(wx, wy, view, rect) {
  return {
    x: rect.x + rect.w/2 + (wx - view.cx) * view.scale,
    y: rect.y + rect.h/2 - (wy - view.cy) * view.scale
  };
}

function canvasToWorld(cx, cy, view, rect) {
  return {
    x: view.cx + (cx - rect.x - rect.w/2) / view.scale,
    y: view.cy - (cy - rect.y - rect.h/2) / view.scale
  };
}

/* ═══════════════════════════════════════════
   RENDERING
   ═══════════════════════════════════════════ */

function drawGrid(ctx, rect, view) {
  const { x, y, w, h } = rect;

  // Background
  ctx.fillStyle = '#fafbfc';
  ctx.fillRect(x, y, w, h);

  // Determine visible world range
  const topLeft = canvasToWorld(x, y, view, rect);
  const botRight = canvasToWorld(x + w, y + h, view, rect);
  const xMin = Math.floor(Math.min(topLeft.x, botRight.x));
  const xMax = Math.ceil(Math.max(topLeft.x, botRight.x));
  const yMin = Math.floor(Math.min(topLeft.y, botRight.y));
  const yMax = Math.ceil(Math.max(topLeft.y, botRight.y));

  // Determine appropriate grid step
  const step = view.scale > 80 ? 0.5 : view.scale > 40 ? 1 : view.scale > 15 ? 2 : 5;

  // Minor grid lines
  ctx.strokeStyle = '#e8ecf0';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let wx = xMin; wx <= xMax; wx += step) {
    const p = worldToCanvas(wx, 0, view, rect);
    ctx.moveTo(p.x, y);
    ctx.lineTo(p.x, y + h);
  }
  for (let wy = yMin; wy <= yMax; wy += step) {
    const p = worldToCanvas(0, wy, view, rect);
    ctx.moveTo(x, p.y);
    ctx.lineTo(x + w, p.y);
  }
  ctx.stroke();

  // Major grid lines (integer coordinates)
  const majorStep = step < 1 ? 1 : step * 2;
  ctx.strokeStyle = '#d0d5dc';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  for (let wx = Math.floor(xMin / majorStep) * majorStep; wx <= xMax; wx += majorStep) {
    const p = worldToCanvas(wx, 0, view, rect);
    ctx.moveTo(p.x, y);
    ctx.lineTo(p.x, y + h);
  }
  for (let wy = Math.floor(yMin / majorStep) * majorStep; wy <= yMax; wy += majorStep) {
    const p = worldToCanvas(0, wy, view, rect);
    ctx.moveTo(x, p.y);
    ctx.lineTo(x + w, p.y);
  }
  ctx.stroke();

  // Axes
  const origin = worldToCanvas(0, 0, view, rect);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // X axis
  ctx.moveTo(x, origin.y);
  ctx.lineTo(x + w, origin.y);
  // Y axis
  ctx.moveTo(origin.x, y);
  ctx.lineTo(origin.x, y + h);
  ctx.stroke();

  // Axis arrows
  ctx.fillStyle = '#333';
  // X arrow
  const xEnd = worldToCanvas(xMax, 0, view, rect);
  ctx.beginPath();
  ctx.moveTo(xEnd.x - 8, xEnd.y - 4);
  ctx.lineTo(xEnd.x, xEnd.y);
  ctx.lineTo(xEnd.x - 8, xEnd.y + 4);
  ctx.fill();
  // Y arrow
  const yEnd = worldToCanvas(0, yMax, view, rect);
  ctx.beginPath();
  ctx.moveTo(yEnd.x - 4, yEnd.y + 8);
  ctx.lineTo(yEnd.x, yEnd.y);
  ctx.lineTo(yEnd.x + 4, yEnd.y + 8);
  ctx.fill();

  // Axis labels
  ctx.fillStyle = '#555';
  ctx.font = '12px "SF Mono","Fira Code",monospace';
  ctx.textAlign = 'center';
  ctx.fillText('x', xEnd.x - 4, xEnd.y - 10);
  ctx.fillText('y', yEnd.x + 14, yEnd.y + 4);

  // Tick labels on axes
  ctx.fillStyle = '#888';
  ctx.font = '10px "SF Mono","Fira Code",monospace';
  for (let wx = Math.ceil(xMin); wx <= xMax; wx += majorStep) {
    if (wx === 0) continue;
    const p = worldToCanvas(wx, 0, view, rect);
    ctx.textAlign = 'center';
    ctx.fillText(wx, p.x, Math.min(y + h - 2, origin.y + 14));
  }
  for (let wy = Math.ceil(yMin); wy <= yMax; wy += majorStep) {
    if (wy === 0) continue;
    const p = worldToCanvas(0, wy, view, rect);
    ctx.textAlign = 'right';
    ctx.fillText(wy, Math.max(x + 2, origin.x - 6), p.y + 4);
  }

  // Origin label
  ctx.fillStyle = '#555';
  ctx.font = 'bold 11px "SF Mono","Fira Code",monospace';
  ctx.textAlign = 'right';
  ctx.fillText('O', origin.x - 8, origin.y + 14);
}

function drawShape(ctx, vertices, view, rect, color, drawVertices, highlightIdx) {
  if (vertices.length < 2) return;

  const pts = vertices.map(v => worldToCanvas(v.x, v.y, view, rect));

  // Fill
  ctx.fillStyle = color + '20'; // 12% opacity
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();

  // Stroke
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.stroke();

  // Vertex handles
  if (drawVertices) {
    for (let i = 0; i < pts.length; i++) {
      const isHovered = highlightIdx === i;
      const r = isHovered ? 7 : 5;
      ctx.fillStyle = isHovered ? '#ff6b6b' : color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, r, 0, Math.PI*2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Point labels
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px sans-serif';
  for (let i = 0; i < pts.length; i++) {
    const v = vertices[i];
    const label = String.fromCharCode(65 + i); // A, B, C, D
    ctx.textAlign = 'center';
    ctx.fillText(label, pts[i].x, pts[i].y - 12);
  }
}

function drawDivider(ctx, rect) {
  // Draw a subtle divider between left and right views
  const midX = Math.floor(canvas.width / 2);
  ctx.fillStyle = '#d0d5dc';
  ctx.fillRect(midX - 1, 0, 2, canvas.height);
}

function computeLayout() {
  const w = canvas.width;
  const h = canvas.height;
  const midX = Math.floor(w / 2);
  leftRect  = { x: 0, y: 0, w: midX, h };
  rightRect = { x: midX + DIVIDER_WIDTH, y: 0, w: w - midX - DIVIDER_WIDTH, h };
}

function autoFitView() {
  if (!leftRect) return;

  // ── Left view: center on original shape ──
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of shapeVertices) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  const cxL = (minX + maxX) / 2;
  const cyL = (minY + maxY) / 2;
  const spanXL = maxX - minX || 2;
  const spanYL = maxY - minY || 2;

  // ── Right view: center on TRANSFORMED shape ──
  const M = buildFullMatrix();
  const tVerts = shapeVertices.map(v => applyTransform(M, v.x, v.y));
  minX = Infinity; maxX = -Infinity; minY = Infinity; maxY = -Infinity;
  for (const v of tVerts) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
  }
  const cxR = (minX + maxX) / 2;
  const cyR = (minY + maxY) / 2;
  const spanXR = maxX - minX || 2;
  const spanYR = maxY - minY || 2;

  // Use the larger span across both views for consistent scale
  const spanX = Math.max(spanXL, spanXR, Math.abs(cxL), Math.abs(cxR));
  const spanY = Math.max(spanYL, spanYR, Math.abs(cyL), Math.abs(cyR));
  const pad = Math.max(spanX, spanY) * 1.2;

  viewLeft.cx = cxL;
  viewLeft.cy = cyL;
  viewLeft.scale = Math.min(
    (leftRect.w * 0.65) / (spanX + pad * 2),
    (leftRect.h * 0.65) / (spanY + pad * 2)
  );

  viewRight.cx = cxR;
  viewRight.cy = cyR;
  viewRight.scale = viewLeft.scale;
}

function renderAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  computeLayout();

  // Left view — Original
  drawGrid(ctx, leftRect, viewLeft);
  drawShape(ctx, shapeVertices, viewLeft, leftRect, '#4D96FF', true, hoveredVertex && hoveredVertex.side === 'left' ? hoveredVertex.idx : -1);
  ctx.fillStyle = '#4D96FF';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('原始图形', leftRect.x + 10, leftRect.y + 20);

  // Right view — Transformed
  drawGrid(ctx, rightRect, viewRight);

  // Build full projective matrix
  const M = buildFullMatrix();
  const transformedVertices = shapeVertices.map(v => applyTransform(M, v.x, v.y));
  drawShape(ctx, transformedVertices, viewRight, rightRect, '#FF6B6B', true, hoveredVertex && hoveredVertex.side === 'right' ? hoveredVertex.idx : -1);
  ctx.fillStyle = '#FF6B6B';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('变换后图形', rightRect.x + 10, rightRect.y + 20);

  // Draw divider
  drawDivider(ctx);

  // Update matrix display text
  updateMatrixDisplay();
}

function buildFullMatrix() {
  const M = [...transformMatrix];
  if (projectiveMode) {
    M[6] = projectiveG;
    M[7] = projectiveH;
  }
  return M;
}

/* ═══════════════════════════════════════════
   MATRIX DISPLAY
   ═══════════════════════════════════════════ */

function updateMatrixDisplay() {
  const el = document.getElementById('matrixDisplay');
  if (!el) return;
  const [a,b,tx, c,d,ty, g,h,w] = buildFullMatrix();
  const fmt = (v) => {
    if (Math.abs(v) < 1e-10) return '0';
    return parseFloat(v.toFixed(3)).toString();
  };
  el.innerHTML =
    `<table class="matrix-table">
      <tr><td>${fmt(a)}</td><td>${fmt(b)}</td><td>${fmt(tx)}</td></tr>
      <tr><td>${fmt(c)}</td><td>${fmt(d)}</td><td>${fmt(ty)}</td></tr>
      <tr><td>${fmt(g)}</td><td>${fmt(h)}</td><td>${fmt(w)}</td></tr>
    </table>`;
}

/* ═══════════════════════════════════════════
   SLIDER SYNC
   ═══════════════════════════════════════════ */

function updateSlidersFromMatrix() {
  const [a,b,tx, c,d,ty, g,h,w] = transformMatrix;
  setSlider('slA', a); setSlider('slB', b); setSlider('slTx', tx);
  setSlider('slC', c); setSlider('slD', d); setSlider('slTy', ty);
  setSlider('slG', projectiveG); setSlider('slH', projectiveH);
  updateSliderLabels();
}

function setSlider(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function readSliders() {
  transformMatrix[0] = parseFloat(document.getElementById('slA').value);
  transformMatrix[1] = parseFloat(document.getElementById('slB').value);
  transformMatrix[2] = parseFloat(document.getElementById('slTx').value);
  transformMatrix[3] = parseFloat(document.getElementById('slC').value);
  transformMatrix[4] = parseFloat(document.getElementById('slD').value);
  transformMatrix[5] = parseFloat(document.getElementById('slTy').value);
  projectiveG = parseFloat(document.getElementById('slG')?.value || 0);
  projectiveH = parseFloat(document.getElementById('slH')?.value || 0);
}

function updateSliderLabels() {
  const ids = ['slA','slB','slTx','slC','slD','slTy','slG','slH'];
  for (const id of ids) {
    const label = document.getElementById(id + 'Val');
    const slider = document.getElementById(id);
    if (label && slider) label.textContent = parseFloat(slider.value).toFixed(2);
  }
}

function onSliderInput() {
  readSliders();
  updateSliderLabels();
  updateMatrixDisplay();
  autoFitView();
  renderAll();
}

/* ═══════════════════════════════════════════
   MOUSE INTERACTION
   ═══════════════════════════════════════════ */

function getClickTarget(e) {
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const cy = (e.clientY - rect.top) * (canvas.height / rect.height);

  // Determine which side
  const midX = Math.floor(canvas.width / 2);
  const side = cx < midX ? 'left' : 'right';
  const viewRect = side === 'left' ? leftRect : rightRect;
  const view = side === 'left' ? viewLeft : viewRight;
  const world = canvasToWorld(cx, cy, view, viewRect);

  // Check if click is near a vertex
  const vertices = side === 'left'
    ? shapeVertices
    : shapeVertices.map(v => applyTransform(buildFullMatrix(), v.x, v.y));
  const threshold = 12 / view.scale; // 12 pixels in world units
  let vertexIdx = -1;
  for (let i = 0; i < vertices.length; i++) {
    const dx = world.x - vertices[i].x;
    const dy = world.y - vertices[i].y;
    if (Math.sqrt(dx*dx + dy*dy) < threshold) {
      vertexIdx = i;
      break;
    }
  }

  return { side, world, vertexIdx, cx, cy };
}

function onPointerDown(e) {
  if (e.button === 2) {
    // Right click — start pan
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const midX = Math.floor(canvas.width / 2);
    const side = cx < midX ? 'left' : 'right';
    panning = {
      side,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startCx: side === 'left' ? viewLeft.cx : viewRight.cx,
      startCy: side === 'left' ? viewLeft.cy : viewRight.cy
    };
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button !== 0) return;

  const target = getClickTarget(e);

  if (target.vertexIdx >= 0) {
    dragging = { side: target.side, idx: target.vertexIdx };
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  }
}

function onPointerMove(e) {
  if (panning) {
    const dx = (e.clientX - panning.startClientX) * (canvas.width / canvas.getBoundingClientRect().width);
    const dy = (e.clientY - panning.startClientY) * (canvas.height / canvas.getBoundingClientRect().height);
    const view = panning.side === 'left' ? viewLeft : viewRight;
    view.cx = panning.startCx - dx / view.scale;
    view.cy = panning.startCy + dy / view.scale;
    renderAll();
    return;
  }

  if (dragging) {
    const target = getClickTarget(e);
    if (dragging.side === 'left') {
      // Move the original shape vertex
      shapeVertices[dragging.idx].x = target.world.x;
      shapeVertices[dragging.idx].y = target.world.y;
    } else {
      // Move the transformed vertex — need to inverse-transform
      const M = buildFullMatrix();
      const inv = matInv(M);
      if (inv) {
        const orig = applyTransform(inv, target.world.x, target.world.y);
        shapeVertices[dragging.idx].x = orig.x;
        shapeVertices[dragging.idx].y = orig.y;
      }
    }
    renderAll();
    return;
  }

  // Hover detection
  const target = getClickTarget(e);
  if (target.vertexIdx >= 0) {
    hoveredVertex = { side: target.side, idx: target.vertexIdx };
    canvas.style.cursor = 'grab';
  } else {
    hoveredVertex = null;
    canvas.style.cursor = '';
  }
  renderAll();
}

function onPointerUp(e) {
  dragging = null;
  panning = null;
  canvas.style.cursor = hoveredVertex ? 'grab' : '';
  renderAll();
}

function onWheel(e) {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const midX = Math.floor(canvas.width / 2);
  const side = cx < midX ? 'left' : 'right';
  const view = side === 'left' ? viewLeft : viewRight;

  const zoom = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  view.scale *= zoom;
  view.scale = Math.max(5, Math.min(200, view.scale));
  renderAll();
}

/* ═══════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════ */

function init() {
  canvas = document.getElementById('affineCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  // Size canvas to fill container
  function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    let w = rect.width;
    let h = rect.height;
    if (w <= 0) w = container.clientWidth || window.innerWidth - 280;
    if (h <= 0) h = container.clientHeight || window.innerHeight - 200;
    if (w <= 0) w = 800;
    if (h <= 0) h = 500;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    computeLayout();
    autoFitView();
    renderAll();
  }

  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); });

  // Mouse events
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Preset buttons
  const presetContainer = document.getElementById('affinePresets');
  if (presetContainer) {
    for (const preset of PRESETS) {
      const btn = document.createElement('button');
      btn.className = 'affine-preset-btn';
      btn.textContent = preset.name;
      btn.addEventListener('click', () => {
        transformMatrix = [...preset.mat];
        updateSlidersFromMatrix();
        autoFitView();
        renderAll();
      });
      presetContainer.appendChild(btn);
    }
  }

  // Slider events
  document.querySelectorAll('.affine-slider').forEach(slider => {
    slider.addEventListener('input', onSliderInput);
  });

  // Projective toggle
  const projToggle = document.getElementById('projToggle');
  const projRow = document.getElementById('projRow');
  if (projToggle && projRow) {
    projToggle.addEventListener('change', () => {
      projectiveMode = projToggle.checked;
      projRow.style.display = projectiveMode ? '' : 'none';
      readSliders();
      updateMatrixDisplay();
      renderAll();
    });
  }

  // Reset button
  const resetBtn = document.getElementById('affineReset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      transformMatrix = matIdentity();
      shapeVertices = defaultShape.map(v => ({...v}));
      projectiveG = 0; projectiveH = 0;
      projectiveMode = false;
      if (projToggle) projToggle.checked = false;
      if (projRow) projRow.style.display = 'none';
      updateSlidersFromMatrix();
      autoFitView();
      renderAll();
    });
  }

  // Reset view button
  const resetViewBtn = document.getElementById('affineResetView');
  if (resetViewBtn) {
    resetViewBtn.addEventListener('click', () => {
      autoFitView();
      renderAll();
    });
  }

  // Initial render
  updateSlidersFromMatrix();
  autoFitView();
  renderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
