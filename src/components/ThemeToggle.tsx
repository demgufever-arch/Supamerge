import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

export default function ThemeToggle() {
  const { theme, setTheme, effective } = useTheme();

  return (
    <div className="flex items-center rounded-lg border border-slate-800/60 bg-slate-950/60 p-0.5 shadow-sm">
      <button
        onClick={() => setTheme('dark')}
        className={`rounded-md p-1.5 transition-all ${
          effective === 'dark'
            ? 'bg-slate-700 text-emerald-400 shadow-sm'
            : 'text-slate-500 hover:text-slate-300'
        }`}
        title="Dark mode"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('light')}
        className={`rounded-md p-1.5 transition-all ${
          effective === 'light'
            ? 'bg-slate-700 text-emerald-400 shadow-sm'
            : 'text-slate-500 hover:text-slate-300'
        }`}
        title="Light mode"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`rounded-md p-1.5 transition-all ${
          theme === 'system'
            ? 'bg-slate-700 text-emerald-400 shadow-sm'
            : 'text-slate-500 hover:text-slate-300'
        }`}
        title="Follow system"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
