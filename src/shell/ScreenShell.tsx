import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StatusHeader } from '@/ui';
import { useArcadeStore } from './store';

interface ScreenShellProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
}

/** Header + scrollable body used by every non-gameplay screen. */
export function ScreenShell({ title, onBack, right, children }: ScreenShellProps) {
  const { t } = useTranslation();
  const online = useArcadeStore((s) => s.online);
  return (
    <div className="flex h-full flex-col">
      <StatusHeader
        title={title}
        online={online}
        onlineLabel={t('common:online')}
        offlineLabel={t('common:offline')}
        onBack={onBack}
        backLabel={t('common:back')}
        right={right}
      />
      <main className="scroll-night min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
