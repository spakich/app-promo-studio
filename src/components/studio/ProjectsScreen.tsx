/**
 * ProjectsScreen — Project picker (mobile-first)
 * Lists known projects + public GitHub repos + manual URL
 * Selecting a project fills the studio config
 */

import React from 'react';
import { useStudioStore } from '../../store/studio-v2';
import { KNOWN_PROJECTS, fetchPublicRepos, projectFromUrl, type Project } from '../../lib/projects';

export const ProjectsScreen: React.FC = () => {
  const setCaptureUrl = useStudioStore(s => s.setCaptureUrl);
  const setAppName = useStudioStore(s => s.setAppName);
  const updateStyle = useStudioStore(s => s.updateStyle);
  const config = useStudioStore(s => s.config);
  const selectedUrl = config.capture.url;

  const [githubRepos, setGithubRepos] = React.useState<Project[]>([]);
  const [manualUrl, setManualUrl] = React.useState('');
  const [loadingGh, setLoadingGh] = React.useState(false);

  // Load public repos once
  React.useEffect(() => {
    setLoadingGh(true);
    fetchPublicRepos('spakich').then(repos => {
      // Filter out repos already in KNOWN_PROJECTS
      const known = new Set(KNOWN_PROJECTS.map(p => p.id));
      setGithubRepos(repos.filter(r => !known.has(r.id)));
      setLoadingGh(false);
    });
  }, []);

  const selectProject = (p: Project) => {
    if (p.appUrl) setCaptureUrl(p.appUrl);
    setAppName(p.name);
    if (p.accentColor) updateStyle({ accentColor: p.accentColor });
    if (p.pitch) useStudioStore.getState().setPitch(p.pitch);
  };

  const isSelected = (p: Project) => Boolean(p.appUrl && selectedUrl === p.appUrl);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>Choisir un projet</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
          Sélectionne l'application à mettre en vidéo
        </div>
      </div>

      {/* Manual URL input */}
      <div style={{
        background: '#0a0b10',
        border: '1px solid #1e293b',
        borderRadius: 12,
        padding: 12,
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: 8 }}>
          URL personnalisée
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            placeholder="https://mon-app.vercel.app ou github.com/…"
            value={manualUrl}
            onChange={e => setManualUrl(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              background: '#0f1117',
              border: '1px solid #1e293b',
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              WebkitAppearance: 'none',
            }}
          />
          <button
            onClick={() => {
              const p = projectFromUrl(manualUrl);
              if (p) { selectProject(p); setManualUrl(''); }
            }}
            style={{
              padding: '10px 16px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
            }}
          >OK</button>
        </div>
      </div>

      {/* My projects */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: 10 }}>
          Mes projets
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {KNOWN_PROJECTS.map(p => (
            <ProjectCard key={p.id} project={p} selected={isSelected(p)} onSelect={() => selectProject(p)} />
          ))}
        </div>
      </div>

      {/* GitHub public repos */}
      {(loadingGh || githubRepos.length > 0) && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: 10 }}>
            GitHub public
          </div>
          {loadingGh ? (
            <div style={{ fontSize: 12, color: '#475569', padding: 12, textAlign: 'center' }}>Chargement…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {githubRepos.map(p => (
                <ProjectCard key={p.id} project={p} selected={isSelected(p)} onSelect={() => selectProject(p)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selected summary */}
      {selectedUrl && (
        <div style={{
          background: '#0a0b10',
          border: '1px solid #3b82f633',
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6' }}>Projet sélectionné</div>
            <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedUrl}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Project card ─────────────────────────────────────────────────────────────

const ProjectCard: React.FC<{ project: Project; selected: boolean; onSelect: () => void }> = ({ project: p, selected, onSelect }) => (
  <button
    onClick={onSelect}
    style={{
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 14,
      background: selected ? '#0f172a' : '#0a0b10',
      border: `1.5px solid ${selected ? p.accentColor : '#1e293b'}`,
      borderRadius: 12,
      cursor: 'pointer',
      fontFamily: 'inherit',
      textAlign: 'left',
      transition: 'border-color 0.15s',
      WebkitTapHighlightColor: 'transparent',
    }}
  >
    {/* Color dot */}
    <div style={{
      width: 40, height: 40,
      borderRadius: 10,
      background: `linear-gradient(135deg, ${p.accentColor}, ${p.accentColor}88)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
      flexShrink: 0,
      boxShadow: selected ? `0 4px 16px ${p.accentColor}44` : 'none',
    }}>
      {p.private ? '🔒' : '🌐'}
    </div>

    {/* Info */}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{p.name}</div>
      {p.description && (
        <div style={{
          fontSize: 11,
          color: '#64748b',
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{p.description}</div>
      )}
      {p.appUrl && (
        <div style={{
          fontSize: 10,
          color: '#475569',
          marginTop: 3,
          fontFamily: 'monospace',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{p.appUrl.replace('https://', '')}</div>
      )}
    </div>

    {/* Selected check */}
    {selected && (
      <span style={{ fontSize: 16, color: p.accentColor, flexShrink: 0 }}>✓</span>
    )}
  </button>
);
