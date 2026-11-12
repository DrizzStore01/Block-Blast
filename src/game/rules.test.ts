import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOARD_SIZE,
  SHAPE_CATALOG,
  createEmptyBoard,
  createDailyInitialBoard,
  canPlacePiece,
  placePiece,
  calculatePlacementScore,
  hasValidMoveForTray,
  findBestMove,
  createSeededRng,
  generateTrayPieces,
  TrayPiece,
} from './rules';

test('createEmptyBoard creates an 8x8 empty grid', () => {
  const board = createEmptyBoard();
  assert.equal(board.length, BOARD_SIZE);
  assert.equal(board[0].length, BOARD_SIZE);
  assert.equal(board.every((row) => row.every((c) => !c.filled)), true);
});

test('createDailyInitialBoard is deterministic for the same date key', () => {
  const b1 = createDailyInitialBoard('2026-11-05');
  const b2 = createDailyInitialBoard('2026-11-05');
  assert.deepEqual(b1, b2);

  // Has symmetric occupied cells
  let filledCount = 0;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (b1[r][c].filled) {
        filledCount++;
        assert.equal(b1[r][BOARD_SIZE - 1 - c].filled, true);
      }
    }
  }
  assert.ok(filledCount >= 4);
});

test('canPlacePiece validates bounds and occupied cell collisions', () => {
  const board = createEmptyBoard();
  const sq2x2 = SHAPE_CATALOG.find((s) => s.id === 'sq-2x2')!;

  // Valid inside top-left and bottom-right
  assert.equal(canPlacePiece(board, sq2x2, 0, 0), true);
  assert.equal(canPlacePiece(board, sq2x2, 6, 6), true);

  // Out of bounds at edge
  assert.equal(canPlacePiece(board, sq2x2, 7, 7), false);
  assert.equal(canPlacePiece(board, sq2x2, -1, 0), false);

  // Occupied cell collision
  board[1][1].filled = true;
  assert.equal(canPlacePiece(board, sq2x2, 0, 0), false);
  assert.equal(canPlacePiece(board, sq2x2, 2, 2), true);
});

test('placePiece clears full row and column simultaneously and updates combo', () => {
  const board = createEmptyBoard();
  // Fill row 0 except (0,0), and col 0 except (0,0)
  for (let i = 1; i < BOARD_SIZE; i++) {
    board[0][i] = { filled: true, colorId: 1, hazard: 'none', durability: 1 };
    board[i][0] = { filled: true, colorId: 2, hazard: 'none', durability: 1 };
  }

  const dotPiece: TrayPiece = {
    uid: 'test-dot',
    shape: SHAPE_CATALOG.find((s) => s.id === 'dot-1')!,
    placed: false,
  };

  const result = placePiece(board, dotPiece, 0, 0, 1);
  assert.equal(result.valid, true);
  assert.deepEqual(result.clearedRows, [0]);
  assert.deepEqual(result.clearedCols, [0]);
  assert.equal(result.newCombo, 2);
  assert.equal(result.isAllClear, true);
  assert.ok(result.pointsEarned > 400);

  // Entire board should now be empty
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      assert.equal(result.board[r][c].filled, false);
    }
  }
});

test('stone hazard requires 2 line clears to fully destroy', () => {
  const board = createEmptyBoard();
  for (let c = 1; c < BOARD_SIZE; c++) {
    board[3][c] = {
      filled: true,
      colorId: 1,
      hazard: c === 4 ? 'stone' : 'none',
      durability: c === 4 ? 2 : 1,
    };
  }

  const dotPiece: TrayPiece = {
    uid: 'test-dot',
    shape: SHAPE_CATALOG.find((s) => s.id === 'dot-1')!,
    placed: false,
  };

  const res1 = placePiece(board, dotPiece, 3, 0, 0);
  assert.equal(res1.valid, true);
  assert.deepEqual(res1.clearedRows, [3]);
  assert.equal(res1.crackedCells.length, 1);
  // Cell (3,4) remains filled with durability 1 and no stone hazard
  assert.equal(res1.board[3][4].filled, true);
  assert.equal(res1.board[3][4].durability, 1);
  assert.equal(res1.board[3][4].hazard, 'none');
  // Other cells in row 3 are cleared
  assert.equal(res1.board[3][0].filled, false);
});

test('hasValidMoveForTray detects game over when no piece fits', () => {
  const board = createEmptyBoard();
  // Checkerboard fill so no 2-cell or larger piece can fit
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if ((r + c) % 2 === 0) {
        board[r][c] = { filled: true, colorId: 1, hazard: 'none', durability: 1 };
      }
    }
  }

  const sqPiece: TrayPiece = {
    uid: 'sq',
    shape: SHAPE_CATALOG.find((s) => s.id === 'sq-2x2')!,
    placed: false,
  };

  assert.equal(hasValidMoveForTray(board, [sqPiece]), false);
  assert.equal(findBestMove(board, [sqPiece]), null);
});

test('generateTrayPieces guarantees at least one placeable piece when a move exists', () => {
  const board = createEmptyBoard();
  const rng = createSeededRng(42);
  const tray = generateTrayPieces(board, 0, rng, 1);
  assert.equal(tray.length, 3);
  assert.equal(hasValidMoveForTray(board, tray), true);
  const hint = findBestMove(board, tray, 0);
  assert.notEqual(hint, null);
});

test('calculatePlacementScore scales with lines, combos, and gems', () => {
  const singleLine = calculatePlacementScore({
    blocksPlaced: 3,
    linesCleared: 1,
    comboCount: 1,
    gemsCollected: 0,
    embersDefused: 0,
    isAllClear: false,
  });
  const doubleComboWithGem = calculatePlacementScore({
    blocksPlaced: 3,
    linesCleared: 2,
    comboCount: 3,
    gemsCollected: 1,
    embersDefused: 0,
    isAllClear: false,
  });
  assert.ok(doubleComboWithGem > singleLine * 3);
});
