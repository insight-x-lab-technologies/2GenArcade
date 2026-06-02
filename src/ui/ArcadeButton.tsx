import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'outline' | 'ghost';
type Accent = 'amber' | 'violet' | 'coral';

interface ArcadeButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  accent?: Accent;
  block?: boolean;
  children: ReactNode;
}

const ACCENT_TEXT: Record<Accent, string> = {
  amber: 'text-amber-glow',
  violet: 'text-violet',
  coral: 'text-coral',
};

const ACCENT_BORDER: Record<Accent, string> = {
  amber: 'border-amber/60 hover:border-amber shadow-glow-amber',
  violet: 'border-violet/60 hover:border-violet shadow-glow-violet',
  coral: 'border-coral/60 hover:border-coral shadow-glow-coral',
};

const ACCENT_FILL: Record<Accent, string> = {
  amber: 'bg-gradient-to-b from-amber to-amber-deep text-night-900 shadow-glow-amber',
  violet: 'bg-gradient-to-b from-violet to-violet-deep text-ink shadow-glow-violet',
  coral: 'bg-gradient-to-b from-coral to-[#d6314c] text-ink shadow-glow-coral',
};

export function ArcadeButton({
  variant = 'primary',
  accent = 'amber',
  block = false,
  className,
  children,
  ...rest
}: ArcadeButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-arcade ' +
    'font-mono text-sm font-semibold uppercase tracking-[0.08em] select-none ' +
    'transition-[transform,filter,border-color,background] duration-100 ' +
    'active:translate-y-[1px] active:brightness-95 disabled:opacity-40 disabled:pointer-events-none ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-night-900 focus-visible:ring-amber-glow';

  const look =
    variant === 'primary'
      ? cn('border border-white/10 shadow-inset', ACCENT_FILL[accent])
      : variant === 'outline'
        ? cn('border bg-night-700/40 backdrop-blur-sm', ACCENT_BORDER[accent], ACCENT_TEXT[accent])
        : cn('border border-transparent bg-transparent hover:bg-white/5', ACCENT_TEXT[accent]);

  return (
    <button className={cn(base, look, block && 'w-full', className)} {...rest}>
      {children}
    </button>
  );
}
