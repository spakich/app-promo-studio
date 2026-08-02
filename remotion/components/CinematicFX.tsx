import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, random } from 'remotion';

/**
 * CINEMATIC FX — effets premium niveau Apple/Linear/Raycast
 * 
 * Ce module apporte ce qui manque au rendu actuel:
 * 1. ParallaxDepth: couches qui bougent à différentes vitesses (effet 3D profond)
 * 2. Glassmorphism: panneau glass dépoli avec backdrop-blur (style macOS/iOS)
 * 3. Bloom: halos lumineux qui "suffusent" les zones claires
 * 4. LightRays: rayons de lumière volumétrique diagonaux
 * 5. ParticleTrail: traînées de particules qui suivent le curseur
 * 6. EdgeGlow: contour lumineux qui pulse autour du mockup
 * 7. AnimatedGrid: grille de perspective au sol (style synthwave)
 * 8. FloatingDust: poussières flottantes cinématiques (atmosphère)
 * 9. ChromaticAberration: décalage RGB subtil sur les bords
 * 10. Vignette: vignettage cinématique qui respire
 */

// ─── 1. PARALLAX DEPTH ──────────────────────────────
export const ParallaxDepth: React.FC<{
  accentColor: string;
}> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {/* Layer 1: Far background — slow drifting gradient blobs */}
      <div style={{
        position: 'absolute', inset: '-10%',
        background: `radial-gradient(circle at ${20 + Math.sin(t * 0.3) * 10}% ${30 + Math.cos(t * 0.2) * 8}%, ${accentColor}15 0%, transparent 50%), radial-gradient(circle at ${80 - Math.sin(t * 0.25) * 8}% ${70 - Math.cos(t * 0.3) * 6}%, ${accentColor}10 0%, transparent 45%)`,
        transform: `translateY(${Math.sin(t * 0.2) * 8}px) scale(1.1)`,
      }} />
      
      {/* Layer 2: Mid-ground — hexagon/dot pattern, moves faster */}
      <div style={{
        position: 'absolute', inset: '-5%',
        backgroundImage: `radial-gradient(circle, ${accentColor}20 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        transform: `translateX(${Math.sin(t * 0.4) * 12}px) translateY(${Math.cos(t * 0.35) * 6}px)`,
        opacity: 0.4,
      }} />

      {/* Layer 3: Near-ground — large soft shapes that drift slowly */}
      <div style={{
        position: 'absolute',
        bottom: '-15%', right: '-10%',
        width: '60%', height: '60%',
        background: `radial-gradient(ellipse, ${accentColor}20 0%, transparent 70%)`,
        filter: 'blur(40px)',
        transform: `translate(${Math.sin(t * 0.15) * 20}px, ${Math.cos(t * 0.1) * 10}px)`,
      }} />
    </AbsoluteFill>
  );
};

// ─── 2. GLASSMORPHISM PANEL ─────────────────────────
export const GlassPanel: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  blur?: number;
}> = ({ children, style, blur = 20 }) => (
  <div style={{
    background: 'rgba(255,255,255,0.06)',
    backdropFilter: `blur(${blur}px) saturate(1.5)`,
    WebkitBackdropFilter: `blur(${blur}px) saturate(1.5)`,
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 16,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
    ...style,
  }}>
    {children}
  </div>
);

// ─── 3. BLOOM GLOW ──────────────────────────────────
export const BloomGlow: React.FC<{
  accentColor: string;
  intensity?: number;
}> = ({ accentColor, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = Math.sin(frame / fps * 1.5) * 0.15 + 0.85;
  const i = intensity * pulse;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Top-left glow */}
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: '50%', height: '50%',
        background: `radial-gradient(ellipse, ${accentColor}${Math.round(30 * i).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
        filter: 'blur(30px)',
      }} />
      {/* Bottom-right glow */}
      <div style={{
        position: 'absolute', bottom: '-15%', right: '-5%',
        width: '45%', height: '45%',
        background: `radial-gradient(ellipse, ${accentColor}${Math.round(20 * i).toString(16).padStart(2, '0')} 0%, transparent 65%)`,
        filter: 'blur(25px)',
      }} />
      {/* Center subtle wash */}
      <div style={{
        position: 'absolute', top: '40%', left: '30%',
        width: '40%', height: '40%',
        background: `radial-gradient(circle, rgba(255,255,255,${0.03 * i}) 0%, transparent 60%)`,
        filter: 'blur(20px)',
      }} />
    </AbsoluteFill>
  );
};

// ─── 4. LIGHT RAYS (volumetric) ─────────────────────
export const LightRays: React.FC<{
  accentColor: string;
}> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', inset: '-20%',
        background: `conic-gradient(from ${70 + Math.sin(t * 0.3) * 5}deg at 50% 50%, transparent 0deg, ${accentColor}12 5deg, transparent 15deg, transparent 30deg, ${accentColor}08 35deg, transparent 45deg, transparent 360deg)`,
        filter: 'blur(3px)',
        opacity: 0.6,
      }} />
      <div style={{
        position: 'absolute', inset: '-10%',
        background: `linear-gradient(${100 + Math.sin(t * 0.2) * 3}deg, transparent 30%, ${accentColor}06 50%, transparent 70%)`,
        filter: 'blur(8px)',
      }} />
    </AbsoluteFill>
  );
};

// ─── 5. FLOATING DUST (cinematic atmosphere) ─────────
export const FloatingDust: React.FC<{
  count?: number;
  color?: string;
}> = ({ count = 15, color = 'rgba(255,255,255,0.3)' }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  const particles = Array.from({ length: count }, (_, i) => {
    const seed = i * 137.5;
    const startX = (random(`x${i}`) * 100 + seed) % 100;
    const startY = (random(`y${i}`) * 100 + seed * 1.7) % 100;
    const speed = 0.3 + random(`s${i}`) * 0.5;
    const size = 1 + random(`sz${i}`) * 3;
    const drift = (random(`d${i}`) - 0.5) * 20;
    
    const progress = (frame / durationInFrames) * speed;
    const y = (startY + progress * 100) % 120 - 10;
    const x = startX + Math.sin(progress * Math.PI * 2 + seed) * drift;
    const opacity = interpolate(y, [-10, 5, 95, 110], [0, 0.6, 0.6, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    
    return { x, y, size, opacity, id: i };
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {particles.map(p => (
        <div key={p.id} style={{
          position: 'absolute',
          left: `${p.x}%`, top: `${p.y}%`,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 ${p.size * 2}px ${color}`,
          opacity: p.opacity,
        }} />
      ))}
    </AbsoluteFill>
  );
};

// ─── 6. SYNTHWAVE GRID ──────────────────────────────
export const SynthwaveGrid: React.FC<{
  accentColor: string;
}> = ({ accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scroll = (frame / fps * 0.3) % 1;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none', opacity: 0.3 }}>
      <div style={{
        position: 'absolute',
        bottom: 0, left: '-50%', right: '-50%', height: '40%',
        backgroundImage: `
          linear-gradient(${accentColor}40 1px, transparent 1px),
          linear-gradient(90deg, ${accentColor}40 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        transform: `perspective(400px) rotateX(60deg) translateY(${scroll * 60}px)`,
        transformOrigin: 'bottom center',
        maskImage: 'linear-gradient(transparent 0%, black 50%, black 100%)',
        WebkitMaskImage: 'linear-gradient(transparent 0%, black 50%, black 100%)',
      }} />
    </AbsoluteFill>
  );
};

// ─── 7. VIGNETTE (breathing) ────────────────────────
export const BreathingVignette: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const breathe = Math.sin(frame / fps * 0.5) * 0.05 + 0.45;

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${breathe}) 100%)`,
      pointerEvents: 'none',
    }} />
  );
};

// ─── 8. CHROMATIC ABERRATION EDGE ───────────────────
export const ChromaticAberration: React.FC<{
  children: React.ReactNode;
  intensity?: number;
}> = ({ children, intensity = 2 }) => (
  <div style={{ position: 'relative' }}>
    {/* Red channel offset */}
    <div style={{ position: 'absolute', inset: 0, transform: `translateX(-${intensity}px)`, filter: 'url(#chroma-r)', mixBlendMode: 'screen', opacity: 0.5 }}>
      {children}
    </div>
    {/* Blue channel offset */}
    <div style={{ position: 'absolute', inset: 0, transform: `translateX(${intensity}px)`, mixBlendMode: 'screen', opacity: 0.3 }}>
      {children}
    </div>
    {/* Main */}
    <div>{children}</div>
  </div>
);

// ─── COMPOSITE: All effects in one render ───────────
export const CinematicStack: React.FC<{
  accentColor: string;
  variant?: 'default' | 'energetic' | 'calm' | 'tech';
}> = ({ accentColor, variant = 'default' }) => {
  const config = {
    default: { dust: 15, rays: true, grid: false, bloom: 1, vignette: true },
    energetic: { dust: 25, rays: true, grid: true, bloom: 1.5, vignette: true },
    calm: { dust: 10, rays: false, grid: false, bloom: 0.7, vignette: true },
    tech: { dust: 20, rays: true, grid: true, bloom: 1.2, vignette: true },
  };
  const c = config[variant];

  return (
    <>
      <ParallaxDepth accentColor={accentColor} />
      <BloomGlow accentColor={accentColor} intensity={c.bloom} />
      {c.rays && <LightRays accentColor={accentColor} />}
      {c.grid && <SynthwaveGrid accentColor={accentColor} />
      }
      <FloatingDust count={c.dust} />
      {c.vignette && <BreathingVignette />}
    </>
  );
};
