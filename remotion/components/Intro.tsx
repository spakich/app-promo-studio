import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

/**
 * Intro — animated logo/title card.
 * Used at the start of every promo video.
 */

export interface IntroProps {
  appName: string;
  tagline: string;
  bgColor: string;
  accentColor: string;
  fontFamily: string;
}

export const Intro: React.FC<IntroProps> = ({ appName, tagline, bgColor, accentColor, fontFamily }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // App name: spring pop
  const nameSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  // Tagline: fade up with delay
  const taglineProgress = interpolate(frame, [fps * 0.8, fps * 1.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Background ripple
  const rippleScale = interpolate(frame, [0, fps * 3], [0, 3], { extrapolateRight: 'clamp' });
  const rippleOpacity = interpolate(frame, [0, fps * 0.5, fps * 2.5, fps * 3], [0, 0.3, 0.1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: bgColor, justifyContent: 'center', alignItems: 'center' }}>
      {/* Ripple */}
      <div
        style={{
          position: 'absolute',
          width: 200,
          height: 200,
          borderRadius: '50%',
          border: `2px solid ${accentColor}`,
          opacity: rippleOpacity,
          transform: `scale(${rippleScale})`,
        }}
      />

      {/* App name */}
      <div
        style={{
          fontFamily,
          fontSize: 120,
          fontWeight: 800,
          color: 'white',
          opacity: interpolate(nameSpring, [0, 0.5], [0, 1], { extrapolateRight: 'clamp' }),
          transform: `scale(${nameSpring})`,
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        {appName}
      </div>

      {/* Tagline */}
      <div
        style={{
          fontFamily,
          fontSize: 36,
          fontWeight: 500,
          color: accentColor,
          marginTop: 20,
          opacity: taglineProgress,
          transform: `translateY(${interpolate(taglineProgress, [0, 1], [20, 0])}px)`,
          zIndex: 1,
        }}
      >
        {tagline}
      </div>
    </AbsoluteFill>
  );
};
