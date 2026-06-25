/**
 * Inversion Workbench — 反演操作台 (Geometer's Sketchpad style)
 */

/* ═══════════════════ MATH ═══════════════════ */

function invert(x, y, cx, cy, R) {
  const dx = x - cx, dy = y - cy, d2 = dx*dx + dy*dy;
  if (d2 < 1e-10) return null;
  const k = R*R / d2;
  return { x: cx + dx*k, y: cy + dy*k };
}

/* ═══════════════════ STATE ═══════════════════ */

const state = {
  cx: 0, cy: 0, R: 2,
  objects: [],
  nextId: 1,
  view: { cx: 0, cy: 0, scale: 40 },
  // Tool system
  tool: 'select',    // 'select' | 'point' | 'segment' | 'circle' | 'invCenter'
  selected: null,    // { type:'object', objId } or { type:'invCenter' } or { type:'invRadius' } or null
  // Interaction
  drag: null,        // { type:'move'|'pan'|'create', ... }
  hover: null,
  // Segment/circle construction state
  constructing: null, // { step:1|2, p1:{x,y} } for segment, or { step:1, center:{x,y} } for circle
  // Inv center placement state
  placingCenter: false,
};

const C = {
  orig: '#4D96FF', inv: '#FF6B6B', invCircle: '#9B59B6',
  center: '#e74c3c', select: '#FFD700',
  grid: '#e8ecf0', axis: '#333',
};

let canvas, ctx, W, H;

/* ═══════════════════ COORDS ═══════════════════ */

function w2s(wx, wy) {
  return { x: W/2 + (wx-state.view.cx)*state.view.scale, y: H/2 - (wy-state.view.cy)*state.view.scale };
}
function s2w(sx, sy) {
  return { x: state.view.cx + (sx-W/2)/state.view.scale, y: state.view.cy - (sy-H/2)/state.view.scale };
}

function evWorld(e) {
  const r = canvas.getBoundingClientRect();
  return s2w((e.clientX-r.left)*(W/r.width), (e.clientY-r.top)*(H/r.height));
}
function evScreen(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX-r.left)*(W/r.width), y: (e.clientY-r.top)*(H/r.height) };
}

/* ═══════════════════ HIT TEST ═══════════════════ */

function hitTest(world, screen) {
  const thr = 12 / state.view.scale;

  // Radius handle on inv circle (only when inv circle tool or select tool)
  const cS = w2s(state.cx, state.cy);
  const hx = cS.x + state.R*state.view.scale;
  const hy = cS.y;
  if (Math.hypot(screen.x-hx, screen.y-hy) < 14) {
    return { type: 'invRadius' };
  }

  // Inv center
  if (Math.hypot(screen.x-cS.x, screen.y-cS.y) < 12) {
    return { type: 'invCenter' };
  }

  // Objects
  for (let i = state.objects.length-1; i >= 0; i--) {
    const o = state.objects[i];
    if (o.type === 'point' && Math.hypot(world.x-o.x, world.y-o.y) < thr)
      return { type: 'object', objId: o.id };
    if (o.type === 'segment') {
      if (Math.hypot(world.x-o.p1.x, world.y-o.p1.y) < thr) return { type: 'object', objId: o.id, sub: 'p1' };
      if (Math.hypot(world.x-o.p2.x, world.y-o.p2.y) < thr) return { type: 'object', objId: o.id, sub: 'p2' };
    }
    if (o.type === 'circle' && Math.hypot(world.x-o.center.x, world.y-o.center.y) < thr)
      return { type: 'object', objId: o.id, sub: 'center' };
  }

  return null;
}

/* ═══════════════════ TOOLBAR ═══════════════════ */

function setTool(t) {
  state.tool = t;
  state.selected = null;
  state.constructing = null;
  state.placingCenter = false;

  // Update toolbar active state
  document.querySelectorAll('.inv-tool-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('invTool_' + t);
  if (btn) btn.classList.add('active');

  // Cursor
  canvas.style.cursor = t === 'select' ? '' : 'crosshair';
  drawAll();
}

/* ═══════════════════ DRAWING ═══════════════════ */

function drawGrid() {
  ctx.fillStyle = '#fafbfc'; ctx.fillRect(0,0,W,H);
  const tl = s2w(0,0), br = s2w(W,H);
  const xMin = Math.floor(Math.min(tl.x,br.x)), xMax = Math.ceil(Math.max(tl.x,br.x));
  const yMin = Math.floor(Math.min(tl.y,br.y)), yMax = Math.ceil(Math.max(tl.y,br.y));
  const step = state.view.scale>60?0.5: state.view.scale>30?1: state.view.scale>12?2:5;

  ctx.strokeStyle = C.grid; ctx.lineWidth = 0.5; ctx.beginPath();
  for (let x = Math.floor(xMin/step)*step; x <= xMax; x+=step) {
    const p = w2s(x,0); ctx.moveTo(p.x,0); ctx.lineTo(p.x,H);
  }
  for (let y = Math.floor(yMin/step)*step; y <= yMax; y+=step) {
    const p = w2s(0,y); ctx.moveTo(0,p.y); ctx.lineTo(W,p.y);
  }
  ctx.stroke();

  const O = w2s(0,0);
  ctx.strokeStyle = C.axis; ctx.lineWidth = 1.2; ctx.beginPath();
  ctx.moveTo(0,O.y); ctx.lineTo(W,O.y);
  ctx.moveTo(O.x,0); ctx.lineTo(O.x,H);
  ctx.stroke();

  const mstep = step<1?1:step*2;
  ctx.fillStyle = '#888'; ctx.font = '10px monospace';
  for (let x = Math.ceil(xMin); x<=xMax; x+=mstep) {
    if (x===0) continue; const p = w2s(x,0);
    ctx.textAlign = 'center'; ctx.fillText(x, p.x, Math.min(H-2,O.y+14));
  }
  for (let y = Math.ceil(yMin); y<=yMax; y+=mstep) {
    if (y===0) continue; const p = w2s(0,y);
    ctx.textAlign = 'right'; ctx.fillText(y, Math.max(2,O.x-6), p.y+4);
  }
  ctx.fillStyle = '#555'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right';
  ctx.fillText('O', O.x-8, O.y+14);
}

function glow(x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, r*0.3, x, y, r*2.5);
  g.addColorStop(0, color); g.addColorStop(1, 'transparent');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r*2.5, 0, Math.PI*2); ctx.fill();
}

function dot(x, y, r, color, selected) {
  const s = w2s(x, y);
  if (selected) glow(s.x, s.y, r, C.select);
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
}

function drawSegment(p1, p2, color, width) {
  const a = w2s(p1.x, p1.y), b = w2s(p2.x, p2.y);
  ctx.strokeStyle = color; ctx.lineWidth = width || 2.5; ctx.beginPath();
  ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
}

function drawInvertedSegment(p1, p2) {
  const N = 100; ctx.strokeStyle = C.inv; ctx.lineWidth = 2.5; ctx.beginPath();
  let started = false;
  for (let i = 0; i <= N; i++) {
    const t = i/N, inv = invert(p1.x+(p2.x-p1.x)*t, p1.y+(p2.y-p1.y)*t, state.cx, state.cy, state.R);
    if (!inv) { started = false; continue; }
    const s = w2s(inv.x, inv.y);
    if (!started) { ctx.moveTo(s.x, s.y); started = true; }
    else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
}

function drawCircle(center, radius, color, dashed) {
  const s = w2s(center.x, center.y);
  ctx.strokeStyle = color; ctx.lineWidth = 2.5;
  if (dashed) ctx.setLineDash([5,4]);
  ctx.beginPath(); ctx.arc(s.x, s.y, radius*state.view.scale, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
}

function drawInvertedCircle(center, radius) {
  const N = 120; ctx.strokeStyle = C.inv; ctx.lineWidth = 2.5; ctx.beginPath();
  let started = false;
  for (let i = 0; i <= N; i++) {
    const a = (i/N)*Math.PI*2;
    const inv = invert(center.x+radius*Math.cos(a), center.y+radius*Math.sin(a), state.cx, state.cy, state.R);
    if (!inv) { started = false; continue; }
    const s = w2s(inv.x, inv.y);
    if (!started) { ctx.moveTo(s.x, s.y); started = true; }
    else ctx.lineTo(s.x, s.y);
  }
  ctx.stroke();
}

function drawAll() {
  ctx.clearRect(0,0,W,H);
  drawGrid();

  // Inversion circle
  const cS = w2s(state.cx, state.cy), rPx = state.R*state.view.scale;
  ctx.strokeStyle = C.invCircle; ctx.lineWidth = 2; ctx.setLineDash([6,3]);
  ctx.beginPath(); ctx.arc(cS.x, cS.y, rPx, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);

  // Center dot (selectable)
  const cSel = state.selected && state.selected.type === 'invCenter';
  dot(state.cx, state.cy, cSel?7:5, C.center, cSel);

  // Radius handle
  const hx = cS.x + rPx, hy = cS.y;
  const rSel = state.selected && state.selected.type === 'invRadius';
  if (rSel) glow(hx, hy, 6, C.select);
  ctx.fillStyle = rSel ? '#ff6b6b' : C.invCircle; ctx.beginPath();
  ctx.arc(hx, hy, 6, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();

  // Objects
  for (const o of state.objects) {
    const sel = state.selected && state.selected.objId === o.id;
    switch (o.type) {
      case 'point': {
        dot(o.x, o.y, sel?7:5, C.orig, sel);
        if (sel) glow(w2s(o.x,o.y).x, w2s(o.x,o.y).y, 5, C.select);
        const inv = invert(o.x, o.y, state.cx, state.cy, state.R);
        if (inv) dot(inv.x, inv.y, 4, C.inv, false);
        // Ray
        const ps = w2s(o.x, o.y);
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.beginPath();
        ctx.moveTo(cS.x, cS.y);
        const dx=ps.x-cS.x, dy=ps.y-cS.y, L=Math.sqrt(dx*dx+dy*dy)||1;
        ctx.lineTo(ps.x+dx/L*2000, ps.y+dy/L*2000); ctx.stroke();
        break;
      }
      case 'segment':
        drawSegment(o.p1, o.p2, C.orig, sel?3.5:2.5);
        drawInvertedSegment(o.p1, o.p2);
        dot(o.p1.x, o.p1.y, sel&&state.selected.sub==='p1'?7:5, C.orig, sel&&state.selected.sub==='p1');
        dot(o.p2.x, o.p2.y, sel&&state.selected.sub==='p2'?7:5, C.orig, sel&&state.selected.sub==='p2');
        break;
      case 'circle':
        drawCircle(o.center, o.radius, C.orig);
        drawInvertedCircle(o.center, o.radius);
        dot(o.center.x, o.center.y, sel&&state.selected.sub==='center'?7:5, C.orig, sel&&state.selected.sub==='center');
        break;
    }
  }

  // Construction preview
  if (state.constructing) {
    const p = state.constructing;
    if (p.p1) dot(p.p1.x, p.p1.y, 5, C.orig, false);
  }
}

/* ═══════════════════ ACTIONS ═══════════════════ */

function deleteSelected() {
  if (!state.selected) return;
  if (state.selected.type === 'object') {
    state.objects = state.objects.filter(o => o.id !== state.selected.objId);
  }
  state.selected = null;
  state.constructing = null;
  drawAll();
}

function clearAll() {
  if (state.objects.length && !confirm('清空所有图形？')) return;
  state.objects = []; state.selected = null; state.constructing = null; drawAll();
}

function fitView() {
  state.view.cx = state.cx; state.view.cy = state.cy;
  state.view.scale = Math.min(W,H) / (state.R*4);
  state.view.scale = Math.max(10, Math.min(150, state.view.scale));
  drawAll();
}

/* ═══════════════════ POINTER EVENTS ═══════════════════ */

function onPointerDown(e) {
  if (e.button === 2) {
    state.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, scx: state.view.cx, scy: state.view.cy };
    return;
  }
  if (e.button !== 0) return;

  const world = evWorld(e);
  const screen = evScreen(e);
  const hit = hitTest(world, screen);

  // ── SELECT tool ──
  if (state.tool === 'select') {
    if (hit) {
      state.selected = hit;
      // Start drag
      if (hit.type === 'invRadius') {
        state.drag = { type: 'resizeRadius' };
      } else if (hit.type === 'invCenter') {
        state.drag = { type: 'moveInvCenter' };
      } else if (hit.type === 'object') {
        state.drag = { type: 'moveVertex', objId: hit.objId, sub: hit.sub };
      }
    } else {
      state.selected = null;
      state.constructing = null;
      // Start pan on empty space
      state.drag = { type: 'pan', sx: e.clientX, sy: e.clientY, scx: state.view.cx, scy: state.view.cy };
    }
    drawAll();
    return;
  }

  // ── POINT tool ──
  if (state.tool === 'point') {
    const id = state.nextId++;
    const label = String.fromCharCode(65 + ((id-1)%26));
    state.objects.push({ type:'point', id, x:world.x, y:world.y, label });
    state.selected = { type:'object', objId:id };
    drawAll();
    return;
  }

  // ── SEGMENT tool ──
  if (state.tool === 'segment') {
    if (!state.constructing) {
      state.constructing = { p1: { x:world.x, y:world.y } };
    } else {
      const id = state.nextId++;
      state.objects.push({
        type:'segment', id,
        p1: {...state.constructing.p1},
        p2: { x:world.x, y:world.y },
        label1: String.fromCharCode(65+((id*2-1)%26)),
        label2: String.fromCharCode(65+((id*2)%26))
      });
      state.selected = { type:'object', objId:id };
      state.constructing = null;
    }
    drawAll();
    return;
  }

  // ── CIRCLE tool ──
  if (state.tool === 'circle') {
    if (!state.constructing) {
      state.constructing = { center: { x:world.x, y:world.y } };
    } else {
      const id = state.nextId++;
      const r = Math.hypot(world.x-state.constructing.center.x, world.y-state.constructing.center.y);
      state.objects.push({ type:'circle', id, center: {...state.constructing.center}, radius: r });
      state.selected = { type:'object', objId:id, sub:'center' };
      state.constructing = null;
    }
    drawAll();
    return;
  }

  // ── INV CENTER tool ──
  if (state.tool === 'invCenter') {
    state.cx = world.x; state.cy = world.y;
    state.selected = { type: 'invRadius' };
    state.drag = { type: 'resizeRadius' };
    updateSliders();
    drawAll();
    return;
  }
}

function onPointerMove(e) {
  const world = evWorld(e);
  const screen = evScreen(e);

  if (state.drag) {
    if (state.drag.type === 'pan') {
      const dx = (e.clientX - state.drag.sx) / state.view.scale;
      const dy = (e.clientY - state.drag.sy) / state.view.scale;
      state.view.cx = state.drag.scx - dx;
      state.view.cy = state.drag.scy + dy;
    } else if (state.drag.type === 'resizeRadius') {
      state.R = Math.max(0.2, Math.hypot(world.x-state.cx, world.y-state.cy));
      updateSliders();
    } else if (state.drag.type === 'moveInvCenter') {
      state.cx = world.x; state.cy = world.y;
      updateSliders();
    } else if (state.drag.type === 'moveVertex') {
      const obj = state.objects.find(o => o.id === state.drag.objId);
      if (!obj) return;
      if (obj.type === 'point') { obj.x = world.x; obj.y = world.y; }
      else if (!state.drag.sub) { /* whole object move → translate */ }
      else if (state.drag.sub === 'p1') { obj.p1.x = world.x; obj.p1.y = world.y; }
      else if (state.drag.sub === 'p2') { obj.p2.x = world.x; obj.p2.y = world.y; }
      else if (state.drag.sub === 'center') { obj.center.x = world.x; obj.center.y = world.y; }
    }
    drawAll();
    return;
  }

  // Hover
  const hit = hitTest(world, screen);
  state.hover = hit;
  canvas.style.cursor = hit ? (state.tool==='select'?'grab':'pointer') : (state.tool==='select'?'':'crosshair');
  drawAll();
}

function onPointerUp(e) {
  state.drag = null;
  drawAll();
}

function onWheel(e) {
  e.preventDefault();
  const zoom = e.deltaY < 0 ? 1.15 : 1/1.15;
  state.view.scale *= zoom;
  state.view.scale = Math.max(5, Math.min(200, state.view.scale));
  drawAll();
}

/* ═══════════════════ KEYBOARD ═══════════════════ */

function onKeyDown(e) {
  if (e.target.tagName === 'INPUT') return;
  switch (e.key) {
    case 'Delete': case 'Backspace': deleteSelected(); break;
    case 'Escape':
      state.selected = null; state.constructing = null;
      setTool('select'); drawAll(); break;
    case 'v': case 'V': setTool('select'); break;
    case 'p': case 'P': setTool('point'); break;
    case 's': case 'S': setTool('segment'); break;
    case 'c': case 'C': setTool('circle'); break;
    case 'i': case 'I': setTool('invCenter'); break;
    case 'f': case 'F': fitView(); break;
  }
}

/* ═══════════════════ SLIDERS ═══════════════════ */

function updateSliders() {
  const els = { slICX: state.cx, slICY: state.cy, slIR: state.R };
  for (const [id, val] of Object.entries(els)) {
    const el = document.getElementById(id);
    if (el) el.value = val;
    const lbl = document.getElementById(id+'Val');
    if (lbl) lbl.textContent = val.toFixed(1);
  }
}

function onSliderInput() {
  state.cx = parseFloat(document.getElementById('slICX').value);
  state.cy = parseFloat(document.getElementById('slICY').value);
  state.R  = parseFloat(document.getElementById('slIR').value);
  updateSliders();
  drawAll();
}

/* ═══════════════════ INIT ═══════════════════ */

function resize() {
  const rect = canvas.parentElement.getBoundingClientRect();
  W = rect.width || window.innerWidth-280 || 800;
  H = rect.height || window.innerHeight-150 || 500;
  canvas.width = W; canvas.height = H;
  canvas.style.width = W+'px'; canvas.style.height = H+'px';
}

function initInversion() {
  canvas = document.getElementById('invCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  resize();
  window.addEventListener('resize', () => { resize(); drawAll(); });

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);

  // Toolbar buttons
  const tools = ['select','point','segment','circle','invCenter'];
  for (const t of tools) {
    const btn = document.getElementById('invTool_'+t);
    if (btn) btn.addEventListener('click', () => setTool(t));
  }

  // Sliders
  document.getElementById('slICX').addEventListener('input', onSliderInput);
  document.getElementById('slICY').addEventListener('input', onSliderInput);
  document.getElementById('slIR').addEventListener('input', onSliderInput);

  // Buttons
  document.getElementById('invClear').addEventListener('click', clearAll);
  document.getElementById('invDelete').addEventListener('click', deleteSelected);
  document.getElementById('invFitView').addEventListener('click', fitView);

  setTool('invCenter');
  updateSliders();
  fitView();
  drawAll();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initInversion);
else initInversion();
