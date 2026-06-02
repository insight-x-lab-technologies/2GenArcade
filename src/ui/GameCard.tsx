import { cn } from './cn';

type Accent = 'amber' | 'violet' | 'coral';

interface GameCardProps {
  title: string;
  thumbnail: string;
  accent: Accent;
  locked?: boolean;
  comingSoon?: boolean;
  comingSoonLabel?: string;
  lockedLabel?: string;
  onClick?: () => void;
}

const ACCENT_RING: Record<Accent, string> = {
  amber: 'before:from-amber/40',
  violet: 'before:from-violet/40',
  coral: 'before:from-coral/40',
};

const ACCENT_GLOW: Record<Accent, string> = {
  amber: 'group-active:shadow-glow-amber',
  violet: 'group-active:shadow-glow-violet',
  coral: 'group-active:shadow-glow-coral',
};

export function GameCard({
  title,
  thumbnail,
  accent,
  locked = false,
  comingSoon = false,
  comingSoonLabel,
  lockedLabel,
  onClick,
}: GameCardProps) {
  const dimmed = locked || comingSoon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block w-full text-left focus-visible:outline-none"
      aria-label={title}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-arcade border border-white/10 bg-night-700/60 p-3',
          'transition-transform duration-150 group-active:translate-y-[1px] group-hover:-translate-y-[2px]',
          ACCENT_GLOW[accent],
          'before:absolute before:inset-0 before:-z-0 before:bg-gradient-to-br before:to-transparent',
          ACCENT_RING[accent],
        )}
      >
        <div
          className={cn(
            'relative z-10 grid aspect-square place-items-center rounded-md bg-night-900/70 text-5xl',
            dimmed && 'opacity-40 grayscale',
          )}
        >
          <span aria-hidden>{thumbnail}</span>
        </div>
        <p
          className={cn(
            'relative z-10 mt-2 truncate font-display text-[10px] leading-tight text-ink',
            dimmed && 'text-muted',
          )}
        >
          {title}
        </p>

        {locked && (
          <span className="absolute right-2 top-2 z-20 rounded-full bg-night-900/80 px-2 py-1 text-xs">
            🔒
          </span>
        )}

        {(comingSoon || locked) && (
          <span className="absolute inset-x-2 bottom-2 z-20 rounded bg-night-900/85 py-1 text-center font-mono text-[9px] uppercase tracking-wide text-muted">
            {locked ? lockedLabel : comingSoonLabel}
          </span>
        )}
      </div>
    </button>
  );
}
