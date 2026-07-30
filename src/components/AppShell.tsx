import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Film, LayoutGrid, FolderOpen, Sparkles, Settings, Plus } from 'lucide-react';

const navItems = [
  { icon: LayoutGrid, label: 'Dashboard', path: '/' },
  { icon: FolderOpen, label: 'Projets', path: '/projects' },
  { icon: Sparkles, label: 'Templates', path: '/templates' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-base)]">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col">
        {/* Logo */}
        <Link to="/" className="h-16 flex items-center gap-2.5 px-5 border-b border-[var(--border-subtle)] hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-[var(--accent)] via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Film size={20} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-[var(--text-primary)] text-[15px] block leading-none">Promo Studio</span>
            <span className="text-[10px] text-[var(--text-tertiary)] tracking-wide">VIDEO MAKER</span>
          </div>
        </Link>

        {/* New video button */}
        <div className="p-3">
          <Link
            to="/editor"
            className="w-full flex items-center justify-center gap-2 h-10 rounded-[10px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.97]"
          >
            <Plus size={16} />
            Nouvelle vidéo
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`w-full flex items-center gap-3 px-3 h-10 rounded-[10px] text-sm font-medium transition-all ${
                  active
                    ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)]'
                }`}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Settings */}
        <div className="px-3 pb-3">
          <button className="w-full flex items-center gap-3 px-3 h-10 rounded-[10px] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-2)] hover:text-[var(--text-primary)] transition-all">
            <Settings size={18} />
            Paramètres
          </button>
        </div>

        {/* Upgrade card */}
        <div className="p-3">
          <div className="rounded-[var(--radius-lg)] bg-gradient-to-br from-[var(--bg-surface-2)] to-[var(--bg-surface-3)] border border-[var(--border-subtle)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-[var(--warning)]" />
              <span className="text-xs font-bold text-[var(--text-primary)]">Passer en Pro</span>
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed mb-3">
              Rendu cloud, 4K, templates premium, sans watermark
            </p>
            <button className="w-full h-8 rounded-[8px] bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-colors">
              Upgrade — 19€/mois
            </button>
          </div>
        </div>

        {/* User */}
        <div className="p-3 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-[10px] hover:bg-[var(--bg-surface-2)] cursor-pointer transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white">
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[var(--text-primary)] truncate">Arnaud</div>
              <div className="text-xs text-[var(--text-tertiary)]">Free plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
