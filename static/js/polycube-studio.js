/**
 * 3D Polycube Puzzle Studio
 * Three.js-based interactive 3D tiling tool.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ═══════════════════════════════════════════
   CONSTANTS & STATE
   ═══════════════════════════════════════════ */

const STORAGE_KEY_PC = 'polycube_pieces';
const STORAGE_KEY_BOARD = 'polycube_board';

const PALETTE = [
  '#FF6B6B','#4D96FF','#6BCB77','#FF8E53','#9B59B6',
  '#FFD93D','#FF6FB7','#00D2D3','#F368E0','#54A0FF',
  '#FFA502','#2ED573','#FF4757','#7BED9F','#70A1FF',
  '#FECA57','#5F27CD','#01A3A4','#FF6348','#FF9FF3'
];

const DEFAULT_PIECES = [
  { id: 'b_mono',  name: '单体',     cells: [[0,0,0]], color: '#FF6B6B' },
  { id: 'b_domino',name: '双立方',   cells: [[0,0,0],[0,1,0]], color: '#4D96FF' },
  { id: 'b_L3',    name: 'L-三立方', cells: [[0,0,0],[1,0,0],[1,1,0]], color: '#6BCB77' },
  { id: 'b_I3',    name: 'I-三立方', cells: [[0,0,0],[1,0,0],[2,0,0]], color: '#FF8E53' },
  { id: 'b_cube2', name: '2x2方块',  cells: [[0,0,0],[0,1,0],[1,0,0],[1,1,0]], color: '#9B59B6' },
  { id: 'b_T4',    name: 'T-四立方', cells: [[0,0,0],[0,1,0],[0,2,0],[1,1,0]], color: '#FF6FB7' },
  { id: 'b_L4',    name: 'L-四立方', cells: [[0,0,0],[1,0,0],[2,0,0],[2,1,0]], color: '#00D2D3' },
  { id: 'b_Z4',    name: 'Z-四立方', cells: [[0,0,0],[0,1,0],[1,1,0],[1,2,0]], color: '#FFD93D' },
];

let pieceLibrary = [];
let boardState = { sx: 4, sy: 4, sz: 4, placements: [] };
let activeSelection = null;
let designerCells = [];
let paletteIdx = 0;
let hoveredCell = null;
let placementValid = false;

/* ═══════════════════════════════════════════
   3D ROTATIONS (24 cube orientations)
   ═══════════════════════════════════════════ */

function matMul(a, b) {
  const r = [[0,0,0],[0,0,0],[0,0,0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++)
        r[i][j] += a[i][k] * b[k][j];
  return r;
}

function rotX90(n) {
  const c = [1,0,-1,0][n], s = [0,1,0,-1][n];
  return [[1,0,0],[0,c,-s],[0,s,c]];
}
function rotY90(n) {
  const c = [1,0,-1,0][n], s = [0,-1,0,1][n];
  return [[c,0,s],[0,1,0],[-s,0,c]];
}
function rotZ90(n) {
  const c = [1,0,-1,0][n], s = [0,1,0,-1][n];
  return [[c,-s,0],[s,c,0],[0,0,1]];
}

let ALL_ROTATIONS = null;
function getAllRotations() {
  if (ALL_ROTATIONS) return ALL_ROTATIONS;
  const seen = new Set();
  ALL_ROTATIONS = [];
  for (let rx = 0; rx < 4; rx++) {
    for (let ry = 0; ry < 4; ry++) {
      for (let rz = 0; rz < 4; rz++) {
        const m = matMul(rotZ90(rz), matMul(rotY90(ry), rotX90(rx)));
        const key = m.flat().join(',');
        if (!seen.has(key)) { seen.add(key); ALL_ROTATIONS.push(m); }
      }
    }
  }
  return ALL_ROTATIONS;
}

function applyRotation(cell, rot) {
  return [
    rot[0][0]*cell[0] + rot[0][1]*cell[1] + rot[0][2]*cell[2],
    rot[1][0]*cell[0] + rot[1][1]*cell[1] + rot[1][2]*cell[2],
    rot[2][0]*cell[0] + rot[2][1]*cell[1] + rot[2][2]*cell[2]
  ];
}

function normalizeCells(cells) {
  if (cells.length === 0) return [];
  const minX = Math.min(...cells.map(c => c[0]));
  const minY = Math.min(...cells.map(c => c[1]));
  const minZ = Math.min(...cells.map(c => c[2]));
  return cells.map(([x,y,z]) => [x-minX, y-minY, z-minZ]);
}

function getTransformedCells(piece, rotIdx) {
  const rots = getAllRotations();
  const rot = rots[rotIdx % rots.length];
  return normalizeCells(piece.cells.map(c => applyRotation(c, rot)));
}

/* ═══════════════════════════════════════════
   BOARD LOGIC
   ═══════════════════════════════════════════ */

function getOccupied3D() {
  const occ = {};
  for (const pl of boardState.placements) {
    const piece = pieceLibrary.find(p => p.id === pl.pieceId);
    if (!piece) continue;
    const cells = getTransformedCells(piece, pl.rotIdx);
    for (const [dx,dy,dz] of cells) {
      occ[`${pl.ox+dx},${pl.oy+dy},${pl.oz+dz}`] = piece.color;
    }
  }
  return occ;
}

function isValidPlacement(pieceId, ox, oy, oz, rotIdx) {
  const piece = pieceLibrary.find(p => p.id === pieceId);
  if (!piece) return false;
  const cells = getTransformedCells(piece, rotIdx);
  const occ = getOccupied3D();
  for (const [dx,dy,dz] of cells) {
    const x = ox+dx, y = oy+dy, z = oz+dz;
    if (x<0 || x>=boardState.sx || y<0 || y>=boardState.sy || z<0 || z>=boardState.sz) return false;
    if (occ[`${x},${y},${z}`]) return false;
  }
  return true;
}

function placePiece(pieceId, ox, oy, oz, rotIdx) {
  if (!isValidPlacement(pieceId, ox, oy, oz, rotIdx)) return false;
  boardState.placements.push({ pieceId, ox, oy, oz, rotIdx });
  return true;
}

/* ═══════════════════════════════════════════
   THREE.JS SETUP
   ═══════════════════════════════════════════ */

const container = document.getElementById('pcCanvasContainer');
if (!container) throw new Error('pcCanvasContainer not found');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1a1a2e');
scene.fog = new THREE.Fog('#1a1a2e', 15, 40);

const camera = new THREE.PerspectiveCamera(50, 2, 0.5, 60);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

// Lights
scene.add(new THREE.AmbientLight('#ffffff', 0.7));
const sun = new THREE.DirectionalLight('#ffffff', 1.2);
sun.position.set(10, 18, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 50;
sun.shadow.camera.left = -15; sun.shadow.camera.right = 15;
sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
scene.add(sun);
scene.add(new THREE.HemisphereLight('#8899cc', '#334455', 0.3));

// OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.minDistance = 3;
controls.maxDistance = 25;

function resetCamera() {
  const { sx, sy, sz } = boardState;
  const gap = 1.0;
  const designerW = 4;
  const totalW = sx + gap + designerW;
  const cx = totalW / 2;
  const cy = (sy - 1) / 2;
  const cz = (sz - 1) / 2;
  const dist = Math.max(totalW, sy, sz) * 1.6 + 2;
  camera.position.set(cx + dist * 0.5, cy + dist * 0.4, cz + dist * 0.8);
  controls.target.set(cx, cy, cz);
  controls.update();
}

// Scene groups
const boardGroup = new THREE.Group(); scene.add(boardGroup);
const piecesGroup = new THREE.Group(); scene.add(piecesGroup);
const ghostGroup = new THREE.Group(); scene.add(ghostGroup);
const designerGroup = new THREE.Group();
designerGroup.position.set(boardState.sx + 1.0, 0, 0);
scene.add(designerGroup);

// Invisible ground mesh for reliable board floor raycasting
let boardGroundMesh = null;

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

/* ═══════════════════════════════════════════
   BOARD RENDERING
   ═══════════════════════════════════════════ */

function renderBoardGrid() {
  boardGroup.clear();
  const { sx, sy, sz } = boardState;

  // Wireframe bounding box
  const boxGeo = new THREE.BoxGeometry(sx, sy, sz);
  const boxEdges = new THREE.EdgesGeometry(boxGeo);
  const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: '#556688' }));
  boxLine.position.set(sx/2 - 0.5, sy/2 - 0.5, sz/2 - 0.5);
  boardGroup.add(boxLine);

  // Grid dots on bottom — also serve as visual anchors for the Y=0 plane
  const dotGeo = new THREE.SphereGeometry(0.08, 6, 6);
  const dotMat = new THREE.MeshBasicMaterial({ color: '#8899cc' });
  for (let x = 0; x < sx; x++) {
    for (let z = 0; z < sz; z++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(x, 0, z);
      boardGroup.add(dot);
    }
  }

  // Cross-grid lines on the Y=0 plane for visual cell boundaries
  const gridLineMat = new THREE.LineBasicMaterial({ color: '#445577', transparent: true, opacity: 0.5 });
  for (let x = 0; x <= sx; x++) {
    const pts = [new THREE.Vector3(x, 0.01, -0.5), new THREE.Vector3(x, 0.01, sz - 0.5)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    boardGroup.add(new THREE.Line(lineGeo, gridLineMat));
  }
  for (let z = 0; z <= sz; z++) {
    const pts = [new THREE.Vector3(-0.5, 0.01, z), new THREE.Vector3(sx - 0.5, 0.01, z)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
    boardGroup.add(new THREE.Line(lineGeo, gridLineMat));
  }

  // Visible floor plane at Y=0 — serves as BOTH visual floor AND raycasting target.
  // (Must keep object.visible=true for raycaster to detect it.)
  const floorGeo = new THREE.PlaneGeometry(sx, sz);
  const floorMat = new THREE.MeshBasicMaterial({
    color: '#2a3a5c',
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.35,
    depthWrite: false
  });
  boardGroundMesh = new THREE.Mesh(floorGeo, floorMat);
  boardGroundMesh.rotation.x = -Math.PI / 2;
  boardGroundMesh.position.set(sx/2 - 0.5, 0.01, sz/2 - 0.5);
  boardGroundMesh.userData = { isBoardGround: true };
  boardGroup.add(boardGroundMesh);
}

/* ═══════════════════════════════════════════
   PIECE MESH CREATION
   ═══════════════════════════════════════════ */

function createCellMesh(color, opacity = 1) {
  const size = 0.92;
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.05,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 0.9
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 * opacity });
  mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));

  return mesh;
}

function renderPlacedPieces() {
  piecesGroup.clear();
  for (const pl of boardState.placements) {
    const piece = pieceLibrary.find(p => p.id === pl.pieceId);
    if (!piece) continue;
    const cells = getTransformedCells(piece, pl.rotIdx);
    for (const [dx, dy, dz] of cells) {
      const mesh = createCellMesh(piece.color);
      mesh.position.set(pl.ox + dx, pl.oy + dy, pl.oz + dz);
      piecesGroup.add(mesh);
    }
  }
}

function computePlacementOrigin(pieceId, rotIdx, hoverX, hoverY, hoverZ) {
  const piece = pieceLibrary.find(p => p.id === pieceId);
  if (!piece) return [hoverX, hoverY, hoverZ];
  const cells = getTransformedCells(piece, rotIdx);
  for (const [dx, dy, dz] of cells) {
    const ox = hoverX - dx, oy = hoverY - dy, oz = hoverZ - dz;
    let inBounds = true;
    for (const [cdx, cdy, cdz] of cells) {
      const cx = ox + cdx, cy = oy + cdy, cz = oz + cdz;
      if (cx < 0 || cx >= boardState.sx || cy < 0 || cy >= boardState.sy || cz < 0 || cz >= boardState.sz) { inBounds = false; break; }
    }
    if (inBounds) return [ox, oy, oz];
  }
  const [dx, dy, dz] = cells[0] || [0,0,0];
  return [hoverX - dx, hoverY - dy, hoverZ - dz];
}

let lastComputedOrigin = null;

function renderGhostPreview() {
  ghostGroup.clear();
  if (!activeSelection || !hoveredCell) { lastComputedOrigin = null; return; }
  const piece = pieceLibrary.find(p => p.id === activeSelection.pieceId);
  if (!piece) { lastComputedOrigin = null; return; }

  const rotIdx = activeSelection.rotIdx;
  const cells = getTransformedCells(piece, rotIdx);
  const { x, y, z } = hoveredCell;

  const [box, boy, boz] = computePlacementOrigin(piece.id, rotIdx, x, y, z);
  lastComputedOrigin = { ox: box, oy: boy, oz: boz };
  placementValid = isValidPlacement(piece.id, box, boy, boz, activeSelection.rotIdx);

  const tint = placementValid ? '#00dc64' : '#ff3c3c';
  for (const [dx, dy, dz] of cells) {
    const mesh = createCellMesh(tint, 0.55);
    mesh.position.set(box + dx, boy + dy, boz + dz);
    ghostGroup.add(mesh);
  }
}

/* ═══════════════════════════════════════════
   DESIGNER RENDERING (4x4x4)
   ═══════════════════════════════════════════ */

function renderDesigner() {
  designerGroup.clear();
  // Position designer with a clear gap from the board
  const offset = boardState.sx + 1.0;
  designerGroup.position.set(offset, 0, 0);
  const size = 4;

  // Base platform
  const baseGeo = new THREE.BoxGeometry(size + 0.2, 0.1, size + 0.2);
  const baseMat = new THREE.MeshStandardMaterial({ color: '#2a2a3e', roughness: 0.8 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.set(size/2 - 0.5, -0.55, size/2 - 0.5);
  designerGroup.add(base);

  // Designer cells
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      for (let z = 0; z < size; z++) {
        const isActive = designerCells.some(c => c[0]===x && c[1]===y && c[2]===z);
        const color = isActive ? '#6C5CE7' : '#3a3a5e';
        const opacity = isActive ? 1 : 0.4;
        const mesh = createCellMesh(color, opacity);
        mesh.position.set(x, y, z);
        mesh.userData = { isDesigner: true, dx: x, dy: y, dz: z };
        designerGroup.add(mesh);
      }
    }
  }

  // Wireframe
  const boxGeo = new THREE.BoxGeometry(size, size, size);
  const boxEdges = new THREE.EdgesGeometry(boxGeo);
  const boxLine = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({ color: '#667799' }));
  boxLine.position.set(size/2 - 0.5, size/2 - 0.5, size/2 - 0.5);
  designerGroup.add(boxLine);
}

/* ═══════════════════════════════════════════
   RAYCASTER & INTERACTION
   ═══════════════════════════════════════════ */

function getIntersections(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return { boardCell: null, designerCell: null };

  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Build target list: board ground + placed pieces + designer cells
  const targets = [];

  // Board ground (invisible mesh for floor detection)
  if (boardGroundMesh) targets.push(boardGroundMesh);

  // Placed pieces (for face-adjacent detection)
  targets.push(...piecesGroup.children);

  // Designer cells (only direct children that have userData.isDesigner)
  for (const child of designerGroup.children) {
    if (child.userData && child.userData.isDesigner) targets.push(child);
  }

  const hits = raycaster.intersectObjects(targets, false);
  // Sort by distance
  hits.sort((a, b) => a.distance - b.distance);

  let boardCell = null;
  let designerCell = null;

  for (const hit of hits) {
    const obj = hit.object;

    // Check if this is a designer cell
    if (obj.userData && obj.userData.isDesigner) {
      if (!designerCell) {
        designerCell = { x: obj.userData.dx, y: obj.userData.dy, z: obj.userData.dz };
      }
      continue;
    }

    // Check if this is the board ground plane
    if (obj.userData && obj.userData.isBoardGround) {
      if (!boardCell) {
        const pt = hit.point;
        const bx = Math.round(pt.x);
        const bz = Math.round(pt.z);
        if (bx >= 0 && bx < boardState.sx && bz >= 0 && bz < boardState.sz) {
          boardCell = { x: bx, y: 0, z: bz };
        }
      }
      continue;
    }

    // This is a placed piece — compute adjacent cell from face normal
    if (!boardCell) {
      const normal = hit.face.normal.clone();
      normal.transformDirection(obj.matrixWorld);
      const absN = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
      const maxIdx = absN.indexOf(Math.max(...absN));
      const sign = [normal.x, normal.y, normal.z][maxIdx] > 0 ? 1 : -1;
      const dir = [0, 0, 0]; dir[maxIdx] = sign;

      const pos = obj.position;
      const cellX = Math.round(pos.x + dir[0]);
      const cellY = Math.round(pos.y + dir[1]);
      const cellZ = Math.round(pos.z + dir[2]);

      if (cellX >= 0 && cellX < boardState.sx &&
          cellY >= 0 && cellY < boardState.sy &&
          cellZ >= 0 && cellZ < boardState.sz) {
        boardCell = { x: cellX, y: cellY, z: cellZ };
      }
    }
  }

  return { boardCell, designerCell };
}

function onPointerMove(event) {
  const { boardCell, designerCell } = getIntersections(event);

  if (designerCell && !boardCell) {
    // Mouse is exclusively over designer — show cursor as pointer
    renderer.domElement.style.cursor = 'pointer';
    hoveredCell = null;
  } else if (boardCell) {
    // Mouse is over the board (possibly also hitting designer behind)
    renderer.domElement.style.cursor = activeSelection ? 'crosshair' : 'grab';
    hoveredCell = boardCell;
  } else {
    renderer.domElement.style.cursor = 'grab';
    hoveredCell = null;
  }

  renderGhostPreview();
}

function onPointerDown(event) {
  // Only handle left click
  if (event.button !== 0) return;

  const { boardCell, designerCell } = getIntersections(event);

  // Designer click — toggle cell
  if (designerCell) {
    // Check if the click is PRIMARILY on the designer (closest hit is designer)
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // Get closest hit among designer cells
    const designerOnly = [];
    for (const child of designerGroup.children) {
      if (child.userData && child.userData.isDesigner) designerOnly.push(child);
    }
    const dHits = raycaster.intersectObjects(designerOnly, false);

    // Also check board ground
    let boardDist = Infinity;
    if (boardGroundMesh) {
      const bHits = raycaster.intersectObjects([boardGroundMesh], false);
      if (bHits.length > 0) boardDist = bHits[0].distance;
    }

    // Only toggle designer if it's the CLOSEST hit (designer is in front of board)
    if (dHits.length > 0 && dHits[0].distance < boardDist) {
      const { x, y, z } = designerCell;
      const idx = designerCells.findIndex(c => c[0]===x && c[1]===y && c[2]===z);
      if (idx >= 0) designerCells.splice(idx, 1);
      else designerCells.push([x, y, z]);
      renderDesigner();
      return;
    }
  }

  // Board click — place piece
  if (!boardCell || !activeSelection) return;

  // Compute origin
  let origin = lastComputedOrigin;
  if (!origin) {
    const [ox, oy, oz] = computePlacementOrigin(
      activeSelection.pieceId, activeSelection.rotIdx,
      boardCell.x, boardCell.y, boardCell.z
    );
    origin = { ox, oy, oz };
  }

  if (placePiece(activeSelection.pieceId, origin.ox, origin.oy, origin.oz, activeSelection.rotIdx)) {
    saveBoardSession();
    renderAll();
  }
}

/* ═══════════════════════════════════════════
   RENDER ALL
   ═══════════════════════════════════════════ */

function renderAll() {
  renderBoardGrid();
  renderPlacedPieces();
  renderDesigner();
  renderGhostPreview();
  renderLibrary();
  updateActivePanel();
}

/* ═══════════════════════════════════════════
   PIECE LIBRARY SIDEBAR
   ═══════════════════════════════════════════ */

function renderLibrary() {
  const lib = document.getElementById('pcPieceLibrary');
  if (!lib) return;
  lib.innerHTML = '';
  if (pieceLibrary.length === 0) {
    lib.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:8px;text-align:center;">拼图库为空</p>';
    return;
  }
  for (const piece of pieceLibrary) {
    const item = document.createElement('div');
    item.className = 'piece-library-item';
    if (activeSelection && activeSelection.pieceId === piece.id) item.classList.add('active');

    const swatch = document.createElement('div');
    swatch.style.cssText = `width:20px;height:20px;border-radius:4px;flex-shrink:0;background:${piece.color}`;

    const info = document.createElement('div');
    info.className = 'piece-library-info';

    const nameEl = document.createElement('span');
    nameEl.className = 'piece-library-name';
    nameEl.textContent = piece.name + ` (${piece.cells.length}块)`;

    const countEl = document.createElement('span');
    countEl.className = 'piece-library-count';
    const used = boardState.placements.filter(p => p.pieceId === piece.id).length;
    countEl.textContent = used > 0 ? `×${used}` : '';
    countEl.style.color = used > 0 ? 'var(--accent)' : 'transparent';

    info.appendChild(nameEl);
    info.appendChild(countEl);
    item.appendChild(swatch);
    item.appendChild(info);

    if (!piece.id.startsWith('b_')) {
      const delBtn = document.createElement('button');
      delBtn.className = 'piece-library-delete';
      delBtn.textContent = '×';
      delBtn.title = '删除';
      delBtn.addEventListener('click', (e) => { e.stopPropagation(); deletePiece3D(piece.id); });
      item.appendChild(delBtn);
    }
    item.addEventListener('click', () => selectPiece3D(piece.id));
    lib.appendChild(item);
  }
}

function selectPiece3D(pieceId) {
  if (activeSelection && activeSelection.pieceId === pieceId) {
    activeSelection = null;
  } else {
    activeSelection = { pieceId, rotIdx: 0 };
  }
  updateActivePanel();
  renderAll();
}

function deletePiece3D(pieceId) {
  const used = boardState.placements.filter(p => p.pieceId === pieceId).length;
  if (used > 0 && !confirm(`该拼图块在棋盘上使用了 ${used} 次，确定删除？`)) return;
  boardState.placements = boardState.placements.filter(p => p.pieceId !== pieceId);
  pieceLibrary = pieceLibrary.filter(p => p.id !== pieceId);
  if (activeSelection && activeSelection.pieceId === pieceId) activeSelection = null;
  saveLibrary(); saveBoardSession();
  renderAll();
}

function updateActivePanel() {
  const panel = document.getElementById('pcActivePanel');
  if (!activeSelection) { panel.style.display = 'none'; return; }
  panel.style.display = '';
  const piece = pieceLibrary.find(p => p.id === activeSelection.pieceId);
  if (!piece) return;
  document.getElementById('pcActiveName').textContent = piece.name + ` [旋转 ${activeSelection.rotIdx}/24]`;
  const used = boardState.placements.filter(p => p.pieceId === activeSelection.pieceId).length;
  document.getElementById('pcActiveCount').textContent = `已使用: ${used} 个`;
}

function composeRotation(rotIdx, axis, dir) {
  // Compose the current rotation matrix with a 90° rotation around the given axis
  // (local rotation — apply delta after current matrix)
  const rots = getAllRotations();
  const current = rots[((rotIdx % rots.length) + rots.length) % rots.length];
  const angle = dir > 0 ? 1 : 3; // 1 = +90°, 3 = -90° (270°)
  let delta;
  if (axis === 'x') delta = rotX90(angle);
  else if (axis === 'y') delta = rotY90(angle);
  else delta = rotZ90(angle);
  const result = matMul(current, delta);
  const key = result.flat().join(',');
  const newIdx = rots.findIndex(r => r.flat().join(',') === key);
  return newIdx >= 0 ? newIdx : rotIdx;
}

function rotateActive(axis, dir) {
  if (!activeSelection) return;
  activeSelection.rotIdx = composeRotation(activeSelection.rotIdx, axis, dir);
  updateActivePanel();
  renderAll();
}

/* ═══════════════════════════════════════════
   LOCAL STORAGE
   ═══════════════════════════════════════════ */

function loadLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PC);
    if (raw) { const data = JSON.parse(raw); if (Array.isArray(data) && data.length > 0) return data; }
  } catch(e) {}
  const defaults = DEFAULT_PIECES.map(p => ({...p}));
  localStorage.setItem(STORAGE_KEY_PC, JSON.stringify(defaults));
  return defaults;
}
function saveLibrary() { localStorage.setItem(STORAGE_KEY_PC, JSON.stringify(pieceLibrary)); }

function loadBoardSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOARD);
    if (raw) { const d = JSON.parse(raw); if (d && typeof d.sx === 'number') return d; }
  } catch(e) {}
  return { sx: 4, sy: 4, sz: 4, placements: [] };
}
function saveBoardSession() { localStorage.setItem(STORAGE_KEY_BOARD, JSON.stringify(boardState)); }

/* ═══════════════════════════════════════════
   DESIGNER SAVE
   ═══════════════════════════════════════════ */

function saveDesignerPiece() {
  if (designerCells.length === 0) { alert('请先在设计器中添加方块。'); return; }
  const nameInput = document.getElementById('pcDesignerName');
  const name = nameInput.value.trim() || ('拼图块 ' + (pieceLibrary.length+1));
  const color = PALETTE[paletteIdx % PALETTE.length]; paletteIdx++;
  const id = 'pc_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  const cells = normalizeCells(designerCells.map(c => [c[0], c[1], c[2]]));
  const piece = { id, name, cells, color };
  pieceLibrary.push(piece);
  saveLibrary();
  designerCells = [];
  renderDesigner();
  nameInput.value = '';
  renderAll();
  selectPiece3D(id);
}

/* ═══════════════════════════════════════════
   RESIZE
   ═══════════════════════════════════════════ */

function resize() {
  let w = container.clientWidth;
  let h = container.clientHeight;
  if (!w || !h) {
    const parent = container.parentElement;
    if (parent) {
      w = w || parent.clientWidth;
      h = h || parent.clientHeight;
    }
  }
  w = w || 800;
  h = h || 500;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ═══════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════ */

function init() {
  pieceLibrary = loadLibrary();
  boardState = loadBoardSession();
  paletteIdx = pieceLibrary.length;
  designerCells = [];

  document.getElementById('pcSizeX').value = boardState.sx;
  document.getElementById('pcSizeY').value = boardState.sy;
  document.getElementById('pcSizeZ').value = boardState.sz;

  // Delay initial render to ensure CSS layout is resolved
  requestAnimationFrame(() => {
    resize();
    resetCamera();
    renderAll();

    // Update designer position to match the possibly-loaded board size
    designerGroup.position.set(boardState.sx + 1.0, 0, 0);
  });

  // Use pointer events (more reliable than click)
  renderer.domElement.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('pointerdown', onPointerDown);
  renderer.domElement.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (activeSelection) { activeSelection = null; updateActivePanel(); renderAll(); }
  });

  // Keyboard
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT') return;
    switch(e.key) {
      case 'ArrowLeft': rotateActive('y', -1); break;
      case 'ArrowRight': rotateActive('y', 1); break;
      case 'ArrowUp': rotateActive('x', -1); break;
      case 'ArrowDown': rotateActive('x', 1); break;
      case ',': rotateActive('z', -1); break;
      case '.': rotateActive('z', 1); break;
      case 'Escape': activeSelection = null; updateActivePanel(); renderAll(); break;
      case 'z': if (e.ctrlKey) { boardState.placements.pop(); saveBoardSession(); renderAll(); } break;
    }
  });

  // Buttons
  document.getElementById('pcRotX').addEventListener('click', () => rotateActive('x', 1));
  document.getElementById('pcRotY').addEventListener('click', () => rotateActive('y', 1));
  document.getElementById('pcRotZ').addEventListener('click', () => rotateActive('z', 1));
  document.getElementById('pcRotXccw').addEventListener('click', () => rotateActive('x', -1));
  document.getElementById('pcRotYccw').addEventListener('click', () => rotateActive('y', -1));
  document.getElementById('pcRotZccw').addEventListener('click', () => rotateActive('z', -1));
  document.getElementById('pcDeselect').addEventListener('click', () => { activeSelection = null; updateActivePanel(); renderAll(); });
  document.getElementById('pcSavePiece').addEventListener('click', saveDesignerPiece);
  document.getElementById('pcUndo').addEventListener('click', () => { boardState.placements.pop(); saveBoardSession(); renderAll(); });
  document.getElementById('pcClear').addEventListener('click', () => {
    if (boardState.placements.length === 0 || confirm('清空棋盘？')) { boardState.placements = []; saveBoardSession(); renderAll(); }
  });
  document.getElementById('pcSave').addEventListener('click', () => { saveBoardSession(); saveLibrary(); });
  document.getElementById('pcUpdateSize').addEventListener('click', () => {
    const sx = Math.max(1, Math.min(10, parseInt(document.getElementById('pcSizeX').value)||4));
    const sy = Math.max(1, Math.min(10, parseInt(document.getElementById('pcSizeY').value)||4));
    const sz = Math.max(1, Math.min(10, parseInt(document.getElementById('pcSizeZ').value)||4));
    document.getElementById('pcSizeX').value = sx;
    document.getElementById('pcSizeY').value = sy;
    document.getElementById('pcSizeZ').value = sz;
    boardState.sx = sx; boardState.sy = sy; boardState.sz = sz;
    boardState.placements = boardState.placements.filter(pl => {
      const piece = pieceLibrary.find(p => p.id === pl.pieceId);
      if (!piece) return false;
      const cells = getTransformedCells(piece, pl.rotIdx);
      return cells.every(([dx,dy,dz]) => pl.ox+dx>=0 && pl.ox+dx<sx && pl.oy+dy>=0 && pl.oy+dy<sy && pl.oz+dz>=0 && pl.oz+dz<sz);
    });
    designerGroup.position.set(boardState.sx + 1.0, 0, 0);
    saveBoardSession(); resetCamera(); renderAll();
  });
  document.getElementById('pcExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(pieceLibrary,null,2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'polycube-pieces.json'; a.click();
  });
  document.getElementById('pcImport').addEventListener('click', () => document.getElementById('pcImportFile').click());
  document.getElementById('pcImportFile').addEventListener('change', e => {
    if (!e.target.files[0]) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) throw new Error('Invalid');
        for (const p of data) {
          if (!p.id || !Array.isArray(p.cells)) continue;
          if (!pieceLibrary.find(x => x.id === p.id)) pieceLibrary.push(p);
        }
        saveLibrary(); renderAll();
      } catch(err) { alert('导入失败'); }
    };
    reader.readAsText(e.target.files[0]);
  });

  // Resize handling
  window.addEventListener('resize', () => {
    resize();
    if (window.innerWidth > 800) {
      pcSidebarEl.classList.remove('open');
      if (pcOverlayEl) pcOverlayEl.classList.remove('active');
    }
  });
  new ResizeObserver(() => resize()).observe(container);

  // ── Mobile sidebar toggle ──
  const pcSidebarEl = document.getElementById('pcSidebar');
  let pcOverlayEl = null;

  function openPcSidebar() {
    pcSidebarEl.classList.add('open');
    if (!pcOverlayEl) {
      pcOverlayEl = document.createElement('div');
      pcOverlayEl.className = 'sidebar-overlay';
      document.getElementById('polycubeApp').appendChild(pcOverlayEl);
      pcOverlayEl.addEventListener('click', closePcSidebar);
    }
    pcOverlayEl.classList.add('active');
  }

  function closePcSidebar() {
    pcSidebarEl.classList.remove('open');
    if (pcOverlayEl) pcOverlayEl.classList.remove('active');
  }

  function togglePcSidebar() {
    if (pcSidebarEl.classList.contains('open')) {
      closePcSidebar();
    } else {
      openPcSidebar();
    }
  }

  const pcToggleBtn = document.getElementById('pcSidebarToggle');
  if (pcToggleBtn) pcToggleBtn.addEventListener('click', togglePcSidebar);

  // Close sidebar when selecting a piece on mobile
  const origSelect3D = selectPiece3D;
  selectPiece3D = function(pieceId) {
    origSelect3D(pieceId);
    if (window.innerWidth <= 800) closePcSidebar();
  };

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

// Module script with CDN imports may execute after DOMContentLoaded has fired.
// Use readyState check to avoid the race.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
