import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Wand2, Monitor, Smartphone, Square, Download, Clock } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ScreenshotUploader } from '../components/ScreenshotUploader';
import { useEditorStore } from '../store/editor';
import type { VideoFormat } from '../lib/types';

const templates = [
  { id: 'clean-dark', name: 'Clean Dark', desc: 'Sobre, sombre, élégant', premium: false, gradient: 'from-zinc-700 to-zinc-900' },
  { id: 'bold-pop', name: 'Bold Pop', desc: 'Coloré, dynamique', premium: false, gradient: 'from-pink-500 to-orange-400' },
  { id: 'minimal-light', name: 'Minimal Light', desc: 'Clair, Apple-like', premium: true, gradient: 'from-gray-100 to-gray-300' },
  { id: 'gradient-flow', name: 'Gradient Flow', desc: 'Dégradés fluides', premium: true, gradient: 'from-indigo-500 to-purple-500' },
];

const formatOptions: { id: VideoFormat; icon: typeof Monitor; label: string; ratio: string; desc: string }[] = [
  { id: 'horizontal', icon: Monitor, label: '16:9', ratio: 'Horizontal', desc: 'YouTube, Web' },
  { id: 'vertical', icon: Smartphone, label: '9:16', ratio: 'Vertical', desc: 'Stories, Reels' },
  { id: 'square', icon: Square, label: '1:1', ratio: 'Carré', desc: 'Instagram, LinkedIn' },
];

export function EditorPage() {
  const navigate = useNavigate();
  const { screenshots, format, setFormat, addScreenshot, removeScreenshot, reorderScreenshots } =
    useEditorStore();
  const [selectedTemplate, setSelectedTemplate] = useState('clean-dark');
  const [projectName, setProjectName] = useState('Sans titre');
  const [tagline, setTagline] = useState('');

  const handleAddFile = (file: File) => {
    const url = URL.createObjectURL(file);
    addScreenshot({
      id: crypto.randomUUID(),
      storage_path: url,
      display_order: screenshots.length,
      transition_type: 'fade',
      duration_seconds: 3,
    });
  };

  const totalDuration = screenshots.reduce((sum, s) => sum + s.duration_seconds, 0);
  const dims = format === 'horizontal'
    ? { w: 560, h: 315 }
    : format === 'vertical'
    ? { w: 270, h: 480 }
    : { w: 360, h: 360 };

  return (
    <AppShell>
      <div className="h-screen flex flex-col">
        {/* Top bar */}
        <header className="h-14 flex-shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/')} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors p-1.5">
              <ArrowLeft size={18} />
            </button>
            <div className="w-px h-6 bg-[var(--border-subtle)]" />
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="bg-transparent text-sm font-semibold text-[var(--text-primary)] outline-none border-b border-transparent focus:border-[var(--accent)] transition-colors min-w-0"
            />
            {screenshots.length > 0 && (
              <Badge variant="accent">{screenshots.length} écrans · {totalDuration}s</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon={<Download size={16} />}>Exporter</Button>
            <Button variant="secondary" size="sm" icon={<Play size={16} />}>Aperçu</Button>
            <Button variant="primary" size="sm" icon={<Wand2 size={16} />}>Générer</Button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Left panel */}
          <aside className="w-80 flex-shrink-0 border-r border-[var(--border-subtle)] overflow-y-auto">
            {/* Format */}
            <Section title="Format">
              <div className="grid grid-cols-3 gap-2">
                {formatOptions.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-[10px] border transition-all ${
                      format === f.id
                        ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                        : 'border-[var(--border-subtle)] hover:border-[var(--border-default)] bg-[var(--bg-surface-2)]'
                    }`}
                  >
                    <f.icon size={18} className={format === f.id ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'} />
                    <span className={`text-xs font-semibold ${format === f.id ? 'text-[var(--accent-text)]' : 'text-[var(--text-secondary)]'}`}>
                      {f.label}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">{f.desc}</span>
                  </button>
                ))}
              </div>
            </Section>

            {/* Screenshots */}
            <Section title="Screenshots">
              <ScreenshotUploader
                screenshots={screenshots}
                onAdd={handleAddFile}
                onRemove={removeScreenshot}
                onReorder={reorderScreenshots}
              />
            </Section>

            {/* Text */}
            <Section title="Texte">
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5 block">Nom de l'app</label>
                  <input
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="Ex: ZEFIL Terrain"
                    className="w-full h-9 px-3 bg-[var(--bg-surface-2)] border border-[var(--border-subtle)] rounded-[8px] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:bg-[var(--bg-surface-3)] outline-none transition-all"
                  />
                </div>
              </div>
            </Section>
          </aside>

          {/* Center: Preview */}
          <div className="flex-1 flex flex-col items-center justify-center bg-[var(--bg-base)] relative overflow-hidden">
            {/* Grid background */}
            <div className="absolute inset-0 opacity-[0.03]" style={{
              backgroundImage: 'linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }} />

            <div className="relative">
              {/* Preview frame */}
              <div
                className="bg-black border border-[var(--border-subtle)] rounded-[16px] overflow-hidden shadow-2xl shadow-black/50 ring-1 ring-white/5"
                style={{ width: dims.w, height: dims.h }}
              >
                {screenshots.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-center px-8">
                    <div className="w-14 h-14 rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center mb-3">
                      <Play size={24} className="text-[var(--text-tertiary)] ml-0.5" />
                    </div>
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Aperçu de la vidéo</p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Ajoutez des screenshots pour commencer</p>
                  </div>
                ) : (
                  <img src={screenshots[0]?.storage_path} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              {/* Format badge */}
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                <Badge variant="accent">{formatOptions.find((f) => f.id === format)?.label}</Badge>
              </div>
            </div>

            {/* Timeline */}
            {screenshots.length > 0 && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-lg">
                <Clock size={14} className="text-[var(--text-tertiary)]" />
                {screenshots.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-[var(--bg-surface-3)] overflow-hidden ring-1 ring-white/5">
                      <img src={s.storage_path} alt="" className="w-full h-full object-cover" />
                    </div>
                    {i < screenshots.length - 1 && <div className="w-1 h-1 rounded-full bg-[var(--text-tertiary)]" />}
                  </div>
                ))}
                <span className="text-xs text-[var(--text-tertiary)] ml-1">{totalDuration}s</span>
              </div>
            )}
          </div>

          {/* Right: Templates */}
          <aside className="w-72 flex-shrink-0 border-l border-[var(--border-subtle)] overflow-y-auto">
            <Section title="Style">
              <div className="space-y-2">
                {templates.map((t) => (
                  <Card
                    key={t.id}
                    hoverable
                    onClick={() => setSelectedTemplate(t.id)}
                    className={`p-0 overflow-hidden ${selectedTemplate === t.id ? 'ring-2 ring-[var(--accent)]' : ''}`}
                  >
                    <div className={`h-16 bg-gradient-to-br ${t.gradient}`} />
                    <div className="p-3 flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{t.name}</div>
                        <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{t.desc}</div>
                      </div>
                      {t.premium && <Badge variant="warning">PRO</Badge>}
                    </div>
                  </Card>
                ))}
              </div>
            </Section>

            {/* Audio */}
            <Section title="Audio">
              <div className="space-y-2">
                <button className="w-full flex items-center gap-3 p-2.5 rounded-[10px] border border-[var(--border-subtle)] hover:border-[var(--border-default)] bg-[var(--bg-surface-2)] transition-all text-left">
                  <div className="w-8 h-8 rounded bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0">
                    <Play size={14} className="text-white ml-0.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">Ambient — Soft</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Musique libre de droits</div>
                  </div>
                </button>
                <button className="w-full p-2.5 rounded-[10px] border border-dashed border-[var(--border-default)] hover:border-[var(--accent)] hover:bg-[var(--accent-subtle)] text-[var(--text-tertiary)] hover:text-[var(--accent-text)] text-sm font-medium transition-all">
                  + Importer une musique
                </button>
              </div>
            </Section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-5 border-b border-[var(--border-subtle)]">
      <h3 className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}
