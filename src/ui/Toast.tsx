import { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  durationMs?: number;
}

export function Toast({ message, onDismiss, durationMs = 2600 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(id);
  }, [message, onDismiss, durationMs]);

  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4" style={{ bottom: 'calc(var(--safe-bottom) + 1.5rem)' }}>
      <div className="pointer-events-auto rounded-arcade border border-amber/40 bg-night-700/95 px-4 py-2 font-mono text-xs text-ink shadow-glow-amber animate-slide-up">
        {message}
      </div>
    </div>
  );
}
