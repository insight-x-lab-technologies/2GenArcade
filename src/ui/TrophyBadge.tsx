import { cn } from './cn';

interface TrophyBadgeProps {
  icon: string;
  name: string;
  description: string;
  unlocked: boolean;
  secret?: boolean;
  secretLabel?: string;
}

export function TrophyBadge({
  icon,
  name,
  description,
  unlocked,
  secret = false,
  secretLabel,
}: TrophyBadgeProps) {
  const hidden = secret && !unlocked;
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-arcade border p-3 transition-colors',
        unlocked
          ? 'border-amber/50 bg-amber/10 shadow-glow-amber'
          : 'border-white/10 bg-night-700/40',
      )}
    >
      <div
        className={cn(
          'grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl',
          unlocked ? 'bg-night-900' : 'bg-night-900/60 opacity-40 grayscale',
        )}
        aria-hidden
      >
        {hidden ? '❔' : icon}
      </div>
      <div className="min-w-0">
        <p className={cn('font-display text-[10px]', unlocked ? 'text-neon-amber' : 'text-muted')}>
          {hidden ? secretLabel : name}
        </p>
        <p className="mt-1 truncate font-mono text-xs text-muted">
          {hidden ? '— — —' : description}
        </p>
      </div>
    </div>
  );
}
