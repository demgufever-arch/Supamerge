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
            ? 'text-emerald-400 shadow-sm'
            : ''
        }`}
        style={{ 
          backgroundColor: effective === 'dark' ? 'var(--color-surface-alt)' : 'transparent',
          color: effective === 'dark' ? '#10b981' : 'var(--color-text-muted)'
        }}
        title="Dark mode"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('light')}
        className={`rounded-md p-1.5 transition-all ${
          effective === 'light'
            ? 'text-emerald-400 shadow-sm'
            : ''
        }`}
        style={{ 
          backgroundColor: effective === 'light' ? 'var(--color-surface-alt)' : 'transparent',
          color: effective === 'light' ? '#10b981' : 'var(--color-text-muted)'
        }}
        title="Light mode"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`rounded-md p-1.5 transition-all ${
          theme === 'system'
            ? 'text-emerald-400 shadow-sm'
            : ''
        }`}
        style={{ 
          backgroundColor: theme === 'system' ? 'var(--color-surface-alt)' : 'transparent',
          color: theme === 'system' ? '#10b981' : 'var(--color-text-muted)'
        }}
        title="Follow system"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
