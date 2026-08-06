/**
 * StudioShell V2 — Mobile-first responsive layout
 * Desktop: sidebar + canvas + timeline
 * Mobile: tabs bottom nav + full-width panels
 */

import React from 'react';
import { PreviewCanvas } from './PreviewCanvas';
import { useStudioStore } from '../../store/studio-v2';
import { STAGE_META } from '../../lib/pipeline-v2';
import { StoryboardTimeline } from './StoryboardTimeline';
import { ProjectsScreen } from './ProjectsScreen';

type MobileTab = 'projects' | 'preview' | 'config' | 'timeline';

export const StudioShell: React.FC = () => {
  const pipeline = useStudioStore(s => s.pipeline);
  const runPipeline = useStudioStore(s => s.runPipeline);
  const abortPipeline = useStudioStore(s => s.abortPipeline);
  const [mobileTab, setMobileTab] = React.useState<MobileTab>('projects');

  const isRunning = !['idle', 'done', 'error'].includes(pipeline.stage);
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileLayout tab={mobileTab} setTab={setMobileTab} />;
  }

  return <DesktopLayout />;
};

// ─── Mobile detection hook ────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  React.useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

const MobileLayout: React.FC<{ tab: MobileTab; setTab: (t: MobileTab) => void }> = ({ tab, setTab }) => {
  const pipeline = useStudioStore(s => s.pipeline);
  const runPipeline = useStudioStore(s => s.runPipeline);
  const abortPipeline = useStudioStore(s => s.abortPipeline);
  const isRunning = !['idle', 'done', 'error'].includes(pipeline.stage);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#06070b',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>
      {/* ── HEADER ── */}
      <div style={{
        flexShrink: 0,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#0a0b10',
        borderBottom: '1px solid #1e293b',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>🎬</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Promo Studio</div>
            <MobilePipelineMini />
          </div>
        </div>

        {/* Generate / Abort button */}
        {isRunning ? (
          <button onClick={abortPipeline} style={{
            ...mobileBtn, background: '#1e293b', color: '#ef4444',
            border: '1px solid #ef444433',
          }}>⏹</button>
        ) : (
          <button onClick={runPipeline} style={{
            ...mobileBtn,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            color: '#fff', border: 'none',
            boxShadow: '0 2px 12px rgba(59,130,246,0.3)',
          }}>⚡ Générer</button>
        )}
      </div>

      {/* ── CONTENT ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'projects' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <ProjectsScreen />
          </div>
        )}
        {tab === 'preview' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 8 }}>
            <PreviewCanvas />
          </div>
        )}
        {tab === 'config' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <ConfigPanel />
          </div>
        )}
        {tab === 'timeline' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <StoryboardTimeline />
          </div>
        )}
      </div>

      {/* ── BOTTOM TABS ── */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        background: '#0a0b10',
        borderTop: '1px solid #1e293b',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {([
          { id: 'projects', icon: '📁', label: 'Projets' },
          { id: 'preview', icon: '▶', label: 'Aperçu' },
          { id: 'config', icon: '⚙', label: 'Réglages' },
          { id: 'timeline', icon: '📋', label: 'Scènes' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '10px 4px 8px',
              background: 'transparent',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              color: tab === t.id ? '#3b82f6' : '#475569',
              fontSize: 18,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <span>{t.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const MobilePipelineMini: React.FC = () => {
  const pipeline = useStudioStore(s => s.pipeline);
  if (pipeline.stage === 'idle' || pipeline.stage === 'done') return null;
  const meta = STAGE_META[pipeline.stage];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 9, color: meta.color }}>{meta.icon} {meta.label}</span>
      {pipeline.progress > 0 && (
        <span style={{ fontSize: 9, color: '#475569' }}>{Math.round(pipeline.progress)}%</span>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DESKTOP LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

const DesktopLayout: React.FC = () => {
  const pipeline = useStudioStore(s => s.pipeline);
  const runPipeline = useStudioStore(s => s.runPipeline);
  const abortPipeline = useStudioStore(s => s.abortPipeline);
  const isRunning = !['idle', 'done', 'error'].includes(pipeline.stage);

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#06070b',
      color: '#e2e8f0',
      fontFamily: 'Inter, system-ui, sans-serif',
      overflow: 'hidden',
    }}>
      {/* Sidebar */}
      <div style={{
        width: 260,
        flexShrink: 0,
        background: '#0a0b10',
        borderRight: '1px solid #1e293b',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15,
          }}>🎬</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Promo Studio</div>
            <div style={{ fontSize: 9, color: '#64748b' }}>V2 — Motion Design</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          <ConfigPanel />
        </div>

        {/* Pipeline status */}
        <div style={{
          padding: 12,
          borderTop: '1px solid #1e293b',
        }}>
          {pipeline.stage !== 'idle' && pipeline.stage !== 'done' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: STAGE_META[pipeline.stage].color, fontWeight: 600 }}>
                {STAGE_META[pipeline.stage].icon} {STAGE_META[pipeline.stage].label}
              </div>
              <div style={{ width: '100%', height: 3, background: '#1e293b', borderRadius: 2, marginTop: 4 }}>
                <div style={{
                  width: `${pipeline.progress}%`, height: '100%',
                  background: STAGE_META[pipeline.stage].color, borderRadius: 2,
                  transition: 'width 0.3s',
                }} />
              </div>
            </div>
          )}
          {isRunning ? (
            <button onClick={abortPipeline} style={{
              ...desktopBtn, background: '#1e293b', color: '#ef4444',
              border: '1px solid #ef444433', width: '100%',
            }}>⏹ Annuler</button>
          ) : (
            <button onClick={runPipeline} style={{
              ...desktopBtn,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: '#fff', border: 'none', width: '100%',
              boxShadow: '0 4px 20px rgba(59,130,246,0.3)',
            }}>⚡ Générer la vidéo</button>
          )}
        </div>
      </div>

      {/* Main */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', padding: 12, gap: 10,
      }}>
        <PreviewCanvas />
        <StoryboardTimeline />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED CONFIG PANEL
// ═══════════════════════════════════════════════════════════════════════════════

const ConfigPanel: React.FC = () => {
  const config = useStudioStore(s => s.config);
  const storyboard = useStudioStore(s => s.storyboard);
  const setCaptureUrl = useStudioStore(s => s.setCaptureUrl);
  const setCredentials = useStudioStore(s => s.setCredentials);
  const setRenderMode = useStudioStore(s => s.setRenderMode);
  const setFormat = useStudioStore(s => s.setFormat);
  const setAppName = useStudioStore(s => s.setAppName);
  const setVoice = useStudioStore(s => s.setVoice);
  const updateStyle = useStudioStore(s => s.updateStyle);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Source */}
      <Section title="Source">
        <TextInput placeholder="URL de l'app" value={config.capture.url} onChange={setCaptureUrl} />
        <div style={{ display: 'flex', gap: 6 }}>
          <TextInput placeholder="email" value={config.capture.credentials?.email || ''} onChange={() => {}} small />
          <TextInput placeholder="pass" value={config.capture.credentials?.password || ''} onChange={() => {}} small type="password" />
        </div>
      </Section>

      {/* App info */}
      <Section title="Application">
        <TextInput placeholder="Nom" value={storyboard.appName} onChange={setAppName} />
        <TextInput placeholder="Slogan" value={storyboard.pitch || ''} onChange={v => useStudioStore.getState().setPitch(v)} />
      </Section>

      {/* Render mode */}
      <Section title="Mode de rendu">
        <Segmented
          options={[{ value: 'cinematic', label: '🎬 Ciné' }, { value: 'screencast', label: '💻 Screen' }]}
          value={config.render.mode}
          onChange={v => setRenderMode(v as any)}
        />
      </Section>

      {/* Format */}
      <Section title="Format">
        <Segmented
          options={[{ value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }, { value: '1:1', label: '1:1' }]}
          value={config.render.format}
          onChange={v => setFormat(v as any)}
        />
      </Section>

      {/* Colors */}
      <Section title="Couleurs">
        <ColorRow label="Fond" value={storyboard.style.bgColor} onChange={v => updateStyle({ bgColor: v })} />
        <ColorRow label="Accent" value={storyboard.style.accentColor} onChange={v => updateStyle({ accentColor: v })} />
      </Section>

      {/* Voice */}
      <Section title="Voix off">
        <Segmented
          options={[{ value: 'henri', label: '🎤 H' }, { value: 'denise', label: '🎤 D' }, { value: 'none', label: '🔇 Off' }]}
          value={config.voice.option}
          onChange={v => setVoice(v as any)}
        />
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 4 }}>
            <span>Vitesse</span>
            <span>{config.voice.rate > 0 ? `+${Math.round(config.voice.rate * 100)}%` : `${Math.round(config.voice.rate * 100)}%`}</span>
          </div>
          <input type="range" min={-0.3} max={0.3} step={0.02} value={config.voice.rate}
            onChange={e => useStudioStore.getState().setVoice(config.voice.option, undefined, parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6' }} />
        </div>
      </Section>
    </div>
  );
};

// ─── Shared UI primitives ─────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: 8 }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
  </div>
);

const TextInput: React.FC<{ placeholder: string; value: string; onChange: (v: string) => void; small?: boolean; type?: string }> = ({ placeholder, value, onChange, small, type }) => (
  <input
    type={type || 'text'}
    placeholder={placeholder}
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{
      width: '100%',
      padding: small ? '5px 8px' : '8px 10px',
      background: '#0f1117',
      border: '1px solid #1e293b',
      borderRadius: 6,
      color: '#e2e8f0',
      fontSize: small ? 11 : 12,
      fontFamily: 'inherit',
      outline: 'none',
      WebkitAppearance: 'none',
    }}
  />
);

const Segmented: React.FC<{ options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }> = ({ options, value, onChange }) => (
  <div style={{ display: 'flex', gap: 3, background: '#0f1117', borderRadius: 8, padding: 3 }}>
    {options.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        style={{
          flex: 1,
          padding: '6px 4px',
          background: value === opt.value ? '#1e293b' : 'transparent',
          border: 'none',
          borderRadius: 6,
          color: value === opt.value ? '#3b82f6' : '#64748b',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.15s',
        }}
      >{opt.label}</button>
    ))}
  </div>
);

const ColorRow: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <input type="color" value={value} onChange={e => onChange(e.target.value)}
      style={{ width: 32, height: 28, border: 'none', borderRadius: 6, background: 'none', cursor: 'pointer' }} />
    <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{label}</span>
    <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>{value}</span>
  </div>
);

const mobileBtn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  WebkitTapHighlightColor: 'transparent',
};

const desktopBtn: React.CSSProperties = {
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
