import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Direction } from '@/types';
import { vectorToDirections } from '@/engine';
import { cn } from './cn';

interface ZonePadProps {
  /** Called with the full set of currently-held directions (0, 1 or 2). */
  onChange: (dirs: Direction[]) => void;
  label: string;
}

/**
 * A single round touch-pad split into 8 directional zones around a centre
 * deadzone. Sliding the thumb between zones changes the command; holding it in a
 * zone keeps the button pressed; the diagonal zones press two directions at once
 * (an analog-stick feel). Feeds the same dpad stream as the button d-pad.
 */
export function ZonePad({ onChange, label }: ZonePadProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef(false);

  const compute = (e: ReactPointerEvent): void => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    onChange(vectorToDirections(dx, dy, rect.width * 0.16));
    const knob = knobRef.current;
    if (knob) {
      const max = rect.width * 0.3;
      const r = Math.hypot(dx, dy);
      const scale = r > max ? max / r : 1;
      knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    }
  };

  const start = (e: ReactPointerEvent): void => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    activeRef.current = true;
    compute(e);
  };
  const move = (e: ReactPointerEvent): void => {
    if (activeRef.current) compute(e);
  };
  const end = (): void => {
    if (!activeRef.current) return;
    activeRef.current = false;
    onChange([]);
    if (knobRef.current) knobRef.current.style.transform = 'translate(0px, 0px)';
  };

  return (
    <div className="flex select-none justify-center" style={{ touchAction: 'none' }}>
      <div
        ref={ref}
        role="application"
        aria-label={label}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="relative grid h-40 w-40 place-items-center rounded-full border border-violet/40 bg-night-700/60 backdrop-blur-sm"
      >
        {/* Cross + diagonal guides. */}
        <div className="pointer-events-none absolute inset-3 rounded-full border border-white/5" />
        <span className="pointer-events-none absolute top-2 text-violet/70" aria-hidden>
          ▲
        </span>
        <span className="pointer-events-none absolute bottom-2 text-violet/70" aria-hidden>
          ▼
        </span>
        <span className="pointer-events-none absolute left-2 text-violet/70" aria-hidden>
          ◀
        </span>
        <span className="pointer-events-none absolute right-2 text-violet/70" aria-hidden>
          ▶
        </span>
        <div
          ref={knobRef}
          className={cn(
            'pointer-events-none h-14 w-14 rounded-full border border-violet bg-violet/30',
            'shadow-glow-violet transition-none',
          )}
        />
      </div>
    </div>
  );
}
