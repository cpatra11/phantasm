'use client';

import { Player, Thumbnail } from '@remotion/player';
import { SceneDocVideo } from '../remotion/SceneDocVideo';
import { ASPECTS, FPS, deriveLayout, durationFrames, firstSceneReadyFrame, type Aspect, type SceneDoc } from '../lib/scenedoc';

/**
 * Preview of a SceneDoc at the chosen aspect.
 * mode "player" is scrubbing video; mode "thumb" is a static frame of the first
 * scene once its layers have entered (frame 0 is a blank background).
 */
export function PlayerPreview({
  doc,
  aspect,
  width,
  mode = 'player',
}: {
  doc: SceneDoc;
  aspect: Aspect;
  width: number;
  mode?: 'player' | 'thumb';
}) {
  const derived = deriveLayout(doc, aspect);
  const size = ASPECTS[aspect];
  const frame = firstSceneReadyFrame(derived);
  if (mode === 'thumb') {
    return (
      <div className="preview-frame" style={{ width, height: (width * size.height) / size.width }}>
        <Thumbnail
          component={SceneDocVideo}
          inputProps={{ doc: derived, aspect }}
          durationInFrames={durationFrames(derived)}
          compositionWidth={size.width}
          compositionHeight={size.height}
          fps={FPS}
          frameToDisplay={frame}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }
  return (
    <div className="preview-frame" style={{ width, height: (width * size.height) / size.width }}>
      <Player
        component={SceneDocVideo}
        inputProps={{ doc: derived, aspect }}
        durationInFrames={durationFrames(derived)}
        compositionWidth={size.width}
        compositionHeight={size.height}
        fps={FPS}
        style={{ width: '100%', height: '100%' }}
        // Start on a composed frame: frame 0 shows the fade-ins before they begin.
        initialFrame={firstSceneReadyFrame(derived)}
        controls
        loop
      />
    </div>
  );
}
