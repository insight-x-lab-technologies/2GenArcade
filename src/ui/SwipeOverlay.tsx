import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Direction } from '@/types';
import { vectorToDirections } from '@/engine';

interface SwipeOverlayProps {
  /** Called with the full set of currently-held directions (0, 1 or 2). */
  onChange: (dirs: Direction[]) => void;
  label: string;
}

interface Stick {
  ox: number; // origin, relative to the overlay
  oy: number;
  dx: number; // drag offset
  dy: number;
}

const KNOB_MAX = 46; // px the knob travels from the origin

/**
 * A floating analog stick over the play surface: touch anywhere to anchor the
 * stick, drag to steer (the drag direction picks the held directions, diagonals
 * press two), release to let go. Feeds the same dpad stream as the button d-pad.
 */
export function SwipeOverlay({ onChange, label }: SwipeOverlayProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const [stick, setStick] = useState<Stick | null>(null);

  const start = (e: ReactPointerEvent): void => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const rect = ref.current?.getBoundingClientRect();
    originRef.current = { x: e.clientX, y: e.clientY };
    if (rect) setStick({ ox: e.clientX - rect.left, oy: e.clientY - rect.top, dx: 0, dy: 0 });
  };
  const move = (e: ReactPointerEvent): void => {
    const o = originRef.current;
    if (!o) return;
    const dx = e.clientX - o.x;
    const dy = e.clientY - o.y;
    onChange(vectorToDirections(dx, dy, 16));
    setStick((s) => (s ? { ...s, dx, dy } : s));
  };
  const end = (): void => {
    if (!originRef.current) return;
    originRef.current = null;
    onChange([]);
    setStick(null);
  };

  const clamp = (v: number): number => Math.max(-KNOB_MAX, Math.min(KNOB_MAX, v));

  return (
    <div
      ref={ref}
      role="application"
      aria-label={label}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className="absolute inset-0 z-20"
      style={{ touchAction: 'none' }}
    >
      {stick && (
        <>
          <div
            className="pointer-events-none absolute h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet/40 bg-violet/5"
            style={{ left: stick.ox, top: stick.oy }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet bg-violet/30 shadow-glow-violet"
            style={{ left: stick.ox + clamp(stick.dx), top: stick.oy + clamp(stick.dy) }}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
