import { useEffect, type ReactNode } from 'react';
import { cn } from './cn';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  closeOnBackdrop?: boolean;
}

export function Modal({ open, title, onClose, children, closeOnBackdrop = true }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-night-900/80 p-5 backdrop-blur-sm animate-fade-in"
      onClick={closeOnBackdrop ? onClose : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          'w-full max-w-sm rounded-arcade border border-violet/30 bg-night-700 p-5 shadow-glow-violet animate-slide-up',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 className="mb-3 font-display text-sm text-neon-amber">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
