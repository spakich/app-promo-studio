import { useState, useRef, useEffect } from 'react';
import { Mic, Play, Pause, Download, Loader2, Volume2, Type, RefreshCw, Check } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const VOICES = {
  fr: {
    male: { id: 'fr-FR-HenriNeural', name: 'Henri', desc: 'Profond, professionnel' },
    female: { id: 'fr-FR-DeniseNeural', name: 'Denise', desc: 'Claire, chaleleureuse' },
  },
  en: {
    male: { id: 'en-US-GuyNeural', name: 'Guy', desc: 'Authoritative, deep' },
    female: { id: 'en-US-JennyNeural', name: 'Jenny', desc: 'Friendly, clear' },
  },
};

interface VoiceEditorProps {
  initialScript?: string;
  onVoiceGenerated?: (audioPath: string) => void;
}

export function VoiceEditor({ initialScript = '', onVoiceGenerated }: VoiceEditorProps) {
  const [script, setScript] = useState(initialScript);
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [rate, setRate] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const wordCount = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estDuration = Math.round((wordCount / 150) * 60); // 150 words/min
  const charCount = script.length;

  // Load script from storyboard captions
  useEffect(() => {
    if (!initialScript) {
      // Try to load from localStorage
      const saved = localStorage.getItem('voiceover_script');
      if (saved) setScript(saved);
    }
  }, []);

  // Auto-save
  useEffect(() => {
    localStorage.setItem('voiceover_script', script);
  }, [script]);

  const handleGenerate = async () => {
    if (!script.trim()) return;
    setGenerating(true);
    setAudioUrl('');

    try {
      const voiceId = VOICES[lang][gender].id;
      const rateStr = rate >= 0 ? `+${rate}%` : `${rate}%`;

      const resp = await fetch(`${API_BASE}/api/voice/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voice: voiceId, rate: rateStr }),
      });
      const data = await resp.json();

      if (data.success && data.audioPath) {
        setAudioUrl(`${API_BASE}/api/download?path=${encodeURIComponent(data.audioPath)}`);
        onVoiceGenerated?.(data.audioPath);
      }
    } catch (e) {
      console.error('Voice generation failed:', e);
    }
    setGenerating(false);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const voice = VOICES[lang][gender];

  return (
    <div className="space-y-4">
      {/* ── Text Editor ── */}
      <Card className="p-0 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            <Type size={16} className="text-[var(--accent)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">Script voix-off</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
            <span>{wordCount} mots</span>
            <span>·</span>
            <span>{charCount} caractères</span>
            <span>·</span>
            <Badge variant="info">~{estDuration}s</Badge>
          </div>
        </div>

        {/* Editor */}
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Écris ton script ici…

Exemple :
« RAGFlow est le moteur RAG open-source qui transforme vos documents en intelligence. Avec plus de 86 000 étoiles GitHub, il offre un découpage intelligent, des citations vérifiables, et des agents IA personnalisables. »

💡 Astuce : parle à un rythme naturel. 150 mots = ~1 minute."
          className="w-full h-64 p-4 bg-[var(--bg-base)] text-sm text-[var(--text-primary)] outline-none resize-none font-mono leading-relaxed placeholder:text-[var(--text-tertiary)]"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2">
            {/* Language */}
            <div className="flex gap-1">
              <button
                onClick={() => setLang('fr')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${lang === 'fr' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-base)] text-[var(--text-tertiary)]'}`}
              >🇫🇷 FR</button>
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${lang === 'en' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-base)] text-[var(--text-tertiary)]'}`}
              >🇬🇧 EN</button>
            </div>

            {/* Gender */}
            <div className="w-px h-5 bg-[var(--border-subtle)]" />
            <div className="flex gap-1">
              <button
                onClick={() => setGender('male')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${gender === 'male' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-base)] text-[var(--text-tertiary)]'}`}
              >Homme</button>
              <button
                onClick={() => setGender('female')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium ${gender === 'female' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-base)] text-[var(--text-tertiary)]'}`}
              >Femme</button>
            </div>

            {/* Speed */}
            <div className="w-px h-5 bg-[var(--border-subtle)]" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-tertiary)]">Vitesse</span>
              <input type="range" min="-20" max="20" value={rate} onChange={(e) => setRate(Number(e.target.value))}
                className="w-20 h-1" />
              <span className="text-xs text-[var(--text-tertiary)] w-8">{rate > 0 ? '+' : ''}{rate}%</span>
            </div>
          </div>

          {/* Generate */}
          <Button
            variant="primary"
            icon={generating ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
            onClick={handleGenerate}
            disabled={generating || !script.trim()}
          >
            {generating ? 'Génération…' : 'Générer la voix'}
          </Button>
        </div>
      </Card>

      {/* ── Audio Player ── */}
      {audioUrl && (
        <Card className="p-4 animate-fade-in">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-white hover:opacity-90 transition-opacity flex-shrink-0"
            >
              {playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>

            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Voix : {voice.name} ({voice.desc})
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-[var(--bg-base)] overflow-hidden">
                <div
                  className="h-full bg-[var(--accent)] transition-all"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            </div>

            <a href={audioUrl} download className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
              <Download size={18} />
            </a>
          </div>

          <audio
            ref={audioRef}
            src={audioUrl}
            onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onEnded={() => setPlaying(false)}
          />
        </Card>
      )}

      {/* ── Tips ── */}
      {!audioUrl && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--accent-subtle)] border border-[var(--accent)]/20">
          <Volume2 size={18} className="text-[var(--accent)] flex-shrink-0 mt-0.5" />
          <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <strong className="text-[var(--text-primary)]">Édite ton script et génère la voix.</strong> Écris comme tu parles.
            Évite les phrases trop longues. Une bonne vidéo promo fait 60-90 mots (~25-35 secondes).
            Tu peux ajuster la vitesse de lecture avec le curseur.
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
