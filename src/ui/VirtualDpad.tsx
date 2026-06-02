import type { PointerEvent as ReactPointerEvent } from 'react';
import type { Direction } from '@/types';
import { cn } from './cn';

interface VirtualDpadProps {
  onDirection: (direction: Direction, phase: 'press' | 'release') => void;
  onButton: (id: string, phase: 'press' | 'release') => void;
  /** i18n'd accessible labels. */
  labels: { left: string; right: string; up: string; down: string; rotate: string; drop: string };
  /** 'tetris' = move row + rotate/drop actions (default). 'cross' = 4-way pad. */
  layout?: 'tetris' | 'cross';
}

/** On-screen controls for portrait play. Each target is >= 56px (a11y).
 *  Directional presses are held (press/release); action buttons fire on press. */
export function VirtualDpad({ onDirection, onButton, labels, layout = 'tetris' }: VirtualDpadProps) {
  const dir = (direction: Direction) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault();
      onDirection(direction, 'press');
    },
    onPointerUp: (e: ReactPointerEvent) => {
      e.preventDefault();
      onDirection(direction, 'release');
    },
    onPointerLeave: () => onDirection(direction, 'release'),
    onPointerCancel: () => onDirection(direction, 'release'),
  });

  const btn = (id: string) => ({
    onPointerDown: (e: ReactPointerEvent) => {
      e.preventDefault();
      onButton(id, 'press');
    },
    onPointerUp: (e: ReactPointerEvent) => {
      e.preventDefault();
      onButton(id, 'release');
    },
  });

  if (layout === 'cross') {
    return (
      <div className="flex select-none justify-center px-2" style={{ touchAction: 'none' }}>
        <div className="grid grid-cols-3 grid-rows-3 gap-2">
          <span aria-hidden />
          <PadKey label={labels.up} glyph="▲" accent="violet" {...dir('up')} />
          <span aria-hidden />
          <PadKey label={labels.left} glyph="◀" accent="violet" {...dir('left')} />
          <span aria-hidden />
          <PadKey label={labels.right} glyph="▶" accent="violet" {...dir('right')} />
          <span aria-hidden />
          <PadKey label={labels.down} glyph="▼" accent="violet" {...dir('down')} />
          <span aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex select-none items-end justify-between gap-3 px-2"
      style={{ touchAction: 'none' }}
    >
      <div className="flex items-center gap-2">
        <PadKey label={labels.left} glyph="◀" {...dir('left')} />
        <PadKey label={labels.down} glyph="▼" {...dir('down')} />
        <PadKey label={labels.right} glyph="▶" {...dir('right')} />
      </div>
      <div className="flex items-center gap-2">
        <PadKey label={labels.rotate} glyph="⟳" accent="violet" {...btn('rotate')} />
        <PadKey label={labels.drop} glyph="⤓" accent="coral" {...btn('drop')} />
      </div>
    </div>
  );
}

interface PadKeyProps {
  label: string;
  glyph: string;
  accent?: 'amber' | 'violet' | 'coral';
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerLeave?: () => void;
  onPointerCancel?: () => void;
}

function PadKey({ label, glyph, accent = 'amber', ...handlers }: PadKeyProps) {
  const ring =
    accent === 'violet'
      ? 'border-violet/50 text-violet active:shadow-glow-violet'
      : accent === 'coral'
        ? 'border-coral/50 text-coral active:shadow-glow-coral'
        : 'border-amber/50 text-amber-glow active:shadow-glow-amber';
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'grid h-16 w-16 place-items-center rounded-arcade border bg-night-700/70 text-2xl',
        'backdrop-blur-sm transition-transform duration-75 active:translate-y-[2px] active:bg-night-600',
        ring,
      )}
      {...handlers}
    >
      <span aria-hidden>{glyph}</span>
    </button>
  );
}
