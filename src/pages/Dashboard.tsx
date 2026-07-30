import { Link } from 'react-router-dom';
import { Plus, Clock, Film, TrendingUp, Play, MoreHorizontal } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/ui/Card';

const stats = [
  { label: 'Vidéos créées', value: '12', icon: Film, accent: 'from-indigo-500 to-blue-500' },
  { label: 'Temps de rendu', value: '8m 24s', icon: Clock, accent: 'from-emerald-500 to-teal-500' },
  { label: 'Ce mois-ci', value: '+3', icon: TrendingUp, accent: 'from-amber-500 to-orange-500' },
];

const recentProjects = [
  { id: '1', name: 'ZEFIL Terrain — Launch', status: 'completed', duration: 24, format: '16:9', updated: 'Il y a 2 jours', gradient: 'from-blue-500 to-cyan-400' },
  { id: '2', name: 'NGE Stock — Demo', status: 'completed', duration: 40, format: '16:9', updated: 'Il y a 5 jours', gradient: 'from-purple-500 to-pink-500' },
  { id: '3', name: 'App Promo — Brouillon', status: 'draft', duration: 30, format: '9:16', updated: 'Il y a 1 semaine', gradient: 'from-amber-500 to-red-500' },
];

export function DashboardPage() {
  return (
    <AppShell>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight">Dashboard</h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Vos vidéos promotionnelles en un coup d'œil</p>
          </div>
          <Link
            to="/editor"
            className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-[10px] bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 active:scale-[0.97]"
          >
            <Plus size={18} />
            Nouvelle vidéo
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {stats.map((s) => (
            <Card key={s.label} className="p-6 overflow-hidden relative group">
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">{s.value}</div>
                  <div className="text-sm text-[var(--text-secondary)] mt-1">{s.label}</div>
                </div>
                <div className={`w-12 h-12 rounded-[12px] bg-gradient-to-br ${s.accent} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                  <s.icon size={22} className="text-white" />
                </div>
              </div>
              {/* Glow */}
              <div className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${s.accent} opacity-[0.08] blur-2xl`} />
            </Card>
          ))}
        </div>

        {/* Recent */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Projets récents</h2>
          <button className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">Tout voir →</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {recentProjects.map((p) => (
            <Card key={p.id} hoverable className="overflow-hidden group">
              {/* Thumbnail */}
              <div className={`relative h-40 bg-gradient-to-br ${p.gradient} overflow-hidden`}>
                <div className="absolute inset-0 bg-black/20" />
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center backdrop-blur-sm">
                    <Play size={20} className="text-black ml-0.5" fill="black" />
                  </div>
                </div>
                {/* Duration */}
                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
                  0:{p.duration.toString().padStart(2, '0')}
                </div>
                {/* Format */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-bold backdrop-blur-sm">
                  {p.format}
                </div>
                {/* Status */}
                {p.status === 'draft' && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[var(--warning)] text-black text-[10px] font-bold">
                    BROUILLON
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="p-4 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{p.name}</div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{p.updated}</div>
                </div>
                <button className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 transition-colors">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
