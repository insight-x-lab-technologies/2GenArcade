// Pure board logic for Block Drop. No canvas, no timing — fully unit-tested.
//
// Original "shard" set (NOT the canonical tetromino set): it mixes a 3-cell
// tromino and a signature 5-cell pentomino in with the 4-cell pieces, giving
// the game its own feel and difficulty curve.

export type Cell = number; // 0 = empty, otherwise 1-based color index
export type Board = Cell[][];
export type Coord = [row: number, col: number];

export interface Shard {
  id: string;
  cells: Coord[];
  color: number;
}

export const COLS = 9;
export const ROWS = 18;

export const SHARDS: Shard[] = [
  { id: 'bar', color: 1, cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
  { id: 'box', color: 2, cells: [[0, 0], [0, 1], [1, 0], [1, 1]] },
  { id: 'corner', color: 3, cells: [[0, 0], [1, 0], [1, 1]] }, // 3-cell tromino
  { id: 'arrow', color: 4, cells: [[0, 0], [0, 1], [0, 2], [1, 1]] },
  { id: 'zig', color: 5, cells: [[0, 1], [0, 2], [1, 0], [1, 1]] },
  { id: 'hook', color: 6, cells: [[0, 0], [1, 0], [1, 1], [1, 2]] },
  { id: 'step', color: 7, cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]] }, // signature pentomino
];

export const createBoard = (rows = ROWS, cols = COLS): Board =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

export const cloneBoard = (board: Board): Board => board.map((row) => [...row]);

/** Normalize coords so the minimum row/col is 0. */
const normalize = (cells: Coord[]): Coord[] => {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minR, c - minC]);
};

/** Rotate a shard 90° clockwise about the origin, then normalize. */
export const rotateCW = (shard: Shard): Shard => ({
  ...shard,
  cells: normalize(shard.cells.map(([r, c]) => [c, -r])),
});

export const shardWidth = (shard: Shard): number =>
  Math.max(...shard.cells.map(([, c]) => c)) + 1;

export const shardHeight = (shard: Shard): number =>
  Math.max(...shard.cells.map(([r]) => r)) + 1;

/** True if placing `shard` at offset (offR, offC) is illegal. Cells above the
 *  top (row < 0) are allowed (spawn area); out-of-side/below or overlap is not. */
export const collides = (board: Board, shard: Shard, offR: number, offC: number): boolean => {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  for (const [r, c] of shard.cells) {
    const br = r + offR;
    const bc = c + offC;
    if (bc < 0 || bc >= cols || br >= rows) return true;
    if (br >= 0 && board[br]![bc] !== 0) return true;
  }
  return false;
};

/** Return a new board with the shard merged in at the offset. */
export const mergeShard = (board: Board, shard: Shard, offR: number, offC: number): Board => {
  const next = cloneBoard(board);
  for (const [r, c] of shard.cells) {
    const br = r + offR;
    const bc = c + offC;
    if (br >= 0 && br < next.length && bc >= 0 && bc < next[0]!.length) {
      next[br]![bc] = shard.color;
    }
  }
  return next;
};

/** Remove full rows, dropping everything above. */
export const clearFullRows = (board: Board): { board: Board; cleared: number } => {
  const cols = board[0]?.length ?? 0;
  const kept = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = board.length - kept.length;
  const empties = Array.from({ length: cleared }, () => Array.from({ length: cols }, () => 0));
  return { board: [...empties, ...kept], cleared };
};

/** Horizontal offset to center a freshly-spawned shard. */
export const spawnColumn = (shard: Shard, cols = COLS): number =>
  Math.floor((cols - shardWidth(shard)) / 2);

/** Drop distance until the shard would collide (for hard drop / ghost). */
export const dropDistance = (board: Board, shard: Shard, offR: number, offC: number): number => {
  let d = 0;
  while (!collides(board, shard, offR + d + 1, offC)) d += 1;
  return d;
};

/** Line-clear scoring (per-clear, before level/overdrive multipliers). */
export const LINE_SCORES = [0, 100, 300, 500, 800, 1200];

export const scoreForClear = (cleared: number, level: number, combo: number): number => {
  const base = LINE_SCORES[Math.min(cleared, LINE_SCORES.length - 1)] ?? 0;
  const comboBonus = combo > 0 ? 50 * combo : 0;
  return (base + comboBonus) * level;
};
