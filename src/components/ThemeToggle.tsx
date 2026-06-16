import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, setTheme, effective } = useTheme();

  return (
    <div className="flex items-center rounded-lg border p-0.5 shadow-sm"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}
    >
      <button
        onClick={() => setTheme('dark')}
        className={`rounded-md p-1.5 transition-all ${
          effective === 'dark'
            ? 'bg-slate-700 text-emerald-400 shadow-sm'
            : 'hover:bg-slate-100'
        }`}
        style={{ color: effective === 'dark' ? undefined : 'var(--color-text-muted)' }}
        title="Dark mode"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('light')}
        className={`rounded-md p-1.5 transition-all ${
          effective === 'light'
            ? 'bg-slate-700 text-emerald-400 shadow-sm'
            : 'hover:bg-slate-100'
        }`}
        style={{ color: effective === 'light' ? undefined : 'var(--color-text-muted)' }}
        title="Light mode"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`rounded-md p-1.5 transition-all ${
          theme === 'system'
            ? 'bg-slate-700 text-emerald-400 shadow-sm'
            : 'hover:bg-slate-100'
        }`}
        style={{ color: theme === 'system' ? undefined : 'var(--color-text-muted)' }}
        title="Follow system"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
