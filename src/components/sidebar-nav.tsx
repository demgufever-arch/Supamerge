import { useState } from 'react';
import {
  House, BarChart3, List, Folder, PieChart, Settings,
  MessageCircle, ExternalLink, ChevronDown, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BadgeWithDot } from '@/components/ui/badge-with-dot';

export interface NavItemType {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
  items?: { label: string; badge?: number | string; href?: string }[];
  badge?: React.ReactNode;
}

export interface NavItemDividerType {
  divider: true;
}

type NavEntry = NavItemType | NavItemDividerType;

interface SidebarNavigationSectionDividersProps {
  activeUrl: string;
  items: NavEntry[];
  onNavigate: (href: string) => void;
}

export function SidebarNavigationSectionDividers({
  activeUrl,
  items,
  onNavigate,
}: SidebarNavigationSectionDividersProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (label: string) => {
    setExpandedFolders(prev => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <nav className="space-y-1">
      {items.map((entry, idx) => {
        if ('divider' in entry && entry.divider) {
          return <div key={`divider-${idx}`} className="my-3 border-t" style={{ borderColor: 'var(--color-border)' }} />;
        }

        const item = entry as NavItemType;
        const Icon = item.icon;
        const isActive = activeUrl === item.href;
        const hasSubItems = item.items && item.items.length > 0;
        const isExpanded = expandedFolders[item.label];

        if (hasSubItems) {
          return (
            <div key={item.label}>
              <button
                onClick={() => toggleFolder(item.label)}
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="flex-1 text-left">{item.label}</span>
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  isExpanded ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0',
                )}
              >
                <div className="ml-6 space-y-0.5 border-l pl-2" style={{ borderColor: 'var(--color-border)' }}>
                  {item.items!.map((sub) => (
                    <button
                      key={sub.label}
                      onClick={() => sub.href && onNavigate(sub.href)}
                      className="w-full flex items-center justify-between rounded-md px-3 py-1.5 text-xs transition-all duration-200"
                      style={{
                        color: activeUrl === sub.href ? '#10b981' : 'var(--color-text-muted)',
                      }}
                    >
                      <span>{sub.label}</span>
                      {sub.badge !== undefined && (
                        <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                          {sub.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        }

        return (
          <button
            key={item.label}
            onClick={() => item.href && onNavigate(item.href)}
            className={cn(
              'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 relative',
              isActive ? 'text-emerald-400' : '',
            )}
            style={{ color: isActive ? undefined : 'var(--color-text-muted)' }}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            )}
            {Icon && <Icon className="h-4 w-4 shrink-0" />}
            <span className="flex-1 text-left">{item.label}</span>
            {item.badge && <span className="shrink-0">{item.badge}</span>}
          </button>
        );
      })}
    </nav>
  );
}

// Pre-configured nav items for SupaMerge
const navItemsWithDividers: (NavItemType | NavItemDividerType)[] = [
  {
    label: 'Home',
    href: '/',
    icon: House,
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: BarChart3,
  },
  { divider: true },
  {
    label: 'Cluster Console',
    href: '/console',
    icon: Settings,
  },
  {
    label: 'Sharded KV Store',
    href: '/kv',
    icon: List,
  },
  {
    label: 'Distributed DFS',
    href: '/files',
    icon: Folder,
    items: [
      { label: 'View all', badge: 0, href: '/files' },
      { label: 'Recent', badge: 0, href: '/files' },
    ],
  },
  { divider: true },
  {
    label: 'Vector AI Memory',
    href: '/vector',
    icon: PieChart,
  },
  {
    label: 'Support',
    href: 'https://github.com/demgufever-arch/Supamerge',
    icon: MessageCircle,
    badge: (
      <BadgeWithDot color="success" type="modern" size="sm">
        Online
      </BadgeWithDot>
    ),
  },
  {
    label: 'GitHub',
    href: 'https://github.com/demgufever-arch/Supamerge',
    icon: ExternalLink,
  },
];

export function getActiveUrl(activeTab: string): string {
  const map: Record<string, string> = {
    dashboard: '/dashboard',
    kv: '/kv',
    files: '/files',
    vector: '/vector',
    console: '/console',
  };
  return map[activeTab] || '/';
}

export { navItemsWithDividers };
