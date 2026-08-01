import { useState } from 'react';
import { Github, Sparkles, ArrowRight, Loader2, CheckCircle2, Palette, Code2, Film } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { analyzeApp, type AnalysisResult } from '../lib/analyzer';

type Step = 'input' | 'analyzing' | 'done';

export function MagicPage() {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!url.includes('github.com')) {
      setError('Colle une URL GitHub valide (ex: https://github.com/owner/app)');
      return;
    }
    setError('');
    setStep('analyzing');
    try {
      const res = await analyzeApp(url);
      setResult(res);
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Analyse impossible');
      setStep('input');
    }
  };

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col items-center justify-center px-8 py-16">
        {step === 'input' && (
          <div className="w-full max-w-xl animate-fade-in">
            <div className="text-center mb-10">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[#a855f7] flex items-center justify-center mx-auto mb-6 shadow-[var(--shadow-glow)]">
                <Sparkles size={28} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-3">
                Analyse magique
              </h1>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Colle l'URL GitHub de ton app. Le studio analyse son code,
                son design et son fonctionnement, puis génère la vidéo promo.
              </p>
            </div>

            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Github size={20} className="text-[var(--text-tertiary)] flex-shrink-0" />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  placeholder="https://github.com/owner/mon-app"
                  className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
                  autoFocus
                />
              </div>
              {error && <p className="text-xs text-[var(--danger)] mb-3">{error}</p>}
              <Button
                variant="primary"
                className="w-full"
                icon={<ArrowRight size={16} />}
                onClick={handleAnalyze}
              >
                Analyser l'application
              </Button>
            </Card>

            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { icon: Code2, label: 'Code analysé' },
                { icon: Palette, label: 'Design extrait' },
                { icon: Film, label: 'Vidéo générée' },
              ].map((f) => (
                <div key={f.label} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <f.icon size={16} className="text-[var(--accent)]" />
                  <span className="text-[11px] text-[var(--text-tertiary)] text-center">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="text-center animate-fade-in">
            <Loader2 size={40} className="text-[var(--accent)] animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Analyse en cours…</h2>
            <p className="text-sm text-[var(--text-tertiary)]">Lecture du code, extraction du design DNA</p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="w-full max-w-2xl animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle2 size={22} className="text-[var(--success)]" />
              <h2 className="text-xl font-bold text-[var(--text-primary)]">Analyse terminée</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <Card className="p-5">
                <h3 className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Code2 size={12} /> Application
                </h3>
                <div className="text-lg font-bold text-[var(--text-primary)] mb-1">{result.identity.name}</div>
                <p className="text-xs text-[var(--text-secondary)] mb-3 line-clamp-2">{result.identity.description || 'Pas de description'}</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.identity.detectedStack.slice(0, 5).map((s) => (
                    <Badge key={s} variant="info">{s}</Badge>
                  ))}
                  {result.identity.detectedStack.length === 0 && (
                    <Badge variant="default">{result.identity.language || 'Stack inconnue'}</Badge>
                  )}
                </div>
                {result.identity.detectedRoutes.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      {result.identity.detectedRoutes.length} routes: {result.identity.detectedRoutes.slice(0, 4).join(' ')}
                    </span>
                  </div>
                )}
              </Card>

              <Card className="p-5">
                <h3 className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Palette size={12} /> Design DNA
                </h3>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg border border-white/10" style={{ backgroundColor: result.design.bgColor }} />
                  <div className="w-10 h-10 rounded-lg border border-white/10" style={{ backgroundColor: result.design.accentColor }} />
                  <Badge variant={result.design.theme === 'dark' ? 'default' : 'info'}>{result.design.theme}</Badge>
                </div>
                <div className="text-xs text-[var(--text-secondary)] space-y-1">
                  <div>Fond: <code className="text-[var(--text-primary)]">{result.design.bgColor}</code></div>
                  <div>Accent: <code className="text-[var(--text-primary)]">{result.design.accentColor}</code></div>
                  <div className="truncate">Police: {result.design.fontFamily.split(',')[0]}</div>
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-tertiary)]">
                  {result.design.sources.length} fichiers style · confiance {Math.round(result.design.confidence * 100)}%
                </div>
              </Card>
            </div>

            {result.captureUrl && (
              <Card className="p-4 mb-6 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">App déployée détectée</div>
                  <a href={result.captureUrl} target="_blank" rel="noreferrer" className="text-sm text-[var(--accent-text)] hover:underline">
                    {result.captureUrl}
                  </a>
                </div>
                <Badge variant="success">capturable</Badge>
              </Card>
            )}

            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setStep('input'); setResult(null); setUrl(''); }}>
                Nouvelle analyse
              </Button>
              <Button variant="primary" className="flex-1" icon={<Film size={16} />}>
                Générer la vidéo
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
