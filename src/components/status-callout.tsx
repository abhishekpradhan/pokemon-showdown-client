import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { ReactNode } from 'react';

const ICONS = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: AlertCircle,
} as const;

export function StatusCallout({ children, tone = 'info' }: {
  children: ReactNode;
  tone?: keyof typeof ICONS;
}) {
  const Icon = ICONS[tone];
  return (
    <p className={`status-callout is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={16} aria-hidden />
      <span>{children}</span>
    </p>
  );
}
