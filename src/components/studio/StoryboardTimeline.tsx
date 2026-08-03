/**
 * StoryboardTimeline — Visual timeline of scenes (CapCut/Premiere style)
 * Drag-drop reorder, click to edit, add/remove scenes
 */

import React from 'react';
import { useStudioStore } from '../../store/studio-v2';

export const StoryboardTimeline: React.FC = () => {
  const storyboard = useStudioStore(s => s.storyboard);
  const currentSceneIndex = useStudioStore(s => s.currentSceneIndex);
  const setCurrentScene = useStudioStore(s => s.setCurrentScene);
  const removeScene = useStudioStore(s => s.removeScene);
  const updateScene = useStudioStore(s => s.updateScene);
  const reorderScenes = useStudioStore(s => s.reorderScenes);
  const addScene = useStudioStore(s => s.addScene);

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  if (storyboard.scenes.length === 0) {
    return (
      <div style={{
        height: 100,
        background: '#0a0b10',
        border: '2px dashed #1e293b',
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        color: '#475569',
      }}>
        <span style={{ fontSize: 13 }}>Timeline vide</span>
        <button
          onClick={() => addScene({
            src: 'captures/placeholder.png',
            caption: 'Nouvelle scène',
            subtitle: '',
            durationSeconds: 5,
            zoomPreset: 'center',
            transitionOut: 'blurDissolve',
          })}
          style={{
            padding: '4px 12px',
            background: '#1e293b',
            border: 'none',
            borderRadius: 6,
            color: '#3b82f6',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >+ Ajouter une scène</button>
      </div>
    );
  }

  return (
    <div style={{
      background: '#0a0b10',
      borderRadius: 10,
      padding: 10,
      display: 'flex',
      gap: 8,
      overflowX: 'auto',
      alignItems: 'center',
      minHeight: 90,
    }}>
      {storyboard.scenes.map((scene, i) => (
        <React.Fragment key={i}>
          {/* Scene card */}
          <div
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== i) reorderScenes(dragIndex, i);
              setDragIndex(null);
            }}
            onClick={() => setCurrentScene(i)}
            style={{
              flexShrink: 0,
              width: 120,
              borderRadius: 8,
              overflow: 'hidden',
              cursor: 'pointer',
              border: currentSceneIndex === i ? '2px solid #3b82f6' : '2px solid transparent',
              background: '#0f1117',
              transition: 'border-color 0.15s',
              position: 'relative',
            }}
          >
            {/* Thumbnail */}
            <div style={{
              height: 48,
              background: `linear-gradient(135deg, #1e293b, #0f1117)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}>
              {scene.src ? '🖼️' : '🎬'}
            </div>
            {/* Info */}
            <div style={{ padding: '4px 6px' }}>
              <div style={{
                fontSize: 9,
                fontWeight: 600,
                color: currentSceneIndex === i ? '#3b82f6' : '#64748b',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {scene.caption || `Scène ${i + 1}`}
              </div>
              <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>
                {scene.durationSeconds.toFixed(1)}s
              </div>
            </div>
            {/* Remove button */}
            <button
              onClick={e => { e.stopPropagation(); removeScene(i); }}
              style={{
                position: 'absolute',
                top: 4, right: 4,
                width: 16, height: 16,
                borderRadius: '50%',
                background: '#1e293bee',
                border: 'none',
                color: '#ef4444',
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >×</button>
          </div>

          {/* Connector */}
          {i < storyboard.scenes.length - 1 && (
            <div style={{ color: '#1e293b', fontSize: 12 }}>→</div>
          )}
        </React.Fragment>
      ))}

      {/* Add button */}
      <button
        onClick={() => addScene({
          src: '',
          caption: 'Nouvelle scène',
          subtitle: '',
          durationSeconds: 5,
          zoomPreset: 'center',
          transitionOut: 'blurDissolve',
        })}
        style={{
          flexShrink: 0,
          width: 48, height: 68,
          borderRadius: 8,
          background: '#0f1117',
          border: '2px dashed #1e293b',
          color: '#475569',
          fontSize: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >+</button>
    </div>
  );
};
