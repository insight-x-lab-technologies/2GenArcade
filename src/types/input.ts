// Input abstraction: raw pointer/keyboard/on-screen-control events are
// normalized into logical gestures so games never touch DOM events directly.

export type Direction = 'up' | 'down' | 'left' | 'right';

export type InputEvent =
  | { kind: 'tap'; x: number; y: number }
  | { kind: 'swipe'; direction: Direction }
  | { kind: 'hold'; phase: 'start' | 'end' }
  | { kind: 'dpad'; direction: Direction; phase: 'press' | 'release' }
  | { kind: 'button'; id: string; phase: 'press' | 'release' };

export type InputHandler = (event: InputEvent) => void;

/** Subscriptions return an unsubscribe function. `isHeld` lets the game poll a
 *  direction each fixed step (e.g. for continuous soft-drop). */
export interface InputAdapter {
  subscribe(handler: InputHandler): () => void;
  isHeld(direction: Direction): boolean;
}
