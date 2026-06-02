import { describe, expect, it } from 'vitest';
import { classifyPointerGesture, dominantDirection } from './gesture';

const at = (x: number, y: number, timeMs: number) => ({ x, y, timeMs });

describe('classifyPointerGesture', () => {
  it('detects a quick stationary press as a tap', () => {
    const g = classifyPointerGesture(at(100, 100, 0), at(104, 98, 120));
    expect(g).toEqual({ kind: 'tap', x: 104, y: 98 });
  });

  it('detects horizontal swipes', () => {
    expect(classifyPointerGesture(at(0, 0, 0), at(60, 5, 150))).toEqual({
      kind: 'swipe',
      direction: 'right',
    });
    expect(classifyPointerGesture(at(60, 0, 0), at(0, 5, 150))).toEqual({
      kind: 'swipe',
      direction: 'left',
    });
  });

  it('detects vertical swipes', () => {
    expect(classifyPointerGesture(at(0, 0, 0), at(3, 60, 150))).toEqual({
      kind: 'swipe',
      direction: 'down',
    });
    expect(classifyPointerGesture(at(0, 60, 0), at(3, 0, 150))).toEqual({
      kind: 'swipe',
      direction: 'up',
    });
  });

  it('returns null for an ambiguous slow short drag', () => {
    // 18px is past tap distance but under the 24px swipe threshold.
    expect(classifyPointerGesture(at(0, 0, 0), at(18, 0, 500))).toBeNull();
  });

  it('does not treat a long stationary press as a tap', () => {
    expect(classifyPointerGesture(at(0, 0, 0), at(0, 0, 900))).toBeNull();
  });
});

describe('dominantDirection', () => {
  it('prefers the larger-magnitude axis', () => {
    expect(dominantDirection(30, 10)).toBe('right');
    expect(dominantDirection(-30, 10)).toBe('left');
    expect(dominantDirection(5, 30)).toBe('down');
    expect(dominantDirection(5, -30)).toBe('up');
  });
});
