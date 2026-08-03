/**
 * StudioShell V2 — App shell moderne pour App Promo Studio
 * Layout: sidebar + main canvas + right panel
 */

import React from 'react';
import { PreviewCanvas } from './PreviewCanvas';
import { useStudioStore } from '../../store/studio-v2';
import { STAGE_META } from '../../lib/pipeline-v2';
import { StoryboardTimeline } from './StoryboardTimeline';

export const StudioShell: React.FC = () => {
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
      {/* ── SIDEBAR ── */}
      <StudioSidebar />

      {/* ── MAIN ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Top bar */}
        <div style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '1px solid #1e293b',
          background: '#0a0b10',
          flexShrink: 0,
        }}>
          <PipelineProgress />
          <div style={{ display: 'flex', gap: 10 }}>
            {isRunning ? (
              <button
                onClick={abortPipeline}
                style={{
                  ...btnStyle,
                  background: '#1e293b',
                  color: '#ef4444',
                  border: '1px solid #ef444433',
                }}
              >⏹ Annuler</button>
            ) : (
              <button
                onClick={runPipeline}
                style={{
                  ...btnStyle,
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  color: '#fff',
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(59,130,246,0.3)',
                }}
              >⚡ Générer la vidéo</button>
            )}
          </div>
        </div>

        {/* Canvas + Timeline */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 16,
          gap: 12,
        }}>
          <PreviewCanvas />
          <StoryboardTimeline />
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const StudioSidebar: React.FC = () => {
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
    <div style={{
      width: 280,
      flexShrink: 0,
      background: '#0a0b10',
      borderRight: '1px solid #1e293b',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 32, height: 32,
          borderRadius: 8,
          background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 800,
          color: '#fff',
        }}>🎬</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>Promo Studio</div>
          <div style={{ fontSize: 10, color: '#64748b' }}>V2 — Motion Design</div>
        </div>
      </div>

      {/* Config panels */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        {/* Source */}
        <Section title="Source">
          <Input
            placeholder="URL de l'application"
            value={config.capture.url}
            onChange={v => setCaptureUrl(v)}
          />
          {config.capture.credentials && (
            <div style={{ display: 'flex', gap: 6 }}>
              <Input placeholder="email" value={config.capture.credentials.email} onChange={v => {}} small />
              <Input placeholder="pass" value={config.capture.credentials.password} onChange={v => {}} small type="password" />
            </div>
          )}
        </Section>

        {/* App info */}
        <Section title="Application">
          <Input
            placeholder="Nom de l'app"
            value={storyboard.appName}
            onChange={v => setAppName(v)}
          />
          <Input
            placeholder="Slogan"
            value={storyboard.pitch || ''}
            onChange={v => useStudioStore.getState().setPitch(v)}
          />
        </Section>

        {/* Render mode */}
        <Section title="Mode de rendu">
          <SegmentedControl
            options={[
              { value: 'cinematic', label: '🎬 Cinématique' },
              { value: 'screencast', label: '💻 Screencast' },
            ]}
            value={config.render.mode}
            onChange={v => setRenderMode(v as any)}
          />
        </Section>

        {/* Format */}
        <Section title="Format">
          <SegmentedControl
            options={[
              { value: '16:9', label: '16:9' },
              { value: '9:16', label: '9:16' },
              { value: '1:1', label: '1:1' },
            ]}
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
          <SegmentedControl
            options={[
              { value: 'henri', label: '🎤 Henri' },
              { value: 'denise', label: '🎤 Denise' },
              { value: 'none', label: '🔇 Sans' },
            ]}
            value={config.voice.option}
            onChange={v => setVoice(v as any)}
          />
          <RangeSlider
            label="Vitesse"
            min={-0.3} max={0.3} step={0.02}
            value={config.voice.rate}
            onChange={v => useStudioStore.getState().setVoice(config.voice.option, undefined, v)}
          />
        </Section>
      </div>
    </div>
  );
};

// ─── Pipeline Progress ─────────────────────────────────────────────────────────

const PipelineProgress: React.FC = () => {
  const pipeline = useStudioStore(s => s.pipeline);
  const meta = STAGE_META[pipeline.stage];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 16 }}>{meta.icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{meta.label}</div>
        {pipeline.progress > 0 && (
          <div style={{
            width: 200, height: 3,
            background: '#1e293b',
            borderRadius: 2,
            marginTop: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${pipeline.progress}%`,
              height: '100%',
              background: meta.color,
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
        )}
      </div>
      {pipeline.message && (
        <span style={{ fontSize: 11, color: '#64748b' }}>{pipeline.message}</span>
      )}
    </div>
  );
};

// ─── UI Primitives ────────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: 8 }}>{title}</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
  </div>
);

const Input: React.FC<{ placeholder: string; value: string; onChange: (v: string) => void; small?: boolean; type?: string }> = ({ placeholder, value, onChange, small, type }) => (
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
    }}
  />
);

const SegmentedControl: React.FC<{ options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }> = ({ options, value, onChange }) => (
  <div style={{ display: 'flex', gap: 3, background: '#0f1117', borderRadius: 8, padding: 3 }}>
    {options.map(opt => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        style={{
          flex: 1,
          padding: '6px 8px',
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
    <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: 32, height: 28, border: 'none', borderRadius: 6, background: 'none', cursor: 'pointer' }} />
    <span style={{ fontSize: 11, color: '#94a3b8', flex: 1 }}>{label}</span>
    <span style={{ fontSize: 10, color: '#475569', fontFamily: 'monospace' }}>{value}</span>
  </div>
);

const RangeSlider: React.FC<{ label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }> = ({ label, min, max, step, value, onChange }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 4 }}>
      <span>{label}</span>
      <span>{value > 0 ? `+${Math.round(value * 100)}%` : `${Math.round(value * 100)}%`}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6' }} />
  </div>
);

const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Inter, system-ui, sans-serif',
};
