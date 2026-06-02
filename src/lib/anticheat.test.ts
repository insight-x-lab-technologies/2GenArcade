import { describe, expect, it } from 'vitest';
import { checkScorePlausibility } from './anticheat';

describe('checkScorePlausibility', () => {
  it('accepts a normal integer score', () => {
    expect(checkScorePlausibility('block-drop', 4200, 'points').ok).toBe(true);
  });

  it('rejects negative, non-finite, non-integer and oversized scores', () => {
    expect(checkScorePlausibility('block-drop', -1, 'points')).toMatchObject({ reason: 'negative' });
    expect(checkScorePlausibility('block-drop', Infinity, 'points')).toMatchObject({
      reason: 'non-finite',
    });
    expect(checkScorePlausibility('block-drop', 1.5, 'points')).toMatchObject({
      reason: 'not-integer',
    });
    expect(checkScorePlausibility('block-drop', 99_999_999_999, 'points')).toMatchObject({
      reason: 'too-large',
    });
  });
});
