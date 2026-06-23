import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';

export interface Command {
  id: string;
  label: string;
  description?: string;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  commands: Command[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ commands }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(search.toLowerCase()) ||
    cmd.description?.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K on Mac, Ctrl+K on others
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setSearch('');
        setSelectedIndex(0);
      }

      if (isOpen) {
        if (e.key === 'Escape') {
          setIsOpen(false);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex(prev => (prev + 1) % filtered.length);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filtered[selectedIndex]) {
            filtered[selectedIndex].action();
            setIsOpen(false);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 rounded-xl shadow-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', border: '1px solid' }}>
        {/* Search bar */}
        <div className="flex items-center gap-2 p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <Search className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--color-text)' }}
          />
          <span className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}>
            ESC
          </span>
        </div>

        {/* Commands list */}
        <div className="max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
              <p className="text-sm">No commands found</p>
            </div>
          ) : (
            filtered.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  setIsOpen(false);
                }}
                className={clsx(
                  'w-full px-4 py-3 flex items-center justify-between text-left border-0 cursor-pointer transition-colors',
                  index === selectedIndex
                    ? 'bg-opacity-100'
                    : 'bg-opacity-0 hover:bg-opacity-5'
                )}
                style={{
                  backgroundColor: index === selectedIndex ? 'var(--color-surface-alt)' : 'transparent',
                  color: 'var(--color-text)',
                }}
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{cmd.label}</div>
                  {cmd.description && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {cmd.description}
                    </div>
                  )}
                </div>
                {cmd.shortcut && (
                  <span className="text-[10px] px-2 py-1 rounded ml-2" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                    {cmd.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t flex items-center justify-between text-[10px]" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          <span>↑ ↓ Enter to select</span>
          <span className="flex gap-1">
            <kbd style={{ backgroundColor: 'var(--color-surface-alt)', padding: '2px 6px', borderRadius: '3px' }}>⌘</kbd>
            <kbd style={{ backgroundColor: 'var(--color-surface-alt)', padding: '2px 6px', borderRadius: '3px' }}>K</kbd>
          </span>
        </div>
      </div>
    </>
  );
};
