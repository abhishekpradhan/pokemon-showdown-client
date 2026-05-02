import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

export function StatusCallout({ children, tone = 'info' }: {
  children: ReactNode;
  tone?: 'info' | 'success' | 'error';
}) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <p className={`status-callout is-${tone}`}>
      <Icon size={16} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
