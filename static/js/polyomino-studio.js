/**
 * Polyomino Puzzle Studio
 * Interactive tiling tool for math competition problems.
 * Pure frontend: Canvas rendering + localStorage persistence.
 */

/* ═══════════════════════════════════════════════════════════
   DATA MODEL
   ═══════════════════════════════════════════════════════════ */

// Piece: { id: string, name: string, shape: [[r,c],...], color: string }
// Placement: { pieceId, originR, originC, rotation(0-3), flipH:bool, flipV:bool }
// BoardState: { rows: int, cols: int, placements: Placement[] }
// ActiveSelection: { pieceId, rotation, flipH, flipV } | null
// State machine: 'IDLE' | 'PLACING'

const STORAGE_KEY_PIECES = 'polyomino_pieces';
const STORAGE_KEY_BOARD = 'polyomino_board_session';

const DEFAULT_PALETTE = [
  '#FF6B6B', '#FF8E53', '#FFD93D', '#6BCB77', '#4D96FF',
  '#9B59B6', '#FF6FB7', '#00D2D3', '#F368E0', '#FF9FF3',
  '#54A0FF', '#5F27CD', '#01A3A4', '#FECA57', '#FF6348',
  '#7BED9F', '#70A1FF', '#FFA502', '#2ED573', '#FF4757'
];

const DEFAULT_PIECES = [
  { id: 'builtin_monomino', name: '单体 (1×1)', shape: [[0,0]], color: '#FF6B6B' },
  { id: 'builtin_domino',    name: '多米诺 (1×2)', shape: [[0,0],[0,1]], color: '#4D96FF' },
  { id: 'builtin_L_tromino', name: 'L-三格', shape: [[0,0],[1,0],[2,0],[2,1]], color: '#6BCB77' },
  { id: 'builtin_I_tromino', name: 'I-三格', shape: [[0,0],[1,0],[2,0]], color: '#FF8E53' },
  { id: 'builtin_T_tetromino', name: 'T-四格', shape: [[0,0],[0,1],[0,2],[1,1]], color: '#9B59B6' },
  { id: 'builtin_Z_tetromino', name: 'Z-四格', shape: [[0,0],[0,1],[1,1],[1,2]], color: '#FFD93D' },
  { id: 'builtin_L_tetromino', name: 'L-四格', shape: [[0,0],[1,0],[2,0],[2,1]], color: '#FF6FB7' },
  { id: 'builtin_O_tetromino', name: '方块 (2×2)', shape: [[0,0],[0,1],[1,0],[1,1]], color: '#00D2D3' },
];

let pieceLibrary = [];
let boardState = { rows: 8, cols: 8, placements: [] };
let activeSelection = null;  // { pieceId, rotation, flipH, flipV } | null
let paletteIdx = 0;
let uiState = { hoverCell: null, placementValid: false };

/* ═══════════════════════════════════════════════════════════
   TRANSFORM MATH
   ═══════════════════════════════════════════════════════════ */

function normalizeCoords(coords) {
  if (coords.length === 0) return [];
  const minR = Math.min(...coords.map(([r]) => r));
  const minC = Math.min(...coords.map(([,c]) => c));
  const normalized = coords.map(([r, c]) => [r - minR, c - minC]);
  // Sort for canonical representation
  normalized.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return normalized;
}

function rotate90(coords) {
  return normalizeCoords(coords.map(([r, c]) => [c, -r]));
}

function flipH(coords) {
  return normalizeCoords(coords.map(([r, c]) => [r, -c]));
}

function flipV(coords) {
  return normalizeCoords(coords.map(([r, c]) => [-r, c]));
}

function getTransformedCoords(shape, rotation, flipHFlag, flipVFlag) {
  let coords = shape.map(([r, c]) => [r, c]);
  if (flipHFlag) coords = flipH(coords);
  if (flipVFlag) coords = flipV(coords);
  for (let i = 0; i < rotation; i++) coords = rotate90(coords);
  return coords;
}

/**
 * Compute all 8 orientations of a shape (4 rotations x 2 flips).
 * Returns array of normalized coord arrays, deduplicated.
 */
function getAllOrientations(shape) {
  const seen = new Set();
  const result = [];
  for (let flipHFlag of [false, true]) {
    for (let rot = 0; rot < 4; rot++) {
      const transformed = getTransformedCoords(shape, rot, flipHFlag, false);
      const key = JSON.stringify(transformed);
      if (!seen.has(key)) {
        seen.add(key);
        result.push(transformed);
      }
    }
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════
   COLOR UTILITY
   ═══════════════════════════════════════════════════════════ */

function darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const dr = Math.round(r * (1 - factor));
  const dg = Math.round(g * (1 - factor));
  const db = Math.round(b * (1 - factor));
  return '#' + [dr, dg, db].map(v => Math.max(0, v).toString(16).padStart(2, '0')).join('');
}

/* ═══════════════════════════════════════════════════════════
   BOARD LOGIC
   ═══════════════════════════════════════════════════════════ */

function getOccupiedCells() {
  const occupied = {};
  for (const pl of boardState.placements) {
    const piece = pieceLibrary.find(p => p.id === pl.pieceId);
    if (!piece) continue;
    const coords = getTransformedCoords(piece.shape, pl.rotation, pl.flipH, pl.flipV);
    for (const [dr, dc] of coords) {
      const r = pl.originR + dr;
      const c = pl.originC + dc;
      occupied[`${r},${c}`] = { pieceId: pl.pieceId, color: piece.color };
    }
  }
  return occupied;
}

function isValidPlacement(pieceId, originR, originC, rotation, flipHFlag, flipVFlag) {
  const piece = pieceLibrary.find(p => p.id === pieceId);
  if (!piece) return false;
  const coords = getTransformedCoords(piece.shape, rotation, flipHFlag, flipVFlag);
  const occupied = getOccupiedCells();
  for (const [dr, dc] of coords) {
    const r = originR + dr;
    const c = originC + dc;
    if (r < 0 || r >= boardState.rows || c < 0 || c >= boardState.cols) return false;
    if (occupied[`${r},${c}`]) return false;
  }
  return true;
}

function placePiece(pieceId, originR, originC, rotation, flipHFlag, flipVFlag) {
  if (!isValidPlacement(pieceId, originR, originC, rotation, flipHFlag, flipVFlag)) return false;
  boardState.placements.push({
    pieceId,
    originR,
    originC,
    rotation: rotation || 0,
    flipH: flipHFlag || false,
    flipV: flipVFlag || false
  });
  return true;
}

function undoPlacement() {
  if (boardState.placements.length === 0) return false;
  boardState.placements.pop();
  return true;
}

function clearBoard() {
  if (boardState.placements.length === 0) return;
  if (confirm(`确定要清空棋盘上的 ${boardState.placements.length} 个拼图块吗？`)) {
    boardState.placements = [];
  }
}

function countPieceUsage(pieceId) {
  return boardState.placements.filter(p => p.pieceId === pieceId).length;
}

/* ═══════════════════════════════════════════════════════════
   LOCAL STORAGE
   ═══════════════════════════════════════════════════════════ */

function loadLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PIECES);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data) && data.length > 0) {
        // Migrate old builtin pieces to current bright colors
        let migrated = false;
        for (const piece of data) {
          if (piece.id.startsWith('builtin_')) {
            const def = DEFAULT_PIECES.find(d => d.id === piece.id);
            if (def && piece.color !== def.color) {
              piece.color = def.color;
              migrated = true;
            }
          }
        }
        if (migrated) {
          localStorage.setItem(STORAGE_KEY_PIECES, JSON.stringify(data));
        }
        return data;
      }
    }
  } catch (e) { /* corrupt data, use defaults */ }
  // First-time: seed with default pieces
  const defaults = DEFAULT_PIECES.map(p => ({ ...p }));
  saveLibrary(defaults);
  return defaults;
}

function saveLibrary(lib) {
  pieceLibrary = lib;
  localStorage.setItem(STORAGE_KEY_PIECES, JSON.stringify(lib));
}

function loadBoardSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOARD);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data.rows === 'number' && typeof data.cols === 'number' && Array.isArray(data.placements)) {
        return { rows: data.rows, cols: data.cols, placements: data.placements };
      }
    }
  } catch (e) { /* corrupt */ }
  return { rows: 8, cols: 8, placements: [] };
}

function saveBoardSession() {
  localStorage.setItem(STORAGE_KEY_BOARD, JSON.stringify(boardState));
}

function exportLibrary() {
  const blob = new Blob([JSON.stringify(pieceLibrary, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'polyomino-pieces.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importLibrary(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) throw new Error('Not an array');
      const existingIds = new Set(pieceLibrary.map(p => p.id));
      let added = 0;
      let skipped = 0;
      for (const piece of data) {
        if (!piece.id || !Array.isArray(piece.shape) || piece.shape.length === 0) continue;
        // Deduplicate by shape key (canonical orientation)
        const orientations = getAllOrientations(piece.shape);
        const canonicalKey = JSON.stringify(orientations[0]);
        const exists = pieceLibrary.some(p => {
          const pOrient = getAllOrientations(p.shape);
          return JSON.stringify(pOrient[0]) === canonicalKey;
        });
        if (exists) { skipped++; continue; }
        // Assign new ID if collision
        if (existingIds.has(piece.id)) {
          piece.id = 'imp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        }
        if (!piece.color) {
          piece.color = DEFAULT_PALETTE[paletteIdx % DEFAULT_PALETTE.length];
          paletteIdx++;
        }
        existingIds.add(piece.id);
        pieceLibrary.push(piece);
        added++;
      }
      saveLibrary(pieceLibrary);
      refreshAll();
      alert(`导入完成：新增 ${added} 个拼图块，跳过 ${skipped} 个重复。`);
    } catch (err) {
      alert('导入失败：无效的 JSON 文件。' + err.message);
    }
  };
  reader.readAsText(file);
}

/* ═══════════════════════════════════════════════════════════
   CANVAS RENDERING — BOARD
   ═══════════════════════════════════════════════════════════ */

let cachedCellSize = null;

function computeCellSize(rows, cols, maxWidth, maxHeight) {
  const cellW = Math.floor((maxWidth - 2) / cols);
  const cellH = Math.floor((maxHeight - 2) / rows);
  return Math.max(12, Math.min(52, cellW, cellH));
}

function recalcCellSize() {
  const canvas = document.getElementById('boardCanvas');
  if (!canvas) return;
  const isMobile = window.innerWidth <= 800;
  // On mobile use nearly full viewport width; desktop accounts for sidebar
  const maxW = isMobile
    ? window.innerWidth - 16
    : window.innerWidth - 280 - 48;
  const maxH = isMobile
    ? window.innerHeight - 200
    : Math.min(window.innerHeight - 200, 750);
  cachedCellSize = computeCellSize(boardState.rows, boardState.cols, maxW, maxH);
}

function renderBoard() {
  const canvas = document.getElementById('boardCanvas');
  if (!canvas) return;
  const container = canvas.parentElement;

  // Use cached cellSize, recalc only if not set
  if (cachedCellSize === null) recalcCellSize();
  const cellSize = cachedCellSize;

  const width = boardState.cols * cellSize + 1;
  const height = boardState.rows * cellSize + 1;

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';

  // Ensure container can scroll if canvas is larger than viewport
  container.style.overflow = (height > window.innerHeight - 260 || width > (container.parentElement?.clientWidth || 800) - 32) ? 'auto' : 'hidden';

  const ctx = canvas.getContext('2d');
  const occupied = getOccupiedCells();

  // Layer 1: Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Layer 2: Checkerboard (2x2 blocks)
  for (let r = 0; r < boardState.rows; r++) {
    for (let c = 0; c < boardState.cols; c++) {
      if ((Math.floor(r / 2) + Math.floor(c / 2)) % 2 === 0) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
  }

  // Layer 3: Grid lines
  ctx.strokeStyle = '#dee2e6';
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= boardState.rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * cellSize);
    ctx.lineTo(boardState.cols * cellSize, r * cellSize);
    ctx.stroke();
  }
  for (let c = 0; c <= boardState.cols; c++) {
    ctx.beginPath();
    ctx.moveTo(c * cellSize, 0);
    ctx.lineTo(c * cellSize, boardState.rows * cellSize);
    ctx.stroke();
  }

  // Layer 4: Placed pieces
  for (const pl of boardState.placements) {
    const piece = pieceLibrary.find(p => p.id === pl.pieceId);
    if (!piece) continue;
    const coords = getTransformedCoords(piece.shape, pl.rotation, pl.flipH, pl.flipV);
    const cellSet = new Set(coords.map(([dr, dc]) => `${pl.originR + dr},${pl.originC + dc}`));

    // Fill all cells
    for (const [dr, dc] of coords) {
      const r = pl.originR + dr;
      const c = pl.originC + dc;
      const x = c * cellSize;
      const y = r * cellSize;
      ctx.fillStyle = piece.color;
      ctx.fillRect(x + 1, y + 1, cellSize - 1, cellSize - 1);
    }

    // Draw connection lines (center-to-center for adjacent and diagonal cells)
    const drawnEdges = new Set();
    // Orthogonal neighbors first (thicker)
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(1.2, cellSize * 0.09);
    ctx.lineCap = 'round';
    for (const [dr, dc] of coords) {
      const r = pl.originR + dr;
      const c = pl.originC + dc;
      const cx = (c + 0.5) * cellSize;
      const cy = (r + 0.5) * cellSize;
      for (const [nr, nc] of [[r, c+1], [r+1, c]]) {
        if (cellSet.has(`${nr},${nc}`)) {
          const edgeKey = `${Math.min(r,nr)},${Math.min(c,nc)}-${Math.max(r,nr)},${Math.max(c,nc)}`;
          if (!drawnEdges.has(edgeKey)) {
            drawnEdges.add(edgeKey);
            const nx = (nc + 0.5) * cellSize;
            const ny = (nr + 0.5) * cellSize;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(nx, ny);
            ctx.stroke();
          }
        }
      }
    }
    // Diagonal neighbor connections (thinner, more transparent)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(0.8, cellSize * 0.05);
    for (const [dr, dc] of coords) {
      const r = pl.originR + dr;
      const c = pl.originC + dc;
      const cx = (c + 0.5) * cellSize;
      const cy = (r + 0.5) * cellSize;
      for (const [nr, nc] of [[r-1, c-1], [r-1, c+1], [r+1, c-1], [r+1, c+1]]) {
        if (cellSet.has(`${nr},${nc}`)) {
          const edgeKey = `${Math.min(r,nr)},${Math.min(c,nc)}-${Math.max(r,nr)},${Math.max(c,nc)}`;
          if (!drawnEdges.has(edgeKey)) {
            drawnEdges.add(edgeKey);
            const nx = (nc + 0.5) * cellSize;
            const ny = (nr + 0.5) * cellSize;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(nx, ny);
            ctx.stroke();
          }
        }
      }
    }

    // Draw outer perimeter only (edges not shared with another cell of same piece)
    const borderColor = darkenColor(piece.color, 0.3);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(2, cellSize * 0.15);
    ctx.lineCap = 'square';

    for (const [dr, dc] of coords) {
      const r = pl.originR + dr;
      const c = pl.originC + dc;
      const x = c * cellSize;
      const y = r * cellSize;

      // Top edge
      if (!cellSet.has(`${r-1},${c}`)) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + cellSize, y);
        ctx.stroke();
      }
      // Bottom edge
      if (!cellSet.has(`${r+1},${c}`)) {
        ctx.beginPath();
        ctx.moveTo(x, y + cellSize);
        ctx.lineTo(x + cellSize, y + cellSize);
        ctx.stroke();
      }
      // Left edge
      if (!cellSet.has(`${r},${c-1}`)) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + cellSize);
        ctx.stroke();
      }
      // Right edge
      if (!cellSet.has(`${r},${c+1}`)) {
        ctx.beginPath();
        ctx.moveTo(x + cellSize, y);
        ctx.lineTo(x + cellSize, y + cellSize);
        ctx.stroke();
      }
    }
  }

  // Layer 5: Ghost preview of active piece
  if (activeSelection && uiState.hoverCell) {
    const piece = pieceLibrary.find(p => p.id === activeSelection.pieceId);
    if (piece) {
      const coords = getTransformedCoords(
        piece.shape, activeSelection.rotation, activeSelection.flipH, activeSelection.flipV
      );
      const valid = isValidPlacement(
        activeSelection.pieceId, uiState.hoverCell.r, uiState.hoverCell.c,
        activeSelection.rotation, activeSelection.flipH, activeSelection.flipV
      );
      uiState.placementValid = valid;

      for (const [dr, dc] of coords) {
        const r = uiState.hoverCell.r + dr;
        const c = uiState.hoverCell.c + dc;
        const x = c * cellSize;
        const y = r * cellSize;
        if (r < 0 || r >= boardState.rows || c < 0 || c >= boardState.cols) continue;
        if (valid && !occupied[`${r},${c}`]) {
          ctx.fillStyle = 'rgba(0, 200, 100, 0.35)';
        } else if (!valid) {
          ctx.fillStyle = 'rgba(255, 80, 80, 0.35)';
        } else {
          ctx.fillStyle = 'rgba(255, 80, 80, 0.35)';
        }
        ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(x + 1.5, y + 1.5, cellSize - 3, cellSize - 3);
        ctx.setLineDash([]);
      }
    }
  }

  // Layer 6: Hover highlight (only in IDLE mode or when a valid cell is hovered in PLACING mode)
  if (uiState.hoverCell && !activeSelection) {
    const { r, c } = uiState.hoverCell;
    ctx.strokeStyle = 'rgba(108, 92, 231, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
  }

  // Store cellSize for mouse calculations
  canvas._cellSize = cellSize;
}

function getCellFromEvent(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const cellSize = canvas._cellSize || 30;
  const c = Math.floor(x / cellSize);
  const r = Math.floor(y / cellSize);
  if (r < 0 || r >= boardState.rows || c < 0 || c >= boardState.cols) return null;
  return { r, c };
}

/* ═══════════════════════════════════════════════════════════
   CANVAS RENDERING — PIECE THUMBNAILS
   ═══════════════════════════════════════════════════════════ */

function renderPieceThumbnail(canvas, shape, color, cellSize) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (shape.length === 0) return;
  const maxR = Math.max(...shape.map(([r]) => r)) + 1;
  const maxC = Math.max(...shape.map(([,c]) => c)) + 1;
  canvas.width = maxC * cellSize;
  canvas.height = maxR * cellSize;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const [r, c] of shape) {
    ctx.fillStyle = color;
    ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(c * cellSize + 1.5, r * cellSize + 1.5, cellSize - 3, cellSize - 3);
  }
}

function renderActivePreview() {
  if (!activeSelection) return;
  const piece = pieceLibrary.find(p => p.id === activeSelection.pieceId);
  if (!piece) return;
  const canvas = document.getElementById('activePreviewCanvas');
  if (!canvas) return;
  const coords = getTransformedCoords(piece.shape, activeSelection.rotation, activeSelection.flipH, activeSelection.flipV);
  const maxR = Math.max(...coords.map(([r]) => r), 0) + 1;
  const maxC = Math.max(...coords.map(([,c]) => c), 0) + 1;
  const cellSize = Math.min(20, Math.floor(100 / Math.max(maxR, maxC, 1)));
  renderPieceThumbnail(canvas, coords, piece.color, cellSize);
}

/* ═══════════════════════════════════════════════════════════
   PIECE LIBRARY SIDEBAR
   ═══════════════════════════════════════════════════════════ */

function renderLibrary() {
  const container = document.getElementById('pieceLibrary');
  if (!container) return;
  container.innerHTML = '';

  if (pieceLibrary.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:12px;">拼图库为空<br>使用设计器创建新拼图块</p>';
    return;
  }

  for (const piece of pieceLibrary) {
    const item = document.createElement('div');
    item.className = 'piece-library-item';
    if (activeSelection && activeSelection.pieceId === piece.id) {
      item.classList.add('active');
    }

    // Uniform thumbnail: 36x36, shape centered
    const thumbSize = 36;
    const thumb = document.createElement('canvas');
    const maxR = Math.max(...piece.shape.map(([r]) => r), 0) + 1;
    const maxC = Math.max(...piece.shape.map(([,c]) => c), 0) + 1;
    const cs = Math.floor((thumbSize - 6) / Math.max(maxR, maxC, 1));
    const offsetX = Math.floor((thumbSize - maxC * cs) / 2);
    const offsetY = Math.floor((thumbSize - maxR * cs) / 2);

    thumb.width = thumbSize;
    thumb.height = thumbSize;
    // Don't set style.width/height — let CSS handle display size

    const ctx = thumb.getContext('2d');
    ctx.clearRect(0, 0, thumbSize, thumbSize);
    for (const [r, c] of piece.shape) {
      ctx.fillStyle = piece.color;
      ctx.fillRect(offsetX + c * cs + 1, offsetY + r * cs + 1, cs - 1, cs - 1);
    }

    const info = document.createElement('div');
    info.className = 'piece-library-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'piece-library-name';
    nameEl.textContent = piece.name;
    const countEl = document.createElement('span');
    countEl.className = 'piece-library-count';
    const used = countPieceUsage(piece.id);
    countEl.textContent = used > 0 ? `×${used}` : '';
    if (used > 0) countEl.style.color = 'var(--accent)';

    info.appendChild(nameEl);
    info.appendChild(countEl);
    item.appendChild(thumb);
    item.appendChild(info);

    // Delete button for user-created pieces only
    if (!piece.id.startsWith('builtin_')) {
      const delBtn = document.createElement('button');
      delBtn.className = 'piece-library-delete';
      delBtn.textContent = '×';
      delBtn.title = '删除拼图块';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deletePiece(piece.id);
      });
      item.appendChild(delBtn);
    }

    item.addEventListener('click', () => selectPiece(piece.id));
    container.appendChild(item);
  }
}

function renderBoardLegend() {
  const container = document.getElementById('boardLegend');
  if (!container) return;
  container.innerHTML = '';
  const usedPieces = new Set();
  for (const pl of boardState.placements) {
    usedPieces.add(pl.pieceId);
  }
  if (usedPieces.size === 0) {
    container.innerHTML = '<span style="font-size:12px;color:var(--text-muted);">棋盘为空 — 从左侧选择拼图块开始摆放</span>';
    return;
  }
  for (const pieceId of usedPieces) {
    const piece = pieceLibrary.find(p => p.id === pieceId);
    if (!piece) continue;
    const count = countPieceUsage(pieceId);
    const item = document.createElement('div');
    item.className = 'legend-item';
    const swatch = document.createElement('div');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = piece.color;
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(`${piece.name} (${count}个)`));
    container.appendChild(item);
  }
}

function selectPiece(pieceId) {
  const piece = pieceLibrary.find(p => p.id === pieceId);
  if (!piece) return;

  if (activeSelection && activeSelection.pieceId === pieceId) {
    // Deselect
    activeSelection = null;
  } else {
    activeSelection = { pieceId, rotation: 0, flipH: false, flipV: false };
  }

  updateActivePiecePanel();
  refreshAll();
}

function deletePiece(pieceId) {
  const piece = pieceLibrary.find(p => p.id === pieceId);
  if (!piece) return;
  if (countPieceUsage(pieceId) > 0) {
    if (!confirm(`"${piece.name}" 已在棋盘上使用了 ${countPieceUsage(pieceId)} 次。删除拼图块会同时移除棋盘上对应的拼图。确定删除吗？`)) {
      return;
    }
    boardState.placements = boardState.placements.filter(p => p.pieceId !== pieceId);
  }
  pieceLibrary = pieceLibrary.filter(p => p.id !== pieceId);
  if (activeSelection && activeSelection.pieceId === pieceId) {
    activeSelection = null;
    updateActivePiecePanel();
  }
  saveLibrary(pieceLibrary);
  saveBoardSession();
  refreshAll();
}

function updateActivePiecePanel() {
  const panel = document.getElementById('activePiecePanel');
  const nameEl = document.getElementById('activePieceName');
  const countEl = document.getElementById('activePieceCount');

  if (!activeSelection) {
    panel.style.display = 'none';
    return;
  }

  const piece = pieceLibrary.find(p => p.id === activeSelection.pieceId);
  if (!piece) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = '';
  nameEl.textContent = piece.name + ' ' + getTransformLabel(activeSelection);
  countEl.textContent = `已使用: ${countPieceUsage(activeSelection.pieceId)} 个`;
  renderActivePreview();
}

function getTransformLabel(sel) {
  const parts = [];
  if (sel.rotation > 0) parts.push(sel.rotation * 90 + '°');
  if (sel.flipH) parts.push('水平翻转');
  if (sel.flipV) parts.push('垂直翻转');
  return parts.length > 0 ? '[' + parts.join(', ') + ']' : '';
}

function rotateActive() {
  if (!activeSelection) return;
  activeSelection.rotation = (activeSelection.rotation + 1) % 4;
  updateActivePiecePanel();
  refreshAll();
}

function flipActiveH() {
  if (!activeSelection) return;
  activeSelection.flipH = !activeSelection.flipH;
  updateActivePiecePanel();
  refreshAll();
}

function flipActiveV() {
  if (!activeSelection) return;
  activeSelection.flipV = !activeSelection.flipV;
  updateActivePiecePanel();
  refreshAll();
}

function deselectActive() {
  activeSelection = null;
  updateActivePiecePanel();
  refreshAll();
}

/* ═══════════════════════════════════════════════════════════
   PIECE DESIGNER
   ═══════════════════════════════════════════════════════════ */

let designerCells = [];  // boolean[8][8]

function renderDesigner() {
  const canvas = document.getElementById('designerCanvas');
  if (!canvas) return;
  const size = 240;
  const gridSize = 8;
  const cellSize = size / gridSize;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  // Cells
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (designerCells[r] && designerCells[r][c]) {
        ctx.fillStyle = '#6C5CE7';
        ctx.fillRect(c * cellSize + 1, r * cellSize + 1, cellSize - 2, cellSize - 2);
      }
      ctx.strokeStyle = '#dee2e6';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
    }
  }
}

function designerClick(e) {
  const canvas = document.getElementById('designerCanvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const gridSize = 8;
  const cellSize = canvas.width / gridSize;
  const c = Math.floor(x / cellSize);
  const r = Math.floor(y / cellSize);
  if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) return;
  if (!designerCells[r]) designerCells[r] = [];
  designerCells[r][c] = !designerCells[r][c];
  renderDesigner();
}

function getDesignerShape() {
  const coords = [];
  for (let r = 0; r < 8; r++) {
    if (!designerCells[r]) continue;
    for (let c = 0; c < 8; c++) {
      if (designerCells[r][c]) coords.push([r, c]);
    }
  }
  return normalizeCoords(coords);
}

function isConnected(shape) {
  if (shape.length <= 1) return true;
  const set = new Set(shape.map(([r, c]) => `${r},${c}`));
  const visited = new Set();
  const queue = [`${shape[0][0]},${shape[0][1]}`];
  visited.add(queue[0]);
  while (queue.length > 0) {
    const [r, c] = queue.shift().split(',').map(Number);
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = r + dr;
      const nc = c + dc;
      const key = `${nr},${nc}`;
      if (set.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(key);
      }
    }
  }
  return visited.size === shape.length;
}

function saveDesignedPiece() {
  const shape = getDesignerShape();
  if (shape.length === 0) {
    alert('请先在网格中选择至少一个格子。');
    return;
  }
  if (!isConnected(shape)) {
    if (!confirm('设计的形状不是连通的（格子必须边相邻连接在一起）。确定要保存吗？')) {
      return;
    }
  }
  const nameInput = document.getElementById('designerName');
  const name = nameInput.value.trim() || ('拼图块 ' + (pieceLibrary.length + 1));
  const color = DEFAULT_PALETTE[paletteIdx % DEFAULT_PALETTE.length];
  paletteIdx++;
  const id = 'piece_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const piece = { id, name, shape, color };
  pieceLibrary.push(piece);
  saveLibrary(pieceLibrary);

  // Reset designer
  designerCells = [];
  renderDesigner();
  nameInput.value = '';
  refreshAll();

  // Select the new piece
  selectPiece(id);
}

/* ═══════════════════════════════════════════════════════════
   TOOLBAR CONTROLS
   ═══════════════════════════════════════════════════════════ */

function updateBoardSize() {
  const rowsInput = document.getElementById('boardRows');
  const colsInput = document.getElementById('boardCols');
  const newRows = parseInt(rowsInput.value) || 8;
  const newCols = parseInt(colsInput.value) || 8;
  const clampedRows = Math.max(2, Math.min(50, newRows));
  const clampedCols = Math.max(2, Math.min(50, newCols));
  rowsInput.value = clampedRows;
  colsInput.value = clampedCols;

  if (clampedRows !== boardState.rows || clampedCols !== boardState.cols) {
    // Check if any placed pieces would be out of bounds
    let clipped = 0;
    const validPlacements = [];
    for (const pl of boardState.placements) {
      const piece = pieceLibrary.find(p => p.id === pl.pieceId);
      if (!piece) continue;
      const coords = getTransformedCoords(piece.shape, pl.rotation, pl.flipH, pl.flipV);
      let ok = true;
      for (const [dr, dc] of coords) {
        const r = pl.originR + dr;
        const c = pl.originC + dc;
        if (r < 0 || r >= clampedRows || c < 0 || c >= clampedCols) { ok = false; break; }
      }
      if (ok) {
        validPlacements.push(pl);
      } else {
        clipped++;
      }
    }
    if (clipped > 0) {
      if (!confirm(`更改棋盘尺寸将移除 ${clipped} 个超出边界的拼图块。确定继续吗？`)) {
        rowsInput.value = boardState.rows;
        colsInput.value = boardState.cols;
        return;
      }
    }
    boardState.rows = clampedRows;
    boardState.cols = clampedCols;
    boardState.placements = validPlacements;
    cachedCellSize = null;
    recalcCellSize();
    saveBoardSession();
    refreshAll();
  }
}

function saveSession() {
  saveBoardSession();
  saveLibrary(pieceLibrary);
  // Flash feedback
  const btn = document.getElementById('btnSaveSession');
  const orig = btn.textContent;
  btn.textContent = '✅ 已保存';
  btn.style.color = '#00B894';
  setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
}

function loadSession() {
  boardState = loadBoardSession();
  document.getElementById('boardRows').value = boardState.rows;
  document.getElementById('boardCols').value = boardState.cols;
  activeSelection = null;
  updateActivePiecePanel();
  refreshAll();
}

/* ═══════════════════════════════════════════════════════════
   REFRESH ALL
   ═══════════════════════════════════════════════════════════ */

function refreshAll() {
  renderBoard();
  renderLibrary();
  renderBoardLegend();
  updateActivePiecePanel();
}

/* ═══════════════════════════════════════════════════════════
   INITIALIZATION & EVENT BINDING
   ═══════════════════════════════════════════════════════════ */

function init() {
  // Load data
  pieceLibrary = loadLibrary();
  boardState = loadBoardSession();
  paletteIdx = pieceLibrary.length;

  // Set board size inputs
  document.getElementById('boardRows').value = boardState.rows;
  document.getElementById('boardCols').value = boardState.cols;

  // Init designer
  designerCells = [];

  // Initial render
  refreshAll();
  renderDesigner();

  // ── Board canvas events ──
  const boardCanvas = document.getElementById('boardCanvas');
  boardCanvas.addEventListener('mousemove', function(e) {
    uiState.hoverCell = getCellFromEvent(e, boardCanvas);
    renderBoard();
  });
  boardCanvas.addEventListener('mouseleave', function() {
    uiState.hoverCell = null;
    renderBoard();
  });
  boardCanvas.addEventListener('click', function(e) {
    const cell = getCellFromEvent(e, boardCanvas);
    if (!cell) return;
    if (!activeSelection) return;
    const ok = placePiece(
      activeSelection.pieceId, cell.r, cell.c,
      activeSelection.rotation, activeSelection.flipH, activeSelection.flipV
    );
    if (ok) {
      saveBoardSession();
      if (!e.shiftKey) {
        // Single placement: deselect
        // Keep selected for repeated placement
        // Actually, let's keep selected so user can place multiple copies easily
        // User can press Esc to deselect
      }
      refreshAll();
    }
  });
  boardCanvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    if (activeSelection) {
      deselectActive();
    }
  });

  // ── Designer canvas events ──
  const designerCanvas = document.getElementById('designerCanvas');
  designerCanvas.addEventListener('click', designerClick);

  // ── Transform buttons ──
  document.getElementById('btnRotate').addEventListener('click', rotateActive);
  document.getElementById('btnFlipH').addEventListener('click', flipActiveH);
  document.getElementById('btnFlipV').addEventListener('click', flipActiveV);
  document.getElementById('btnDeselect').addEventListener('click', deselectActive);

  // ── Toolbar buttons ──
  document.getElementById('btnUpdateSize').addEventListener('click', updateBoardSize);
  document.getElementById('btnUndo').addEventListener('click', function() {
    if (undoPlacement()) {
      saveBoardSession();
      refreshAll();
    }
  });
  document.getElementById('btnClear').addEventListener('click', function() {
    clearBoard();
    saveBoardSession();
    refreshAll();
  });
  document.getElementById('btnSaveSession').addEventListener('click', saveSession);
  document.getElementById('btnLoadSession').addEventListener('click', loadSession);
  document.getElementById('btnSavePiece').addEventListener('click', saveDesignedPiece);
  document.getElementById('btnExport').addEventListener('click', exportLibrary);
  document.getElementById('btnImport').addEventListener('click', function() {
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', function(e) {
    if (e.target.files && e.target.files[0]) {
      importLibrary(e.target.files[0]);
      e.target.value = '';
    }
  });

  // ── Designer toggle ──
  document.getElementById('designerToggle').addEventListener('click', function() {
    const designer = document.getElementById('pieceDesigner');
    const toggle = document.getElementById('designerToggle');
    if (designer.style.display === 'none') {
      designer.style.display = '';
      toggle.classList.add('open');
    } else {
      designer.style.display = 'none';
      toggle.classList.remove('open');
    }
  });

  // ── Board size input: Enter to update ──
  document.getElementById('boardRows').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') updateBoardSize();
  });
  document.getElementById('boardCols').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') updateBoardSize();
  });

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', function(e) {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key.toLowerCase()) {
      case 'r':
        rotateActive();
        break;
      case 'h':
        flipActiveH();
        break;
      case 'v':
        flipActiveV();
        break;
      case 'escape':
        deselectActive();
        break;
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (undoPlacement()) {
            saveBoardSession();
            refreshAll();
          }
        }
        break;
    }
  });

  // ── Sidebar toggle (mobile) ──
  const sidebarEl = document.getElementById('sidebar');
  let overlayEl = null;

  function openSidebar() {
    sidebarEl.classList.add('open');
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'sidebar-overlay';
      document.getElementById('polyominoApp').appendChild(overlayEl);
      overlayEl.addEventListener('click', closeSidebar);
    }
    overlayEl.classList.add('active');
  }

  function closeSidebar() {
    sidebarEl.classList.remove('open');
    if (overlayEl) overlayEl.classList.remove('active');
  }

  function toggleSidebar() {
    if (sidebarEl.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  document.getElementById('sidebarToggleBtn').addEventListener('click', toggleSidebar);

  // Close sidebar when a piece is selected (on mobile)
  const origSelectPiece = selectPiece;
  selectPiece = function(pieceId) {
    origSelectPiece(pieceId);
    if (window.innerWidth <= 800) {
      closeSidebar();
    }
  };

  // ── Touch events for board ──
  const boardCanvas2 = document.getElementById('boardCanvas');
  boardCanvas2.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1) {
      // Single touch: simulate mouse click
      const touch = e.touches[0];
      const cell = getCellFromEvent(touch, boardCanvas2);
      if (cell && activeSelection) {
        e.preventDefault();
        const ok = placePiece(
          activeSelection.pieceId, cell.r, cell.c,
          activeSelection.rotation, activeSelection.flipH, activeSelection.flipV
        );
        if (ok) {
          saveBoardSession();
          refreshAll();
        }
      }
    }
  }, { passive: false });

  boardCanvas2.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1) {
      e.preventDefault();
      const touch = e.touches[0];
      uiState.hoverCell = getCellFromEvent(touch, boardCanvas2);
      renderBoard();
    }
  }, { passive: false });

  boardCanvas2.addEventListener('touchend', function(e) {
    uiState.hoverCell = null;
    renderBoard();
  });

  // ── Window resize ──
  window.addEventListener('resize', function() {
    cachedCellSize = null;
    recalcCellSize();
    renderBoard();
    // Reset sidebar state when crossing breakpoint
    if (window.innerWidth > 800) {
      sidebarEl.classList.remove('open');
      if (overlayEl) overlayEl.classList.remove('active');
    }
  });

  // ── Auto-save on page unload ──
  window.addEventListener('beforeunload', function() {
    saveBoardSession();
    saveLibrary(pieceLibrary);
  });
}

// Start the application
document.addEventListener('DOMContentLoaded', init);
