import React from 'react';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import { SceneDocVideo, type SceneDocVideoProps } from './SceneDocVideo';
import { ASPECTS, FPS, deriveLayout, durationFrames, makeLayer, type SceneDoc } from '../lib/scenedoc';

/** Sizes the composition and derives the layout from the authored 9:16 master for the requested aspect. */
const calculateMetadata: CalculateMetadataFunction<SceneDocVideoProps> = ({ props }) => {
  const size = ASPECTS[props.aspect];
  const doc = deriveLayout(props.doc, props.aspect);
  return {
    width: size.width,
    height: size.height,
    fps: FPS,
    durationInFrames: durationFrames(doc),
    props: { ...props, doc },
  };
};

// Pure sample doc: this bundle runs in a browser (Lambda), so nothing
// server-side (storage, model clients) may be imported from here.
const sample: SceneDoc = {
  id: 'sample',
  title: 'Sample',
  scenes: [
    {
      id: 's1',
      durationMs: 4000,
      background: '#FDFAF1',
      layers: [
        makeLayer({
          id: 's1-headline',
          kind: 'text',
          name: 'Headline',
          transform: { x: 90, y: 760, w: 900, h: 300 },
          text: 'Sample headline',
          style: { fontFamily: 'DM Serif Display', fontSize: 120, fontWeight: 700, color: '#171817' },
          motion: { preset: 'reveal', delayMs: 150, durationMs: 600 },
        }),
      ],
    },
  ],
};

export const RemotionRoot: React.FC = () => (
  <Composition
    id="SceneDoc"
    component={SceneDocVideo}
    durationInFrames={FPS * 6}
    fps={FPS}
    width={ASPECTS['9:16'].width}
    height={ASPECTS['9:16'].height}
    defaultProps={{ doc: sample, aspect: '9:16' as const }}
    calculateMetadata={calculateMetadata}
  />
);
