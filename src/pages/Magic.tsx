import { useState } from 'react';
import {
  Github, Sparkles, ArrowRight, ArrowLeft, Loader2, CheckCircle2,
  Palette, Code2, Film, Mic, Music, Camera, Shield, Download,
  Monitor, Volume2, Wand2, RefreshCw, Eye, Zap, Clock, Play,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

type StepId = 'source' | 'analysis' | 'capture' | 'storyboard' | 'voice' | 'music' | 'render' | 'qa' | 'export';

const STEPS: { id: StepId; label: string; icon: typeof Github }[] = [
  { id: 'source', label: 'Source', icon: Github },
  { id: 'analysis', label: 'Analyse', icon: Code2 },
  { id: 'capture', label: 'Capture', icon: Camera },
  { id: 'storyboard', label: 'Scénario', icon: Film },
  { id: 'voice', label: 'Voix', icon: Mic },
  { id: 'music', label: 'Musique', icon: Music },
  { id: 'render', label: 'Rendu', icon: Wand2 },
  { id: 'qa', label: 'Contrôle', icon: Shield },
  { id: 'export', label: 'Export', icon: Download },
];

export function MagicPage() {
  const [step, setStep] = useState<StepId>('source');
  const [stepIndex, setStepIndex] = useState(0);
  const [githubUrl, setGithubUrl] = useState('');
  const [deployUrl, setDeployUrl] = useState('');

  // Pipeline state
  const [renderStyle, setRenderStyle] = useState<'screencast' | 'cinematic'>('screencast');
  const [voiceMode, setVoiceMode] = useState<'tts' | 'custom' | 'none'>('tts');
  const [voiceLang, setVoiceLang] = useState<'fr' | 'en'>('fr');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [musicMode, setMusicMode] = useState<'auto' | 'custom' | 'none'>('auto');
  const [qaTarget, setQaTarget] = useState(75);
  const [format, setFormat] = useState<'16:9' | '9:16' | '1:1'>('16:9');

  const goNext = () => {
    const next = Math.min(stepIndex + 1, STEPS.length - 1);
    setStepIndex(next);
    setStep(STEPS[next].id);
  };
  const goPrev = () => {
    const prev = Math.max(stepIndex - 1, 0);
    setStepIndex(prev);
    setStep(STEPS[prev].id);
  };

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col">
        {/* ─── Stepper ─── */}
        <div className="flex-shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-8 py-3">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => {
              const active = i === stepIndex;
              const done = i < stepIndex;
              return (
                <div key={s.id} className="flex items-center flex-1">
                  <button
                    onClick={() => { setStepIndex(i); setStep(s.id); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      active ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]' :
                      done ? 'text-[var(--success)] hover:bg-[var(--bg-surface-2)]' :
                      'text-[var(--text-tertiary)] hover:bg-[var(--bg-surface-2)]'
                    }`}
                  >
                    {done ? <CheckCircle2 size={14} /> : <s.icon size={14} />}
                    <span className="hidden md:inline">{s.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`h-px flex-1 mx-1 ${done ? 'bg-[var(--success)]' : 'bg-[var(--border-subtle)]'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-3xl mx-auto">
            {step === 'source' && (
              <SourceStep githubUrl={githubUrl} setGithubUrl={setGithubUrl} deployUrl={deployUrl} setDeployUrl={setDeployUrl} />
            )}
            {step === 'analysis' && (
              <AnalysisStep githubUrl={githubUrl} />
            )}
            {step === 'capture' && (
              <CaptureStep deployUrl={deployUrl} />
            )}
            {step === 'storyboard' && (
              <StoryboardStep />
            )}
            {step === 'voice' && (
              <VoiceStep voiceMode={voiceMode} setVoiceMode={setVoiceMode} voiceLang={voiceLang} setVoiceLang={setVoiceLang} voiceGender={voiceGender} setVoiceGender={setVoiceGender} />
            )}
            {step === 'music' && (
              <MusicStep musicMode={musicMode} setMusicMode={setMusicMode} />
            )}
            {step === 'render' && (
              <RenderStep renderStyle={renderStyle} setRenderStyle={setRenderStyle} format={format} setFormat={setFormat} />
            )}
            {step === 'qa' && (
              <QAStep qaTarget={qaTarget} setQaTarget={setQaTarget} />
            )}
            {step === 'export' && (
              <ExportStep />
            )}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <div className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-8 py-3 flex items-center justify-between">
          <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={goPrev} disabled={stepIndex === 0}>
            Précédent
          </Button>
          <span className="text-xs text-[var(--text-tertiary)]">Étape {stepIndex + 1} / {STEPS.length}</span>
          {stepIndex < STEPS.length - 1 ? (
            <Button variant="primary" icon={<ArrowRight size={16} />} onClick={goNext}>
              Suivant
            </Button>
          ) : (
            <Button variant="primary" icon={<Download size={16} />}>
              Télécharger
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}

// ═══════════════════════════════════════════════════
// STEP 1: SOURCE — GitHub URL + deployed URL
// ═══════════════════════════════════════════════════
function SourceStep({ githubUrl, setGithubUrl, deployUrl, setDeployUrl }: any) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Source du projet</h1>
      <p className="text-[var(--text-secondary)] mb-8">Le studio analyse le code, comprend le fonctionnement et capture l'app en action.</p>

      <Card className="p-6 mb-6">
        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Github size={14} /> Dépôt GitHub
        </label>
        <input
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          placeholder="https://github.com/owner/mon-app"
          className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] transition-colors"
          autoFocus
        />
        <p className="text-xs text-[var(--text-tertiary)] mt-2">L'agent lit le code source : routes React, composants, design DNA, textes UI.</p>
      </Card>

      <Card className="p-6">
        <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Monitor size={14} /> URL déployée (optionnel)
        </label>
        <input
          value={deployUrl}
          onChange={(e) => setDeployUrl(e.target.value)}
          placeholder="https://mon-app.vercel.app"
          className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent)] transition-colors"
        />
        <p className="text-xs text-[var(--text-tertiary)] mt-2">Le robot de capture visite l'app, navigue les pages, clique les onglets, remplit les formulaires.</p>
      </Card>

      <div className="grid grid-cols-3 gap-3 mt-6">
        {[
          { icon: Code2, label: 'Code', desc: 'Routes, features, composants' },
          { icon: Palette, label: 'Design', desc: 'Couleurs, fonts, thème' },
          { icon: Eye, label: 'Capture', desc: 'App en action avec données' },
        ].map((f) => (
          <div key={f.label} className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <f.icon size={18} className="text-[var(--accent)] mb-2" />
            <div className="text-sm font-semibold text-[var(--text-primary)]">{f.label}</div>
            <div className="text-xs text-[var(--text-tertiary)]">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 2: ANALYSIS — results of code analysis
// ═══════════════════════════════════════════════════
function AnalysisStep({ githubUrl }: any) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Analyse du code</h1>
      <p className="text-[var(--text-secondary)] mb-8">L'agent IA lit votre dépôt et comprend l'application.</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Code2 size={16} className="text-[var(--accent)]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Architecture</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Catégorie</span><span className="text-[var(--text-primary)] font-medium">Field-ops</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Domaine</span><span className="text-[var(--text-primary)] font-medium">Fibre optique</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Routes</span><span className="text-[var(--text-primary)] font-medium">3 détectées</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Composants</span><span className="text-[var(--text-primary)] font-medium">15</span></div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Palette size={16} className="text-[var(--accent)]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Design DNA</h3>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg border border-white/10" style={{ background: '#e63312' }} />
            <div className="w-10 h-10 rounded-lg border border-white/10" style={{ background: '#0f172a' }} />
            <Badge>dark mode</Badge>
          </div>
          <div className="text-xs text-[var(--text-secondary)] space-y-1">
            <div>Accent: <code className="text-[var(--text-primary)]">#e63312</code></div>
            <div>Fond: <code className="text-[var(--text-primary)]">#0f172a</code></div>
            <div>Police: system-ui</div>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Fonctionnalités détectées</h3>
        <div className="flex flex-wrap gap-2">
          {['Carte interactive', 'Relevés photo', 'Recherche', 'Export données', 'Import fichiers', 'Sync temps réel', 'Formulaires', 'Navigation par onglets'].map((f) => (
            <Badge key={f} variant="info">{f}</Badge>
          ))}
        </div>
      </Card>

      <Card className="p-5 mt-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Textes UI extraits ({'80'} strings)</h3>
        <div className="text-xs text-[var(--text-secondary)] space-y-1 max-h-32 overflow-y-auto">
          <div>"Tous vos chantiers", "Préparer un chantier", "Route optique", "Tirage câble", "BPE", "Relevés terrain"...</div>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 3: CAPTURE — smart capture options
// ═══════════════════════════════════════════════════
function CaptureStep({ deployUrl }: any) {
  const [interactive, setInteractive] = useState(true);
  const [clickTabs, setClickTabs] = useState(true);
  const [fillForms, setFillForms] = useState(false);

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Capture intelligente</h1>
      <p className="text-[var(--text-secondary)] mb-8">Le robot capture l'app en action, pas juste des screenshots statiques.</p>

      <Card className="p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Zap size={18} className="text-[var(--warning)]" />
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">Capture interactive</div>
              <div className="text-xs text-[var(--text-tertiary)]">Le bot navigue les pages et interagit avec l'app</div>
            </div>
          </div>
          <Toggle checked={interactive} onChange={setInteractive} />
        </div>

        {interactive && (
          <div className="space-y-3 pl-9">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={clickTabs} onChange={(e) => setClickTabs(e.target.checked)} className="rounded border-[var(--border-subtle)]" />
              <span className="text-sm text-[var(--text-secondary)]">Cliquer les onglets détectés (Carte, Étapes, Boîtiers...)</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={fillForms} onChange={(e) => setFillForms(e.target.checked)} className="rounded border-[var(--border-subtle)]" />
              <span className="text-sm text-[var(--text-secondary)]">Remplir les formulaires avec données de démo</span>
            </label>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-4">Pages à capturer (auto-détectées)</h3>
        <div className="space-y-2">
          {[
            { path: '/', desc: 'Page d\'accueil — liste des chantiers', role: 'Hook' },
            { path: '/chantier/FRSO3374', desc: 'Carte interactive avec MapLibre', role: 'Feature', tab: 'Carte' },
            { path: '/chantier/FRSO3374', desc: 'Étapes de la route optique', role: 'Feature', tab: 'Étapes' },
            { path: '/chantier/FRSO3374', desc: 'Plans de boîtes de soudure', role: 'Feature', tab: 'Boîtiers' },
            { path: '/chantier/FRSO3374', desc: 'Relevés terrain photos', role: 'Proof', tab: 'Relevés' },
            { path: '/preparer', desc: 'Préparation de chantier', role: 'Feature' },
          ].map((p, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]">
              <CheckCircle2 size={16} className="text-[var(--success)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--text-primary)] font-mono truncate">{p.path}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{p.desc}</div>
              </div>
              {p.tab && <Badge variant="info">{p.tab}</Badge>}
              <Badge>{p.role}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 4: STORYBOARD — narrative plan
// ═══════════════════════════════════════════════════
function StoryboardStep() {
  const scenes = [
    { role: 'Hook', caption: 'Tous vos chantiers en un coup d\'œil', duration: '3s' },
    { role: 'Feature 1', caption: 'Une carte interactive par chantier', duration: '4s' },
    { role: 'Feature 2', caption: 'Suivez chaque étape du déploiement', duration: '4s' },
    { role: 'Feature 3', caption: 'Plans de boîtes de soudure détaillés', duration: '4s' },
    { role: 'Proof', caption: 'Relevés terrain avec photos', duration: '3s' },
    { role: 'CTA', caption: 'Déployez la fibre plus vite', duration: '3s' },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Scénario narratif</h1>
      <p className="text-[var(--text-secondary)] mb-8">Plan optimisé par l'IA. Chaque scène a un rôle narratif et une durée précise.</p>

      <div className="space-y-3 mb-6">
        {scenes.map((s, i) => (
          <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center text-xs font-bold text-[var(--accent-text)] flex-shrink-0">
              {i + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default">{s.role}</Badge>
                <span className="text-xs text-[var(--text-tertiary)]">{s.duration}</span>
              </div>
              <div className="text-sm text-[var(--text-primary)]">{s.caption}</div>
            </div>
          </div>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[var(--accent)]" />
            <span className="text-sm text-[var(--text-secondary)]">Durée totale : <span className="text-[var(--text-primary)] font-bold">21s + intro/outro = ~27s</span></span>
          </div>
          <Badge variant="success">Optimal (20-28s)</Badge>
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 5: VOICE — voice-over options
// ═══════════════════════════════════════════════════
function VoiceStep({ voiceMode, setVoiceMode, voiceLang, setVoiceLang, voiceGender, setVoiceGender }: any) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Voix-off</h1>
      <p className="text-[var(--text-secondary)] mb-8">Narration générée à partir des captions, ou ta propre voix.</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <OptionCard active={voiceMode === 'tts'} onClick={() => setVoiceMode('tts')} icon={Wand2} title="Voix IA" desc="Générée automatiquement" badge="Recommandé" />
        <OptionCard active={voiceMode === 'custom'} onClick={() => setVoiceMode('custom')} icon={Mic} title="Ma voix" desc="Importer un fichier audio" />
        <OptionCard active={voiceMode === 'none'} onClick={() => setVoiceMode('none')} icon={Volume2} title="Sans voix" desc="Musique seule" />
      </div>

      {voiceMode === 'tts' && (
        <Card className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 block">Langue</label>
            <div className="flex gap-2">
              <OptionPill active={voiceLang === 'fr'} onClick={() => setVoiceLang('fr')}>🇫🇷 Français</OptionPill>
              <OptionPill active={voiceLang === 'en'} onClick={() => setVoiceLang('en')}>🇬🇧 English</OptionPill>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 block">Voix</label>
            <div className="flex gap-2">
              <OptionPill active={voiceGender === 'male'} onClick={() => setVoiceGender('male')}>Homme</OptionPill>
              <OptionPill active={voiceGender === 'female'} onClick={() => setVoiceGender('female')}>Femme</OptionPill>
            </div>
          </div>
          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <div className="text-xs text-[var(--text-tertiary)] mb-2">Script généré :</div>
            <div className="text-sm text-[var(--text-secondary)] italic bg-[var(--bg-base)] rounded-lg p-3 max-h-32 overflow-y-auto">
              "L'application terrain qui accompagne les techniciens dans le déploiement de la fibre. Tous vos chantiers en un coup d'œil..."
            </div>
          </div>
          <Button variant="secondary" icon={<Volume2 size={16} />} className="w-full">Prévisualiser la voix</Button>
        </Card>
      )}

      {voiceMode === 'custom' && (
        <Card className="p-6">
          <div className="border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8 text-center">
            <Mic size={32} className="text-[var(--text-tertiary)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)] mb-2">Glisse ton fichier audio ici</p>
            <p className="text-xs text-[var(--text-tertiary)]">MP3, WAV, M4A — max 50 Mo</p>
            <Button variant="secondary" className="mt-4">Parcourir</Button>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-3">💡 Astuce : enregistre ta voix avec QuickTime ou Voice Memos. La narration sera mixée avec la musique automatiquement.</p>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 6: MUSIC — background music options
// ═══════════════════════════════════════════════════
function MusicStep({ musicMode, setMusicMode }: any) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Musique</h1>
      <p className="text-[var(--text-secondary)] mb-8">Sélection automatique selon le type d'app, ou ta propre musique.</p>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <OptionCard active={musicMode === 'auto'} onClick={() => setMusicMode('auto')} icon={Wand2} title="Auto" desc="Choisie selon l'app" badge="110-130 BPM" />
        <OptionCard active={musicMode === 'custom'} onClick={() => setMusicMode('custom')} icon={Music} title="Ma musique" desc="Importer un fichier" />
        <OptionCard active={musicMode === 'none'} onClick={() => setMusicMode('none')} icon={Volume2} title="Sans musique" desc="Voix seule" />
      </div>

      {musicMode === 'auto' && (
        <Card className="p-6">
          <div className="space-y-3">
            {[
              { name: 'Driving Electronic', bpm: 120, mood: 'Énergique, urgent', match: 95 },
              { name: 'Corporate Inspiring', bpm: 115, mood: 'Pro, confiant', match: 82 },
              { name: 'Minimal Tech', bpm: 110, mood: 'Sobre, moderne', match: 76 },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center">
                  <Music size={16} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[var(--text-primary)]">{m.name}</div>
                  <div className="text-xs text-[var(--text-tertiary)]">{m.bpm} BPM · {m.mood}</div>
                </div>
                <Badge variant={m.match > 90 ? 'success' : 'default'}>{m.match}% match</Badge>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-4">La musique est ducked (-6dB) sous la voix-off automatiquement.</p>
        </Card>
      )}

      {musicMode === 'custom' && (
        <Card className="p-6">
          <div className="border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8 text-center">
            <Music size={32} className="text-[var(--text-tertiary)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)] mb-2">Glisse ta musique ici</p>
            <p className="text-xs text-[var(--text-tertiary)]">MP3, WAV — sera ajustée à la durée de la vidéo</p>
          </div>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 7: RENDER — style + quality options
// ═══════════════════════════════════════════════════
function RenderStep({ renderStyle, setRenderStyle, format, setFormat }: any) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Style de rendu</h1>
      <p className="text-[var(--text-secondary)] mb-8">Comment l'app est présentée dans la vidéo.</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <OptionCard active={renderStyle === 'screencast'} onClick={() => setRenderStyle('screencast')} icon={Monitor} title="Capture d'écran" desc="Style ScreenStudio. L'app remplit l'écran, curseur qui clique, pan/zoom dedans." badge="Recommandé" />
        <OptionCard active={renderStyle === 'cinematic'} onClick={() => setRenderStyle('cinematic')} icon={Film} title="Cinématique" desc="Mockup 3D flottant, particules, glow, glassmorphism." badge="Premium" />
      </div>

      <Card className="p-6 mb-4">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 block">Format</label>
        <div className="flex gap-3">
          {[
            { id: '16:9', label: '16:9', desc: 'YouTube, Web' },
            { id: '9:16', label: '9:16', desc: 'Reels, Stories' },
            { id: '1:1', label: '1:1', desc: 'LinkedIn, Insta' },
          ].map((f) => (
            <OptionCard key={f.id} active={format === f.id} onClick={() => setFormat(f.id as any)} title={f.label} desc={f.desc} small />
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">Effets inclus</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            'Curseur virtuel + click ripple',
            'Browser frame (macOS dots)',
            'Pan/zoom Ken Burns',
            'Caption word-stagger animation',
            'URL bar dynamique',
            'Accent color auto-extrait',
            'Barre gradient pour lisibilité',
            'Transitions slidePush fluides',
          ].map((e) => (
            <div key={e} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <CheckCircle2 size={14} className="text-[var(--success)] flex-shrink-0" />
              {e}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 8: QA — auto quality control
// ═══════════════════════════════════════════════════
function QAStep({ qaTarget, setQaTarget }: any) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Auto-contrôle qualité</h1>
      <p className="text-[var(--text-secondary)] mb-8">Un juge IA analyse chaque frame et corrige automatiquement.</p>

      <Card className="p-6 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <Shield size={20} className="text-[var(--accent)]" />
          <div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">Score cible</div>
            <div className="text-xs text-[var(--text-tertiary)]">Le système itère jusqu'à atteindre ce score</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <input type="range" min="60" max="95" value={qaTarget} onChange={(e) => setQaTarget(Number(e.target.value))} className="flex-1" />
          <div className="text-2xl font-bold text-[var(--accent)] w-16 text-right">{qaTarget}/100</div>
        </div>
        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
          <span>Standard (60)</span>
          <span>Pro (75)</span>
          <span>Excellence (95)</span>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-4">Ce que le juge vérifie</h3>
        <div className="space-y-2">
          {[
            { crit: 'Exposition', desc: 'Pas de frames sombres (luminance > 40)', priority: 'P0' },
            { crit: 'Lisibilité', desc: 'Texte net, contraste suffisant', priority: 'P1' },
            { crit: 'Dynamisme', desc: 'Mouvement visible à chaque frame', priority: 'P1' },
            { crit: 'Professionnalisme', desc: 'Digne d\'une vidéo Apple/Linear', priority: 'P2' },
            { crit: 'Variété', desc: 'Pas de scènes répétitives', priority: 'P2' },
          ].map((c) => (
            <div key={c.crit} className="flex items-center gap-3 py-2">
              <Badge variant={c.priority === 'P0' ? 'danger' : c.priority === 'P1' ? 'warning' : 'default'}>{c.priority}</Badge>
              <div className="flex-1">
                <span className="text-sm text-[var(--text-primary)] font-medium">{c.crit}</span>
                <span className="text-xs text-[var(--text-tertiary)] ml-2">{c.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <RefreshCw size={14} />
        <span>Auto-correction : le juge détecte les défauts → l'engine corrige → re-render → nouvelle évaluation</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// STEP 9: EXPORT — download
// ═══════════════════════════════════════════════════
function ExportStep() {
  return (
    <div className="animate-fade-in text-center">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
        <Download size={36} className="text-white" />
      </div>
      <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Vidéo prête !</h1>
      <p className="text-[var(--text-secondary)] mb-8">Ta vidéo promo est générée avec auto-contrôle qualité.</p>

      <Card className="p-6 max-w-md mx-auto mb-6">
        <div className="aspect-video rounded-xl bg-[var(--bg-base)] mb-4 flex items-center justify-center border border-[var(--border-subtle)]">
          <Play size={40} className="text-[var(--text-tertiary)]" />
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-[var(--text-tertiary)] mb-1">Durée</div>
            <div className="text-sm font-bold text-[var(--text-primary)]">27s</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] mb-1">Score QA</div>
            <div className="text-sm font-bold text-[var(--success)]">78/100</div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] mb-1">Taille</div>
            <div className="text-sm font-bold text-[var(--text-primary)]">23 Mo</div>
          </div>
        </div>
      </Card>

      <div className="flex gap-3 justify-center">
        <Button variant="secondary" icon={<RefreshCw size={16} />}>Re-générer</Button>
        <Button variant="primary" icon={<Download size={16} />}>Télécharger MP4</Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════════
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-surface-3)]'}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  );
}

function OptionCard({ active, onClick, icon: Icon, title, desc, badge, small }: any) {
  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-xl border text-left transition-all ${
        active ? 'border-[var(--accent)] bg-[var(--accent-subtle)]' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-tertiary)]'
      } ${small ? 'flex-1 text-center' : ''}`}
    >
      {badge && <Badge variant="info" className="absolute top-2 right-2 text-[9px]">{badge}</Badge>}
      {Icon && <Icon size={small ? 0 : 20} className={`text-[var(--accent)] mb-2 ${small ? 'hidden' : ''}`} />}
      <div className={`text-sm font-semibold text-[var(--text-primary)] ${small ? 'text-center' : ''}`}>{title}</div>
      <div className={`text-xs text-[var(--text-tertiary)] ${small ? 'text-center' : ''}`}>{desc}</div>
    </button>
  );
}

function OptionPill({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-base)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--text-tertiary)]'
      }`}
    >
      {children}
    </button>
  );
}
