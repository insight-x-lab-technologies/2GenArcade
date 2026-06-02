import { cn } from './cn';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-11 w-[68px] shrink-0 items-center rounded-full border p-1 transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-glow',
        checked ? 'border-amber/70 bg-amber/25' : 'border-white/15 bg-night-900',
      )}
    >
      <span
        className={cn(
          'grid h-8 w-8 place-items-center rounded-full text-night-900 transition-transform duration-200',
          checked ? 'translate-x-[28px] bg-amber shadow-glow-amber' : 'translate-x-0 bg-muted',
        )}
        aria-hidden
      >
        {checked ? '◉' : '○'}
      </span>
    </button>
  );
}
