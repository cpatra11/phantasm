import React from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { FPS, type Aspect, type Layer, type Scene, type SceneDoc } from '../lib/scenedoc';
import { countText, typeText } from '../lib/motion-text';
import { fontStack } from '../lib/fonts';

export type SceneDocVideoProps = { doc: SceneDoc; aspect: Aspect };

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}

function LayerView({ layer, sceneFrames }: { layer: Layer; sceneFrames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { motion, transform, style } = layer;

  const start = Math.round((motion.delayMs / 1000) * fps);
  const dur = Math.max(1, Math.round((motion.durationMs / 1000) * fps));
  const p = interpolate(frame - start, [0, dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = motion.preset === 'none' || motion.preset === 'reveal' || motion.preset === 'type' || motion.preset === 'count-up' ? 1 : p;
  const translateY =
    motion.preset === 'slide-up'
      ? (1 - p) * 40
      : motion.preset === 'float'
        ? Math.sin(((frame / fps) * Math.PI * 2) / 3.4) * 7
        : 0;
  const translateX = motion.preset === 'slide-left' ? (1 - p) * 60 : 0;
  const scale =
    motion.preset === 'pop'
      ? 0.8 + 0.2 * p
      : motion.preset === 'ken-burns'
        ? 1 + 0.07 * interpolate(frame, [0, Math.max(1, sceneFrames)], [0, 1], { extrapolateRight: 'clamp' })
        : 1;

  // Text-bearing presets rewrite the copy per frame: typewriter and count-up.
  const displayText =
    layer.text == null
      ? layer.text
      : motion.preset === 'type'
        ? typeText(layer.text, p)
        : motion.preset === 'count-up'
          ? countText(layer.text, p)
          : layer.text;

  const box: React.CSSProperties = {
    position: 'absolute',
    left: transform.x,
    top: transform.y,
    width: transform.w,
    height: transform.h,
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${transform.rotation}deg)`,
    opacity,
    ...(motion.preset === 'reveal'
      ? { clipPath: `inset(${(1 - p) * 100}% 0 0 0)` }
      : {}),
  };

  if (layer.kind === 'image') {
    if (layer.samCutout) {
      return (
        <div style={box}>
          <Img src={layer.samCutout.backgroundUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <Img src={layer.samCutout.subjectUrl} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
      );
    }
    return (
      <div style={box}>
        {layer.src && <Img src={layer.src} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
    );
  }

  if (layer.kind === 'logo') {
    return (
      <div style={box}>
        {layer.src ? (
          <Img src={layer.src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ ...textStyle(style), height: '100%', display: 'flex', alignItems: 'center' }}>{displayText}</div>
        )}
      </div>
    );
  }

  if (layer.kind === 'shape') {
    return (
      <div
        style={{
          ...box,
          background: str(style.fill, '#1f3fd1'),
          borderRadius: num(style.borderRadius, 0),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...textStyle(style),
        }}
      >
        {displayText}
      </div>
    );
  }

  if (layer.kind === 'callout') {
    return (
      <div
        style={{
          ...box,
          background: str(style.fill, '#ffffff'),
          borderRadius: num(style.borderRadius, 0),
          padding: num(style.padding, 0),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...textStyle(style),
        }}
      >
        {displayText}
      </div>
    );
  }

  return <div style={{ ...box, ...textStyle(style), whiteSpace: 'pre-wrap' }}>{displayText}</div>;
}

function textStyle(style: Layer['style']): React.CSSProperties {
  return {
    fontFamily: fontStack(str(style.fontFamily, ''), 'heading'),
    fontSize: num(style.fontSize, 64),
    fontWeight: num(style.fontWeight, 700) as React.CSSProperties['fontWeight'],
    color: str(style.color, '#111116'),
    textAlign: (str(style.textAlign, 'left') as React.CSSProperties['textAlign']),
    lineHeight: 1.05,
    letterSpacing: '-0.03em',
  };
}

function SceneView({ scene }: { scene: Scene }) {
  const sceneFrames = Math.max(1, Math.round((scene.durationMs / 1000) * FPS));
  return (
    <AbsoluteFill style={{ background: scene.background }}>
      {scene.layers.map((layer) => (
        <LayerView key={layer.id} layer={layer} sceneFrames={sceneFrames} />
      ))}
    </AbsoluteFill>
  );
}

/** The one composition used by both the in-app preview and the Remotion Lambda render. */
export const SceneDocVideo: React.FC<SceneDocVideoProps> = ({ doc }) => {
  let from = 0;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {doc.scenes.map((scene) => {
        const frames = Math.max(1, Math.round((scene.durationMs / 1000) * FPS));
        const seq = (
          <Sequence key={scene.id} from={from} durationInFrames={frames}>
            <SceneView scene={scene} />
          </Sequence>
        );
        from += frames;
        return seq;
      })}
    </AbsoluteFill>
  );
};
