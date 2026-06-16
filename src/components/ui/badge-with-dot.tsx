import { cn } from '@/lib/utils';

interface BadgeWithDotProps {
  color?: 'success' | 'warning' | 'error' | 'info';
  type?: 'modern' | 'outline';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

const colorMap = {
  success: { dot: 'bg-emerald-400', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  warning: { dot: 'bg-amber-400', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  error: { dot: 'bg-rose-400', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  info: { dot: 'bg-sky-400', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
};

export function BadgeWithDot({ color = 'success', type = 'modern', size = 'sm', children }: BadgeWithDotProps) {
  const c = colorMap[color];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-semibold border whitespace-nowrap',
        type === 'modern' ? c.bg : 'border-slate-700 text-slate-300',
        size === 'sm' ? 'text-[10px] px-2 py-0.5 rounded-full' : 'text-xs px-2.5 py-1 rounded-lg',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      {children}
    </span>
  );
}
