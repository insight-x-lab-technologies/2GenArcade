import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ActionButtonDef } from '@/types';
import { playClick, vibrate } from '@/lib';
import { cn } from './cn';

interface ActionButtonsProps {
  buttons: ActionButtonDef[];
  /** Translate an i18n key (the shell's `t`). */
  label: (key: string) => string;
  onButton: (id: string, phase: 'press' | 'release') => void;
}

const ACCENT_RING: Record<NonNullable<ActionButtonDef['accent']>, string> = {
  amber: 'border-amber/60 text-amber-glow active:shadow-glow-amber',
  violet: 'border-violet/60 text-violet active:shadow-glow-violet',
  coral: 'border-coral/60 text-coral active:shadow-glow-coral',
};

/**
 * Game-declared action buttons (fire, missile, dash…), floated over the bottom
 * -right of the play surface so they work with every control style (d-pad,
 * zones, swipe). Sits above the swipe joystick overlay and swallows its own
 * pointer events so tapping fire never also anchors the stick. Targets are 64px
 * (a11y) and fire haptic feedback on press.
 */
export function ActionButtons({ buttons, label, onButton }: ActionButtonsProps) {
  if (buttons.length === 0) return null;

  const press = (id: string) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    vibrate('press');
    playClick();
    onButton(id, 'press');
  };
  const release = (id: string) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onButton(id, 'release');
  };

  return (
    <div
      className="pointer-events-none absolute bottom-4 right-3 z-30 flex flex-col items-end gap-3"
      style={{ touchAction: 'none' }}
    >
      {buttons.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-label={label(b.labelKey)}
          onPointerDown={press(b.id)}
          onPointerUp={release(b.id)}
          onPointerLeave={release(b.id)}
          onPointerCancel={release(b.id)}
          className={cn(
            'pointer-events-auto grid h-16 w-16 place-items-center rounded-full border-2 bg-night-700/70 text-2xl',
            'backdrop-blur-sm transition-transform duration-75 select-none active:translate-y-[2px] active:bg-night-600',
            ACCENT_RING[b.accent ?? 'amber'],
          )}
        >
          <span aria-hidden>{b.glyph}</span>
        </button>
      ))}
    </div>
  );
}
