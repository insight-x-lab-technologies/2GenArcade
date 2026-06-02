import { cn } from './cn';

interface StatusHeaderProps {
  title: string;
  online: boolean;
  onlineLabel: string;
  offlineLabel: string;
  onBack?: () => void;
  backLabel?: string;
  right?: React.ReactNode;
}

export function StatusHeader({
  title,
  online,
  onlineLabel,
  offlineLabel,
  onBack,
  backLabel,
  right,
}: StatusHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-night-900/80 px-3 py-2 backdrop-blur-md"
      style={{ paddingTop: 'calc(var(--safe-top) + 0.5rem)' }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="grid h-11 w-11 place-items-center rounded-arcade text-amber-glow hover:bg-white/5 active:translate-y-[1px]"
        >
          <span aria-hidden className="text-xl">
            ‹
          </span>
        </button>
      ) : (
        <div className="h-11 w-11" />
      )}

      <h1 className="flex-1 truncate text-center font-display text-xs text-neon-amber">{title}</h1>

      <div className="flex h-11 min-w-11 items-center justify-end gap-2">
        {right}
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-1 font-mono text-[9px] uppercase tracking-wide',
            online ? 'bg-emerald-500/15 text-emerald-300' : 'bg-coral/15 text-coral',
          )}
          title={online ? onlineLabel : offlineLabel}
        >
          <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-400' : 'bg-coral')} />
          {online ? onlineLabel : offlineLabel}
        </span>
      </div>
    </header>
  );
}
