/**
 * PreviewCanvas — Real-time Remotion Player embedded in the UI
 * Shows the storyboard playing live. User edits text → sees result instantly.
 */

import { Player } from '@remotion/player';
import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { AnimatedScene } from '../../../remotion/components/AnimatedScene';
import { ScreencastScene, type SceneData, type SceneStyle } from '../../../remotion/components/ScreencastScene';
import { IntroScene, OutroScene } from '../../../remotion/components/IntroScene';
import { useStudioStore } from '../../store/studio-v2';
import { FORMAT_DIMENSIONS } from '../../lib/pipeline-v2';

const INTRO_FRAMES = 75; // 2.5s @ 30fps
const OUTRO_FRAMES = 105; // 3.5s @ 30fps
const FPS = 30;

// ─── Composition that plays inside the Remotion Player ────────────────────────

const PreviewComposition: React.FC<{
  scenes: SceneData[];
  style: SceneStyle;
  mode: 'cinematic' | 'screencast';
  appName: string;
  pitch?: string;
  ctaText?: string;
}> = ({ scenes, style, mode, appName, pitch, ctaText }) => {
  let currentFrame = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: style.bgColor }}>
      {/* Intro */}
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <IntroScene
          appName={appName}
          pitch={pitch}
          style={{ bgColor: style.bgColor, accentColor: style.accentColor, fontFamily: style.fontFamily }}
        />
      </Sequence>

      {/* Scenes */}
      {scenes.map((scene, i) => {
        const dur = Math.round(scene.durationSeconds * FPS);
        const start = INTRO_FRAMES + currentFrame;
        currentFrame += dur;

        const SceneComponent = mode === 'cinematic' ? AnimatedScene : ScreencastScene;

        return (
          <Sequence key={i} from={start} durationInFrames={dur}>
            <SceneComponent
              scene={scene}
              sceneIndex={i}
              totalScenes={scenes.length}
              startFrame={0}
              style={style}
              isLast={i === scenes.length - 1}
            />
          </Sequence>
        );
      })}

      {/* Outro */}
      <Sequence from={INTRO_FRAMES + currentFrame} durationInFrames={OUTRO_FRAMES}>
        <OutroScene
          appName={appName}
          pitch={pitch}
          ctaText={ctaText}
          style={{ bgColor: style.bgColor, accentColor: style.accentColor, fontFamily: style.fontFamily }}
        />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Preview Canvas ───────────────────────────────────────────────────────────

export const PreviewCanvas: React.FC = () => {
  const storyboard = useStudioStore(s => s.storyboard);
  const config = useStudioStore(s => s.config);
  const isPlaying = useStudioStore(s => s.isPlaying);
  const setPlaying = useStudioStore(s => s.setPlaying);
  const dims = FORMAT_DIMENSIONS[config.render.format];

  const totalFrames = useMemo(() => {
    const scenesDur = storyboard.scenes.reduce((sum, s) => sum + Math.round(s.durationSeconds * FPS), 0);
    return INTRO_FRAMES + scenesDur + OUTRO_FRAMES;
  }, [storyboard.scenes]);

  const durationInSeconds = totalFrames / FPS;

  if (storyboard.scenes.length === 0) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: '#0a0a0f',
        borderRadius: 12,
        minHeight: 400,
        color: '#64748b',
      }}>
        <div style={{ fontSize: 48, opacity: 0.3 }}>🎬</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>Aucune scène dans le storyboard</div>
        <div style={{ fontSize: 13, opacity: 0.6 }}>Ajoutez des captures ou lancez le pipeline automatique</div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      background: '#0a0a0f',
      borderRadius: 12,
      padding: 16,
      overflow: 'hidden',
    }}>
      {/* Player header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          color: '#94a3b8',
          fontSize: 12,
          fontWeight: 600,
        }}>
          <span style={{
            padding: '2px 8px',
            background: '#1e293b',
            borderRadius: 6,
            color: '#3b82f6',
          }}>{config.render.format}</span>
          <span>{config.render.mode}</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>{durationInSeconds.toFixed(1)}s</span>
          <span style={{ opacity: 0.5 }}>·</span>
          <span>{storyboard.scenes.length} scènes</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setPlaying(!isPlaying)}
            style={{
              background: isPlaying ? '#1e293b' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {isPlaying ? '⏸ Pause' : '▶ Lecture'}
          </button>
        </div>
      </div>

      {/* Player */}
      <div style={{
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        aspectRatio: `${dims.width} / ${dims.height}`,
        maxHeight: 'calc(100vh - 280px)',
      }}>
        <Player
          component={PreviewComposition}
          inputProps={{
            scenes: storyboard.scenes,
            style: storyboard.style,
            mode: config.render.mode,
            appName: storyboard.appName,
            pitch: storyboard.pitch,
            ctaText: storyboard.ctaText,
          }}
          durationInFrames={totalFrames}
          fps={FPS}
          compositionWidth={dims.width}
          compositionHeight={dims.height}
          style={{ width: '100%', height: '100%' }}
          controls
          loop
          autoPlay={isPlaying}
          numberOfSharedAudioTags={0}
        />
      </div>
    </div>
  );
};
