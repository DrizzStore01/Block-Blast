export type GameMode = 'daily' | 'classic';
export type GameLifecycleState = 'title' | 'playing' | 'paused' | 'gameover';

export type CellHazard = 'none' | 'stone' | 'gem' | 'ember';

export interface BoardCell {
  filled: boolean;
  colorId: number; // 0 = empty, 1..6 = palette colors
  hazard: CellHazard;
  durability: number; // 1 = normal, 2 = stone shield (requires 2 clears)
  emberTimer?: number; // countdown moves remaining for ember hazard
}

export interface PolyominoShape {
  id: string;
  name: string;
  cells: [number, number][]; // [rowOffset, colOffset] from top-left (0,0)
  width: number;
  height: number;
  colorId: number;
  tier: 1 | 2 | 3; // 1 = easy, 2 = medium, 3 = hard
}

export interface TrayPiece {
  uid: string;
  shape: PolyominoShape;
  placed: boolean;
  hasGem?: boolean;
  gemCellIndex?: number;
}

export interface PlacementResult {
  valid: boolean;
  board: BoardCell[][];
  clearedRows: number[];
  clearedCols: number[];
  crackedCells: [number, number][];
  gemsCollected: number;
  embersDefused: number;
  pointsEarned: number;
  newCombo: number;
  isAllClear: boolean;
  cellsClearedCount: number;
}

export interface RunSnapshot {
  mode: GameMode;
  score: number;
  bestScore: number;
  linesCleared: number;
  maxCombo: number;
  movesPlayed: number;
  isVictory: boolean;
  targetScore: number;
  dailyDateKey: string;
}

export const BOARD_SIZE = 8;
export const DAILY_TARGET_SCORE = 1200;

export const BLOCK_PALETTE: Record<
  number,
  { main: string; light: string; dark: string; accent: string; name: string }
> = {
  1: {
    name: 'Terracotta',
    main: '#E06D53',
    light: '#F29680',
    dark: '#A8442E',
    accent: '#FFD4CA',
  },
  2: {
    name: 'Amber Gold',
    main: '#E9A825',
    light: '#FAD06C',
    dark: '#AD750B',
    accent: '#FFF0C2',
  },
  3: {
    name: 'Jade Teal',
    main: '#2AB7CA',
    light: '#6CE0F0',
    dark: '#177E8C',
    accent: '#C9F9FF',
  },
  4: {
    name: 'Sage Moss',
    main: '#52B788',
    light: '#8CE0B9',
    dark: '#2D7A56',
    accent: '#D8F3DC',
  },
  5: {
    name: 'Cobalt Slate',
    main: '#5C7AEA',
    light: '#94AAFF',
    dark: '#354EA6',
    accent: '#DCE4FF',
  },
  6: {
    name: 'Coral Rose',
    main: '#E05378',
    light: '#F58AA6',
    dark: '#9E2B49',
    accent: '#FFD6E0',
  },
};

function makeShape(
  id: string,
  name: string,
  coords: [number, number][],
  colorId: number,
  tier: 1 | 2 | 3
): PolyominoShape {
  let maxR = 0;
  let maxC = 0;
  for (const [r, c] of coords) {
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  return {
    id,
    name,
    cells: coords,
    height: maxR + 1,
    width: maxC + 1,
    colorId,
    tier,
  };
}

export const SHAPE_CATALOG: PolyominoShape[] = [
  // Tier 1: Flexible & Friendly
  makeShape('dot-1', 'Mono', [[0, 0]], 2, 1),
  makeShape('domino-h', 'Domino H', [[0, 0], [0, 1]], 3, 1),
  makeShape('domino-v', 'Domino V', [[0, 0], [1, 0]], 3, 1),
  makeShape('tri-h', 'Tri Bar H', [[0, 0], [0, 1], [0, 2]], 1, 1),
  makeShape('tri-v', 'Tri Bar V', [[0, 0], [1, 0], [2, 0]], 1, 1),
  makeShape('corner-tl', 'Sudut Kiri Atas', [[0, 0], [0, 1], [1, 0]], 4, 1),
  makeShape('corner-tr', 'Sudut Kanan Atas', [[0, 0], [0, 1], [1, 1]], 4, 1),
  makeShape('corner-bl', 'Sudut Kiri Bawah', [[0, 0], [1, 0], [1, 1]], 4, 1),
  makeShape('corner-br', 'Sudut Kanan Bawah', [[0, 1], [1, 0], [1, 1]], 4, 1),
  makeShape('sq-2x2', 'Kotak 2x2', [[0, 0], [0, 1], [1, 0], [1, 1]], 2, 1),

  // Tier 2: Standard Tactical Tetrominoes
  makeShape('bar-4h', 'Garis 4H', [[0, 0], [0, 1], [0, 2], [0, 3]], 5, 2),
  makeShape('bar-4v', 'Garis 4V', [[0, 0], [1, 0], [2, 0], [3, 0]], 5, 2),
  makeShape('t-up', 'T Atas', [[0, 1], [1, 0], [1, 1], [1, 2]], 6, 2),
  makeShape('t-down', 'T Bawah', [[0, 0], [0, 1], [0, 2], [1, 1]], 6, 2),
  makeShape('t-left', 'T Kiri', [[0, 1], [1, 0], [1, 1], [2, 1]], 6, 2),
  makeShape('t-right', 'T Kanan', [[0, 0], [1, 0], [1, 1], [2, 0]], 6, 2),
  makeShape('l-right', 'L Kanan', [[0, 0], [1, 0], [2, 0], [2, 1]], 1, 2),
  makeShape('l-left', 'L Kiri', [[0, 1], [1, 1], [2, 0], [2, 1]], 1, 2),
  makeShape('l-horiz-1', 'L Mendatar', [[0, 0], [0, 1], [0, 2], [1, 0]], 1, 2),
  makeShape('l-horiz-2', 'J Mendatar', [[0, 0], [1, 0], [1, 1], [1, 2]], 1, 2),
  makeShape('z-horiz', 'Z Mendatar', [[0, 0], [0, 1], [1, 1], [1, 2]], 4, 2),
  makeShape('s-horiz', 'S Mendatar', [[0, 1], [0, 2], [1, 0], [1, 1]], 4, 2),

  // Tier 3: High-Reward Heavy Blocks
  makeShape('bar-5h', 'Garis 5H', [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], 3, 3),
  makeShape('bar-5v', 'Garis 5V', [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], 3, 3),
  makeShape('big-l-tl', 'L Besar Kiri Atas', [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], 5, 3),
  makeShape('big-l-tr', 'L Besar Kanan Atas', [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2]], 5, 3),
  makeShape('big-l-bl', 'L Besar Kiri Bawah', [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], 5, 3),
  makeShape('big-l-br', 'L Besar Kanan Bawah', [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]], 5, 3),
  makeShape('rect-2x3', 'Balok 2x3', [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], 2, 3),
  makeShape('rect-3x2', 'Balok 3x2', [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]], 2, 3),
  makeShape(
    'sq-3x3',
    'Monolit 3x3',
    [
      [0, 0], [0, 1], [0, 2],
      [1, 0], [1, 1], [1, 2],
      [2, 0], [2, 1], [2, 2],
    ],
    6,
    3
  ),
];

/**
 * Deterministic Mulberry32 PRNG
 */
export function createSeededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getTodayDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function hashDateKeyToSeed(dateKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateKey.length; i++) {
    h ^= dateKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createEmptyCell(): BoardCell {
  return {
    filled: false,
    colorId: 0,
    hazard: 'none',
    durability: 0,
  };
}

export function createEmptyBoard(): BoardCell[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => createEmptyCell())
  );
}

export function cloneBoard(board: BoardCell[][]): BoardCell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

/**
 * Creates a Daily Challenge initial board with deterministic symmetric pattern
 * including Stone Shield (2-hit durability) and Bonus Gem blocks.
 */
export function createDailyInitialBoard(dateKey: string): BoardCell[][] {
  const board = createEmptyBoard();
  const rng = createSeededRng(hashDateKeyToSeed(dateKey));

  // Place 4 symmetric pairs of sculptured starting blocks in center/edges
  const pairCount = 4;
  for (let i = 0; i < pairCount; i++) {
    const r = Math.floor(rng() * 4) + 2; // rows 2..5
    const c = Math.floor(rng() * 4); // cols 0..3
    const mirrorC = BOARD_SIZE - 1 - c;
    const colorId = (Math.floor(rng() * 6) % 6) + 1;
    const isStone = i === 0;
    const isGem = i === 1;

    const cellTemplate: BoardCell = {
      filled: true,
      colorId,
      hazard: isStone ? 'stone' : isGem ? 'gem' : 'none',
      durability: isStone ? 2 : 1,
    };

    board[r][c] = { ...cellTemplate };
    board[r][mirrorC] = { ...cellTemplate };
  }

  return board;
}

/**
 * Checks whether a polyomino shape can be legally placed at (anchorRow, anchorCol).
 */
export function canPlacePiece(
  board: BoardCell[][],
  shape: PolyominoShape,
  anchorRow: number,
  anchorCol: number
): boolean {
  for (const [dr, dc] of shape.cells) {
    const r = anchorRow + dr;
    const c = anchorCol + dc;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) {
      return false;
    }
    if (board[r][c].filled) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if a shape has at least one valid placement anywhere on the board.
 */
export function canPlaceShapeAnywhere(board: BoardCell[][], shape: PolyominoShape): boolean {
  for (let r = 0; r <= BOARD_SIZE - shape.height; r++) {
    for (let c = 0; c <= BOARD_SIZE - shape.width; c++) {
      if (canPlacePiece(board, shape, r, c)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if any unplaced piece in the current tray can be placed on the board.
 */
export function hasValidMoveForTray(board: BoardCell[][], tray: TrayPiece[]): boolean {
  const activePieces = tray.filter((p) => !p.placed);
  if (activePieces.length === 0) return true;
  return activePieces.some((piece) => canPlaceShapeAnywhere(board, piece.shape));
}

/**
 * Computes which rows and columns would be completed if `shape` were placed at `(anchorRow, anchorCol)`.
 */
export function previewLinesToClear(
  board: BoardCell[][],
  shape: PolyominoShape,
  anchorRow: number,
  anchorCol: number
): { rows: number[]; cols: number[] } {
  if (!canPlacePiece(board, shape, anchorRow, anchorCol)) {
    return { rows: [], cols: [] };
  }

  const placedSet = new Set<string>();
  for (const [dr, dc] of shape.cells) {
    placedSet.add(`${anchorRow + dr},${anchorCol + dc}`);
  }

  const rows: number[] = [];
  const cols: number[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    let full = true;
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (!board[r][c].filled && !placedSet.has(`${r},${c}`)) {
        full = false;
        break;
      }
    }
    if (full) rows.push(r);
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let full = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (!board[r][c].filled && !placedSet.has(`${r},${c}`)) {
        full = false;
        break;
      }
    }
    if (full) cols.push(c);
  }

  return { rows, cols };
}

/**
 * Pure scoring formula for a block placement and any resulting line clears.
 */
export function calculatePlacementScore(params: {
  blocksPlaced: number;
  linesCleared: number;
  comboCount: number;
  gemsCollected: number;
  embersDefused: number;
  isAllClear: boolean;
}): number {
  const {
    blocksPlaced,
    linesCleared,
    comboCount,
    gemsCollected,
    embersDefused,
    isAllClear,
  } = params;

  const basePlacementPts = blocksPlaced * 5;
  if (linesCleared === 0) {
    return basePlacementPts;
  }

  // Multi-line exponential reward: 1 line = 40, 2 = 100, 3 = 200, 4 = 360, 5+ = 600
  const lineMultipliers = [0, 40, 100, 200, 360, 600, 900];
  const lineBase =
    lineMultipliers[Math.min(linesCleared, lineMultipliers.length - 1)] ||
    linesCleared * 150;

  const comboBonus = comboCount > 1 ? Math.round(lineBase * (comboCount - 1) * 0.35) : 0;
  const gemBonus = gemsCollected * 80;
  const emberBonus = embersDefused * 100;
  const allClearBonus = isAllClear ? 300 : 0;

  return basePlacementPts + lineBase + comboBonus + gemBonus + emberBonus + allClearBonus;
}

/**
 * Executes a piece placement on a cloned board, resolves line clears, stone shield cracks,
 * gem pickups, ember countdowns, and returns the complete PlacementResult.
 */
export function placePiece(
  board: BoardCell[][],
  piece: TrayPiece,
  anchorRow: number,
  anchorCol: number,
  currentCombo: number
): PlacementResult {
  if (!canPlacePiece(board, piece.shape, anchorRow, anchorCol)) {
    return {
      valid: false,
      board,
      clearedRows: [],
      clearedCols: [],
      crackedCells: [],
      gemsCollected: 0,
      embersDefused: 0,
      pointsEarned: 0,
      newCombo: currentCombo,
      isAllClear: false,
      cellsClearedCount: 0,
    };
  }

  const nextBoard = cloneBoard(board);
  const { shape } = piece;

  // 1. Place the piece cells
  shape.cells.forEach(([dr, dc], idx) => {
    const r = anchorRow + dr;
    const c = anchorCol + dc;
    const isGemCell = Boolean(piece.hasGem && piece.gemCellIndex === idx);
    nextBoard[r][c] = {
      filled: true,
      colorId: shape.colorId,
      hazard: isGemCell ? 'gem' : 'none',
      durability: 1,
    };
  });

  // 2. Detect full rows and columns simultaneously
  const clearedRows: number[] = [];
  const clearedCols: number[] = [];

  for (let r = 0; r < BOARD_SIZE; r++) {
    if (nextBoard[r].every((cell) => cell.filled)) {
      clearedRows.push(r);
    }
  }

  for (let c = 0; c < BOARD_SIZE; c++) {
    let colFull = true;
    for (let r = 0; r < BOARD_SIZE; r++) {
      if (!nextBoard[r][c].filled) {
        colFull = false;
        break;
      }
    }
    if (colFull) {
      clearedCols.push(c);
    }
  }

  const totalLines = clearedRows.length + clearedCols.length;
  const crackedCells: [number, number][] = [];
  let gemsCollected = 0;
  let embersDefused = 0;
  let cellsClearedCount = 0;

  if (totalLines > 0) {
    // Collect unique coordinates in cleared rows & cols
    const targetCoords = new Set<string>();
    for (const r of clearedRows) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        targetCoords.add(`${r},${c}`);
      }
    }
    for (const c of clearedCols) {
      for (let r = 0; r < BOARD_SIZE; r++) {
        targetCoords.add(`${r},${c}`);
      }
    }

    for (const key of targetCoords) {
      const [rStr, cStr] = key.split(',');
      const r = Number(rStr);
      const c = Number(cStr);
      const cell = nextBoard[r][c];

      if (cell.hazard === 'stone' && cell.durability > 1) {
        // Stone Shield cracks on first clear and turns into normal 1-HP block
        nextBoard[r][c] = {
          ...cell,
          hazard: 'none',
          durability: 1,
        };
        crackedCells.push([r, c]);
      } else {
        if (cell.hazard === 'gem') gemsCollected++;
        if (cell.hazard === 'ember') embersDefused++;
        nextBoard[r][c] = createEmptyCell();
        cellsClearedCount++;
      }
    }
  }

  // 3. Advance Ember countdown hazards on remaining board cells (if any exist)
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = nextBoard[r][c];
      if (cell.filled && cell.hazard === 'ember' && typeof cell.emberTimer === 'number') {
        if (cell.emberTimer > 1) {
          cell.emberTimer -= 1;
        } else {
          // When ember timer hits 0 without being cleared, it petrifies into a 2-hit Stone block!
          cell.hazard = 'stone';
          cell.durability = 2;
          delete cell.emberTimer;
        }
      }
    }
  }

  // 4. Check All-Clear (entire 8x8 board is empty after a line clear)
  let remainingFilled = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (nextBoard[r][c].filled) remainingFilled++;
    }
  }
  const isAllClear = totalLines > 0 && remainingFilled === 0;

  const newCombo = totalLines > 0 ? currentCombo + 1 : 0;
  const pointsEarned = calculatePlacementScore({
    blocksPlaced: shape.cells.length,
    linesCleared: totalLines,
    comboCount: newCombo,
    gemsCollected,
    embersDefused,
    isAllClear,
  });

  return {
    valid: true,
    board: nextBoard,
    clearedRows,
    clearedCols,
    crackedCells,
    gemsCollected,
    embersDefused,
    pointsEarned,
    newCombo,
    isAllClear,
    cellsClearedCount,
  };
}

/**
 * Generates 3 new TrayPieces with a difficulty ramp based on current score
 * and smart solvability guarantees so the opening game feels fair and rewarding.
 */
export function generateTrayPieces(
  board: BoardCell[][],
  score: number,
  rng: () => number,
  dealIndex: number
): TrayPiece[] {
  // Determine tier weights from score (Multi-knob difficulty ramp)
  // Opening (< 300 pts): mostly Tier 1 & 2, very low Tier 3
  // Midgame (300 - 1200 pts): balanced Tier 1, 2, 3
  // Endgame (1200+ pts): higher Tier 2 & 3 density
  const tier1Pool = SHAPE_CATALOG.filter((s) => s.tier === 1);
  const tier2Pool = SHAPE_CATALOG.filter((s) => s.tier === 2);
  const tier3Pool = SHAPE_CATALOG.filter((s) => s.tier === 3);

  const pickWeightedShape = (): PolyominoShape => {
    const roll = rng();
    let pool: PolyominoShape[];
    if (score < 300) {
      pool = roll < 0.52 ? tier1Pool : roll < 0.90 ? tier2Pool : tier3Pool;
    } else if (score < 1000) {
      pool = roll < 0.35 ? tier1Pool : roll < 0.78 ? tier2Pool : tier3Pool;
    } else {
      pool = roll < 0.25 ? tier1Pool : roll < 0.65 ? tier2Pool : tier3Pool;
    }
    return pool[Math.floor(rng() * pool.length)];
  };

  const chosenShapes: PolyominoShape[] = [
    pickWeightedShape(),
    pickWeightedShape(),
    pickWeightedShape(),
  ];

  // Ensure at least 1 piece in the tray is immediately placeable on the current board
  const anyPlaceable = chosenShapes.some((s) => canPlaceShapeAnywhere(board, s));
  if (!anyPlaceable) {
    const placeableCandidates = SHAPE_CATALOG.filter((s) => canPlaceShapeAnywhere(board, s));
    if (placeableCandidates.length > 0) {
      chosenShapes[0] =
        placeableCandidates[Math.floor(rng() * placeableCandidates.length)];
    }
  }

  return chosenShapes.map((shape, idx) => {
    const hasGem = rng() < 0.22;
    const gemCellIndex = hasGem ? Math.floor(rng() * shape.cells.length) : undefined;
    return {
      uid: `piece-${dealIndex}-${idx}-${shape.id}`,
      shape,
      placed: false,
      hasGem,
      gemCellIndex,
    };
  });
}

/**
 * Spawns a periodic hazard telegraph (Ember Countdown or Gem) on an occupied cell
 * as difficulty ramps up, giving the player a visible 3-turn windup telegraph to clear that line.
 */
export function maybeSpawnBoardHazard(
  board: BoardCell[][],
  score: number,
  dealIndex: number,
  rng: () => number
): { board: BoardCell[][]; spawnedAt: [number, number] | null } {
  if (score < 250 || dealIndex % 2 !== 0) {
    return { board, spawnedAt: null };
  }

  const candidates: [number, number][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c].filled && board[r][c].hazard === 'none') {
        candidates.push([r, c]);
      }
    }
  }

  if (candidates.length === 0) {
    return { board, spawnedAt: null };
  }

  const [r, c] = candidates[Math.floor(rng() * candidates.length)];
  const nextBoard = cloneBoard(board);
  nextBoard[r][c] = {
    ...nextBoard[r][c],
    hazard: 'ember',
    emberTimer: 3, // 3 moves windup telegraph before petrifying into 2-HP Stone!
  };

  return { board: nextBoard, spawnedAt: [r, c] };
}

/**
 * Finds the highest-value valid move for any available tray piece (used for Hint button & tests).
 */
export function findBestMove(
  board: BoardCell[][],
  tray: TrayPiece[],
  currentCombo = 0
): {
  pieceIndex: number;
  row: number;
  col: number;
  estimatedScore: number;
  linesCleared: number;
} | null {
  let best: {
    pieceIndex: number;
    row: number;
    col: number;
    estimatedScore: number;
    linesCleared: number;
  } | null = null;

  tray.forEach((piece, pieceIndex) => {
    if (piece.placed) return;
    for (let r = 0; r <= BOARD_SIZE - piece.shape.height; r++) {
      for (let c = 0; c <= BOARD_SIZE - piece.shape.width; c++) {
        if (canPlacePiece(board, piece.shape, r, c)) {
          const sim = placePiece(board, piece, r, c, currentCombo);
          const linesCleared = sim.clearedRows.length + sim.clearedCols.length;
          // Prefer moves that clear lines or sit neatly near edges/neighbors
          const heuristic =
            sim.pointsEarned * 10 +
            linesCleared * 250 +
            sim.gemsCollected * 120 +
            sim.embersDefused * 180;
          if (!best || heuristic > best.estimatedScore) {
            best = {
              pieceIndex,
              row: r,
              col: c,
              estimatedScore: heuristic,
              linesCleared,
            };
          }
        }
      }
    }
  });

  return best;
}
