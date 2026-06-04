import { describe, expect, it, vi } from 'vitest';
import type { InputEvent } from '@/types';
import { PointerInputAdapter } from './InputAdapter';

// The constructor only stores the target; DOM is touched on attach(), which we
// skip here. We exercise the on-screen-control path (dispatch) directly.
const makeAdapter = () => new PointerInputAdapter({} as unknown as HTMLElement);

describe('PointerInputAdapter — held buttons', () => {
  it('tracks button press/release via isButtonHeld', () => {
    const a = makeAdapter();
    expect(a.isButtonHeld('fire')).toBe(false);
    a.dispatch({ kind: 'button', id: 'fire', phase: 'press' });
    expect(a.isButtonHeld('fire')).toBe(true);
    expect(a.isButtonHeld('missile')).toBe(false);
    a.dispatch({ kind: 'button', id: 'fire', phase: 'release' });
    expect(a.isButtonHeld('fire')).toBe(false);
  });

  it('tracks several buttons independently', () => {
    const a = makeAdapter();
    a.dispatch({ kind: 'button', id: 'fire', phase: 'press' });
    a.dispatch({ kind: 'button', id: 'missile', phase: 'press' });
    expect(a.isButtonHeld('fire')).toBe(true);
    expect(a.isButtonHeld('missile')).toBe(true);
    a.dispatch({ kind: 'button', id: 'fire', phase: 'release' });
    expect(a.isButtonHeld('fire')).toBe(false);
    expect(a.isButtonHeld('missile')).toBe(true);
  });

  it('forwards button events to subscribers', () => {
    const a = makeAdapter();
    const events: InputEvent[] = [];
    const off = a.subscribe((e) => events.push(e));
    a.dispatch({ kind: 'button', id: 'fire', phase: 'press' });
    off();
    a.dispatch({ kind: 'button', id: 'fire', phase: 'release' });
    expect(events).toEqual([{ kind: 'button', id: 'fire', phase: 'press' }]);
  });

  it('still tracks directions and leaves buttons untouched', () => {
    const a = makeAdapter();
    a.dispatch({ kind: 'dpad', direction: 'left', phase: 'press' });
    expect(a.isHeld('left')).toBe(true);
    expect(a.isButtonHeld('left')).toBe(false);
  });

  it('clears held buttons on destroy', () => {
    const a = makeAdapter();
    a.dispatch({ kind: 'button', id: 'fire', phase: 'press' });
    a.destroy();
    expect(a.isButtonHeld('fire')).toBe(false);
  });

  it('does not throw when subscribing after a dispatch (no-op handler set)', () => {
    const a = makeAdapter();
    const handler = vi.fn();
    a.subscribe(handler);
    a.dispatch({ kind: 'button', id: 'x', phase: 'press' });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
