import { describe, expect, it } from 'vitest';
import {
  clearFullRows,
  collides,
  createBoard,
  dropDistance,
  mergeShard,
  rotateCW,
  scoreForClear,
  shardHeight,
  shardWidth,
  spawnColumn,
  type Shard,
} from './logic';

const bar: Shard = { id: 'bar', color: 1, cells: [[0, 0], [0, 1], [0, 2], [0, 3]] };
const step: Shard = { id: 'step', color: 7, cells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]] };

describe('rotateCW', () => {
  it('turns a horizontal bar into a vertical bar', () => {
    const r = rotateCW(bar);
    expect(shardWidth(r)).toBe(1);
    expect(shardHeight(r)).toBe(4);
  });

  it('returns to the original footprint after four rotations', () => {
    let s = step;
    for (let i = 0; i < 4; i += 1) s = rotateCW(s);
    expect(s.cells.length).toBe(step.cells.length);
    expect(shardWidth(s)).toBe(shardWidth(step));
    expect(shardHeight(s)).toBe(shardHeight(step));
  });
});

describe('collides', () => {
  it('detects side and floor walls', () => {
    const board = createBoard(5, 5);
    expect(collides(board, bar, 0, 2)).toBe(true); // bar width 4, col 2..5 out
    expect(collides(board, bar, 0, 0)).toBe(false);
    expect(collides(board, bar, 5, 0)).toBe(true); // below floor
  });

  it('allows cells above the top edge', () => {
    const board = createBoard(5, 5);
    expect(collides(board, bar, -1, 0)).toBe(false);
  });

  it('detects overlap with settled cells', () => {
    const board = createBoard(5, 5);
    board[0]![0] = 3;
    expect(collides(board, bar, 0, 0)).toBe(true);
  });
});

describe('mergeShard + clearFullRows', () => {
  it('clears a fully filled row and drops the rest', () => {
    const board = createBoard(3, 4);
    // Fill bottom row except it; place a bar across the bottom.
    const merged = mergeShard(board, bar, 2, 0);
    expect(merged[2]).toEqual([1, 1, 1, 1]);
    const { board: cleared, cleared: count } = clearFullRows(merged);
    expect(count).toBe(1);
    expect(cleared.length).toBe(3);
    expect(cleared.every((row) => row.every((c) => c === 0))).toBe(true);
  });

  it('keeps partially filled rows', () => {
    const board = createBoard(2, 4);
    board[1] = [1, 1, 0, 1];
    const { cleared } = clearFullRows(board);
    expect(cleared).toBe(0);
  });
});

describe('dropDistance', () => {
  it('measures the gap to the floor', () => {
    const board = createBoard(5, 4);
    expect(dropDistance(board, bar, 0, 0)).toBe(4);
  });

  it('stops above settled cells', () => {
    const board = createBoard(5, 4);
    board[4] = [1, 1, 1, 1];
    expect(dropDistance(board, bar, 0, 0)).toBe(3);
  });
});

describe('spawnColumn', () => {
  it('centers the shard', () => {
    expect(spawnColumn(bar, 9)).toBe(2); // (9-4)/2 floored
  });
});

describe('scoreForClear', () => {
  it('scales with lines, level and combo', () => {
    expect(scoreForClear(1, 1, 0)).toBe(100);
    expect(scoreForClear(4, 2, 0)).toBe(1600);
    expect(scoreForClear(1, 1, 2)).toBe(200); // 100 + 50*2
  });
});
