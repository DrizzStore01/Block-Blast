import {
  BOARD_SIZE,
  BLOCK_PALETTE,
  BoardCell,
  DAILY_TARGET_SCORE,
  GameLifecycleState,
  GameMode,
  PolyominoShape,
  RunSnapshot,
  SHAPE_CATALOG,
  TrayPiece,
  canPlacePiece,
  createDailyInitialBoard,
  createEmptyBoard,
  createSeededRng,
  findBestMove,
  generateTrayPieces,
  getTodayDateKey,
  hashDateKeyToSeed,
  hasValidMoveForTray,
  maybeSpawnBoardHazard,
  placePiece,
  previewLinesToClear,
} from './rules';
import { soundEngine } from './audio';
import { loadPlayerProgress, recordScoreUpdate } from './storage';

export interface HudSyncPayload {
  state: GameLifecycleState;
  mode: GameMode;
  score: number;
  bestScore: number;
  combo: number;
  maxCombo: number;
  linesCleared: number;
  streakCount: number;
  dailyCompletedToday: boolean;
  dailyTarget: number;
  traySummary: { index: number; placed: boolean; name: string; colorId: number }[];
  selectedTrayIndex: number;
  snapshot: RunSnapshot | null;
}

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
}

interface PooledPopup {
  active: boolean;
  x: number;
  y: number;
  text: string;
  subtext: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

interface PooledFlashCell {
  active: boolean;
  row: number;
  col: number;
  color: string;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 180;
const MAX_POPUPS = 16;
const MAX_FLASH_CELLS = 64;

export class BlockBlastCanvasEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private onHudSync: (payload: HudSyncPayload) => void;

  private rafId: number | null = null;
  private timerId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastTime = 0;

  // Viewport & Layout Geometry (computed dynamically in updateLayout)
  private width = 1440;
  private height = 900;
  private dpr = 1;

  private boardX = 0;
  private boardY = 0;
  private boardSizePx = 400;
  private cellSize = 50;

  private dockY = 0;
  private dockHeight = 130;
  private slotCenters: { x: number; y: number; w: number; h: number }[] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];

  // Game State
  private state: GameLifecycleState = 'title';
  private mode: GameMode = 'daily';
  private board: BoardCell[][] = createEmptyBoard();
  private tray: TrayPiece[] = [];
  private rng: () => number = createSeededRng(12345);
  private dealIndex = 0;

  private score = 0;
  private displayScore = 0;
  private combo = 0;
  private maxCombo = 0;
  private linesCleared = 0;
  private movesPlayed = 0;
  private dailyVictoryTriggered = false;
  private snapshot: RunSnapshot | null = null;

  // Input & Selection State
  private selectedTrayIndex = 0;
  private cursorRow = 3;
  private cursorCol = 3;
  private keyboardModeActive = false;

  private isDragging = false;
  private dragPieceIndex = -1;
  private pointerX = 0;
  private pointerY = 0;
  private pointerIsTouch = false;
  private hoverAnchorRow: number | null = null;
  private hoverAnchorCol: number | null = null;
  private lastSnapKey = '';

  // Hint highlight
  private hintTarget: { pieceIndex: number; row: number; col: number; timer: number } | null =
    null;

  // Juice, Hitstop & Trauma Shake
  private hitstopTimer = 0;
  private trauma = 0;
  private shakeX = 0;
  private shakeY = 0;
  private trayScale: [number, number, number] = [1, 1, 1];
  private cellPulse: number[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(0)
  );
  private ambientTime = 0;

  // Zero-GC Pre-allocated Pools
  private particles: PooledParticle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 6,
    color: '#E06D53',
    alpha: 1,
    life: 0,
    maxLife: 0.5,
    gravity: 300,
  }));
  private particleHead = 0;

  private popups: PooledPopup[] = Array.from({ length: MAX_POPUPS }, () => ({
    active: false,
    x: 0,
    y: 0,
    text: '',
    subtext: '',
    color: '#F4F1EA',
    life: 0,
    maxLife: 1,
    scale: 1,
  }));
  private popupHead = 0;

  private flashCells: PooledFlashCell[] = Array.from({ length: MAX_FLASH_CELLS }, () => ({
    active: false,
    row: 0,
    col: 0,
    color: '#F4F1EA',
    life: 0,
    maxLife: 0.35,
  }));
  private flashHead = 0;

  // Bound event listeners
  private boundPointerDown: (e: PointerEvent) => void;
  private boundPointerMove: (e: PointerEvent) => void;
  private boundPointerUp: (e: PointerEvent) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundBlur: () => void;
  private boundVisibility: () => void;

  constructor(canvas: HTMLCanvasElement, onHudSync: (payload: HudSyncPayload) => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('Could not initialize 2D context');
    }
    this.ctx = context;
    this.onHudSync = onHudSync;

    this.boundPointerDown = this.handlePointerDown.bind(this);
    this.boundPointerMove = this.handlePointerMove.bind(this);
    this.boundPointerUp = this.handlePointerUp.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundBlur = this.handleWindowBlur.bind(this);
    this.boundVisibility = this.handleVisibilityChange.bind(this);

    this.initSession('daily', 'title');
    this.attachListeners();
    this.updateLayout();
    this.lastTime = performance.now();
    this.requestFrame();
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.canvas.removeEventListener('pointerdown', this.boundPointerDown);
    window.removeEventListener('pointermove', this.boundPointerMove);
    window.removeEventListener('pointerup', this.boundPointerUp);
    window.removeEventListener('pointercancel', this.boundPointerUp);
    window.removeEventListener('keydown', this.boundKeyDown);
    window.removeEventListener('blur', this.boundBlur);
    document.removeEventListener('visibilitychange', this.boundVisibility);
  }

  private attachListeners(): void {
    this.canvas.addEventListener('pointerdown', this.boundPointerDown);
    window.addEventListener('pointermove', this.boundPointerMove);
    window.addEventListener('pointerup', this.boundPointerUp);
    window.addEventListener('pointercancel', this.boundPointerUp);
    window.addEventListener('keydown', this.boundKeyDown);
    window.addEventListener('blur', this.boundBlur);
    document.addEventListener('visibilitychange', this.boundVisibility);

    this.resizeObserver = new ResizeObserver(() => {
      this.updateLayout();
    });
    this.resizeObserver.observe(this.canvas);
  }

  private handleWindowBlur(): void {
    this.isDragging = false;
    this.dragPieceIndex = -1;
    this.hoverAnchorRow = null;
    this.hoverAnchorCol = null;
  }

  private handleVisibilityChange(): void {
    if (document.hidden) {
      this.handleWindowBlur();
    }
  }

  private updateLayout(): void {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || window.innerWidth));
    const h = Math.max(480, Math.round(rect.height || window.innerHeight));
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.width = w;
    this.height = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);

    // Reserve top HUD strip (~82px on mobile, ~88px on desktop) and bottom piece dock
    const topHudReserve = h < 700 ? 74 : 88;
    const bottomDockReserve = h < 700 ? 132 : 156;
    const availableH = Math.max(240, h - topHudReserve - bottomDockReserve - 24);
    const availableW = Math.max(240, Math.min(w - 28, 520));

    this.boardSizePx = Math.floor(Math.min(availableW, availableH) / BOARD_SIZE) * BOARD_SIZE;
    this.cellSize = this.boardSizePx / BOARD_SIZE;

    this.boardX = Math.round((w - this.boardSizePx) / 2);
    this.boardY = Math.round(topHudReserve + (availableH - this.boardSizePx) * 0.42);

    this.dockY = this.boardY + this.boardSizePx + 18;
    this.dockHeight = Math.min(138, h - this.dockY - 12);

    const slotW = this.boardSizePx / 3;
    for (let i = 0; i < 3; i++) {
      this.slotCenters[i] = {
        x: this.boardX + slotW * i + slotW * 0.5,
        y: this.dockY + this.dockHeight * 0.5,
        w: slotW - 10,
        h: this.dockHeight,
      };
    }
    this.requestFrame();
  }

  private screenToCanvas(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  public initSession(mode: GameMode, targetState: GameLifecycleState = 'playing'): void {
    this.mode = mode;
    this.state = targetState;
    document.body.dataset.state = targetState;

    const todayKey = getTodayDateKey();
    if (mode === 'daily') {
      const seed = hashDateKeyToSeed(todayKey);
      this.rng = createSeededRng(seed);
      this.board = createDailyInitialBoard(todayKey);
    } else {
      const seed = (Date.now() ^ 0x9e3779b9) >>> 0;
      this.rng = createSeededRng(seed);
      this.board = createEmptyBoard();
    }

    this.score = 0;
    this.displayScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.linesCleared = 0;
    this.movesPlayed = 0;
    this.dealIndex = 1;
    this.dailyVictoryTriggered = false;
    this.snapshot = null;
    this.hintTarget = null;
    this.isDragging = false;
    this.dragPieceIndex = -1;
    this.hoverAnchorRow = null;
    this.hoverAnchorCol = null;
    this.selectedTrayIndex = 0;
    this.cursorRow = 3;
    this.cursorCol = 3;

    this.tray = generateTrayPieces(this.board, 0, this.rng, this.dealIndex);
    this.trayScale = [0.2, 0.2, 0.2];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        this.cellPulse[r][c] = this.board[r][c].filled ? 0.4 : 0;
      }
    }

    this.syncHud();
    this.requestFrame();
  }

  public startGame(mode?: GameMode): void {
    const targetMode = mode || this.mode;
    this.initSession(targetMode, 'playing');
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    this.canvas.focus();
    soundEngine.playPickup();
    this.requestFrame();
  }

  public setMode(mode: GameMode): void {
    if (this.state === 'title') {
      this.initSession(mode, 'title');
    } else {
      this.startGame(mode);
    }
  }

  public togglePause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      document.body.dataset.state = 'paused';
      this.handleWindowBlur();
      this.syncHud();
      this.requestFrame();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      document.body.dataset.state = 'playing';
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      this.syncHud();
      this.requestFrame();
    }
  }

  public returnToTitle(): void {
    this.initSession(this.mode, 'title');
  }

  public triggerGameOverState(demoScore = 1353, demoLines = 10, demoCombo = 2): void {
    this.score = demoScore;
    this.displayScore = demoScore;
    this.linesCleared = demoLines;
    this.maxCombo = demoCombo;
    this.finishRun(false);
  }

  public triggerHint(): void {
    if (this.state !== 'playing') return;
    const best = findBestMove(this.board, this.tray, this.combo);
    if (best) {
      this.selectedTrayIndex = best.pieceIndex;
      this.cursorRow = best.row;
      this.cursorCol = best.col;
      this.hintTarget = {
        pieceIndex: best.pieceIndex,
        row: best.row,
        col: best.col,
        timer: 3.2,
      };
      this.trayScale[best.pieceIndex] = 1.25;
      soundEngine.playPickup();
      this.syncHud();
      this.requestFrame();
    } else {
      soundEngine.playInvalid();
    }
  }

  public selectTraySlot(index: number): void {
    if (this.state !== 'playing') return;
    if (index >= 0 && index < 3 && !this.tray[index]?.placed) {
      this.selectedTrayIndex = index;
      this.trayScale[index] = 1.2;
      soundEngine.playPickup();
      this.syncHud();
      this.requestFrame();
    }
  }

  private syncHud(): void {
    const progress = loadPlayerProgress();
    const todayKey = getTodayDateKey();
    const bestScore =
      this.mode === 'daily'
        ? Math.max(progress.dailyBest, this.score)
        : Math.max(progress.classicBest, this.score);

    this.onHudSync({
      state: this.state,
      mode: this.mode,
      score: this.score,
      bestScore,
      combo: this.combo,
      maxCombo: this.maxCombo,
      linesCleared: this.linesCleared,
      streakCount: progress.streakCount,
      dailyCompletedToday: progress.completedDailyDates.includes(todayKey),
      dailyTarget: DAILY_TARGET_SCORE,
      traySummary: this.tray.map((p, index) => ({
        index,
        placed: p.placed,
        name: p.shape.name,
        colorId: p.shape.colorId,
      })),
      selectedTrayIndex: this.selectedTrayIndex,
      snapshot: this.snapshot,
    });
  }

  // ============================================================================
  // POOLED JUICE SPAWNERS (Zero-GC in RAF)
  // ============================================================================

  private spawnParticles(x: number, y: number, color: string, count: number, speed = 220): void {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleHead];
      this.particleHead = (this.particleHead + 1) % MAX_PARTICLES;

      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = speed * (0.45 + Math.random() * 0.75);
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 14;
      p.y = y + (Math.random() - 0.5) * 14;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd - 60;
      p.size = 4 + Math.random() * 6;
      p.color = color;
      p.alpha = 1;
      p.life = 0;
      p.maxLife = 0.38 + Math.random() * 0.32;
      p.gravity = 420;
    }
  }

  private spawnPopup(
    x: number,
    y: number,
    text: string,
    subtext: string,
    color: string
  ): void {
    const pop = this.popups[this.popupHead];
    this.popupHead = (this.popupHead + 1) % MAX_POPUPS;
    pop.active = true;
    pop.x = Math.max(90, Math.min(this.width - 90, x));
    pop.y = Math.max(110, y);
    pop.text = text;
    pop.subtext = subtext;
    pop.color = color;
    pop.life = 0;
    pop.maxLife = 1.05;
    pop.scale = 0.6;
  }

  private spawnCellFlash(row: number, col: number, color: string): void {
    const f = this.flashCells[this.flashHead];
    this.flashHead = (this.flashHead + 1) % MAX_FLASH_CELLS;
    f.active = true;
    f.row = row;
    f.col = col;
    f.color = color;
    f.life = 0;
    f.maxLife = 0.34;
  }

  // ============================================================================
  // INPUT HANDLERS (Pointer + Keyboard)
  // ============================================================================

  private handlePointerDown(e: PointerEvent): void {
    const pos = this.screenToCanvas(e.clientX, e.clientY);
    this.pointerX = pos.x;
    this.pointerY = pos.y;
    this.pointerIsTouch = e.pointerType === 'touch' || this.width < 600;

    if (this.state !== 'playing') return;

    // 1. Check if pointer pressed on one of the 3 piece slots in the dock
    for (let i = 0; i < 3; i++) {
      const slot = this.slotCenters[i];
      const piece = this.tray[i];
      if (
        piece &&
        !piece.placed &&
        Math.abs(pos.x - slot.x) <= slot.w * 0.55 &&
        Math.abs(pos.y - slot.y) <= slot.h * 0.65
      ) {
        this.selectedTrayIndex = i;
        this.isDragging = true;
        this.dragPieceIndex = i;
        this.keyboardModeActive = false;
        this.trayScale[i] = 1.18;
        soundEngine.playPickup();
        this.updateDragHoverAnchor();
        this.syncHud();
        return;
      }
    }

    // 2. Check if pointer clicked directly inside the 8x8 board to place the currently selected tray piece
    const col = Math.floor((pos.x - this.boardX) / this.cellSize);
    const row = Math.floor((pos.y - this.boardY) / this.cellSize);
    if (row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE) {
      const selectedPiece = this.tray[this.selectedTrayIndex];
      if (selectedPiece && !selectedPiece.placed) {
        // Center the piece around the tapped cell or try exact top-left anchor
        const centeredRow = Math.max(
          0,
          Math.min(
            BOARD_SIZE - selectedPiece.shape.height,
            row - Math.floor((selectedPiece.shape.height - 1) / 2)
          )
        );
        const centeredCol = Math.max(
          0,
          Math.min(
            BOARD_SIZE - selectedPiece.shape.width,
            col - Math.floor((selectedPiece.shape.width - 1) / 2)
          )
        );

        if (canPlacePiece(this.board, selectedPiece.shape, row, col)) {
          this.commitPlacement(this.selectedTrayIndex, row, col);
          return;
        } else if (canPlacePiece(this.board, selectedPiece.shape, centeredRow, centeredCol)) {
          this.commitPlacement(this.selectedTrayIndex, centeredRow, centeredCol);
          return;
        } else {
          soundEngine.playInvalid();
          this.trauma = Math.min(1, this.trauma + 0.18);
          this.requestFrame();
        }
      }
    }
    this.requestFrame();
  }

  private handlePointerMove(e: PointerEvent): void {
    const pos = this.screenToCanvas(e.clientX, e.clientY);
    this.pointerX = pos.x;
    this.pointerY = pos.y;
    if (e.pointerType === 'touch') {
      this.pointerIsTouch = true;
    }

    if (this.state === 'playing' && this.isDragging && this.dragPieceIndex !== -1) {
      this.updateDragHoverAnchor();
      this.requestFrame();
    } else if (this.state === 'title') {
      this.requestFrame();
    }
  }

  private handlePointerUp(): void {
    if (this.state !== 'playing' || !this.isDragging) return;

    const idx = this.dragPieceIndex;
    const anchorR = this.hoverAnchorRow;
    const anchorC = this.hoverAnchorCol;

    this.isDragging = false;
    this.dragPieceIndex = -1;
    this.hoverAnchorRow = null;
    this.hoverAnchorCol = null;
    this.lastSnapKey = '';

    if (
      idx >= 0 &&
      anchorR !== null &&
      anchorC !== null &&
      this.tray[idx] &&
      !this.tray[idx].placed &&
      canPlacePiece(this.board, this.tray[idx].shape, anchorR, anchorC)
    ) {
      this.commitPlacement(idx, anchorR, anchorC);
    } else if (idx >= 0) {
      this.trayScale[idx] = 0.85;
      this.requestFrame();
    }
  }

  private updateDragHoverAnchor(): void {
    const piece = this.tray[this.dragPieceIndex];
    if (!piece || piece.placed) {
      this.hoverAnchorRow = null;
      this.hoverAnchorCol = null;
      return;
    }

    // Apply ergonomic touch vertical lift so user's thumb never covers the blocks
    const liftY = this.pointerIsTouch ? -this.cellSize * 1.65 : -this.cellSize * 0.35;
    const centerX = this.pointerX;
    const centerY = this.pointerY + liftY;

    const piecePixelW = piece.shape.width * this.cellSize;
    const piecePixelH = piece.shape.height * this.cellSize;
    const topLeftX = centerX - piecePixelW * 0.5;
    const topLeftY = centerY - piecePixelH * 0.5;

    const col = Math.round((topLeftX - this.boardX) / this.cellSize);
    const row = Math.round((topLeftY - this.boardY) / this.cellSize);

    // Check if near board bounds
    if (
      row >= -1 &&
      row <= BOARD_SIZE &&
      col >= -1 &&
      col <= BOARD_SIZE
    ) {
      const clampedRow = Math.max(0, Math.min(BOARD_SIZE - piece.shape.height, row));
      const clampedCol = Math.max(0, Math.min(BOARD_SIZE - piece.shape.width, col));

      // Check if within reasonable magnetic snap distance of the board
      const boardPad = this.cellSize * 1.15;
      const insideBoardRect =
        centerX >= this.boardX - boardPad &&
        centerX <= this.boardX + this.boardSizePx + boardPad &&
        centerY >= this.boardY - boardPad &&
        centerY <= this.boardY + this.boardSizePx + boardPad;

      if (insideBoardRect) {
        const snapKey = `${clampedRow},${clampedCol}`;
        if (snapKey !== this.lastSnapKey) {
          this.lastSnapKey = snapKey;
          if (canPlacePiece(this.board, piece.shape, clampedRow, clampedCol)) {
            soundEngine.playGridSnap();
          }
        }
        this.hoverAnchorRow = clampedRow;
        this.hoverAnchorCol = clampedCol;
        return;
      }
    }

    this.hoverAnchorRow = null;
    this.hoverAnchorCol = null;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return;

    // Title Screen shortcuts
    if (this.state === 'title') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startGame();
      }
      return;
    }

    // Pause shortcut
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (this.state === 'playing' || this.state === 'paused') {
        this.togglePause();
      }
      return;
    }

    // GameOver shortcut
    if (this.state === 'gameover') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.startGame();
      }
      return;
    }

    if (this.state !== 'playing') return;

    if (e.code === 'KeyM') {
      e.preventDefault();
      soundEngine.toggleMute();
      this.syncHud();
      return;
    }

    if (e.code === 'KeyR') {
      e.preventDefault();
      this.startGame();
      return;
    }

    if (e.code === 'KeyH') {
      e.preventDefault();
      this.triggerHint();
      return;
    }

    // Select tray piece with 1, 2, 3 or Tab
    if (e.code === 'Digit1' || e.code === 'Numpad1') {
      this.keyboardModeActive = true;
      this.selectTraySlot(0);
      return;
    }
    if (e.code === 'Digit2' || e.code === 'Numpad2') {
      this.keyboardModeActive = true;
      this.selectTraySlot(1);
      return;
    }
    if (e.code === 'Digit3' || e.code === 'Numpad3') {
      this.keyboardModeActive = true;
      this.selectTraySlot(2);
      return;
    }
    if (e.code === 'Tab') {
      e.preventDefault();
      this.keyboardModeActive = true;
      for (let step = 1; step <= 3; step++) {
        const nextIdx = (this.selectedTrayIndex + step) % 3;
        if (!this.tray[nextIdx]?.placed) {
          this.selectTraySlot(nextIdx);
          break;
        }
      }
      return;
    }

    // WASD / Arrow Keys move the ghost placement anchor
    const activePiece = this.tray[this.selectedTrayIndex];
    const maxR = activePiece ? BOARD_SIZE - activePiece.shape.height : BOARD_SIZE - 1;
    const maxC = activePiece ? BOARD_SIZE - activePiece.shape.width : BOARD_SIZE - 1;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      e.preventDefault();
      this.keyboardModeActive = true;
      this.cursorRow = Math.max(0, Math.min(maxR, this.cursorRow - 1));
      soundEngine.playGridSnap();
      this.requestFrame();
      return;
    }
    if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      e.preventDefault();
      this.keyboardModeActive = true;
      this.cursorRow = Math.max(0, Math.min(maxR, this.cursorRow + 1));
      soundEngine.playGridSnap();
      this.requestFrame();
      return;
    }
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
      e.preventDefault();
      this.keyboardModeActive = true;
      this.cursorCol = Math.max(0, Math.min(maxC, this.cursorCol - 1));
      soundEngine.playGridSnap();
      this.requestFrame();
      return;
    }
    if (e.code === 'KeyD' || e.code === 'ArrowRight') {
      e.preventDefault();
      this.keyboardModeActive = true;
      this.cursorCol = Math.max(0, Math.min(maxC, this.cursorCol + 1));
      soundEngine.playGridSnap();
      this.requestFrame();
      return;
    }

    // Space / Enter places the active piece at cursor (or at best valid spot if cursor is blocked)
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!activePiece || activePiece.placed) return;
      const clampedR = Math.max(0, Math.min(maxR, this.cursorRow));
      const clampedC = Math.max(0, Math.min(maxC, this.cursorCol));

      if (canPlacePiece(this.board, activePiece.shape, clampedR, clampedC)) {
        this.commitPlacement(this.selectedTrayIndex, clampedR, clampedC);
      } else {
        // If current cursor cell is blocked, check if hintTarget is active or if user pressed Space right after start
        const best = findBestMove(this.board, this.tray, this.combo);
        if (best && !this.keyboardModeActive) {
          this.commitPlacement(best.pieceIndex, best.row, best.col);
        } else {
          soundEngine.playInvalid();
          this.trauma = Math.min(1, this.trauma + 0.22);
          this.requestFrame();
        }
      }
    }
  }

  // ============================================================================
  // PLACEMENT EXECUTION & JUICE RESOLUTION
  // ============================================================================

  private commitPlacement(pieceIndex: number, anchorRow: number, anchorCol: number): void {
    const piece = this.tray[pieceIndex];
    if (!piece || piece.placed) return;

    const result = placePiece(this.board, piece, anchorRow, anchorCol, this.combo);
    if (!result.valid) {
      soundEngine.playInvalid();
      return;
    }

    this.board = result.board;
    piece.placed = true;
    this.movesPlayed += 1;
    this.hintTarget = null;

    // Pulse newly placed cells
    const palette = BLOCK_PALETTE[piece.shape.colorId] || BLOCK_PALETTE[1];
    for (const [dr, dc] of piece.shape.cells) {
      const r = anchorRow + dr;
      const c = anchorCol + dc;
      this.cellPulse[r][c] = 1.0;
      const cx = this.boardX + (c + 0.5) * this.cellSize;
      const cy = this.boardY + (r + 0.5) * this.cellSize;
      this.spawnParticles(cx, cy, palette.light, 3, 110);
    }

    const totalLines = result.clearedRows.length + result.clearedCols.length;
    this.score += result.pointsEarned;
    this.combo = result.newCombo;
    if (this.combo > this.maxCombo) {
      this.maxCombo = this.combo;
    }
    this.linesCleared += totalLines;

    const anchorCenterX =
      this.boardX + (anchorCol + piece.shape.width * 0.5) * this.cellSize;
    const anchorCenterY =
      this.boardY + (anchorRow + piece.shape.height * 0.5) * this.cellSize;

    if (totalLines > 0) {
      // Heavy multi-channel juice: hitstop + trauma camera shake + flash cells + particle burst
      this.hitstopTimer = Math.min(0.08, 0.032 + totalLines * 0.015);
      this.trauma = Math.min(1.0, 0.32 + totalLines * 0.18 + (this.combo > 1 ? 0.15 : 0));
      soundEngine.playLineClear(totalLines, this.combo, result.isAllClear);

      for (const r of result.clearedRows) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          this.spawnCellFlash(r, c, palette.light);
          const px = this.boardX + (c + 0.5) * this.cellSize;
          const py = this.boardY + (r + 0.5) * this.cellSize;
          this.spawnParticles(px, py, palette.main, 4, 240);
        }
      }
      for (const c of result.clearedCols) {
        for (let r = 0; r < BOARD_SIZE; r++) {
          this.spawnCellFlash(r, c, palette.light);
          const px = this.boardX + (c + 0.5) * this.cellSize;
          const py = this.boardY + (r + 0.5) * this.cellSize;
          this.spawnParticles(px, py, palette.accent, 4, 240);
        }
      }

      const label = result.isAllClear
        ? 'SAPU BERSIH! +300'
        : totalLines >= 3
        ? `MEGA BLAST ${totalLines} GARIS!`
        : totalLines === 2
        ? 'DOUBLE BLAST!'
        : 'GARIS HANCUR!';
      const subLabel =
        this.combo > 1 ? `KOMBO ${this.combo}x · +${result.pointsEarned}` : `+${result.pointsEarned}`;

      this.spawnPopup(anchorCenterX, anchorCenterY - 12, label, subLabel, palette.light);
    } else {
      soundEngine.playPlace(piece.shape.cells.length);
      this.spawnPopup(
        anchorCenterX,
        anchorCenterY - 10,
        `+${result.pointsEarned}`,
        '',
        '#F4F1EA'
      );
    }

    // Select next available piece in tray automatically
    const nextAvailableIdx = this.tray.findIndex((p) => !p.placed);
    if (nextAvailableIdx !== -1) {
      this.selectedTrayIndex = nextAvailableIdx;
    } else {
      // All 3 pieces placed! Deal 3 new pieces and maybe spawn a board hazard telegraph
      this.dealIndex += 1;
      const hazardUpdate = maybeSpawnBoardHazard(
        this.board,
        this.score,
        this.dealIndex,
        this.rng
      );
      this.board = hazardUpdate.board;
      if (hazardUpdate.spawnedAt) {
        const [hr, hc] = hazardUpdate.spawnedAt;
        this.cellPulse[hr][hc] = 1.0;
      }

      this.tray = generateTrayPieces(this.board, this.score, this.rng, this.dealIndex);
      this.trayScale = [0.15, 0.15, 0.15];
      this.selectedTrayIndex = 0;
    }

    // Clamp keyboard cursor to new active piece bounds
    const nextPiece = this.tray[this.selectedTrayIndex];
    if (nextPiece) {
      this.cursorRow = Math.min(this.cursorRow, BOARD_SIZE - nextPiece.shape.height);
      this.cursorCol = Math.min(this.cursorCol, BOARD_SIZE - nextPiece.shape.width);
    }

    // Persist progress
    const dailyTargetReached =
      this.mode === 'daily' && this.score >= DAILY_TARGET_SCORE;
    recordScoreUpdate(this.mode, this.score, totalLines, dailyTargetReached);

    // Check Daily Challenge Victory or Game Over (No Valid Moves Left)
    if (dailyTargetReached && !this.dailyVictoryTriggered) {
      this.dailyVictoryTriggered = true;
      this.finishRun(true);
      return;
    }

    if (!hasValidMoveForTray(this.board, this.tray)) {
      this.finishRun(false);
      return;
    }

    this.syncHud();
    this.requestFrame();
  }

  private finishRun(isVictory: boolean): void {
    const progress = loadPlayerProgress();
    const bestScore =
      this.mode === 'daily'
        ? Math.max(progress.dailyBest, this.score)
        : Math.max(progress.classicBest, this.score);

    this.snapshot = {
      mode: this.mode,
      score: this.score,
      bestScore,
      linesCleared: this.linesCleared,
      maxCombo: this.maxCombo,
      movesPlayed: this.movesPlayed,
      isVictory,
      targetScore: DAILY_TARGET_SCORE,
      dailyDateKey: getTodayDateKey(),
    };

    if (isVictory) {
      soundEngine.playVictory();
    } else {
      soundEngine.playGameOver();
    }

    this.state = 'gameover';
    document.body.dataset.state = 'gameover';
    this.syncHud();
    this.requestFrame();
  }

  // ============================================================================
  // 60FPS SIMULATION & RENDERING LOOP
  // ============================================================================

  private isHeadless(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      Boolean(navigator.webdriver || /HeadlessChrome/i.test(navigator.userAgent))
    );
  }

  private requestFrame(): void {
    if (!this.ctx) return;
    if (this.isHeadless()) {
      // In CPU headless Chromium, render synchronously on demand so screenshots never stall on RAF
      this.trayScale = [1, 1, 1];
      this.update(0.016);
      this.render();
      return;
    }
    if (this.rafId === null) {
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.loop.bind(this));
    }
  }

  private loop(now: number): void {
    this.rafId = null;
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.update(dt);
    this.render();

    if (!this.isHeadless()) {
      this.rafId = requestAnimationFrame(this.loop.bind(this));
    }
  }

  private update(dt: number): void {
    this.ambientTime += dt;

    // Smooth score ticker
    if (this.displayScore < this.score) {
      const diff = this.score - this.displayScore;
      this.displayScore += Math.max(1, Math.ceil(diff * Math.min(1, dt * 14)));
    } else if (this.displayScore > this.score) {
      this.displayScore = this.score;
    }

    // Decaying trauma camera shake (continues during hitstop)
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * 2.4);
      const shakeAmt = this.trauma * this.trauma * 11;
      this.shakeX = (Math.random() * 2 - 1) * shakeAmt;
      this.shakeY = (Math.random() * 2 - 1) * shakeAmt;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    // Update flash cells in real dt
    for (let i = 0; i < MAX_FLASH_CELLS; i++) {
      const f = this.flashCells[i];
      if (!f.active) continue;
      f.life += dt;
      if (f.life >= f.maxLife) f.active = false;
    }

    // Hitstop timer freezes simulation physics briefly on heavy line clears
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      return;
    }

    // Spring tray scale back to 1.0
    for (let i = 0; i < 3; i++) {
      this.trayScale[i] += (1.0 - this.trayScale[i]) * Math.min(1, dt * 14);
    }

    // Decay cell placement pulses
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (this.cellPulse[r][c] > 0) {
          this.cellPulse[r][c] = Math.max(0, this.cellPulse[r][c] - dt * 4.5);
        }
      }
    }

    // Hint timer
    if (this.hintTarget) {
      this.hintTarget.timer -= dt;
      if (this.hintTarget.timer <= 0) {
        this.hintTarget = null;
      }
    }

    // Update pooled particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = 1 - p.life / p.maxLife;
    }

    // Update pooled popups
    for (let i = 0; i < MAX_POPUPS; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      pop.life += dt;
      if (pop.life >= pop.maxLife) {
        pop.active = false;
        continue;
      }
      pop.y -= 28 * dt;
      pop.scale += (1.0 - pop.scale) * Math.min(1, dt * 16);
    }
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. Dominant Warm Obsidian Canvas (#141619)
    ctx.fillStyle = '#141619';
    ctx.fillRect(0, 0, this.width, this.height);

    // Subtle radial architectural spotlight behind board
    const grad = ctx.createRadialGradient(
      this.width * 0.5,
      this.boardY + this.boardSizePx * 0.5,
      20,
      this.width * 0.5,
      this.boardY + this.boardSizePx * 0.5,
      Math.max(this.width, this.height) * 0.65
    );
    grad.addColorStop(0, '#1E232B');
    grad.addColorStop(1, '#141619');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.state === 'title') {
      this.renderTitleBackdrop(ctx);
      ctx.restore();
      return;
    }

    // Apply decaying trauma shake to playfield
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    this.renderBoard(ctx);
    this.renderGhostAndPreviews(ctx);
    this.renderFlashCells(ctx);
    this.renderDock(ctx);
    this.renderDraggedPiece(ctx);
    this.renderParticles(ctx);
    this.renderPopups(ctx);

    ctx.restore();
    ctx.restore();
  }

  private renderTitleBackdrop(ctx: CanvasRenderingContext2D): void {
    const parallaxX = ((this.pointerX || this.width * 0.5) - this.width * 0.5) * 0.025;
    const parallaxY = ((this.pointerY || this.height * 0.5) - this.height * 0.5) * 0.025;

    // On mobile/tablet (< 960px), the TitleScreen card is centered and includes its own
    // interactive mode preview stage, so draw subtle floating ceramic blocks only in the
    // top and bottom perimeter margins so nothing bleeds behind the card text.
    if (this.width < 960) {
      ctx.save();
      const cellS = 22;
      const topShapes = [
        { shape: SHAPE_CATALOG[4], x: this.width * 0.14, y: this.height * 0.055 },
        { shape: SHAPE_CATALOG[12], x: this.width * 0.72, y: this.height * 0.045 },
        { shape: SHAPE_CATALOG[9], x: this.width * 0.16, y: this.height * 0.87 },
        { shape: SHAPE_CATALOG[5], x: this.width * 0.74, y: this.height * 0.865 },
      ];
      topShapes.forEach((item, idx) => {
        const bobX = Math.cos(this.ambientTime * 0.8 + idx * 1.7) * 6 + parallaxX * 0.4;
        const bobY = Math.sin(this.ambientTime * 1.1 + idx * 1.3) * 5 + parallaxY * 0.4;
        for (const [dr, dc] of item.shape.cells) {
          this.drawTactileCell(
            ctx,
            item.x + bobX + dc * cellS,
            item.y + bobY + dr * cellS,
            cellS - 3,
            item.shape.colorId,
            'none',
            1,
            undefined,
            1,
            0.35
          );
        }
      });
      ctx.restore();
      return;
    }

    // Interactive Hero Showcase on right/bottom-right on desktop leaving calm negative space on left

    const demoCell = Math.min(44, Math.max(28, Math.floor(Math.min(this.width, this.height) * 0.052)));
    const gridPx = demoCell * 6;
    const centerX = this.width * 0.68 + parallaxX;
    const centerY = this.height * 0.5 + parallaxY;

    const gx = centerX - gridPx * 0.5;
    const gy = centerY - gridPx * 0.5;

    ctx.save();
    // Subtle ambient board frame
    this.drawRoundedRect(ctx, gx - 12, gy - 12, gridPx + 24, gridPx + 24, 18);
    ctx.fillStyle = '#1B1F26';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(244, 241, 234, 0.08)';
    ctx.stroke();

    // Animated showcase blocks on the 6x6 stage
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const cx = gx + c * demoCell;
        const cy = gy + r * demoCell;
        this.drawRoundedRect(ctx, cx + 3, cy + 3, demoCell - 6, demoCell - 6, 7);
        ctx.fillStyle = '#232830';
        ctx.fill();

        const wave = Math.sin(this.ambientTime * 1.6 + r * 0.7 + c * 0.5);
        if ((r + c) % 3 === 0 || wave > 0.55) {
          const colorId = ((r * 2 + c) % 6) + 1;
          const pulse = Math.max(0, Math.sin(this.ambientTime * 2.2 + r + c) * 0.06);
          this.drawTactileCell(
            ctx,
            cx + 2,
            cy + 2,
            demoCell - 4,
            colorId,
            'none',
            1,
            undefined,
            1 + pulse,
            0.88
          );
        }
      }
    }

    // Orbiting floating polyomino showcase pieces
    const showcaseShapes = [SHAPE_CATALOG[4], SHAPE_CATALOG[9], SHAPE_CATALOG[12]];
    showcaseShapes.forEach((shape, i) => {
      const angle = this.ambientTime * 0.55 + i * ((Math.PI * 2) / 3);
      const radiusX = gridPx * 0.64;
      const radiusY = gridPx * 0.48;
      const fx = centerX + Math.cos(angle) * radiusX - (shape.width * demoCell * 0.75) / 2;
      const fy = centerY + Math.sin(angle) * radiusY - (shape.height * demoCell * 0.75) / 2;
      const cellS = demoCell * 0.75;

      for (const [dr, dc] of shape.cells) {
        this.drawTactileCell(
          ctx,
          fx + dc * cellS,
          fy + dr * cellS,
          cellS - 3,
          shape.colorId,
          'none',
          1,
          undefined,
          1,
          0.92
        );
      }
    });

    ctx.restore();
  }

  private renderBoard(ctx: CanvasRenderingContext2D): void {
    const pad = 10;

    // Outer Board Tray Frame
    this.drawRoundedRect(
      ctx,
      this.boardX - pad,
      this.boardY - pad,
      this.boardSizePx + pad * 2,
      this.boardSizePx + pad * 2,
      18
    );
    ctx.fillStyle = '#1B1F26';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(244, 241, 234, 0.1)';
    ctx.stroke();

    // 8x8 Recessed Sockets & Occupied Tactile Blocks
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const x = this.boardX + c * this.cellSize;
        const y = this.boardY + r * this.cellSize;
        const inset = 2.5;

        // Recessed socket
        this.drawRoundedRect(
          ctx,
          x + inset,
          y + inset,
          this.cellSize - inset * 2,
          this.cellSize - inset * 2,
          8
        );
        ctx.fillStyle = (r + c) % 2 === 0 ? '#222730' : '#252A34';
        ctx.fill();

        const cell = this.board[r][c];
        if (cell.filled) {
          const pulseScale = 1 + this.cellPulse[r][c] * 0.12;
          this.drawTactileCell(
            ctx,
            x + inset,
            y + inset,
            this.cellSize - inset * 2,
            cell.colorId,
            cell.hazard,
            cell.durability,
            cell.emberTimer,
            pulseScale,
            1
          );
        }
      }
    }
  }

  private renderGhostAndPreviews(ctx: CanvasRenderingContext2D): void {
    // 1. Render Hint Highlight if active
    if (this.hintTarget) {
      const hintPiece = this.tray[this.hintTarget.pieceIndex];
      if (hintPiece && !hintPiece.placed) {
        const alpha = 0.35 + Math.sin(this.ambientTime * 8) * 0.2;
        for (const [dr, dc] of hintPiece.shape.cells) {
          const r = this.hintTarget.row + dr;
          const c = this.hintTarget.col + dc;
          const x = this.boardX + c * this.cellSize + 3;
          const y = this.boardY + r * this.cellSize + 3;
          this.drawRoundedRect(ctx, x, y, this.cellSize - 6, this.cellSize - 6, 8);
          ctx.fillStyle = `rgba(233, 168, 37, ${alpha})`;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#FAD06C';
          ctx.stroke();
        }
      }
    }

    // 2. Determine active preview anchor (either from Dragging or Keyboard Cursor)
    let activePiece: TrayPiece | undefined;
    let anchorR: number | null = null;
    let anchorC: number | null = null;

    if (this.isDragging && this.dragPieceIndex !== -1) {
      activePiece = this.tray[this.dragPieceIndex];
      anchorR = this.hoverAnchorRow;
      anchorC = this.hoverAnchorCol;
    } else if (this.keyboardModeActive) {
      activePiece = this.tray[this.selectedTrayIndex];
      if (activePiece && !activePiece.placed) {
        anchorR = Math.max(0, Math.min(BOARD_SIZE - activePiece.shape.height, this.cursorRow));
        anchorC = Math.max(0, Math.min(BOARD_SIZE - activePiece.shape.width, this.cursorCol));
      }
    }

    if (!activePiece || activePiece.placed || anchorR === null || anchorC === null) {
      return;
    }

    const isValid = canPlacePiece(this.board, activePiece.shape, anchorR, anchorC);
    const palette = BLOCK_PALETTE[activePiece.shape.colorId] || BLOCK_PALETTE[1];

    if (isValid) {
      // Highlight rows & columns that will clear if dropped here!
      const preview = previewLinesToClear(this.board, activePiece.shape, anchorR, anchorC);
      const glowAlpha = 0.25 + Math.sin(this.ambientTime * 10) * 0.1;

      ctx.save();
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = glowAlpha;
      for (const r of preview.rows) {
        this.drawRoundedRect(
          ctx,
          this.boardX + 2,
          this.boardY + r * this.cellSize + 2,
          this.boardSizePx - 4,
          this.cellSize - 4,
          8
        );
        ctx.fill();
      }
      for (const c of preview.cols) {
        this.drawRoundedRect(
          ctx,
          this.boardX + c * this.cellSize + 2,
          this.boardY + 2,
          this.cellSize - 4,
          this.boardSizePx - 4,
          8
        );
        ctx.fill();
      }
      ctx.restore();

      // Draw translucent ghost piece on the board
      for (const [dr, dc] of activePiece.shape.cells) {
        const r = anchorR + dr;
        const c = anchorC + dc;
        const x = this.boardX + c * this.cellSize + 2.5;
        const y = this.boardY + r * this.cellSize + 2.5;
        this.drawTactileCell(
          ctx,
          x,
          y,
          this.cellSize - 5,
          activePiece.shape.colorId,
          'none',
          1,
          undefined,
          1,
          0.48
        );
      }
    } else if (this.keyboardModeActive) {
      // Draw red outline when keyboard cursor is over an occupied position
      for (const [dr, dc] of activePiece.shape.cells) {
        const r = anchorR + dr;
        const c = anchorC + dc;
        if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE) {
          const x = this.boardX + c * this.cellSize + 4;
          const y = this.boardY + r * this.cellSize + 4;
          this.drawRoundedRect(ctx, x, y, this.cellSize - 8, this.cellSize - 8, 7);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
  }

  private renderFlashCells(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < MAX_FLASH_CELLS; i++) {
      const f = this.flashCells[i];
      if (!f.active) continue;
      const progress = f.life / f.maxLife;
      const alpha = 1 - progress;
      const scale = 1 + progress * 0.25;
      const size = (this.cellSize - 4) * scale;
      const cx = this.boardX + (f.col + 0.5) * this.cellSize;
      const cy = this.boardY + (f.row + 0.5) * this.cellSize;

      ctx.save();
      ctx.globalAlpha = alpha;
      this.drawRoundedRect(ctx, cx - size * 0.5, cy - size * 0.5, size, size, 8);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    }
  }

  private renderDock(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < 3; i++) {
      const slot = this.slotCenters[i];
      const piece = this.tray[i];
      const isSelected = this.selectedTrayIndex === i && !piece?.placed;

      // Slot background card
      this.drawRoundedRect(
        ctx,
        slot.x - slot.w * 0.5,
        slot.y - slot.h * 0.46,
        slot.w,
        slot.h * 0.92,
        14
      );
      ctx.fillStyle = isSelected ? '#232933' : '#1B1F26';
      ctx.fill();
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeStyle = isSelected
        ? '#E06D53'
        : 'rgba(244, 241, 234, 0.08)';
      ctx.stroke();

      if (!piece || piece.placed) continue;
      if (this.isDragging && this.dragPieceIndex === i) continue;

      const canFitAnywhere = hasValidMoveForTray(this.board, [piece]);
      const maxDim = Math.max(piece.shape.width, piece.shape.height);
      const baseMiniCell = Math.max(
        14,
        Math.min(
          (slot.w - 26) / Math.max(3, maxDim),
          (slot.h * 0.72) / Math.max(3, maxDim),
          28
        )
      );
      const miniCell = Math.max(12, baseMiniCell * Math.max(0.7, this.trayScale[i]));

      const totalW = piece.shape.width * miniCell;
      const totalH = piece.shape.height * miniCell;
      const startX = slot.x - totalW * 0.5;
      const startY = slot.y - totalH * 0.5 + 3;

      piece.shape.cells.forEach(([dr, dc], cellIdx) => {
        const isGem = Boolean(piece.hasGem && piece.gemCellIndex === cellIdx);
        this.drawTactileCell(
          ctx,
          startX + dc * miniCell + 1.5,
          startY + dr * miniCell + 1.5,
          Math.max(8, miniCell - 3),
          piece.shape.colorId,
          isGem ? 'gem' : 'none',
          1,
          undefined,
          1,
          canFitAnywhere ? 1 : 0.32
        );
      });
    }
  }

  private renderDraggedPiece(ctx: CanvasRenderingContext2D): void {
    if (!this.isDragging || this.dragPieceIndex === -1) return;
    const piece = this.tray[this.dragPieceIndex];
    if (!piece || piece.placed) return;

    const liftY = this.pointerIsTouch ? -this.cellSize * 1.65 : -this.cellSize * 0.35;
    const drawCellSize = this.cellSize * 0.94;
    const totalW = piece.shape.width * drawCellSize;
    const totalH = piece.shape.height * drawCellSize;
    const startX = this.pointerX - totalW * 0.5;
    const startY = this.pointerY + liftY - totalH * 0.5;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;

    piece.shape.cells.forEach(([dr, dc], cellIdx) => {
      const isGem = Boolean(piece.hasGem && piece.gemCellIndex === cellIdx);
      this.drawTactileCell(
        ctx,
        startX + dc * drawCellSize + 2,
        startY + dr * drawCellSize + 2,
        drawCellSize - 4,
        piece.shape.colorId,
        isGem ? 'gem' : 'none',
        1,
        undefined,
        1,
        0.96
      );
    });

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      this.drawRoundedRect(ctx, p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size, 3);
      ctx.fill();
      ctx.restore();
    }
  }

  private renderPopups(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < MAX_POPUPS; i++) {
      const pop = this.popups[i];
      if (!pop.active) continue;
      const alpha = Math.min(1, (1 - pop.life / pop.maxLife) * 1.5);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(pop.x, pop.y);
      ctx.scale(pop.scale, pop.scale);

      ctx.font = '800 20px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#141619';
      ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, 0, 0);

      if (pop.subtext) {
        ctx.font = '700 13px ui-monospace, monospace';
        ctx.strokeText(pop.subtext, 0, 20);
        ctx.fillStyle = '#FAD06C';
        ctx.fillText(pop.subtext, 0, 20);
      }

      ctx.restore();
    }
  }

  // ============================================================================
  // TACTILE BLOCK & HAZARD PRIMITIVE RENDERER
  // ============================================================================

  private drawTactileCell(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rawSize: number,
    colorId: number,
    hazard: BoardCell['hazard'],
    durability: number,
    emberTimer: number | undefined,
    scale = 1,
    alpha = 1
  ): void {
    const size = Math.max(8, rawSize);
    const palette = BLOCK_PALETTE[colorId] || BLOCK_PALETTE[1];
    ctx.save();
    ctx.globalAlpha = alpha;

    if (scale !== 1) {
      const cx = x + size * 0.5;
      const cy = y + size * 0.5;
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
    }

    const r = Math.max(3, Math.min(9, size * 0.18));

    // Base shadow lip
    this.drawRoundedRect(ctx, x, y, size, size, r);
    ctx.fillStyle = hazard === 'stone' ? '#4A525D' : palette.dark;
    ctx.fill();

    // Main ceramic body
    const lip = Math.max(1.5, size * 0.08);
    this.drawRoundedRect(ctx, x, y, size, Math.max(4, size - lip), r);
    ctx.fillStyle = hazard === 'stone' ? '#7B8492' : palette.main;
    ctx.fill();

    // Subtle top bevel highlight
    const innerPad = Math.max(2, size * 0.12);
    this.drawRoundedRect(
      ctx,
      x + innerPad,
      y + innerPad * 0.75,
      Math.max(2, size - innerPad * 2),
      Math.max(2, (size - lip) * 0.36),
      Math.max(1, r - 2)
    );
    ctx.fillStyle = hazard === 'stone' ? 'rgba(255,255,255,0.22)' : palette.light;
    ctx.globalAlpha = alpha * 0.42;
    ctx.fill();
    ctx.globalAlpha = alpha;

    // Hazard Overlays (Stone Shield 2-HP, Bonus Gem, or Ember Countdown Telegraph)
    if (hazard === 'stone' && durability > 1) {
      const cx = x + size * 0.5;
      const cy = y + (size - lip) * 0.5;
      ctx.strokeStyle = '#141619';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 4, y + 4, Math.max(2, size - 8), Math.max(2, size - lip - 8));
      ctx.fillStyle = '#F4F1EA';
      ctx.font = `700 ${Math.max(10, Math.round(size * 0.32))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('2x', cx, cy + 1);
    } else if (hazard === 'gem') {
      const cx = x + size * 0.5;
      const cy = y + (size - lip) * 0.5;
      const d = size * 0.24;
      ctx.beginPath();
      ctx.moveTo(cx, cy - d);
      ctx.lineTo(cx + d, cy);
      ctx.lineTo(cx, cy + d);
      ctx.lineTo(cx - d, cy);
      ctx.closePath();
      ctx.fillStyle = '#FFF3B0';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#AD750B';
      ctx.stroke();
    } else if (hazard === 'ember') {
      // Pulsing windup telegraph ring + countdown number
      const cx = x + size * 0.5;
      const cy = y + (size - lip) * 0.5;
      const pulse = 0.65 + Math.sin(this.ambientTime * 9) * 0.35;
      ctx.strokeStyle = `rgba(255, 212, 202, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 ${Math.max(11, Math.round(size * 0.36))}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(emberTimer ?? 1), cx, cy + 1);
    }

    ctx.restore();
  }

  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    rawW: number,
    rawH: number,
    rawR: number
  ): void {
    const w = Math.max(1, rawW);
    const h = Math.max(1, rawH);
    const radius = Math.max(0, Math.min(rawR, w * 0.5, h * 0.5));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
