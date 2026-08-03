import { useState, useEffect } from 'react';
import {
  Github, Sparkles, ArrowRight, ArrowLeft, Loader2, CheckCircle2,
  Palette, Code2, Film, Mic, Music, Camera, Shield, Download,
  Monitor, Volume2, Wand2, RefreshCw, Eye, Zap, Clock, Play, AlertCircle, XCircle,
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import {
  analyzeApp, captureApp, generateStoryboard, generateVoice,
  renderVideo, runQA, runPipeline, getJobStatus, downloadUrl,
  type AnalysisResult, type CaptureManifest, type Storyboard, type QAResult,
} from '../lib/pipeline';

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

  // Source
  const [githubUrl, setGithubUrl] = useState('');
  const [deployUrl, setDeployUrl] = useState('');

  // Analysis
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // Capture
  const [capturing, setCapturing] = useState(false);
  const [captures, setCaptures] = useState<CaptureManifest | null>(null);

  // Storyboard
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);

  // Options
  const [renderStyle, setRenderStyle] = useState<'screencast' | 'cinematic'>('screencast');
  const [voiceMode, setVoiceMode] = useState<'tts' | 'custom' | 'none'>('tts');
  const [voiceLang, setVoiceLang] = useState<'fr' | 'en'>('fr');
  const [voiceGender, setVoiceGender] = useState<'male' | 'female'>('male');
  const [musicMode, setMusicMode] = useState<'auto' | 'custom' | 'none'>('auto');
  const [qaTarget, setQaTarget] = useState(75);
  const [format, setFormat] = useState<'16:9' | '9:16' | '1:1'>('16:9');

  // Pipeline
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineJob, setPipelineJob] = useState<any>(null);
  const [qaResult, setQaResult] = useState<QAResult | null>(null);
  const [finalVideo, setFinalVideo] = useState('');

  // ── Step 1: Analyze ──
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError('');
    try {
      const res = await analyzeApp(githubUrl, deployUrl);
      if (res.success && res.analysis) {
        setAnalysis(res.analysis);
      } else {
        setAnalysisError(res.error || 'Analyse impossible');
      }
    } catch (e: any) {
      setAnalysisError(e.message);
    }
    setAnalyzing(false);
  };

  // ── Step 2: Capture ──
  const handleCapture = async () => {
    setCapturing(true);
    try {
      const res = await captureApp(deployUrl || 'https://zefil-terrain.vercel.app');
      if (res.success && res.manifest) setCaptures(res.manifest);
    } catch (e) { /* silent */ }
    setCapturing(false);
  };

  // ── Full Pipeline ──
  const handlePipeline = async () => {
    setPipelineRunning(true);
    setPipelineJob(null);
    setQaResult(null);
    setFinalVideo('');

    try {
      const { jobId } = await runPipeline({
        githubUrl,
        deployUrl,
        voiceMode,
        voiceLang,
        musicMode,
        renderStyle,
        format: format === '16:9' ? 'horizontal' : format === '9:16' ? 'vertical' : 'square',
        qaTarget,
        maxIterations: 3,
      });

      // Poll for status
      const poll = setInterval(async () => {
        const status = await getJobStatus(jobId);
        if (status.success && status.job) {
          setPipelineJob(status.job);
          if (status.job.status === 'completed') {
            clearInterval(poll);
            setPipelineRunning(false);
            if (status.job.result?.videoPath) {
              setFinalVideo(status.job.result.videoPath);
            }
            if (status.job.result?.qaScore) {
              // Fetch QA report
              setQaResult({
                globalScore: status.job.result.qaScore,
                verdict: status.job.result.qaScore >= qaTarget ? 'PASS' : 'MARGINAL',
                darkFrameCount: 0,
                issues: [],
                corrections: [],
              });
            }
          } else if (status.job.status === 'error') {
            clearInterval(poll);
            setPipelineRunning(false);
          }
        }
      }, 3000);
    } catch (e: any) {
      setPipelineRunning(false);
    }
  };

  const goNext = () => { const n = Math.min(stepIndex + 1, STEPS.length - 1); setStepIndex(n); setStep(STEPS[n].id); };
  const goPrev = () => { const n = Math.max(stepIndex - 1, 0); setStepIndex(n); setStep(STEPS[n].id); };

  const stepLabels: Record<string, string> = {
    analyze: 'Analyse du code', capture: 'Capture intelligente',
    storyboard: 'Plan narratif', voice: 'Génération voix-off',
    render: 'Rendu vidéo', qa: 'Contrôle qualité',
  };

  return (
    <AppShell>
      <div className="min-h-screen flex flex-col">
        {/* Stepper */}
        <div className="flex-shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-8 py-3">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <button onClick={() => { setStepIndex(i); setStep(s.id); }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    i === stepIndex ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)]' :
                    i < stepIndex ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'
                  }`}>
                  {i < stepIndex ? <CheckCircle2 size={14} /> : <s.icon size={14} />}
                  <span className="hidden md:inline">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className={`h-px flex-1 mx-1 ${i < stepIndex ? 'bg-[var(--success)]' : 'bg-[var(--border-subtle)]'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-3xl mx-auto">
            {/* SOURCE */}
            {step === 'source' && (
              <div className="animate-fade-in">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Source du projet</h1>
                <p className="text-[var(--text-secondary)] mb-8">Le studio analyse le code, comprend le fonctionnement et capture l'app en action.</p>
                <Card className="p-6 mb-6">
                  <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-2"><Github size={14} /> Dépôt GitHub</label>
                  <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/owner/mon-app"
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" autoFocus />
                </Card>
                <Card className="p-6 mb-6">
                  <label className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-2"><Monitor size={14} /> URL déployée</label>
                  <input value={deployUrl} onChange={(e) => setDeployUrl(e.target.value)} placeholder="https://mon-app.vercel.app"
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
                </Card>
                {githubUrl && (
                  <Button variant="primary" icon={analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    onClick={handleAnalyze} disabled={analyzing} className="w-full">
                    {analyzing ? 'Analyse en cours…' : 'Analyser l\'application'}
                  </Button>
                )}
                {analysisError && <p className="text-xs text-[var(--danger)] mt-3 flex items-center gap-2"><AlertCircle size={14} />{analysisError}</p>}
              </div>
            )}

            {/* ANALYSIS */}
            {step === 'analysis' && (
              <div className="animate-fade-in">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Analyse du code</h1>
                <p className="text-[var(--text-secondary)] mb-8">L'agent IA lit votre dépôt et comprend l'application.</p>
                {!analysis && !analyzing && (
                  <Button variant="primary" icon={<Sparkles size={16} />} onClick={handleAnalyze}>Lancer l'analyse</Button>
                )}
                {analyzing && (
                  <div className="text-center py-12"><Loader2 size={32} className="text-[var(--accent)] animate-spin mx-auto mb-4" /><p className="text-sm text-[var(--text-tertiary)]">Lecture du code, extraction du design DNA…</p></div>
                )}
                {analysis && (
                  <>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <Card className="p-5">
                        <div className="flex items-center gap-2 mb-3"><Code2 size={16} className="text-[var(--accent)]" /><h3 className="text-xs font-bold uppercase text-[var(--text-tertiary)]">Architecture</h3></div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Catégorie</span><span className="font-medium">{analysis.category}</span></div>
                          <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Routes</span><span className="font-medium">{analysis.routes.length}</span></div>
                          <div className="flex justify-between"><span className="text-[var(--text-tertiary)]">Composants</span><span className="font-medium">{analysis.features.length}</span></div>
                        </div>
                      </Card>
                      <Card className="p-5">
                        <div className="flex items-center gap-2 mb-3"><Palette size={16} className="text-[var(--accent)]" /><h3 className="text-xs font-bold uppercase text-[var(--text-tertiary)]">Design DNA</h3></div>
                        <div className="flex items-center gap-2 mb-2">
                          {Object.values(analysis.design.colors).filter(c => c.startsWith('#')).slice(0, 4).map((c, i) => (
                            <div key={i} className="w-8 h-8 rounded-lg border border-white/10" style={{ background: c }} />
                          ))}
                          <Badge>{analysis.design.isDarkMode ? 'dark' : 'light'}</Badge>
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">{analysis.uiStrings.length} textes UI extraits</div>
                      </Card>
                    </div>
                    <Card className="p-5">
                      <h3 className="text-xs font-bold uppercase text-[var(--text-tertiary)] mb-3">Fonctionnalités détectées</h3>
                      <div className="flex flex-wrap gap-2">
                        {analysis.features.flatMap(f => f.features).filter((v, i, a) => a.indexOf(v) === i).slice(0, 10).map(f => <Badge key={f} variant="info">{f}</Badge>)}
                      </div>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* CAPTURE */}
            {step === 'capture' && (
              <div className="animate-fade-in">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Capture intelligente</h1>
                <p className="text-[var(--text-secondary)] mb-8">Le robot capture l'app en action sur les bonnes pages.</p>
                <Button variant="primary" icon={capturing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} onClick={handleCapture} disabled={capturing || !deployUrl}>
                  {capturing ? 'Capture en cours…' : 'Lancer la capture'}
                </Button>
                {captures && (
                  <div className="mt-6 space-y-2">
                    <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">{captures.totalCaptures} captures ({captures.captures.filter(c => c.has_content).length} avec contenu)</div>
                    {captures.captures.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                        <CheckCircle2 size={16} className={c.has_content ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'} />
                        <span className="text-sm text-[var(--text-primary)] truncate flex-1">{c.caption}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STORYBOARD */}
            {step === 'storyboard' && analysis && (
              <div className="animate-fade-in">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Scénario narratif</h1>
                <p className="text-[var(--text-secondary)] mb-8">Plan optimisé par l'IA à partir de l'analyse.</p>
                <div className="space-y-3">
                  {analysis.narrative.scenes.map((s, i) => (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center text-xs font-bold text-[var(--accent-text)] flex-shrink-0">{i + 1}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1"><Badge>{['Hook', 'Feature', 'Feature', 'Feature', 'Proof', 'CTA'][i] || 'Extra'}</Badge><span className="text-xs text-[var(--text-tertiary)]">{s.tab ? `Onglet: ${s.tab}` : 'Page'}</span></div>
                        <div className="text-sm text-[var(--text-primary)]">{s.caption}</div>
                        {s.subtitle && <div className="text-xs text-[var(--text-tertiary)] mt-1">{s.subtitle}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                <Card className="p-4 mt-4">
                  <div className="flex items-center gap-2"><Clock size={16} className="text-[var(--accent)]" /><span className="text-sm">Durée totale : <span className="font-bold">~27s</span> (intro + {analysis.narrative.scenes.length} scènes + outro)</span><Badge variant="success">Optimal</Badge></div>
                </Card>
              </div>
            )}

            {/* VOICE */}
            {step === 'voice' && (
              <div className="animate-fade-in">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Voix-off</h1>
                <p className="text-[var(--text-secondary)] mb-8">Narration générée à partir des captions, ou ta propre voix.</p>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <OptionCard active={voiceMode === 'tts'} onClick={() => setVoiceMode('tts')} icon={Wand2} title="Voix IA" desc="Générée auto" badge="Recommandé" />
                  <OptionCard active={voiceMode === 'custom'} onClick={() => setVoiceMode('custom')} icon={Mic} title="Ma voix" desc="Importer audio" />
                  <OptionCard active={voiceMode === 'none'} onClick={() => setVoiceMode('none')} icon={Volume2} title="Sans voix" desc="Musique seule" />
                </div>
                {voiceMode === 'tts' && (
                  <Card className="p-6 space-y-4">
                    <div><label className="text-xs font-bold uppercase text-[var(--text-tertiary)] mb-2 block">Langue</label>
                      <div className="flex gap-2"><OptionPill active={voiceLang === 'fr'} onClick={() => setVoiceLang('fr')}>🇫🇷 Français</OptionPill><OptionPill active={voiceLang === 'en'} onClick={() => setVoiceLang('en')}>🇬🇧 English</OptionPill></div>
                    </div>
                    <div><label className="text-xs font-bold uppercase text-[var(--text-tertiary)] mb-2 block">Voix</label>
                      <div className="flex gap-2"><OptionPill active={voiceGender === 'male'} onClick={() => setVoiceGender('male')}>Homme</OptionPill><OptionPill active={voiceGender === 'female'} onClick={() => setVoiceGender('female')}>Femme</OptionPill></div>
                    </div>
                  </Card>
                )}
                {voiceMode === 'custom' && (
                  <Card className="p-6"><div className="border-2 border-dashed border-[var(--border-subtle)] rounded-xl p-8 text-center"><Mic size={32} className="text-[var(--text-tertiary)] mx-auto mb-3" /><p className="text-sm">Glisse ton fichier audio (MP3, WAV, M4A)</p></div></Card>
                )}
              </div>
            )}

            {/* MUSIC */}
            {step === 'music' && (
              <div className="animate-fade-in">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Musique</h1>
                <p className="text-[var(--text-secondary)] mb-8">Sélection automatique selon le type d'app, ou ta musique.</p>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <OptionCard active={musicMode === 'auto'} onClick={() => setMusicMode('auto')} icon={Wand2} title="Auto" desc="Choisie selon l'app" badge="110-130 BPM" />
                  <OptionCard active={musicMode === 'custom'} onClick={() => setMusicMode('custom')} icon={Music} title="Ma musique" desc="Importer" />
                  <OptionCard active={musicMode === 'none'} onClick={() => setMusicMode('none')} icon={Volume2} title="Sans" desc="Voix seule" />
                </div>
                {musicMode === 'auto' && (
                  <Card className="p-6 space-y-3">
                    {[{ n: 'Driving Electronic', b: 120, m: 95 }, { n: 'Corporate Inspiring', b: 115, m: 82 }, { n: 'Minimal Tech', b: 110, m: 76 }].map((m) => (
                      <div key={m.n} className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)]">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center"><Music size={16} className="text-white" /></div>
                        <div className="flex-1"><div className="text-sm font-medium">{m.n}</div><div className="text-xs text-[var(--text-tertiary)]">{m.b} BPM</div></div>
                        <Badge variant={m.m > 90 ? 'success' : 'default'}>{m.m}% match</Badge>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            )}

            {/* RENDER */}
            {step === 'render' && (
              <div className="animate-fade-in">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Style de rendu</h1>
                <p className="text-[var(--text-secondary)] mb-8">Comment l'app est présentée dans la vidéo.</p>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <OptionCard active={renderStyle === 'screencast'} onClick={() => setRenderStyle('screencast')} icon={Monitor} title="Capture d'écran" desc="ScreenStudio style" badge="Recommandé" />
                  <OptionCard active={renderStyle === 'cinematic'} onClick={() => setRenderStyle('cinematic')} icon={Film} title="Cinématique" desc="3D + particules + glow" badge="Premium" />
                </div>
                <Card className="p-6 mb-4">
                  <label className="text-xs font-bold uppercase text-[var(--text-tertiary)] mb-3 block">Format</label>
                  <div className="flex gap-3">
                    {[{ id: '16:9', d: 'YouTube' }, { id: '9:16', d: 'Reels' }, { id: '1:1', d: 'LinkedIn' }].map(f => (
                      <OptionCard key={f.id} active={format === f.id} onClick={() => setFormat(f.id as any)} title={f.id} desc={f.d} small />
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* QA */}
            {step === 'qa' && (
              <div className="animate-fade-in">
                <h1 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight mb-2">Auto-contrôle qualité</h1>
                <p className="text-[var(--text-secondary)] mb-8">Un juge IA analyse chaque frame et corrige automatiquement.</p>
                <Card className="p-6 mb-4">
                  <div className="flex items-center gap-3 mb-4"><Shield size={20} className="text-[var(--accent)]" /><span className="text-sm font-semibold">Score cible</span></div>
                  <div className="flex items-center gap-4">
                    <input type="range" min="60" max="95" value={qaTarget} onChange={(e) => setQaTarget(Number(e.target.value))} className="flex-1" />
                    <div className="text-2xl font-bold text-[var(--accent)] w-16 text-right">{qaTarget}/100</div>
                  </div>
                  <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1"><span>Standard</span><span>Pro</span><span>Excellence</span></div>
                </Card>
                <Card className="p-6">
                  <h3 className="text-xs font-bold uppercase text-[var(--text-tertiary)] mb-3">Critères vérifiés</h3>
                  <div className="space-y-2">
                    {[{ c: 'Exposition', p: 'P0' }, { c: 'Lisibilité', p: 'P1' }, { c: 'Dynamisme', p: 'P1' }, { c: 'Variété', p: 'P2' }].map(v => (
                      <div key={v.c} className="flex items-center gap-3"><Badge variant={v.p === 'P0' ? 'danger' : v.p === 'P1' ? 'warning' : 'default'}>{v.p}</Badge><span className="text-sm">{v.c}</span></div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* EXPORT */}
            {step === 'export' && (
              <div className="animate-fade-in text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[var(--accent)] to-purple-500 flex items-center justify-center mx-auto mb-6 shadow-lg">
                  {pipelineRunning ? <Loader2 size={36} className="text-white animate-spin" /> : finalVideo ? <Download size={36} className="text-white" /> : <Play size={36} className="text-white" />}
                </div>
                <h1 className="text-2xl font-bold mb-2">{pipelineRunning ? 'Génération…' : finalVideo ? 'Vidéo prête !' : 'Lancer le pipeline'}</h1>
                <p className="text-[var(--text-secondary)] mb-8">
                  {pipelineRunning && pipelineJob ? `${stepLabels[pipelineJob.currentStep] || pipelineJob.currentStep}… (${pipelineJob.progress}%)` : 'Analyse → capture → rendu → QA → export'}
                </p>

                {/* Progress bar */}
                {pipelineRunning && pipelineJob && (
                  <Card className="p-6 max-w-md mx-auto mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      {pipelineJob.status === 'error' ? <XCircle size={18} className="text-[var(--danger)]" /> : <Loader2 size={18} className="text-[var(--accent)] animate-spin" />}
                      <span className="text-sm font-medium">{stepLabels[pipelineJob.currentStep] || pipelineJob.currentStep}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--bg-base)] overflow-hidden mb-2">
                      <div className="h-full rounded-full bg-[var(--accent)] transition-all" style={{ width: `${pipelineJob.progress}%` }} />
                    </div>
                    <div className="text-xs text-[var(--text-tertiary)]">{pipelineJob.progress}%</div>
                  </Card>
                )}

                {/* Result */}
                {finalVideo && (
                  <Card className="p-6 max-w-md mx-auto mb-6">
                    {qaResult && (
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div><div className="text-xs text-[var(--text-tertiary)] mb-1">Score QA</div><div className="text-sm font-bold text-[var(--success)]">{qaResult.globalScore}/100</div></div>
                        <div><div className="text-xs text-[var(--text-tertiary)] mb-1">Statut</div><div className="text-sm font-bold text-[var(--success)]">{qaResult.verdict}</div></div>
                        <div><div className="text-xs text-[var(--text-tertiary)] mb-1">Format</div><div className="text-sm font-bold">{format}</div></div>
                      </div>
                    )}
                    <a href={downloadUrl(finalVideo)} download>
                      <Button variant="primary" icon={<Download size={16} />} className="w-full">Télécharger MP4</Button>
                    </a>
                  </Card>
                )}

                {/* Launch button */}
                {!pipelineRunning && !finalVideo && (
                  <Button variant="primary" icon={<Zap size={18} />} onClick={handlePipeline} className="max-w-xs mx-auto">
                    Générer la vidéo
                  </Button>
                )}
                {finalVideo && (
                  <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={handlePipeline} className="max-w-xs mx-auto">
                    Re-générer
                  </Button>
                )}
                {pipelineJob?.status === 'error' && (
                  <p className="text-sm text-[var(--danger)] mt-4">{pipelineJob.error}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] px-8 py-3 flex items-center justify-between">
          <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={goPrev} disabled={stepIndex === 0}>Précédent</Button>
          <span className="text-xs text-[var(--text-tertiary)]">Étape {stepIndex + 1} / {STEPS.length}</span>
          {stepIndex < STEPS.length - 1 ? (
            <Button variant="primary" icon={<ArrowRight size={16} />} onClick={goNext}>Suivant</Button>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

// ── UI Helpers ──
function OptionCard({ active, onClick, icon: Icon, title, desc, badge, small }: any) {
  return (
    <button onClick={onClick} className={`relative p-4 rounded-xl border text-left transition-all ${active ? 'border-[var(--accent)] bg-[var(--accent-subtle)]' : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--text-tertiary)]'} ${small ? 'flex-1 text-center' : ''}`}>
      {badge && <Badge variant="info" className="absolute top-2 right-2 text-[9px]">{badge}</Badge>}
      {Icon && !small && <Icon size={20} className="text-[var(--accent)] mb-2" />}
      <div className={`text-sm font-semibold ${small ? 'text-center' : ''}`}>{title}</div>
      <div className={`text-xs text-[var(--text-tertiary)] ${small ? 'text-center' : ''}`}>{desc}</div>
    </button>
  );
}

function OptionPill({ active, onClick, children }: any) {
  return <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-base)] border border-[var(--border-subtle)] hover:border-[var(--text-tertiary)]'}`}>{children}</button>;
}
