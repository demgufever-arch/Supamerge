import { cn } from '@/lib/utils';

interface BadgeWithDotProps {
  color?: 'success' | 'warning' | 'error' | 'info';
  type?: 'modern' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

const colorMap = {
  success: { dotBg: 'var(--color-accent)' },
  warning: { dotBg: '#f59e0b' },
  error: { dotBg: '#f43f5e' },
  info: { dotBg: 'var(--color-text-muted)' },
};

export function BadgeWithDot({ color = 'success', type = 'modern', size = 'sm', children }: BadgeWithDotProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold border whitespace-nowrap',
        type === 'modern'
          ? 'border-[var(--color-border)] text-[var(--color-text)]'
          : 'border-slate-700 text-slate-300',
        size === 'sm' ? 'text-[10px] px-2 py-0.5 rounded-full' : 'text-xs px-2.5 py-1 rounded-lg',
      )}
      style={{ backgroundColor: type === 'modern' ? 'var(--color-surface-alt)' : undefined }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colorMap[color].dotBg }} />
      {children}
    </span>
  );
}
