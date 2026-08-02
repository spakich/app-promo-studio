import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { getEasing } from '../animations/easings';

/**
 * Intro — animated logo reveal with accent glow.
 * 3 seconds. The app name slides in with a light sweep.
 */
export const IntroScene: React.FC<{
  appName: string;
  pitch?: string;
  style: {
    bgColor: string;
    accentColor: string;
    fontFamily: string;
  };
}> = ({ appName, pitch, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const easing = getEasing('expoOut');

  // Logo scale: pop in with overshoot
  const logoScale = easing(
    interpolate(frame, [0, Math.round(fps * 0.6)], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );
  const logoOpacity = interpolate(frame, [0, Math.round(fps * 0.3)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Name slides up
  const nameY = interpolate(frame, [Math.round(fps * 0.3), Math.round(fps * 0.9)], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nameOpacity = interpolate(frame, [Math.round(fps * 0.3), Math.round(fps * 0.8)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Glow pulse
  const glow = interpolate(
    Math.sin(frame / (fps * 1.5)) * 0.5 + 0.5,
    [0, 1],
    [0.3, 0.7]
  );

  // Exit fade
  const exitOpacity = interpolate(frame, [Math.round(fps * 2.4), Math.round(fps * 3)], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const overshoot = getEasing('backOut')(logoScale);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: style.bgColor,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: exitOpacity,
      }}
    >
      {/* Glow halo */}
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${style.accentColor}${Math.round(glow * 255).toString(16).padStart(2, '0')} 0%, transparent 65%)`,
          filter: 'blur(40px)',
          transform: `scale(${overshoot * 1.5})`,
        }}
      />

      {/* Logo box */}
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: 24,
          background: `linear-gradient(135deg, ${style.accentColor}, #a855f7)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 20px 60px ${style.accentColor}66, 0 0 0 1px rgba(255,255,255,0.1)`,
          transform: `scale(${overshoot})`,
          opacity: logoOpacity,
          marginBottom: 32,
        }}
      >
        <span style={{ fontSize: 48, fontWeight: 900, color: 'white', fontFamily: style.fontFamily }}>
          {appName.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* App name */}
      <div
        style={{
          color: 'white',
          fontSize: 56,
          fontWeight: 800,
          fontFamily: style.fontFamily,
          letterSpacing: '0',
          transform: `translateY(${nameY}px)`,
          opacity: nameOpacity,
          textShadow: '0 4px 30px rgba(0,0,0,0.5)',
        }}
      >
        {appName}
      </div>

      {/* Pitch */}
      {pitch && (
        <div
          style={{
            color: '#E2E8F0',
            fontSize: 24,
            fontFamily: style.fontFamily,
            fontWeight: 400,
            marginTop: 16,
            opacity: interpolate(frame, [Math.round(fps * 0.8), Math.round(fps * 1.4)], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${nameY * 0.5}px)`,
          }}
        >
          {pitch}
        </div>
      )}

      {/* Accent underline */}
      <div
        style={{
          width: interpolate(frame, [Math.round(fps * 0.5), Math.round(fps * 1.2)], [0, 120], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          height: 3,
          borderRadius: 2,
          background: style.accentColor,
          marginTop: 24,
          boxShadow: `0 0 20px ${style.accentColor}`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * Outro — CTA screen with app name, offer, and accent button.
 * 4 seconds. Strong closing frame.
 */
export const OutroScene: React.FC<{
  appName: string;
  pitch?: string;
  ctaText?: string;
  style: {
    bgColor: string;
    accentColor: string;
    fontFamily: string;
  };
}> = ({ appName, pitch, ctaText = 'Essayer gratuitement', style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterOpacity = interpolate(frame, [0, Math.round(fps * 0.5)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const titleScale = getEasing('backOut')(
    interpolate(frame, [Math.round(fps * 0.2), Math.round(fps * 0.8)], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  const ctaY = interpolate(frame, [Math.round(fps * 0.8), Math.round(fps * 1.4)], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaOpacity = interpolate(frame, [Math.round(fps * 0.8), Math.round(fps * 1.3)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Button pulse
  const pulse = interpolate(
    Math.sin(frame / (fps * 1.2)) * 0.5 + 0.5,
    [0, 1],
    [1, 1.04]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: style.bgColor,
        justifyContent: 'center',
        alignItems: 'center',
        opacity: enterOpacity,
      }}
    >
      {/* Background glow */}
      <div
        style={{
          position: 'absolute',
          width: '80%',
          height: '80%',
          background: `radial-gradient(ellipse at center, ${style.accentColor}22 0%, transparent 60%)`,
          filter: 'blur(80px)',
        }}
      />

      {/* App name */}
      <div
        style={{
          color: 'white',
          fontSize: 72,
          fontWeight: 900,
          fontFamily: style.fontFamily,
          letterSpacing: '0',
          transform: `scale(${titleScale})`,
          textShadow: `0 4px 40px rgba(0,0,0,0.6)`,
          zIndex: 2,
        }}
      >
        {appName}
      </div>

      {/* Pitch */}
      {pitch && (
        <div
          style={{
            color: '#E2E8F0',
            fontSize: 28,
            fontFamily: style.fontFamily,
            fontWeight: 400,
            marginTop: 20,
            textAlign: 'center',
            maxWidth: '60%',
            opacity: enterOpacity,
            zIndex: 2,
          }}
        >
          {pitch}
        </div>
      )}

      {/* CTA Button */}
      <div
        style={{
          marginTop: 48,
          padding: '18px 48px',
          borderRadius: 14,
          background: `linear-gradient(135deg, ${style.accentColor}, #a855f7)`,
          color: 'white',
          fontSize: 24,
          fontWeight: 700,
          fontFamily: style.fontFamily,
          boxShadow: `0 10px 40px ${style.accentColor}66`,
          transform: `translateY(${ctaY}px) scale(${pulse})`,
          opacity: ctaOpacity,
          zIndex: 2,
        }}
      >
        {ctaText}
      </div>
    </AbsoluteFill>
  );
};
