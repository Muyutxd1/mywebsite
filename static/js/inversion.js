/**
 * Inversion Workbench — 反演操作台
 * Standalone circle-inversion geometry explorer.
 */

/* ═══════════════════════════════════════════
   INVERSION MATH
   ═══════════════════════════════════════════ */

function invert(x, y, cx, cy, R) {
  const dx = x - cx, dy = y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-10) return null; // center → infinity
  const k = R * R / d2;
  return { x: cx + dx * k, y: cy + dy * k };
}

/* ═══════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════ */

let state = {
  cx: 0, cy: 0, R: 2,          // inversion circle
  mode: 'center',              // 'center' | 'place' | 'drag'
  objects: [],                 // { type:'point'|'segment'|'circle', id, data... }
  placing: null,               // temporary state while placing (segment needs 2 clicks)
  nextId: 1,
  view: { cx: 0, cy: 0, scale: 40 },
  dragging: null,              // { objId, prop:'x'|'y'|... } or { target:'center'|'radius' }
  panning: null,
  hovered: null,
};

const COLORS = {
  original: '#4D96FF',
  inverted: '#FF6B6B',
  inversionCircle: '#9B59B6',
  center: '#e74c3c',
  grid: '#e8ecf0',
  gridMajor: '#d0d5dc',
  axis: '#333',
};

let canvas, ctx, w, h;

/* ═══════════════════════════════════════════
   COORDINATE HELPERS
   ═══════════════════════════════════════════ */

function worldToScreen(wx, wy) {
  return {
    x: w/2 + (wx - state.view.cx) * state.view.scale,
    y: h/2 - (wy - state.view.cy) * state.view.scale
  };
}

function screenToWorld(sx, sy) {
  return {
    x: state.view.cx + (sx - w/2) / state.view.scale,
    y: state.view.cy - (sy - h/2) / state.view.scale
  };
}

/* ═══════════════════════════════════════════
   RENDERING
   ═══════════════════════════════════════════ */

function drawGrid() {
  // Background
  ctx.fillStyle = '#fafbfc';
  ctx.fillRect(0, 0, w, h);

  const tl = screenToWorld(0, 0);
  const br = screenToWorld(w, h);
  const xMin = Math.floor(Math.min(tl.x, br.x));
  const xMax = Math.ceil(Math.max(tl.x, br.x));
  const yMin = Math.floor(Math.min(tl.y, br.y));
  const yMax = Math.ceil(Math.max(tl.y, br.y));

  const step = state.view.scale > 60 ? 0.5 : state.view.scale > 30 ? 1 : state.view.scale > 12 ? 2 : 5;

  // Minor grid
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let wx = Math.floor(xMin / step) * step; wx <= xMax; wx += step) {
    const p = worldToScreen(wx, 0);
    ctx.moveTo(p.x, 0); ctx.lineTo(p.x, h);
  }
  for (let wy = Math.floor(yMin / step) * step; wy <= yMax; wy += step) {
    const p = worldToScreen(0, wy);
    ctx.moveTo(0, p.y); ctx.lineTo(w, p.y);
  }
  ctx.stroke();

  // Axes
  const O = worldToScreen(0, 0);
  ctx.strokeStyle = COLORS.axis;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, O.y); ctx.lineTo(w, O.y);
  ctx.moveTo(O.x, 0); ctx.lineTo(O.x, h);
  ctx.stroke();

  // Tick labels
  const majorStep = step < 1 ? 1 : step * 2;
  ctx.fillStyle = '#888';
  ctx.font = '10px monospace';
  for (let wx = Math.ceil(xMin); wx <= xMax; wx += majorStep) {
    if (wx === 0) continue;
    const p = worldToScreen(wx, 0);
    ctx.textAlign = 'center';
    ctx.fillText(wx, p.x, Math.min(h - 2, O.y + 14));
  }
  for (let wy = Math.ceil(yMin); wy <= yMax; wy += majorStep) {
    if (wy === 0) continue;
    const p = worldToScreen(0, wy);
    ctx.textAlign = 'right';
    ctx.fillText(wy, Math.max(2, O.x - 6), p.y + 4);
  }

  // Origin label
  ctx.fillStyle = '#555';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('O', O.x - 8, O.y + 14);
}

function drawInversionCircle() {
  const ctr = worldToScreen(state.cx, state.cy);
  const rPx = state.R * state.view.scale;

  // Dashed circle
  ctx.strokeStyle = COLORS.inversionCircle;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(ctr.x, ctr.y, rPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Center dot
  ctx.fillStyle = COLORS.center;
  ctx.beginPath();
  ctx.arc(ctr.x, ctr.y, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label
  ctx.fillStyle = COLORS.inversionCircle;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`R=${state.R.toFixed(1)}`, ctr.x + rPx + 6, ctr.y - 6);

  // Radius handle (draggable dot on the circle at angle 0)
  const hx = ctr.x + rPx;
  const hy = ctr.y;
  ctx.fillStyle = state.hovered && state.hovered.target === 'radius' ? '#ff6b6b' : COLORS.inversionCircle;
  ctx.beginPath();
  ctx.arc(hx, hy, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawPoint(p, color, label) {
  const s = worldToScreen(p.x, p.y);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (label) {
    ctx.fillStyle = '#333';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, s.x, s.y - 12);
  }
}

function drawSegment(p1, p2, color) {
  const s1 = worldToScreen(p1.x, p1.y);
  const s2 = worldToScreen(p2.x, p2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s1.x, s1.y);
  ctx.lineTo(s2.x, s2.y);
  ctx.stroke();
}

function drawInvertedSegment(p1, p2) {
  // The inverse of a line segment is an arc of a circle (if line doesn't pass through center)
  // Sample points along the line and invert each, then connect
  const N = 80;
  ctx.strokeStyle = COLORS.inverted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const wx = p1.x + (p2.x - p1.x) * t;
    const wy = p1.y + (p2.y - p1.y) * t;
    const inv = invert(wx, wy, state.cx, state.cy, state.R);
    if (inv) {
      const s = worldToScreen(inv.x, inv.y);
      if (!started) { ctx.moveTo(s.x, s.y); started = true; }
      else ctx.lineTo(s.x, s.y);
    } else {
      started = false; // discontinuity at center
    }
  }
  ctx.stroke();
}

function drawCircle(center, radius, color, dashed) {
  const s = worldToScreen(center.x, center.y);
  const rPx = radius * state.view.scale;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(s.x, s.y, rPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawInvertedCircle(center, radius) {
  // The inverse of a circle is another circle (or a line if the circle passes through inversion center)
  // We approximate by sampling points on the circle and inverting each
  const N = 100;
  ctx.strokeStyle = COLORS.inverted;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wx = center.x + radius * Math.cos(a);
    const wy = center.y + radius * Math.sin(a);
    const inv = invert(wx, wy, state.cx, state.cy, state.R);
    if (inv) {
      const s = worldToScreen(inv.x, inv.y);
      if (!started) { ctx.moveTo(s.x, s.y); started = true; }
      else ctx.lineTo(s.x, s.y);
    } else {
      started = false;
    }
  }
  ctx.stroke();
}

function drawAll() {
  ctx.clearRect(0, 0, w, h);
  drawGrid();
  drawInversionCircle();

  for (const obj of state.objects) {
    switch (obj.type) {
      case 'point': {
        const inv = invert(obj.x, obj.y, state.cx, state.cy, state.R);
        // Ray from center through point
        const cS = worldToScreen(state.cx, state.cy);
        const pS = worldToScreen(obj.x, obj.y);
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cS.x, cS.y);
        // Extend ray
        const dx = pS.x - cS.x, dy = pS.y - cS.y;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        ctx.lineTo(pS.x + dx/len * 2000, pS.y + dy/len * 2000);
        ctx.stroke();

        drawPoint(obj, COLORS.original, obj.label || 'P');
        if (inv) drawPoint(inv, COLORS.inverted, obj.label ? obj.label + "'" : "P'");
        break;
      }
      case 'segment': {
        drawSegment(obj.p1, obj.p2, COLORS.original);
        drawInvertedSegment(obj.p1, obj.p2);
        drawPoint(obj.p1, COLORS.original, obj.label1 || 'A');
        drawPoint(obj.p2, COLORS.original, obj.label2 || 'B');
        break;
      }
      case 'circle': {
        drawCircle(obj.center, obj.radius, COLORS.original);
        drawInvertedCircle(obj.center, obj.radius);
        drawPoint(obj.center, COLORS.original, 'C');
        break;
      }
    }
  }

  // Placing preview
  if (state.placing) {
    const p = state.placing;
    if (p.type === 'segment' && p.p1) {
      drawPoint(p.p1, COLORS.original, 'A');
    }
    if (p.type === 'circle' && p.center) {
      drawPoint(p.center, COLORS.original, 'C');
    }
  }

  updateInfoPanel();
}

/* ═══════════════════════════════════════════
   INFO PANEL
   ═══════════════════════════════════════════ */

function updateInfoPanel() {
  const el = document.getElementById('invInfo');
  if (!el) return;
  el.innerHTML =
    `圆心: (${state.cx.toFixed(1)}, ${state.cy.toFixed(1)}) &nbsp;|&nbsp; 半径: ${state.R.toFixed(1)}<br>` +
    `图形: ${state.objects.length} 个 &nbsp;|&nbsp; 模式: ${
      state.mode === 'center' ? '设置圆心' : state.mode === 'place' ? '放置图形' : '拖拽'
    }`;
}

/* ═══════════════════════════════════════════
   MOUSE
   ═══════════════════════════════════════════ */

function getMouseWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return screenToWorld(
    (e.clientX - rect.left) * (w / rect.width),
    (e.clientY - rect.top) * (h / rect.height)
  );
}

function findNearby(e) {
  const world = getMouseWorld(e);
  const threshold = 10 / state.view.scale;

  // Radius handle?
  const cS = worldToScreen(state.cx, state.cy);
  const hx = cS.x + state.R * state.view.scale;
  const hy = cS.y;
  const sx = (e.clientX - canvas.getBoundingClientRect().left) * (w / canvas.getBoundingClientRect().width);
  const sy = (e.clientY - canvas.getBoundingClientRect().top) * (h / canvas.getBoundingClientRect().height);
  if (Math.hypot(sx - hx, sy - hy) < 12) {
    return { target: 'radius' };
  }

  // Object vertices?
  for (const obj of state.objects) {
    if (obj.type === 'point') {
      if (Math.hypot(world.x - obj.x, world.y - obj.y) < threshold)
        return { target: 'vertex', objId: obj.id, prop: 'pos' };
    }
    if (obj.type === 'segment') {
      if (Math.hypot(world.x - obj.p1.x, world.y - obj.p1.y) < threshold)
        return { target: 'vertex', objId: obj.id, prop: 'p1' };
      if (Math.hypot(world.x - obj.p2.x, world.y - obj.p2.y) < threshold)
        return { target: 'vertex', objId: obj.id, prop: 'p2' };
    }
    if (obj.type === 'circle') {
      if (Math.hypot(world.x - obj.center.x, world.y - obj.center.y) < threshold)
        return { target: 'vertex', objId: obj.id, prop: 'center' };
    }
  }

  return null;
}

function onPointerDown(e) {
  if (e.button === 2) {
    state.panning = { sx: e.clientX, sy: e.clientY, scx: state.view.cx, scy: state.view.cy };
    return;
  }
  if (e.button !== 0) return;

  const world = getMouseWorld(e);
  const nearby = findNearby(e);

  if (state.mode === 'drag') {
    if (nearby) {
      state.dragging = nearby;
      return;
    }
  }

  if (state.mode === 'center') {
    if (nearby && nearby.target === 'radius') {
      state.dragging = { target: 'radius' };
      return;
    }
    state.cx = world.x;
    state.cy = world.y;
    updateSliders();
    drawAll();
    return;
  }

  if (state.mode === 'place') {
    if (nearby && nearby.target === 'radius') {
      state.dragging = { target: 'radius' };
      return;
    }

    const shapeType = document.querySelector('input[name="invShape"]:checked')?.value || 'point';

    if (shapeType === 'point') {
      const id = state.nextId++;
      const label = String.fromCharCode(64 + ((id - 1) % 26) + 1);
      state.objects.push({ type: 'point', id, x: world.x, y: world.y, label });
      drawAll();
      return;
    }

    if (shapeType === 'segment') {
      if (!state.placing || state.placing.type !== 'segment') {
        state.placing = { type: 'segment', p1: { x: world.x, y: world.y } };
      } else {
        const id = state.nextId++;
        const label1 = String.fromCharCode(64 + ((id*2-1) % 26) + 1);
        const label2 = String.fromCharCode(64 + ((id*2) % 26) + 1);
        state.objects.push({
          type: 'segment', id,
          p1: { ...state.placing.p1 },
          p2: { x: world.x, y: world.y },
          label1, label2
        });
        state.placing = null;
      }
      drawAll();
      return;
    }

    if (shapeType === 'circle') {
      if (!state.placing || state.placing.type !== 'circle') {
        state.placing = { type: 'circle', center: { x: world.x, y: world.y } };
      } else {
        const id = state.nextId++;
        const r = Math.hypot(world.x - state.placing.center.x, world.y - state.placing.center.y);
        state.objects.push({
          type: 'circle', id,
          center: { ...state.placing.center },
          radius: r
        });
        state.placing = null;
      }
      drawAll();
      return;
    }
  }
}

function onPointerMove(e) {
  if (state.panning) {
    const dx = (e.clientX - state.panning.sx) / state.view.scale;
    const dy = (e.clientY - state.panning.sy) / state.view.scale;
    state.view.cx = state.panning.scx - dx;
    state.view.cy = state.panning.scy + dy;
    drawAll();
    return;
  }

  if (state.dragging) {
    const world = getMouseWorld(e);
    if (state.dragging.target === 'radius') {
      const d = Math.hypot(world.x - state.cx, world.y - state.cy);
      state.R = Math.max(0.2, d);
      updateSliders();
    } else if (state.dragging.target === 'vertex') {
      const obj = state.objects.find(o => o.id === state.dragging.objId);
      if (obj) {
        if (state.dragging.prop === 'pos') { obj.x = world.x; obj.y = world.y; }
        else if (state.dragging.prop === 'p1') { obj.p1.x = world.x; obj.p1.y = world.y; }
        else if (state.dragging.prop === 'p2') { obj.p2.x = world.x; obj.p2.y = world.y; }
        else if (state.dragging.prop === 'center') { obj.center.x = world.x; obj.center.y = world.y; }
      }
    }
    drawAll();
    return;
  }

  state.hovered = findNearby(e);
  canvas.style.cursor = state.hovered ? (state.mode === 'drag' || state.hovered.target === 'radius' ? 'grab' : 'pointer') : '';
}

function onPointerUp(e) {
  state.dragging = null;
  state.panning = null;
  canvas.style.cursor = '';
  drawAll();
}

function onWheel(e) {
  e.preventDefault();
  const zoom = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  state.view.scale *= zoom;
  state.view.scale = Math.max(5, Math.min(200, state.view.scale));
  drawAll();
}

/* ═══════════════════════════════════════════
   SLIDERS
   ═══════════════════════════════════════════ */

function updateSliders() {
  document.getElementById('slICX').value = state.cx;
  document.getElementById('slICY').value = state.cy;
  document.getElementById('slIR').value = state.R;
  document.getElementById('slICXVal').textContent = state.cx.toFixed(1);
  document.getElementById('slICYVal').textContent = state.cy.toFixed(1);
  document.getElementById('slIRVal').textContent = state.R.toFixed(1);
}

function onSliderInput() {
  state.cx = parseFloat(document.getElementById('slICX').value);
  state.cy = parseFloat(document.getElementById('slICY').value);
  state.R  = parseFloat(document.getElementById('slIR').value);
  updateSliders();
  drawAll();
}

/* ═══════════════════════════════════════════
   BUTTONS
   ═══════════════════════════════════════════ */

function clearAll() {
  state.objects = [];
  state.placing = null;
  drawAll();
}

function undoLast() {
  if (state.placing) { state.placing = null; }
  else state.objects.pop();
  drawAll();
}

function fitView() {
  // Center view on inversion circle
  state.view.cx = state.cx;
  state.view.cy = state.cy;
  state.view.scale = Math.min(w, h) / (state.R * 4);
  state.view.scale = Math.max(10, Math.min(150, state.view.scale));
  drawAll();
}

/* ═══════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════ */

function resizeCanvas() {
  const container = canvas.parentElement;
  const rect = container.getBoundingClientRect();
  w = rect.width || container.clientWidth || window.innerWidth - 280 || 800;
  h = rect.height || container.clientHeight || window.innerHeight - 150 || 500;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
}

function initInversion() {
  canvas = document.getElementById('invCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', () => { resizeCanvas(); drawAll(); });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // Mode radios
  document.querySelectorAll('input[name="invMode"]').forEach(r => {
    r.addEventListener('change', () => {
      state.mode = r.value;
      state.placing = null;
      drawAll();
    });
  });

  // Sliders
  document.getElementById('slICX').addEventListener('input', onSliderInput);
  document.getElementById('slICY').addEventListener('input', onSliderInput);
  document.getElementById('slIR').addEventListener('input', onSliderInput);

  // Buttons
  document.getElementById('invClear').addEventListener('click', clearAll);
  document.getElementById('invUndo').addEventListener('click', undoLast);
  document.getElementById('invFitView').addEventListener('click', fitView);

  updateSliders();
  fitView();
  drawAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInversion);
} else {
  initInversion();
}
